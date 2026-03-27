import { createHash } from "node:crypto";
import {
  IngestPdfInputSchema,
  IngestPdfOutputSchema,
  type IngestPdfInput,
  type IngestPdfOutput
} from "@rag/contracts";
import type { PdfLoaderPort, EmbedderPort, VectorStorePort } from "@rag/ports";

function deterministicId(sourceId: string, index: number): string {
  return createHash("sha256")
    .update(`${sourceId}:${index}`)
    .digest("hex")
    .slice(0, 32);
}

export class IngestPdfUseCase {
  constructor(
    private readonly pdfLoader: PdfLoaderPort,
    private readonly embedder: EmbedderPort,
    private readonly vectorStore: VectorStorePort
  ) {}

  async execute(rawInput: IngestPdfInput): Promise<IngestPdfOutput> {
    const input = IngestPdfInputSchema.parse(rawInput);

    const chunks = await this.pdfLoader.loadAndChunk(input.filePath);
    const vectors = await this.embedder.embedTexts(chunks);
    const ids = chunks.map((_, i) => deterministicId(input.sourceId, i));
    const payloads = chunks.map((text) => ({ source: input.sourceId, text }));
    await this.vectorStore.upsert(ids, vectors, payloads);

    return IngestPdfOutputSchema.parse({
      status: "ingested",
      ingested: chunks.length,
      source: input.sourceId
    });
  }
}
