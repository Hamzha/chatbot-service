import type { RetrieverPort, EmbedderPort, VectorStorePort } from "@rag/ports";
import type { RetrievedContext } from "@rag/contracts";

export class ChromaRetrieverAdapter implements RetrieverPort {
  constructor(
    private readonly embedder: EmbedderPort,
    private readonly vectorStore: VectorStorePort
  ) {}

  async retrieveRelevantContext(
    question: string,
    topK: number
  ): Promise<RetrievedContext[]> {
    const [queryVec] = await this.embedder.embedTexts([question]);
    const hits = await this.vectorStore.search(queryVec, topK);
    return hits.map((hit) => ({ text: hit.text, source: hit.source }));
  }
}
