import { ChromaClient, IncludeEnum } from "chromadb";
import type { VectorStorePort } from "@rag/ports";

export class ChromaVectorStoreAdapter implements VectorStorePort {
  private readonly client: ChromaClient;
  private readonly collectionName: string;

  constructor(
    chromaUrl = process.env.CHROMA_URL ?? "http://localhost:8000",
    collectionName = process.env.CHROMA_COLLECTION ?? "docs"
  ) {
    this.client = new ChromaClient({ path: chromaUrl });
    this.collectionName = collectionName;
  }

  async upsert(
    ids: string[],
    vectors: number[][],
    payloads: { source: string; text: string }[]
  ): Promise<void> {
    const collection = await this.client.getOrCreateCollection({
      name: this.collectionName,
      metadata: { "hnsw:space": "cosine" }
    });

    await collection.upsert({
      ids,
      embeddings: vectors,
      documents: payloads.map((p) => p.text),
      metadatas: payloads.map((p) => ({ source: p.source }))
    });
  }

  async search(
    queryVector: number[],
    topK: number
  ): Promise<{ text: string; source: string }[]> {
    const collection = await this.client.getOrCreateCollection({
      name: this.collectionName,
      metadata: { "hnsw:space": "cosine" }
    });

    const res = await collection.query({
      queryEmbeddings: [queryVector],
      nResults: topK,
      include: [IncludeEnum.Documents, IncludeEnum.Metadatas]
    });

    const results: { text: string; source: string }[] = [];
    const documents = res.documents?.[0] ?? [];
    const metadatas = res.metadatas?.[0] ?? [];

    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i];
      if (doc) {
        const meta = metadatas[i];
        const source =
          meta && typeof meta === "object" && "source" in meta
            ? String(meta.source)
            : "unknown";
        results.push({ text: doc, source });
      }
    }

    return results;
  }
}
