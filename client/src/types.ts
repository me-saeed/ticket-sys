// WHY hand-written mirror of the server contract: for a two-package repo,
// duplicating ~15 lines is simpler than a shared workspace package or codegen.
// The trade-off (keeping them in sync manually) is documented in the README.

export const STATUSES = ['open', 'in_progress', 'resolved'] as const;
export const PRIORITIES = ['low', 'medium', 'high'] as const;
export type Status = (typeof STATUSES)[number];
export type Priority = (typeof PRIORITIES)[number];

// WHY human labels live next to the enum: one lookup used by badges, selects
// and filters — the raw values ("in_progress") never leak into the UI.
export const STATUS_LABELS: Record<Status, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
};
export const PRIORITY_LABELS: Record<Priority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

export interface Ticket {
  id: string;
  title: string;
  description: string;
  customerName: string;
  customerEmail: string;
  status: Status;
  priority: Priority;
  createdAt: string; // ISO string over the wire; formatted at render time
  updatedAt: string;
  // WHY version: optimistic-locking token. We echo it back on updates so the
  // server can refuse (409) if someone else changed the ticket in between.
  version: number;
}

export interface TicketListResponse {
  tickets: Ticket[];
  total: number;
  page: number;
  limit: number;
}

// Signed-in agent profile, as returned by POST /api/auth/login.
export interface AuthUser {
  name: string;
  email: string;
  role: string;
}

// Payload for creating a ticket — status is intentionally absent: the server
// always starts tickets as "open".
export type NewTicket = Pick<
  Ticket,
  'title' | 'description' | 'customerName' | 'customerEmail' | 'priority'
>;
