import type { AuthUser, NewTicket, Status, Ticket, TicketListResponse } from './types';

// --- Auth session storage ---
// WHY localStorage: survives refreshes with zero backend session state, which
// keeps the API stateless (and horizontally scalable). Trade-off, documented
// in the README: an XSS could read it — the hardened alternative is an
// httpOnly cookie plus CSRF protection. With no third-party scripts on this
// app, localStorage is a reasonable, honest middle ground for this scope.
const SESSION_KEY = 'ticket-sys.session';

export interface AuthSession {
  token: string;
  user: AuthUser;
}

export function loadSession(): AuthSession | null {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null');
  } catch {
    return null; // corrupt storage should mean "signed out", never a crash
  }
}

export function saveSession(session: AuthSession | null) {
  if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  else localStorage.removeItem(SESSION_KEY);
}

// WHY a tiny typed fetch wrapper instead of axios/react-query: three endpoints
// don't justify extra dependencies. One place handles JSON, errors and types —
// every caller gets a typed result or a thrown ApiError.

// WHY a custom error carrying `details`: the server returns per-field
// validation messages; the form uses them to show inline errors.
export class ApiError extends Error {
  status: number;
  details?: Record<string, string>;
  constructor(message: string, status: number, details?: Record<string, string>) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  // WHY attach the token here, in one place: every caller is automatically
  // authenticated when a session exists — no route can forget the header.
  const token = loadSession()?.token;
  const headers: Record<string, string> = {};
  if (init?.body) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(url, { headers, ...init });
  } catch {
    // WHY: fetch only rejects on network failure — translate it into the same
    // error shape the UI already knows how to display.
    throw new ApiError('Network error — is the server running?', 0);
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(body?.error ?? `Request failed (${res.status})`, res.status, body?.details);
  }
  return body as T;
}

export function fetchTickets(filters: { status?: string; priority?: string; q?: string }) {
  // WHY URLSearchParams: safe encoding for free; empty filters are skipped so
  // the URL stays clean and the server sees no bogus params.
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.priority) params.set('priority', filters.priority);
  if (filters.q?.trim()) params.set('q', filters.q.trim());
  const qs = params.toString();
  return request<TicketListResponse>(`/api/tickets${qs ? `?${qs}` : ''}`);
}

export function login(email: string, password: string) {
  return request<AuthSession>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function fetchTicket(id: string) {
  return request<Ticket>(`/api/tickets/${id}`);
}

export function createTicket(data: NewTicket) {
  return request<Ticket>('/api/tickets', { method: 'POST', body: JSON.stringify(data) });
}

export function updateTicketStatus(id: string, status: Status, expectedVersion: number) {
  // WHY expectedVersion: tells the server which version of the ticket this
  // change was based on — a stale one gets a 409 instead of overwriting
  // another agent's edit (optimistic concurrency control).
  return request<Ticket>(`/api/tickets/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status, expectedVersion }),
  });
}
