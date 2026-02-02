import { TicketsPageContent } from "@/components/TicketsPageContent";
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

export default async function TicketsPage() {
  const { tickets, error } = await getTickets();

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
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
          Tickets
        </h1>
        <p
          style={{
            fontSize: "14px",
            color: "#616061",
            marginTop: "6px",
            marginBottom: 0,
          }}
        >
          Search and filter your support tickets
        </p>
      </div>

      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: "24px",
        }}
      >
        <TicketsPageContent
          initialTickets={tickets}
          initialError={error}
        />
      </div>
    </div>
  );
}
