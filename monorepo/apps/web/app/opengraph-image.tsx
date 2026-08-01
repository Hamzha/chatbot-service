import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "AI Chatbot Platform — RAG for your docs and websites";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "80px",
          background:
            "radial-gradient(at 15% 10%, rgba(34,211,238,0.55) 0, transparent 55%)," +
            "radial-gradient(at 88% 12%, rgba(251,191,36,0.45) 0, transparent 55%)," +
            "radial-gradient(at 70% 92%, rgba(99,102,241,0.45) 0, transparent 55%)," +
            "radial-gradient(at 18% 88%, rgba(16,185,129,0.4) 0, transparent 55%)," +
            "#eef2f7",
          fontFamily: "system-ui, sans-serif",
          color: "#0f172a",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 72,
              height: 72,
              borderRadius: 20,
              background: "#0e7490",
              color: "white",
              fontSize: 34,
              fontWeight: 800,
              letterSpacing: -1,
            }}
          >
            AI
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              lineHeight: 1.1,
            }}
          >
            <span
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: "#0e7490",
                letterSpacing: 4,
                textTransform: "uppercase",
              }}
            >
              AI Chatbot Platform
            </span>
            <span style={{ fontSize: 20, color: "#475569", marginTop: 4 }}>
              Scrape · Ingest · Answer
            </span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              fontSize: 76,
              fontWeight: 800,
              letterSpacing: -2,
              lineHeight: 1.05,
              maxWidth: 1000,
            }}
          >
            Turn your docs and websites into a production chatbot.
          </div>
          <div
            style={{
              fontSize: 28,
              color: "#475569",
              maxWidth: 900,
              lineHeight: 1.35,
            }}
          >
            Crawl · Upload · RAG answers with cited sources — from a secure
            dashboard or a one-line embeddable widget.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 22,
            color: "#475569",
          }}
        >
          <div style={{ display: "flex", gap: 24 }}>
            <Badge>Multi-tenant</Badge>
            <Badge>Cited sources</Badge>
            <Badge>Embeddable widget</Badge>
          </div>
          <div style={{ fontWeight: 700, color: "#0f172a" }}>
            Start free →
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}

function Badge({ children }: { children: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 18px",
        borderRadius: 999,
        background: "rgba(255,255,255,0.75)",
        border: "1px solid rgba(148,163,184,0.5)",
        color: "#0f172a",
        fontWeight: 600,
      }}
    >
      <div
        style={{
          width: 10,
          height: 10,
          borderRadius: 999,
          background: "#06b6d4",
        }}
      />
      {children}
    </div>
  );
}
