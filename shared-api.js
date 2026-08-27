// shared-api.js — talking to checklist-api, and the passphrase gate in
// front of it. Zero data, zero keys: API is a public endpoint URL, and the
// passphrase itself lives only in the user's own localStorage.
//
// Loaded first among the shared files, since api()/getPass() are used by
// almost everything else. Each page declares its own PAGE_LOGIN object
// BEFORE this script tag — {title, subtitle, onSuccess, beforeShow?} — so
// showLogin()/handleAuthError() can render the right copy and resume the
// right loader without every call site needing to pass that in.

const API = "https://opehbckfmfschpvbhxvo.supabase.co/functions/v1/checklist-api";
const PASS_KEY = "checklist_pass";

function getPass(){ return localStorage.getItem(PASS_KEY) || ""; }

async function api(action, extra){
  const r = await fetch(API, {
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
  root.innerHTML =
    '<div class="login">' +
      '<h2>' + esc(PAGE_LOGIN.title) + '</h2>' +
      '<p>' + esc(PAGE_LOGIN.subtitle) + '</p>' +
      '<div class="loginerr">' + (errText ? esc(errText) : "") + '</div>' +
      '<input type="password" id="pw" autocomplete="current-password" placeholder="Senha" />' +
      '<button class="primary" id="enter">Entrar</button>' +
    '</div>';
  const pw = document.getElementById("pw");
  const go = () => {
    const v = pw.value.trim();
    if(!v) return;
    localStorage.setItem(PASS_KEY, v);
    PAGE_LOGIN.onSuccess();
  };
  document.getElementById("enter").addEventListener("click", go);
  pw.addEventListener("keydown", e => { if(e.key === "Enter") go(); });
  pw.focus();
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
