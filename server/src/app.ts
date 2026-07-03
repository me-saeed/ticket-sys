import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { openapi } from './docs/openapi.js';
import { ticketsRouter } from './routes/tickets.js';
import { authRouter } from './routes/auth.js';
import { errorHandler } from './middleware/errorHandler.js';
import { readLimiter } from './middleware/rateLimit.js';

// WHY app is separate from server.ts: tests import the app and drive it with
// supertest directly — no port binding, no network flakiness, faster tests.
export function createApp() {
  const app = express();

  // WHY a body size limit: the default (100kb) is fine, but being explicit
  // documents that a public JSON endpoint must bound its input.
  app.use(express.json({ limit: '100kb' }));

  // WHY the read limiter guards ALL /api routes: it is the outer safety net;
  // stricter write/login limiters sit directly on the sensitive routes.
  app.use('/api', readLimiter);
  app.use('/api/auth', authRouter);
  app.use('/api/tickets', ticketsRouter);

  // WHY interactive docs at /api/docs: reviewers (and future integrators) can
  // explore and try every endpoint — including authorized PATCHes via the
  // "Authorize" button — without reading a single line of code.
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapi));

  // WHY a health endpoint: trivial to add, and anything running "for real
  // visitors" needs a probe target for load balancers / uptime checks.
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  // WHY: no CORS middleware — in dev the Vite proxy makes requests
  // same-origin, and in production you'd serve the built frontend behind the
  // same origin. Less config, and no accidentally-open CORS policy.

  // WHY a JSON 404 fallback: without it Express answers unknown /api routes
  // with an HTML error page — clients expect every API response to be JSON.
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  app.use(errorHandler);
  return app;
}
