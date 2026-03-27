# Project Implementations Overview

This repository now contains three implementation paths for the same RAG-style chatbot workflow.

## 1) Root Python implementation (`/`)

### What it is
- Original Python app at repo root with:
  - FastAPI + Inngest orchestration
  - Streamlit UI
  - Local vector store
  - Local/remote model support depending on env

### Main files
- `main.py` (API + Inngest functions)
- `streamlit_app.py` (UI)
- `data_loader.py`, `vector_db.py`, `custom_types.py`
- `scripts/` (run helpers)

### Best use
- Quick local development and experimentation in one place.

---

## 2) JavaScript monorepo implementation (`/javascript-implementation`)

### What it is
- TypeScript/Node monorepo split into apps and packages.
- API and UI are separated, with shared contracts/core/ports packages.

### Main structure
- `javascript-implementation/apps/api` (Fastify + Inngest API)
- `javascript-implementation/apps/ui` (web UI)
- `javascript-implementation/packages/contracts` (schemas/types)
- `javascript-implementation/packages/core` (use-cases)
- `javascript-implementation/packages/ports` (interfaces)

### Best use
- Strong modularity in TypeScript with explicit clean-architecture layers.

---

## 3) Standalone modular chatbot project (`/chatbot`)

### What it is
- Fully independent project created to be plug-and-play.
- Python backend engine + Next.js frontend.
- No imports from other repository folders.

### Main structure
- `chatbot/backend`
  - FastAPI + Inngest
  - Modular engine (`app/engine.py`)
  - Provider adapters (`app/providers.py`) with env switch:
    - `MODEL_PROVIDER=openai` or `MODEL_PROVIDER=ollama`
- `chatbot/frontend`
  - Next.js chat/upload UI
- `chatbot/scripts`
  - Setup + run scripts for backend/frontend/inngest/dev-all

### Best use
- Production-style modular setup where backend engine can be reused with any UI.

---

## Recommended choice

- Use **`chatbot/`** as the primary forward path for modular, UI-swappable architecture.
- Keep root Python and JavaScript implementations as references/alternatives.

---

## Quick run commands

From repo root:

```powershell
./chatbot/scripts/setup-backend.ps1
./chatbot/scripts/setup-frontend.ps1
./chatbot/scripts/dev-all.ps1
```

Open:
- `http://127.0.0.1:3000` (Next.js UI)
- `http://127.0.0.1:8000/v1/health` (Backend health)

