import { readFile } from "node:fs/promises";
import type { PdfLoaderPort } from "@rag/ports";
import pdfParse from "pdf-parse";

export class PdfParseAdapter implements PdfLoaderPort {
  constructor(
    private readonly chunkSize = 1000,
    private readonly chunkOverlap = 200
  ) {}

  async loadAndChunk(filePath: string): Promise<string[]> {
    const buffer = await readFile(filePath);
    const data = await pdfParse(buffer);
    return this.splitText(data.text);
  }

  private splitText(text: string): string[] {
    const chunks: string[] = [];
    let start = 0;
    while (start < text.length) {
      const end = Math.min(start + this.chunkSize, text.length);
      const chunk = text.slice(start, end).trim();
      if (chunk.length > 0) {
        chunks.push(chunk);
      }
      start += this.chunkSize - this.chunkOverlap;
    }
    return chunks;
  }
}
