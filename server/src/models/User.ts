import { Schema, model, InferSchemaType } from 'mongoose';

// WHY a User model but NO registration endpoint: support agents are
// provisioned by an admin (here: the seed script), they don't self-signup —
// an open registration would let anyone grant themselves agent powers.
const userSchema = new Schema(
  {
    // WHY unique + lowercase: email is the login identifier; normalizing case
    // prevents "Agent@x.com" and "agent@x.com" becoming two accounts.
    email: { type: String, required: true, unique: true, trim: true, lowercase: true, maxlength: 254 },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    // WHY only the hash is ever stored: the plain password must not exist
    // anywhere after signup — a DB leak then leaks nothing directly usable.
    passwordHash: { type: String, required: true },
    // WHY a role field with one value today: costs nothing now, and adding
    // "admin" later is a data change, not a schema migration.
    role: { type: String, enum: ['agent'], default: 'agent' },
  },
  { timestamps: true }
);

export type UserDoc = InferSchemaType<typeof userSchema>;
export const User = model('User', userSchema);
