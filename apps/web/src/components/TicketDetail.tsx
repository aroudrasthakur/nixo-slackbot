"use client";

import React, { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { TicketWithMessages } from "@nixo-slackbot/shared";
import { MessageTimeline } from "./MessageTimeline";
import { useSocket } from "@/hooks/useSocket";

interface TicketDetailProps {
  ticket: TicketWithMessages;
}

export function TicketDetail({ ticket: initialTicket }: TicketDetailProps) {
  const router = useRouter();
  const [ticket, setTicket] = useState(initialTicket);
  const [isResolving, setIsResolving] = useState(false);
  const { onTicketUpdated } = useSocket();

  const fetchTicket = useCallback(async () => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
    try {
      const res = await fetch(`${apiUrl}/api/tickets/${ticket.id}`);
      if (res.ok) {
        const data: TicketWithMessages = await res.json();
        setTicket(data);
      }
    } catch (err) {
      console.error("Failed to refetch ticket:", err);
    }
  }, [ticket.id]);

  // Refetch this ticket when a message is added (socket ticket_updated for this ticket)
  useEffect(() => {
    const unsubscribe = onTicketUpdated((updatedTicketId) => {
      if (updatedTicketId === ticket.id) {
        fetchTicket();
      }
    });
    return unsubscribe;
  }, [ticket.id, onTicketUpdated, fetchTicket]);
  const categoryColors: Record<string, string> = {
    bug_report: "#e01e5a",
    support_question: "#1264a3",
    feature_request: "#2eb886",
    product_question: "#611f69",
  };

  const priorityColors: Record<string, { bg: string; text: string }> = {
    critical: { bg: "#fef0f0", text: "#e01e5a" },
    high: { bg: "#fff4e5", text: "#e07b1e" },
    medium: { bg: "#e3f2fd", text: "#1264a3" },
    low: { bg: "#f5f5f5", text: "#616061" },
  };

  const categoryColor = categoryColors[ticket.category] || "#616061";

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const priority = ticket.summary?.priority_hint || "medium";
  const priorityStyle = priorityColors[priority] || priorityColors.medium;

  const handleResolve = async () => {
    if (isResolving) return;
    
    const newStatus = ticket.status === "resolved" ? "open" : "resolved";
    setIsResolving(true);
    
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
      const res = await fetch(`${apiUrl}/api/tickets/${ticket.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      
      if (res.ok) {
        const updatedTicket = await res.json();
        setTicket({ ...ticket, status: updatedTicket.status });
        router.refresh();
      } else {
        alert("Failed to update ticket status");
      }
    } catch (error) {
      console.error("Error updating ticket:", error);
      alert("Failed to update ticket status");
    } finally {
      setIsResolving(false);
    }
  };

  return (
    <div>
      {/* Ticket header card */}
      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: "8px",
          borderLeft: `4px solid ${categoryColor}`,
          padding: "20px 24px",
          marginBottom: "20px",
        }}
      >
        {/* Title */}
        <h1
          style={{
            fontSize: "18px",
            fontWeight: 700,
            color: "#1d1c1d",
            marginBottom: "12px",
            lineHeight: 1.4,
          }}
        >
          {ticket.title}
        </h1>

        {/* Meta */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "16px",
            fontSize: "13px",
            color: "#616061",
          }}
        >
          {/* Category */}
          <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span
              style={{
                width: "10px",
                height: "10px",
                borderRadius: "50%",
                backgroundColor: categoryColor,
              }}
            />
            <span style={{ textTransform: "capitalize" }}>
              {ticket.category.replace(/_/g, " ")}
            </span>
          </span>

          {/* Status */}
          <span
            style={{
              padding: "2px 8px",
              borderRadius: "4px",
              fontSize: "12px",
              fontWeight: 600,
              textTransform: "capitalize",
              backgroundColor:
                ticket.status === "open"
                  ? "#e8f5e9"
                  : ticket.status === "resolved"
                  ? "#e3f2fd"
                  : "#f5f5f5",
              color:
                ticket.status === "open"
                  ? "#2eb886"
                  : ticket.status === "resolved"
                  ? "#1264a3"
                  : "#616061",
            }}
          >
            {ticket.status}
          </span>

          {/* Priority */}
          {ticket.summary && (
            <span
              style={{
                padding: "2px 8px",
                borderRadius: "4px",
                fontSize: "12px",
                fontWeight: 600,
                textTransform: "capitalize",
                backgroundColor: priorityStyle.bg,
                color: priorityStyle.text,
              }}
            >
              {priority} priority
            </span>
          )}

          {/* Dates */}
          <span>Created {formatDate(ticket.created_at)}</span>
          <span>Updated {formatDate(ticket.updated_at)}</span>
        </div>

        {/* Reporter */}
        {ticket.reporter_username && (
          <div
            style={{
              marginTop: "12px",
              fontSize: "13px",
              color: "#616061",
            }}
          >
            <strong>Reported by:</strong> {ticket.reporter_username}
          </div>
        )}

        {/* Assignees */}
        {ticket.assignees && ticket.assignees.length > 0 && (
          <div
            style={{
              marginTop: "8px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "13px",
            }}
          >
            <strong style={{ color: "#616061" }}>Assigned to:</strong>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              {ticket.assignees.map((assignee, idx) => (
                <span
                  key={idx}
                  style={{
                    padding: "2px 8px",
                    backgroundColor: "#611f69",
                    color: "#ffffff",
                    borderRadius: "4px",
                    fontSize: "12px",
                    fontWeight: 500,
                  }}
                >
                  {assignee}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Summary section */}
      {ticket.summary && (
        <div
          style={{
            backgroundColor: "#ffffff",
            borderRadius: "8px",
            padding: "20px 24px",
            marginBottom: "20px",
          }}
        >
          <h2
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "15px",
              fontWeight: 700,
              color: "#1d1c1d",
              marginBottom: "16px",
            }}
          >
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#7c4dff",
              }}
              aria-hidden
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="currentColor"
                style={{ flexShrink: 0 }}
              >
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            </span>
            Summary
          </h2>

          {/* Title */}
          <div style={{ marginBottom: "16px" }}>
            <div
              style={{
                fontSize: "12px",
                fontWeight: 600,
                color: "#616061",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                marginBottom: "4px",
              }}
            >
              Title
            </div>
            <div
              style={{
                fontSize: "15px",
                fontWeight: 600,
                color: "#1d1c1d",
                lineHeight: 1.4,
              }}
            >
              {ticket.title}
            </div>
          </div>

          {/* Body — general summary of the conversation; suggest changes if possible from context */}
          <div style={{ marginBottom: "16px" }}>
            <div
              style={{
                fontSize: "12px",
                fontWeight: 600,
                color: "#616061",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                marginBottom: "6px",
              }}
            >
              Body
            </div>
            <p
              style={{
                margin: 0,
                fontSize: "14px",
                color: "#1d1c1d",
                lineHeight: 1.6,
              }}
            >
              {ticket.summary.description}
            </p>
          </div>

          {/* To-do — list of tasks */}
          <div>
            <div
              style={{
                fontSize: "12px",
                fontWeight: 600,
                color: "#616061",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                marginBottom: "8px",
              }}
            >
              To-do
            </div>
            {ticket.summary.action_items && ticket.summary.action_items.length > 0 ? (
              <ul
                style={{
                  margin: 0,
                  paddingLeft: "24px",
                  listStyle: "none",
                  fontSize: "14px",
                  color: "#1d1c1d",
                  lineHeight: 1.6,
                }}
              >
                {ticket.summary.action_items.map((item, idx) => (
                  <li
                    key={idx}
                    style={{
                      marginBottom: "8px",
                      paddingLeft: "8px",
                      position: "relative",
                    }}
                  >
                    <span
                      style={{
                        position: "absolute",
                        left: "-20px",
                        top: "2px",
                        width: "14px",
                        height: "14px",
                        border: "2px solid #c4b5fd",
                        borderRadius: "4px",
                        boxSizing: "border-box",
                      }}
                      aria-hidden
                    />
                    {item}
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ margin: 0, fontSize: "14px", color: "#8b8b8b" }}>
                No tasks listed.
              </p>
            )}
          </div>

          {/* Technical Details */}
          {ticket.summary.technical_details && (
            <div>
              <h3
                style={{
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "#616061",
                  marginBottom: "8px",
                }}
              >
                Technical Details
              </h3>
              <div
                style={{
                  backgroundColor: "#f8f8f8",
                  borderRadius: "4px",
                  padding: "12px",
                  fontSize: "13px",
                  fontFamily: "monospace",
                  color: "#1d1c1d",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {ticket.summary.technical_details}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Messages section */}
      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: "8px",
          padding: "20px 24px",
        }}
      >
        <h2
          style={{
            fontSize: "15px",
            fontWeight: 700,
            color: "#1d1c1d",
            marginBottom: "16px",
          }}
        >
          Messages ({ticket.messages.length})
        </h2>
        <MessageTimeline messages={ticket.messages} />

        {/* Resolve button - bottom right of messages card */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "20px" }}>
          <button
            onClick={handleResolve}
            disabled={isResolving}
            style={{
              padding: "10px 20px",
              fontSize: "14px",
              fontWeight: 600,
              color: "#ffffff",
              backgroundColor: ticket.status === "resolved" ? "#1264a3" : "#2eb886",
              border: "none",
              borderRadius: "6px",
              cursor: isResolving ? "not-allowed" : "pointer",
              opacity: isResolving ? 0.7 : 1,
              display: "flex",
              alignItems: "center",
              gap: "8px",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              if (!isResolving) {
                e.currentTarget.style.backgroundColor =
                  ticket.status === "resolved" ? "#0d5a8a" : "#259a70";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor =
                ticket.status === "resolved" ? "#1264a3" : "#2eb886";
            }}
          >
            {ticket.status === "resolved" ? (
              <>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M1 8h14M8 1v14" />
                </svg>
                {isResolving ? "Reopening..." : "Reopen Ticket"}
              </>
            ) : (
              <>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M13.5 4.5L6 12l-3.5-3.5" />
                </svg>
                {isResolving ? "Resolving..." : "Resolve Ticket"}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
