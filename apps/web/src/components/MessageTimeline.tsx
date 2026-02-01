"use client";

import React from "react";
import type { Message } from "@nixo-slackbot/shared";

interface MessageTimelineProps {
  messages: Message[];
}

export function MessageTimeline({ messages }: MessageTimelineProps) {
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
  };

  // Build Slack permalink from channel + ts if not stored
  const getSlackLink = (message: Message): string => {
    if (message.permalink) return message.permalink;
    // Format: https://slack.com/archives/{CHANNEL}/p{TS_WITHOUT_DOT}
    const tsWithoutDot = message.slack_ts.replace(".", "");
    return `https://slack.com/archives/${message.slack_channel_id}/p${tsWithoutDot}`;
  };

  // Get display name: prefer username, fallback to last 4 chars of user ID
  const getUserDisplay = (message: Message) => {
    if (message.slack_username) {
      return message.slack_username;
    }
    return message.slack_user_id.slice(-4).toUpperCase();
  };

  // Get avatar initials from username or user ID
  const getAvatarInitials = (message: Message) => {
    if (message.slack_username) {
      const parts = message.slack_username.split(" ");
      if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
      }
      return message.slack_username.slice(0, 2).toUpperCase();
    }
    return message.slack_user_id.slice(-2).toUpperCase();
  };

  // Group messages by date
  const groupedByDate: { date: string; messages: Message[] }[] = [];
  let currentDate = "";

  messages.forEach((msg) => {
    const msgDate = formatDate(msg.created_at);
    if (msgDate !== currentDate) {
      currentDate = msgDate;
      groupedByDate.push({ date: msgDate, messages: [msg] });
    } else {
      groupedByDate[groupedByDate.length - 1].messages.push(msg);
    }
  });

  if (messages.length === 0) {
    return (
      <p style={{ color: "#616061", fontSize: "14px" }}>No messages yet.</p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {groupedByDate.map((group) => (
        <div key={group.date}>
          {/* Date divider */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              marginBottom: "16px",
            }}
          >
            <div
              style={{ flex: 1, height: "1px", backgroundColor: "#e8e8e8" }}
            />
            <span
              style={{
                padding: "0 12px",
                fontSize: "12px",
                fontWeight: 600,
                color: "#616061",
              }}
            >
              {group.date}
            </span>
            <div
              style={{ flex: 1, height: "1px", backgroundColor: "#e8e8e8" }}
            />
          </div>

          {/* Messages */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {group.messages.map((message) => (
              <a
                key={message.id}
                href={getSlackLink(message)}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "flex",
                  gap: "12px",
                  padding: "8px 12px",
                  borderRadius: "8px",
                  textDecoration: "none",
                  color: "inherit",
                  transition: "background-color 0.15s ease",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#f8f8f8";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                {/* Avatar */}
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "4px",
                    backgroundColor: "#611f69",
                    color: "#ffffff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "12px",
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {getAvatarInitials(message)}
                </div>

                {/* Message content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Header */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      gap: "8px",
                      marginBottom: "4px",
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 700,
                        fontSize: "14px",
                        color: "#1d1c1d",
                      }}
                    >
                      {getUserDisplay(message)}
                    </span>
                    <span style={{ fontSize: "12px", color: "#616061" }}>
                      {formatTime(message.created_at)}
                    </span>
                  </div>

                  {/* Text bubble */}
                  <div
                    style={{
                      fontSize: "14px",
                      lineHeight: 1.5,
                      color: "#1d1c1d",
                      wordBreak: "break-word",
                    }}
                  >
                    {message.text}
                  </div>

                  {/* Link indicator */}
                  <div
                    style={{
                      marginTop: "6px",
                      fontSize: "12px",
                      color: "#1264a3",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 16 16"
                      fill="currentColor"
                    >
                      <path d="M8.636 3.5a.5.5 0 0 0-.5-.5H1.5A1.5 1.5 0 0 0 0 4.5v10A1.5 1.5 0 0 0 1.5 16h10a1.5 1.5 0 0 0 1.5-1.5V7.864a.5.5 0 0 0-1 0V14.5a.5.5 0 0 1-.5.5h-10a.5.5 0 0 1-.5-.5v-10a.5.5 0 0 1 .5-.5h6.636a.5.5 0 0 0 .5-.5z" />
                      <path d="M16 .5a.5.5 0 0 0-.5-.5h-5a.5.5 0 0 0 0 1h3.793L6.146 9.146a.5.5 0 1 0 .708.708L15 1.707V5.5a.5.5 0 0 0 1 0v-5z" />
                    </svg>
                    View in Slack
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
