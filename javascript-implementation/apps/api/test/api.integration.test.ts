import { describe, expect, it, vi } from "vitest";

vi.mock("../src/inngest/client.js", () => {
  const mockSend = vi.fn().mockResolvedValue({ ids: ["mock-event-id-1"] });
  return {
    inngest: {
      id: "rag-app",
      send: mockSend,
      createFunction: vi.fn().mockImplementation((_config: unknown, _trigger: unknown, handler: unknown) => {
        return { handler, _config, _trigger };
      })
    }
  };
});

vi.mock("inngest/fastify", () => {
  return {
    default: async () => {}
  };
});

vi.mock("../src/container.js", () => ({
  pdfLoader: {},
  embedder: {},
  vectorStore: {},
  generator: {},
  retriever: {},
  ingestUseCase: {},
  queryUseCase: {}
}));

const { createApp } = await import("../src/index.js");

describe("api integration", () => {
  it("sends query event via Inngest and returns eventId", async () => {
    const app = await createApp();

    const response = await app.inject({
      method: "POST",
      url: "/rag/query",
      payload: {
        question: "How is this modular?",
        history: [],
        topK: 2
      }
    });

    expect(response.statusCode).toBe(200);
    const json = response.json();
    expect(json.status).toBe("event_sent");
    expect(json.eventId).toBe("mock-event-id-1");
  });

  it("returns 400 when question is missing on /rag/query", async () => {
    const app = await createApp();

    const response = await app.inject({
      method: "POST",
      url: "/rag/query",
      payload: { history: [] }
    });

    expect(response.statusCode).toBe(400);
    const json = response.json();
    expect(json.error).toBe("Invalid query input");
    expect(json.details).toBeDefined();
  });

  it("sends upload event via multipart and returns eventId", async () => {
    const app = await createApp();

    const boundary = "---TestBoundary";
    const pdfContent = Buffer.from("%PDF-1.4 fake content");
    const body =
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="test.pdf"\r\n` +
      `Content-Type: application/pdf\r\n\r\n` +
      pdfContent.toString() +
      `\r\n--${boundary}--\r\n`;

    const response = await app.inject({
      method: "POST",
      url: "/rag/upload",
      headers: {
        "content-type": `multipart/form-data; boundary=${boundary}`
      },
      payload: body
    });

    expect(response.statusCode).toBe(200);
    const json = response.json();
    expect(json.status).toBe("event_sent");
    expect(json.fileName).toBe("test.pdf");
    expect(json.eventId).toBe("mock-event-id-1");
  });

  it("rejects non-multipart requests on /rag/upload", async () => {
    const app = await createApp();

    const response = await app.inject({
      method: "POST",
      url: "/rag/upload",
      payload: {}
    });

    expect([400, 406]).toContain(response.statusCode);
  });

  it("exposes swagger docs and allows UI origin for CORS", async () => {
    const app = await createApp();

    const docs = await app.inject({
      method: "GET",
      url: "/docs/json",
      headers: {
        origin: "http://127.0.0.1:5173"
      }
    });

    expect(docs.statusCode).toBe(200);
    expect(docs.headers["access-control-allow-origin"]).toBe("http://127.0.0.1:5173");
    const spec = docs.json();
    expect(spec.info.title).toBe("RAG API");
  });
});
