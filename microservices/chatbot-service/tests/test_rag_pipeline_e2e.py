import uuid

from data_loader import embed_texts, load_and_chunk_pdf
from vector_db import ChromaStorage


def test_rag_pipeline_ingest_and_query_e2e(tmp_path, monkeypatch):
    # Ensure deterministic test behavior (no OpenAI / no real PDF parsing).
    monkeypatch.setenv("RAG_TEST_MODE", "1")
    monkeypatch.setenv("CHROMA_PERSIST_DIR", str(tmp_path / "chroma_data"))

    store = ChromaStorage(collection="docs_test")

    source_id = "dummy.pdf"
    pdf_path = "dummy.pdf"

    chunks = load_and_chunk_pdf(pdf_path)
    assert len(chunks) == 2

    vecs = embed_texts(chunks)
    ids = [str(uuid.uuid5(uuid.NAMESPACE_URL, f"{source_id}:{i}")) for i in range(len(chunks))]
    payloads = [{"source": source_id, "text": chunks[i]} for i in range(len(chunks))]

    store.upsert(ids=ids, vectors=vecs, payloads=payloads)

    query_vec = embed_texts(["cats"])[0]
    found = store.search(query_vec, top_k=2)

    assert found["contexts"], "Expected at least one retrieved context"
    assert "Cats chunk" in found["contexts"][0]
    assert found["sources"] == [source_id]

    # Mirrors `main.py` behavior when `RAG_TEST_MODE=1` (no OpenAI call).
    answer = found["contexts"][0] if found["contexts"] else ""
    assert "Cats chunk" in answer

