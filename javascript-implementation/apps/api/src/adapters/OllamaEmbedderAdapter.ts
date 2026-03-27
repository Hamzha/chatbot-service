import type { EmbedderPort } from "@rag/ports";

export class OllamaEmbedderAdapter implements EmbedderPort {
  private readonly baseUrl: string;
  private readonly model: string;

  constructor(
    baseUrl = process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434",
    model = process.env.OLLAMA_EMBED_MODEL ?? "nomic-embed-text"
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.model = model;
  }

  async embedTexts(texts: string[]): Promise<number[][]> {
    const results: number[][] = [];
    for (const text of texts) {
      const resp = await fetch(`${this.baseUrl}/api/embeddings`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model: this.model, prompt: text })
      });
      if (!resp.ok) {
        throw new Error(`Ollama embedding request failed: ${resp.status} ${resp.statusText}`);
      }
      const data = (await resp.json()) as { embedding?: number[] };
      const vec = data.embedding;
      if (!Array.isArray(vec) || vec.length === 0) {
        throw new Error("Ollama embeddings returned an invalid vector.");
      }
      results.push(vec);
    }
    return results;
  }
}
