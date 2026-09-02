// Headless test for the OAuth (auth-code + PKCE) login path added so the
// site can authenticate against the Magá MCP server instead of a shared
// typed passphrase. The three MCP endpoints (/authorize, /token,
// /web-config) are stubbed - this checks the front-end wiring: PKCE params
// go out, the code comes back through oauth.html, the token is exchanged
// with NO client_secret, /web-config's chosen environment lands in
// localStorage, and the page then talks to that env's maga-api with that
// env's passphrase. Also covers picking an environment the account has no
// access to.
//
//   node test/oauth.test.js
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

function loadPlaywright() {
  for (const id of ['playwright', '/opt/node22/lib/node_modules/playwright']) {
    try { return require(id); } catch (_) { /* next */ }
  }
  console.error('playwright not found — npm i -D playwright, or set NODE_PATH');
  process.exit(2);
}
const { chromium } = loadPlaywright();

const WEB_DIR = path.resolve(__dirname, '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const MCP = 'https://mcp-jump-host.duiker-ghost.ts.net';
const PROD_API = 'https://maga-prod-test.example/functions/v1/maga-api';

function serve() {
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
      const file = path.join(WEB_DIR, rel || 'index.html');
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

(async () => {
  const failures = [];
  const check = (label, cond) => { if (!cond) failures.push('FAIL: ' + label); };
  const server = await serve();
  const ORIGIN = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});

  async function run(envChoice, environments) {
    const ctx = await browser.newContext({ viewport: { width: 414, height: 860 } });
    const seen = { token: null, webConfigAuth: null, apiPass: null };

    await ctx.route(MCP + '/authorize*', async route => {
      const u = new URL(route.request().url());
      const redirect = u.searchParams.get('redirect_uri');
      const state = u.searchParams.get('state');
      check('authorize got a PKCE challenge', !!u.searchParams.get('code_challenge') && u.searchParams.get('code_challenge_method') === 'S256');
      check('authorize client_id is maga-web', u.searchParams.get('client_id') === 'maga-web');
      await route.fulfill({ status: 302, headers: { location: redirect + '?code=TESTCODE&state=' + encodeURIComponent(state) } });
    });

    await ctx.route(MCP + '/token', async route => {
      const body = new URLSearchParams(route.request().postData() || '');
      seen.token = Object.fromEntries(body);
      await route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ access_token: 'AT-123', token_type: 'bearer', expires_in: 3600 }) });
    });

    await ctx.route(MCP + '/web-config', async route => {
      seen.webConfigAuth = route.request().headers()['authorization'];
      await route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ person: 'bia', displayName: 'Bia', defaultEnv: 'prod', environments }) });
    });

    await ctx.route('**/functions/v1/maga-api', async route => {
      seen.apiPass = route.request().headers()['x-checklist-pass'];
      await route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ actions: [{ id: 'A1', text: 'oi', source: 'manual', status: 'pending', due_date: null, important: false, first_seen: '2026-08-01T00:00:00Z' }] }) });
    });

    const page = await ctx.newPage();
    await page.goto(ORIGIN + '/tarefas.html');
    await page.waitForSelector('.login', { timeout: 6000 });
    await page.check('input[name="env"][value="' + envChoice + '"]');
    await page.click('#oauth');
    return { ctx, page, seen };
  }

  // --- happy path: pick "prod", account has prod --------------------------
  {
    const { ctx, page, seen } = await run('prod', [
      { id: 'prod', label: 'Prod', apiUrl: PROD_API, passphrase: 'PP-PROD' },
    ]);
    await page.waitForSelector('.row', { timeout: 8000 });
    const ls = await page.evaluate(() => ({
      api: localStorage.getItem('checklist_api'),
      pass: localStorage.getItem('checklist_pass'),
      env: localStorage.getItem('checklist_env'),
      choice: localStorage.getItem('checklist_env_choice'),
    }));
    check('token exchange sent code_verifier and NO client_secret',
      !!seen.token.code_verifier && seen.token.client_id === 'maga-web' && seen.token.client_secret === undefined && seen.token.grant_type === 'authorization_code');
    check('/web-config called with the bearer token', seen.webConfigAuth === 'Bearer AT-123');
    check('chosen env apiUrl stored', ls.api === PROD_API);
    check('chosen env passphrase stored', ls.pass === 'PP-PROD');
    check('resolved env id stored', ls.env === 'prod');
    check('radio choice remembered', ls.choice === 'prod');
    check('maga-api hit with the env passphrase', seen.apiPass === 'PP-PROD');
    check('the page rendered a row after OAuth login', await page.$('.row') !== null);
    await ctx.close();
  }

  // --- "padrao" resolves to defaultEnv ("prod") --------------------------
  {
    const { ctx, page } = await run('padrao', [
      { id: 'prod', label: 'Prod', apiUrl: PROD_API, passphrase: 'PP-PROD' },
    ]);
    await page.waitForSelector('.row', { timeout: 8000 });
    const api = await page.evaluate(() => localStorage.getItem('checklist_api'));
    check('padrao followed defaultEnv to prod', api === PROD_API);
    await ctx.close();
  }

  // --- pick an env the account doesn't have -> friendly error on oauth.html
  {
    const { ctx, page } = await run('dev', [
      { id: 'prod', label: 'Prod', apiUrl: PROD_API, passphrase: 'PP-PROD' },
    ]);
    await page.waitForSelector('#oauth-status.err', { timeout: 8000 });
    const msg = await page.textContent('#oauth-status');
    check('no-access env shows an explanatory error, got: ' + msg, /não tem acesso/.test(msg) && /dev/.test(msg));
    const stored = await page.evaluate(() => localStorage.getItem('checklist_pass'));
    check('no passphrase stored on the failed path', !stored);
    await ctx.close();
  }

  await browser.close();
  server.close();

  if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
  console.log('oauth.test.js: ok');
})();
