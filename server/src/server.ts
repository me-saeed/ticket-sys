import 'dotenv/config';
import mongoose from 'mongoose';
import { createApp } from './app.js';

const PORT = Number(process.env.PORT) || 4000;
// WHY 127.0.0.1 default: works out of the box with a local MongoDB and avoids
// committing any real connection string — override via .env for other setups.
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ticket-sys';

async function main() {
  // WHY connect BEFORE listen: accepting traffic while the DB is down would
  // just turn every request into a 500 — fail fast and loudly instead.
  await mongoose.connect(MONGO_URI);
  console.log('MongoDB connected');

  createApp().listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
