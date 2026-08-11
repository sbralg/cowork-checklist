# cowork-checklist

Public GitHub Pages front end for three small apps that share one Supabase
backend: a daily-task checklist (`index.html`), a shopping-list manager
(`shopping.html`) and the morning summary (`hoje.html`).

**Live:** https://sbralg.github.io/cowork-checklist/

The pages are data-free shells — no API keys, no data — that ask for a
shared passphrase (stored in `localStorage`) and then talk to a single
Supabase Edge Function, `checklist-api`, which holds the service-role key
and enforces the passphrase server-side.

This repo has no build step: each `.html` file is a complete, static page
(HTML + CSS + JS inline). Deploy is just "push to `main`" — GitHub Pages
serves it directly.

`test/shopping.test.js` is a headless Chromium test for `shopping.html`.
There is no CI — run `node test/shopping.test.js` by hand after changing
that page. It stubs the backend entirely, so it needs no credentials.

For the full architecture (Supabase schema, Edge Function source, the
scheduled task that populates the checklist every morning, and the
project's change history) see the sibling repo
[`cowork-personal-daily-summary`](https://github.com/sbralg/cowork-personal-daily-summary),
specifically its `CLAUDE.md`. That repo holds the master copies of
`index.html` and `hoje.html`; `shopping.html` is sourced here and has no
mirror.
