import { Link } from 'react-router-dom';
import { PriorityBadge } from './Badge';
import type { Ticket } from '../types';

export function KanbanCard({
  ticket,
  canDrag,
  saving,
  onLoginRequired,
}: {
  ticket: Ticket;
  canDrag: boolean;
  saving: boolean;
  onLoginRequired: () => void;
}) {
  return (
    <li
      className={`kanban-card card${saving ? ' saving' : ''}${canDrag ? '' : ' locked'}`}
      draggable={!saving}
      onDragStart={(e) => {
        if (!canDrag) {
          e.preventDefault();
          onLoginRequired();
          return;
        }
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
