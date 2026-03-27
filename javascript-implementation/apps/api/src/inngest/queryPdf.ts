import { inngest } from "./client.js";
import { queryUseCase } from "../container.js";

export const queryPdf = inngest.createFunction(
  { id: "query-pdf" },
  { event: "rag/query-pdf" },
  async ({ event, step }) => {
    const { question, history, topK } = event.data;

    return step.run("execute-rag-query", () =>
      queryUseCase.execute({ question, history, topK })
    );
  }
);
