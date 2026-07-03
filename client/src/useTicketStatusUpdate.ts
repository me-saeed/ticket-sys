import { useCallback, useState } from 'react';
import { ApiError, fetchTicket, updateTicketStatus } from './api';
import type { Status, Ticket } from './types';

// WHY shared hook: list select and Kanban drag both PATCH status with the same
// 409 recovery — one place keeps the behavior identical.
export function useTicketStatusUpdate(onUpdated: (ticket: Ticket) => void) {
  const [savingId, setSavingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ ticketId: string; ok: boolean; text: string } | null>(
    null,
  );

  const saveStatus = useCallback(
    async (ticket: Ticket, status: Status) => {
      if (status === ticket.status) return ticket;
      setSavingId(ticket.id);
      setFeedback(null);
      try {
        const updated = await updateTicketStatus(ticket.id, status, ticket.version);
        onUpdated(updated);
        setFeedback({ ticketId: ticket.id, ok: true, text: 'Saved' });
        return updated;
      } catch (err) {
        if (err instanceof ApiError && err.status === 409) {
          const fresh = await fetchTicket(ticket.id).catch(() => null);
          if (fresh) onUpdated(fresh);
          setFeedback({
            ticketId: ticket.id,
            ok: false,
            text: 'Changed by someone else — refreshed',
          });
          return fresh;
        }
        const message = err instanceof Error ? err.message : 'Update failed';
        setFeedback({ ticketId: ticket.id, ok: false, text: message });
        throw err;
      } finally {
        setSavingId(null);
        setTimeout(
          () => setFeedback((f) => (f?.ticketId === ticket.id ? null : f)),
          2500,
        );
      }
    },
    [onUpdated],
  );

  return { saveStatus, savingId, feedback };
}
