# CLAUDE.md — cowork-checklist

Context file for Claude Code / Claude sessions working on this repo.

## Status (2026-08-24): Receitas + Produtos + Fornecedores modules shipped — the (Shopping List >) Insumos → Receita → Produto reshape is now complete end to end

Full plan and reasoning in `sbralg/cowork-personal-daily-summary`'s
`ROADMAP.md` and `CLAUDE.md` (the "Receita + Produto + Fornecedor" Status
entry has the full ported pricing formula) — this entry is the short,
front-end-focused version.

- **Three new pages: `receitas.html`, `produtos.html`, `fornecedores.html`**
  (the modules the 2026-08-24 Insumos rename was staged for), plus
  extensions to three existing pages. The whole pricing model was ported
  from the household's real spreadsheet (`Precificação Produtos Magá.xlsm`)
  rather than invented — see the backend repo's CLAUDE.md for the traced
  formula and the design decisions the user made across two review rounds.
  - **`receitas.html`**: list + a builder view. Adding an ingredient line
    opens a picker offering "🧂 Ingrediente" (filtered to insumos-catalogue
    ingredients, never packaging) or "📖 Receita" (a recipe can consume
    another recipe — e.g. a syrup inside a cake — with server-side cycle
    rejection), then a quantity step. The cost breakdown (batch cost →
    with safety margin → per prep-labor → cost per yield unit) is shown
    read-only, computed server-side every read — never cached. An
    ingredient that's never actually been stocked shows up BY NAME in an
    incomplete-cost warning rather than silently pricing as free.
    **"Rendimento Desejado" (batch scaling) is a real, live feature, not a
    stub** — an ephemeral input (never saved) that shows every line's
    quantity scaled to a bigger batch, recursing through nested sub-
    recipes, computed instantly client-side. Turning that into an actual
    shopping-list addition is deliberately deferred (see backend repo's
    Planned/future).
  - **`produtos.html`**: kind switch (manufaturado → a Receita picker;
    comprado → an Ingredient picker — a fornecedor-sourced item resold
    as-is costs itself the SAME way a recipe line does, no separate
    supplier-cost field) with embalagem lines filtered to `kind='embalagem'`
    ingredients, three margin tiers (atacado/distribuidor/varejo), the full
    computed pricing breakdown, and a reverse "if I want to sell at retail
    R$X" calculator that's pure client-side arithmetic on the margins
    already loaded — no round trip for that part.
  - **`fornecedores.html`**: name/phone/email/notes (phone doubles as the
    WhatsApp number, exact same `waPhoneDigits()`/`wa.me` pattern as
    `clientes.html`), and a purchase-history list read through
    `fornecedor_detail` — every inbound `stock_movements` row tagged with
    this fornecedor, joined to the insumo for its name. No separate
    history table; the tagging happens optionally when booking a stock
    movement (see `estoque.html` below).
  - **`eventos.html`**: `itemModal` gained an optional "🔗 Vincular
    Produto" picker. Picking one prefills description/cost/price from the
    produto's current `preço_atacado` — still fully manually editable
    before saving, per the user's explicit instruction that a sale typed
    in a hurry with no time to search a catalogue must keep working
    exactly as it did before.
  - **`insumos.html`**: a kind filter (chip row: Todos/🧂 Ingredientes/
    📦 Embalagens) + badge on every row, and kind + category editing added
    to the metadata editor (a lazily-created-category `<select>` — "+ Nova
    categoria…" creates one inline via `insumo_category_create`).
    Categories are purely organizational (browsing), separate from the
    load-bearing `kind` flag the recipe pickers filter on.
  - **`estoque.html`**: the shortfall-recovery dialog (booking an
    `unaccounted_purchase` when a consumption would cross zero — the one
    place that already asks for a price) gained an optional Fornecedor
    picker. **Deliberately NOT added to the fast one-tap `+` gesture** —
    that stepper stays dialog-free on purpose; see the 2026-08-09/08-12
    entries below on why its speed is load-bearing UX, not an oversight.
  - **`shared-menu.js`**: three new entries, plus two emoji swaps per
    direct user feedback — 🏷️ (price tag) moved from Insumos to Produtos
    since that's literally what it is; Insumos got 🥖; Eventos got 🥂
    (was 🧾, which the user didn't like).
  - **A real bug caught during review, before any test ran**:
    `receitas.html`'s batch-scaling redraw replaced `#itens-card`'s
    `outerHTML` with bare unwrapped rows on first use, which silently
    broke every *following* keystroke (the id was gone, so the redraw
    function found nothing to update). Fixed to patch `innerHTML` instead.
  - **`test/receitas.test.js`, `test/produtos.test.js`,
    `test/fornecedores.test.js` were written** following the established
    fake-backing-store-with-real-relational-math convention — the fakes
    reimplement the actual cost formulas line-for-line (nested-recipe
    recursion and the incomplete-cost cases included), not canned fixtures
    — **but could not be run in this sandbox (no Node 20+/Playwright)**.
    Run these three, plus `insumos.test.js`/`stock.test.js`/
    `eventos.test.js` as a regression check, before trusting this shipped
    cleanly.
  - **Not live-verified against the deployed function** — see the backend
    repo's CLAUDE.md for a same-session Edge Function deploy incident
    (self-inflicted, resolved by the user) that used the verification
    window this would otherwise have had.

- **Module renamed: Vendas → Eventos (2026-08-24).** `vendas.html`→
  `eventos.html` (plain `git mv`, no redirect stub — same convention as
  the earlier `index.html`/`shopping.html` renames below), `test/
  vendas.test.js`→`test/eventos.test.js`, the `MENU_ITEMS` entry, the
  dashboard tile, and every cross-link/label on `clientes.html`/
  `financeiro.html` updated to match. The underlying `checklist-api`
  actions/tables were renamed too (`venda_*`→`evento_*`) — see the backend
  repo's `CLAUDE.md` for the full DB migration. **The live Edge Function
  had not been redeployed as of this rename** (the user redeploys it
  themselves, on purpose — see that repo's gotcha #20), so until that
  happens `eventos.html`'s API calls will 500. A mechanical find/replace
  also breaks Portuguese gender agreement (`venda` is feminine, `evento`
  is masculine) — swept for and fixed every "Nenhuma evento", "Nova
  evento", "-la" pronoun, etc. that the substitution introduced, rather
  than shipping it broken.

- **The refactor** replaced "duplicate everything verbatim across pages"
  with the `shared-*.js`/`shared-*.css` files described under "Shared
  files" below, renamed `index.html`→`tarefas.html` and
  `shopping.html`→`compras.html`, and added a new `index.html` as a
  module-tile dashboard. No redirect stubs at the old names — a deliberate
  choice, not an oversight.
  - **Disclosed behavior changes riding on the refactor, not hidden inside
    "just moved the code":** `tarefas.html` and `hoje.html` gained the
    richer `api()` (400-vs-other error classification) and the shared
    `handleAuthError()` re-login flow they didn't have before; and the
    date+time rendering used by `tarefas.html` ("desde…") and `hoje.html`
    ("gerado em…"/"concluída em…") changed from a space-separated format
    to the comma-separated one `insumos.html` already used
    (`fmtDateTime()` in `shared-format.js`), since two pages could not both
    keep their old `fmtDate` behavior once merged under one name.
  - `tarefas.html`/`hoje.html` had zero automated coverage before this —
    a real risk given they picked up real behavior changes — so
    `test/tarefas.test.js` and `test/hoje.test.js` were added alongside
    the refactor, not after.
- **Eventos + Financeiro** are new modules for the household's side
  business: `eventos.html` tracks one evento (sale/event/order) per row through a
  Lead→Orçamento→Confirmado→Entregue→Cancelado pipeline, with `clientes`,
  line items (produto/serviço), and an editable payment ledger.
  `financeiro.html` is the cost/revenue ledger that Eventos auto-posts
  confirmed payments into. Full schema + Edge Function action list are in
  the backend repo's `CLAUDE.md`; see "What this is" below for what each
  page covers.
- Deployed `checklist-api` v26 and **live-verified** the whole Eventos/
  Financeiro action set against the real project via the `http`-extension
  trick (see the backend repo's `CLAUDE.md` for the full sequence) before
  building either page against it.
- **`clientes.html` (2026-08-24)** is the ninth page: the contact record
  behind an evento — full-field create/edit/delete (not just the by-name-
  only inline picker `eventos.html` already had), the eventos + pagamentos
  rollup for that cliente read through the new `cliente_detail` action
  (`checklist-api` now v27, live-verified the same way as v26) and a
  "Enviar WhatsApp" composer that builds a `wa.me` deep link client-side —
  no backend, because this household's WhatsApp bridge is LAN-only and
  unreachable from the Edge Function (see the backend repo's `CLAUDE.md`
  for why). `eventos.html`'s cliente block gained a "Ver cliente" link into
  it. **Message/e-mail history per contact is deliberately not built** —
  the page says so under the composer rather than leaving a silent gap;
  see the backend repo's Planned/future for what a real one would need.
  `test/clientes.test.js` covers create/edit/delete, the totals rollup,
  the wa.me phone normalization (a Brazilian 10/11-digit number gets `55`
  prepended, an already-prefixed number is left alone), and the deep link.

- **Module renamed: Produtos → Insumos (2026-08-24), the first step of a
  bigger reshape: (Shopping List >) Insumos → Receita → Produto.** The
  barcode catalogue that used to be called "produtos" is being repurposed
  as raw materials/supplies bought and tracked in the pantry — "Produto"
  will become a NEW concept (a manufactured-via-recipe or supplier-bought
  item that gets sold, costed automatically either by its recipe or by its
  supplier cost), so the old name had to stop meaning two different things.
  This session only did the rename; Receita and the new Produto/Fornecedor
  modules are not built yet — see the backend repo's Planned/future.
  - `produtos.html`→`insumos.html` (plain `git mv`, no redirect stub, same
    convention as every other page rename here), the `MENU_ITEMS` entry, the
    dashboard tile, and every cross-link/label on `estoque.html`/
    `compras.html`/`shared-catalog.js`/`shared-catalog.css` updated to
    match — including internal identifiers (`productMeta`→`insumoMeta`,
    `openProduct`→`openInsumo`, `renderProduct`→`renderInsumo`,
    `productEditModal`→`insumoEditModal`, `.prod-head`/`.prod-title`→
    `.ins-head`/`.ins-title`, `#edit-product`/`#del-product`→
    `#edit-insumo`/`#del-insumo`), not just the Portuguese UI labels.
  - The underlying `checklist-api` actions/tables were renamed too
    (`product_*`→`insumo_*` action names, `products`→`insumos` table,
    `product_prices`→`insumo_prices` table) — see the backend repo's
    `CLAUDE.md` for the full DB migration, applied live the same session.
    **The live Edge Function had not been redeployed as of this rename**
    (the user redeploys it themselves, on purpose — see that repo's
    gotcha #20), so until that happens `insumos.html`'s and `estoque.html`'s
    API calls will 500.
  - `ingredients`/`ingredientModal()` and the `.ing-*` naming are
    deliberately UNCHANGED — "ingredient" is a different concept (what a
    barcode IS, for a future recipe) from "insumo" (the raw-material
    catalogue itself), and this rename didn't touch it.
  - `eventos.html`'s `evento_itens.tipo` value `"produto"` (🎂 Produto, a
    sale line-item type) is DELIBERATELY untouched by this rename — it
    already means the NEW "Produto" concept this reshape is heading toward
    (a sold item), not the old barcode catalogue, so renaming it would have
    been backwards.
  - `test/stock.test.js` and `test/compras.test.js` updated to match
    (`PRODUCTS`→`INSUMOS`, `KNOWN_PRODUCTS`→`KNOWN_INSUMOS`, the renamed
    action names and response fields, `.prod-head`/`.prod-title`→
    `.ins-head`/`.ins-title`, `#edit-product`/`#del-product`→
    `#edit-insumo`/`#del-insumo`). **Not run from this session** (no
    `node`/Playwright in this sandbox) — run both once after the Edge
    Function is redeployed.

## What this is

The public GitHub Pages front end deployed from this repo's `main` branch,
served at https://sbralg.github.io/cowork-checklist/. Twelve pages sharing a
set of `shared-*.js`/`shared-*.css` files (see "Shared files" below), no
build step, no framework:

- `index.html` — the **dashboard**: module tiles, no live data. The
  landing page since the 2026-08-20 refactor (see the dated entry below);
  it used to be the daily-task checklist, which moved to `tarefas.html`.
- `tarefas.html` — the daily-task checklist (pending actions, done-tasks
  history with undo, manual task creation, edit/delete). Renamed from
  `index.html` when the dashboard took over that filename.
- `compras.html` — the shopping-list manager (multiple named lists,
  per-item price + quantity, purchased toggle, running totals, barcode
  scanning against the product catalogue). Renamed from `shopping.html`.
- `hoje.html` — "Hoje": the morning summary rendered for the browser,
  read from `public.daily_reports`.
- `estoque.html` — the pantry: how many packages of each insumo are in
  the cupboard, and changing that (− / + steppers, exact recount).
- `insumos.html` — the insumo catalogue: what a barcode means, its price
  history as a graph, the editor that corrects its metadata, and removal
  from the catalogue.
- `clientes.html` — the contact record behind an evento: full-field create/
  edit/delete, the eventos + pagamentos rollup for that cliente, and a
  `wa.me`-based "Enviar WhatsApp" composer.
- `eventos.html` — the evento pipeline: a `clientes` picker (with a
  "Ver cliente" link into the full record on `clientes.html`), the full
  Lead→Orçamento→Confirmado→Entregue→Cancelado status, line items
  (produto/serviço) with cost and price, and an editable payment ledger.
  Confirming a payment auto-posts a receita to Financeiro in the same
  request — the one integration point between the two modules.
- `financeiro.html` — the cost/revenue ledger: every receita and despesa,
  most arriving automatically from Eventos, some logged directly (rent,
  ingredients, marketing) for spending that never passed through an evento.
- `receitas.html` — a Receita formula: yield, safety margin, prep labor,
  ingredient/sub-recipe lines (a recipe can consume another recipe) with
  quantities, the computed cost breakdown, and an ephemeral batch-scaling
  input ("Rendimento Desejado" — never saved, just shows scaled quantities).
- `produtos.html` — a sellable Produto: manufaturado (via a Receita picker)
  or comprado (via an Ingredient picker — a fornecedor-sourced item resold
  as-is, costed the same way a recipe line is), embalagem lines, three
  margin tiers, the full cost→atacado→distribuidor→varejo pricing
  breakdown, and the reverse "sell at this retail price" calculator.
- `fornecedores.html` — who the household buys from: name/phone/email/
  notes, a `wa.me` WhatsApp composer, and the purchase history read
  through `fornecedor_detail` (every inbound stock movement tagged with
  this fornecedor, joined to the insumo — no separate history table).

**Renamed with no redirect stubs, on purpose (2026-08-20).** A stale
bookmark to the old `shopping.html` now 404s, and one to the old
`index.html` now silently shows the dashboard instead of the task list —
both a one-time surprise, chosen over maintaining a redirect forever.

**The ingredient is what an insumo IS, as opposed to which SKU it is** —
three brands of leite condensado are three barcodes and ONE ingredient, and
that link is what will let a recipe ask "tenho leite condensado?" across
brands. It is set BY HAND, from the detail sheet on `insumos.html` or the
chip on each `estoque.html` row, and that is a finding rather than laziness:
Open Food Facts' categories were measured against this catalogue and group
by supermarket shelf (creme de leite, leite em pó and leite condensado all
land under "milk and yogurt"), 8 of 19 insumos have no category at all, and
the two cremes de leite that genuinely ARE one ingredient get different
answers. A wrong link is worse than a blank one, because a recipe would
silently draw down the wrong insumo. The picker instead suggests from the
household's own catalogue — an existing ingredient whose words appear in the
insumo's name is floated up with a `provável` badge. Full reasoning in the
other repo's `CLAUDE.md`.

**The rule that shapes `estoque.html`, and must not be quietly undone:
stock never goes below zero.** Using something that isn't recorded doesn't
mean the pantry owes you one — it means a purchase was never written down,
and that purchase cost money a future finance module will want. So a
consumption that would cross zero is refused by the API (a 200 carrying
`ok:false` plus the shortfall and the last price, because it is an ordinary
outcome and not a transport error), and the page offers to book the
difference as a retroactive `unaccounted_purchase` before completing the
consumption. This was the user's call over both alternatives on the table;
the reasoning is in the other repo's `CLAUDE.md`.

All eight are data-free shells: no Supabase keys, no data baked in. Each
asks for a shared passphrase (stored in `localStorage`, prompted once per
device) and talks only to one Supabase Edge Function, `checklist-api`
(deployed in project `opehbckfmfschpvbhxvo`), which holds the
service-role key and checks the passphrase server-side. See
`sbralg/cowork-personal-daily-summary`'s `CLAUDE.md` for the Edge
Function's source, the Supabase schema, the scheduled task that
populates `tarefas.html`/`hoje.html`'s data every morning, and this whole project's
full change history — that repo is the source of truth for the backend,
this one for the front end.

## Master-copy relationship

**Every page lives ONLY here — there are no mirrors anywhere.** All eight
pages, the shared files, and all six tests have exactly one copy, in this
repo. Edit them directly; there is nothing to sync and no master copy to
update first.

This is a deliberate reversal, not an accident of history. The pages
used to be mastered in `sbralg/cowork-personal-daily-summary` under
`web/` and copied here, and that arrangement failed exactly the way
duplication does: `shopping.html` was mirrored there on 2026-08-01, this
file went stale about it, and a change made by following the stale note
was one sync away from being silently overwritten. Mirroring traded a
stale-copy risk for a forgot-to-sync risk and collected on it within ten
days. **Do not recreate a mirror in the other repo** — that repo is the
backend (Edge Function, scheduled task, `release/`); this one is the
front end; no file exists in both.

What still lives in `sbralg/cowork-personal-daily-summary`, and is worth
reading before changing anything here: the `checklist-api` Edge Function
source, the Supabase schema, the scheduled task, and the project's full
dated change history in its `CLAUDE.md`.

### Shared files (2026-08-20)

Logic and CSS more than one page needs now lives in `shared-*.js`/
`shared-*.css` files, loaded via plain `<script src>`/`<link>` tags — no
bundler, no build step, still fully data-free. This replaced the old
"duplicate everything verbatim" convention (see Conventions below for
what that changes and what stays the same).

- `shared-api.js` — `API`, `PASS_KEY`, `getPass()`, `api()`, `showLogin()`,
  `handleAuthError()`. Every page declares `const PAGE_LOGIN = {title,
  subtitle, onSuccess, beforeShow?}` *before* this script tag loads, so
  `showLogin()` can render the right copy without every call site passing
  it in.
- `shared-menu.js` — `MENU_ITEMS` (now 9 entries) + the hamburger drawer.
  **This is the file that used to bite**: adding a page used to mean
  hand-editing this array in every other page's copy of it; now it's one
  edit.
- `shared-ui.js` — `esc()`, `confirmModal()`, `promptModal()`,
  `listToast()`/`hideListToast()`.
- `shared-format.js` — `fmtMoney()`, `fmtStockQty()` (0-aware — the
  pantry/catalogue variant), `fmtNetQty()`, `fmtDate()`, `fmtDateTime()`,
  `tidyShouted()`.
- `shared-inputs.js` — the cents-first price field and digits-only
  quantity field (`wirePriceInput()`/`wireQtyInput()` and their helpers),
  `.fields-row` layout, and the package-size unit helpers
  (`PACK_UNITS`/`unitOptions()`/`netQtyToFields()`/`fieldsToNetQty()`).
- `shared-catalog.js`/`shared-catalog.css` — insumos/estoque-only:
  `thumbHtml()`, the ingredient-name matching helpers, and
  `ingredientModal()`. **Not loaded by eventos.html** — a cliente is a
  different entity with different fields, so its picker is its own small
  page-local implementation (`clientePickerModal` in `eventos.html`) rather
  than a forced generalization of the ingredient one.
- Matching CSS files (`shared-base.css`, `shared-menu.css`,
  `shared-modal.css`, `shared-toast.css`, `shared-inputs.css`) for the
  palette/reset, the menu, the modal shell, the toast, and the compact
  field+prefix control.

**What stays page-local, deliberately**: the `.wrap`/`.page` layout (real
per-page differences), each page's own row rendering and search-matching
(different data shapes), and — unchanged since before this refactor — the
barcode scanner, which lives only in `compras.html`.

Seven headless Chromium tests, each next to the pages it guards. All serve
the repo root on an ephemeral port and answer `checklist-api` from an
in-memory fake, so none touches Supabase nor holds a passphrase.
**There is no CI — run them by hand before pushing.**

- `test/compras.test.js` (renamed from `shopping.test.js`) — the scanner,
  the barcode validation, the scan confirm dialog (including its layout)
  and the add/edit/merge paths. Run it after changing `compras.html`.
- `test/stock.test.js` — the pantry steppers, the zero floor and its
  retroactive-purchase dialog, the recount, the per-insumo queue that
  keeps a double tap from outrunning the floor, search, the price graph,
  the insumo editor, the ingredient picker on both pages, the two-step
  insumo removal and the deep links between the two pages. Run it
  after changing `estoque.html` or `insumos.html`. Its fake keeps a
  **real ledger** and enforces the zero floor the same way the Edge
  Function does — that rule is the whole reason those pages look the way
  they do, so faking it away would leave the interesting half untested.
- `test/tarefas.test.js` / `test/hoje.test.js` — smoke tests added
  alongside the shared-files refactor, since both pages had zero coverage
  before it and the refactor changed real behavior on both (see the dated
  entry below). Cover the passphrase gate, the menu, and each page's core
  flow (create/edit/delete/done/undo for tarefas; day navigation and the
  live action-status overlay for hoje).
- `test/eventos.test.js` — the cliente picker (find-or-create inline), the
  full pipeline walk, line items, the payment ledger and its totals,
  editing/deleting a payment with the linked Financeiro lançamento
  following or surviving correctly, the refusal-then-force evento delete,
  the deep link, and a cliente delete that unlinks without breaking the
  detail sheet. Its fake keeps real relational state across all five
  tables, same reasoning as `stock.test.js`'s ledger.
- `test/financeiro.test.js` — standalone lançamento create/edit/delete,
  the tipo and período filters, and a seeded auto-posted entry's
  "automático" tag and 🔗 deep link back to its evento.
- `test/clientes.test.js` — full-field create/edit/delete (including the
  "N evento(s) unlinked" delete toast), search across name/organização/
  telefone/e-mail, the eventos + pagamentos rollup and its summed totals
  read through `cliente_detail`, the wa.me phone normalization and its
  href, and the deep link. Its fake keeps clientes/eventos/pagamentos as
  real relational state, same reasoning as `eventos.test.js`.

## Conventions

- **No build step.** Each `.html` file is a single, complete, static
  page — HTML/CSS/JS all inline in one file. Deploy is `git push` to
  `main`; GitHub Pages serves it directly, no CI.
- **Commit straight to `main` — no feature branches, no pull requests
  in THIS repo (decided 2026-08-12).** `main` is what Pages serves, so
  a change parked on a branch cannot be looked at on a phone; the only
  way to review a UI change here is to have it deployed. Routing that
  through a PR meant the user had to merge before seeing it and then do
  branch surgery whenever it needed another pass. Push the work, let
  them look at the live page, iterate with another commit.
  - Run all seven test files BEFORE pushing, every time (`node
    test/compras.test.js`, `test/stock.test.js`, `test/tarefas.test.js`,
    `test/hoje.test.js`, `test/eventos.test.js`, `test/financeiro.test.js`,
    `test/clientes.test.js`).
    They are the only gate left between a broken page and the live site.
    Any change to a `shared-*.js`/`shared-*.css` file can touch every
    page that loads it, so run the FULL suite (not just the one page you
    edited) whenever a shared file changes.
  - `sbralg/cowork-personal-daily-summary` is the opposite — it keeps
    PRs. Nothing there is served straight from `main` to a browser, and
    its `CLAUDE.md` is the project's history, which reads better as
    reviewed changes.
- **Shared code lives in `shared-*.js`/`shared-*.css` files (see above),
  loaded via plain `<script src>`/`<link>` tags — not duplicated verbatim
  the way it was before 2026-08-20.** A function/CSS rule with 2+
  consumers and truly identical behavior belongs in a shared file; a
  function that looks similar but has a real behavioral difference (e.g.
  a floor-to-1 quantity formatter vs. a 0-aware one) stays two separately-
  named functions rather than being merged into one with a hidden
  branch — see the shared-format.js file comment for the worked example.
  A single-consumer helper that merely resembles a shared one (estoque's
  `parseCountInput`, a recount-can-be-zero variant of `parseQtyInput`)
  stays page-local; looking similar is not the same as being the same
  thing.
  - `MENU_ITEMS` lives in `shared-menu.js` now — adding a page means
    adding **one** entry, not hand-editing eight copies of the array.
  - What is still deliberately NOT shared: the barcode scanner. It lives
    only in `compras.html` — ~300 lines of camera, lens-picking and focus
    code that would be a genuine maintenance trap in a second copy.
    Estoque finds a product by search instead. Also not shared:
    `eventos.html`'s cliente picker, on purpose (see "Shared files" above).
- **Every mutating action should update the DOM in place and fire its
  API call in the background**, only reverting the change (or, for
  destructive actions, re-inserting the same detached DOM node) and
  showing an alert on failure. A full-page reload
  (`root.innerHTML = 'Carregando…'` + refetch) should be the exception,
  not the default — still used for full-screen transitions (loading a
  page, session expiry) but not for a single item's rename/delete/add/
  toggle.
- Native `prompt()`/`confirm()` dialogs for user *decisions* are
  replaced with in-page modals (`confirmModal()`, `promptModal()`,
  purpose-built ones like `openEditModal`/`openListEditModal`). Plain
  `alert()` is still used for simple one-button validation/error
  messages (e.g. "texto não pode ficar vazio", "não foi possível
  salvar") — that's an intentional distinction, not an inconsistency.
- Summary/UI language: pt-BR. Code/comments: English.
