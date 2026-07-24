# cowork-checklist

Public GitHub Pages front end for two small apps that share one Supabase
backend: a daily-task checklist (`index.html`) and a shopping-list manager
(`shopping.html`).

**Live:** https://sbralg.github.io/cowork-checklist/

Both pages are data-free shells — no API keys, no data — that ask for a
shared passphrase (stored in `localStorage`) and then talk to a single
Supabase Edge Function, `checklist-api`, which holds the service-role key
and enforces the passphrase server-side.

This repo has no build step: each `.html` file is a complete, static page
(HTML + CSS + JS inline). Deploy is just "push to `main`" — GitHub Pages
serves it directly.

For the full architecture (Supabase schema, Edge Function source, the
scheduled task that populates the checklist every morning, and the
project's change history) see the sibling repo
[`cowork-personal-daily-summary`](https://github.com/sbralg/cowork-personal-daily-summary),
specifically its `CLAUDE.md`. This repo only holds the deployed front end.
