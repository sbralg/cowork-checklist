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

  // `seedCache` mimics a device that already completed a login before -
  // that's the ONLY way the env radios exist at all (see shared-api.js's
  // ENV_CACHE_KEY comment): the login screen has no way to know an
  // account's real environment list before a token exists, so a brand
  // new device's login screen shows no picker, just "Continuar". `envChoice`
  // omitted means: don't touch the picker at all, just click Continuar.
  async function run(envChoice, environments, { seedCache } = {}) {
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
    if (seedCache) {
      await page.evaluate((cache) => localStorage.setItem('checklist_envs_cache', JSON.stringify(cache)), seedCache);
      await page.reload();
    }
    await page.waitForSelector('.login', { timeout: 6000 });
    if (envChoice !== undefined) {
      await page.click('.login-adv summary'); // reveal the collapsed "Opções avançadas" section (env radios live there now)
      await page.check('input[name="env"][value="' + envChoice + '"]');
    }
    await page.click('#oauth');
    return { ctx, page, seen };
  }

  // --- a device with a cached 2-environment list: explicitly pick the
  // non-default one, and the default radio is labelled (padrão) ----------
  {
    const seedCache = { defaultEnv: 'dev', environments: [{ id: 'dev', label: 'Dev' }, { id: 'prod', label: 'Prod' }] };
    const { ctx, page, seen } = await run('prod', [
      { id: 'dev', label: 'Dev', apiUrl: 'https://maga-dev-test.example/functions/v1/maga-api', passphrase: 'PP-DEV' },
      { id: 'prod', label: 'Prod', apiUrl: PROD_API, passphrase: 'PP-PROD' },
    ], { seedCache });
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
    check('the explicitly-picked (non-default) env apiUrl stored', ls.api === PROD_API);
    check('chosen env passphrase stored', ls.pass === 'PP-PROD');
    check('resolved env id stored', ls.env === 'prod');
    check('radio choice remembered', ls.choice === 'prod');
    check('maga-api hit with the env passphrase', seen.apiPass === 'PP-PROD');
    check('the page rendered a row after OAuth login', await page.$('.row') !== null);
    // The mocked /web-config always answers defaultEnv:"prod" (see run()),
    // while the SEEDED cache above said "dev" - if the cache still read
    // "dev" here it would mean the login flow trusted the stale seed
    // instead of refreshing from this login's own real response.
    check('the env cache was refreshed from the real /web-config response, not left at the stale seeded value',
      await page.evaluate(() => JSON.parse(localStorage.getItem('checklist_envs_cache')).defaultEnv) === 'prod');
    await ctx.close();
  }

  // --- the (padrão) marker renders on the account's actual default, not
  // on whichever radio happens to be checked --------------------------
  {
    const ctx = await browser.newContext({ viewport: { width: 414, height: 860 } });
    const page = await ctx.newPage();
    await page.goto(ORIGIN + '/tarefas.html');
    await page.evaluate((cache) => localStorage.setItem('checklist_envs_cache', JSON.stringify(cache)), {
      defaultEnv: 'dev', environments: [{ id: 'dev', label: 'Dev' }, { id: 'prod', label: 'Prod' }],
    });
    await page.reload();
    await page.waitForSelector('.login', { timeout: 6000 });
    await page.click('.login-adv summary');
    const labels = await page.$$eval('.login-env label', els => els.map(el => el.textContent.replace(/\s+/g, ' ').trim()));
    check('exactly two env options rendered (no more "Padrão" meta-option), got: ' + JSON.stringify(labels), labels.length === 2);
    check('the default env (Dev) is marked (padrão), got: ' + JSON.stringify(labels), labels.some(l => /^Dev.*\(padrão\)$/.test(l)));
    check('the non-default env (Prod) is NOT marked (padrão), got: ' + JSON.stringify(labels), labels.some(l => l === 'Prod'));
    check('the default env radio is pre-checked on load',
      await page.$eval('input[name="env"][value="dev"]', el => el.checked) === true);
    await ctx.close();
  }

  // --- a brand new device (nothing cached yet): no picker at all, just
  // "Continuar" - resolves via the server's own default -------------------
  {
    const { ctx, page } = await run(undefined, [
      { id: 'prod', label: 'Prod', apiUrl: PROD_API, passphrase: 'PP-PROD' },
    ]);
    check('no env fieldset on a device with no login history', await page.$('.login-env') === null);
    await page.waitForSelector('.row', { timeout: 8000 });
    const api = await page.evaluate(() => localStorage.getItem('checklist_api'));
    check('with nothing cached, "Continuar" alone followed the server default to prod', api === PROD_API);
    await ctx.close();
  }

  // --- a stale cache offering "dev", but the account no longer has it ->
  // friendly error on oauth.html, not a silent wrong login -----------------
  {
    const seedCache = { defaultEnv: 'prod', environments: [{ id: 'prod', label: 'Prod' }, { id: 'dev', label: 'Dev' }] };
    const { ctx, page } = await run('dev', [
      { id: 'prod', label: 'Prod', apiUrl: PROD_API, passphrase: 'PP-PROD' },
    ], { seedCache });
    await page.waitForSelector('#oauth-status.err', { timeout: 8000 });
    const msg = await page.textContent('#oauth-status');
    check('no-access env shows an explanatory error, got: ' + msg, /não tem acesso/.test(msg) && /dev/.test(msg));
    const stored = await page.evaluate(() => localStorage.getItem('checklist_pass'));
    check('no passphrase stored on the failed path', !stored);
    await ctx.close();
  }

  // --- "Redefinir sessão salva" clears EVERY cached credential, including
  // the cached environment list - a stale env picker from the previous
  // account must not survive the reset ------------------------------------
  {
    const ctx = await browser.newContext({ viewport: { width: 414, height: 860 } });
    let logoutReturn = null;
    await ctx.route(MCP + '/logout*', async route => {
      const u = new URL(route.request().url());
      logoutReturn = u.searchParams.get('return');
      await route.fulfill({ status: 302, headers: { location: logoutReturn } });
    });
    const page = await ctx.newPage();
    await page.goto(ORIGIN + '/tarefas.html');
    // No checklist_pass here: this reproduces the login screen showing
    // (e.g. right after "Sair") with stale env-related localStorage still
    // left over from a PREVIOUS login on this device - exactly the
    // symptom reported (env picker still showing the old account's
    // choices after "Redefinir sessão salva").
    await page.evaluate(() => {
      localStorage.setItem('checklist_api', 'https://custom.example/functions/v1/maga-api');
      localStorage.setItem('checklist_env_choice', 'dev');
      localStorage.setItem('checklist_env', 'dev');
      localStorage.setItem('checklist_envs_cache', JSON.stringify({
        defaultEnv: 'dev', environments: [{ id: 'dev', label: 'Dev' }, { id: 'prod', label: 'Prod' }],
      }));
    });
    await page.reload();
    await page.waitForSelector('.login', { timeout: 6000 });
    check('the stale env picker (from the PREVIOUS account) is showing before the reset', await page.$('.login-env') !== null);
    await page.click('.login-adv summary');
    await page.click('#reset-mcp-session');
    await page.waitForURL(ORIGIN + '/tarefas.html*', { timeout: 8000 });
    check('MCP /logout was hit with a return URL back to this page', !!logoutReturn && logoutReturn.startsWith(ORIGIN));
    const ls = await page.evaluate(() => ({
      pass: localStorage.getItem('checklist_pass'),
      api: localStorage.getItem('checklist_api'),
      choice: localStorage.getItem('checklist_env_choice'),
      env: localStorage.getItem('checklist_env'),
      cache: localStorage.getItem('checklist_envs_cache'),
    }));
    check('passphrase cleared', ls.pass === null);
    check('API override cleared', ls.api === null);
    check('env choice cleared', ls.choice === null);
    check('resolved env id cleared', ls.env === null);
    check('cached environment list cleared too - no stale picker after a reset', ls.cache === null);
    await page.waitForSelector('.login', { timeout: 6000 });
    check('no env picker left over after the reset', await page.$('.login-env') === null);
    await ctx.close();
  }

  await browser.close();
  server.close();

  if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
  console.log('oauth.test.js: ok');
})();
