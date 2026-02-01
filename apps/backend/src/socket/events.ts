import { Server } from 'socket.io';

let ioInstance: Server | null = null;

export function initializeSocketIO(io: Server) {
  ioInstance = io;
}

export function emitTicketUpdated(ticketId: string) {
  if (ioInstance) {
    ioInstance.emit('ticket_updated', { ticketId });
  }
}
