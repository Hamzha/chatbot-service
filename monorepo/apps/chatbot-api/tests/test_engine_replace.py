from __future__ import annotations

from uuid import uuid4

from app.contracts import IngestTextInput
from app.engine import IngestTextUseCase, _deterministic_id
from app.config import settings
from app.vector_store import ChromaVectorStore


class FakeEmbedder:
    def __init__(self, should_fail: bool = False) -> None:
        self.should_fail = should_fail

    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        if self.should_fail:
            raise RuntimeError("embedding failed")
        return [[0.1, 0.2] for _ in texts]


class FakeStore:
    def __init__(self, old_count: int = 0) -> None:
        self.old_count = old_count
        self.upsert_calls: list[dict] = []
        self.deleted_ids: list[str] = []
        self.delete_source_calls: list[tuple[str, str]] = []

    def count_source_chunks(self, user_id: str, source_id: str) -> int:
        return self.old_count

    def upsert(self, ids, vectors, docs, sources, user_ids) -> None:
        self.upsert_calls.append(
            {"ids": ids, "vectors": vectors, "docs": docs, "sources": sources, "user_ids": user_ids}
        )

    def delete_ids(self, ids: list[str]) -> int:
        self.deleted_ids.extend(ids)
        return len(ids)

    def delete_source(self, user_id: str, source_id: str) -> int:
        self.delete_source_calls.append((user_id, source_id))
        return 0


def test_replace_deletes_only_stale_tail_ids():
    store = FakeStore(old_count=5)
    use_case = IngestTextUseCase(embedder=FakeEmbedder(), store=store)
    result = use_case.execute(
        IngestTextInput(user_id="u1", source_id="s1", text_content="a\n\nb\n\nc"),
    )
    assert result.ingested > 0
    assert len(store.upsert_calls) == 1
    assert len(store.deleted_ids) == 5 - len(store.upsert_calls[0]["ids"])
    if store.deleted_ids:
        assert store.deleted_ids[0] == _deterministic_id("u1", "s1", len(store.upsert_calls[0]["ids"]))


def test_no_delete_when_embedding_fails():
    store = FakeStore(old_count=4)
    use_case = IngestTextUseCase(embedder=FakeEmbedder(should_fail=True), store=store)
    try:
        use_case.execute(IngestTextInput(user_id="u1", source_id="s1", text_content="hello world"))
    except RuntimeError as exc:
        assert "embedding failed" in str(exc)
    else:
        raise AssertionError("Expected embedding failure")
    assert not store.upsert_calls
    assert not store.deleted_ids
    assert not store.delete_source_calls


def test_replace_trims_stale_tail_with_real_chroma(tmp_path, monkeypatch):
    original_dir = settings.chroma_persist_dir
    original_collection = settings.chroma_collection
    try:
        settings.chroma_persist_dir = str(tmp_path / "chroma")
        settings.chroma_collection = f"test_chunks_{uuid4().hex}"
        store = ChromaVectorStore()

        user_id = "u1"
        source_id = "s1"
        old_docs = [f"old-{i}" for i in range(5)]
        old_ids = [_deterministic_id(user_id, source_id, i) for i in range(len(old_docs))]
        store.upsert(
            ids=old_ids,
            vectors=[[0.1, 0.2]] * len(old_docs),
            docs=old_docs,
            sources=[source_id] * len(old_docs),
            user_ids=[user_id] * len(old_docs),
        )
        assert store.count_source_chunks(user_id, source_id) == 5

        monkeypatch.setattr("app.engine.chunk_text", lambda _text: ["new-a", "new-b"])
        use_case = IngestTextUseCase(embedder=FakeEmbedder(), store=store)
        result = use_case.execute(
            IngestTextInput(user_id=user_id, source_id=source_id, text_content="ignored"),
        )
        assert result.ingested == 2

        assert store.count_source_chunks(user_id, source_id) == 2
        sources = store.list_sources(user_id)
        assert len(sources) == 1
        assert sources[0]["source"] == source_id
        assert sources[0]["chunks"] == 2
    finally:
        settings.chroma_persist_dir = original_dir
        settings.chroma_collection = original_collection
