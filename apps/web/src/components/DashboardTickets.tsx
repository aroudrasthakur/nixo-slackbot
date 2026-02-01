"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import type { Ticket } from "@nixo-slackbot/shared";
import { TicketCard } from "./TicketCard";
import { useSocket } from "@/hooks/useSocket";

interface DashboardTicketsProps {
  initialTickets: Ticket[];
}

export function DashboardTickets({ initialTickets }: DashboardTicketsProps) {
  const [tickets, setTickets] = useState<Ticket[]>(initialTickets);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { onTicketUpdated } = useSocket();

  const fetchTickets = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/tickets");
      if (response.ok) {
        const allTickets = await response.json();
        setTickets(Array.isArray(allTickets) ? allTickets : []);
      } else {
        setError("Failed to refresh tickets");
      }
    } catch (err) {
      console.error("Error refreshing tickets:", err);
      setError("Failed to refresh tickets");
    } finally {
      setLoading(false);
    }
  }, []);

  // Real-time: fetch when socket event fires (backend emits on ticket create/update)
  useEffect(() => {
    const unsubscribe = onTicketUpdated(fetchTickets);
    return unsubscribe;
  }, [onTicketUpdated, fetchTickets]);

  // Filter tickets by search
  const filteredTickets = useMemo(() => {
    if (!search) return tickets;

    const searchLower = search.toLowerCase();
    return tickets.filter(
      (t) =>
        t.title.toLowerCase().includes(searchLower) ||
        t.canonical_key?.toLowerCase().includes(searchLower)
    );
  }, [tickets, search]);

  // Sort by updated_at descending
  const sortedTickets = useMemo(() => {
    return [...filteredTickets].sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );
  }, [filteredTickets]);

  return (
    <div>
      {/* Search bar */}
      <div style={{ marginBottom: "24px" }}>
        <div style={{ position: "relative", maxWidth: "400px" }}>
          <div
            style={{
              position: "absolute",
              left: "14px",
              top: "50%",
              transform: "translateY(-50%)",
              pointerEvents: "none",
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#868686"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search tickets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%",
              padding: "12px 14px 12px 42px",
              backgroundColor: "#f8f8f8",
              border: "1px solid #dddddd",
              borderRadius: "8px",
              fontSize: "14px",
              color: "#1d1c1d",
              outline: "none",
              transition: "all 0.15s ease",
            }}
            onFocus={(e) => {
              e.target.style.backgroundColor = "#ffffff";
              e.target.style.borderColor = "#1264a3";
              e.target.style.boxShadow = "0 0 0 3px rgba(18, 100, 163, 0.1)";
            }}
            onBlur={(e) => {
              e.target.style.backgroundColor = "#f8f8f8";
              e.target.style.borderColor = "#dddddd";
              e.target.style.boxShadow = "none";
            }}
          />
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div
          style={{
            marginBottom: "16px",
            padding: "12px 16px",
            backgroundColor: "#fef0f0",
            border: "1px solid #e01e5a",
            borderRadius: "6px",
            fontSize: "14px",
            color: "#e01e5a",
          }}
        >
          {error}
        </div>
      )}

      {/* Loading indicator */}
      {loading && (
        <div style={{ marginBottom: "16px", color: "#616061", fontSize: "14px" }}>
          Loading...
        </div>
      )}

      {/* Tickets grid */}
      {sortedTickets.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 0" }}>
          <p style={{ color: "#616061", fontSize: "14px", margin: 0 }}>
            No tickets found.
          </p>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: "16px",
          }}
        >
          {sortedTickets.map((ticket) => (
            <TicketCard key={ticket.id} ticket={ticket} />
          ))}
        </div>
      )}
    </div>
  );
}
