import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config.js';
import { HttpError } from './errorHandler.js';

// Shape of what we sign into the token — kept minimal on purpose.
// WHY no DB lookup per request: the JWT is self-contained and verified by
// signature, so protected routes cost zero extra DB reads. Trade-off: a
// deleted agent's token stays valid until it expires (8h) — acceptable here;
// a revocation list would fix it if requirements demanded instant lockout.
export interface AuthUser {
  sub: string; // user id ("subject" — the standard JWT claim name)
  name: string;
  role: string;
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;
  if (!token) throw new HttpError(401, 'Authentication required — sign in to do this');
  try {
    // WHY res.locals over patching req's type: Express's own sanctioned spot
    // for per-request data — no global type augmentation needed.
    res.locals.user = jwt.verify(token, JWT_SECRET) as AuthUser;
  } catch {
    // WHY one message for expired/tampered/malformed: the client's remedy is
    // identical (sign in again), and detail would only help an attacker probe.
    throw new HttpError(401, 'Invalid or expired session — sign in again');
  }
  next();
}
