"use client";

import React, { useState, useMemo } from "react";
import type { Ticket, TicketStatus, TicketCategory } from "@nixo-slackbot/shared";
import { TicketCard } from "./TicketCard";

type DateFilter = "all" | "7d" | "30d" | "90d";
type CategoryFilter = TicketCategory | "all";
type PriorityFilter = "low" | "medium" | "high" | "critical" | "all";
type StatusFilter = TicketStatus | "all";

interface DashboardTicketsProps {
  tickets: Ticket[];
  loading?: boolean;
  onDeleteTicket: (ticketId: string) => void;
}

export function DashboardTickets({
  tickets,
  loading = false,
  onDeleteTicket,
}: DashboardTicketsProps) {
  const [search, setSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  // Filter tickets by search + date + category + priority + status
  const filteredTickets = useMemo(() => {
    let result = tickets;

    // Search
    if (search.trim()) {
      const searchLower = search.toLowerCase();
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(searchLower) ||
          t.canonical_key?.toLowerCase().includes(searchLower)
      );
    }

    // Date
    if (dateFilter !== "all") {
      const now = Date.now();
      const ms =
        dateFilter === "7d"
          ? 7 * 24 * 60 * 60 * 1000
          : dateFilter === "30d"
          ? 30 * 24 * 60 * 60 * 1000
          : 90 * 24 * 60 * 60 * 1000;
      const cutoff = now - ms;
      result = result.filter(
        (t) => new Date(t.updated_at).getTime() >= cutoff
      );
    }

    // Category
    if (categoryFilter !== "all") {
      result = result.filter((t) => t.category === categoryFilter);
    }

    // Priority
    if (priorityFilter !== "all") {
      result = result.filter(
        (t) => (t.summary?.priority_hint ?? "medium") === priorityFilter
      );
    }

    // Status (open / resolved)
    if (statusFilter !== "all") {
      result = result.filter((t) => t.status === statusFilter);
    }

    return result;
  }, [
    tickets,
    search,
    dateFilter,
    categoryFilter,
    priorityFilter,
    statusFilter,
  ]);

  // Sort by updated_at descending
  const sortedTickets = useMemo(() => {
    return [...filteredTickets].sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );
  }, [filteredTickets]);

  const activeFiltersCount =
    (dateFilter !== "all" ? 1 : 0) +
    (categoryFilter !== "all" ? 1 : 0) +
    (priorityFilter !== "all" ? 1 : 0) +
    (statusFilter !== "all" ? 1 : 0);

  const selectStyle: React.CSSProperties = {
    flex: 1,
    minWidth: "140px",
    padding: "10px 12px",
    border: "1px solid #dddddd",
    borderRadius: "6px",
    fontSize: "14px",
    color: "#1d1c1d",
    backgroundColor: "#fff",
    cursor: "pointer",
  };

  return (
    <div>
      {/* Full-width search bar + Filters toggle */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          marginBottom: filtersOpen ? "0" : "24px",
          width: "100%",
        }}
      >
        <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
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
              boxSizing: "border-box",
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

        {/* Filters toggle button */}
        <button
          type="button"
          onClick={() => setFiltersOpen((o) => !o)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "12px 16px",
            backgroundColor: filtersOpen ? "#e8f4fc" : "#f8f8f8",
            border: "1px solid #dddddd",
            borderRadius: "8px",
            fontSize: "14px",
            fontWeight: 500,
            color: "#1d1c1d",
            cursor: "pointer",
            outline: "none",
            transition: "all 0.15s ease",
            flexShrink: 0,
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              transition: "transform 0.2s ease",
              transform: filtersOpen ? "rotate(180deg)" : "rotate(0deg)",
            }}
          >
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
          </svg>
          Filters
          {activeFiltersCount > 0 && (
            <span
              style={{
                backgroundColor: "#1264a3",
                color: "#ffffff",
                borderRadius: "10px",
                padding: "2px 6px",
                fontSize: "12px",
                fontWeight: 600,
              }}
            >
              {activeFiltersCount}
            </span>
          )}
        </button>
      </div>

      {/* Filters section - full width with smooth animation */}
      <div
        style={{
          overflow: "hidden",
          transition: "max-height 0.3s ease, opacity 0.25s ease, margin 0.3s ease",
          maxHeight: filtersOpen ? "200px" : "0",
          opacity: filtersOpen ? 1 : 0,
          marginBottom: filtersOpen ? "24px" : "0",
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "16px",
            padding: "16px",
            backgroundColor: "#fafafa",
            border: "1px solid #e8e8e8",
            borderRadius: "8px",
            marginTop: "12px",
          }}
        >
          {/* Date filter */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 1, minWidth: "140px" }}>
            <label style={{ fontSize: "12px", fontWeight: 600, color: "#616061" }}>Date</label>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as DateFilter)}
              style={selectStyle}
            >
              <option value="all">All time</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
            </select>
          </div>

          {/* Category filter */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 1, minWidth: "140px" }}>
            <label style={{ fontSize: "12px", fontWeight: 600, color: "#616061" }}>Category</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as CategoryFilter)}
              style={selectStyle}
            >
              <option value="all">All categories</option>
              <option value="bug_report">Bug report</option>
              <option value="support_question">Support question</option>
              <option value="feature_request">Feature request</option>
              <option value="product_question">Product question</option>
            </select>
          </div>

          {/* Priority filter */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 1, minWidth: "140px" }}>
            <label style={{ fontSize: "12px", fontWeight: 600, color: "#616061" }}>Priority</label>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value as PriorityFilter)}
              style={selectStyle}
            >
              <option value="all">All priorities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          {/* Status filter */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 1, minWidth: "140px" }}>
            <label style={{ fontSize: "12px", fontWeight: 600, color: "#616061" }}>Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              style={selectStyle}
            >
              <option value="all">All statuses</option>
              <option value="open">Open</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>
        </div>
      </div>

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
            <TicketCard
              key={ticket.id}
              ticket={ticket}
              onDelete={onDeleteTicket}
            />
          ))}
        </div>
      )}
    </div>
  );
}
