import { DashboardTickets } from "@/components/DashboardTickets";
import { StatsCards } from "@/components/StatsCards";
import type { Ticket } from "@nixo-slackbot/shared";

async function getTickets(): Promise<{ tickets: Ticket[]; error?: string }> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_ORIGIN || "http://localhost:3000";
  try {
    const res = await fetch(`${baseUrl}/api/tickets`, {
      cache: "no-store",
    });

    if (!res.ok) {
      return { tickets: [], error: "Failed to load tickets" };
    }

    const tickets = await res.json();
    return { tickets: Array.isArray(tickets) ? tickets : [] };
  } catch (error) {
    console.error("Failed to fetch tickets:", error);
    return { tickets: [], error: "Could not reach the server. Is the backend running?" };
  }
}

export default async function DashboardPage() {
  const { tickets, error } = await getTickets();

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div
        style={{
          borderBottom: "1px solid #e8e8e8",
          backgroundColor: "#ffffff",
          padding: "20px 24px",
        }}
      >
        <h1
          style={{
            fontSize: "22px",
            fontWeight: 700,
            color: "#1d1c1d",
            margin: 0,
            lineHeight: 1.3,
          }}
        >
          Dashboard
        </h1>
        <p
          style={{
            fontSize: "14px",
            color: "#616061",
            marginTop: "6px",
            marginBottom: 0,
          }}
        >
          Overview of your support tickets from Slack
        </p>
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: "24px",
        }}
      >
        {/* Connection error */}
        {error && (
          <div
            style={{
              padding: "16px 20px",
              marginBottom: "24px",
              backgroundColor: "#fef0f0",
              border: "1px solid #e01e5a",
              borderRadius: "8px",
              color: "#e01e5a",
              fontSize: "14px",
            }}
          >
            {error} Ensure the backend is running on the URL in <code style={{ fontSize: "12px" }}>NEXT_PUBLIC_API_URL</code> and try again.
          </div>
        )}

        {/* Stats Cards */}
        <StatsCards tickets={tickets} />

        {/* Section Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "16px",
          }}
        >
          <h2
            style={{
              fontSize: "16px",
              fontWeight: 600,
              color: "#1d1c1d",
              margin: 0,
            }}
          >
            All Tickets
          </h2>
        </div>

        {/* Tickets */}
        <DashboardTickets initialTickets={tickets} />
      </div>
    </div>
  );
}
