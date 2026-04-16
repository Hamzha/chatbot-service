"use client";

import { useEffect, useState } from "react";

export default function CustomizePage() {
  const [primaryColor, setPrimaryColor] = useState("#0f766e");
  const [savedColor, setSavedColor] = useState("#0f766e");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/chatbot/widget/config", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data) => {
        setPrimaryColor(data.primaryColor);
        setSavedColor(data.primaryColor);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/chatbot/widget/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ primaryColor }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save");
      }
      setSavedColor(primaryColor);
      setMessage({ type: "success", text: "Color saved!" });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Failed to save" });
    } finally {
      setSaving(false);
    }
  }

  const hasChanges = primaryColor !== savedColor;
  const darkerColor = adjustColor(primaryColor, -20);
  const lighterColor = adjustColor(primaryColor, 20);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <header className="glass-strong rounded-2xl p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">
          Customize · Step 3
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">Widget Appearance</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          Choose a primary color for your chatbot widget. This color will be used for the launcher
          button, header, send button, and user message bubbles.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* Left — color picker */}
        <section className="space-y-6">
          <div className="glass-strong rounded-2xl p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
              Pick Your Color
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Use the color picker or enter a hex value directly.
            </p>

            <div className="mt-5 flex flex-col items-center gap-6 sm:flex-row sm:items-start">
              {/* Color picker — large and prominent */}
              <div className="relative">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="h-44 w-44 cursor-pointer rounded-2xl border-0 bg-transparent p-0 [&::-webkit-color-swatch-wrapper]:p-1 [&::-webkit-color-swatch]:rounded-xl [&::-webkit-color-swatch]:border-0"
                />
              </div>

              {/* Color info panel */}
              <div className="flex flex-1 flex-col gap-4">
                {/* Selected color display */}
                <div className="glass flex items-center gap-4 rounded-xl p-4">
                  <div
                    className="h-14 w-14 shrink-0 rounded-xl shadow-lg transition-colors duration-200"
                    style={{ backgroundColor: primaryColor }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-slate-500">Selected color</p>
                    <input
                      type="text"
                      value={primaryColor}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (/^#[0-9a-fA-F]{0,6}$/.test(v)) setPrimaryColor(v);
                      }}
                      maxLength={7}
                      spellCheck={false}
                      className="mt-0.5 w-full rounded-lg border border-slate-200/70 bg-white/60 px-3 py-1.5 font-mono text-base font-semibold text-slate-900 uppercase outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                      placeholder="#0f766e"
                    />
                  </div>
                </div>

                {/* Generated shades */}
                <div>
                  <p className="text-xs font-medium text-slate-500">Generated shades</p>
                  <div className="mt-2 flex gap-2">
                    {[
                      adjustColor(primaryColor, 60),
                      adjustColor(primaryColor, 40),
                      adjustColor(primaryColor, 20),
                      primaryColor,
                      adjustColor(primaryColor, -20),
                      adjustColor(primaryColor, -40),
                      adjustColor(primaryColor, -60),
                    ].map((shade, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setPrimaryColor(shade)}
                        className={`h-8 flex-1 rounded-lg transition-all hover:scale-110 hover:shadow-md ${
                          shade === primaryColor ? "ring-2 ring-slate-800 ring-offset-1" : ""
                        }`}
                        style={{ backgroundColor: shade }}
                        title={shade}
                      />
                    ))}
                  </div>
                </div>

                {/* Save bar */}
                <div className="flex items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving || loading || !hasChanges}
                    className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                    style={{ backgroundColor: hasChanges ? primaryColor : undefined }}
                  >
                    {saving ? (
                      <span className="flex items-center gap-2">
                        <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        Saving...
                      </span>
                    ) : (
                      "Save Color"
                    )}
                  </button>

                  {hasChanges && (
                    <button
                      type="button"
                      onClick={() => setPrimaryColor(savedColor)}
                      className="rounded-xl border border-slate-200/70 bg-white/50 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-white/80"
                    >
                      Reset
                    </button>
                  )}

                  {message && (
                    <span
                      className={`flex items-center gap-1.5 text-sm font-medium ${
                        message.type === "success" ? "text-emerald-600" : "text-rose-600"
                      }`}
                    >
                      {message.type === "success" && (
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                      {message.text}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Right — live preview */}
        <section className="space-y-6">
          <div className="glass-strong rounded-2xl p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
              Live Preview
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              See how your widget will look on your site.
            </p>

            {/* Widget preview */}
            <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-xl">
              {/* Header */}
              <div
                className="flex items-center justify-between px-4 py-3.5 text-white transition-colors duration-200"
                style={{ background: `linear-gradient(130deg, ${primaryColor} 0%, ${darkerColor} 100%)` }}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-xs font-bold backdrop-blur-sm">
                    AI
                  </div>
                  <div>
                    <div className="text-[13px] font-bold leading-tight">Support Assistant</div>
                    <div className="flex items-center gap-1.5 text-[10px] opacity-90">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_4px_rgba(52,211,153,0.6)]" />
                      Online
                    </div>
                  </div>
                </div>
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 text-sm">
                  &times;
                </div>
              </div>

              {/* Messages */}
              <div className="space-y-3 p-4" style={{ background: "radial-gradient(600px 300px at -100px -50px, #f0fdfa 5%, #f8fafc 45%, #fff 100%)" }}>
                <div className="max-w-[86%] rounded-2xl rounded-tl-md border border-slate-200/60 bg-white px-3.5 py-2.5 text-xs leading-relaxed text-slate-700 shadow-sm">
                  Hey there! How can I help you today?
                </div>
                <div
                  className="ml-auto max-w-[86%] rounded-2xl rounded-tr-md px-3.5 py-2.5 text-xs leading-relaxed text-white shadow-sm transition-colors duration-200"
                  style={{ background: `linear-gradient(130deg, ${primaryColor} 0%, ${lighterColor} 100%)` }}
                >
                  What are your business hours?
                </div>
                <div className="max-w-[86%] rounded-2xl rounded-tl-md border border-slate-200/60 bg-white px-3.5 py-2.5 text-xs leading-relaxed text-slate-700 shadow-sm">
                  We&apos;re open Mon-Fri, 9 AM to 5 PM!
                </div>
              </div>

              {/* Input area */}
              <div className="flex items-center gap-2 border-t border-slate-100 px-3 py-2.5">
                <div className="flex-1 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-[11px] text-slate-400">
                  Type message...
                </div>
                <button
                  type="button"
                  className="flex h-8 w-8 items-center justify-center rounded-xl text-white shadow transition-colors duration-200"
                  style={{ backgroundColor: primaryColor }}
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 12h14m-7-7l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Launcher preview */}
            <div className="mt-5 flex items-center justify-between">
              <span className="text-xs text-slate-500">Launcher button</span>
              <div
                className="flex h-14 w-14 items-center justify-center rounded-full text-xl text-white shadow-xl transition-colors duration-200"
                style={{
                  background: `linear-gradient(135deg, ${primaryColor} 0%, ${lighterColor} 100%)`,
                  boxShadow: `0 8px 24px ${primaryColor}50`,
                }}
              >
                💬
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function adjustColor(hex: string, amount: number): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return hex;
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, Math.max(0, ((num >> 16) & 0xff) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amount));
  const b = Math.min(255, Math.max(0, (num & 0xff) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}
