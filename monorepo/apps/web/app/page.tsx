import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import Script from "next/script";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { SiteFooter } from "@/components/shell/SiteFooter";
import { getCurrentUserFromToken } from "@/lib/auth/authService";
import { getSessionCookie } from "@repo/auth/lib/cookies";

const SITE_NAME = "AI Chatbot Platform";
const SITE_TAGLINE =
  "Turn your docs and websites into a production chatbot your team can trust.";
const SITE_DESCRIPTION =
  "Crawl websites, upload PDFs, and deliver RAG-backed answers through a secure dashboard or an embeddable widget. Email verification, per-user vector isolation, and cited sources on every answer.";

function getSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (raw) return raw.replace(/\/$/, "");
  return "http://localhost:3000";
}

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: `${SITE_NAME} — RAG chatbot for your docs and websites`,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "AI chatbot",
    "RAG",
    "retrieval augmented generation",
    "web scraping",
    "PDF chatbot",
    "embeddable chatbot widget",
    "knowledge base chatbot",
    "customer support AI",
  ],
  authors: [{ name: SITE_NAME }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  alternates: { canonical: "/" },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: SITE_NAME,
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
  },
  category: "technology",
  formatDetection: { email: false, address: false, telephone: false },
};

type NavLink = { href: string; label: string };

const PRIMARY_NAV: NavLink[] = [
  { href: "#product", label: "Product" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#features", label: "Features" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

export default function Home() {
  const widgetUrl = process.env.NEXT_PUBLIC_CHATBOT_WIDGET_URL?.trim();
  const widgetBotId = process.env.NEXT_PUBLIC_CHATBOT_WIDGET_BOT_ID?.trim();
  const siteUrl = getSiteUrl();

  return (
    <>
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-slate-900 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg"
      >
        Skip to main content
      </a>

      <TopBar />

      <main
        id="content"
        tabIndex={-1}
        className="relative flex flex-col gap-14 px-4 pb-20 pt-24 sm:gap-20 sm:px-6 sm:pb-24 sm:pt-32 lg:px-10 focus:outline-none"
      >
        <Hero />
        <ProductPreview />
        <HowItWorks />
        <Features />
        <Pricing />
        <Faq />
        <FinalCta />
      </main>

      <div className="px-4 pb-8 pt-4 sm:px-6 sm:pb-10 lg:px-10">
        <SiteFooter width="6xl" />
      </div>

      <StructuredData siteUrl={siteUrl} />

      {widgetUrl && widgetBotId ? (
        <Script
          src={widgetUrl}
          data-bot-id={widgetBotId}
          strategy="lazyOnload"
        />
      ) : null}
    </>
  );
}

async function resolveUser(): Promise<User> {
  try {
    const token = await getSessionCookie();
    if (!token) return null;
    const u = await getCurrentUserFromToken(token);
    return u ? { email: u.email } : null;
  } catch {
    return null;
  }
}

function StructuredData({ siteUrl }: { siteUrl: string }) {
  const organization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: siteUrl,
    logo: `${siteUrl}/favicon.ico`,
  };
  const website = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: siteUrl,
    description: SITE_DESCRIPTION,
    inLanguage: "en-US",
  };
  const softwareApplication = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: SITE_NAME,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description: SITE_DESCRIPTION,
    url: siteUrl,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  };
  const faqPage = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <>
      <script
        id="ld-organization"
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organization) }}
      />
      <script
        id="ld-website"
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(website) }}
      />
      <script
        id="ld-software"
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplication) }}
      />
      <script
        id="ld-faq"
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqPage) }}
      />
    </>
  );
}

type User = { email: string } | null;

function TopBar() {
  return (
    <header className="fixed inset-x-0 top-0 z-40 px-3 pt-3 sm:px-6 sm:pt-4 lg:px-10">
      <div className="glass mx-auto flex max-w-6xl items-center justify-between gap-2 rounded-2xl px-3 py-2.5 sm:px-6 sm:py-3">
        <Link
          href="/"
          className="flex min-w-0 items-center gap-2"
          aria-label="AI Chatbot Platform — home"
        >
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-700 text-sm font-bold text-white shadow-md shadow-brand-700/30"
            aria-hidden="true"
          >
            AI
          </span>
          <span className="truncate text-sm font-semibold tracking-tight text-slate-900 sm:text-base">
            <span className="hidden sm:inline">Chatbot Platform</span>
            <span className="sm:hidden">Chatbot</span>
          </span>
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-2 md:flex lg:gap-4">
          {PRIMARY_NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="inline-flex items-center rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-white/60 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <MobileNav />
          <Suspense fallback={<HeaderCtaGuest />}>
            <HeaderCtaAsync />
          </Suspense>
        </div>
      </div>
    </header>
  );
}

function MobileNav() {
  return (
    <details className="group relative md:hidden">
      <summary
        aria-label="Open navigation menu"
        className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-xl text-slate-700 transition hover:bg-white/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 [&::-webkit-details-marker]:hidden"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5 group-open:hidden"
          aria-hidden="true"
        >
          <path d="M4 7h16" />
          <path d="M4 12h16" />
          <path d="M4 17h16" />
        </svg>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="hidden h-5 w-5 group-open:block"
          aria-hidden="true"
        >
          <path d="M6 6l12 12" />
          <path d="M6 18L18 6" />
        </svg>
      </summary>
      <nav
        aria-label="Mobile primary"
        className="glass absolute right-0 top-[calc(100%+0.5rem)] w-60 rounded-2xl p-2 shadow-xl shadow-slate-900/10"
      >
        <ul className="flex flex-col">
          {PRIMARY_NAV.map((item) => (
            <li key={item.href}>
              <a
                href={item.href}
                className="block rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-white/70 hover:text-slate-900"
              >
                {item.label}
              </a>
            </li>
          ))}
          <li className="mt-1 border-t border-slate-200/70 pt-1">
            <Link
              href="/login"
              className="block rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-white/70 hover:text-slate-900"
            >
              Log in
            </Link>
          </li>
        </ul>
      </nav>
    </details>
  );
}

function HeaderCtaGuest() {
  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      <Link
        href="/login"
        className="hidden rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white/60 md:inline-flex"
      >
        Log in
      </Link>
      <Link
        href="/signup"
        className="inline-flex items-center justify-center rounded-xl bg-brand-700 px-3 py-2 text-sm font-semibold text-white shadow-md shadow-brand-700/30 transition hover:bg-brand-800 sm:px-4"
      >
        Start free
      </Link>
    </div>
  );
}

async function HeaderCtaAsync() {
  const user = await resolveUser();
  if (!user) return <HeaderCtaGuest />;
  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      <Link
        href="/dashboard"
        className="inline-flex items-center justify-center rounded-xl bg-brand-700 px-3 py-2 text-sm font-semibold text-white shadow-md shadow-brand-700/30 transition hover:bg-brand-800 sm:px-4"
      >
        <span className="hidden sm:inline">Go to dashboard</span>
        <span className="sm:hidden">Dashboard</span>
      </Link>
    </div>
  );
}

function Hero() {
  return (
    <section className="mx-auto w-full max-w-6xl">
      <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-6 sm:space-y-7">
          <p className="inline-flex items-center gap-2 rounded-full border border-brand-200/70 bg-brand-50/80 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-brand-700 sm:text-xs sm:tracking-[0.16em]">
            <span className="inline-block h-2 w-2 rounded-full bg-brand-500" aria-hidden="true" />
            Scrape · Ingest · Answer
          </p>

          <h1 className="text-[2rem] font-semibold leading-[1.1] tracking-tight text-slate-900 sm:text-4xl md:text-5xl lg:text-6xl">
            Turn your docs and websites into a{" "}
            <span className="bg-linear-to-r from-brand-600 via-brand-500 to-indigo-500 bg-clip-text text-transparent">
              production chatbot
            </span>{" "}
            your team can trust.
          </h1>

          <p className="max-w-xl text-base leading-7 text-slate-600 sm:text-lg">
            Crawl websites, upload PDFs, and deliver RAG-backed answers through a secure
            dashboard or an embeddable widget — all from one operational console with
            auth, email verification, and role-based permissions built in.
          </p>

          <Suspense fallback={<HeroCtaGuest />}>
            <HeroCtaAsync />
          </Suspense>

          <dl className="grid max-w-md grid-cols-3 gap-3 pt-2 sm:gap-4 sm:pt-4">
            <Stat value="Static + JS" label="Scraping modes" />
            <Stat value="Multi-tenant" label="Per-user vectors" />
            <Stat value="1 snippet" label="Widget install" />
          </dl>
        </div>

        <HeroAppPreview />
      </div>
    </section>
  );
}

function HeroCtaGuest() {
  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <Link
          href="/signup"
          className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 transition hover:bg-slate-700"
        >
          Create account
        </Link>
        <Link
          href="/login"
          className="glass inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-white/80"
        >
          Already using it? Sign in
        </Link>
      </div>
      <p className="text-sm text-slate-600">
        New accounts require email verification before first login.
      </p>
    </>
  );
}

async function HeroCtaAsync() {
  const user = await resolveUser();
  if (!user) return <HeroCtaGuest />;
  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <Link
          href="/dashboard"
          className="inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 transition hover:bg-slate-700 sm:w-auto"
        >
          Open dashboard
        </Link>
        <LogoutButton className="glass inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-slate-800 transition hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto" />
      </div>
      <p className="glass inline-flex w-full max-w-full items-center gap-2 self-start rounded-xl border-emerald-200/60 px-3 py-2 text-sm text-emerald-800 sm:w-auto">
        <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-emerald-500" aria-hidden="true" />
        <span className="min-w-0 truncate">
          Signed in as <span className="font-semibold">{user.email}</span>
        </span>
      </p>
    </>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-base font-semibold leading-tight text-slate-900 sm:text-lg">
        {value}
      </dt>
      <dd className="mt-0.5 text-[0.65rem] font-medium uppercase leading-tight tracking-wider text-slate-600 sm:text-xs">
        {label}
      </dd>
    </div>
  );
}

function HeroAppPreview() {
  return (
    <div className="relative isolate">
      <div
        className="pointer-events-none absolute -inset-3 -z-10 rounded-4xl bg-linear-to-br from-brand-400/30 via-indigo-400/20 to-amber-300/20 blur-2xl sm:-inset-6"
        aria-hidden
      />
      <div className="glass-strong rounded-3xl p-3 sm:p-5">
        <div className="flex items-center gap-2 border-b border-white/40 pb-3">
          <div className="flex shrink-0 items-center gap-1.5" aria-hidden="true">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-400/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
          </div>
          <p className="min-w-0 flex-1 truncate text-center text-xs font-mono text-slate-600">
            app/dashboard/chatbot
          </p>
          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
            Preview
          </span>
        </div>

        <div className="grid gap-4 pt-4 sm:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600">
              Sessions
            </p>
            {[
              { name: "Gentiva FAQ", active: true },
              { name: "Product docs" },
              { name: "Internal HR" },
            ].map((s) => (
              <div
                key={s.name}
                className={
                  s.active
                    ? "rounded-xl border border-brand-200 bg-brand-50/80 px-3 py-2 text-sm font-semibold text-brand-800"
                    : "rounded-xl border border-white/40 bg-white/40 px-3 py-2 text-sm text-slate-600"
                }
              >
                {s.name}
              </div>
            ))}
            <div className="mt-3 rounded-xl border border-dashed border-slate-300/80 px-3 py-2 text-xs text-slate-600">
              + New chat
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-2xl bg-white/70 p-3">
            <div className="ml-auto max-w-[85%] wrap-break-word rounded-2xl rounded-tr-sm bg-slate-900 px-3 py-2 text-sm text-white">
              What&apos;s our refund policy for annual plans?
            </div>
            <div className="max-w-[90%] wrap-break-word rounded-2xl rounded-tl-sm bg-brand-50 px-3 py-2 text-sm text-slate-800">
              Annual plans are eligible for a prorated refund within 30 days of renewal.
              Cite: <span className="break-all font-mono text-xs text-brand-700">billing.pdf</span>
              ,{" "}
              <span className="break-all font-mono text-xs text-brand-700">
                help.site.com/refunds
              </span>
              .
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
              <span className="text-sm text-slate-600">Ask anything…</span>
              <span className="ml-auto rounded-lg bg-brand-700 px-2 py-1 text-xs font-semibold text-white">
                Send
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

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
    <div className="mx-auto max-w-3xl text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">
        {eyebrow}
      </p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
        {title}
      </h2>
      <p className="mt-4 text-base leading-7 text-slate-600">{description}</p>
    </div>
  );
}

function ProductPreview() {
  return (
    <section id="product" className="mx-auto w-full max-w-6xl scroll-mt-28">
      <SectionHeading
        eyebrow="Product"
        title="Three screens you actually use"
        description="No stock photography — these match the real flows in your dashboard: crawl a site, ingest documents, and chat with cited answers."
      />

      <div className="mt-10 grid gap-5 lg:grid-cols-3">
        <ScraperPreview />
        <UploadPreview />
        <ChatbotPreview />
      </div>
    </section>
  );
}

function PreviewShell({
  path,
  caption,
  children,
}: {
  path: string;
  caption: string;
  children: React.ReactNode;
}) {
  return (
    <div className="glass-strong flex h-full flex-col rounded-2xl p-4">
      <div className="flex items-center gap-2 border-b border-white/40 pb-2">
        <p className="min-w-0 flex-1 truncate font-mono text-xs text-slate-600">
          {path}
        </p>
        <div className="flex shrink-0 gap-1" aria-hidden="true">
          <span className="h-2 w-2 rounded-full bg-rose-400/70" />
          <span className="h-2 w-2 rounded-full bg-amber-400/70" />
          <span className="h-2 w-2 rounded-full bg-emerald-400/70" />
        </div>
      </div>
      <div className="flex-1 pt-3">{children}</div>
      <p className="mt-3 border-t border-white/40 pt-2 text-xs text-slate-600">
        {caption}
      </p>
    </div>
  );
}

function ScraperPreview() {
  return (
    <PreviewShell
      path="dashboard/scraper"
      caption="Web Scraper — NDJSON progress, auto static/dynamic mode"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">
        Crawl job · running
      </p>
      <div className="mt-3 space-y-2 text-sm">
        {[
          { url: "/", state: "done", chunks: 18 },
          { url: "/pricing", state: "done", chunks: 24 },
          { url: "/blog/ai", state: "visiting" },
          { url: "/contact", state: "queued" },
        ].map((p) => (
          <div
            key={p.url}
            className="flex items-center justify-between rounded-lg border border-white/40 bg-white/60 px-3 py-2"
          >
            <span className="font-mono text-xs text-slate-700">{p.url}</span>
            {p.state === "done" && (
              <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                {p.chunks} chunks
              </span>
            )}
            {p.state === "visiting" && (
              <span className="rounded-md bg-brand-100 px-2 py-0.5 text-[11px] font-semibold text-brand-700">
                visiting…
              </span>
            )}
            {p.state === "queued" && (
              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                queued
              </span>
            )}
          </div>
        ))}
      </div>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
              <div className="h-full w-3/5 rounded-full bg-linear-to-r from-brand-500 to-indigo-500" />
      </div>
    </PreviewShell>
  );
}

function UploadPreview() {
  return (
    <PreviewShell
      path="dashboard/upload-document"
      caption="Upload Document — PDF → chunks ingested into Chroma"
    >
      <div className="rounded-xl border border-dashed border-brand-300/80 bg-brand-50/60 p-5 text-center">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-brand-700">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
            aria-hidden
          >
            <path d="M12 3v12" />
            <path d="m7 8 5-5 5 5" />
            <path d="M5 21h14" />
          </svg>
        </div>
        <p className="mt-2 text-sm font-semibold text-slate-800">Drop a PDF here</p>
        <p className="text-xs text-slate-600">or click to browse</p>
      </div>

      <div className="mt-3 space-y-2 text-sm">
        {[
          { name: "handbook.pdf", chunks: 112 },
          { name: "benefits-2026.pdf", chunks: 57 },
        ].map((d) => (
          <div
            key={d.name}
            className="flex items-center justify-between rounded-lg border border-white/40 bg-white/60 px-3 py-2"
          >
            <span className="flex items-center gap-2 font-mono text-xs text-slate-700">
              <span className="rounded-md bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">
                PDF
              </span>
              {d.name}
            </span>
            <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
              {d.chunks} chunks
            </span>
          </div>
        ))}
      </div>
    </PreviewShell>
  );
}

function ChatbotPreview() {
  return (
    <PreviewShell
      path="dashboard/chatbot/[sessionId]"
      caption="Chatbot — RAG answers with per-session source selection"
    >
      <div className="flex flex-col gap-2">
        <div className="ml-auto max-w-[90%] rounded-2xl rounded-tr-sm bg-slate-900 px-3 py-2 text-sm text-white">
          What&apos;s covered under our PTO policy?
        </div>
        <div className="max-w-[95%] wrap-break-word rounded-2xl rounded-tl-sm bg-brand-50 px-3 py-2 text-sm text-slate-800">
          Full-time employees accrue 15 days/yr; unused days roll over up to 5.
          <div className="mt-2 flex flex-wrap gap-1">
            <span className="break-all rounded-md bg-white/80 px-1.5 py-0.5 font-mono text-[10px] text-brand-700">
              handbook.pdf
            </span>
            <span className="break-all rounded-md bg-white/80 px-1.5 py-0.5 font-mono text-[10px] text-brand-700">
              benefits-2026.pdf
            </span>
          </div>
        </div>
        <div className="mt-2 rounded-xl border border-slate-200 bg-white/70 p-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">
            Sources used in this chat
          </p>
          <div className="mt-1 flex flex-wrap gap-1">
            <span className="break-all rounded-md bg-brand-100 px-2 py-0.5 text-[11px] font-semibold text-brand-700">
              handbook.pdf
            </span>
            <span className="break-all rounded-md bg-brand-100 px-2 py-0.5 text-[11px] font-semibold text-brand-700">
              https://hr.site.com
            </span>
          </div>
        </div>
      </div>
    </PreviewShell>
  );
}

function HowItWorks() {
  const steps = [
    {
      n: "01",
      title: "Ingest your content",
      body: "Crawl a website in static or Playwright dynamic mode, or upload PDFs. Everything gets chunked and embedded into a per-user Chroma collection.",
    },
    {
      n: "02",
      title: "Organize your sources",
      body: "Group uploads and crawled sites into a library. Pick exactly which documents each chat session is allowed to see, so answers stay on-topic.",
    },
    {
      n: "03",
      title: "Answer with RAG",
      body: "Chat from the dashboard with cited sources, or drop the one-line widget onto any site to let visitors ask questions grounded in your content.",
    },
  ];

  return (
    <section id="how-it-works" className="mx-auto w-full max-w-6xl scroll-mt-28">
      <SectionHeading
        eyebrow="How it works"
        title="From raw content to grounded answers in three steps"
        description="Every chunk carries user_id + source metadata, so retrieval is always scoped to the right tenant and the right document set."
      />

      <div className="mt-10 grid gap-5 md:grid-cols-3">
        {steps.map((s) => (
          <div key={s.n} className="glass-muted relative rounded-2xl p-6">
            <span className="absolute -top-3 left-6 rounded-full bg-brand-700 px-3 py-1 text-xs font-bold text-white shadow-md shadow-brand-700/30">
              {s.n}
            </span>
            <h3 className="mt-3 text-lg font-semibold text-slate-900">{s.title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

const PRODUCT_FEATURES = [
  {
    title: "Secure authentication",
    body: "JWT session cookies, email verification, password reset, and a protected dashboard shell with middleware-level route guarding.",
  },
  {
    title: "Web scraper",
    body: "Auto-detected static or dynamic mode with a Playwright fallback, anti-block headers, retry backoff, and streaming NDJSON crawls.",
  },
  {
    title: "Document ingestion",
    body: "Upload PDFs or ingest scraped pages. Text is chunked, embedded, and stored — keyed by user and source for safe multi-tenant retrieval.",
  },
  {
    title: "RAG chat sessions",
    body: "Pick which documents each chat is allowed to see. Site aggregators auto-expand to every crawled page at query time.",
  },
  {
    title: "Cited sources",
    body: "Every answer lists the documents it drew from, so readers can click through to the source instead of trusting the bot blindly.",
  },
  {
    title: "Embeddable widget",
    body: "Drop a single script tag with your bot id and the chatbot appears on any website, proxied through your dashboard's widget config.",
  },
] as const;

function Features() {
  return (
    <section id="features" className="mx-auto w-full max-w-6xl scroll-mt-28">
      <SectionHeading
        eyebrow="What you get"
        title="Built for teams who ship grounded AI, not demos"
        description="Real features from the product — authentication, scraping, ingestion, RAG, cited sources, and a one-line embeddable widget."
      />

      <ul className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {PRODUCT_FEATURES.map((f) => (
          <li key={f.title} className="glass rounded-2xl p-5">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-100 text-brand-700"
              aria-hidden="true"
            >
              <span className="h-2 w-2 rounded-full bg-brand-600" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-slate-900">{f.title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">{f.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Pricing() {
  const tiers = [
    {
      name: "Starter",
      price: "$0",
      cadence: "/ month",
      tagline: "Try the full flow on your own content.",
      features: ["1 workspace", "100 pages crawled / mo", "5 PDF uploads", "Community support"],
      cta: "Create free account",
      href: "/signup",
      highlighted: false,
    },
    {
      name: "Pro",
      price: "$29",
      cadence: "/ month",
      tagline: "For operators shipping a customer-facing bot.",
      features: [
        "Unlimited uploads",
        "10k pages crawled / mo",
        "Embeddable widget",
        "Per-session source scoping",
      ],
      cta: "Start Pro trial",
      href: "/signup",
      highlighted: true,
    },
    {
      name: "Team",
      price: "$99",
      cadence: "/ month",
      tagline: "Shared workspace with roles and audit.",
      features: ["Everything in Pro", "Roles & permissions", "Seat management", "Priority support"],
      cta: "Talk to us",
      href: "/signup",
      highlighted: false,
    },
  ];

  return (
    <section id="pricing" className="mx-auto w-full max-w-6xl scroll-mt-28">
      <SectionHeading
        eyebrow="Pricing"
        title="Start free, scale when you need"
        description="Placeholder tiers for your launch story — wire real plans once you pick a billing provider."
      />

      <div className="mt-10 grid gap-5 md:grid-cols-3">
        {tiers.map((t) => (
          <div
            key={t.name}
            className={
              t.highlighted
                ? "glass-strong relative rounded-2xl border-brand-300 p-6 shadow-xl shadow-brand-500/10"
                : "glass rounded-2xl p-6"
            }
          >
            {t.highlighted && (
              <span className="absolute -top-3 right-6 rounded-full bg-brand-700 px-3 py-1 text-xs font-bold text-white shadow-md shadow-brand-700/30">
                Most popular
              </span>
            )}
            <p className="text-sm font-semibold text-slate-900">{t.name}</p>
            <div className="mt-3 flex items-baseline gap-1">
              <span className="text-4xl font-semibold tracking-tight text-slate-900">
                {t.price}
              </span>
              <span className="text-sm text-slate-600">{t.cadence}</span>
            </div>
            <p className="mt-2 text-sm text-slate-600">{t.tagline}</p>

            <ul className="mt-5 space-y-2 text-sm text-slate-700">
              {t.features.map((f) => (
                <li key={f} className="flex items-start gap-2">
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
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            <Link
              href={t.href}
              className={
                t.highlighted
                  ? "mt-6 inline-flex w-full items-center justify-center rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-brand-700/30 transition hover:bg-brand-800"
                  : "mt-6 inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700"
              }
            >
              {t.cta}
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}

const FAQS = [
  {
    q: "How is my content kept private across users?",
    a: "Every chunk stored in the vector index is tagged with a user id and a source id. Retrieval always filters on the authenticated user, so one tenant can never see another tenant's vectors.",
  },
  {
    q: "How does the embeddable widget work?",
    a: "Add one script tag with your bot id to any site. The widget calls your dashboard's widget API, which validates the bot config and proxies queries to the same retrieval pipeline the dashboard uses.",
  },
  {
    q: "What scraping modes are supported?",
    a: "The scraper auto-detects. It first tries a fast static fetch; if the content looks dynamic it transparently switches to a headless browser. You can also force static or dynamic mode per crawl.",
  },
  {
    q: "Do I have to manage a queue myself?",
    a: "No. Ingest and query jobs run through a managed queue, and crawl jobs stream progress in real time so the UI can poll a single job endpoint.",
  },
  {
    q: "Can I change plans later?",
    a: "Pricing tiers above are placeholders while the billing provider is being wired up. Accounts created today will be migrated onto real plans when they launch — nothing to do on your side.",
  },
] as const;

function Faq() {
  return (
    <section id="faq" className="mx-auto w-full max-w-4xl scroll-mt-28">
      <SectionHeading
        eyebrow="FAQ"
        title="Common questions"
        description="Short answers to the things teams ask before they put a chatbot in front of their customers."
      />

      <div className="mt-10 space-y-3">
        {FAQS.map((f) => (
          <details
            key={f.q}
            className="glass group rounded-2xl px-5 py-4 transition open:shadow-lg open:shadow-slate-900/5"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
              <span className="text-sm font-semibold text-slate-900 sm:text-base">
                {f.q}
              </span>
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition group-open:rotate-45 group-open:bg-brand-100 group-open:text-brand-700">
                <svg
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="h-4 w-4"
                  aria-hidden
                >
                  <path d="M10 4a1 1 0 011 1v4h4a1 1 0 110 2h-4v4a1 1 0 11-2 0v-4H5a1 1 0 110-2h4V5a1 1 0 011-1z" />
                </svg>
              </span>
            </summary>
            <p className="mt-3 text-sm leading-6 text-slate-600">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function FinalCtaGuest() {
  return (
    <>
      <Link
        href="/signup"
        className="inline-flex items-center justify-center rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-black/20 transition hover:bg-slate-100"
      >
        Create free account
      </Link>
      <Link
        href="/login"
        className="inline-flex items-center justify-center rounded-xl border border-white/30 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
      >
        Log in
      </Link>
    </>
  );
}

async function FinalCtaAsync() {
  const user = await resolveUser();
  if (!user) return <FinalCtaGuest />;
  return (
    <Link
      href="/dashboard"
      className="inline-flex items-center justify-center rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-black/20 transition hover:bg-slate-100"
    >
      Open your dashboard
    </Link>
  );
}

function FinalCta() {
  return (
    <section className="mx-auto w-full max-w-6xl">
      <div className="glass-dark relative overflow-hidden rounded-3xl p-6 sm:p-10 lg:p-12">
        <div
          className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-brand-500/30 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-24 -left-10 h-72 w-72 rounded-full bg-indigo-500/20 blur-3xl"
          aria-hidden
        />

        <div className="relative grid items-center gap-8 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="space-y-4">
            <h2 className="text-[1.75rem] font-semibold tracking-tight text-white sm:text-3xl md:text-4xl">
              Try it with your own content.
            </h2>
            <p className="max-w-xl text-base leading-7 text-slate-300">
              Create an account, upload a PDF or crawl a site, and run your first grounded
              chat in under five minutes. No credit card.
            </p>
            <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:flex-wrap">
              <Suspense fallback={<FinalCtaGuest />}>
                <FinalCtaAsync />
              </Suspense>
            </div>
          </div>

          <ul className="space-y-2 text-sm text-slate-200">
            {[
              "Email verification on every new account",
              "Per-user vector isolation by default",
              "One-line widget for any website",
              "Cited sources on every answer",
            ].map((item) => (
              <li
                key={item}
                className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 backdrop-blur"
              >
                <svg
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="mt-0.5 h-4 w-4 shrink-0 text-brand-300"
                  aria-hidden
                >
                  <path
                    fillRule="evenodd"
                    d="M16.704 5.29a1 1 0 010 1.42l-8 8a1 1 0 01-1.42 0l-4-4a1 1 0 111.42-1.42L8 12.58l7.29-7.29a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

