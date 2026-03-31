import logging
import os
import uuid
import datetime
import requests

from dotenv import load_dotenv
from fastapi import FastAPI
import inngest
import inngest.fast_api
from inngest.experimental import ai

from data_loader import load_and_chunk_pdf, embed_texts
from vector_db import ChromaStorage
from custom_types import RAQQueryResult, RAGSearchResult, RAGUpsertResult, RAGChunkAndSrc, RAGIngestTextRequest
from llama_index.core.node_parser import SentenceSplitter


load_dotenv()
IS_TEST_MODE = os.getenv("RAG_TEST_MODE", "0") == "1"
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "openai").strip().lower()
OLLAMA_TIMEOUT_SECONDS = int(os.getenv("OLLAMA_TIMEOUT_SECONDS", "300"))
splitter = SentenceSplitter(chunk_size=1000, chunk_overlap=200) if not IS_TEST_MODE else None

app = FastAPI()

inngest_client = inngest.Inngest(
    app_id="rag_app",
    logger=logging.getLogger("uvicorn"),
    is_production=False,
    serializer=inngest.PydanticSerializer(),
)


@inngest_client.create_function(
    fn_id="RAG: Ingest PDF",
    trigger=inngest.TriggerEvent(event="rag/ingest_pdf"),
    throttle=inngest.Throttle(
        limit=2, period=datetime.timedelta(minutes=1)
    ),
    rate_limit=None if IS_TEST_MODE else inngest.RateLimit(
        limit=1,
        period=datetime.timedelta(hours=4),
        key="event.data.source_id",
    ),
)
async def rag_ingest_pdf(ctx: inngest.Context):
    def _load(ctx: inngest.Context) -> RAGChunkAndSrc:
        pdf_path = ctx.event.data["pdf_path"]
        source_id = ctx.event.data.get("source_id", pdf_path)
        chunks = load_and_chunk_pdf(pdf_path)
        return RAGChunkAndSrc(chunks=chunks, source_id=source_id)

    def _upsert(chunks_and_src: RAGChunkAndSrc) -> RAGUpsertResult:
        chunks = chunks_and_src.chunks
        source_id = chunks_and_src.source_id
        vecs = embed_texts(chunks)
        ids = [str(uuid.uuid5(uuid.NAMESPACE_URL, f"{source_id}:{i}")) for i in range(len(chunks))]
        payloads = [{"source": source_id, "text": chunks[i]} for i in range(len(chunks))]
        ChromaStorage().upsert(ids, vecs, payloads)
        return RAGUpsertResult(ingested=len(chunks))

    chunks_and_src = await ctx.step.run(
        "load-and-chunk",
        lambda: _load(ctx),
        output_type=RAGChunkAndSrc,
    )
    ingested = await ctx.step.run(
        "embed-and-upsert",
        lambda: _upsert(chunks_and_src),
        output_type=RAGUpsertResult,
    )
    return ingested.model_dump()


@inngest_client.create_function(
    fn_id="RAG: Ingest Text Content",
    trigger=inngest.TriggerEvent(event="rag/ingest_text_content"),
    throttle=inngest.Throttle(
        limit=5, period=datetime.timedelta(minutes=1)
    ),
    rate_limit=None if IS_TEST_MODE else inngest.RateLimit(
        limit=10,
        period=datetime.timedelta(hours=1),
        key="event.data.source_id",
    ),
)
async def rag_ingest_text_content(ctx: inngest.Context):
    def _chunk_text(text_content: str) -> list[str]:
        if IS_TEST_MODE:
            return [text_content[:500], text_content[500:1000]] if len(text_content) > 500 else [text_content]
        if splitter is None:
            return [text_content]
        return splitter.split_text(text_content)

    def _upsert_text(chunks_and_src: RAGChunkAndSrc) -> RAGUpsertResult:
        chunks = chunks_and_src.chunks
        source_id = chunks_and_src.source_id
        if not chunks:
            return RAGUpsertResult(ingested=0)
        vecs = embed_texts(chunks)
        ids = [str(uuid.uuid5(uuid.NAMESPACE_URL, f"{source_id}:{i}")) for i in range(len(chunks))]
        payloads = [{"source": source_id, "text": chunks[i]} for i in range(len(chunks))]
        ChromaStorage().upsert(ids, vecs, payloads)
        return RAGUpsertResult(ingested=len(chunks))

    text_content = ctx.event.data.get("text_content", "")
    source_id = ctx.event.data.get("source_id", "scraped_content")
    
    if not text_content or not text_content.strip():
        return {"ingested": 0, "error": "Empty text content"}

    chunks_and_src = await ctx.step.run(
        "chunk-text",
        lambda: RAGChunkAndSrc(
            chunks=_chunk_text(text_content),
            source_id=source_id,
        ),
        output_type=RAGChunkAndSrc,
    )
    
    ingested = await ctx.step.run(
        "embed-and-upsert-text",
        lambda: _upsert_text(chunks_and_src),
        output_type=RAGUpsertResult,
    )
    return ingested.model_dump()


@inngest_client.create_function(
    fn_id="RAG: Query PDF",
    trigger=inngest.TriggerEvent(event="rag/query_pdf_ai"),
)
async def rag_query_pdf_ai(ctx: inngest.Context):
    def _search(question: str, top_k: int = 5) -> RAGSearchResult:
        query_vec = embed_texts([question])[0]
        store = ChromaStorage()
        found = store.search(query_vec, top_k)
        return RAGSearchResult(contexts=found["contexts"], sources=found["sources"])

    question = ctx.event.data["question"]
    top_k = int(ctx.event.data.get("top_k", 5))

    found = await ctx.step.run(
        "embed-and-search",
        lambda: _search(question, top_k),
        output_type=RAGSearchResult,
    )

    if IS_TEST_MODE:
        # Avoid OpenAI during local tests; return the best available context.
        answer = (
            found.contexts[0]
            if found.contexts
            else "No indexed context found yet. Upload a PDF and wait for ingestion to complete."
        )
        return {"answer": answer, "sources": found.sources, "num_contexts": len(found.contexts)}

    context_block = "\n\n".join(f"- {c}" for c in found.contexts)
    user_content = (
        "Use the following context to answer the question.\n\n"
        f"Context:\n{context_block}\n\n"
        f"Question: {question}\n"
        "Answer concisely using the context above."
    )

    def _ollama_answer(prompt: str) -> str:
        base_url = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434").rstrip("/")
        model = os.getenv("OLLAMA_MODEL", "qwen2.5:14b")
        resp = requests.post(
            f"{base_url}/api/generate",
            json={
                "model": model,
                "prompt": (
                    "You answer questions using only the provided context.\n\n"
                    f"{prompt}"
                ),
                "stream": False,
                "options": {"temperature": 0.2},
            },
            timeout=OLLAMA_TIMEOUT_SECONDS,
        )
        resp.raise_for_status()
        data = resp.json()
        answer = (data.get("response") or "").strip()
        if not answer:
            raise RuntimeError("Ollama returned an empty response.")
        return answer

    if LLM_PROVIDER == "ollama":
        answer = await ctx.step.run(
            "ollama-answer",
            lambda: _ollama_answer(user_content),
            output_type=str,
        )
    else:
        adapter = ai.openai.Adapter(
            auth_key=os.getenv("OPENAI_API_KEY"),
            model="gpt-4o-mini",
        )

        res = await ctx.step.ai.infer(
            "llm-answer",
            adapter=adapter,
            body={
                "max_tokens": 1024,
                "temperature": 0.2,
                "messages": [
                    {"role": "system", "content": "You answer questions using only the provided context."},
                    {"role": "user", "content": user_content},
                ],
            },
        )

        answer = res["choices"][0]["message"]["content"].strip()
    return {"answer": answer, "sources": found.sources, "num_contexts": len(found.contexts)}


inngest.fast_api.serve(app, inngest_client, [rag_ingest_pdf, rag_ingest_text_content, rag_query_pdf_ai])


@app.get("/")
def healthcheck() -> dict[str, str]:
    return {"status": "ok", "app_id": os.getenv("INNGEST_APP_ID", "rag_app")}


@app.post("/api/v1/ingest-text")
async def ingest_text_endpoint(request: RAGIngestTextRequest) -> dict:
    """
    HTTP endpoint for ingesting raw text content (e.g., from web scraper).
    Sends an Inngest event to process the text asynchronously.
    
    Request body:
    {
      "text_content": "...",      // Required: raw text to ingest
      "source_id": "...",           // Required: unique identifier (URL, document name, etc.)
      "title": "...",               // Optional: human-readable title
      "url": "..."                  // Optional: source URL
    }
    """
    try:
        text_content = request.text_content.strip()
        
        if not text_content:
            return {"success": False, "error": "text_content is required and cannot be empty"}
        
        # Send event to Inngest for async processing
        await inngest_client.send(
            inngest.Event(
                name="rag/ingest_text_content",
                data={
                    "text_content": text_content,
                    "source_id": request.source_id,
                    "title": request.title or request.source_id,
                    "url": request.url or "",
                },
            )
        )
        
        return {
            "success": True,
            "message": f"Ingestion event sent for source: {request.source_id}",
            "source_id": request.source_id,
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


@app.post("/api/v1/query")
async def query_vector_db(request: dict) -> dict:
    """
    HTTP endpoint for querying the vector DB.
    
    Request body:
    {
      "question": "...",      // Required: question to ask
      "top_k": 5              // Optional: number of results (default: 5)
    }
    """
    try:
        question = request.get("question", "").strip()
        top_k = int(request.get("top_k", 5))
        
        if not question:
            return {"success": False, "error": "question is required"}
        
        # Search vector DB
        query_vec = embed_texts([question])[0]
        store = ChromaStorage()
        found = store.search(query_vec, top_k)
        
        return {
            "success": True,
            "contexts": found["contexts"],
            "sources": found["sources"],
            "num_results": len(found["contexts"]),
        }
    except Exception as e:
        return {"success": False, "error": str(e)}
