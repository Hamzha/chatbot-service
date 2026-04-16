import { NextResponse } from "next/server";
import { getCurrentUserFromToken } from "@/lib/auth/authService";
import { getSessionCookie } from "@repo/auth/lib/cookies";
import { getWidgetConfig, upsertWidgetConfig } from "@/lib/db/widgetConfigRepo";

const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;

async function getAuthedUserId(): Promise<string | null> {
  const token = await getSessionCookie();
  if (!token) return null;
  const user = await getCurrentUserFromToken(token);
  return user?.id ?? null;
}

export async function GET() {
  const userId = await getAuthedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const config = await getWidgetConfig(userId);
  return NextResponse.json({
    primaryColor: config?.primaryColor ?? "#0f766e",
  });
}

export async function PUT(request: Request) {
  const userId = await getAuthedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const b = body as { primaryColor?: unknown };

  if (typeof b.primaryColor !== "string" || !HEX_COLOR_REGEX.test(b.primaryColor)) {
    return NextResponse.json(
      { error: "primaryColor must be a valid hex color (e.g. #0f766e)" },
      { status: 400 },
    );
  }

  const config = await upsertWidgetConfig(userId, b.primaryColor);
  return NextResponse.json({
    primaryColor: config.primaryColor,
  });
}
