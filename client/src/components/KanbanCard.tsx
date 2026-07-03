import { Link } from 'react-router-dom';
import { PriorityBadge } from './Badge';
import type { Ticket } from '../types';

export function KanbanCard({
  ticket,
  draggable,
  saving,
}: {
  ticket: Ticket;
  draggable: boolean;
  saving: boolean;
}) {
  return (
    <li
      className={`kanban-card card${saving ? ' saving' : ''}`}
      draggable={draggable && !saving}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/ticket-id', ticket.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
    >
      <Link to={`/tickets/${ticket.id}`} className="card-title" draggable={false}>
        {ticket.title}
      </Link>
      <span className="muted">{ticket.customerName}</span>
      <PriorityBadge priority={ticket.priority} />
      {saving && <small className="muted">Saving…</small>}
    </li>
  );
}
