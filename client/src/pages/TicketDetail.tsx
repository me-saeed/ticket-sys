import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchTicket } from '../api';
import { PriorityBadge } from '../components/Badge';
import { StatusSelect } from '../components/StatusSelect';
import { useTicketSocket } from '../useTicketSocket';
import type { Ticket } from '../types';

export function TicketDetail() {
  const { id } = useParams<{ id: string }>();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    fetchTicket(id)
      .then(setTicket)
      // WHY surface the server's message: a 404 reads "Ticket not found"
      // instead of a generic failure — clearer for the user.
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'));
  }, [id]);

  useTicketSocket({
    onUpdated: (incoming) => {
      if (incoming.id !== id) return;
      setTicket((current) => {
        if (current && incoming.version <= current.version) return current;
        return incoming;
      });
    },
  });

  if (error)
    return (
      <p className="error" role="alert">
        {error} — <Link to="/">back to list</Link>
      </p>
    );
  if (!ticket) return <p className="muted">Loading ticket…</p>;

  return (
    <article className="detail card">
      <Link to="/" className="muted">← All tickets</Link>
      <header className="detail-header">
        <h2>{ticket.title}</h2>
        <PriorityBadge priority={ticket.priority} />
      </header>

      {/* WHY setTicket as the update callback: the page re-renders from the
          persisted server response, proving the save actually happened. */}
      <StatusSelect ticket={ticket} onUpdated={setTicket} />

      <p className="description">{ticket.description}</p>

      <dl className="meta">
        <dt>Customer</dt>
        <dd>{ticket.customerName}</dd>
        <dt>Email</dt>
        <dd><a href={`mailto:${ticket.customerEmail}`}>{ticket.customerEmail}</a></dd>
        <dt>Created</dt>
        {/* WHY toLocaleString: shows the visitor their local time, not UTC */}
        <dd>{new Date(ticket.createdAt).toLocaleString()}</dd>
      </dl>
    </article>
  );
}
