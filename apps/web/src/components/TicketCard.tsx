"use client";

import React, { useState } from "react";
import type { Ticket } from "@nixo-slackbot/shared";
import Link from "next/link";

interface TicketCardProps {
  ticket: Ticket;
  messageCount?: number;
}

export function TicketCard({ ticket, messageCount = 0 }: TicketCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  const categoryColors: Record<string, { bg: string; text: string }> = {
    bug_report: { bg: "#e01e5a", text: "#ffffff" },
    support_question: { bg: "#1264a3", text: "#ffffff" },
    feature_request: { bg: "#2eb886", text: "#ffffff" },
    product_question: { bg: "#611f69", text: "#ffffff" },
  };

  const statusColors: Record<string, { bg: string; text: string }> = {
    open: { bg: "#2eb886", text: "#ffffff" },
    closed: { bg: "#616061", text: "#ffffff" },
    resolved: { bg: "#1264a3", text: "#ffffff" },
  };

  const categoryColor = categoryColors[ticket.category] || {
    bg: "#616061",
    text: "#ffffff",
  };
  const statusColor = statusColors[ticket.status] || {
    bg: "#616061",
    text: "#ffffff",
  };

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
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  };

  return (
    <Link href={`/tickets/${ticket.id}`} style={{ textDecoration: "none" }}>
      <div
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          backgroundColor: "#ffffff",
          border: `1px solid ${isHovered ? "#1264a3" : "#e0e0e0"}`,
          borderRadius: "8px",
          padding: "16px",
          cursor: "pointer",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          transition: "all 0.15s ease",
          boxShadow: isHovered ? "0 2px 8px rgba(0,0,0,0.08)" : "none",
        }}
      >
        <div style={{ flex: 1 }}>
          <h3
            style={{
              color: "#1d1c1d",
              fontWeight: 600,
              fontSize: "15px",
              marginBottom: "12px",
              lineHeight: 1.4,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {ticket.title}
          </h3>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "8px",
              marginBottom: "12px",
            }}
          >
            <span
              style={{
                padding: "4px 10px",
                borderRadius: "4px",
                fontSize: "12px",
                fontWeight: 600,
                backgroundColor: categoryColor.bg,
                color: categoryColor.text,
                textTransform: "capitalize",
              }}
            >
              {ticket.category.replace(/_/g, " ")}
            </span>
            <span
              style={{
                padding: "4px 10px",
                borderRadius: "4px",
                fontSize: "12px",
                fontWeight: 600,
                backgroundColor: statusColor.bg,
                color: statusColor.text,
                textTransform: "capitalize",
              }}
            >
              {ticket.status}
            </span>
          </div>
        </div>

        <div
          style={{
            fontSize: "12px",
            color: "#616061",
            paddingTop: "12px",
            borderTop: "1px solid #f0f0f0",
          }}
        >
          Updated {formatDate(ticket.updated_at)}
        </div>
      </div>
    </Link>
  );
}
