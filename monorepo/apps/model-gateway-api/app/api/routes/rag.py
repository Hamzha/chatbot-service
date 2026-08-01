from __future__ import annotations

from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.core.config import settings
from app.schemas.rag import RagQueryRequest, RagTextIngestRequest
from app.services.chat_service import rag_ingest_pdf_use_case, rag_ingest_text_use_case, rag_query_use_case, rag_store


router = APIRouter()


@router.post("/ingest")
async def ingest_pdf(
    file: UploadFile = File(...),
    user_id: str = Form(...),
    source_id: str = Form(...),
):
    filename = (file.filename or "").strip()
    if not filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")

    uploads_dir = Path("uploads").resolve()
    uploads_dir.mkdir(parents=True, exist_ok=True)
    safe_name = Path(filename).name
    target = (uploads_dir / f"{uuid4().hex}-{safe_name}").resolve()
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

    result = await rag_ingest_pdf_use_case.execute(str(target), user_id=user_id, source_id=source_id)
    return result.model_dump()


@router.post("/ingest-text")
async def ingest_text(body: RagTextIngestRequest):
    result = await rag_ingest_text_use_case.execute(body)
    return result.model_dump()


@router.post("/query")
async def query(body: RagQueryRequest):
    result = await rag_query_use_case.execute(body)
    return result.model_dump()


@router.get("/sources")
async def list_sources(user_id: str):
    return {"sources": rag_store.list_sources(user_id)}


@router.delete("/sources/{source_id}")
async def delete_source(source_id: str, user_id: str):
    deleted = rag_store.delete_source(user_id=user_id, source_id=source_id)
    return {"deleted_chunks": deleted, "source": source_id}