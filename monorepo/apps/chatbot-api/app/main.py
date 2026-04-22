from __future__ import annotations

import asyncio
import datetime
import logging
from pathlib import Path
from typing import Annotated
from uuid import uuid4

import inngest
import inngest.fast_api
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, Header, HTTPException, UploadFile
from fastapi.exception_handlers import (
    http_exception_handler,
    request_validation_exception_handler,
)
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.requests import Request

from app.auth import AuthenticatedUser, resolve_authenticated_user
from app.config import settings
from app.contracts import IngestInput, IngestTextInput, IngestTextRequest, QueryInput, QueryRequest
from app.engine import IngestPdfUseCase, IngestTextUseCase, QueryRagUseCase
from app.providers import build_provider_clients
from app.vector_store import ChromaVectorStore

load_dotenv()

app = FastAPI(title="chatbot-backend", version="0.1.0")
logger = logging.getLogger("chatbot-api")
logging.basicConfig(level=getattr(logging, settings.log_level.upper(), logging.INFO))

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

embedder, generator = build_provider_clients()
store = ChromaVectorStore()
ingest_use_case = IngestPdfUseCase(embedder=embedder, store=store)
ingest_text_use_case = IngestTextUseCase(embedder=embedder, store=store)
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
        user_id=ctx.event.data["user_id"],
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
    raw_cc = ctx.event.data.get("conversation_context")
    cc: str | None = None
    if raw_cc is not None:
        s = str(raw_cc).strip()
        cc = s if s else None
    raw_sids = ctx.event.data.get("source_ids")
    source_ids: list[str] | None = None
    if isinstance(raw_sids, list) and raw_sids:
        source_ids = [str(x).strip() for x in raw_sids if str(x).strip()]
        if not source_ids:
            source_ids = None
    payload = QueryInput(
        user_id=ctx.event.data["user_id"],
        question=ctx.event.data["question"],
        top_k=int(ctx.event.data.get("top_k", 4)),
        conversation_context=cc,
        source_ids=source_ids,
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
async def ingest(
    file: UploadFile = File(...),
    x_rag_source_id: str | None = Header(default=None, alias="x-rag-source-id"),
    user: Annotated[AuthenticatedUser, Depends(resolve_authenticated_user)] = None,
):
    filename = (file.filename or "").strip()
    if not filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")
    rag_key = (x_rag_source_id or "").strip() or filename
    uploads_dir = Path("uploads").resolve()
    uploads_dir.mkdir(parents=True, exist_ok=True)
    safe_name = Path(filename).name
    now_ts = int(datetime.datetime.now(datetime.UTC).timestamp())
    target = (uploads_dir / f"{now_ts}-{uuid4().hex}-{safe_name}").resolve()
    if uploads_dir not in target.parents:
        raise HTTPException(status_code=400, detail="Invalid filename")

    written = 0
    with target.open("wb") as out:
        while True:
            chunk = await file.read(1024 * 1024)
            if not chunk:
                break
            written += len(chunk)
            if written > settings.max_upload_size_bytes:
                out.close()
                target.unlink(missing_ok=True)
                raise HTTPException(status_code=413, detail="Uploaded file is too large")
            out.write(chunk)
    if written == 0:
        target.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    event_ids = await inngest_client.send(
        inngest.Event(
            name="chatbot/ingest_pdf",
            data={"user_id": user.user_id, "pdf_path": str(target), "source_id": rag_key},
        )
    )
    return {"event_ids": event_ids, "source_id": rag_key}


@app.post("/v1/ingest-text")
async def ingest_text(
    body: IngestTextRequest,
    user: Annotated[AuthenticatedUser, Depends(resolve_authenticated_user)] = None,
):
    """Ingest plain text (e.g. web scrape) into Chroma for the authenticated user."""
    uid = user.user_id
    sid = body.source_id.strip()
    payload = IngestTextInput(user_id=uid, source_id=sid, text_content=body.text_content)
    result = await asyncio.to_thread(ingest_text_use_case.execute, payload)
    return {"ingested": result.ingested, "source_id": result.source}


def _normalize_source_ids(raw: list[str] | None) -> list[str] | None:
    if not raw:
        return None
    out = [s.strip() for s in raw if s.strip()]
    return out or None


@app.post("/v1/query")
async def query(
    body: QueryRequest,
    user: Annotated[AuthenticatedUser, Depends(resolve_authenticated_user)] = None,
):
    cc = body.conversation_context.strip() if body.conversation_context else None
    source_ids = _normalize_source_ids(body.source_ids)
    event_ids = await inngest_client.send(
        inngest.Event(
            name="chatbot/query",
            data={
                "user_id": user.user_id,
                "question": body.question,
                "top_k": body.top_k,
                "conversation_context": cc,
                "source_ids": source_ids,
            },
        )
    )
    return {"event_ids": event_ids}


@app.post("/v1/query/sync")
async def query_sync(
    body: QueryRequest,
    user: Annotated[AuthenticatedUser, Depends(resolve_authenticated_user)] = None,
):
    cc = body.conversation_context.strip() if body.conversation_context else None
    source_ids = _normalize_source_ids(body.source_ids)
    payload = QueryInput(
        user_id=user.user_id,
        question=body.question,
        top_k=body.top_k,
        conversation_context=cc,
        source_ids=source_ids,
    )
    result = await asyncio.to_thread(query_use_case.execute, payload)
    return result.model_dump()


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


@app.get("/v1/sources")
async def list_sources(user: Annotated[AuthenticatedUser, Depends(resolve_authenticated_user)] = None):
    return {"sources": store.list_sources(user.user_id)}


@app.delete("/v1/sources/{source_id}")
async def delete_source(
    source_id: str,
    user: Annotated[AuthenticatedUser, Depends(resolve_authenticated_user)] = None,
):
    deleted = store.delete_source(user_id=user.user_id, source_id=source_id)
    return {"deleted_chunks": deleted, "source": source_id}


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """Return JSON on 500 so proxies and clients can parse errors (not HTML/plain)."""
    if isinstance(exc, HTTPException):
        return await http_exception_handler(request, exc)
    if isinstance(exc, RequestValidationError):
        return await request_validation_exception_handler(request, exc)
    request_id = request.headers.get("x-request-id", uuid4().hex)
    logger.exception("Unhandled exception request_id=%s path=%s", request_id, request.url.path)
    detail = "Internal server error"
    if not settings.is_production:
        detail = f"{type(exc).__name__}: {exc}"
    return JSONResponse(
        status_code=500,
        content={
            "detail": detail,
            "error": "internal_server_error",
            "request_id": request_id,
        },
    )

