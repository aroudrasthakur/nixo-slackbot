import { DashboardContent } from "@/components/DashboardContent";
import type { Ticket } from "@nixo-slackbot/shared";

export const dynamic = "force-dynamic";

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
          borderBottom: "1px solid #e0d4e1",
          background: "linear-gradient(135deg, #f5eef6 0%, #ede4f0 50%, #f9f7fa 100%)",
          padding: "20px 24px",
        }}
      >
        <h1
          style={{
            fontSize: "22px",
            fontWeight: 700,
            color: "#3F0E40",
            margin: 0,
            lineHeight: 1.3,
          }}
        >
          Dashboard
        </h1>
        <p
          style={{
            fontSize: "14px",
            color: "#6b4e6d",
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
        <DashboardContent
          initialTickets={tickets}
          initialError={error}
        />
      </div>
    </div>
  );
}
