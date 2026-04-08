import Link from "next/link";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { getCurrentUserFromToken } from "@/lib/auth/authService";
import { getSessionCookie } from "@repo/auth/lib/cookies";

export default async function Home() {
  const token = await getSessionCookie();
  const user = token ? await getCurrentUserFromToken(token) : null;

  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-8 sm:px-6 sm:py-10 lg:px-10">
      <section className="glass-strong relative mx-auto w-full max-w-6xl overflow-hidden rounded-3xl">
        <header className="border-b border-white/30 px-6 py-5 sm:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">AI Chatbot Platform</p>
              <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">Build and manage reliable AI chatbot workflows</h1>
            </div>
            {user ? (
              <Link
                href="/dashboard"
                className="rounded-xl bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-brand-700/20 transition hover:bg-brand-800"
              >
                Go to dashboard
              </Link>
            ) : (
              <Link
                href="/signup"
                className="rounded-xl bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-brand-700/20 transition hover:bg-brand-800"
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
                      className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 transition hover:bg-slate-700"
                    >
                      Open dashboard
                    </Link>
                    <LogoutButton />
                  </>
                ) : (
                  <>
                    <Link
                      href="/signup"
                      className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 transition hover:bg-slate-700"
                    >
                      Create account
                    </Link>
                    <Link
                      href="/login"
                      className="glass rounded-xl px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-white/80"
                    >
                      Log in
                    </Link>
                  </>
                )}
              </div>

              {user ? (
                <p className="glass rounded-xl border-emerald-200/60 px-3 py-2 text-sm text-emerald-800">
                  Signed in as <span className="font-semibold">{user.email}</span>
                </p>
              ) : (
                <p className="text-sm text-slate-500">
                  New accounts require email verification before first login.
                </p>
              )}
            </section>

            <section className="grid gap-3 sm:grid-cols-3">
              <div className="glass-muted rounded-2xl p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Authentication</p>
                <p className="mt-2 text-sm text-slate-700">Secure session cookies with verification and password reset support.</p>
              </div>
              <div className="glass-muted rounded-2xl p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Ingestion</p>
                <p className="mt-2 text-sm text-slate-700">Collect data from web scraping and documents with structured pipelines.</p>
              </div>
              <div className="glass-muted rounded-2xl p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">RAG Answers</p>
                <p className="mt-2 text-sm text-slate-700">Deliver context-aware replies powered by your indexed knowledge base.</p>
              </div>
            </section>
          </div>

          <aside className="glass-dark rounded-2xl p-5 sm:p-6">
            <h3 className="text-lg font-semibold text-white">What this landing page means</h3>
            <p className="mt-3 text-sm leading-6 text-slate-200">
              This is your front door page, shown at the root URL. It should quickly explain your product and guide users to sign up, log in, or open their dashboard.
            </p>

            <ul className="mt-5 space-y-3 text-sm">
              <li className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 backdrop-blur">Clear product value in the first screen</li>
              <li className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 backdrop-blur">Strong calls to action for guest and signed-in users</li>
              <li className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 backdrop-blur">Practical feature summary instead of generic filler text</li>
            </ul>
          </aside>
        </div>
      </section>
    </main>
  );
}
