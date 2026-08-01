import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiPermission } from "@/lib/auth/requireApiPermission";
import { conflictError, errorMessage, parseJsonBody, validationError } from "@/lib/api/routeValidation";
import { withApiLogging } from "@/lib/api/withApiLogging";
import { requireRateLimitByUser } from "@/lib/rateLimit/requireRateLimit";
import { createRole, listRoles } from "@/lib/db/roleRepo";

const createRoleSchema = z.object({
    name: z.string().trim().min(1, "name is required"),
    slug: z.string().trim().min(1, "slug is required"),
    description: z.string().optional().default(""),
    permissionCodes: z.array(z.string()).default([]),
});

async function getRoles() {
    const gate = await requireApiPermission("roles:read");
    if (gate instanceof NextResponse) return gate;
    const limited = await requireRateLimitByUser(gate.ctx.userId, "admin:roles:read", {
        limit: 60,
        windowSec: 60,
    });
    if (limited) return limited;

    const roles = await listRoles();
    return NextResponse.json({ roles });
}

async function postRoles(request: Request) {
    const gate = await requireApiPermission("roles:create");
    if (gate instanceof NextResponse) return gate;
    const limited = await requireRateLimitByUser(gate.ctx.userId, "admin:roles:create", {
        limit: 20,
        windowSec: 60,
    });
    if (limited) return limited;
    const parsed = await parseJsonBody(request, createRoleSchema);
    if (!parsed.ok) return parsed.response;
    const { name, slug, description, permissionCodes } = parsed.data;

    try {
        const role = await createRole({
            name,
            slug,
            description,
            permissionCodes,
        });
        return NextResponse.json({ role }, { status: 201 });
    } catch (error) {
        const msg = errorMessage(error, "Failed to create role");
        if (msg.includes("duplicate") || msg.includes("E11000")) {
            return conflictError("Role slug already exists");
        }
        return validationError(msg);
    }
}

export const GET = withApiLogging(getRoles);
export const POST = withApiLogging(postRoles);
