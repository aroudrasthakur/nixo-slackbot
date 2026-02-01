"use client";

import React from "react";
import type { Message } from "@nixo-slackbot/shared";

interface MessageTimelineProps {
  messages: Message[];
}

export function MessageTimeline({ messages }: MessageTimelineProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold mb-4">Messages</h3>
      {messages.length === 0 ? (
        <p className="text-gray-500">No messages yet.</p>
      ) : (
        <div className="space-y-3">
          {messages.map((message) => (
            <div
              key={message.id}
              className="border-l-2 border-blue-500 pl-4 py-2"
            >
              <div className="flex justify-between items-start mb-1">
                <span className="font-medium text-sm">
                  User {message.slack_user_id}
                </span>
                <span className="text-xs text-gray-500">
                  {new Date(message.created_at).toLocaleString()}
                </span>
              </div>
              <p className="text-gray-700 mb-2">{message.text}</p>
              {message.permalink && (
                <a
                  href={message.permalink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline"
                >
                  View in Slack →
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
