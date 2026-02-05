"use client";

import Link from "next/link";
import React, { useState } from "react";

const features = [
  {
    icon: "⚡",
    title: "Real-time Updates",
    description:
      "Get instant notifications when new tickets arrive. Watch your dashboard update in real-time as your team resolves issues.",
  },
  {
    icon: "🎫",
    title: "Smart Ticket Management",
    description:
      "Automatically categorize and prioritize tickets. Track bug reports, feature requests, and support questions in one place.",
  },
  {
    icon: "💬",
    title: "Slack Integration",
    description:
      "Seamlessly capture conversations from Slack. Never miss important customer feedback or support requests.",
  },
  {
    icon: "📊",
    title: "Analytics Dashboard",
    description:
      "Visualize your support metrics. Track response times, resolution rates, and team performance.",
  },
  {
    icon: "🔔",
    title: "Smart Notifications",
    description:
      "Stay informed with intelligent alerts. Get notified about high-priority issues and SLA breaches.",
  },
  {
    icon: "🔒",
    title: "Secure & Reliable",
    description:
      "Enterprise-grade security with AWS Cognito. Your data is encrypted and protected at all times.",
  },
];

/* ── Reusable interactive button wrapper ─────────────────────────── */

interface InteractiveLinkProps {
  href: string;
  children: React.ReactNode;
  baseStyle: React.CSSProperties;
  hoverStyle: React.CSSProperties;
  activeStyle?: React.CSSProperties;
}

function InteractiveLink({
  href,
  children,
  baseStyle,
  hoverStyle,
  activeStyle,
}: InteractiveLinkProps) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  const merged: React.CSSProperties = {
    ...baseStyle,
    ...(hovered ? hoverStyle : {}),
    ...(pressed ? activeStyle ?? {} : {}),
  };

  return (
    <Link
      href={href}
      style={merged}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        setPressed(false);
      }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
    >
      {children}
    </Link>
  );
}

/* ── Page ─────────────────────────────────────────────────────────── */

export default function HomePage() {
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#ffffff" }}>
      {/* Navigation - fixed at top */}
      <nav
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          padding: "16px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          maxWidth: "1200px",
          margin: "0 auto",
          backgroundColor: "#ffffff",
          borderBottom: "1px solid #3F0E40",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <img
            src="/images/logo.png"
            alt="Nixo Bot"
            style={{
              width: "40px",
              height: "40px",
              objectFit: "contain",
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: "20px", fontWeight: 700, color: "#1d1c1d" }}>
            Nixo Bot
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          {/* Nav – Go to Dashboard */}
          <InteractiveLink
            href="/dashboard"
            baseStyle={{
              padding: "10px 20px",
              fontSize: "14px",
              fontWeight: 600,
              color: "#1264a3",
              textDecoration: "none",
              borderRadius: "8px",
              transition: "all 0.15s ease",
            }}
            hoverStyle={{
              backgroundColor: "#e8f4fc",
              transform: "translateY(-1px)",
            }}
            activeStyle={{ transform: "translateY(0)" }}
          >
            Go to Dashboard
          </InteractiveLink>

          {/* Nav – Sign in */}
          <InteractiveLink
            href="/signin"
            baseStyle={{
              padding: "10px 20px",
              fontSize: "14px",
              fontWeight: 600,
              color: "#1d1c1d",
              textDecoration: "none",
              borderRadius: "8px",
              transition: "all 0.15s ease",
            }}
            hoverStyle={{
              backgroundColor: "#f3f4f6",
              transform: "translateY(-1px)",
            }}
            activeStyle={{ transform: "translateY(0)" }}
          >
            Sign in
          </InteractiveLink>

          {/* Nav – Get Started */}
          <InteractiveLink
            href="/signup"
            baseStyle={{
              padding: "10px 20px",
              fontSize: "14px",
              fontWeight: 600,
              color: "#ffffff",
              backgroundColor: "#3F0E40",
              textDecoration: "none",
              borderRadius: "8px",
              transition: "all 0.15s ease",
              boxShadow: "0 2px 4px rgba(63,14,64,0.2)",
            }}
            hoverStyle={{
              backgroundColor: "#531754",
              transform: "translateY(-1px)",
              boxShadow: "0 4px 12px rgba(63,14,64,0.3)",
            }}
            activeStyle={{
              transform: "translateY(0)",
              boxShadow: "0 1px 2px rgba(63,14,64,0.2)",
            }}
          >
            Get Started
          </InteractiveLink>
        </div>
      </nav>

      {/* Hero Section - padding-top for fixed nav */}
      <section
        style={{
          padding: "80px 24px",
          paddingTop: "160px",
          textAlign: "center",
          maxWidth: "800px",
          margin: "0 auto",
        }}
      >
        <h1
          style={{
            fontSize: "56px",
            fontWeight: 700,
            color: "#1d1c1d",
            lineHeight: 1.1,
            margin: 0,
          }}
        >
          Support tickets, <span style={{ color: "#3F0E40" }}>simplified</span>
        </h1>
        <p
          style={{
            fontSize: "20px",
            color: "#616061",
            marginTop: "24px",
            lineHeight: 1.6,
          }}
        >
          Nixo Bot automatically captures and organizes support requests from
          Slack. Track issues, collaborate with your team, and resolve tickets
          faster than ever.
        </p>
        <div
          style={{
            marginTop: "40px",
            display: "flex",
            gap: "16px",
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          {/* Hero – Go to Dashboard */}
          <InteractiveLink
            href="/dashboard"
            baseStyle={{
              padding: "16px 32px",
              fontSize: "16px",
              fontWeight: 600,
              color: "#ffffff",
              backgroundColor: "#1264a3",
              textDecoration: "none",
              borderRadius: "8px",
              transition: "all 0.2s ease",
              boxShadow: "0 2px 6px rgba(18,100,163,0.25)",
            }}
            hoverStyle={{
              backgroundColor: "#0d4f82",
              transform: "translateY(-2px)",
              boxShadow: "0 6px 16px rgba(18,100,163,0.3)",
            }}
            activeStyle={{
              transform: "translateY(0)",
              boxShadow: "0 1px 3px rgba(18,100,163,0.2)",
            }}
          >
            Go to Dashboard
          </InteractiveLink>

          {/* Hero – Start for free */}
          <InteractiveLink
            href="/signup"
            baseStyle={{
              padding: "16px 32px",
              fontSize: "16px",
              fontWeight: 600,
              color: "#ffffff",
              backgroundColor: "#007a5a",
              textDecoration: "none",
              borderRadius: "8px",
              transition: "all 0.2s ease",
              boxShadow: "0 2px 6px rgba(0,122,90,0.25)",
            }}
            hoverStyle={{
              backgroundColor: "#005e44",
              transform: "translateY(-2px)",
              boxShadow: "0 6px 16px rgba(0,122,90,0.3)",
            }}
            activeStyle={{
              transform: "translateY(0)",
              boxShadow: "0 1px 3px rgba(0,122,90,0.2)",
            }}
          >
            Start for free
          </InteractiveLink>

          {/* Hero – Sign in */}
          <InteractiveLink
            href="/signin"
            baseStyle={{
              padding: "16px 32px",
              fontSize: "16px",
              fontWeight: 600,
              color: "#1d1c1d",
              backgroundColor: "#ffffff",
              border: "1px solid #dddddd",
              textDecoration: "none",
              borderRadius: "8px",
              transition: "all 0.2s ease",
            }}
            hoverStyle={{
              borderColor: "#3F0E40",
              color: "#3F0E40",
              transform: "translateY(-2px)",
              boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
            }}
            activeStyle={{
              transform: "translateY(0)",
              boxShadow: "none",
            }}
          >
            Sign in
          </InteractiveLink>
        </div>
      </section>

      {/* Features Section */}
      <section
        style={{
          padding: "80px 24px",
          backgroundColor: "#f8f8f8",
        }}
      >
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          <h2
            style={{
              fontSize: "36px",
              fontWeight: 700,
              color: "#1d1c1d",
              textAlign: "center",
              margin: "0 0 16px 0",
            }}
          >
            Everything you need
          </h2>
          <p
            style={{
              fontSize: "18px",
              color: "#616061",
              textAlign: "center",
              marginBottom: "48px",
            }}
          >
            Powerful features to streamline your support workflow
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: "24px",
            }}
          >
            {features.map((feature, index) => (
              <div
                key={index}
                style={{
                  background:
                    "linear-gradient(145deg, #ffffff 0%, #faf7fb 60%, #f3ecf5 100%)",
                  borderRadius: "14px",
                  padding: "28px",
                  border: "1px solid #e8dfea",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {/* Subtle purple top accent */}
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: "3px",
                    background:
                      "linear-gradient(90deg, #3F0E40, #7b3f7d, #3F0E40)",
                    opacity: 0.5,
                  }}
                />
                <div
                  style={{
                    fontSize: "32px",
                    marginBottom: "16px",
                  }}
                >
                  {feature.icon}
                </div>
                <h3
                  style={{
                    fontSize: "18px",
                    fontWeight: 600,
                    color: "#3F0E40",
                    margin: "0 0 8px 0",
                  }}
                >
                  {feature.title}
                </h3>
                <p
                  style={{
                    fontSize: "15px",
                    color: "#6b4e6d",
                    lineHeight: 1.6,
                    margin: 0,
                  }}
                >
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section
        style={{
          padding: "80px 24px",
          textAlign: "center",
          backgroundColor: "#3F0E40",
        }}
      >
        <h2
          style={{
            fontSize: "36px",
            fontWeight: 700,
            color: "#ffffff",
            margin: "0 0 16px 0",
          }}
        >
          Ready to get started?
        </h2>
        <p
          style={{
            fontSize: "18px",
            color: "#d1d2d3",
            marginBottom: "32px",
          }}
        >
          Join teams already using Nixo Bot to manage their support
        </p>
        <InteractiveLink
          href="/signup"
          baseStyle={{
            display: "inline-block",
            padding: "16px 40px",
            fontSize: "16px",
            fontWeight: 600,
            color: "#3F0E40",
            backgroundColor: "#ffffff",
            textDecoration: "none",
            borderRadius: "8px",
            transition: "all 0.2s ease",
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
          }}
          hoverStyle={{
            transform: "translateY(-2px)",
            boxShadow: "0 6px 20px rgba(0,0,0,0.25)",
          }}
          activeStyle={{
            transform: "translateY(0)",
            boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
          }}
        >
          Create free account
        </InteractiveLink>
      </section>

      {/* Footer */}
      <footer
        style={{
          padding: "32px 24px",
          textAlign: "center",
          borderTop: "1px solid #e8e8e8",
        }}
      >
        <p style={{ fontSize: "14px", color: "#616061", margin: 0 }}>
          &copy; 2026 Nixo Bot. Built for modern support teams.
        </p>
      </footer>
    </div>
  );
}
