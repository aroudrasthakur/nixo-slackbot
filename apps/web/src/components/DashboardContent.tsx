"use client";

import React, { useState, useEffect, useCallback } from "react";
import type { Ticket } from "@nixo-slackbot/shared";
import { StatsCards } from "@/components/StatsCards";
import { DashboardTickets } from "@/components/DashboardTickets";
import { useSocket } from "@/hooks/useSocket";

interface DashboardContentProps {
  initialTickets: Ticket[];
  initialError?: string;
}

export function DashboardContent({
  initialTickets,
  initialError,
}: DashboardContentProps) {
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

  // Refetch tickets and metrics every time the dashboard is shown (mount / navigation to /dashboard)
  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  // Refetch when a ticket is created or updated (socket event from backend)
  useEffect(() => {
    const unsubscribe = onTicketUpdated(fetchTickets);
    return unsubscribe;
  }, [onTicketUpdated, fetchTickets]);

  // Refetch when socket connects/reconnects so we don't miss updates that happened while disconnected
  useEffect(() => {
    const unsubscribe = onConnect(fetchTickets);
    return unsubscribe;
  }, [onConnect, fetchTickets]);

  // Refetch after delete so stats and list stay in sync
  const handleDeleteTicket = useCallback(
    (ticketId: string) => {
      setTickets((prev) => prev.filter((t) => t.id !== ticketId));
      fetchTickets();
    },
    [fetchTickets]
  );

  return (
    <>
      {/* Connection error */}
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

      {/* Stats Cards – always use current tickets so metrics update on create/delete */}
      <StatsCards tickets={tickets} />

      {/* Section Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "16px",
        }}
      >
        <h2
          style={{
            fontSize: "16px",
            fontWeight: 600,
            color: "#1d1c1d",
            margin: 0,
          }}
        >
          All Tickets
        </h2>
      </div>

      {/* Tickets list – refetches update both stats above and this list */}
      <DashboardTickets
        tickets={tickets}
        loading={loading}
        onDeleteTicket={handleDeleteTicket}
      />
    </>
  );
}
