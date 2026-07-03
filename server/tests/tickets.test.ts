import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import type { Server } from 'socket.io';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import { Ticket } from '../src/models/Ticket.js';
import { User } from '../src/models/User.js';
import { setIo } from '../src/realtime.js';

// WHY mongodb-memory-server: tests run against a real (in-memory) MongoDB, so
// schema validation, indexes and queries are tested for real — but without
// requiring a running local DB or ever touching development data.
let mongo: MongoMemoryServer;
let token: string; // agent JWT used by all PATCH tests
const app = createApp();
const emitSpy = vi.fn();

beforeAll(async () => {
  setIo({ emit: emitSpy } as unknown as Server);
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());

  // One agent for the whole run — obtained through the real login endpoint so
  // the token is exactly what a browser would hold.
  // WHY bcrypt cost 4 here (vs 10 in seed): hashing speed matters in tests
  // and brute-force resistance doesn't.
  await User.create({
    email: 'agent@test.com',
    name: 'Test Agent',
    passwordHash: await bcrypt.hash('secret123', 4),
  });
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: 'agent@test.com', password: 'secret123' });
  token = res.body.token;
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

// WHY wipe between tests: each test starts from a known-empty state, so tests
// stay independent and can run in any order.
beforeEach(async () => {
  emitSpy.mockClear();
  await Ticket.deleteMany({});
});

const validTicket = {
  title: 'Payment fails at checkout',
  description: 'Error 502 after submitting the payment form.',
  customerName: 'Jane Smith',
  customerEmail: 'jane@example.com',
  priority: 'high',
};

describe('POST /api/tickets', () => {
  it('creates a valid ticket, persists it, and forces status to "open"', async () => {
    const res = await request(app).post('/api/tickets').send(validTicket);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ ...validTicket, status: 'open' });
    expect(res.body.id).toBeDefined();
    expect(res.body.createdAt).toBeDefined();

    // WHY check the DB too: proves persistence, not just the HTTP response.
    const inDb = await Ticket.findById(res.body.id);
    expect(inDb?.title).toBe(validTicket.title);
    expect(emitSpy).toHaveBeenCalledWith(
      'ticket:created',
      expect.objectContaining({ ticket: expect.objectContaining({ title: validTicket.title }) }),
    );
  });

  it('rejects a ticket without required fields (400 with field details)', async () => {
    const res = await request(app).post('/api/tickets').send({ priority: 'low' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
    // WHY: the frontend relies on per-field messages to render inline errors.
    expect(res.body.details.title).toBeDefined();
    expect(res.body.details.customerEmail).toBeDefined();
  });

  it('rejects an invalid email format', async () => {
    const res = await request(app)
      .post('/api/tickets')
      .send({ ...validTicket, customerEmail: 'not-an-email' });

    expect(res.status).toBe(400);
    expect(res.body.details.customerEmail).toBe('Invalid email format');
  });
});

describe('PATCH /api/tickets/:id', () => {
  it('updates the status and persists the change', async () => {
    const created = await Ticket.create(validTicket);

    const res = await request(app)
      .patch(`/api/tickets/${created.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'resolved' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('resolved');

    const inDb = await Ticket.findById(created.id);
    expect(inDb?.status).toBe('resolved');
    expect(emitSpy).toHaveBeenCalledWith(
      'ticket:updated',
      expect.objectContaining({ ticket: expect.objectContaining({ status: 'resolved' }) }),
    );
  });

  it('rejects an invalid status value', async () => {
    const created = await Ticket.create(validTicket);
    const res = await request(app)
      .patch(`/api/tickets/${created.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'closed' });

    expect(res.status).toBe(400);
  });

  it('rejects a concurrent edit based on a stale version (409)', async () => {
    const created = await Ticket.create(validTicket); // starts at version 0

    // Agent A saves first — version moves 0 -> 1.
    const first = await request(app)
      .patch(`/api/tickets/${created.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'in_progress', expectedVersion: 0 });
    expect(first.status).toBe(200);
    expect(first.body.version).toBe(1);

    // Agent B still holds version 0 — their save must be refused, not merged.
    const second = await request(app)
      .patch(`/api/tickets/${created.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'resolved', expectedVersion: 0 });
    expect(second.status).toBe(409);

    // WHY assert the DB: the whole point is that A's change survived.
    const inDb = await Ticket.findById(created.id);
    expect(inDb?.status).toBe('in_progress');
  });

  it('returns 404 for a missing or malformed ticket id', async () => {
    const missing = await request(app)
      .patch(`/api/tickets/${new mongoose.Types.ObjectId()}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'resolved' });
    expect(missing.status).toBe(404);

    const malformed = await request(app).patch('/api/tickets/abc').set('Authorization', `Bearer ${token}`).send({ status: 'resolved' });
    expect(malformed.status).toBe(404);
  });
});

describe('auth', () => {
  it('logs in with valid credentials and returns a token + profile', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'agent@test.com', password: 'secret123' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user).toMatchObject({ email: 'agent@test.com', role: 'agent' });
  });

  it('rejects a wrong password and an unknown email with the same message', async () => {
    const wrongPass = await request(app)
      .post('/api/auth/login')
      .send({ email: 'agent@test.com', password: 'nope' });
    const unknownUser = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ghost@test.com', password: 'nope' });

    expect(wrongPass.status).toBe(401);
    expect(unknownUser.status).toBe(401);
    // WHY assert identical bodies: differing messages would leak which
    // emails have accounts (user enumeration).
    expect(wrongPass.body).toEqual(unknownUser.body);
  });

  it('rejects updates without a token and with a garbage token (401)', async () => {
    const created = await Ticket.create(validTicket);

    const noToken = await request(app)
      .patch(`/api/tickets/${created.id}`)
      .send({ status: 'resolved' });
    expect(noToken.status).toBe(401);

    const badToken = await request(app)
      .patch(`/api/tickets/${created.id}`)
      .set('Authorization', 'Bearer not-a-real-token')
      .send({ status: 'resolved' });
    expect(badToken.status).toBe(401);

    // WHY assert the DB: a 401 must also mean "nothing changed".
    const inDb = await Ticket.findById(created.id);
    expect(inDb?.status).toBe('open');
  });
});

// WHY this runs after all POST/PATCH tests: it deliberately exhausts the
// write limiter's per-IP budget — running earlier would 429 those tests.
// (Reads have their own, much higher budget, so GET tests are unaffected.)
describe('rate limiting', () => {
  it('returns 429 once the write budget is exhausted', async () => {
    // WHY invalid bodies: the limiter counts every attempt before validation,
    // so we can trip it without creating junk documents.
    let last = 0;
    for (let i = 0; i < 31; i++) {
      const res = await request(app).post('/api/tickets').send({});
      last = res.status;
    }
    expect(last).toBe(429);
  });
});

describe('GET /api/tickets', () => {
  it('filters by status and sorts newest first', async () => {
    await Ticket.create({ ...validTicket, title: 'A' });
    await Ticket.create({ ...validTicket, title: 'B', status: 'resolved' });
    await Ticket.create({ ...validTicket, title: 'C' });

    const res = await request(app).get('/api/tickets?status=open');

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.tickets.map((t: { title: string }) => t.title)).toEqual(['C', 'A']);
  });

  it('searches by title and customer name, case-insensitively', async () => {
    await Ticket.create({ ...validTicket, title: 'Payment failing' });
    await Ticket.create({ ...validTicket, title: 'Dark mode bug', customerName: 'Pay Corp' });
    await Ticket.create({ ...validTicket, title: 'Unrelated', customerName: 'Someone Else' });

    const res = await request(app).get('/api/tickets?q=PAY');

    expect(res.status).toBe(200);
    // Matches title "Payment failing" AND customer "Pay Corp" — not the third.
    expect(res.body.total).toBe(2);
  });

  it('treats regex metacharacters in the search as literal text', async () => {
    await Ticket.create({ ...validTicket, title: 'Error (500) on save' });

    // WHY this test: unescaped, "(500)" is a regex group and ".*" matches
    // everything — both would silently return wrong results.
    const literal = await request(app).get(`/api/tickets?q=${encodeURIComponent('(500)')}`);
    expect(literal.body.total).toBe(1);

    const wildcard = await request(app).get(`/api/tickets?q=${encodeURIComponent('.*')}`);
    expect(wildcard.body.total).toBe(0);
  });
});
