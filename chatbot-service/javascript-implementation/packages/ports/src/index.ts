import type { RetrievedContext } from "@rag/contracts";

export interface RetrieverPort {
  retrieveRelevantContext(question: string, topK: number): Promise<RetrievedContext[]>;
}

export interface GeneratorPort {
  generateAnswer(prompt: string): Promise<string>;
}

export interface PdfLoaderPort {
  loadAndChunk(filePath: string): Promise<string[]>;
}

export interface EmbedderPort {
  embedTexts(texts: string[]): Promise<number[][]>;
}

export interface VectorStorePort {
  upsert(
    ids: string[],
    vectors: number[][],
    payloads: { source: string; text: string }[]
  ): Promise<void>;
  search(
    queryVector: number[],
    topK: number
  ): Promise<{ text: string; source: string }[]>;
}
