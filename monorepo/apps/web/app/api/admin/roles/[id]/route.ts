import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth/requireApiPermission";
import { deleteRoleById, findRoleById, updateRole } from "@/lib/db/roleRepo";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    const gate = await requireApiPermission("roles:read");
    if (gate instanceof NextResponse) return gate;

    const { id } = await params;
    const role = await findRoleById(id);
    if (!role) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ role });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const gate = await requireApiPermission("roles:update");
    if (gate instanceof NextResponse) return gate;

    const { id } = await params;
    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const b = body as { name?: unknown; description?: unknown; permissionCodes?: unknown; enabled?: unknown };
    const patch: { name?: string; description?: string; permissionCodes?: string[]; enabled?: boolean } = {};
    if (b.name !== undefined) {
        if (typeof b.name !== "string") return NextResponse.json({ error: "name must be a string" }, { status: 400 });
        patch.name = b.name;
    }
    if (b.description !== undefined) {
        if (typeof b.description !== "string") {
            return NextResponse.json({ error: "description must be a string" }, { status: 400 });
        }
        patch.description = b.description;
    }
    if (b.permissionCodes !== undefined) {
        if (!Array.isArray(b.permissionCodes)) {
            return NextResponse.json({ error: "permissionCodes must be an array" }, { status: 400 });
        }
        patch.permissionCodes = b.permissionCodes.filter((c): c is string => typeof c === "string");
    }
    if (b.enabled !== undefined) {
        if (typeof b.enabled !== "boolean") {
            return NextResponse.json({ error: "enabled must be a boolean" }, { status: 400 });
        }
        patch.enabled = b.enabled;
    }
    if (Object.keys(patch).length === 0) {
        return NextResponse.json({ error: "No updates provided" }, { status: 400 });
    }

    try {
        const role = await updateRole(id, patch);
        if (!role) return NextResponse.json({ error: "Not found" }, { status: 404 });
        return NextResponse.json({ role });
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const status = msg.includes("System roles cannot") ? 409 : 400;
        return NextResponse.json({ error: msg }, { status });
    }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const gate = await requireApiPermission("roles:delete");
    if (gate instanceof NextResponse) return gate;

    const { id } = await params;
    let detachUsers = false;
    try {
        const body = await request.json();
        const b = body as { detachUsers?: unknown };
        detachUsers = b.detachUsers === true;
    } catch {
        /* no body */
    }
    const result = await deleteRoleById(id, { detachUsers });
    if (!result.ok) {
        const status =
            result.reason === "not_found" ? 404 : result.reason === "system_role" || result.reason === "role_in_use" ? 409 : 400;
        return NextResponse.json({ error: result.reason ?? "delete_failed" }, { status });
    }
    return NextResponse.json({ ok: true });
}
