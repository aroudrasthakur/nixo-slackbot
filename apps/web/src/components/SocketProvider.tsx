"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { getSocket, disconnectSocket } from "@/lib/socket";
import type { Socket } from "socket.io-client";

interface SocketContextValue {
  socket: Socket | null;
  onTicketUpdated: (callback: (ticketId: string) => void) => () => void;
  onConnect: (callback: () => void) => () => void;
}

const SocketContext = createContext<SocketContextValue | null>(null);

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const sock = getSocket();
    setSocket(sock);

    return () => {
      disconnectSocket();
    };
  }, []);

  const onTicketUpdated = useCallback(
    (callback: (ticketId: string) => void) => {
      if (!socket) {
        return () => {};
      }

      socket.on("ticket_updated", (data: { ticketId: string }) => {
        callback(data.ticketId);
      });

      return () => {
        socket.off("ticket_updated");
      };
    },
    [socket]
  );

  const onConnect = useCallback(
    (callback: () => void) => {
      if (!socket) {
        return () => {};
      }

      socket.on("connect", callback);

      return () => {
        socket.off("connect", callback);
      };
    },
    [socket]
  );

  return (
    <SocketContext.Provider value={{ socket, onTicketUpdated, onConnect }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error("useSocket must be used within SocketProvider");
  }
  return context;
}
