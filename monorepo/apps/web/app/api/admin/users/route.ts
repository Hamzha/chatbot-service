import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth/requireApiPermission";
import { listUsersForAdmin } from "@/lib/db/userRepo";

export async function GET() {
    const gate = await requireApiPermission("users:read");
    if (gate instanceof NextResponse) return gate;

    const users = await listUsersForAdmin();
    return NextResponse.json({ users });
}
