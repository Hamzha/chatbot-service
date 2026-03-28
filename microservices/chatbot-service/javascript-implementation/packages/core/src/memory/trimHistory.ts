import type { ChatTurn } from "@rag/contracts";

export function trimHistory(history: ChatTurn[], maxTurns: number): ChatTurn[] {
  if (maxTurns <= 0) {
    return [];
  }
  return history.slice(-maxTurns);
}
