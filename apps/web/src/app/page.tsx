import Link from "next/link";

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

export default function HomePage() {
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#ffffff" }}>
      {/* Navigation */}
      <nav
        style={{
          padding: "16px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          maxWidth: "1200px",
          margin: "0 auto",
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
          <span
            style={{ fontSize: "20px", fontWeight: 700, color: "#1d1c1d" }}
          >
            Nixo Bot
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <Link
            href="/signin"
            style={{
              padding: "10px 20px",
              fontSize: "14px",
              fontWeight: 600,
              color: "#1d1c1d",
              textDecoration: "none",
              borderRadius: "6px",
              transition: "background-color 0.15s",
            }}
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            style={{
              padding: "10px 20px",
              fontSize: "14px",
              fontWeight: 600,
              color: "#ffffff",
              backgroundColor: "#3F0E40",
              textDecoration: "none",
              borderRadius: "6px",
              transition: "background-color 0.15s",
            }}
          >
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section
        style={{
          padding: "80px 24px",
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
          Support tickets,{" "}
          <span style={{ color: "#3F0E40" }}>simplified</span>
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
          }}
        >
          <Link
            href="/signup"
            style={{
              padding: "16px 32px",
              fontSize: "16px",
              fontWeight: 600,
              color: "#ffffff",
              backgroundColor: "#007a5a",
              textDecoration: "none",
              borderRadius: "8px",
              transition: "background-color 0.15s",
            }}
          >
            Start for free
          </Link>
          <Link
            href="/signin"
            style={{
              padding: "16px 32px",
              fontSize: "16px",
              fontWeight: 600,
              color: "#1d1c1d",
              backgroundColor: "#ffffff",
              border: "1px solid #dddddd",
              textDecoration: "none",
              borderRadius: "8px",
              transition: "all 0.15s",
            }}
          >
            Sign in
          </Link>
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
                  backgroundColor: "#ffffff",
                  borderRadius: "12px",
                  padding: "28px",
                  border: "1px solid #e8e8e8",
                }}
              >
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
                    color: "#1d1c1d",
                    margin: "0 0 8px 0",
                  }}
                >
                  {feature.title}
                </h3>
                <p
                  style={{
                    fontSize: "15px",
                    color: "#616061",
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
        <Link
          href="/signup"
          style={{
            display: "inline-block",
            padding: "16px 40px",
            fontSize: "16px",
            fontWeight: 600,
            color: "#3F0E40",
            backgroundColor: "#ffffff",
            textDecoration: "none",
            borderRadius: "8px",
            transition: "transform 0.15s",
          }}
        >
          Create free account
        </Link>
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
          &copy; 2025 Nixo Bot. Built for modern support teams.
        </p>
      </footer>
    </div>
  );
}
