import os

from vector_db import ChromaStorage


def test_chroma_upsert_and_search(tmp_path, monkeypatch):
    persist_dir = tmp_path / "chroma_data"
    monkeypatch.setenv("CHROMA_PERSIST_DIR", str(persist_dir))

    store = ChromaStorage(collection="docs_test")

    ids = ["1", "2"]
    vectors = [
        [1.0, 0.0, 0.0],
        [0.0, 1.0, 0.0],
    ]
    payloads = [
        {"source": "s1", "text": "chunk1"},
        {"source": "s2", "text": "chunk2"},
    ]

    store.upsert(ids=ids, vectors=vectors, payloads=payloads)

    found = store.search(query_vector=[1.0, 0.0, 0.0], top_k=1)
    assert found["contexts"] == ["chunk1"]
    assert sorted(found["sources"]) == ["s1"]

