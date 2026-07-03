import { Schema, model, InferSchemaType } from 'mongoose';

// WHY: constants exported once and reused by zod validation, seed data and
// (conceptually) the frontend — a single source of truth prevents the enums
// drifting apart across layers.
export const STATUSES = ['open', 'in_progress', 'resolved'] as const;
export const PRIORITIES = ['low', 'medium', 'high'] as const;
export type Status = (typeof STATUSES)[number];
export type Priority = (typeof PRIORITIES)[number];

const ticketSchema = new Schema(
  {
    // WHY maxlength on all strings: a public form is abuse-prone; unbounded
    // strings let one visitor bloat documents and slow every list query.
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, required: true, trim: true, maxlength: 5000 },
    customerName: { type: String, required: true, trim: true, maxlength: 100 },
    // WHY lowercase: emails are case-insensitive; normalizing on write means
    // future lookups/dedup by email need no per-query case handling.
    customerEmail: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
    // WHY enum + default at DB layer (not only in request validation): the DB
    // is the last line of defense — a future script or endpoint can't write an
    // invalid status even if it skips the API validation.
    status: { type: String, enum: STATUSES, default: 'open' },
    priority: { type: String, enum: PRIORITIES, required: true },
  },
  {
    // WHY timestamps: createdAt is a core requirement; updatedAt is free and
    // useful for support audit questions ("when was this last touched?").
    timestamps: true,
    // WHY optimisticConcurrency: save() then atomically checks the version it
    // loaded — even two requests racing inside the server can't overwrite
    // each other; the loser gets a VersionError instead of silently winning.
    optimisticConcurrency: true,
    // WHY: expose `id`/`version` instead of `_id`/`__v` so the API contract
    // matches the assessment's example object and stays Mongo-agnostic.
    // `version` is the optimistic-locking token clients echo back on PATCH.
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.id = String(ret._id);
        ret.version = ret.__v;
        delete ret._id;
        delete ret.__v;
      },
    },
  }
);

// WHY these compound indexes: the dashboard's hot query is "filter by
// status/priority, newest first". With many visitors and tickets, Mongo can
// serve both the filter AND the sort from one index — no in-memory sorts.
ticketSchema.index({ status: 1, createdAt: -1 });
ticketSchema.index({ priority: 1, createdAt: -1 });

// WHY InferSchemaType: the TS type is derived from the schema, so schema
// changes can never silently disagree with the type used in routes/tests.
export type TicketDoc = InferSchemaType<typeof ticketSchema>;
export const Ticket = model('Ticket', ticketSchema);
