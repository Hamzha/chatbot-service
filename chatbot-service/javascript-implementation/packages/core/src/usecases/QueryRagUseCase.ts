import {
  QueryRagInputSchema,
  QueryRagOutputSchema,
  type QueryRagInput,
  type QueryRagOutput
} from "@rag/contracts";
import type { GeneratorPort, RetrieverPort } from "@rag/ports";
import { trimHistory } from "../memory/trimHistory.js";
import { buildQueryPrompt } from "../prompt/buildQueryPrompt.js";
import { extractUniqueSources } from "../services/sourceExtractor.js";

export class QueryRagUseCase {
  constructor(
    private readonly retriever: RetrieverPort,
    private readonly generator: GeneratorPort,
    private readonly config: { maxHistoryTurns: number } = { maxHistoryTurns: 6 }
  ) {}

  async execute(rawInput: QueryRagInput): Promise<QueryRagOutput> {
    const input = QueryRagInputSchema.parse(rawInput);
    const recentHistory = trimHistory(input.history, this.config.maxHistoryTurns);
    const contexts = await this.retriever.retrieveRelevantContext(input.question, input.topK);

    const prompt = buildQueryPrompt({
      question: input.question,
      history: recentHistory,
      contexts
    });

    const answer = await this.generator.generateAnswer(prompt);

    if (!answer || !answer.trim()) {
      throw new Error("Generator returned an empty answer.");
    }

    return QueryRagOutputSchema.parse({
      answer: answer.trim(),
      sources: extractUniqueSources(contexts)
    });
  }
}
