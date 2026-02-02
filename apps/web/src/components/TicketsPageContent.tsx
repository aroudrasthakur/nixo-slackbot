"use client";

import React, { useState, useEffect, useCallback } from "react";
import type { Ticket } from "@nixo-slackbot/shared";
import { DashboardTickets } from "@/components/DashboardTickets";
import { useSocket } from "@/hooks/useSocket";

interface TicketsPageContentProps {
  initialTickets: Ticket[];
  initialError?: string;
}

export function TicketsPageContent({
  initialTickets,
  initialError,
}: TicketsPageContentProps) {
  const [tickets, setTickets] = useState<Ticket[]>(initialTickets);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [loading, setLoading] = useState(false);
  const { onTicketUpdated, onConnect } = useSocket();

  const fetchTickets = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/tickets");
      if (response.ok) {
        const data = await response.json();
        setTickets(Array.isArray(data) ? data : []);
      } else {
        setError("Failed to load tickets");
      }
    } catch (err) {
      console.error("Failed to fetch tickets:", err);
      setError("Could not reach the server. Is the backend running?");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  useEffect(() => {
    const unsubscribe = onTicketUpdated(fetchTickets);
    return unsubscribe;
  }, [onTicketUpdated, fetchTickets]);

  useEffect(() => {
    const unsubscribe = onConnect(fetchTickets);
    return unsubscribe;
  }, [onConnect, fetchTickets]);

  const handleDeleteTicket = useCallback(
    (ticketId: string) => {
      setTickets((prev) => prev.filter((t) => t.id !== ticketId));
      fetchTickets();
    },
    [fetchTickets]
  );

  return (
    <>
      {error && (
        <div
          style={{
            padding: "16px 20px",
            marginBottom: "24px",
            backgroundColor: "#fef0f0",
            border: "1px solid #e01e5a",
            borderRadius: "8px",
            color: "#e01e5a",
            fontSize: "14px",
          }}
        >
          {error} Ensure the backend is running on the URL in{" "}
          <code style={{ fontSize: "12px" }}>NEXT_PUBLIC_API_URL</code> and try
          again.
        </div>
      )}

      <DashboardTickets
        tickets={tickets}
        loading={loading}
        onDeleteTicket={handleDeleteTicket}
        cardVariant="tall"
      />
    </>
  );
}
