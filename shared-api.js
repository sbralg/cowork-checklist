// shared-api.js — talking to maga-api, and the passphrase gate in
// front of it. Zero data, zero keys: API is a public endpoint URL, and the
// passphrase itself lives only in the user's own localStorage.
//
// Loaded first among the shared files, since api()/getPass() are used by
// almost everything else. Each page declares its own PAGE_LOGIN object
// BEFORE this script tag — {title, subtitle, onSuccess, beforeShow?} — so
// showLogin()/handleAuthError() can render the right copy and resume the
// right loader without every call site needing to pass that in.

// The maga-api endpoint. A public URL (no secret), but it selects WHICH
// dataset you reach - e.g. a per-person prod project - so it is overridable
// per browser in localStorage, next to the passphrase. Unset = the default.
const DEFAULT_API = "https://opehbckfmfschpvbhxvo.supabase.co/functions/v1/maga-api";
const API_KEY = "checklist_api";
function getApi(){ return localStorage.getItem(API_KEY) || DEFAULT_API; }
const PASS_KEY = "checklist_pass";
const ENV_CHOICE_KEY = "checklist_env_choice"; // which radio ("padrao"|"dev"|"prod")
const ENV_ID_KEY = "checklist_env";            // resolved env id, informational

// OAuth against the Magá MCP server: the front end runs the auth-code +
// PKCE flow, then GET /web-config hands back {apiUrl, passphrase} for the
// signed-in person + chosen environment. No secret lives here (public
// PKCE-only client). See the maga-web client in the mcp-server people.json.
const MCP_BASE = "https://mcp-jump-host.duiker-ghost.ts.net";
const OAUTH_CLIENT_ID = "maga-web";
const OAUTH_REDIRECT = new URL("oauth.html", location.href).href;

function b64url(bytes){
  let s = "";
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function randToken(n){ const a = new Uint8Array(n); crypto.getRandomValues(a); return b64url(a); }
async function pkceChallenge(verifier){
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return b64url(d);
}

function getPass(){ return localStorage.getItem(PASS_KEY) || ""; }

async function api(action, extra){
  const r = await fetch(getApi(), {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-checklist-pass": getPass() },
    body: JSON.stringify(Object.assign({ action }, extra || {}))
  });
  if(r.status === 401){ const e = new Error("unauthorized"); e.unauthorized = true; throw e; }
  if(!r.ok){
    // 400 means the API rejected the input itself (an unreadable
    // peso/volume, say), which deserves a different message from a
    // connection failure.
    const e = new Error("http " + r.status);
    e.badRequest = r.status === 400;
    // Several refusals carry STRUCTURED detail, not just a message —
    // ingredient_delete reports how many receita/embalagem lines still
    // reference it, receita_delete which recipes and produtos use it. That
    // detail was being thrown away here, so every page could only say
    // "não foi possível". Parsed best-effort: a body that isn't JSON (a
    // proxy error page, say) must not turn a clean 400 into a thrown
    // SyntaxError, so `e.body` is simply absent then.
    try{ e.body = await r.json(); }catch(_){ /* no structured detail */ }
    throw e;
  }
  return await r.json();
}

// PAGE_LOGIN is declared per-page before this script loads:
//   const PAGE_LOGIN = {
//     title: "...", subtitle: "...",
//     onSuccess: () => someLoader(),   // called after a passphrase is entered
//     beforeShow: () => { ... }        // optional, e.g. hiding a sticky bar
//   };
function showLogin(errText){
  if(PAGE_LOGIN.beforeShow) PAGE_LOGIN.beforeShow();
  const choice = localStorage.getItem(ENV_CHOICE_KEY) || "padrao";
  const apiOverride = getApi() === DEFAULT_API ? "" : getApi();
  const radio = (val, label) =>
    '<label><input type="radio" name="env" value="' + val + '"' + (choice === val ? " checked" : "") + '> ' + label + '</label>';
  root.innerHTML =
    '<div class="login">' +
      '<h2>' + esc(PAGE_LOGIN.title) + '</h2>' +
      '<p>' + esc(PAGE_LOGIN.subtitle) + '</p>' +
      '<div class="loginerr">' + (errText ? esc(errText) : "") + '</div>' +
      '<fieldset class="login-env"><legend>Ambiente</legend>' +
        radio("padrao", "Padrão") + radio("dev", "Dev") + radio("prod", "Prod") +
      '</fieldset>' +
      '<button class="primary" id="oauth">Entrar com Magá</button>' +
      '<details class="login-adv"' + (apiOverride ? " open" : "") + '>' +
        '<summary>Entrar com senha</summary>' +
        '<input type="password" id="pw" autocomplete="current-password" placeholder="Senha" />' +
        '<input type="text" id="api" autocomplete="off" spellcheck="false" ' +
          'placeholder="Endpoint da API (em branco = padrão)" value="' + esc(apiOverride) + '" />' +
        '<button id="enter">Entrar</button>' +
      '</details>' +
    '</div>';
  const pickedEnv = () => (root.querySelector('input[name="env"]:checked') || {}).value || "padrao";
  document.getElementById("oauth").addEventListener("click", () => {
    localStorage.setItem(ENV_CHOICE_KEY, pickedEnv());
    startOAuth(pickedEnv());
  });
  const pw = document.getElementById("pw");
  const go = () => {
    const v = pw.value.trim();
    if(!v) return;
    const a = document.getElementById("api").value.trim();
    if(a && !/^https?:\/\/\S+$/.test(a)){
      root.querySelector(".loginerr").textContent = "Endpoint inválido.";
      return;
    }
    if(a && a !== DEFAULT_API) localStorage.setItem(API_KEY, a);
    else localStorage.removeItem(API_KEY);
    localStorage.setItem(PASS_KEY, v);
    localStorage.setItem(ENV_CHOICE_KEY, pickedEnv());
    PAGE_LOGIN.onSuccess();
  };
  document.getElementById("enter").addEventListener("click", go);
  pw.addEventListener("keydown", e => { if(e.key === "Enter") go(); });
}

// Standard "something went wrong" split: an expired/wrong passphrase goes
// back to the login screen; anything else gets a retry link. `retry` is a
// zero-arg function (its .toString() is inlined into an onclick handler, so
// it must not close over anything the string form would lose).
function handleAuthError(e, retry){
  if(e.unauthorized){
    localStorage.removeItem(PASS_KEY);
    showLogin("Sessão expirada, entre novamente.");
  }else{
    root.innerHTML = '<p class="msg err">Não foi possível carregar agora.</p>' +
      '<p class="msg"><button class="link" onclick="(' + retry.toString() + ')()">Tentar novamente</button></p>';
  }
}

// --- OAuth (auth-code + PKCE) against the Magá MCP server -----------------
// startOAuth kicks off the redirect; completeOAuth (run from oauth.html on
// the way back) trades the code for a token, calls /web-config, resolves
// the chosen environment to {apiUrl, passphrase}, stows both in
// localStorage exactly as the manual path does, and returns to the page
// the user started from.
async function startOAuth(envChoice){
  const verifier = randToken(48);
  const state = randToken(16);
  sessionStorage.setItem("maga_oauth", JSON.stringify({
    verifier, state, envChoice, returnTo: location.href
  }));
  const p = new URLSearchParams({
    response_type: "code",
    client_id: OAUTH_CLIENT_ID,
    redirect_uri: OAUTH_REDIRECT,
    code_challenge: await pkceChallenge(verifier),
    code_challenge_method: "S256",
    scope: "mcp:read",
    state
  });
  location.assign(MCP_BASE + "/authorize?" + p.toString());
}

async function completeOAuth(){
  const say = (msg, isErr) => {
    const el = document.getElementById("oauth-status");
    if(el){ el.textContent = msg; el.className = isErr ? "err" : ""; }
  };
  const back = () => {
    const el = document.getElementById("oauth-status");
    if(el) el.insertAdjacentHTML("afterend", ' <a href="index.html">voltar</a>');
  };
  const q = new URLSearchParams(location.search);
  let st = {};
  try { st = JSON.parse(sessionStorage.getItem("maga_oauth") || "{}"); } catch(_){}
  sessionStorage.removeItem("maga_oauth");
  if(q.get("error")){ say("Falha na autenticação: " + q.get("error"), true); back(); return; }
  const code = q.get("code");
  if(!code || !st.state || q.get("state") !== st.state){ say("Resposta de login inválida.", true); back(); return; }
  try {
    const tr = await fetch(MCP_BASE + "/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        code_verifier: st.verifier,
        redirect_uri: OAUTH_REDIRECT,
        client_id: OAUTH_CLIENT_ID
      })
    });
    if(!tr.ok) throw new Error("token " + tr.status);
    const { access_token } = await tr.json();
    const cr = await fetch(MCP_BASE + "/web-config", { headers: { Authorization: "Bearer " + access_token } });
    if(!cr.ok) throw new Error("web-config " + cr.status);
    const cfg = await cr.json();
    const wanted = st.envChoice === "padrao" ? cfg.defaultEnv : st.envChoice;
    const env = (cfg.environments || []).find(e => e.id === wanted);
    if(!env){
      say("Sua conta não tem acesso ao ambiente \"" + wanted + "\".", true); back(); return;
    }
    localStorage.setItem(API_KEY, env.apiUrl);
    localStorage.setItem(PASS_KEY, env.passphrase);
    localStorage.setItem(ENV_ID_KEY, env.id);
    location.replace(st.returnTo || "index.html");
  } catch(e){
    say("Não foi possível concluir o login (" + e.message + ").", true); back();
  }
}
