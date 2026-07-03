import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError, fetchTicket, updateTicketStatus } from '../api';
import { useAuth } from '../auth';
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
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

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
    if (status === ticket.status) return;
    setSaving(true);
    setFeedback(null);
    try {
      // WHY update state from the server response (not optimistically): the
      // UI then always reflects what was actually persisted — the core
      // requirement — at the cost of a brief disabled select while saving.
      const updated = await updateTicketStatus(ticket.id, status, ticket.version);
      onUpdated(updated);
      setFeedback({ ok: true, text: 'Saved' });
    } catch (err) {
      // WHY refetch on 409: someone else changed this ticket meanwhile. The
      // kindest recovery is showing them the current truth immediately, not
      // just an error — they can then re-decide with fresh information.
      if (err instanceof ApiError && err.status === 409) {
        const fresh = await fetchTicket(ticket.id).catch(() => null);
        if (fresh) onUpdated(fresh);
        setFeedback({ ok: false, text: 'Changed by someone else — refreshed' });
      } else {
        setFeedback({ ok: false, text: err instanceof Error ? err.message : 'Update failed' });
      }
    } finally {
      setSaving(false);
      // WHY auto-clear: transient feedback shouldn't clutter the row forever.
      setTimeout(() => setFeedback(null), 2500);
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
      {feedback && (
        <small className={feedback.ok ? 'ok' : 'error'} role="status">
          {feedback.text}
        </small>
      )}
    </span>
  );
}
