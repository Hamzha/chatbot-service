// ── Types ────────────────────────────────────────────────────────────────────

type EventSentResponse = {
  status: string;
  eventId: string;
  fileName?: string;
};

type RunPollResponse = {
  status: "pending" | "running" | "completed" | "failed";
  output: Record<string, unknown> | null;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  sources?: string[];
};

// ── State ────────────────────────────────────────────────────────────────────

const chatHistory: ChatMessage[] = [];
let isBusy = false;

// ── API helpers ──────────────────────────────────────────────────────────────

function getApiBase(): string {
  return (window as Window & { __API_BASE__?: string }).__API_BASE__ ?? "http://127.0.0.1:4000";
}

let _pollTimeoutMs: number | null = null;

async function getPollTimeoutMs(): Promise<number> {
  if (_pollTimeoutMs !== null) return _pollTimeoutMs;
  try {
    const resp = await fetch(`${getApiBase()}/config`);
    if (resp.ok) {
      const data = (await resp.json()) as { pollTimeoutMs?: number };
      _pollTimeoutMs = data.pollTimeoutMs ?? 900000;
    } else {
      _pollTimeoutMs = 900000;
    }
  } catch {
    _pollTimeoutMs = 900000;
  }
  return _pollTimeoutMs;
}

async function sendQueryEvent(question: string, history: { role: string; content: string }[], topK: number): Promise<EventSentResponse> {
  const response = await fetch(`${getApiBase()}/rag/query`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ question, history, topK })
  });
  if (!response.ok) throw new Error(`Query failed: ${response.status}`);
  return (await response.json()) as EventSentResponse;
}

async function sendUploadEvent(file: File): Promise<EventSentResponse> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(`${getApiBase()}/rag/upload`, {
    method: "POST",
    body: formData
  });
  if (!response.ok) throw new Error(`Upload failed: ${response.status}`);
  return (await response.json()) as EventSentResponse;
}

async function pollForRunOutput(eventId: string, timeoutMs = 120000, intervalMs = 1500): Promise<Record<string, unknown>> {
  const start = Date.now();
  while (true) {
    const resp = await fetch(`${getApiBase()}/rag/runs/${eventId}`);
    if (!resp.ok) throw new Error(`Polling failed: ${resp.status}`);
    const data = (await resp.json()) as RunPollResponse;
    if (data.status === "completed") return data.output ?? {};
    if (data.status === "failed") throw new Error("Inngest function run failed.");
    if (Date.now() - start > timeoutMs) throw new Error(`Timed out (status: ${data.status})`);
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

// ── CSS (injected once) ──────────────────────────────────────────────────────

function injectStyles() {
  if (document.getElementById("rag-styles")) return;
  const style = document.createElement("style");
  style.id = "rag-styles";
  style.textContent = `
    .shell {
      display: flex;
      flex-direction: column;
      height: 100vh;
      max-width: 860px;
      margin: 0 auto;
      background: #fff;
      box-shadow: 0 0 40px rgba(0,0,0,0.06);
    }

    /* ── Top bar ── */
    .topbar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 14px 20px;
      border-bottom: 1px solid #e4e6eb;
      background: #fff;
      flex-shrink: 0;
    }
    .topbar h1 {
      font-size: 18px;
      font-weight: 700;
      color: #1a1a2e;
      margin-right: auto;
    }
    .nav-btn {
      padding: 7px 16px;
      border: none;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s;
      background: #f0f2f5;
      color: #555;
    }
    .nav-btn:hover { background: #e4e6eb; }
    .nav-btn.active {
      background: #4f46e5;
      color: #fff;
    }

    /* ── Upload page ── */
    .upload-page {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 40px 20px;
      gap: 20px;
    }
    .drop-zone {
      width: 100%;
      max-width: 480px;
      border: 2px dashed #c4c9d4;
      border-radius: 16px;
      padding: 48px 24px;
      text-align: center;
      cursor: pointer;
      transition: all 0.2s;
      background: #fafbfc;
    }
    .drop-zone:hover, .drop-zone.drag-over {
      border-color: #4f46e5;
      background: #f0f0ff;
    }
    .drop-zone .icon { font-size: 40px; margin-bottom: 12px; }
    .drop-zone .label {
      font-size: 15px;
      color: #666;
      line-height: 1.5;
    }
    .drop-zone .label strong { color: #4f46e5; }
    .file-name {
      font-size: 14px;
      color: #333;
      font-weight: 600;
      padding: 8px 16px;
      background: #f0f2f5;
      border-radius: 8px;
    }
    .upload-btn {
      padding: 12px 32px;
      background: #4f46e5;
      color: #fff;
      border: none;
      border-radius: 10px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s;
    }
    .upload-btn:hover { background: #4338ca; }
    .upload-btn:disabled { background: #a5b4fc; cursor: not-allowed; }
    .upload-status {
      font-size: 14px;
      color: #555;
      text-align: center;
      min-height: 20px;
    }
    .upload-status.success { color: #16a34a; font-weight: 600; }
    .upload-status.error { color: #dc2626; font-weight: 600; }

    /* ── Chat page ── */
    .chat-page {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .messages {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .messages::-webkit-scrollbar { width: 6px; }
    .messages::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 3px; }

    .msg {
      max-width: 75%;
      padding: 12px 16px;
      border-radius: 16px;
      font-size: 14px;
      line-height: 1.55;
      word-wrap: break-word;
      white-space: pre-wrap;
    }
    .msg.user {
      align-self: flex-end;
      background: #4f46e5;
      color: #fff;
      border-bottom-right-radius: 4px;
    }
    .msg.assistant {
      align-self: flex-start;
      background: #f0f2f5;
      color: #1a1a2e;
      border-bottom-left-radius: 4px;
    }
    .msg .sources {
      margin-top: 8px;
      font-size: 12px;
      opacity: 0.7;
    }
    .msg.assistant .sources { color: #666; }
    .msg.user .sources { color: rgba(255,255,255,0.7); }

    .msg.typing {
      align-self: flex-start;
      background: #f0f2f5;
      color: #888;
      font-style: italic;
      border-bottom-left-radius: 4px;
    }

    .empty-state {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: #aaa;
      gap: 8px;
    }
    .empty-state .icon { font-size: 48px; }
    .empty-state .text { font-size: 15px; }

    /* ── Input bar ── */
    .input-bar {
      display: flex;
      gap: 10px;
      padding: 14px 20px;
      border-top: 1px solid #e4e6eb;
      background: #fff;
      flex-shrink: 0;
    }
    .input-bar input {
      flex: 1;
      padding: 12px 16px;
      border: 1px solid #d1d5db;
      border-radius: 12px;
      font-size: 14px;
      outline: none;
      transition: border-color 0.15s;
    }
    .input-bar input:focus { border-color: #4f46e5; }
    .input-bar input:disabled { background: #f5f5f5; }
    .send-btn {
      padding: 12px 20px;
      background: #4f46e5;
      color: #fff;
      border: none;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s;
      white-space: nowrap;
    }
    .send-btn:hover { background: #4338ca; }
    .send-btn:disabled { background: #a5b4fc; cursor: not-allowed; }
    .clear-btn {
      padding: 12px 14px;
      background: #f0f2f5;
      color: #666;
      border: none;
      border-radius: 12px;
      font-size: 13px;
      cursor: pointer;
      transition: all 0.15s;
    }
    .clear-btn:hover { background: #e4e6eb; color: #333; }

    /* ── Spinner ── */
    @keyframes pulse {
      0%, 100% { opacity: 0.4; }
      50% { opacity: 1; }
    }
    .dots span {
      animation: pulse 1.4s infinite;
      font-style: normal;
    }
    .dots span:nth-child(2) { animation-delay: 0.2s; }
    .dots span:nth-child(3) { animation-delay: 0.4s; }

    /* ── Progress bar ── */
    .progress-bar {
      width: 100%;
      max-width: 480px;
      height: 6px;
      background: #e4e6eb;
      border-radius: 3px;
      overflow: hidden;
    }
    .progress-bar .fill {
      height: 100%;
      background: #4f46e5;
      border-radius: 3px;
      animation: indeterminate 1.5s infinite ease-in-out;
    }
    @keyframes indeterminate {
      0% { width: 0%; margin-left: 0; }
      50% { width: 60%; margin-left: 20%; }
      100% { width: 0%; margin-left: 100%; }
    }
  `;
  document.head.appendChild(style);
}

// ── Navigation ───────────────────────────────────────────────────────────────

function navigateTo(path: "/upload" | "/chat") {
  history.pushState({}, "", path);
}

function currentPath(): "/upload" | "/chat" {
  return window.location.pathname === "/chat" ? "/chat" : "/upload";
}

// ── Layout ───────────────────────────────────────────────────────────────────

function renderShell(root: HTMLElement, activePath: "/upload" | "/chat", content: string): void {
  root.innerHTML = `
    <div class="shell">
      <div class="topbar">
        <h1>RAG Assistant</h1>
        <button class="nav-btn ${activePath === "/upload" ? "active" : ""}" id="nav-upload">Upload</button>
        <button class="nav-btn ${activePath === "/chat" ? "active" : ""}" id="nav-chat">Chat</button>
      </div>
      ${content}
    </div>
  `;
  document.getElementById("nav-upload")?.addEventListener("click", () => {
    navigateTo("/upload");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  document.getElementById("nav-chat")?.addEventListener("click", () => {
    navigateTo("/chat");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
}

// ── Upload page ──────────────────────────────────────────────────────────────

function renderUploadRoute(root: HTMLElement) {
  renderShell(root, "/upload", `
    <div class="upload-page">
      <div class="drop-zone" id="drop-zone">
        <div class="icon">&#128196;</div>
        <div class="label">
          Drag &amp; drop a PDF here<br/>
          or <strong>click to browse</strong>
        </div>
      </div>
      <input type="file" id="file-input" accept=".pdf" style="display:none" />
      <div class="file-name" id="file-name" style="display:none"></div>
      <button class="upload-btn" id="upload-btn" disabled>Upload &amp; Ingest</button>
      <div class="progress-bar" id="progress" style="display:none"><div class="fill"></div></div>
      <div class="upload-status" id="upload-status"></div>
    </div>
  `);

  const dropZone = document.getElementById("drop-zone")!;
  const fileInput = document.getElementById("file-input") as HTMLInputElement;
  const fileNameEl = document.getElementById("file-name")!;
  const uploadBtn = document.getElementById("upload-btn") as HTMLButtonElement;
  const progress = document.getElementById("progress")!;
  const status = document.getElementById("upload-status")!;
  let selectedFile: File | null = null;

  function selectFile(file: File) {
    selectedFile = file;
    fileNameEl.textContent = file.name;
    fileNameEl.style.display = "block";
    uploadBtn.disabled = false;
    status.textContent = "";
    status.className = "upload-status";
  }

  dropZone.addEventListener("click", () => fileInput.click());
  dropZone.addEventListener("dragover", (e) => { e.preventDefault(); dropZone.classList.add("drag-over"); });
  dropZone.addEventListener("dragleave", () => dropZone.classList.remove("drag-over"));
  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("drag-over");
    const file = e.dataTransfer?.files[0];
    if (file && file.name.toLowerCase().endsWith(".pdf")) selectFile(file);
    else { status.textContent = "Please drop a PDF file."; status.className = "upload-status error"; }
  });
  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (file) selectFile(file);
  });

  uploadBtn.addEventListener("click", async () => {
    if (!selectedFile) return;
    uploadBtn.disabled = true;
    progress.style.display = "block";
    status.textContent = "Uploading and processing...";
    status.className = "upload-status";

    try {
      const eventResp = await sendUploadEvent(selectedFile);
      status.textContent = "Extracting, embedding, and storing chunks...";
      const timeout = await getPollTimeoutMs();
      const result = await pollForRunOutput(eventResp.eventId, timeout, 1500);
      const inserted = (result as { ingested?: number }).ingested ?? 0;
      progress.style.display = "none";
      status.textContent = `Done! ${inserted} chunks ingested from ${selectedFile.name}`;
      status.className = "upload-status success";
    } catch (error) {
      progress.style.display = "none";
      status.textContent = error instanceof Error ? error.message : "Unknown error";
      status.className = "upload-status error";
    } finally {
      uploadBtn.disabled = false;
    }
  });
}

// ── Chat page ────────────────────────────────────────────────────────────────

function renderChatRoute(root: HTMLElement) {
  renderShell(root, "/chat", `
    <div class="chat-page">
      <div class="messages" id="messages">
        ${chatHistory.length === 0
          ? `<div class="empty-state">
               <div class="icon">&#128172;</div>
               <div class="text">Upload a PDF, then ask questions about it</div>
             </div>`
          : ""}
      </div>
      <div class="input-bar">
        <input type="text" id="question" placeholder="Ask a question about your documents..." ${isBusy ? "disabled" : ""} />
        <button class="send-btn" id="send-btn" ${isBusy ? "disabled" : ""}>Send</button>
        <button class="clear-btn" id="clear-btn" title="Clear conversation">Clear</button>
      </div>
    </div>
  `);

  const messagesEl = document.getElementById("messages")!;
  const input = document.getElementById("question") as HTMLInputElement;
  const sendBtn = document.getElementById("send-btn") as HTMLButtonElement;
  const clearBtn = document.getElementById("clear-btn") as HTMLButtonElement;

  renderMessages(messagesEl);
  scrollToBottom(messagesEl);
  if (!isBusy) input.focus();

  async function handleSend() {
    const question = input.value.trim();
    if (!question || isBusy) return;

    isBusy = true;
    input.disabled = true;
    sendBtn.disabled = true;
    input.value = "";

    chatHistory.push({ role: "user", content: question });
    renderMessages(messagesEl);
    addTypingIndicator(messagesEl);
    scrollToBottom(messagesEl);

    try {
      const apiHistory = chatHistory
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ role: m.role, content: m.content }));

      const eventResp = await sendQueryEvent(question, apiHistory, 4);
      const timeout = await getPollTimeoutMs();
      const result = await pollForRunOutput(eventResp.eventId, timeout, 1500);
      const answer = (result as { answer?: string }).answer ?? "(No answer received)";
      const sources = (result as { sources?: string[] }).sources ?? [];

      chatHistory.push({ role: "assistant", content: answer, sources });
    } catch (error) {
      chatHistory.push({
        role: "assistant",
        content: `Error: ${error instanceof Error ? error.message : "Something went wrong"}`
      });
    } finally {
      isBusy = false;
    }

    renderMessages(messagesEl);
    scrollToBottom(messagesEl);
    input.disabled = false;
    sendBtn.disabled = false;
    input.focus();
  }

  sendBtn.addEventListener("click", handleSend);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });

  clearBtn.addEventListener("click", () => {
    chatHistory.length = 0;
    renderMessages(messagesEl);
    input.focus();
  });
}

function renderMessages(container: HTMLElement) {
  if (chatHistory.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="icon">&#128172;</div>
        <div class="text">Upload a PDF, then ask questions about it</div>
      </div>
    `;
    return;
  }

  container.innerHTML = chatHistory
    .map((msg) => {
      const sourcesHtml =
        msg.sources && msg.sources.length > 0
          ? `<div class="sources">Sources: ${msg.sources.join(", ")}</div>`
          : "";
      return `<div class="msg ${msg.role}">${escapeHtml(msg.content)}${sourcesHtml}</div>`;
    })
    .join("");
}

function addTypingIndicator(container: HTMLElement) {
  const el = document.createElement("div");
  el.className = "msg typing";
  el.id = "typing-indicator";
  el.innerHTML = `Thinking <span class="dots"><span>.</span><span>.</span><span>.</span></span>`;
  container.appendChild(el);
}

function scrollToBottom(el: HTMLElement) {
  requestAnimationFrame(() => {
    el.scrollTop = el.scrollHeight;
  });
}

function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// ── Router ───────────────────────────────────────────────────────────────────

export function renderApp(root: HTMLElement) {
  injectStyles();

  const render = () => {
    const path = currentPath();
    if (window.location.pathname !== path) navigateTo(path);
    if (path === "/chat") renderChatRoute(root);
    else renderUploadRoute(root);
  };

  window.addEventListener("popstate", render);
  render();
}

if (window.location.pathname === "/") navigateTo("/upload");

const root = document.getElementById("app");
if (root) renderApp(root);
