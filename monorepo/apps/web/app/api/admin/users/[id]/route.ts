import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireApiPermission } from "@/lib/auth/requireApiPermission";
import { listRoles } from "@/lib/db/roleRepo";
import { getAdminUserRow, updateUserRoleIds } from "@/lib/db/userRepo";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    const gate = await requireApiPermission("users:read");
    if (gate instanceof NextResponse) return gate;

    const { id } = await params;
    const user = await getAdminUserRow(id);
    if (!user) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ user });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const gate = await requireApiPermission("users:update");
    if (gate instanceof NextResponse) return gate;

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
    }

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const b = body as { roleIds?: unknown };
    if (!Array.isArray(b.roleIds)) {
        return NextResponse.json({ error: "roleIds must be an array of role id strings" }, { status: 400 });
    }
    const inputs = b.roleIds.filter((x): x is string => typeof x === "string");
    if (inputs.length !== b.roleIds.length) {
        return NextResponse.json({ error: "roleIds must contain only strings" }, { status: 400 });
    }
    const invalid = inputs.filter((id) => !mongoose.Types.ObjectId.isValid(id));
    if (invalid.length > 0) {
        return NextResponse.json({ error: "Each roleIds entry must be a valid Mongo ObjectId string" }, { status: 400 });
    }
    const roleIds = [...new Set(inputs)];

    const knownRoles = await listRoles();
    const allowed = new Set(knownRoles.map((r) => r.id));
    for (const rid of roleIds) {
        if (!allowed.has(rid)) {
            return NextResponse.json({ error: `Unknown role id: ${rid}` }, { status: 400 });
        }
    }

    const updated = await updateUserRoleIds(id, roleIds);
    if (!updated) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const user = await getAdminUserRow(id);
    return NextResponse.json({ user });
}
