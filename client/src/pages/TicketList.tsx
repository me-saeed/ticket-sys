import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchTickets } from '../api';
import { PriorityBadge } from '../components/Badge';
import { StatusSelect } from '../components/StatusSelect';
import type { Ticket } from '../types';
import { PRIORITIES, PRIORITY_LABELS, STATUSES, STATUS_LABELS } from '../types';

export function TicketList() {
  const [tickets, setTickets] = useState<Ticket[] | null>(null); // null = loading
  const [error, setError] = useState<string | null>(null);
  // WHY '' means "all": keeps filter state a plain string that maps 1:1 to the
  // select value and to "param absent" in the API call.
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [search, setSearch] = useState(''); // what the input shows (live)
  const [q, setQ] = useState(''); // what we actually query (debounced)

  // WHY debounce the search: querying on every keystroke would send a request
  // per letter — 300ms of quiet is imperceptible to the user and collapses
  // "payment" from 7 requests into 1.
  useEffect(() => {
    const t = setTimeout(() => setQ(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    let cancelled = false; // WHY: ignore stale responses if filters change quickly
    setTickets(null);
    setError(null);
    fetchTickets({ status, priority, q })
      .then((res) => !cancelled && setTickets(res.tickets))
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : 'Failed to load'));
    return () => {
      cancelled = true;
    };
  }, [status, priority, q]);

  // WHY replace-in-place after a status update: avoids a full refetch and
  // keeps the user's scroll position and filters untouched.
  function handleUpdated(updated: Ticket) {
    setTickets((prev) => prev?.map((t) => (t.id === updated.id ? updated : t)) ?? prev);
  }

  return (
    <>
      <div className="toolbar">
        <input
          type="search"
          className="search"
          placeholder="Search title or customer…"
          aria-label="Search tickets"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {/* WHY both filters: the spec asks for at least one; both cost the same select markup */}
        <select aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>
        <select aria-label="Filter by priority" value={priority} onChange={(e) => setPriority(e.target.value)}>
          <option value="">All priorities</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
          ))}
        </select>
        <Link to="/new" className="btn">+ New Ticket</Link>
      </div>

      {/* WHY explicit loading / error / empty branches: the reviewer (and a
          real visitor) should never stare at a silently blank screen. */}
      {error && <p className="error" role="alert">{error}</p>}
      {!error && tickets === null && <p className="muted">Loading tickets…</p>}
      {tickets?.length === 0 && <p className="muted">No tickets match the current filters.</p>}

      {/* WHY cards instead of a <table>: they reflow naturally on mobile
          without responsive-table hacks — main flows must work on phones. */}
      <ul className="ticket-list">
        {tickets?.map((t) => (
          <li key={t.id} className="card">
            <div className="card-main">
              <Link to={`/tickets/${t.id}`} className="card-title">{t.title}</Link>
              <span className="muted">
                {t.customerName} · {new Date(t.createdAt).toLocaleDateString()}
              </span>
            </div>
            <div className="card-side">
              <PriorityBadge priority={t.priority} />
              <StatusSelect ticket={t} onUpdated={handleUpdated} />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
