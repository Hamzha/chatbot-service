from __future__ import annotations

from pypdf import PdfReader


def chunk_text(text: str, chunk_size: int = 900, overlap: int = 120) -> list[str]:
    cleaned = " ".join(text.split())
    if not cleaned:
        return []
    chunks: list[str] = []
    start = 0
    while start < len(cleaned):
        end = min(len(cleaned), start + chunk_size)
        chunk = cleaned[start:end].strip()
        if chunk:
            chunks.append(chunk)
        if end >= len(cleaned):
            break
        start = max(0, end - overlap)
    return chunks


def load_and_chunk_pdf(pdf_path: str) -> list[str]:
    reader = PdfReader(pdf_path)
    parts: list[str] = []
    for page in reader.pages:
        parts.append(page.extract_text() or "")
    return chunk_text("\n".join(parts))