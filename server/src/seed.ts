import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { Ticket } from './models/Ticket.js';
import { User } from './models/User.js';

// WHY seed data: the reviewer should see a populated dashboard immediately.
// A mix of statuses/priorities also makes the filters demonstrable at once.
const tickets = [
  { title: 'Unable to complete payment', description: 'Customer receives an error after submitting the payment form. Card is charged but order does not appear.', customerName: 'Jane Smith', customerEmail: 'jane@example.com', status: 'open', priority: 'high' },
  { title: 'Password reset email not arriving', description: 'Reset emails are not received on a corporate domain, checked spam folder already.', customerName: 'Tom Becker', customerEmail: 'tom.becker@example.com', status: 'in_progress', priority: 'medium' },
  { title: 'Invoice shows wrong company address', description: 'The billing address was updated last month but invoices still show the old one.', customerName: 'Aisha Khan', customerEmail: 'aisha@example.com', status: 'open', priority: 'low' },
  { title: 'App crashes on file upload', description: 'Uploading a PDF larger than 10MB crashes the mobile app on Android 14.', customerName: 'Luis Romero', customerEmail: 'luis.r@example.com', status: 'in_progress', priority: 'high' },
  { title: 'Cannot cancel subscription', description: 'The cancel button in account settings is greyed out for annual plans.', customerName: 'Emma Wilson', customerEmail: 'emma.w@example.com', status: 'open', priority: 'medium' },
  { title: 'Dark mode resets after logout', description: 'Theme preference is not persisted between sessions.', customerName: 'Noah Fischer', customerEmail: 'noah.f@example.com', status: 'resolved', priority: 'low' },
  { title: 'Two-factor codes rejected', description: 'TOTP codes from the authenticator app are rejected even when the clock is synced.', customerName: 'Priya Patel', customerEmail: 'priya@example.com', status: 'resolved', priority: 'high' },
  { title: 'Export to CSV missing columns', description: 'The exported report is missing the "created date" and "owner" columns.', customerName: 'Oliver Grant', customerEmail: 'oliver.g@example.com', status: 'open', priority: 'low' },
] as const;

async function seed() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ticket-sys');
  // WHY deleteMany first: makes the seed idempotent — running it twice gives
  // a clean known state instead of duplicated tickets.
  await Ticket.deleteMany({});
  await Ticket.insertMany(tickets);

  // Demo agent account — agents are provisioned here, not via signup (see
  // User model). These are DEMO credentials, documented in the README; the
  // stored value is a bcrypt hash, never the password itself.
  // WHY cost factor 10: ~100ms per hash — slow enough to hurt brute-forcing,
  // fast enough not to hurt login UX.
  await User.deleteMany({});
  await User.create({
    email: 'agent@example.com',
    name: 'Demo Agent',
    passwordHash: await bcrypt.hash('agent123', 10),
  });

  console.log(`Seeded ${tickets.length} tickets + demo agent (agent@example.com / agent123)`);
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
