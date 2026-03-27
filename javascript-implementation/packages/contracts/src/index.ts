import { z } from "zod";

export const ChatTurnSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1)
});
export type ChatTurn = z.infer<typeof ChatTurnSchema>;

export const QueryRagInputSchema = z.object({
  question: z.string().min(1),
  history: z.array(ChatTurnSchema).default([]),
  topK: z.number().int().positive().default(4)
});
export type QueryRagInput = z.infer<typeof QueryRagInputSchema>;

export const RetrievedContextSchema = z.object({
  text: z.string().min(1),
  source: z.string().min(1)
});
export type RetrievedContext = z.infer<typeof RetrievedContextSchema>;

export const QueryRagOutputSchema = z.object({
  answer: z.string().min(1),
  sources: z.array(z.string())
});
export type QueryRagOutput = z.infer<typeof QueryRagOutputSchema>;

export const SearchResultSchema = z.object({
  contexts: z.array(z.string()),
  sources: z.array(z.string())
});
export type SearchResult = z.infer<typeof SearchResultSchema>;

export const IngestPdfInputSchema = z.object({
  filePath: z.string().min(1),
  sourceId: z.string().min(1)
});
export type IngestPdfInput = z.infer<typeof IngestPdfInputSchema>;

export const IngestPdfOutputSchema = z.object({
  status: z.literal("ingested"),
  ingested: z.number().int().nonnegative(),
  source: z.string()
});
export type IngestPdfOutput = z.infer<typeof IngestPdfOutputSchema>;
