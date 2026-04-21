import { requirePagePermission } from "@/lib/auth/requirePagePermission";
import { ScraperClient } from "./ScraperClient";

export default async function ScraperPage() {
    await requirePagePermission("scraper:read");
    return <ScraperClient />;
}
