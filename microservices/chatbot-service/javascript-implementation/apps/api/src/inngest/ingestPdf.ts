import { inngest } from "./client.js";
import { ingestUseCase } from "../container.js";

export const ingestPdf = inngest.createFunction(
  {
    id: "ingest-pdf",
    throttle: { limit: 2, period: "60s" }
  },
  { event: "rag/ingest-pdf" },
  async ({ event, step }) => {
    const { filePath, sourceId } = event.data;

    return step.run("ingest-pdf", () =>
      ingestUseCase.execute({ filePath, sourceId })
    );
  }
);
