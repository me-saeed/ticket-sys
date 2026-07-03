import { Request, Response, NextFunction } from 'express';
import { Error as MongooseError } from 'mongoose';
import { ZodError } from 'zod';

// WHY a tiny HttpError class instead of a library: routes just `throw new
// HttpError(404, ...)` and Express 5 forwards async throws here automatically —
// one place decides response shape, routes stay free of try/catch noise.
export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// WHY a single error middleware: every error — validation, not-found, or crash —
// exits through one door, so the JSON error shape `{ error, details? }` is
// guaranteed consistent for the frontend to render.
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    // WHY field->message map: lets the frontend show errors next to inputs.
    const details: Record<string, string> = {};
    for (const issue of err.issues) details[issue.path.join('.') || '_'] = issue.message;
    return res.status(400).json({ error: 'Validation failed', details });
  }
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message });
  }
  // WHY: with optimisticConcurrency enabled, two requests racing inside the
  // server throw VersionError on the losing save() — that's the same
  // "somebody else changed it" situation as a stale expectedVersion, so it
  // gets the same 409, not a 500.
  if (err instanceof MongooseError.VersionError) {
    return res.status(409).json({ error: 'Ticket was changed by someone else — showing the latest version' });
  }
  // WHY log + generic 500: internals (stack traces, DB errors) must never leak
  // to visitors; the log keeps the detail for operators.
  console.error(err);
  return res.status(500).json({ error: 'Internal server error' });
}
