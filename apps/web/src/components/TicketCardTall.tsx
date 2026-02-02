"use client";

import React, { useState, useEffect, useRef } from "react";
import type { Ticket } from "@nixo-slackbot/shared";
import Link from "next/link";

interface TicketCardTallProps {
  ticket: Ticket;
  messageCount?: number;
  onDelete?: (ticketId: string) => void;
}

function getInitials(username: string | null | undefined): string {
  if (!username || !username.trim()) return "?";
  const parts = username.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase().slice(0, 2);
  }
  return username.slice(0, 2).toUpperCase();
}

export function TicketCardTall({
  ticket,
  messageCount = 0,
  onDelete,
}: TicketCardTallProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const categoryColors: Record<string, string> = {
    bug_report: "#e01e5a",
    support_question: "#1264a3",
    feature_request: "#2eb886",
    product_question: "#611f69",
  };

  const priorityConfig: Record<
    string,
    { color: string; bg: string; label: string }
  > = {
    critical: { color: "#ffffff", bg: "#e01e5a", label: "Critical" },
    high: { color: "#b35900", bg: "#fff3cd", label: "High" },
    medium: { color: "#0d6efd", bg: "#cfe2ff", label: "Medium" },
    low: { color: "#616061", bg: "#f0f0f0", label: "Low" },
  };

  const categoryColor = categoryColors[ticket.category] || "#616061";
  const priority = ticket.summary?.priority_hint || "medium";
  const priorityStyle = priorityConfig[priority] || priorityConfig.medium;
  const reporterName = ticket.reporter_username ?? "Unknown";
  const reporterInitials = getInitials(ticket.reporter_username ?? null);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  useEffect(() => {
    if (showDropdown) setDropdownVisible(true);
    else {
      const t = setTimeout(() => setDropdownVisible(false), 150);
      return () => clearTimeout(t);
    }
  }, [showDropdown]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        !isDeleting
      )
        setShowDropdown(false);
    };
    if (showDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showDropdown, isDeleting]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && showDropdown && !isDeleting)
        setShowDropdown(false);
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [showDropdown, isDeleting]);

  const toggleDropdown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDeleting) setShowDropdown((v) => !v);
  };

  const confirmDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/tickets/${ticket.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setShowDropdown(false);
        onDelete?.(ticket.id);
      } else alert("Failed to delete ticket");
    } catch (err) {
      console.error(err);
      alert("Failed to delete ticket");
    } finally {
      setIsDeleting(false);
    }
  };

  const cancelDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDeleting) setShowDropdown(false);
  };

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        position: "relative",
        backgroundColor: "#ffffff",
        borderLeft: `3px solid ${categoryColor}`,
        borderRadius: "6px",
        transition: "all 0.15s ease",
        boxShadow: isHovered
          ? "0 2px 6px rgba(0,0,0,0.1)"
          : "0 1px 3px rgba(0,0,0,0.06)",
        transform: isHovered ? "translateY(-1px)" : "none",
        opacity: isDeleting ? 0.5 : 1,
        zIndex: showDropdown ? 1000 : undefined,
      }}
    >
      <Link
        href={`/tickets/${ticket.id}?from=tickets`}
        style={{
          textDecoration: "none",
          display: "block",
          padding: "16px 48px 16px 20px",
          cursor: "pointer",
        }}
      >
        {/* Top row: reporter icon + title + time */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "12px",
            marginBottom: "12px",
          }}
        >
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "8px",
              backgroundColor: "#1264a3",
              color: "#ffffff",
              fontSize: "12px",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {reporterInitials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3
              style={{
                color: "#1d1c1d",
                fontWeight: 600,
                fontSize: "15px",
                marginBottom: "4px",
                lineHeight: 1.4,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {ticket.title}
            </h3>
            <span style={{ fontSize: "12px", color: "#616061" }}>
              {formatDate(ticket.updated_at)}
            </span>
          </div>
        </div>

        {/* Meta: category, status, priority */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            fontSize: "12px",
            color: "#616061",
            marginBottom: "10px",
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <span
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                backgroundColor: categoryColor,
                flexShrink: 0,
              }}
            />
            <span style={{ textTransform: "capitalize" }}>
              {ticket.category.replace(/_/g, " ")}
            </span>
          </span>
          <span
            style={{
              textTransform: "capitalize",
              color: ticket.status === "open" ? "#2eb886" : "#616061",
            }}
          >
            {ticket.status}
          </span>
          <span
            style={{
              padding: "2px 6px",
              borderRadius: "3px",
              fontSize: "11px",
              fontWeight: 600,
              backgroundColor: priorityStyle.bg,
              color: priorityStyle.color,
              textTransform: "capitalize",
            }}
          >
            {priorityStyle.label}
          </span>
        </div>

        {/* Reported by + Messages */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            fontSize: "12px",
            color: "#616061",
          }}
        >
          <div>
            <span style={{ fontWeight: 600, color: "#1d1c1d" }}>
              Reported by:{" "}
            </span>
            {reporterName}
          </div>
          <div>
            <span style={{ fontWeight: 600, color: "#1d1c1d" }}>
              Messages:{" "}
            </span>
            {messageCount}
          </div>
        </div>
      </Link>

      {/* Delete button */}
      <div
        ref={dropdownRef}
        style={{
          position: "absolute",
          right: "12px",
          top: "50%",
          transform: "translateY(-50%)",
        }}
      >
        <button
          onClick={toggleDropdown}
          disabled={isDeleting}
          style={{
            background: "none",
            border: "none",
            padding: "6px",
            cursor: isDeleting ? "not-allowed" : "pointer",
            opacity: isDeleting ? 0.5 : 0.6,
            borderRadius: "4px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "#fef0f0";
            e.currentTarget.style.opacity = "1";
          }}
          onMouseLeave={(e) => {
            if (!showDropdown) {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.opacity = "0.6";
            }
          }}
          title="Delete ticket"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="#e01e5a"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M2 4h12M5.333 4V2.667a1.333 1.333 0 0 1 1.334-1.334h2.666a1.333 1.333 0 0 1 1.334 1.334V4M6.667 7.333v4M9.333 7.333v4M12.667 4v9.333a1.333 1.333 0 0 1-1.334 1.334H4.667a1.333 1.333 0 0 1-1.334-1.334V4" />
          </svg>
        </button>
        {dropdownVisible && (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 4px)",
              right: 0,
              backgroundColor: "#ffffff",
              borderRadius: "6px",
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
              border: "1px solid #e8e8e8",
              padding: "8px",
              minWidth: "140px",
              zIndex: 1001,
              opacity: showDropdown ? 1 : 0,
              transform: showDropdown ? "translateY(0)" : "translateY(-4px)",
              transition: "opacity 150ms ease, transform 150ms ease",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <p
              style={{
                fontSize: "12px",
                color: "#616061",
                marginBottom: "8px",
                padding: "0 4px",
              }}
            >
              Delete this ticket?
            </p>
            <div style={{ display: "flex", gap: "6px" }}>
              <button
                onClick={cancelDelete}
                disabled={isDeleting}
                style={{
                  flex: 1,
                  padding: "6px 10px",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "#616061",
                  backgroundColor: "#f8f8f8",
                  border: "1px solid #e0e0e0",
                  borderRadius: "4px",
                  cursor: isDeleting ? "not-allowed" : "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={isDeleting}
                style={{
                  flex: 1,
                  padding: "6px 10px",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "#ffffff",
                  backgroundColor: "#e01e5a",
                  border: "none",
                  borderRadius: "4px",
                  cursor: isDeleting ? "not-allowed" : "pointer",
                  opacity: isDeleting ? 0.7 : 1,
                }}
              >
                {isDeleting ? "..." : "Delete"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
