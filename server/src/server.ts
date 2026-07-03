import 'dotenv/config';
import { createServer } from 'http';
import mongoose from 'mongoose';
import { Server } from 'socket.io';
import { createApp } from './app.js';
import { setIo } from './realtime.js';

const PORT = Number(process.env.PORT) || 4000;
// WHY 127.0.0.1 default: works out of the box with a local MongoDB and avoids
// committing any real connection string — override via .env for other setups.
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ticket-sys';

async function main() {
  // WHY connect BEFORE listen: accepting traffic while the DB is down would
  // just turn every request into a 500 — fail fast and loudly instead.
  await mongoose.connect(MONGO_URI);
  console.log('MongoDB connected');

  const app = createApp();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    // WHY cors origin true: the static frontend may be on a different host
    // (Netlify) while the API/socket server is on tickets.ouiimi.com.
    cors: { origin: true },
  });
  setIo(io);

  httpServer.listen(PORT, () => {
    console.log(`API running on http://localhost:${PORT}`);
    console.log('Socket.IO live updates enabled');
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
