import { Router } from 'express';
import { isValidObjectId, FilterQuery } from 'mongoose';
import { Ticket, TicketDoc, STATUSES, PRIORITIES, Status, Priority } from '../models/Ticket.js';
import { createTicketSchema, updateTicketSchema } from '../validation/ticket.schema.js';
import { HttpError } from '../middleware/errorHandler.js';
import { writeLimiter } from '../middleware/rateLimit.js';
import { requireAuth } from '../middleware/auth.js';

export const ticketsRouter = Router();

// WHY: an invalid ObjectId would make Mongoose throw a CastError (a 500-ish
// mess); checking upfront turns "/api/tickets/abc" into a clean 404.
function findByIdOr404(id: string) {
  if (!isValidObjectId(id)) throw new HttpError(404, 'Ticket not found');
  return Ticket.findById(id);
}

// GET /api/tickets?status=open&priority=high&q=payment&page=1
ticketsRouter.get('/', async (req, res) => {
  const filter: FilterQuery<TicketDoc> = {};
  // WHY whitelist instead of passing req.query into Mongo: query params are
  // attacker-controlled; only known enum values may ever reach the DB filter.
  const { status, priority, q } = req.query;
  if (typeof status === 'string' && (STATUSES as readonly string[]).includes(status)) filter.status = status as Status;
  if (typeof priority === 'string' && (PRIORITIES as readonly string[]).includes(priority)) filter.priority = priority as Priority;

  // Search by title or customer name.
  // WHY escape the input: user text must never become regex syntax — an
  // unescaped "(a+)+" style pattern is a classic ReDoS attack vector.
  // WHY slice(0,100): bounds the work a single search can cause.
  // WHY case-insensitive regex over a $text index: substring matches feel
  // right in a small dashboard ("pay" finds "payment"); $text only matches
  // whole words. At large scale you'd move to a text/Atlas Search index —
  // the API contract (?q=) wouldn't change.
  if (typeof q === 'string' && q.trim()) {
    const escaped = q.trim().slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { title: { $regex: escaped, $options: 'i' } },
      { customerName: { $regex: escaped, $options: 'i' } },
    ];
  }

  // WHY pagination with a hard cap: with real traffic the collection grows
  // unbounded — returning "all tickets" would eventually melt both server and
  // browser. 50/page keeps responses fast; the cap stops ?limit=999999 abuse.
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));

  // WHY .lean(): list views only read data — skipping Mongoose document
  // hydration is markedly cheaper per request on hot endpoints.
  // WHY sort by createdAt desc: newest tickets are what support agents need
  // first, and the compound indexes serve this sort directly. _id breaks ties
  // deterministically when two tickets share the same millisecond.
  const [items, total] = await Promise.all([
    Ticket.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean().exec(),
    Ticket.countDocuments(filter),
  ]);
  // WHY manual mapping here: .lean() skips the schema's toJSON transform, so
  // we rename _id -> id and __v -> version ourselves to keep the contract
  // consistent (the list is where clients pick up versions for later PATCHes).
  const tickets = items.map(({ _id, __v, ...rest }) => ({ id: String(_id), version: __v, ...rest }));
  res.json({ tickets, total, page, limit });
});

// GET /api/tickets/:id
ticketsRouter.get('/:id', async (req, res) => {
  const ticket = await findByIdOr404(req.params.id);
  if (!ticket) throw new HttpError(404, 'Ticket not found');
  res.json(ticket);
});

// POST /api/tickets
// WHY writeLimiter only on mutations: creating documents is the abuse vector
// (spam tickets fill the DB); reads are already covered by the outer limiter.
ticketsRouter.post('/', writeLimiter, async (req, res) => {
  // WHY .parse (throws) not .safeParse: the error middleware already turns
  // ZodError into a field-level 400 — no per-route error code needed.
  const input = createTicketSchema.parse(req.body);
  // WHY status is not spread from input: the spec requires every new ticket
  // to start "open"; the schema default enforces it, clients can't override.
  const ticket = await Ticket.create(input);
  res.status(201).json(ticket);
});

// PATCH /api/tickets/:id
// WHY requireAuth here but NOT on POST: customers file tickets (public form),
// only signed-in support agents manage them. Reads stay public so the
// dashboard is browsable; in a stricter setup you'd gate GET too.
ticketsRouter.patch('/:id', requireAuth, writeLimiter, async (req, res) => {
  const { expectedVersion, ...updates } = updateTicketSchema.parse(req.body);
  // WHY load-then-save instead of findByIdAndUpdate: save() runs the full
  // schema validation reliably and keeps one code path — negligible cost at
  // this document size, simpler to reason about.
  // WHY String(): with an extra middleware in the chain TS widens params to
  // string | string[]; normalizing keeps findByIdOr404's signature honest.
  const ticket = await findByIdOr404(String(req.params.id));
  if (!ticket) throw new HttpError(404, 'Ticket not found');
  // WHY 409 Conflict: the client is editing a stale copy — refusing (instead
  // of overwriting) lets the UI reload the latest state and tell the user,
  // rather than silently losing another agent's change.
  if (expectedVersion !== undefined && ticket.__v !== expectedVersion) {
    throw new HttpError(409, 'Ticket was changed by someone else — showing the latest version');
  }
  ticket.set(updates);
  await ticket.save();
  res.json(ticket);
});
