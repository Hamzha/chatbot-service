import Link from "next/link";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { getCurrentUserFromToken } from "@/lib/auth/authService";
import { getSessionCookie } from "@repo/auth/lib/cookies";

export default async function Home() {
  const token = await getSessionCookie();
  const user = token ? await getCurrentUserFromToken(token) : null;

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-100 px-4 py-8 sm:px-6 sm:py-10 lg:px-10">
      <div className="pointer-events-none absolute -top-16 left-10 h-64 w-64 rounded-full bg-cyan-200/40 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 right-10 h-64 w-64 rounded-full bg-amber-200/40 blur-3xl" />

      <section className="relative mx-auto w-full max-w-6xl overflow-hidden rounded-3xl border border-slate-200 bg-white/90 shadow-[0_24px_70px_rgba(15,23,42,0.14)] backdrop-blur">
        <header className="border-b border-slate-200 px-6 py-5 sm:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700">AI Chatbot Platform</p>
              <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">Build and manage reliable AI chatbot workflows</h1>
            </div>
            {user ? (
              <Link
                href="/dashboard"
                className="rounded-xl bg-cyan-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-800"
              >
                Go to dashboard
              </Link>
            ) : (
              <Link
                href="/signup"
                className="rounded-xl bg-cyan-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-800"
              >
                Start free
              </Link>
            )}
          </div>
        </header>

        <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.2fr_0.8fr] lg:gap-10 lg:p-10">
          <div className="space-y-8">
            <section className="space-y-5">
              <h2 className="text-3xl font-semibold leading-tight text-slate-900 sm:text-4xl">
                From scraped content to production chatbot answers in one secure flow.
              </h2>
              <p className="max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
                Authenticate users, ingest web and document data, and deliver RAG-backed answers from a single operational dashboard.
              </p>

              <div className="flex flex-wrap gap-3">
                {user ? (
                  <>
                    <Link
                      href="/dashboard"
                      className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700"
                    >
                      Open dashboard
                    </Link>
                    <LogoutButton />
                  </>
                ) : (
                  <>
                    <Link
                      href="/signup"
                      className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700"
                    >
                      Create account
                    </Link>
                    <Link
                      href="/login"
                      className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      Log in
                    </Link>
                  </>
                )}
              </div>

              {user ? (
                <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                  Signed in as <span className="font-semibold">{user.email}</span>
                </p>
              ) : (
                <p className="text-sm text-slate-500">
                  New accounts require email verification before first login.
                </p>
              )}
            </section>

            <section className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Authentication</p>
                <p className="mt-2 text-sm text-slate-700">Secure session cookies with verification and password reset support.</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Ingestion</p>
                <p className="mt-2 text-sm text-slate-700">Collect data from web scraping and documents with structured pipelines.</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">RAG Answers</p>
                <p className="mt-2 text-sm text-slate-700">Deliver context-aware replies powered by your indexed knowledge base.</p>
              </div>
            </section>
          </div>

          <aside className="rounded-2xl border border-slate-200 bg-slate-900 p-5 text-slate-100 sm:p-6">
            <h3 className="text-lg font-semibold text-white">What this landing page means</h3>
            <p className="mt-3 text-sm leading-6 text-slate-200">
              This is your front door page, shown at the root URL. It should quickly explain your product and guide users to sign up, log in, or open their dashboard.
            </p>

            <ul className="mt-5 space-y-3 text-sm">
              <li className="rounded-xl border border-slate-700 bg-slate-800/70 px-3 py-2">Clear product value in the first screen</li>
              <li className="rounded-xl border border-slate-700 bg-slate-800/70 px-3 py-2">Strong calls to action for guest and signed-in users</li>
              <li className="rounded-xl border border-slate-700 bg-slate-800/70 px-3 py-2">Practical feature summary instead of generic filler text</li>
            </ul>
          </aside>
        </div>
      </section>
    </main>
  );
}
