import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const publicDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
mkdirSync(publicDir, { recursive: true });

const apiTarget = process.env.API_PROXY_TARGET?.replace(/\/$/, '');
const lines = [];

// Same-origin /api proxy (mirrors the Vite dev proxy). Set API_PROXY_TARGET in
// Netlify to your deployed API origin, e.g. https://ticket-api.onrender.com
if (apiTarget) {
  lines.push(`/api/*  ${apiTarget}/api/:splat  200`);
}

// React Router — serve index.html for client-side routes.
lines.push('/*  /index.html  200');

writeFileSync(join(publicDir, '_redirects'), `${lines.join('\n')}\n`);
console.log('Wrote public/_redirects:\n', lines.join('\n'));
