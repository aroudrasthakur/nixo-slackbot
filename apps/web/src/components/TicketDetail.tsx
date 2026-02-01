"use client";

import React from "react";
import type { TicketWithMessages } from "@nixo-slackbot/shared";
import { MessageTimeline } from "./MessageTimeline";

interface TicketDetailProps {
  ticket: TicketWithMessages;
}

export function TicketDetail({ ticket }: TicketDetailProps) {
  const categoryColors: Record<string, string> = {
    bug_report: "bg-red-100 text-red-800",
    support_question: "bg-blue-100 text-blue-800",
    feature_request: "bg-green-100 text-green-800",
    product_question: "bg-purple-100 text-purple-800",
  };

  const statusColors: Record<string, string> = {
    open: "bg-green-100 text-green-800",
    closed: "bg-gray-100 text-gray-800",
    resolved: "bg-blue-100 text-blue-800",
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <div className="flex justify-between items-start mb-4">
          <h1 className="text-2xl font-bold">{ticket.title}</h1>
          <div className="flex gap-2">
            <span
              className={`px-3 py-1 rounded text-sm font-medium ${
                categoryColors[ticket.category] || "bg-gray-100 text-gray-800"
              }`}
            >
              {ticket.category.replace("_", " ")}
            </span>
            <span
              className={`px-3 py-1 rounded text-sm font-medium ${
                statusColors[ticket.status] || "bg-gray-100 text-gray-800"
              }`}
            >
              {ticket.status}
            </span>
          </div>
        </div>
        <div className="text-sm text-gray-600 space-y-1">
          <div>Created: {new Date(ticket.created_at).toLocaleString()}</div>
          <div>Updated: {new Date(ticket.updated_at).toLocaleString()}</div>
          {ticket.canonical_key && <div>Key: {ticket.canonical_key}</div>}
        </div>
      </div>
      <MessageTimeline messages={ticket.messages} />
    </div>
  );
}
