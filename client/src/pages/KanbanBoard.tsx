import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchTickets } from '../api';
import { KanbanColumn } from '../components/KanbanColumn';
import { useAuth } from '../auth';
import { useTicketSocket } from '../useTicketSocket';
import { useTicketStatusUpdate } from '../useTicketStatusUpdate';
import type { Status, Ticket } from '../types';
import { PRIORITIES, PRIORITY_LABELS, STATUSES, STATUS_LABELS } from '../types';

function matchesBoardFilters(ticket: Ticket, priority: string, q: string) {
  if (priority && ticket.priority !== priority) return false;
  if (q.trim()) {
    const term = q.trim().toLowerCase();
    if (
      !ticket.title.toLowerCase().includes(term) &&
      !ticket.customerName.toLowerCase().includes(term)
    ) {
      return false;
    }
  }
  return true;
}

export function KanbanBoard() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [priority, setPriority] = useState('');
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [loginPrompt, setLoginPrompt] = useState(false);

  const showLoginPrompt = useCallback(() => setLoginPrompt(true), []);

  useEffect(() => {
    if (user) setLoginPrompt(false);
  }, [user]);

  const handleUpdated = useCallback((updated: Ticket) => {
    setTickets((prev) => prev?.map((t) => (t.id === updated.id ? updated : t)) ?? prev);
  }, []);

  const { saveStatus, savingId, feedback } = useTicketStatusUpdate(handleUpdated);

  useEffect(() => {
    const t = setTimeout(() => setQ(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    setTickets(null);
    setError(null);
    fetchTickets({ priority, q })
      .then((res) => !cancelled && setTickets(res.tickets))
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : 'Failed to load'));
    return () => {
      cancelled = true;
    };
  }, [priority, q]);

  useTicketSocket({
    onCreated: (incoming) => {
      if (!matchesBoardFilters(incoming, priority, q)) return;
      setTickets((prev) => {
        if (!prev || prev.some((t) => t.id === incoming.id)) return prev;
        return [incoming, ...prev];
      });
    },
    onUpdated: (incoming) => {
      setTickets((prev) => {
        if (!prev) return prev;
        const current = prev.find((t) => t.id === incoming.id);
        if (!current || incoming.version <= current.version) return prev;
        if (!matchesBoardFilters(incoming, priority, q)) {
          return prev.filter((t) => t.id !== incoming.id);
        }
        return prev.map((t) => (t.id === incoming.id ? incoming : t));
      });
    },
  });

  async function handleDrop(ticketId: string, newStatus: Status) {
    if (!user) {
      showLoginPrompt();
      return;
    }
    const ticket = tickets?.find((t) => t.id === ticketId);
    if (!ticket || ticket.status === newStatus) return;
    try {
      await saveStatus(ticket, newStatus);
    } catch {
      // feedback surfaced via hook
    }
  }

  const byStatus = Object.fromEntries(
    STATUSES.map((s) => [s, tickets?.filter((t) => t.status === s) ?? []]),
  ) as Record<Status, Ticket[]>;

  return (
    <div className="board-layout">
      <div className="toolbar">
        <input
          type="search"
          className="search"
          placeholder="Search title or customer…"
          aria-label="Search tickets"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          aria-label="Filter by priority"
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
        >
          <option value="">All priorities</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABELS[p]}
            </option>
          ))}
        </select>
        <Link to="/new" className="btn">
          + New Ticket
        </Link>
      </div>

      {!user && (
        <div className="board-login-callout">
          <p>
            <strong>View only.</strong> Sign in as an agent to drag tickets between columns and
            update their status.
          </p>
          <Link to="/login" className="btn btn-sm">
            Sign in to update
          </Link>
        </div>
      )}

      {loginPrompt && !user && (
        <div className="board-login-prompt" role="alert">
          <p>You need to sign in before you can drag and drop tickets.</p>
          <div className="board-login-prompt-actions">
            <Link to="/login" className="btn btn-sm">
              Sign in
            </Link>
            <button type="button" className="link-btn" onClick={() => setLoginPrompt(false)}>
              Dismiss
            </button>
          </div>
        </div>
      )}

      {error && <p className="error" role="alert">{error}</p>}
      {!error && tickets === null && <p className="muted">Loading board…</p>}
      {tickets?.length === 0 && <p className="muted">No tickets match the current filters.</p>}

      {feedback && (
        <p className={feedback.ok ? 'ok' : 'error'} role="status">
          {feedback.text}
        </p>
      )}

      {tickets && tickets.length > 0 && (
        <div className="kanban">
          {STATUSES.map((status) => (
            <KanbanColumn
              key={status}
              status={status}
              label={STATUS_LABELS[status]}
              tickets={byStatus[status]}
              canDrag={!!user}
              savingId={savingId}
              onDrop={handleDrop}
              onLoginRequired={showLoginPrompt}
            />
          ))}
        </div>
      )}
    </div>
  );
}
