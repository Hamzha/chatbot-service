import { NextResponse } from "next/server";
import { getCurrentUserFromToken } from "@/lib/auth/authService";
import { getSessionCookie } from "@repo/auth/lib/cookies";

export async function GET() {
  const token = await getSessionCookie();
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await getCurrentUserFromToken(token);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ botId: user.id });
}
