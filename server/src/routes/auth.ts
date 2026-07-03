import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { User } from '../models/User.js';
import { HttpError } from '../middleware/errorHandler.js';
import { loginLimiter } from '../middleware/rateLimit.js';
import { JWT_SECRET, JWT_EXPIRES_IN } from '../config.js';

export const authRouter = Router();

const loginSchema = z
  .object({
    email: z.string().trim().email(),
    password: z.string().min(1, 'Password is required').max(200),
  })
  .strict();

// POST /api/auth/login
// WHY the tight loginLimiter: login is THE brute-force target — 10 tries/min
// per IP makes password guessing impractical while never blocking a human.
authRouter.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);

  const user = await User.findOne({ email: email.toLowerCase() });
  // WHY compare against a dummy hash when the user doesn't exist: keeps the
  // response time identical for unknown vs known emails, so an attacker can't
  // use timing to discover which emails have accounts (user enumeration).
  const hash = user?.passwordHash ?? '$2a$10$invalidinvalidinvalidinvalidinvalidinvalid1234567890';
  const ok = await bcrypt.compare(password, hash);
  // WHY one generic message for both failure causes: "email not found" vs
  // "wrong password" would confirm which emails exist.
  if (!user || !ok) throw new HttpError(401, 'Invalid email or password');

  const token = jwt.sign({ sub: user.id, name: user.name, role: user.role }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
  // WHY return the user alongside the token: saves the client an immediate
  // "who am I" round-trip just to render the header.
  res.json({ token, user: { name: user.name, email: user.email, role: user.role } });
});
