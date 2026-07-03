import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import type { Ticket } from './types';

const SOCKET_BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

interface TicketSocketHandlers {
  onCreated?: (ticket: Ticket) => void;
  onUpdated?: (ticket: Ticket) => void;
}

// WHY one hook: REST still writes; sockets only push notifications so open
// dashboards stay in sync without polling.
export function useTicketSocket(handlers: TicketSocketHandlers) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const socket = io(SOCKET_BASE || undefined, { path: '/socket.io' });

    socket.on('ticket:created', ({ ticket }: { ticket: Ticket }) => {
      handlersRef.current.onCreated?.(ticket);
    });
    socket.on('ticket:updated', ({ ticket }: { ticket: Ticket }) => {
      handlersRef.current.onUpdated?.(ticket);
    });

    return () => {
      socket.disconnect();
    };
  }, []);
}
