// Headless UI test for ingredientes.html — the layer between a barcode and
// a recipe. Covers: the list and its search across BRAND names (not just
// the ingredient's own), the kind filter, the "sem insumo" orphan marker,
// the combined pantry rollup across brands (the whole point of the
// two-level model), rename with the duplicate-name refusal, delete with the
// unlink count, and the blocking refusal when a receita line still
// references the ingredient.
//
//   node test/ingredientes.test.js      # exits non-zero on any failure
//
// The fake keeps real relational state: insumos point at ingredients by id,
// so the rollup, the orphan marker and the unlink count are all computed
// from that graph rather than canned — same "don't fake away the
// interesting half" convention as stock.test.js's ledger.
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

function loadPlaywright() {
  for (const id of ['playwright', '/opt/node22/lib/node_modules/playwright']) {
    try { return require(id); } catch (_) { /* try the next */ }
  }
  console.error('playwright not found — npm i -D playwright, or set NODE_PATH');
  process.exit(2);
}
const { chromium } = loadPlaywright();

const WEB_DIR = path.resolve(__dirname, '..');
const SHOTS = fs.mkdtempSync(path.join(os.tmpdir(), 'ingredientes-test-'));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript',
                '.css': 'text/css', '.png': 'image/png' };

function serve() {
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
      const file = path.join(WEB_DIR, rel || 'ingredientes.html');
      if (!file.startsWith(WEB_DIR)) { res.writeHead(403).end(); return; }
      fs.readFile(file, (err, body) => {
        if (err) { res.writeHead(404).end(); return; }
        res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
        res.end(body);
      });
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

// Two brands of one ingredient (the case the whole model exists for), a
// packaging ingredient, and an orphan nothing points at — which is exactly
// what a typo in the insumo picker leaves behind.
const state = {
  ingredients: [
    { id: 'I1', name: 'Leite Condensado', base_unit: 'g', kind: 'ingrediente' },
    { id: 'I2', name: 'Caixa Kraft', base_unit: 'un', kind: 'embalagem' },
    { id: 'I3', name: 'Leit Condensado', base_unit: null, kind: 'ingrediente' },
  ],
  insumos: [
    { gtin: '7891000100103', name: 'Leite Condensado Moça', brand: 'Nestlé',
      net_qty: 395, net_unit: 'g', qty: 3, last_price: 7.49, kind: 'ingrediente',
      image_url: null, ingredient_id: 'I1' },
    { gtin: '7898929966827', name: 'Leite Condensado Italac', brand: 'Italac',
      net_qty: 395, net_unit: 'g', qty: 2, last_price: 6.99, kind: 'ingrediente',
      image_url: null, ingredient_id: 'I1' },
    { gtin: '0000000000017', name: 'Caixa Kraft 20cm', brand: null,
      net_qty: 50, net_unit: 'un', qty: 1, last_price: 65, kind: 'embalagem',
      image_url: null, ingredient_id: 'I2' },
    { gtin: '0000000000024', name: 'Fita de Cetim', brand: null,
      net_qty: 1000, net_unit: 'cm', qty: 0, last_price: null, kind: 'embalagem',
      image_url: null, ingredient_id: null },
  ],
  // A live recipe line, so the blocking delete has something real to block on.
  receitaItens: [{ id: 'RI1', ingredient_id: 'I1' }],
  produtoEmbalagens: [],
};

const ingredientOf = (id) => state.ingredients.find(i => i.id === id);

(async () => {
  const failures = [];
  const server = await serve();
  const PAGE = 'http://127.0.0.1:' + server.address().port + '/ingredientes.html';
  const browser = await chromium.launch(
    process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const ctx = await browser.newContext({ viewport: { width: 414, height: 900 } });

  const errors = [];
  ctx.on('weberror', e => errors.push('pageerror: ' + e.error().message));

  await ctx.route('**/functions/v1/checklist-api', async route => {
    const body = route.request().postDataJSON();
    let resp;
    let status = 200;

    if (body.action === 'ingredients') {
      resp = { ingredients: state.ingredients.map(i => ({
        ...i,
        insumo_count: state.insumos.filter(p => p.ingredient_id === i.id).length,
      })) };
    } else if (body.action === 'insumos') {
      // Mirrors INSUMO_COLS' many-to-one embed, aliased to the singular.
      resp = { insumos: state.insumos.map(p => {
        const ing = p.ingredient_id ? ingredientOf(p.ingredient_id) : null;
        return { ...p, ingredient: ing ? { id: ing.id, name: ing.name } : null };
      }) };
    } else if (body.action === 'ingredient_rename') {
      const i = ingredientOf(body.id);
      const name = String(body.name || '').trim();
      // The unique index on lower(name) is what refuses a duplicate — the
      // API surfaces that as a 400, not as a silent merge.
      const clash = state.ingredients.some(x =>
        x.id !== body.id && x.name.toLowerCase() === name.toLowerCase());
      if (!i || !name || clash) {
        status = 400;
        resp = { error: clash ? 'duplicate key value' : 'unknown ingredient' };
      } else {
        i.name = name;
        resp = { ok: true, ingredient: { id: i.id, name: i.name, base_unit: i.base_unit } };
      }
    } else if (body.action === 'ingredient_delete') {
      const receitaCount = state.receitaItens.filter(r => r.ingredient_id === body.id).length;
      const embalagemCount = state.produtoEmbalagens.filter(e => e.ingredient_id === body.id).length;
      if (receitaCount > 0 || embalagemCount > 0) {
        // Blocking, not force-able: a live formula can't be pulled out from
        // under itself.
        status = 400;
        resp = { error: 'ingredient is in use',
                 receita_itens: receitaCount, produto_embalagens: embalagemCount };
      } else {
        const unlinked = state.insumos.filter(p => p.ingredient_id === body.id);
        unlinked.forEach(p => { p.ingredient_id = null; });
        state.ingredients = state.ingredients.filter(i => i.id !== body.id);
        resp = { ok: true, insumos_unlinked: unlinked.length };
      }
    } else {
      resp = { error: 'bad action ' + body.action };
    }
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(resp) });
  });

  const page = await ctx.newPage();
  // Chromium logs its own "Failed to load resource" console error for any
  // non-2xx response — including the 400s this suite deliberately triggers.
  // That's expected network noise, not an app bug.
  page.on('console', m => {
    if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) {
      errors.push('console: ' + m.text());
    }
  });

  const check = (label, cond) => { if (!cond) failures.push('FAIL: ' + label); };
  const norm = (s) => s.replace(/ /g, ' ');

  // --- the passphrase gate, same shell as every other page ---
  await page.goto(PAGE);
  await page.waitForSelector('#pw', { timeout: 6000 });
  check('locked until a passphrase is entered', (await page.$('#pw')) !== null);
  await page.fill('#pw', 'x');
  await page.click('#enter');
  await page.waitForSelector('.row[data-id]', { timeout: 6000 });

  // --- the list ---
  check('every ingredient is listed', (await page.$$('.row[data-id]')).length === 3);
  const listText = norm(await page.textContent('#ing-card'));
  check('a linked ingredient counts its insumos, got: ' + listText,
    listText.includes('2 insumos'));
  check('and shows the combined package count across brands (3 + 2 = 5)',
    listText.includes('5 un'));
  // The orphan marker is what makes a picker typo findable at all.
  check('an ingredient nothing points at is marked',
    (await page.$$('.kind-badge.orphan')).length === 1 &&
    norm(await page.textContent('.row[data-id="I3"]')).includes('sem insumo'));

  // --- search matches the BRAND, not only the ingredient's own name ---
  await page.fill('#search', 'italac');
  await page.waitForFunction(() => document.querySelectorAll('.row[data-id]').length === 1);
  check('searching a brand finds the ingredient it belongs to',
    (await page.textContent('.row[data-id]')).includes('Leite Condensado'));
  await page.fill('#search', '');
  await page.waitForFunction(() => document.querySelectorAll('.row[data-id]').length === 3);

  // --- the kind filter ---
  await page.click('.chip[data-kind="embalagem"]');
  await page.waitForFunction(() => document.querySelectorAll('.row[data-id]').length === 1);
  check('the kind filter narrows to packaging',
    (await page.textContent('.row[data-id]')).includes('Caixa Kraft'));
  await page.click('.chip[data-kind=""]');
  await page.waitForFunction(() => document.querySelectorAll('.row[data-id]').length === 3);

  // --- detail: the combined pantry rollup, the answer "tenho leite
  // condensado?" that neither Insumos nor Estoque can give ---
  await page.click('.row[data-id="I1"]');
  await page.waitForSelector('.have-card', { timeout: 6000 });
  const haveText = norm(await page.textContent('.have-card'));
  check('the rollup sums packages across brands, got: ' + haveText,
    haveText.includes('5 pacotes'));
  // 3 x 395 g + 2 x 395 g = 1975 g, rendered up to kg by fmtNetQty.
  check('and sums the net amount when the units agree, got: ' + haveText,
    haveText.includes('1,975 kg'));
  check('both brands are listed', (await page.$$('.ins-row')).length === 2);
  check('each links to its own insumo',
    (await page.getAttribute('.ins-row', 'data-gtin')) === '7891000100103');

  // --- rename: refused when the name already exists ---
  await page.click('#rename-ing');
  await page.waitForSelector('#prompt-input', { timeout: 6000 });
  await page.fill('#prompt-input', 'Caixa Kraft');
  await page.click('#prompt-ok');
  await page.waitForSelector('#list-toast.show.err', { timeout: 6000 });
  check('renaming onto an existing name is refused, not silently merged',
    norm(await page.textContent('#list-toast')).includes('Já existe'));
  check('and the name is unchanged', ingredientOf('I1').name === 'Leite Condensado');

  // --- rename: a real correction goes through, and the insumos follow ---
  await page.click('#rename-ing');
  await page.waitForSelector('#prompt-input', { timeout: 6000 });
  await page.fill('#prompt-input', 'Leite Condensado Integral');
  await page.click('#prompt-ok');
  await page.waitForFunction(
    () => (document.getElementById('ing-name') || {}).textContent === 'Leite Condensado Integral',
    null, { timeout: 6000 });
  check('the rename is stored', ingredientOf('I1').name === 'Leite Condensado Integral');

  // --- delete is BLOCKED while a receita line still references it ---
  await page.click('#del-ing');
  await page.waitForSelector('#confirm-ok', { timeout: 6000 });
  await page.click('#confirm-ok');
  await page.waitForSelector('#confirm-ok', { timeout: 6000 });
  const blockText = norm(await page.textContent('.modal-card'));
  check('a live receita line blocks the delete and says so, got: ' + blockText,
    blockText.includes('1 linha de receita'));
  check('the ingredient survives', !!ingredientOf('I1'));
  await page.click('#confirm-ok');

  // --- with the recipe line gone, the delete goes through and reports how
  // many insumos it UNLINKED (it never deletes an insumo) ---
  state.receitaItens = [];
  await page.click('#del-ing');
  await page.waitForSelector('#confirm-ok', { timeout: 6000 });
  const warnText = norm(await page.textContent('.modal-card'));
  check('the confirm warns what will be unlinked, got: ' + warnText,
    warnText.includes('2 insumos serão desvinculados'));
  await page.click('#confirm-ok');
  await page.waitForFunction(
    () => document.querySelectorAll('.row[data-id]').length === 2, null, { timeout: 6000 });
  check('the ingredient is gone', !ingredientOf('I1'));
  check('but BOTH insumos survive, merely unlinked',
    state.insumos.filter(p => p.gtin.startsWith('789')).length === 2 &&
    state.insumos.filter(p => p.ingredient_id === 'I1').length === 0);
  check('a toast reports the unlink count',
    norm(await page.textContent('#list-toast')).includes('2 insumos desvinculados'));

  // --- the deep link opens a detail sheet directly ---
  await page.goto(PAGE + '?id=I2');
  await page.waitForSelector('.have-card', { timeout: 6000 });
  check('the deep link opens the right ingredient',
    (await page.textContent('#ing-name')).includes('Caixa Kraft'));

  // --- the menu carries this page, and marks it as the current one ---
  await page.click('#menu-btn');
  await page.waitForSelector('.menu-panel.open', { timeout: 6000 });
  const menuItems = await page.$$eval('.menu-item', els =>
    els.map(e => ({ tag: e.tagName, text: e.textContent.trim() })));
  const menuCount = await page.evaluate(() => MENU_ITEMS.length);
  check('the menu lists every destination plus logout, got ' + menuItems.length,
    menuItems.length === menuCount + 1);
  check('Ingredientes renders as an inert label on its own page',
    menuItems.some(m => m.tag === 'SPAN' && m.text === '🧂 Ingredientes'));

  await page.screenshot({ path: path.join(SHOTS, 'final.png'), fullPage: true });
  await browser.close();
  server.close();

  console.log('--- JS errors ---');
  console.log(errors.length ? errors.join('\n') : '(none)');
  console.log('--- failures ---');
  console.log(failures.length ? failures.join('\n') : '(none)');
  if (process.env.KEEP_SHOTS) console.log('screenshots: ' + SHOTS);
  if (failures.length || errors.length) process.exit(1);
})();
