# maga-web

Public GitHub Pages front end for **Magá Assistant** — a set of small
single-file pages sharing one Supabase backend. A dashboard (`index.html`)
links to: `tarefas.html` (daily-task checklist), `compras.html` (shopping
lists), `hoje.html` (the morning summary), `estoque.html` / `insumos.html` /
`ingredientes.html` (pantry, SKU catalogue, ingredients), and the
confectionery-business side — `receitas.html`, `produtos.html`,
`fornecedores.html`, `clientes.html`, `eventos.html`, `financeiro.html`.

**Live:** https://sbralg.github.io/maga-web/

The pages are data-free shells — no API keys, no data — that ask for a
shared passphrase (stored in `localStorage`) and then talk to a single
Supabase Edge Function, `maga-api`, which holds the service-role key and
enforces the passphrase server-side. The request header is still
`x-checklist-pass` and the stored key `checklist_pass` (wire contract kept
across the 2026-08-31 rename; see `CLAUDE.md`).

This repo has no build step: each `.html` file is a complete, static page
(HTML + CSS + JS inline), plus the shared `shared-*.js` / `shared-*.css`.
Deploy is just "push to `main`" — GitHub Pages serves it directly.

`test/` holds one headless Chromium test per page (`node test/<name>.test.js`).
There is no CI — run the relevant ones by hand before pushing. They stub the
backend entirely (route-intercepting `**/functions/v1/maga-api`), so they
need no credentials.

For the full architecture (Supabase schema, Edge Function source, the
scheduled task that populates `tarefas.html` / `hoje.html` every morning,
and the project's change history) see the sibling repo
[`maga-api`](https://github.com/sbralg/maga-api), specifically its
`CLAUDE.md`. That repo is the backend half and holds no copy of these
pages — the front end lives only here.
