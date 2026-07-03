# Support Ticket Dashboard

A compact, production-minded support ticket dashboard: view, filter, create and update customer support tickets. Built for the Aurexillion Full-Stack Technical Assessment.

Every non-obvious decision in the code is marked with a `// WHY:` comment explaining the reasoning.

## Technologies

| Layer    | Choice                                | Why                                                                                     |
| -------- | ------------------------------------- | --------------------------------------------------------------------------------------- |
| Backend  | Node.js + Express 5 + TypeScript      | Express 5 forwards async errors automatically → no try/catch noise in routes            |
| Database | MongoDB + Mongoose                    | A ticket is a natural self-contained document; Mongoose adds schema validation + typing |
| Validation | Zod                                 | Precise per-field 400 errors at the API edge, before the DB is touched                   |
| Auth     | JWT (`jsonwebtoken`) + `bcryptjs`     | Stateless tokens keep the API horizontally scalable; bcrypt for password hashing (pure JS — no native build step for reviewers) |
| API docs | `swagger-ui-express` + hand-written OpenAPI 3 spec | Interactive docs at `/api/docs`; the spec imports the real enum constants so docs can't drift from code |
| Frontend | React + Vite + TypeScript             | Smallest standard setup; react-router only extra dependency                              |
| Styling  | Plain CSS (~100 lines)                | Three pages don't justify a UI library; assessment values clarity over polish            |
| Testing  | Vitest + Supertest + mongodb-memory-server | Tests hit a real in-memory MongoDB — no local DB needed, no dev data touched        |

## Prerequisites

- Node.js 18+
- MongoDB running locally (`brew services start mongodb-community` or Docker: `docker run -d -p 27017:27017 mongo`)
  - Not needed for the tests — they use an in-memory MongoDB.

## Setup & Run

```bash
# 1. Backend (terminal 1)
cd server
npm install
cp .env.example .env        # optional — defaults work with local MongoDB
npm run seed                # loads 8 sample tickets + demo agent (idempotent, safe to re-run)
npm run dev                 # API on http://localhost:4000

# 2. Frontend (terminal 2)
cd client
npm install
npm run dev                 # UI on http://localhost:5173 (proxies /api to :4000)
```

Open http://localhost:5173. To change ticket statuses, sign in as the seeded demo agent: **agent@example.com / agent123**. Interactive API docs: http://localhost:4000/api/docs.

## Tests

```bash
cd server
npm test
```

14 tests cover: ticket creation + persistence, required-field rejection, email format rejection, status update + persistence, invalid status rejection, concurrent-edit rejection (409 on stale version), 404 handling, login success, login failure (with identical responses for wrong-password vs unknown-email), 401 on unauthenticated/garbage-token updates, rate limiting (429 after the write budget), status filtering with sort order, search by title/customer, and regex-metacharacter escaping in search. First run downloads an in-memory MongoDB binary (~1 min).

## API

Interactive documentation with try-it-out: **`/api/docs`** (Swagger UI, hand-written OpenAPI 3 spec).

| Method | Route              | Auth | Description                                                    |
| ------ | ------------------ | ---- | -------------------------------------------------------------- |
| GET    | `/api/tickets`     | —    | List tickets. Query: `status`, `priority`, `q` (search title/customer), `page`, `limit` (max 100). Returns `{ tickets, total, page, limit }` |
| GET    | `/api/tickets/:id` | —    | Single ticket (404 if missing)                                  |
| POST   | `/api/tickets`     | —    | Create ticket — public (customers file tickets); status always starts as `open` (server-enforced) |
| PATCH  | `/api/tickets/:id` | 🔒 agent | Partial update (`status`, `priority`, `title`, `description`, optional `expectedVersion`) |
| POST   | `/api/auth/login`  | —    | Agent login → `{ token, user }` (JWT, 8h validity)              |
| GET    | `/api/health`      | —    | Liveness probe                                                  |

Validation errors return `400` with `{ error, details: { field: message } }` so the frontend can render inline errors. Unknown `/api` routes return a JSON 404.

**Authentication:** deliberate role split — *customers* create tickets (public form, like a real helpdesk), *agents* manage them (PATCH requires a JWT). There is **no registration endpoint by design**: agents are provisioned (here by the seed script), because open signup would let anyone grant themselves agent powers. Login is hardened: bcrypt-hashed passwords, one generic error for wrong-password vs unknown-email plus a constant-time dummy-hash comparison (prevents user enumeration by message *or* timing), and a tight 10/min rate limit against brute force. Tokens are stateless (no session store, no per-request DB lookup) and expire after 8h — one support shift. Client stores the session in localStorage: an XSS could read it, the hardened alternative is an httpOnly cookie + CSRF token; with no third-party scripts this is an acceptable, documented trade-off at this scope.

**Search:** `?q=` matches title or customer name, case-insensitive substring. Input is regex-escaped (ReDoS/injection-safe, covered by a test) and capped at 100 chars. At large scale you'd switch to a text/Atlas Search index without changing the API contract.

**Concurrent edits (optimistic locking):** every ticket carries a `version` number that increments on each change. PATCH accepts an optional `expectedVersion`; if the ticket has moved on since the client read it, the server answers `409 Conflict` instead of overwriting another agent's change. The frontend recovers by refetching and showing the latest state ("Changed by someone else — refreshed"). Clients that omit `expectedVersion` get simple last-write-wins. Internally, Mongoose `optimisticConcurrency` guards the load-to-save window too, so even two requests racing inside the server can't clobber each other.

**Rate limiting** (per IP, per minute): 300 reads across `/api`, 30 writes on POST/PATCH — a public create form is the classic spam target, so mutations get the tight cap. Exceeding it returns `429` with the same JSON error shape and standard `RateLimit-*` headers. Counters are in-memory (right for a single instance); behind a load balancer you'd swap in the Redis store so replicas share counts. Ticket shape matches the assessment example (`id`, `title`, `description`, `customerName`, `customerEmail`, `status`, `priority`, `createdAt`) plus `updatedAt` (free with Mongoose timestamps, useful for support audits) and `version` (optimistic-locking token, see below).

## Data model

`status`: `open | in_progress | resolved` · `priority`: `low | medium | high`

- Enums are enforced at **both** the API edge (Zod, friendly errors) and the DB layer (Mongoose, last line of defense).
- All strings have max lengths — a public form is abuse-prone; unbounded input bloats documents.
- Emails are lowercased on write so future lookups need no case handling.
- Compound indexes `{status, createdAt}` and `{priority, createdAt}` serve the dashboard's hot query (filter + newest-first sort) entirely from the index.

## Assumptions & trade-offs

- **No auth** — out of scope per the brief; every visitor can manage tickets.
- **Pagination is implemented in the API** (default 50, cap 100) but the UI shows the first page only — with real traffic the collection grows unbounded, so the API refuses to return "everything"; UI paging controls were the cut.
- **Types are duplicated** between `server` and `client` (~15 lines) rather than a shared workspace package — simpler for a two-package repo, documented sync cost.
- **No optimistic UI** on status updates — the UI re-renders from the server response, so what you see is always what was persisted (the core requirement). Cost: a briefly disabled select.
- **No CORS config** — the Vite dev proxy makes requests same-origin; production would serve the built frontend behind the same origin.
- **Load-then-save on PATCH** instead of `findByIdAndUpdate` — full schema validation with one obvious code path; negligible cost at this document size.

## Optional improvements from the brief

| Item | Status |
| ---- | ------ |
| Search by title or customer | ✅ `?q=` API param + debounced search box; regex-escaped input |
| Pagination or sorting | ✅ Sorting (newest first, index-backed) and API pagination (`page`/`limit`, capped at 100). UI paging controls deferred |
| Authentication / role-based access | ✅ JWT agent login; public creates vs agent-only updates; no open signup by design |
| Swagger/OpenAPI documentation | ✅ Interactive Swagger UI at `/api/docs` |
| Additional automated tests | ✅ 14 tests vs the required 2 |
| Accessibility improvements | ✅ Labels on all inputs, `aria-label` on selects, `aria-invalid` on failed fields, `role="alert"`/`role="status"` on feedback, visible focus outlines |
| Docker, deployment, WebSockets | ❌ Deliberately skipped — the brief prioritizes reliable core flows over breadth |

Beyond the brief's list, two production-hardening features were added: **per-IP rate limiting** (429) and **optimistic concurrency control** for concurrent edits (409 + UI self-refresh) — see the API section above.

## With more time

- UI pagination / infinite scroll on the list
- Kanban drag-and-drop board (the PATCH endpoint already supports it)
- Frontend component tests (Vitest + Testing Library)
- Docker Compose (API + MongoDB + built frontend behind one origin)
- httpOnly-cookie sessions + refresh tokens instead of localStorage JWT
- Admin role + user management UI (the `role` field already exists)

## Project structure

```
server/
  src/
    models/                   # Ticket (schema + indexes + shared enums), User
    validation/ticket.schema.ts # zod request validation
    routes/                   # tickets, auth (login)
    middleware/               # errorHandler (single exit door), rateLimit, auth (JWT verify)
    docs/openapi.ts           # hand-written OpenAPI 3 spec (served at /api/docs)
    config.ts                 # JWT secret + expiry
    app.ts                    # express app (imported by tests)
    server.ts                 # DB connect + listen
    seed.ts                   # idempotent sample data + demo agent
  tests/tickets.test.ts
client/
  src/
    types.ts                  # mirrored API contract + label maps
    api.ts                    # typed fetch wrapper + session storage
    auth.tsx                  # AuthProvider / useAuth context
    components/               # Badge, StatusSelect (auth-aware PATCH control)
    pages/                    # TicketList, TicketDetail, NewTicket, Login
```
