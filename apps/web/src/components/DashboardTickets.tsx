"use client";

import React, { useState, useMemo, useEffect } from "react";
import type {
  Ticket,
  TicketStatus,
  TicketCategory,
} from "@nixo-slackbot/shared";
import { TicketCard } from "./TicketCard";
import { TicketCardTall } from "./TicketCardTall";
import { CustomSelect, type SelectOption } from "./CustomSelect";

type DateFilter = "all" | "7d" | "30d" | "90d";
type CategoryFilter = TicketCategory | "all";
type PriorityFilter = "low" | "medium" | "high" | "critical" | "all";
type StatusFilter = TicketStatus | "all";

interface DashboardTicketsProps {
  tickets: Ticket[];
  loading?: boolean;
  onDeleteTicket: (ticketId: string) => void;
  /** "tall" for Tickets tab: taller cards with Reported by, Messages, reporter icon */
  cardVariant?: "default" | "tall";
  /** Override section title (e.g. "Tickets" on the Tickets tab) */
  title?: string;
}

export function DashboardTickets({
  tickets,
  loading = false,
  onDeleteTicket,
  cardVariant = "default",
  title: titleProp,
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
      result = result.filter((t) => new Date(t.updated_at).getTime() >= cutoff);
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

  // Dynamic title from applied filters (status first, then category, then priority)
  const titleLabel = useMemo(() => {
    const parts: string[] = [];
    if (statusFilter !== "all") {
      parts.push(statusFilter === "open" ? "Open" : "Resolved");
    }
    if (categoryFilter !== "all") {
      const label =
        categoryFilter === "bug_report"
          ? "Bug Report"
          : categoryFilter === "support_question"
          ? "Support Question"
          : categoryFilter === "feature_request"
          ? "Feature Request"
          : categoryFilter === "product_question"
          ? "Product Question"
          : categoryFilter;
      parts.push(label);
    }
    if (priorityFilter !== "all") {
      parts.push(
        priorityFilter.charAt(0).toUpperCase() + priorityFilter.slice(1)
      );
    }
    const base = parts.length ? parts.join(" ") + " Tickets" : "All Tickets";
    const dateSuffix =
      dateFilter !== "all"
        ? dateFilter === "7d"
          ? " (Last 7 days)"
          : dateFilter === "30d"
          ? " (Last 30 days)"
          : " (Last 90 days)"
        : "";
    const searchSuffix =
      search.trim() !== "" ? ` matching "${search.trim()}"` : "";
    return `${base}${dateSuffix}${searchSuffix}`;
  }, [categoryFilter, statusFilter, priorityFilter, dateFilter, search]);

  const sectionTitle = titleProp ?? titleLabel;

  // Options for custom dropdowns
  const dateOptions: SelectOption[] = [
    { value: "all", label: "All time" },
    { value: "7d", label: "Last 7 days" },
    { value: "30d", label: "Last 30 days" },
    { value: "90d", label: "Last 90 days" },
  ];

  const categoryOptions: SelectOption[] = [
    { value: "all", label: "All categories" },
    { value: "bug_report", label: "Bug report" },
    { value: "support_question", label: "Support question" },
    { value: "feature_request", label: "Feature request" },
    { value: "product_question", label: "Product question" },
  ];

  const priorityOptions: SelectOption[] = [
    { value: "all", label: "All priorities" },
    { value: "critical", label: "Critical" },
    { value: "high", label: "High" },
    { value: "medium", label: "Medium" },
    { value: "low", label: "Low" },
  ];

  const statusOptions: SelectOption[] = [
    { value: "all", label: "All statuses" },
    { value: "open", label: "Open" },
    { value: "resolved", label: "Resolved" },
  ];

  return (
    <div>
      {/* Section title (dynamic from filters or override e.g. "Tickets") */}
      <h2
        style={{
          fontSize: "16px",
          fontWeight: 600,
          color: "#1d1c1d",
          margin: "0 0 16px 0",
        }}
      >
        {sectionTitle}
      </h2>

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

      {/* Filters section - fixed size, dropdowns overlay on top via portal */}
      <div
        style={{
          overflow: "hidden",
          transition:
            "max-height 0.3s ease, opacity 0.25s ease, margin 0.3s ease",
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
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              flex: 1,
              minWidth: "140px",
            }}
          >
            <label
              style={{ fontSize: "12px", fontWeight: 600, color: "#616061" }}
            >
              Date
            </label>
            <CustomSelect
              value={dateFilter}
              options={dateOptions}
              onChange={(val) => setDateFilter(val as DateFilter)}
            />
          </div>

          {/* Category filter */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              flex: 1,
              minWidth: "140px",
            }}
          >
            <label
              style={{ fontSize: "12px", fontWeight: 600, color: "#616061" }}
            >
              Category
            </label>
            <CustomSelect
              value={categoryFilter}
              options={categoryOptions}
              onChange={(val) => setCategoryFilter(val as CategoryFilter)}
            />
          </div>

          {/* Priority filter */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              flex: 1,
              minWidth: "140px",
            }}
          >
            <label
              style={{ fontSize: "12px", fontWeight: 600, color: "#616061" }}
            >
              Priority
            </label>
            <CustomSelect
              value={priorityFilter}
              options={priorityOptions}
              onChange={(val) => setPriorityFilter(val as PriorityFilter)}
            />
          </div>

          {/* Status filter */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              flex: 1,
              minWidth: "140px",
            }}
          >
            <label
              style={{ fontSize: "12px", fontWeight: 600, color: "#616061" }}
            >
              Status
            </label>
            <CustomSelect
              value={statusFilter}
              options={statusOptions}
              onChange={(val) => setStatusFilter(val as StatusFilter)}
            />
          </div>
        </div>
      </div>

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
          {sortedTickets.map((ticket) =>
            cardVariant === "tall" ? (
              <TicketCardTall
                key={ticket.id}
                ticket={ticket}
                messageCount={
                  (ticket as Ticket & { message_count?: number })
                    .message_count ?? 0
                }
                onDelete={onDeleteTicket}
              />
            ) : (
              <TicketCard
                key={ticket.id}
                ticket={ticket}
                onDelete={onDeleteTicket}
              />
            )
          )}
        </div>
      )}
    </div>
  );
}
