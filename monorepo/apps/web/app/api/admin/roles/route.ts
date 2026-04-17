import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth/requireApiPermission";
import { createRole, listRoles } from "@/lib/db/roleRepo";

export async function GET() {
    const gate = await requireApiPermission("roles:read");
    if (gate instanceof NextResponse) return gate;

    const roles = await listRoles();
    return NextResponse.json({ roles });
}

export async function POST(request: Request) {
    const gate = await requireApiPermission("roles:create");
    if (gate instanceof NextResponse) return gate;

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const b = body as { name?: unknown; slug?: unknown; description?: unknown; permissionCodes?: unknown };
    if (typeof b.name !== "string" || !b.name.trim()) {
        return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    if (typeof b.slug !== "string" || !b.slug.trim()) {
        return NextResponse.json({ error: "slug is required" }, { status: 400 });
    }
    if (!Array.isArray(b.permissionCodes)) {
        return NextResponse.json({ error: "permissionCodes must be an array" }, { status: 400 });
    }
    const permissionCodes = b.permissionCodes.filter((c): c is string => typeof c === "string");

    try {
        const role = await createRole({
            name: b.name,
            slug: b.slug,
            description: typeof b.description === "string" ? b.description : "",
            permissionCodes,
        });
        return NextResponse.json({ role }, { status: 201 });
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("duplicate") || msg.includes("E11000")) {
            return NextResponse.json({ error: "Role slug already exists" }, { status: 409 });
        }
        return NextResponse.json({ error: msg }, { status: 400 });
    }
}
