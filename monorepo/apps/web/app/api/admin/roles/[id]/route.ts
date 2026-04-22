import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiPermission } from "@/lib/auth/requireApiPermission";
import {
    conflictError,
    errorMessage,
    notFoundError,
    parseJsonBody,
    validationError,
} from "@/lib/api/routeValidation";
import { withApiLogging } from "@/lib/api/withApiLogging";
import { requireRateLimitByUser } from "@/lib/rateLimit/requireRateLimit";
import { deleteRoleById, findRoleById, updateRole } from "@/lib/db/roleRepo";

const updateRoleSchema = z
    .object({
        name: z.string().optional(),
        description: z.string().optional(),
        permissionCodes: z.array(z.string()).optional(),
        enabled: z.boolean().optional(),
    })
    .refine((v) => Object.keys(v).length > 0, { message: "No updates provided" });

const deleteRoleSchema = z.object({ detachUsers: z.boolean().optional().default(false) });

async function getRoleById(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    const gate = await requireApiPermission("roles:read");
    if (gate instanceof NextResponse) return gate;
    const limited = await requireRateLimitByUser(gate.ctx.userId, "admin:roles:item:read", {
        limit: 90,
        windowSec: 60,
    });
    if (limited) return limited;

    const { id } = await params;
    const role = await findRoleById(id);
    if (!role) {
        return notFoundError();
    }
    return NextResponse.json({ role });
}

async function patchRoleById(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const gate = await requireApiPermission("roles:update");
    if (gate instanceof NextResponse) return gate;
    const limited = await requireRateLimitByUser(gate.ctx.userId, "admin:roles:item:update", {
        limit: 30,
        windowSec: 60,
    });
    if (limited) return limited;

    const { id } = await params;
    const parsed = await parseJsonBody(request, updateRoleSchema);
    if (!parsed.ok) return parsed.response;
    const patch = parsed.data;

    try {
        const role = await updateRole(id, patch);
        if (!role) return notFoundError();
        return NextResponse.json({ role });
    } catch (error) {
        const msg = errorMessage(error, "Failed to update role");
        const status = msg.includes("System roles cannot") ? 409 : 400;
        return status === 409 ? conflictError(msg) : validationError(msg);
    }
}

async function deleteRole(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const gate = await requireApiPermission("roles:delete");
    if (gate instanceof NextResponse) return gate;
    const limited = await requireRateLimitByUser(gate.ctx.userId, "admin:roles:item:delete", {
        limit: 20,
        windowSec: 60,
    });
    if (limited) return limited;

    const { id } = await params;
    let detachUsers = false;
    if ((request.headers.get("content-length") ?? "0") !== "0") {
        const parsed = await parseJsonBody(request, deleteRoleSchema);
        if (!parsed.ok) return parsed.response;
        detachUsers = parsed.data.detachUsers;
    }
    const result = await deleteRoleById(id, { detachUsers });
    if (!result.ok) {
        const status =
            result.reason === "not_found" ? 404 : result.reason === "system_role" || result.reason === "role_in_use" ? 409 : 400;
        if (status === 404) return notFoundError();
        if (status === 409) return conflictError(result.reason ?? "delete_failed");
        return validationError(result.reason ?? "delete_failed");
    }
    return NextResponse.json({ ok: true });
}

export const GET = withApiLogging(getRoleById);
export const PATCH = withApiLogging(patchRoleById);
export const DELETE = withApiLogging(deleteRole);
