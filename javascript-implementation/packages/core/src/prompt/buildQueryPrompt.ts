import type { ChatTurn, RetrievedContext } from "@rag/contracts";

export function buildQueryPrompt(args: {
  question: string;
  history: ChatTurn[];
  contexts: RetrievedContext[];
}): string {
  const historyBlock = args.history.length
    ? args.history.map((turn) => `${turn.role.toUpperCase()}: ${turn.content}`).join("\n")
    : "No prior conversation.";

  const contextBlock = args.contexts.length
    ? args.contexts
        .map((ctx, index) => `[${index + 1}] ${ctx.text}\nSource: ${ctx.source}`)
        .join("\n\n")
    : "No context found.";

  return [
    "Answer using only the provided context when possible.",
    "",
    "Conversation History:",
    historyBlock,
    "",
    "Retrieved Context:",
    contextBlock,
    "",
    `Question: ${args.question}`
  ].join("\n");
}
