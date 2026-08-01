import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { requireApiPermission } from "@/lib/auth/requireApiPermission";
import { notFoundError, parseJsonBody, validationError } from "@/lib/api/routeValidation";
import { withApiLogging } from "@/lib/api/withApiLogging";
import { requireRateLimitByUser } from "@/lib/rateLimit/requireRateLimit";
import { listRoles } from "@/lib/db/roleRepo";
import { getAdminUserRow, updateUserRoleIds } from "@/lib/db/userRepo";

const patchUserRoleIdsSchema = z.object({
    roleIds: z
        .array(z.string().trim().min(1, "roleIds must contain only strings"))
        .superRefine((roleIds, ctx) => {
            for (const roleId of roleIds) {
                if (!mongoose.Types.ObjectId.isValid(roleId)) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: "Each roleIds entry must be a valid Mongo ObjectId string",
                    });
                    return;
                }
            }
        }),
});

async function getUserById(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    const gate = await requireApiPermission("users:read");
    if (gate instanceof NextResponse) return gate;
    const limited = await requireRateLimitByUser(gate.ctx.userId, "admin:users:item:read", {
        limit: 90,
        windowSec: 60,
    });
    if (limited) return limited;

    const { id } = await params;
    const user = await getAdminUserRow(id);
    if (!user) {
        return notFoundError();
    }
    return NextResponse.json({ user });
}

async function patchUserById(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const gate = await requireApiPermission("users:update");
    if (gate instanceof NextResponse) return gate;
    const limited = await requireRateLimitByUser(gate.ctx.userId, "admin:users:item:update", {
        limit: 30,
        windowSec: 60,
    });
    if (limited) return limited;

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return validationError("Invalid user id");
    }

    const parsed = await parseJsonBody(request, patchUserRoleIdsSchema);
    if (!parsed.ok) return parsed.response;
    const roleIds = [...new Set(parsed.data.roleIds)];

    const knownRoles = await listRoles();
    const allowed = new Set(knownRoles.map((r) => r.id));
    for (const rid of roleIds) {
        if (!allowed.has(rid)) {
            return validationError(`Unknown role id: ${rid}`);
        }
    }

    const updated = await updateUserRoleIds(id, roleIds);
    if (!updated) {
        return notFoundError();
    }

    const user = await getAdminUserRow(id);
    return NextResponse.json({ user });
}

export const GET = withApiLogging(getUserById);
export const PATCH = withApiLogging(patchUserById);
