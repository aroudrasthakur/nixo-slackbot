"use client";

import React, { useState, useEffect, useMemo } from "react";
import type { Ticket } from "@nixo-slackbot/shared";
import { TicketCard } from "./TicketCard";
import { Filters } from "./Filters";
import { useSocket } from "@/hooks/useSocket";
import type { TicketCategory } from "@nixo-slackbot/shared";

interface TicketListProps {
  initialTickets: Ticket[];
}

export function TicketList({ initialTickets }: TicketListProps) {
  const [tickets, setTickets] = useState<Ticket[]>(initialTickets);
  const [category, setCategory] = useState<TicketCategory | "all">("all");
  const [search, setSearch] = useState("");
  const { onTicketUpdated } = useSocket();

  // Fetch updated ticket when socket event fires
  useEffect(() => {
    const unsubscribe = onTicketUpdated(async (ticketId) => {
      try {
        const apiUrl =
          process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
        const response = await fetch(`${apiUrl}/api/tickets/${ticketId}`);
        if (response.ok) {
          const updatedTicketWithMessages = await response.json();
          // Extract just the ticket part (without messages) for the list
          const { messages, ...updatedTicket } = updatedTicketWithMessages;
          setTickets((prev) => {
            const filtered = prev.filter((t) => t.id !== ticketId);
            return [updatedTicket, ...filtered].sort(
              (a, b) =>
                new Date(b.updated_at).getTime() -
                new Date(a.updated_at).getTime()
            );
          });
        } else {
          // Refresh entire list if specific ticket fetch fails
          const refreshResponse = await fetch(`${apiUrl}/api/tickets`);
          if (refreshResponse.ok) {
            const allTickets = await refreshResponse.json();
            setTickets(allTickets);
          }
        }
      } catch (error) {
        console.error("Error fetching updated ticket:", error);
        // On error, refresh entire list
        try {
          const apiUrl =
            process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
          const refreshResponse = await fetch(`${apiUrl}/api/tickets`);
          if (refreshResponse.ok) {
            const allTickets = await refreshResponse.json();
            setTickets(allTickets);
          }
        } catch (refreshError) {
          console.error("Error refreshing tickets:", refreshError);
        }
      }
    });

    return unsubscribe;
  }, [onTicketUpdated]);

  // Filter tickets
  const filteredTickets = useMemo(() => {
    let filtered = tickets;

    if (category !== "all") {
      filtered = filtered.filter((t) => t.category === category);
    }

    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.title.toLowerCase().includes(searchLower) ||
          t.canonical_key?.toLowerCase().includes(searchLower)
      );
    }

    return filtered;
  }, [tickets, category, search]);

  return (
    <div>
      <Filters
        category={category}
        search={search}
        onCategoryChange={setCategory}
        onSearchChange={setSearch}
      />
      <div className="space-y-4">
        {filteredTickets.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No tickets found.</p>
        ) : (
          filteredTickets.map((ticket) => (
            <TicketCard key={ticket.id} ticket={ticket} />
          ))
        )}
      </div>
    </div>
  );
}
