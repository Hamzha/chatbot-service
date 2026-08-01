import { NextResponse } from "next/server";
import { listPublicSubscriptionPlans } from "@/lib/db/subscriptionPlanRepo";
import { withApiLogging } from "@/lib/api/withApiLogging";

async function getPublicPlans() {
    const plans = await listPublicSubscriptionPlans();
    return NextResponse.json({
        plans: plans.map((p) => ({
            id: p.id,
            name: p.name,
            slug: p.slug,
            description: p.description,
            amountCents: p.amountCents,
            currency: p.currency,
            interval: p.interval,
            features: p.features,
            highlighted: p.highlighted,
            sortOrder: p.sortOrder,
        })),
    });
}

export const GET = withApiLogging(getPublicPlans);
