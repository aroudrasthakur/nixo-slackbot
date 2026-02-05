"use client";

import React, { useState, useEffect, useRef } from "react";
import type { Ticket } from "@nixo-slackbot/shared";
import Link from "next/link";

interface TicketCardProps {
  ticket: Ticket;
  messageCount?: number;
  onDelete?: (ticketId: string) => void;
}

export function TicketCard({
  ticket,
  messageCount = 0,
  onDelete,
}: TicketCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const accentColors: Record<string, { base: string; saturated: string; bg: string; label: string }> = {
    bug_report: { base: "#e01e5a", saturated: "#c41048", bg: "#fef0f4", label: "Bug Report" },
    support_question: { base: "#1264a3", saturated: "#0d4f82", bg: "#e8f4fc", label: "Support" },
    feature_request: { base: "#2eb886", saturated: "#1f9e6f", bg: "#e6f9f1", label: "Feature" },
    product_question: { base: "#611f69", saturated: "#4a1750", bg: "#f5edf6", label: "Product Q" },
  };

  const priorityConfig: Record<
    string,
    { color: string; bg: string; label: string; icon: string }
  > = {
    critical: { color: "#e01e5a", bg: "#fef0f0", label: "Critical", icon: "⬆⬆" },
    high: { color: "#e07b1e", bg: "#fff4e5", label: "High", icon: "⬆" },
    medium: { color: "#1264a3", bg: "#e8f4fc", label: "Medium", icon: "—" },
    low: { color: "#616061", bg: "#f5f5f5", label: "Low", icon: "⬇" },
  };

  const statusConfig: Record<string, { color: string; bg: string; label: string }> = {
    open: { color: "#2eb886", bg: "#e6f9f1", label: "Open" },
    resolved: { color: "#616061", bg: "#f0f0f0", label: "Resolved" },
    closed: { color: "#868686", bg: "#f0f0f0", label: "Closed" },
  };

  const accent = accentColors[ticket.category] || accentColors.support_question;
  const priority = ticket.summary?.priority_hint || "medium";
  const priorityStyle = priorityConfig[priority] || priorityConfig.medium;
  const statusStyle = statusConfig[ticket.status] || statusConfig.open;
  const description = ticket.summary?.description || "";

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
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  // Handle dropdown open/close with animation
  useEffect(() => {
    if (showDropdown) {
      setDropdownVisible(true);
    } else {
      const timeout = setTimeout(() => setDropdownVisible(false), 150);
      return () => clearTimeout(timeout);
    }
  }, [showDropdown]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        if (!isDeleting) setShowDropdown(false);
      }
    };
    if (showDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showDropdown, isDeleting]);

  // Close on Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && showDropdown && !isDeleting) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [showDropdown, isDeleting]);

  const toggleDropdown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDeleting) setShowDropdown(!showDropdown);
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
      } else {
        alert("Failed to delete ticket");
      }
    } catch (error) {
      console.error("Error deleting ticket:", error);
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
      onMouseLeave={() => {
        setIsHovered(false);
        setIsActive(false);
      }}
      onMouseDown={() => setIsActive(true)}
      onMouseUp={() => setIsActive(false)}
      style={{
        position: "relative",
        backgroundColor: "#ffffff",
        border: `1px solid ${isHovered ? accent.base + "40" : "#e5e7eb"}`,
        borderRadius: "14px",
        overflow: "hidden",
        transition: "all 0.2s ease",
        transform: isHovered ? "translateY(-2px)" : "none",
        boxShadow: isHovered
          ? "0 4px 12px rgba(0,0,0,0.06)"
          : "none",
        opacity: isDeleting ? 0.5 : 1,
        zIndex: showDropdown ? 1000 : undefined,
      }}
    >
      {/* Left accent strip */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: "4px",
          backgroundColor: isActive ? accent.saturated : accent.base,
          transition: "background-color 0.2s ease",
        }}
      />

      <Link
        href={`/tickets/${ticket.id}?from=dashboard`}
        style={{
          textDecoration: "none",
          display: "block",
          padding: "14px 44px 14px 18px",
          cursor: "pointer",
        }}
      >
        {/* Category label */}
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
            padding: "2px 8px",
            borderRadius: "6px",
            fontSize: "11px",
            fontWeight: 600,
            color: accent.base,
            backgroundColor: accent.bg,
            marginBottom: "6px",
          }}
        >
          <span
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              backgroundColor: accent.base,
              flexShrink: 0,
            }}
          />
          {accent.label}
        </span>

        {/* Title */}
        <h3
          style={{
            color: "#1d1c1d",
            fontWeight: 600,
            fontSize: "14px",
            marginBottom: "6px",
            lineHeight: 1.5,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {ticket.title}
        </h3>

        {/* Description preview */}
        {description && (
          <p
            style={{
              color: "#6b7280",
              fontSize: "12.5px",
              lineHeight: 1.4,
              marginBottom: "10px",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {description}
          </p>
        )}

        {/* Metadata row: priority pill, status pill, time */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "12px",
            color: "#6b7280",
          }}
        >
          {/* Priority pill */}
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              padding: "2px 8px",
              borderRadius: "9999px",
              fontSize: "11px",
              fontWeight: 600,
              backgroundColor: priorityStyle.bg,
              color: priorityStyle.color,
            }}
          >
            <span style={{ fontSize: "9px", lineHeight: 1 }}>{priorityStyle.icon}</span>
            {priorityStyle.label}
          </span>

          {/* Status pill */}
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              padding: "2px 8px",
              borderRadius: "9999px",
              fontSize: "11px",
              fontWeight: 600,
              backgroundColor: statusStyle.bg,
              color: statusStyle.color,
            }}
          >
            <span
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                backgroundColor: statusStyle.color,
              }}
            />
            {statusStyle.label}
          </span>

          {/* Updated time (icon + text) */}
          <span
            style={{
              marginLeft: "auto",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              color: "#9ca3af",
              fontSize: "11px",
            }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            {formatDate(ticket.updated_at)}
          </span>
        </div>
      </Link>

      {/* Delete button container */}
      <div
        ref={dropdownRef}
        style={{
          position: "absolute",
          right: "12px",
          top: "14px",
        }}
      >
        {/* Three-dot menu button */}
        <button
          onClick={toggleDropdown}
          disabled={isDeleting}
          style={{
            background: "none",
            border: "none",
            padding: "4px",
            cursor: isDeleting ? "not-allowed" : "pointer",
            opacity: isHovered || showDropdown ? 1 : 0.4,
            transition: "all 0.15s ease",
            borderRadius: "6px",
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
              e.currentTarget.style.opacity = isHovered ? "1" : "0.4";
            }
          }}
          title="Delete ticket"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#e01e5a"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            <line x1="10" y1="11" x2="10" y2="17" />
            <line x1="14" y1="11" x2="14" y2="17" />
          </svg>
        </button>

        {/* Dropdown */}
        {dropdownVisible && (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 4px)",
              right: 0,
              backgroundColor: "#ffffff",
              borderRadius: "10px",
              boxShadow: "0 4px 16px rgba(0, 0, 0, 0.12)",
              border: "1px solid #e5e7eb",
              padding: "10px",
              minWidth: "150px",
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
                color: "#6b7280",
                marginBottom: "10px",
                padding: "0 4px",
              }}
            >
              Delete this ticket?
            </p>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={cancelDelete}
                disabled={isDeleting}
                style={{
                  flex: 1,
                  padding: "6px 12px",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "#374151",
                  backgroundColor: "#f9fafb",
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                  cursor: isDeleting ? "not-allowed" : "pointer",
                  transition: "all 100ms ease",
                }}
                onMouseEnter={(e) => {
                  if (!isDeleting) {
                    e.currentTarget.style.backgroundColor = "#f3f4f6";
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "#f9fafb";
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={isDeleting}
                style={{
                  flex: 1,
                  padding: "6px 12px",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "#ffffff",
                  backgroundColor: "#e01e5a",
                  border: "none",
                  borderRadius: "8px",
                  cursor: isDeleting ? "not-allowed" : "pointer",
                  opacity: isDeleting ? 0.7 : 1,
                  transition: "all 100ms ease",
                }}
                onMouseEnter={(e) => {
                  if (!isDeleting) {
                    e.currentTarget.style.backgroundColor = "#c41048";
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "#e01e5a";
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
