import logging
from fastapi import FastAPI
from app.api.router import router
from app.api.middleware import APIKeyMiddleware, RateLimitMiddleware

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)

app = FastAPI(
    title="Web Scraper Microservice",
    description="Scrape static and dynamic websites, returns structured JSON.",
    version="1.0.0",
)

# Middleware (order matters - first added = outermost)
app.add_middleware(RateLimitMiddleware)
app.add_middleware(APIKeyMiddleware)

# Routes
app.include_router(router, prefix="/api/v1")


@app.get("/health")
async def health_check():
    return {"status": "ok"}
