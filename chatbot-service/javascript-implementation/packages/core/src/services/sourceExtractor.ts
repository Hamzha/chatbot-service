import type { RetrievedContext } from "@rag/contracts";

export function extractUniqueSources(contexts: RetrievedContext[]): string[] {
  return [...new Set(contexts.map((ctx) => ctx.source))];
}
