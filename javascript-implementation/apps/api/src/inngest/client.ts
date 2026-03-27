import { Inngest } from "inngest";

type RagEvents = {
  "rag/ingest-pdf": {
    data: {
      filePath: string;
      sourceId: string;
    };
  };
  "rag/query-pdf": {
    data: {
      question: string;
      history: { role: "user" | "assistant"; content: string }[];
      topK: number;
    };
  };
};

export const inngest = new Inngest({
  id: "rag-app",
  schemas: new Map() as never
});

export type { RagEvents };
