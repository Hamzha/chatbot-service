import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import Fastify from "fastify";
import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import multipart from "@fastify/multipart";
import inngestFastify from "inngest/fastify";
import { QueryRagInputSchema } from "@rag/contracts";
import { inngest, ingestPdf, queryPdf } from "./inngest/index.js";

const INNGEST_API_BASE = process.env.INNGEST_API_BASE ?? "http://127.0.0.1:8288/v1";
const UPLOADS_DIR = process.env.UPLOADS_DIR ?? join(process.cwd(), "uploads");
const OLLAMA_TIMEOUT_MS = process.env.OLLAMA_TIMEOUT_MS
  ? Number(process.env.OLLAMA_TIMEOUT_MS)
  : process.env.OLLAMA_TIMEOUT_SECONDS
    ? Number(process.env.OLLAMA_TIMEOUT_SECONDS) * 1000
    : 900000;

export async function createApp() {
  const app = Fastify({ logger: false });

  await app.register(cors, {
    origin: ["http://127.0.0.1:5173", "http://localhost:5173"]
  });

  await app.register(swagger, {
    openapi: {
      info: {
        title: "RAG API",
        version: "0.1.0"
      }
    }
  });

  await app.register(swaggerUi, {
    routePrefix: "/docs"
  });

  await app.register(multipart, {
    limits: { fileSize: 50 * 1024 * 1024 }
  });

  await app.register(inngestFastify, {
    client: inngest,
    functions: [ingestPdf, queryPdf]
  });

  app.get("/health", async () => ({ status: "ok" }));

  app.get("/config", async () => ({
    pollTimeoutMs: OLLAMA_TIMEOUT_MS
  }));

  app.post("/rag/query", async (request, reply) => {
    const parsed = QueryRagInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "Invalid query input",
        details: parsed.error.flatten().fieldErrors
      });
    }

    const { question, history, topK } = parsed.data;

    const ids = await inngest.send({
      name: "rag/query-pdf",
      data: { question, history, topK }
    });

    return reply.send({
      status: "event_sent",
      eventId: ids.ids[0]
    });
  });

  app.post("/rag/upload", async (request, reply) => {
    const data = await request.file();
    if (!data) {
      return reply.code(400).send({ error: "file is required" });
    }

    const fileName = data.filename;
    if (!fileName.toLowerCase().endsWith(".pdf")) {
      return reply.code(400).send({ error: "Only PDF files are accepted" });
    }

    const buffer = await data.toBuffer();

    await mkdir(UPLOADS_DIR, { recursive: true });
    const filePath = join(UPLOADS_DIR, `${Date.now()}-${fileName}`);
    await writeFile(filePath, buffer);

    const ids = await inngest.send({
      name: "rag/ingest-pdf",
      data: { filePath, sourceId: fileName }
    });

    return reply.send({
      status: "event_sent",
      fileName,
      eventId: ids.ids[0]
    });
  });

  app.get("/rag/runs/:eventId", async (request, reply) => {
    const { eventId } = request.params as { eventId: string };

    const url = `${INNGEST_API_BASE}/events/${eventId}/runs`;
    const resp = await fetch(url);
    if (!resp.ok) {
      return reply.code(resp.status).send({ error: `Inngest API error: ${resp.status}` });
    }
    const json = (await resp.json()) as { data?: RunInfo[] };
    const runs: RunInfo[] = json.data ?? [];

    if (!runs.length) {
      return reply.send({ status: "pending", output: null });
    }

    const run = runs[0];
    const status = (run.status ?? "").toLowerCase();

    if (["completed", "succeeded", "success", "finished"].includes(status)) {
      return reply.send({ status: "completed", output: run.output ?? {} });
    }
    if (["failed", "cancelled"].includes(status)) {
      return reply.send({ status: "failed", output: run.output ?? {} });
    }

    return reply.send({ status: "running", output: null });
  });

  await app.ready();
  return app;
}

type RunInfo = {
  status?: string;
  output?: Record<string, unknown>;
};
