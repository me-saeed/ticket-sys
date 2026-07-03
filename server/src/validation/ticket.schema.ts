import { z } from 'zod';
import { STATUSES, PRIORITIES } from '../models/Ticket.js';

// WHY zod at the API edge (in addition to Mongoose): zod gives precise,
// per-field error messages for 400 responses and validates BEFORE touching
// the DB — cheaper under load and clearer for the client than CastErrors.

export const createTicketSchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required').max(200),
    description: z.string().trim().min(1, 'Description is required').max(5000),
    customerName: z.string().trim().min(1, 'Customer name is required').max(100),
    // WHY .email() here: format validation belongs at the edge; the Mongoose
    // schema only guards length/presence so the two layers don't duplicate regexes.
    customerEmail: z.string().trim().email('Invalid email format').max(254),
    priority: z.enum(PRIORITIES),
  })
  // WHY .strict(): silently dropping unknown keys hides client bugs; rejecting
  // them also blocks anyone trying to inject fields like `status` on create —
  // the spec says new tickets must always start as "open".
  .strict();

// WHY a partial PATCH schema: PATCH means "change only what was sent". Status
// is the required flow; allowing priority/title/description edits costs no
// extra code and matches how a real support tool is used.
export const updateTicketSchema = z
  .object({
    status: z.enum(STATUSES),
    priority: z.enum(PRIORITIES),
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().min(1).max(5000),
    // WHY expectedVersion (optimistic locking): the client echoes the version
    // it last saw; the route rejects with 409 if the ticket moved on since —
    // preventing two agents from silently overwriting each other's edits.
    // Optional so simple clients/scripts can still do last-write-wins.
    expectedVersion: z.number().int().nonnegative(),
  })
  .partial()
  .strict()
  // WHY: a PATCH that updates nothing is almost always a client bug — fail
  // loudly. expectedVersion alone doesn't count: it's a guard, not a change.
  .refine((data) => Object.keys(data).some((k) => k !== 'expectedVersion'), {
    message: 'At least one field is required',
  });

export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;
