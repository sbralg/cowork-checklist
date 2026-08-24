# CLAUDE.md — cowork-checklist

Context file for Claude Code / Claude sessions working on this repo.

## Status (2026-08-24): + Clientes module shipped, front-end refactor + Vendas/Financeiro modules shipped 2026-08-20

Full plan and reasoning in `sbralg/cowork-personal-daily-summary`'s
`ROADMAP.md` — this entry is the short version.

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
    to the comma-separated one `produtos.html` already used
    (`fmtDateTime()` in `shared-format.js`), since two pages could not both
    keep their old `fmtDate` behavior once merged under one name.
  - `tarefas.html`/`hoje.html` had zero automated coverage before this —
    a real risk given they picked up real behavior changes — so
    `test/tarefas.test.js` and `test/hoje.test.js` were added alongside
    the refactor, not after.
- **Vendas + Financeiro** are new modules for the household's side
  business: `vendas.html` tracks one sale/event per row through a
  Lead→Orçamento→Confirmado→Entregue→Cancelado pipeline, with `clientes`,
  line items (produto/serviço), and an editable payment ledger.
  `financeiro.html` is the cost/revenue ledger that Vendas auto-posts
  confirmed payments into. Full schema + Edge Function action list are in
  the backend repo's `CLAUDE.md`; see "What this is" below for what each
  page covers.
- Deployed `checklist-api` v26 and **live-verified** the whole Vendas/
  Financeiro action set against the real project via the `http`-extension
  trick (see the backend repo's `CLAUDE.md` for the full sequence) before
  building either page against it.
- **`clientes.html` (2026-08-24)** is the ninth page: the contact record
  behind a venda — full-field create/edit/delete (not just the by-name-
  only inline picker `vendas.html` already had), the vendas + pagamentos
  rollup for that cliente read through the new `cliente_detail` action
  (`checklist-api` now v27, live-verified the same way as v26) and a
  "Enviar WhatsApp" composer that builds a `wa.me` deep link client-side —
  no backend, because this household's WhatsApp bridge is LAN-only and
  unreachable from the Edge Function (see the backend repo's `CLAUDE.md`
  for why). `vendas.html`'s cliente block gained a "Ver cliente" link into
  it. **Message/e-mail history per contact is deliberately not built** —
  the page says so under the composer rather than leaving a silent gap;
  see the backend repo's Planned/future for what a real one would need.
  `test/clientes.test.js` covers create/edit/delete, the totals rollup,
  the wa.me phone normalization (a Brazilian 10/11-digit number gets `55`
  prepended, an already-prefixed number is left alone), and the deep link.

## What this is

The public GitHub Pages front end deployed from this repo's `main` branch,
served at https://sbralg.github.io/cowork-checklist/. Nine pages sharing a
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
- `estoque.html` — the pantry: how many packages of each product are in
  the cupboard, and changing that (− / + steppers, exact recount).
- `produtos.html` — the product catalogue: what a barcode means, its price
  history as a graph, the editor that corrects its metadata, and removal
  from the catalogue.
- `clientes.html` — the contact record behind a venda: full-field create/
  edit/delete, the vendas + pagamentos rollup for that cliente, and a
  `wa.me`-based "Enviar WhatsApp" composer.
- `vendas.html` — the sales/event pipeline: a `clientes` picker (with a
  "Ver cliente" link into the full record on `clientes.html`), the full
  Lead→Orçamento→Confirmado→Entregue→Cancelado status, line items
  (produto/serviço) with cost and price, and an editable payment ledger.
  Confirming a payment auto-posts a receita to Financeiro in the same
  request — the one integration point between the two modules.
- `financeiro.html` — the cost/revenue ledger: every receita and despesa,
  most arriving automatically from Vendas, some logged directly (rent,
  ingredients, marketing) for spending that never passed through a sale.

**Renamed with no redirect stubs, on purpose (2026-08-20).** A stale
bookmark to the old `shopping.html` now 404s, and one to the old
`index.html` now silently shows the dashboard instead of the task list —
both a one-time surprise, chosen over maintaining a redirect forever.

**The ingredient is what a product IS, as opposed to which SKU it is** —
three brands of leite condensado are three barcodes and ONE ingredient, and
that link is what will let a recipe ask "tenho leite condensado?" across
brands. It is set BY HAND, from the detail sheet on `produtos.html` or the
chip on each `estoque.html` row, and that is a finding rather than laziness:
Open Food Facts' categories were measured against this catalogue and group
by supermarket shelf (creme de leite, leite em pó and leite condensado all
land under "milk and yogurt"), 8 of 19 products have no category at all, and
the two cremes de leite that genuinely ARE one ingredient get different
answers. A wrong link is worse than a blank one, because a recipe would
silently draw down the wrong product. The picker instead suggests from the
household's own catalogue — an existing ingredient whose words appear in the
product's name is floated up with a `provável` badge. Full reasoning in the
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
- `shared-catalog.js`/`shared-catalog.css` — produtos/estoque-only:
  `thumbHtml()`, the ingredient-name matching helpers, and
  `ingredientModal()`. **Not loaded by vendas.html** — a cliente is a
  different entity with different fields, so its picker is its own small
  page-local implementation (`clientePickerModal` in `vendas.html`) rather
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
  retroactive-purchase dialog, the recount, the per-product queue that
  keeps a double tap from outrunning the floor, search, the price graph,
  the product editor, the ingredient picker on both pages, the two-step
  product removal and the deep links between the two pages. Run it
  after changing `estoque.html` or `produtos.html`. Its fake keeps a
  **real ledger** and enforces the zero floor the same way the Edge
  Function does — that rule is the whole reason those pages look the way
  they do, so faking it away would leave the interesting half untested.
- `test/tarefas.test.js` / `test/hoje.test.js` — smoke tests added
  alongside the shared-files refactor, since both pages had zero coverage
  before it and the refactor changed real behavior on both (see the dated
  entry below). Cover the passphrase gate, the menu, and each page's core
  flow (create/edit/delete/done/undo for tarefas; day navigation and the
  live action-status overlay for hoje).
- `test/vendas.test.js` — the cliente picker (find-or-create inline), the
  full pipeline walk, line items, the payment ledger and its totals,
  editing/deleting a payment with the linked Financeiro lançamento
  following or surviving correctly, the refusal-then-force venda delete,
  the deep link, and a cliente delete that unlinks without breaking the
  detail sheet. Its fake keeps real relational state across all five
  tables, same reasoning as `stock.test.js`'s ledger.
- `test/financeiro.test.js` — standalone lançamento create/edit/delete,
  the tipo and período filters, and a seeded auto-posted entry's
  "automático" tag and 🔗 deep link back to its venda.
- `test/clientes.test.js` — full-field create/edit/delete (including the
  "N venda(s) unlinked" delete toast), search across name/organização/
  telefone/e-mail, the vendas + pagamentos rollup and its summed totals
  read through `cliente_detail`, the wa.me phone normalization and its
  href, and the deep link. Its fake keeps clientes/vendas/pagamentos as
  real relational state, same reasoning as `vendas.test.js`.

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
    `test/hoje.test.js`, `test/vendas.test.js`, `test/financeiro.test.js`,
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
    `vendas.html`'s cliente picker, on purpose (see "Shared files" above).
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
