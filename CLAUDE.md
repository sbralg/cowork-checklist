# CLAUDE.md — cowork-checklist

Context file for Claude Code / Claude sessions working on this repo.

## What this is

The public GitHub Pages front end deployed from this repo's `main` branch,
served at https://sbralg.github.io/cowork-checklist/. Three independent
pages, no build step, no framework:

- `index.html` — the daily-task checklist (pending actions, done-tasks
  history with undo, manual task creation, edit/delete).
- `shopping.html` — the shopping-list manager (multiple named lists,
  per-item price + quantity, purchased toggle, running totals, barcode
  scanning against the product catalogue).
- `hoje.html` — "Hoje": the morning summary rendered for the browser,
  read from `public.daily_reports`.

All three are data-free shells: no Supabase keys, no data baked in. Each
asks for a shared passphrase (stored in `localStorage`, prompted once per
device) and talks only to one Supabase Edge Function, `checklist-api`
(deployed in project `opehbckfmfschpvbhxvo`), which holds the
service-role key and checks the passphrase server-side. See
`sbralg/cowork-personal-daily-summary`'s `CLAUDE.md` for the Edge
Function's source, the Supabase schema, the scheduled task that
populates `index.html`'s data every morning, and this whole project's
full change history — that repo is the source of truth for everything
except what's actually deployed here, plus `shopping.html`, which is
sourced here (see below).

## Master-copy relationship

**`shopping.html` lives ONLY here.** It has one copy, in this repo, and
so does its test — edit it directly, there is nothing to sync. It was
briefly mirrored into `sbralg/cowork-personal-daily-summary` (2026-08-01
to 2026-08-11) and that mirror immediately did what mirrors do: this
file went stale about it and a change was one sync away from being
silently overwritten. The mirror is gone; do not recreate it.

**`index.html` and `hoje.html` are different** — those two ARE synced
copies of `web/*.html` in `sbralg/cowork-personal-daily-summary` (that
repo is the master; this one is what's actually live). A change to
either must be made in the master copy first, then copied here
byte-for-byte before committing, or the next sync silently overwrites
it. Two rules coexist, so check which page you are touching.

`test/shopping.test.js` is a headless Chromium test covering the
scanner, the barcode validation, the scan confirm dialog (including its
layout) and the add/edit/merge paths. It serves the repo root on an
ephemeral port and answers `checklist-api` from an in-memory fake, so it
never touches Supabase and holds no passphrase. There is no CI — run
`node test/shopping.test.js` by hand after changing `shopping.html`.

## Conventions

- **No build step.** Each `.html` file is a single, complete, static
  page — HTML/CSS/JS all inline in one file. Deploy is `git push` to
  `main`; GitHub Pages serves it directly, no CI.
- **No shared JS module between the pages.** Logic more than one page needs
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
