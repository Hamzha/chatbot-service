"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PricingCheckoutButton } from "@/components/billing/PricingCheckoutButton";

type PublicPlan = {
    id: string;
    name: string;
    slug: string;
    description: string;
    amountCents: number;
    currency: string;
    interval: "month" | "year";
    features: string[];
    highlighted: boolean;
};

function SectionHeading({
    eyebrow,
    title,
    description,
}: {
    eyebrow: string;
    title: string;
    description: string;
}) {
    return (
        <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">
                {eyebrow}
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
                {title}
            </h2>
            <p className="mt-3 text-base leading-7 text-slate-600">{description}</p>
        </div>
    );
}

function formatMoney(amountCents: number, currency: string): string {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currency.toUpperCase(),
        minimumFractionDigits: amountCents % 100 === 0 ? 0 : 2,
    }).format(amountCents / 100);
}

export function PricingSection({ loggedIn }: { loggedIn: boolean }) {
    const [plans, setPlans] = useState<PublicPlan[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch("/api/billing/plans");
                if (!res.ok) throw new Error("failed");
                const data = (await res.json()) as { plans: PublicPlan[] };
                if (!cancelled) setPlans(data.plans ?? []);
            } catch {
                if (!cancelled) setPlans([]);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const trialTier = {
        name: "Trial",
        price: "$0",
        cadence: "/ start",
        tagline: "Log in and use — limits set by your admin.",
        features: [
            "Scraper + crawl (shared quota)",
            "PDF uploads",
            "Bots + dashboard chats",
            "Widget messages (limited)",
        ],
    };

    return (
        <section id="pricing" className="mx-auto w-full max-w-6xl scroll-mt-28">
            <SectionHeading
                eyebrow="Pricing"
                title="Start in trial mode, scale when you need"
                description="Free trial uses admin-configured limits. Paid plans are managed in admin, synced to Stripe, then shown here after Sync."
            />

            {loading ? (
                <p className="mt-10 text-center text-sm text-slate-600">Loading plans…</p>
            ) : (
                <div
                    className={`mt-10 grid gap-5 ${
                        plans.length >= 2 ? "md:grid-cols-3" : "md:grid-cols-2"
                    }`}
                >
                    <div className="glass rounded-2xl p-6">
                        <p className="text-sm font-semibold text-slate-900">{trialTier.name}</p>
                        <div className="mt-3 flex items-baseline gap-1">
                            <span className="text-4xl font-semibold tracking-tight text-slate-900">
                                {trialTier.price}
                            </span>
                            <span className="text-sm text-slate-600">{trialTier.cadence}</span>
                        </div>
                        <p className="mt-2 text-sm text-slate-600">{trialTier.tagline}</p>
                        <ul className="mt-5 space-y-2 text-sm text-slate-700">
                            {trialTier.features.map((f) => (
                                <li key={f} className="flex items-start gap-2">
                                    <CheckIcon />
                                    <span>{f}</span>
                                </li>
                            ))}
                        </ul>
                        <Link
                            href={loggedIn ? "/dashboard" : "/signup"}
                            className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700"
                        >
                            {loggedIn ? "Open dashboard" : "Start free trial"}
                        </Link>
                    </div>

                    {plans.length === 0 ? (
                        <div className="glass rounded-2xl p-6 md:col-span-2">
                            <p className="text-sm font-semibold text-slate-900">Paid plans coming soon</p>
                            <p className="mt-2 text-sm text-slate-600">
                                An admin can add subscription plans under Dashboard → Subscription plans
                                and click Sync to Stripe. Synced plans will show up here for purchase.
                            </p>
                        </div>
                    ) : (
                        plans.map((plan) => (
                            <div
                                key={plan.id}
                                className={
                                    plan.highlighted
                                        ? "glass-strong relative rounded-2xl border-brand-300 p-6 shadow-xl shadow-brand-500/10"
                                        : "glass rounded-2xl p-6"
                                }
                            >
                                {plan.highlighted ? (
                                    <span className="absolute -top-3 right-6 rounded-full bg-brand-700 px-3 py-1 text-xs font-bold text-white shadow-md shadow-brand-700/30">
                                        Most popular
                                    </span>
                                ) : null}
                                <p className="text-sm font-semibold text-slate-900">{plan.name}</p>
                                <div className="mt-3 flex items-baseline gap-1">
                                    <span className="text-4xl font-semibold tracking-tight text-slate-900">
                                        {formatMoney(plan.amountCents, plan.currency)}
                                    </span>
                                    <span className="text-sm text-slate-600">
                                        / {plan.interval === "year" ? "year" : "month"}
                                    </span>
                                </div>
                                <p className="mt-2 text-sm text-slate-600">
                                    {plan.description || "Upgrade for higher limits."}
                                </p>
                                <ul className="mt-5 space-y-2 text-sm text-slate-700">
                                    {(plan.features.length
                                        ? plan.features
                                        : ["Higher usage limits", "Priority access"]
                                    ).map((f) => (
                                        <li key={f} className="flex items-start gap-2">
                                            <CheckIcon />
                                            <span>{f}</span>
                                        </li>
                                    ))}
                                </ul>
                                <PricingCheckoutButton
                                    planId={plan.id}
                                    planSlug={plan.slug}
                                    label={loggedIn ? `Upgrade to ${plan.name}` : `Start ${plan.name}`}
                                    highlighted={plan.highlighted}
                                    loggedIn={loggedIn}
                                />
                            </div>
                        ))
                    )}
                </div>
            )}
        </section>
    );
}

function CheckIcon() {
    return (
        <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            className="mt-0.5 h-4 w-4 shrink-0 text-brand-600"
            aria-hidden
        >
            <path
                fillRule="evenodd"
                d="M16.704 5.29a1 1 0 010 1.42l-8 8a1 1 0 01-1.42 0l-4-4a1 1 0 111.42-1.42L8 12.58l7.29-7.29a1 1 0 011.414 0z"
                clipRule="evenodd"
            />
        </svg>
    );
}
