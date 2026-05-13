import { requirePagePermission } from "@/lib/auth/requirePagePermission";
import { TicketClient } from "./TicketClient";

type Params = Promise<{ ticketId: string }>;

export default async function TicketPage({ params }: { params: Params }) {
    await requirePagePermission("escalations:read");
    const { ticketId } = await params;
    return <TicketClient ticketId={ticketId} />;
}
