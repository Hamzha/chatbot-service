import Link from "next/link";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { getCurrentUserFromToken } from "@/lib/auth/authService";
import { getSessionCookie } from "@repo/auth/lib/cookies";

export default async function Home() {
  const token = await getSessionCookie();
  const user = token ? await getCurrentUserFromToken(token) : null;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#dbeafe_0%,_#f0f9ff_35%,_#f8fafc_70%)] px-4 py-10 sm:px-6 lg:px-8">
      <section className="mx-auto w-full max-w-6xl rounded-3xl border border-sky-100 bg-white/85 p-6 shadow-[0_18px_60px_-30px_rgba(14,116,144,0.45)] backdrop-blur-sm sm:p-8 lg:p-10">
        <div className="grid gap-8 lg:grid-cols-[1.3fr_0.9fr] lg:items-start">
          <div className="space-y-6">
            <span className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">
              AI Chatbot Platform
            </span>

            <h1 className="text-balance text-4xl font-semibold leading-tight text-zinc-900 sm:text-5xl">
              AI-powered chatbot with auth, scraping, and RAG.
            </h1>

            <p className="max-w-2xl text-base leading-relaxed text-zinc-600 sm:text-lg">
              Secure authentication, web scraping, and RAG-based PDF Q&A — all
              in one platform. Sign up to get started.
            </p>

            <div className="flex flex-wrap gap-3">
              {user ? (
                <>
                  <Link
                    href="/dashboard"
                    className="rounded-md bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700"
                  >
                    Open dashboard
                  </Link>
                  <LogoutButton />
                </>
              ) : (
                <>
                  <Link
                    href="/signup"
                    className="rounded-md bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700"
                  >
                    Create account
                  </Link>
                  <Link
                    href="/login"
                    className="rounded-md border border-zinc-300 bg-white px-5 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
                  >
                    Log in
                  </Link>
                </>
              )}
            </div>

            {user ? (
              <p className="text-sm text-zinc-600">
                Signed in as <span className="font-medium text-zinc-800">{user.email}</span>
              </p>
            ) : (
              <p className="text-sm text-zinc-500">
                New user signups require email verification before login.
              </p>
            )}
          </div>

          <aside className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-zinc-900">Platform Features</h2>
            <ul className="mt-4 space-y-3 text-sm text-zinc-600">
              <li className="rounded-lg border border-zinc-200 bg-white px-3 py-2">
                Secure JWT sessions via HTTP-only cookies
              </li>
              <li className="rounded-lg border border-zinc-200 bg-white px-3 py-2">
                MongoDB + Mongoose user persistence
              </li>
              <li className="rounded-lg border border-zinc-200 bg-white px-3 py-2">
                Email verification + forgot/reset password flows
              </li>
              <li className="rounded-lg border border-zinc-200 bg-white px-3 py-2">
                RAG-based PDF Q&A with local LLM
              </li>
              <li className="rounded-lg border border-zinc-200 bg-white px-3 py-2">
                Web scraping (static + dynamic sites)
              </li>
            </ul>
          </aside>
        </div>
      </section>
    </main>
  );
}
