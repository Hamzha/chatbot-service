import asyncio
import os
import socket
import subprocess
import time
from typing import Any

import inngest
import pytest
import requests


def _free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return int(s.getsockname()[1])


def _wait_for_http_ok(url: str, timeout_s: float = 60.0, poll_interval_s: float = 0.5) -> None:
    start = time.time()
    last_err: Exception | None = None
    while time.time() - start < timeout_s:
        try:
            resp = requests.get(url, timeout=2)
            if resp.status_code == 200:
                return
        except Exception as e:  # noqa: BLE001
            last_err = e
        time.sleep(poll_interval_s)
    raise TimeoutError(f"Timed out waiting for {url} (last error: {last_err})")


def _wait_for_port_open(host: str, port: int, timeout_s: float = 120.0, poll_interval_s: float = 0.5) -> None:
    start = time.time()
    while time.time() - start < timeout_s:
        try:
            with socket.create_connection((host, port), timeout=2):
                return
        except OSError:
            time.sleep(poll_interval_s)
    raise TimeoutError(f"Timed out waiting for port {host}:{port} to open")


def _fetch_runs(event_id: str, api_base: str) -> list[dict[str, Any]]:
    url = f"{api_base}/events/{event_id}/runs"
    resp = requests.get(url, timeout=5)
    resp.raise_for_status()
    data = resp.json()
    return data.get("data", [])


def _wait_for_run_output(event_id: str, api_base: str, timeout_s: float = 120.0, poll_interval_s: float = 0.5) -> dict[str, Any]:
    start = time.time()
    last_status: str | None = None
    while True:
        runs = _fetch_runs(event_id, api_base)
        if runs:
            run = runs[0]
            status = run.get("status")
            last_status = status or last_status
            if status in ("Completed", "Succeeded", "Success", "Finished"):
                return run.get("output") or {}
            if status in ("Failed", "Cancelled"):
                raise RuntimeError(f"Function run {status}")

        if time.time() - start > timeout_s:
            raise TimeoutError(f"Timed out waiting for run output (last status: {last_status})")
        time.sleep(poll_interval_s)


@pytest.mark.integration
def test_rag_ingest_to_query_e2e(tmp_path, monkeypatch):
    """
    End-to-end test that goes through:
    Streamlit-like event -> Inngest -> FastAPI function -> Chroma storage -> function -> result.

    It uses `RAG_TEST_MODE=1` so embeddings and the answer are deterministic and do not call OpenAI.
    """

    if os.getenv("RUN_INNGEST_E2E", "0") != "1":
        pytest.skip("Set RUN_INNGEST_E2E=1 to run the full Inngest dev-server E2E test.")

    api_port = _free_port()
    inngest_port = _free_port()
    api_base = f"http://127.0.0.1:{api_port}"
    inngest_api_base = f"http://127.0.0.1:{inngest_port}/v1"
    inngest_event_api_base = f"http://127.0.0.1:{inngest_port}/"

    env = os.environ.copy()
    env.update(
        {
            "RAG_TEST_MODE": "1",
            "OPENAI_API_KEY": "test",
            "CHROMA_PERSIST_DIR": str(tmp_path / "chroma_data"),
            # Inngest client uses these env vars (not INNGEST_API_BASE).
            "INNGEST_API_BASE_URL": inngest_api_base,
            "INNGEST_EVENT_API_BASE_URL": inngest_event_api_base,
        }
    )

    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    api_proc = subprocess.Popen(
        [
            "powershell",
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            os.path.join(repo_root, "scripts", "run-api.ps1"),
            "-AppPort",
            str(api_port),
        ],
        cwd=repo_root,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )
    inngest_proc = subprocess.Popen(
        [
            "powershell",
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            os.path.join(repo_root, "scripts", "run-inngest.ps1"),
            "-AppPort",
            str(api_port),
            "-InngestPort",
            str(inngest_port),
        ],
        cwd=repo_root,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )

    try:
        _wait_for_http_ok(f"{api_base}/", timeout_s=60.0)
        _wait_for_http_ok(f"{api_base}/api/inngest", timeout_s=60.0)
        _wait_for_port_open("127.0.0.1", inngest_port, timeout_s=300.0)
        # Give Inngest a moment to finish booting internal routes.
        time.sleep(1.0)

        # Send ingest event.
        client = inngest.Inngest(
            app_id="rag_app",
            is_production=False,
            serializer=inngest.PydanticSerializer(),
            api_base_url=inngest_api_base,
            event_api_base_url=inngest_event_api_base,
        )
        ingest_event = inngest.Event(
            name="rag/ingest_pdf",
            data={"pdf_path": "dummy.pdf", "source_id": "dummy.pdf"},
        )
        ingest_result = asyncio.run(client.send(ingest_event))
        ingest_event_id = ingest_result[0]

        ingest_output = _wait_for_run_output(ingest_event_id, api_base=inngest_api_base, timeout_s=180.0)
        assert ingest_output.get("ingested", 0) == 2

        # Send query event.
        query_event = inngest.Event(
            name="rag/query_pdf_ai",
            data={"question": "cats", "top_k": 2},
        )
        query_result = asyncio.run(client.send(query_event))
        query_event_id = query_result[0]

        query_output = _wait_for_run_output(query_event_id, api_base=inngest_api_base, timeout_s=180.0)
        answer = query_output.get("answer", "")
        sources = query_output.get("sources", [])
        assert "Cats chunk" in answer
        assert "dummy.pdf" in sources
        assert query_output.get("num_contexts", 0) >= 1
    finally:
        api_proc.terminate()
        inngest_proc.terminate()

