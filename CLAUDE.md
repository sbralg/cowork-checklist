# CLAUDE.md — cowork-checklist

Context file for Claude Code / Claude sessions working on this repo.

## What this is

The public GitHub Pages front end deployed from this repo's `main` branch,
served at https://sbralg.github.io/cowork-checklist/. Two independent
pages, no build step, no framework:

- `index.html` — the daily-task checklist (pending actions, done-tasks
  history with undo, manual task creation, edit/delete).
- `shopping.html` — the shopping-list manager (multiple named lists,
  per-item price + purchased toggle, running totals).

Both are data-free shells: no Supabase keys, no data baked in. Each asks
for a shared passphrase (stored in `localStorage`, prompted once per
device) and talks only to one Supabase Edge Function, `checklist-api`
(deployed in project `opehbckfmfschpvbhxvo`), which holds the
service-role key and checks the passphrase server-side. See
`sbralg/cowork-personal-daily-summary`'s `CLAUDE.md` for the Edge
Function's source, the Supabase schema, the scheduled task that
populates `index.html`'s data every morning, and this whole project's
full change history — that repo is the source of truth for everything
except what's actually deployed here.

## Master-copy relationship

**All three pages** — `index.html`, `shopping.html` and `hoje.html` — in
THIS repo are synced copies of `web/*.html` in
`sbralg/cowork-personal-daily-summary` (that repo is the master; this
one is what's actually live). Any change to a page must be made in the
master copy first, then copied over here byte-for-byte before committing
— never edit a page here directly without also updating the master, or
the next sync will silently overwrite the change.

`shopping.html` was Pages-repo-only until 2026-08-01 and this file said
so for a while after it stopped being true; that stale note is exactly
the trap it describes, so re-check the master repo rather than trusting
this paragraph if the two ever look out of step.

The master repo also holds `test/shopping.test.js`, a headless Chromium
test covering the scanner, the barcode validation and the scan
confirmation dialog. There is no CI — run `node test/shopping.test.js`
there by hand after changing `shopping.html`.

## Conventions

- **No build step.** Each `.html` file is a single, complete, static
  page — HTML/CSS/JS all inline in one file. Deploy is `git push` to
  `main`; GitHub Pages serves it directly, no CI.
- **No shared JS module between the two pages.** Logic both pages need
  (the hamburger menu, `esc()`, `confirmModal()`/`promptModal()`, the
  emoji-grapheme helpers, etc.) is duplicated verbatim in both files
  rather than factored into a shared script — a deliberate choice, not
  an oversight. When fixing a shared-pattern bug or adding a shared
  feature, apply it to both files.
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
