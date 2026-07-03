import { useState } from 'react';
import { KanbanCard } from './KanbanCard';
import type { Status, Ticket } from '../types';

export function KanbanColumn({
  status,
  label,
  tickets,
  canDrag,
  savingId,
  onDrop,
}: {
  status: Status;
  label: string;
  tickets: Ticket[];
  canDrag: boolean;
  savingId: string | null;
  onDrop: (ticketId: string, status: Status) => void;
}) {
  const [dragOver, setDragOver] = useState(false);

  return (
    <section
      className={`kanban-column${dragOver ? ' drag-over' : ''}`}
      aria-label={`${label} tickets`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const ticketId = e.dataTransfer.getData('text/ticket-id');
        if (ticketId) onDrop(ticketId, status);
      }}
    >
      <h2 className="kanban-column-title">
        {label} <span className="muted">({tickets.length})</span>
      </h2>
      <ul className="kanban-cards">
        {tickets.map((t) => (
          <KanbanCard
            key={t.id}
            ticket={t}
            draggable={canDrag}
            saving={savingId === t.id}
          />
        ))}
      </ul>
    </section>
  );
}
