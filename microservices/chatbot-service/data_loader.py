import os
import requests
from openai import OpenAI
from llama_index.readers.file import PDFReader
from llama_index.core.node_parser import SentenceSplitter
from dotenv import load_dotenv

load_dotenv()

def _is_test_mode() -> bool:
    # Read env dynamically so tests can set RAG_TEST_MODE after imports.
    return os.getenv("RAG_TEST_MODE", "0") == "1"

EMBED_MODEL = "text-embedding-3-large"
EMBED_DIM = 3072

client = None
splitter = None
if not _is_test_mode() and os.getenv("EMBED_PROVIDER", "openai").strip().lower() == "openai":
    client = OpenAI()
if not _is_test_mode():
    splitter = SentenceSplitter(chunk_size=1000, chunk_overlap=200)


def load_and_chunk_pdf(path: str):
    # Deterministic fake chunks for CI / local integration tests.
    if _is_test_mode():
        return [
            "Cats chunk: Cats are great companions and love to nap.",
            "Dogs chunk: Dogs are friendly and enjoy long walks.",
        ]

    docs = PDFReader().load_data(file=path)
    texts = [d.text for d in docs if getattr(d, "text", None)]
    chunks = []
    for t in texts:
        chunks.extend(splitter.split_text(t))
    return chunks


def embed_texts(texts: list[str]) -> list[list[float]]:
    # Deterministic fake embeddings for CI / local integration tests.
    # We keep this tiny so tests run quickly.
    if _is_test_mode():
        def _embed_one(t: str) -> list[float]:
            tl = t.lower()
            cats = float(tl.count("cats"))
            dogs = float(tl.count("dogs"))
            if cats == 0 and dogs == 0:
                # Avoid all-zero vectors; keep similarity stable.
                return [0.5, 0.5]
            return [cats, dogs]

        return [_embed_one(t) for t in texts]

    provider = os.getenv("EMBED_PROVIDER", "openai").strip().lower()
    if provider == "ollama":
        base_url = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434").rstrip("/")
        model = os.getenv("OLLAMA_EMBED_MODEL", "nomic-embed-text")
        out: list[list[float]] = []
        for text in texts:
            resp = requests.post(
                f"{base_url}/api/embeddings",
                json={"model": model, "prompt": text},
                timeout=120,
            )
            resp.raise_for_status()
            data = resp.json()
            vec = data.get("embedding")
            if not isinstance(vec, list) or not vec:
                raise RuntimeError("Ollama embeddings returned an invalid vector.")
            out.append(vec)
        return out

    assert client is not None
    response = client.embeddings.create(
        model=EMBED_MODEL,
        input=texts,
    )
    return [item.embedding for item in response.data]

