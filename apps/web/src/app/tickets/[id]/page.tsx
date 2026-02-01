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
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Ticket Not Found</h1>
        <Link href="/" className="text-blue-600 hover:underline">
          ← Back to tickets
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <Link
        href="/"
        className="text-blue-600 hover:underline mb-4 inline-block"
      >
        ← Back to tickets
      </Link>
      <TicketDetail ticket={ticket} />
    </div>
  );
}
