import { describe, expect, it } from "vitest";
import type { GeneratorPort, RetrieverPort } from "@rag/ports";
import { QueryRagUseCase } from "../src/index.js";

describe("QueryRagUseCase", () => {
  it("returns answer and unique sources", async () => {
    const retriever: RetrieverPort = {
      async retrieveRelevantContext() {
        return [
          { text: "LangChain can orchestrate retrieval.", source: "doc-a.pdf" },
          { text: "Chroma stores vectors locally.", source: "doc-b.pdf" },
          { text: "Chroma is a local vector db.", source: "doc-b.pdf" }
        ];
      }
    };

    const generator: GeneratorPort = {
      async generateAnswer(prompt: string) {
        expect(prompt).toContain("Conversation History:");
        expect(prompt).toContain("What db is used?");
        expect(prompt).toContain("LangChain can orchestrate retrieval.");
        return "Use Chroma for local vector storage.";
      }
    };

    const useCase = new QueryRagUseCase(retriever, generator, { maxHistoryTurns: 2 });
    const output = await useCase.execute({
      question: "How do we run this locally?",
      history: [
        { role: "user", content: "What is this app?" },
        { role: "assistant", content: "A local RAG system." },
        { role: "user", content: "What db is used?" }
      ],
      topK: 3
    });

    expect(output.answer).toBe("Use Chroma for local vector storage.");
    expect(output.sources).toEqual(["doc-a.pdf", "doc-b.pdf"]);
  });

  it("throws if generator returns empty answer", async () => {
    const retriever: RetrieverPort = {
      async retrieveRelevantContext() {
        return [{ text: "Any context", source: "doc-a.pdf" }];
      }
    };
    const generator: GeneratorPort = {
      async generateAnswer() {
        return " ";
      }
    };

    const useCase = new QueryRagUseCase(retriever, generator);
    await expect(
      useCase.execute({
        question: "q?",
        history: [],
        topK: 1
      })
    ).rejects.toThrow("Generator returned an empty answer.");
  });
});
