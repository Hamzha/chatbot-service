import { QueryRagUseCase, IngestPdfUseCase } from "@rag/core";
import {
  PdfParseAdapter,
  OllamaEmbedderAdapter,
  ChromaVectorStoreAdapter,
  OllamaGeneratorAdapter,
  ChromaRetrieverAdapter
} from "./adapters/index.js";

export const pdfLoader = new PdfParseAdapter(1000, 200);
export const embedder = new OllamaEmbedderAdapter();
export const vectorStore = new ChromaVectorStoreAdapter();
export const generator = new OllamaGeneratorAdapter();
export const retriever = new ChromaRetrieverAdapter(embedder, vectorStore);

export const ingestUseCase = new IngestPdfUseCase(pdfLoader, embedder, vectorStore);
export const queryUseCase = new QueryRagUseCase(retriever, generator, { maxHistoryTurns: 6 });
