"use client";

import React from "react";
import type { TicketCategory } from "@nixo-slackbot/shared";

interface FiltersProps {
  category: TicketCategory | "all";
  search: string;
  onCategoryChange: (category: TicketCategory | "all") => void;
  onSearchChange: (search: string) => void;
}

export function Filters({
  category,
  search,
  onCategoryChange,
  onSearchChange,
}: FiltersProps) {
  return (
    <div className="flex gap-4 mb-6">
      <select
        value={category}
        onChange={(e) =>
          onCategoryChange(e.target.value as TicketCategory | "all")
        }
        className="px-4 py-2 border rounded"
      >
        <option value="all">All Categories</option>
        <option value="bug_report">Bug Reports</option>
        <option value="support_question">Support Questions</option>
        <option value="feature_request">Feature Requests</option>
        <option value="product_question">Product Questions</option>
      </select>
      <input
        type="text"
        placeholder="Search tickets..."
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className="flex-1 px-4 py-2 border rounded"
      />
    </div>
  );
}
