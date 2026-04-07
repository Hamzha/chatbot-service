import { NextResponse } from "next/server";

/**
 * Forwards chatbot API responses to the browser. If upstream returns an empty or
 * non-JSON body, returns JSON so clients never see an empty body on JSON.parse().
 */
export function proxyChatbotResponse(upstream: Response, bodyText: string): NextResponse {
  if (upstream.status === 204 || upstream.status === 304) {
    return new NextResponse(null, { status: upstream.status });
  }
  if (!bodyText.trim()) {
    const status = upstream.status >= 400 ? upstream.status : 502;
    return NextResponse.json(
      { error: "Empty response from chatbot service", upstreamStatus: upstream.status },
      { status },
    );
  }
  try {
    JSON.parse(bodyText);
  } catch {
    return NextResponse.json(
      {
        error: "Chatbot service returned non-JSON",
        detail: bodyText.slice(0, 800),
        upstreamStatus: upstream.status,
      },
      { status: upstream.status >= 400 ? upstream.status : 502 },
    );
  }
  const ct = upstream.headers.get("content-type") ?? "application/json";
  return new NextResponse(bodyText, {
    status: upstream.status,
    headers: { "content-type": ct.includes("application/json") ? ct : "application/json" },
  });
}
