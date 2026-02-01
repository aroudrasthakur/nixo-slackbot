"use client";

import React from "react";
import type { Ticket } from "@nixo-slackbot/shared";

interface StatsCardsProps {
  tickets: Ticket[];
}

export function StatsCards({ tickets }: StatsCardsProps) {
  const totalTickets = tickets.length;
  const openTickets = tickets.filter((t) => t.status === "open").length;
  const resolvedTickets = tickets.filter((t) => t.status === "resolved").length;
  const closedTickets = tickets.filter((t) => t.status === "closed").length;

  // Get tickets from last 24 hours
  const recentTickets = tickets.filter((t) => {
    const ticketDate = new Date(t.created_at);
    const now = new Date();
    const diffHours =
      (now.getTime() - ticketDate.getTime()) / (1000 * 60 * 60);
    return diffHours <= 24;
  }).length;

  // Category breakdown
  const bugReports = tickets.filter((t) => t.category === "bug_report").length;
  const supportQuestions = tickets.filter(
    (t) => t.category === "support_question"
  ).length;
  const featureRequests = tickets.filter(
    (t) => t.category === "feature_request"
  ).length;

  const stats = [
    {
      label: "Total Tickets",
      value: totalTickets,
      color: "#3F0E40",
      bgColor: "#f5f0f5",
    },
    {
      label: "Open",
      value: openTickets,
      color: "#2eb886",
      bgColor: "#e8f5e9",
    },
    {
      label: "Resolved",
      value: resolvedTickets,
      color: "#1264a3",
      bgColor: "#e3f2fd",
    },
    {
      label: "Closed",
      value: closedTickets,
      color: "#616061",
      bgColor: "#f5f5f5",
    },
  ];

  return (
    <div style={{ marginBottom: "32px" }}>
      {/* Main stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "16px",
          marginBottom: "24px",
        }}
      >
        {stats.map((stat, index) => (
          <div
            key={index}
            style={{
              backgroundColor: stat.bgColor,
              borderRadius: "12px",
              padding: "20px",
              border: "1px solid rgba(0,0,0,0.05)",
            }}
          >
            <div
              style={{
                fontSize: "32px",
                fontWeight: 700,
                color: stat.color,
                lineHeight: 1,
              }}
            >
              {stat.value}
            </div>
            <div
              style={{
                fontSize: "14px",
                color: "#616061",
                marginTop: "8px",
                fontWeight: 500,
              }}
            >
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      {/* Secondary stats row */}
      <div
        style={{
          display: "flex",
          gap: "24px",
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            flex: 1,
            minWidth: "280px",
            backgroundColor: "#ffffff",
            borderRadius: "12px",
            padding: "20px",
            border: "1px solid #e8e8e8",
          }}
        >
          <h3
            style={{
              fontSize: "14px",
              fontWeight: 600,
              color: "#1d1c1d",
              margin: "0 0 16px 0",
            }}
          >
            Recent Activity
          </h3>
          <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
            <span
              style={{ fontSize: "28px", fontWeight: 700, color: "#007a5a" }}
            >
              {recentTickets}
            </span>
            <span style={{ fontSize: "14px", color: "#616061" }}>
              tickets in the last 24 hours
            </span>
          </div>
        </div>

        <div
          style={{
            flex: 1,
            minWidth: "280px",
            backgroundColor: "#ffffff",
            borderRadius: "12px",
            padding: "20px",
            border: "1px solid #e8e8e8",
          }}
        >
          <h3
            style={{
              fontSize: "14px",
              fontWeight: 600,
              color: "#1d1c1d",
              margin: "0 0 16px 0",
            }}
          >
            By Category
          </h3>
          <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div
                style={{
                  width: "10px",
                  height: "10px",
                  borderRadius: "50%",
                  backgroundColor: "#e01e5a",
                }}
              />
              <span style={{ fontSize: "14px", color: "#616061" }}>
                Bugs: {bugReports}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div
                style={{
                  width: "10px",
                  height: "10px",
                  borderRadius: "50%",
                  backgroundColor: "#1264a3",
                }}
              />
              <span style={{ fontSize: "14px", color: "#616061" }}>
                Support: {supportQuestions}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div
                style={{
                  width: "10px",
                  height: "10px",
                  borderRadius: "50%",
                  backgroundColor: "#2eb886",
                }}
              />
              <span style={{ fontSize: "14px", color: "#616061" }}>
                Features: {featureRequests}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
