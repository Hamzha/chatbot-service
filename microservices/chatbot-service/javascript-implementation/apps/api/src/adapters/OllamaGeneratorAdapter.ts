import type { GeneratorPort } from "@rag/ports";

export class OllamaGeneratorAdapter implements GeneratorPort {
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(
    baseUrl = process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434",
    model = process.env.OLLAMA_MODEL ?? "qwen2.5:7b",
    timeoutMs = Number(
      process.env.OLLAMA_TIMEOUT_MS ??
      (process.env.OLLAMA_TIMEOUT_SECONDS
        ? String(Number(process.env.OLLAMA_TIMEOUT_SECONDS) * 1000)
        : "300000")
    )
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.model = model;
    this.timeoutMs = timeoutMs;
  }

  async generateAnswer(prompt: string): Promise<string> {
    const resp = await fetch(`${this.baseUrl}/api/generate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        prompt,
        stream: false,
        options: { temperature: 0.2 }
      }),
      signal: AbortSignal.timeout(this.timeoutMs)
    });

    if (!resp.ok) {
      throw new Error(`Ollama generate failed: ${resp.status} ${resp.statusText}`);
    }

    const data = (await resp.json()) as { response?: string };
    const answer = (data.response ?? "").trim();
    if (!answer) {
      throw new Error("Ollama returned an empty response.");
    }
    return answer;
  }
}
