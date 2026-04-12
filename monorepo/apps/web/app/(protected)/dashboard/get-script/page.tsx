"use client";

import { useMemo, useState } from "react";

const BOT_ID = "demo_bot_001";

export default function GetScriptPage() {
  const [copied, setCopied] = useState(false);

  const scriptSnippet = useMemo(() => {
    if (typeof window === "undefined") {
      return `<script src="/chatbot-widget.js" data-bot-id="${BOT_ID}"></script>`;
    }

    return `<script src="${window.location.origin}/chatbot-widget.js" data-bot-id="${BOT_ID}"></script>`;
  }, []);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(scriptSnippet);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="glass-strong rounded-2xl p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">Install · Step 4</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">Get Script</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          Copy this script and paste it before the closing body tag on your website. For now, it only injects the chatbot UI shell.
        </p>
      </header>

      <section className="glass-strong rounded-2xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Embed snippet</h2>
          <button
            type="button"
            onClick={handleCopy}
            className="rounded-xl bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-brand-700/20 transition hover:bg-brand-800"
          >
            {copied ? "Copied" : "Copy script"}
          </button>
        </div>

        <pre className="overflow-x-auto rounded-xl border border-white/40 bg-slate-900 p-4 text-sm text-slate-100">
          <code>{scriptSnippet}</code>
        </pre>

        <ol className="space-y-2 text-sm text-slate-600">
          <li>1. Open your website HTML layout/template.</li>
          <li>2. Paste this script right before the closing body tag.</li>
          <li>3. Save and refresh your website.</li>
        </ol>
      </section>
    </div>
  );
}
