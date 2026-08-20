// Headless smoke test for tarefas.html — the daily-task checklist (renamed
// from index.html when the dashboard took over that filename).
//
//   node test/tarefas.test.js            # exits non-zero on any failure
//   KEEP_SHOTS=1 node test/...           # also prints where screenshots went
//
// Added alongside the front-end refactor that moved this page onto the
// shared JS/CSS files: before that refactor this page had zero automated
// coverage, so a real behavior change (api()/handleAuthError()
// unification, the fmtDateTime reconciliation) could have shipped
// unnoticed. Covers the passphrase gate, the menu, the core create/edit/
// delete/done/undo flows and the done-tasks section.
//
// Same shape as compras.test.js/hoje.test.js: serves the repo root over
// http and answers checklist-api from an in-memory fake, so it never
// touches Supabase and never needs a real passphrase.
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
const SHOTS = fs.mkdtempSync(path.join(os.tmpdir(), 'tarefas-test-'));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript',
                '.css': 'text/css', '.png': 'image/png' };

function serve() {
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
      const file = path.join(WEB_DIR, rel || 'tarefas.html');
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

const state = {
  actions: [
    { id: 'A1', text: 'Responder e-mail do banco', source: 'email',
      status: 'pending', first_seen: '2026-08-19T10:00:00Z' },
    { id: 'A2', text: 'Ligar para o Igor', source: 'whatsapp',
      status: 'pending', first_seen: '2026-08-19T11:00:00Z' },
  ],
  seq: 2,
};

(async () => {
  const failures = [];
  const server = await serve();
  const PAGE = 'http://127.0.0.1:' + server.address().port + '/tarefas.html';
  const browser = await chromium.launch(
    process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const ctx = await browser.newContext({ viewport: { width: 414, height: 860 } });

  const errors = [];
  ctx.on('weberror', e => errors.push('pageerror: ' + e.error().message));

  await ctx.route('**/functions/v1/checklist-api', async route => {
    const body = route.request().postDataJSON();
    let resp;
    if (body.action === 'list') {
      resp = { actions: state.actions.filter(a => a.status === 'pending') };
    } else if (body.action === 'action_create') {
      const a = { id: 'A' + (++state.seq), text: body.text, source: 'manual',
        status: 'pending', first_seen: new Date().toISOString() };
      state.actions.push(a);
      resp = { ok: true, action: a };
    } else if (body.action === 'action_edit') {
      const a = state.actions.find(x => x.id === body.id);
      if (a) {
        if ('text' in body) a.text = body.text;
        if ('source' in body) a.source = body.source;
      }
      resp = { ok: true, action: a };
    } else if (body.action === 'action_delete') {
      state.actions.forEach(a => { if (body.ids.includes(a.id)) a.status = 'deleted'; });
      resp = { ok: true };
    } else if (body.action === 'done') {
      state.actions.forEach(a => {
        if (body.ids.includes(a.id)) { a.status = 'done'; a.done_at = new Date().toISOString(); }
      });
      resp = { ok: true };
    } else if (body.action === 'undo_done') {
      state.actions.forEach(a => {
        if (body.ids.includes(a.id)) { a.status = 'pending'; a.done_at = null; }
      });
      resp = { ok: true };
    } else if (body.action === 'list_done') {
      const done = state.actions.filter(a => a.status === 'done')
        .sort((a, b) => (b.done_at || '').localeCompare(a.done_at || ''));
      const offset = body.offset || 0, limit = body.limit || 5;
      const page = done.slice(offset, offset + limit);
      resp = { actions: page, has_more: offset + page.length < done.length };
    } else {
      resp = { error: 'bad action' };
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(resp) });
  });

  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  const check = (label, cond) => { if (!cond) failures.push('FAIL: ' + label); };

  // --- passphrase gate ---
  await page.goto(PAGE);
  await page.waitForSelector('.login', { timeout: 6000 });
  check('login screen names the page', (await page.textContent('.login h2')) === 'Tarefas pendentes');
  await page.fill('#pw', 'x');
  await page.click('#enter');
  await page.waitForSelector('.row', { timeout: 6000 });

  // --- pending list renders ---
  check('both seeded tasks render', (await page.$$('.row')).length === 2);
  check('the source badge/meta line renders, got: ' + await page.textContent('.row .meta'),
    (await page.textContent('.row .meta')).includes('E-mail'));

  // --- the hamburger menu lists every module, current page inert ---
  await page.click('#menu-btn');
  await page.waitForSelector('.menu-panel.open', { timeout: 6000 });
  const menuLinks = await page.$$eval('.menu-item', els =>
    els.map(e => ({ tag: e.tagName, text: e.textContent.trim(), href: e.getAttribute('href') })));
  check('the menu lists all 8 destinations plus logout, got ' + menuLinks.length,
    menuLinks.length === 9);
  check('the current page (Tarefas) renders as an inert label, not a link',
    menuLinks.some(m => m.tag === 'SPAN' && m.text === '✓ Tarefas'));
  check('Compras is reachable under its renamed href (not the old shopping.html)',
    menuLinks.some(m => m.tag === 'A' && m.href === 'compras.html'));
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('.menu-backdrop'), null, { timeout: 6000 });

  // --- create ---
  await page.fill('#new-text', 'Comprar pilhas');
  await page.click('#add-btn');
  await page.waitForFunction(() => document.querySelectorAll('.row').length === 3, null, { timeout: 6000 });
  check('a manually-created task appears', (await page.$$('.row')).length === 3);
  check('it carries the manual badge', (await page.textContent('#root')).includes('Manual'));

  // --- edit (text + category) ---
  const rows = await page.$$('.row');
  const lastRow = rows[rows.length - 1];
  await lastRow.$eval('[data-edit-id]', el => el.click());
  await page.waitForSelector('#edit-text-input', { timeout: 6000 });
  await page.fill('#edit-text-input', 'Comprar pilhas AA');
  await page.selectOption('#edit-cat-select', 'work');
  await page.click('#edit-save');
  await page.waitForFunction(
    () => document.body.textContent.includes('Comprar pilhas AA'), null, { timeout: 6000 });
  check('the edited text is shown', (await page.textContent('#root')).includes('Comprar pilhas AA'));
  check('the edited category is reflected in the meta line',
    (await page.textContent('#root')).includes('Trabalho'));

  // --- delete ---
  const beforeDelete = (await page.$$('.row')).length;
  await page.click('.row:has-text("Ligar para o Igor") [data-del-id]');
  await page.waitForSelector('#confirm-ok', { timeout: 6000 });
  await page.click('#confirm-ok');
  await page.waitForFunction(
    (n) => document.querySelectorAll('.row').length === n, beforeDelete - 1, { timeout: 6000 });
  check('the deleted task is gone', !(await page.textContent('#root')).includes('Ligar para o Igor'));

  // --- done + the collapsible done-tasks section + undo ---
  const remainingRows = await page.$$('.row');
  await remainingRows[0].$eval('input[type=checkbox]', el => el.click());
  await page.waitForSelector('#done-btn:not(:disabled)', { timeout: 6000 });
  await page.click('#done-btn');
  await page.waitForFunction(
    (n) => document.querySelectorAll('.row').length === n, remainingRows.length - 1, { timeout: 6000 });
  check('a completed task drops off the pending list',
    (await page.$$('.row')).length === remainingRows.length - 1);

  await page.click('#toggle-done');
  await page.waitForSelector('.done-card .row', { timeout: 6000 });
  check('the done section shows the completed task',
    (await page.$$('.done-card .row')).length === 1);

  // '.row' alone matches both the pending list AND the (currently expanded)
  // done section — scope to the pending card specifically, or undo (which
  // moves a row from one to the other without changing the total) would
  // never be observed as a change.
  const pendingRows = () => page.$$eval('#root > .card > .row', els => els.length);
  const pendingBeforeUndo = await pendingRows();
  await page.click('.done-card [data-undo-id]');
  await page.waitForFunction(
    (n) => document.querySelectorAll('#root > .card > .row').length > n,
    pendingBeforeUndo, { timeout: 6000 });
  check('undoing brings the task back to the pending list',
    (await pendingRows()) === pendingBeforeUndo + 1);

  await page.screenshot({ path: path.join(SHOTS, 'tarefas.png'), fullPage: true });
  await browser.close();
  server.close();
  if (process.env.KEEP_SHOTS) console.log('screenshots: ' + SHOTS);

  console.log('--- JS errors ---');
  console.log(errors.length ? errors.join('\n') : '(none)');
  console.log('--- failures ---');
  console.log(failures.length ? failures.join('\n') : '(none)');
  process.exit(failures.length || errors.length ? 1 : 0);
})();
