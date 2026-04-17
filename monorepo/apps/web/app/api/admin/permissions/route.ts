import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth/requireApiPermission";
import { listPermissions } from "@/lib/db/permissionRepo";

export async function GET() {
    const gate = await requireApiPermission("roles:read");
    if (gate instanceof NextResponse) return gate;

    const permissions = await listPermissions();
    return NextResponse.json({ permissions });
}
