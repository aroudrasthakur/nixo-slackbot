import { TicketDetail } from "@/components/TicketDetail";
import type { TicketWithMessages } from "@nixo-slackbot/shared";
import Link from "next/link";

async function getTicket(id: string): Promise<TicketWithMessages | null> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
  const res = await fetch(`${apiUrl}/api/tickets/${id}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    if (res.status === 404) {
      return null;
    }
    throw new Error("Failed to fetch ticket");
  }

  return res.json();
}

export default async function TicketPage({
  params,
}: {
  params: { id: string };
}) {
  const ticket = await getTicket(params.id);

  if (!ticket) {
    return (
      <div
        style={{
          minHeight: "100vh",
          backgroundColor: "#f4f4f4",
          padding: "24px",
        }}
      >
        <div style={{ maxWidth: "800px", margin: "0 auto" }}>
          <Link
            href="/dashboard"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              color: "#1d1c1d",
              fontWeight: 700,
              fontSize: "14px",
              textDecoration: "none",
              marginBottom: "24px",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M11 2L5 8l6 6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Back to tickets
          </Link>
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "8px",
              padding: "40px",
              textAlign: "center",
            }}
          >
            <h1
              style={{
                fontSize: "20px",
                fontWeight: 700,
                color: "#1d1c1d",
                marginBottom: "8px",
              }}
            >
              Ticket Not Found
            </h1>
            <p style={{ color: "#616061", fontSize: "14px" }}>
              The ticket you&apos;re looking for doesn&apos;t exist or has been removed.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#f4f4f4",
        padding: "24px",
      }}
    >
      <div style={{ maxWidth: "800px", margin: "0 auto" }}>
        {/* Back button */}
        <Link
          href="/dashboard"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            color: "#1d1c1d",
            fontWeight: 700,
            fontSize: "14px",
            textDecoration: "none",
            marginBottom: "20px",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M11 2L5 8l6 6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back to tickets
        </Link>

        <TicketDetail ticket={ticket} />
      </div>
    </div>
  );
}
