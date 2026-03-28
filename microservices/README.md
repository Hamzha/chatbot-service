# Project Monorepo

This repository contains three microservices that work together to provide an AI-powered chatbot platform with authentication and web scraping capabilities.

## Services

### 1. Auth Service (`auth-service/`)
A modular authentication system built with Next.js App Router.

- Signup, login, logout with JWT session cookies (HTTP-only)
- Password hashing with bcrypt
- Route protection via `proxy.ts`
- Reusable UI components and `useAuth` hook
- MongoDB + Mongoose for user storage
- Includes a scaffolder to copy the auth stack into other Next.js projects

**Quick start:**
```bash
cd auth-service
npm install
# Set up .env.local (see auth-service/README.md)
npm run dev
# Open http://localhost:3000
```

### 2. Chatbot Service (`chatbot-service/`)
A local RAG (Retrieval-Augmented Generation) app for PDF-based Q&A.

- FastAPI + Inngest for ingest/query orchestration
- Chroma for local vector storage
- Streamlit for upload and chat UI
- Ollama for local embeddings and LLM generation

**Prerequisites:** Python, Node.js (for Inngest CLI), [Ollama](https://ollama.com/)

**Quick start:**
```bash
cd chatbot-service
# Pull Ollama models
ollama pull nomic-embed-text
ollama pull qwen2.5:14b
# Start API, Inngest, and Streamlit (see chatbot-service/README.md for details)
```

### 3. Web Scraper (`webscrapper/`)
A FastAPI-based web scraping microservice that returns structured JSON data from any URL.

- Supports static (httpx + BeautifulSoup) and dynamic (Playwright) scraping
- Auto-detection mode picks the right scraper
- Recursive website crawling with BFS traversal
- SSRF prevention, API key auth, rate limiting

**Quick start:**
```bash
cd webscrapper
source venv/Scripts/activate
uvicorn app.main:app --reload
# Docs at http://localhost:8000/docs
```

## Architecture

```
├── auth-service/       # Next.js authentication system (port 3000)
├── chatbot-service/    # RAG chatbot pipeline (API + Inngest + Streamlit)
├── webscrapper/        # Web scraping microservice (port 8000)
└── .gitignore
```

## Service Ports

| Service         | Port  | URL                          |
|-----------------|-------|------------------------------|
| Auth Service    | 3000  | http://localhost:3000        |
| Chatbot API     | 8000  | http://localhost:8000        |
| Inngest Dev     | 8288  | http://localhost:8288        |
| Streamlit UI    | 8501  | http://localhost:8501        |
| Web Scraper     | 8000  | http://localhost:8000        |

> **Note:** Chatbot API and Web Scraper both default to port 8000 — run them on different ports if using simultaneously.

For detailed setup, environment variables, and troubleshooting, see the README inside each service folder.
