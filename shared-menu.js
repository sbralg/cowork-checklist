// shared-menu.js — the hamburger navigation, one array for every page.
// Each page still declares its own `const CURRENT_PAGE = "...";` before
// this script tag loads, matching one of MENU_ITEMS' `page` keys, so the
// active entry renders as a plain label instead of a link to itself.
//
// This is the file that used to bite: adding a page meant hand-editing
// this exact array in every other page's copy of it. Now it's one file.

const MENU_ITEMS = [
  { page: "home", href: "index.html", emoji: "🏠", label: "Home" },
  { page: "hoje", href: "hoje.html", emoji: "☀️", label: "Hoje" },
  { page: "tarefas", href: "tarefas.html", emoji: "✓", label: "Tarefas" },
  { page: "compras", href: "compras.html", emoji: "🛒", label: "Compras" },
  { page: "estoque", href: "estoque.html", emoji: "📦", label: "Estoque" },
  { page: "produtos", href: "produtos.html", emoji: "🏷️", label: "Produtos" },
  { page: "clientes", href: "clientes.html", emoji: "👤", label: "Clientes" },
  { page: "eventos", href: "eventos.html", emoji: "🧾", label: "Eventos" },
  { page: "financeiro", href: "financeiro.html", emoji: "💰", label: "Financeiro" },
];

function wireMenuButton(){
  const btn = document.getElementById("menu-btn");
  if(btn) btn.addEventListener("click", openMenu);
}

function openMenu(){
  const itemsHtml = MENU_ITEMS.map(item => {
    if(item.page === CURRENT_PAGE){
      return '<span class="menu-item active">' + item.emoji + ' ' + item.label + '</span>';
    }
    return '<a class="menu-item" href="' + item.href + '">' + item.emoji + ' ' + item.label + '</a>';
  }).join("");

  const backdrop = document.createElement("div");
  backdrop.className = "menu-backdrop";
  backdrop.innerHTML =
    '<div class="menu-panel" id="menu-panel">' +
      itemsHtml +
      '<div class="menu-spacer"></div>' +
      '<button class="menu-item logout" id="menu-logout">🚪 Sair</button>' +
    '</div>';
  document.body.appendChild(backdrop);
  const panel = document.getElementById("menu-panel");
  requestAnimationFrame(() => requestAnimationFrame(() => panel.classList.add("open")));

  const close = () => {
    panel.classList.remove("open");
    document.removeEventListener("keydown", onKey);
    setTimeout(() => backdrop.remove(), 250);
  };
  function onKey(e){ if(e.key === "Escape") close(); }
  document.addEventListener("keydown", onKey);
  backdrop.addEventListener("click", e => { if(e.target === backdrop) close(); });
  document.getElementById("menu-logout").addEventListener("click", () => {
    localStorage.removeItem(PASS_KEY);
    close();
    showLogin();
  });
}
