# CLAUDE.md — cowork-checklist

Context file for Claude Code / Claude sessions working on this repo.

## What this is

The public GitHub Pages front end deployed from this repo's `main` branch,
served at https://sbralg.github.io/cowork-checklist/. Five independent
pages, no build step, no framework:

- `index.html` — the daily-task checklist (pending actions, done-tasks
  history with undo, manual task creation, edit/delete).
- `shopping.html` — the shopping-list manager (multiple named lists,
  per-item price + quantity, purchased toggle, running totals, barcode
  scanning against the product catalogue).
- `hoje.html` — "Hoje": the morning summary rendered for the browser,
  read from `public.daily_reports`.
- `estoque.html` — the pantry: how many packages of each product are in
  the cupboard, and changing that (− / + steppers, exact recount).
- `produtos.html` — the product catalogue: what a barcode means, its price
  history as a graph, the editor that corrects its metadata, and removal
  from the catalogue.

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

All five are data-free shells: no Supabase keys, no data baked in. Each
asks for a shared passphrase (stored in `localStorage`, prompted once per
device) and talks only to one Supabase Edge Function, `checklist-api`
(deployed in project `opehbckfmfschpvbhxvo`), which holds the
service-role key and checks the passphrase server-side. See
`sbralg/cowork-personal-daily-summary`'s `CLAUDE.md` for the Edge
Function's source, the Supabase schema, the scheduled task that
populates `index.html`'s data every morning, and this whole project's
full change history — that repo is the source of truth for the backend,
this one for the front end.

## Master-copy relationship

**Every page lives ONLY here — there are no mirrors anywhere.** All five
pages and both tests have exactly one copy, in this repo. Edit them
directly; there is nothing to sync and no master copy to update first.

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

Two headless Chromium tests, each next to the pages it guards. Both serve
the repo root on an ephemeral port and answer `checklist-api` from an
in-memory fake, so neither touches Supabase nor holds a passphrase.
**There is no CI — run them by hand before pushing.**

- `test/shopping.test.js` — the scanner, the barcode validation, the scan
  confirm dialog (including its layout) and the add/edit/merge paths. Run
  it after changing `shopping.html`.
- `test/stock.test.js` — the pantry steppers, the zero floor and its
  retroactive-purchase dialog, the recount, the per-product queue that
  keeps a double tap from outrunning the floor, search, the price graph,
  the product editor, the ingredient picker on both pages, the two-step
  product removal and the deep links between the two pages. Run it
  after changing `estoque.html` or `produtos.html`. Its fake keeps a
  **real ledger** and enforces the zero floor the same way the Edge
  Function does — that rule is the whole reason those pages look the way
  they do, so faking it away would leave the interesting half untested.

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
  - Run `node test/shopping.test.js` AND `node test/stock.test.js` BEFORE
    pushing, every time. They are the only gate left between a broken page
    and the live site.
  - `sbralg/cowork-personal-daily-summary` is the opposite — it keeps
    PRs. Nothing there is served straight from `main` to a browser, and
    its `CLAUDE.md` is the project's history, which reads better as
    reviewed changes.
- **No shared JS module between the pages.** Logic more than one page needs
  (the hamburger menu, `esc()`, `confirmModal()`/`promptModal()`, the
  emoji-grapheme helpers, `fmtNetQty()`/`fmtQty()`, the cents-first price
  input, etc.) is duplicated verbatim across the files rather than factored
  into a shared script — a deliberate choice, not an oversight. When fixing
  a shared-pattern bug or adding a shared feature, apply it to every file
  that carries a copy.
  - `MENU_ITEMS` is the one that bites: adding a page means adding an entry
    to **all five** copies of that array, or the new page is invisible from
    wherever you forgot.
  - What is deliberately NOT duplicated: the barcode scanner. It lives only
    in `shopping.html` — ~300 lines of camera, lens-picking and focus code
    that would be a genuine maintenance trap in a second copy. Estoque
    finds a product by search instead.
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
