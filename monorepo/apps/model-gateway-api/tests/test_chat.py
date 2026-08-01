from fastapi.testclient import TestClient
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

from app.main import app


client = TestClient(app)


def test_chat_completion_success() -> None:
    fake_completion = MagicMock()
    fake_completion.choices = [MagicMock(message=MagicMock(content="Hello from provider"))]

    with patch(
        "app.providers.openrouter_provider.Settings",
        return_value=SimpleNamespace(open_router_api_key="test-key"),
    ):
        with patch("app.providers.openrouter_provider.AsyncOpenAI") as async_openai_mock:
            mock_client = MagicMock()
            mock_client.chat.completions.create = AsyncMock(return_value=fake_completion)
            async_openai_mock.return_value = mock_client

            response = client.post(
                "/api/chat/completions",
                json={
                    "messages": [
                        {"role": "user", "content": "Hello there"},
                    ],
                },
            )

    assert response.status_code == 200
    payload = response.json()
    assert payload["model"] == "openai/gpt-oss-120b:free"
    assert payload["output_text"] == "Hello from provider"


def test_chat_completion_uses_rag_when_user_id_is_present() -> None:
    fake_result = SimpleNamespace(answer="RAG answer", sources=["doc-1"], num_contexts=2)

    with patch("app.providers.openrouter_provider.Settings", return_value=SimpleNamespace(open_router_api_key="test-key")):
        with patch("app.providers.openrouter_provider.AsyncOpenAI"):
            with patch("app.services.chat_service.rag_query_use_case.execute", AsyncMock(return_value=fake_result)):
                response = client.post(
                    "/api/chat/completions",
                    json={
                        "user_id": "user-1",
                        "messages": [
                            {"role": "user", "content": "What is the return policy?"},
                        ],
                        "source_ids": ["doc-1"],
                    },
                )

    assert response.status_code == 200
    payload = response.json()
    assert payload["model"] == "openai/gpt-oss-120b:free"
    assert payload["output_text"] == "RAG answer"
    assert payload["sources"] == ["doc-1"]
    assert payload["num_contexts"] == 2