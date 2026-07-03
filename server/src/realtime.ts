import type { Server } from 'socket.io';

// WHY a tiny indirection: routes stay REST-first; tests import createApp()
// without binding a port or starting Socket.IO — emit becomes a no-op until
// server.ts wires the real io instance at startup.
let io: Server | null = null;

export function setIo(server: Server) {
  io = server;
}

export function emitTicketCreated(ticket: unknown) {
  io?.emit('ticket:created', { ticket });
}

export function emitTicketUpdated(ticket: unknown) {
  io?.emit('ticket:updated', { ticket });
}
