from __future__ import annotations

import asyncio
import datetime
from pathlib import Path

import inngest
import inngest.fast_api
from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.contracts import IngestInput, QueryInput
from app.engine import IngestPdfUseCase, QueryRagUseCase
from app.providers import build_provider_clients
from app.vector_store import ChromaVectorStore

load_dotenv()

app = FastAPI(title="chatbot-backend", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

embedder, generator = build_provider_clients()
store = ChromaVectorStore()
ingest_use_case = IngestPdfUseCase(embedder=embedder, store=store)
query_use_case = QueryRagUseCase(embedder=embedder, generator=generator, store=store)

inngest_client = inngest.Inngest(
    app_id=settings.inngest_app_id,
    is_production=False,
    serializer=inngest.PydanticSerializer(),
    api_base_url=settings.inngest_api_base_url,
    event_api_base_url=settings.inngest_event_api_base_url,
)


@inngest_client.create_function(
    fn_id="Chatbot: Ingest PDF",
    trigger=inngest.TriggerEvent(event="chatbot/ingest_pdf"),
    throttle=inngest.Throttle(limit=2, period=datetime.timedelta(minutes=1)),
)
async def ingest_pdf_fn(ctx: inngest.Context):
    payload = IngestInput(
        pdf_path=ctx.event.data["pdf_path"],
        source_id=ctx.event.data["source_id"],
    )
    result = await ctx.step.run(
        "ingest-pdf",
        lambda: ingest_use_case.execute(payload).model_dump(),
    )
    return result


@inngest_client.create_function(
    fn_id="Chatbot: Query",
    trigger=inngest.TriggerEvent(event="chatbot/query"),
)
async def query_fn(ctx: inngest.Context):
    payload = QueryInput(
        question=ctx.event.data["question"],
        top_k=int(ctx.event.data.get("top_k", 4)),
    )
    result = await ctx.step.run(
        "query-rag",
        lambda: query_use_case.execute(payload).model_dump(),
    )
    return result


inngest.fast_api.serve(app, inngest_client, [ingest_pdf_fn, query_fn])


@app.get("/v1/health")
def health() -> dict[str, str]:
    return {"status": "ok", "provider": settings.model_provider}


@app.post("/v1/ingest")
async def ingest(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")
    uploads_dir = Path("uploads")
    uploads_dir.mkdir(parents=True, exist_ok=True)
    target = uploads_dir / f"{int(datetime.datetime.utcnow().timestamp())}-{file.filename}"
    content = await file.read()
    target.write_bytes(content)
    event_ids = await inngest_client.send(
        inngest.Event(
            name="chatbot/ingest_pdf",
            data={"pdf_path": str(target), "source_id": file.filename},
        )
    )
    return {"event_ids": event_ids, "source_id": file.filename}


@app.post("/v1/query")
async def query(body: QueryInput):
    event_ids = await inngest_client.send(
        inngest.Event(
            name="chatbot/query",
            data={"question": body.question, "top_k": body.top_k},
        )
    )
    return {"event_ids": event_ids}


@app.post("/v1/query/sync")
async def query_sync(body: QueryInput):
    return query_use_case.execute(body).model_dump()


@app.get("/v1/jobs/{event_id}")
async def get_job(event_id: str):
    url = f"{settings.inngest_api_base_url}/events/{event_id}/runs"
    import requests

    def _fetch():
        return requests.get(url, timeout=10)

    response = await asyncio.to_thread(_fetch)
    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail="Failed to fetch job status from Inngest")
    payload = response.json()
    runs = payload.get("data", [])
    if not runs:
        return {"status": "pending", "output": None}
    run = runs[0]
    return {"status": run.get("status"), "output": run.get("output")}

