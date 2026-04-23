from fastapi import APIRouter, HTTPException

from app.schemas.chat import ChatRequest, ChatResponse
from app.services.chat_service import chat_service


router = APIRouter()


@router.post("/completions", response_model=ChatResponse)
async def create_chat_completion(payload: ChatRequest) -> ChatResponse:
    try:
        return await chat_service.create_chat_completion(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc