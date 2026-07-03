import { Link } from 'react-router-dom';
import { useAuth } from '../auth';
import { useTicketStatusUpdate } from '../useTicketStatusUpdate';
import { StatusBadge } from './Badge';
import type { Status, Ticket } from '../types';
import { STATUSES, STATUS_LABELS } from '../types';

// WHY one self-contained control: the spec requires status changes from the
// list AND/OR the detail page — encapsulating the PATCH call, the saving
// state and the success/error feedback here lets both places reuse it.
export function StatusSelect({
  ticket,
  onUpdated,
}: {
  ticket: Ticket;
  onUpdated: (t: Ticket) => void;
}) {
  const { user } = useAuth();
  const { saveStatus, savingId, feedback } = useTicketStatusUpdate(onUpdated);
  const saving = savingId === ticket.id;
  const cardFeedback = feedback?.ticketId === ticket.id ? feedback : null;

  // WHY hide the control instead of letting a 401 bounce: showing an editable
  // select to someone who can't save is a broken promise — visitors see the
  // status as a badge and a clear path to gaining the permission.
  if (!user) {
    return (
      <span className="status-select">
        <StatusBadge status={ticket.status} />
        <Link to="/login" className="muted">sign in to update</Link>
      </span>
    );
  }

  async function handleChange(status: Status) {
    try {
      await saveStatus(ticket, status);
    } catch {
      // feedback surfaced via hook
    }
  }

  return (
    <span className="status-select">
      <select
        aria-label="Ticket status"
        value={ticket.status}
        disabled={saving}
        onChange={(e) => handleChange(e.target.value as Status)}
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABELS[s]}
          </option>
        ))}
      </select>
      {saving && <small className="muted">Saving…</small>}
      {cardFeedback && (
        <small className={cardFeedback.ok ? 'ok' : 'error'} role="status">
          {cardFeedback.text}
        </small>
      )}
    </span>
  );
}
