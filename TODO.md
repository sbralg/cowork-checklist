# TODO

Exploratory ideas, no timeline, not committed to. Backlog only.

## In-app chat assistant

A chat box embedded in the front end, aware of this app's own data
(events, stock, tasks). Backed by a Console API key (not a Claude
subscription — usage here would be tiny, a few cents a month at
most) calling a cheap model. Would reuse the same tool surface
already exposed via the household's MCP server (get_event,
check_stock, list_tasks, etc.) so the assistant can actually query
and act on real data, not just chat.

The backend/tooling side of this belongs conceptually to the sibling
[`maga-api`](https://github.com/sbralg/maga-api) repo, not here — this
repo would only need a chat UI component and a thin call to whatever
endpoint fronts the assistant.

## Proactive flags on data pages

Rules-based, no LLM needed. On pages like `eventos.html`:

- Flag missing insumos by comparing an event's recipe list against
  current pantry stock
- Flag a tight deadline based on event date vs. current status

Pure logic over existing Supabase data already available through
`maga-api` — no new infrastructure required.
