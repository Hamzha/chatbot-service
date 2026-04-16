import { NextResponse } from "next/server";
import { findUserById } from "@/lib/db/userRepo";
import { getWidgetConfig } from "@/lib/db/widgetConfigRepo";

/** Public endpoint — widget fetches its color config using the botId (no auth). */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ botId: string }> },
) {
  const { botId } = await params;

  if (!botId || !botId.trim()) {
    return NextResponse.json({ error: "Missing botId" }, { status: 400 });
  }

  const user = await findUserById(botId.trim());
  if (!user) {
    return NextResponse.json({ error: "Invalid botId" }, { status: 404 });
  }

  const config = await getWidgetConfig(botId.trim());

  return NextResponse.json({
    primaryColor: config?.primaryColor ?? "#0f766e",
  });
}
