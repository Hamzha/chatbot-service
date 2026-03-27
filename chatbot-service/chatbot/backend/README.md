# Chatbot Backend

Standalone Python backend with:

- FastAPI delivery layer
- Inngest event-driven workflows
- Modular engine with provider adapters (OpenAI or Ollama via env)
- Local Chroma vector persistence

## Run

1. `cp .env.example .env` and set secrets
2. `pip install -e .`
3. `uvicorn app.main:app --reload --port 8000`

## Inngest

Run Inngest dev server and point it to:

- `http://127.0.0.1:8000/api/inngest`

