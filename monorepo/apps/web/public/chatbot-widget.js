(function () {
  if (window.__chatbotWidgetLoaded) {
    return;
  }
  window.__chatbotWidgetLoaded = true;

  var scriptEl = document.currentScript;
  var botId = scriptEl ? scriptEl.getAttribute("data-bot-id") : null;

  // Derive API base URL from the script src so it works on external sites
  var apiBase = "";
  if (scriptEl && scriptEl.src) {
    try {
      var srcUrl = new URL(scriptEl.src);
      apiBase = srcUrl.origin;
    } catch (_) {}
  }

  // Default color — will be replaced after config fetch
  var PRIMARY = "#0f766e";

  // ── Color helpers ──────────────────────────────────────────────
  function adjustColor(hex, amount) {
    var num = parseInt(hex.replace("#", ""), 16);
    var r = Math.min(255, Math.max(0, ((num >> 16) & 0xff) + amount));
    var g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amount));
    var b = Math.min(255, Math.max(0, (num & 0xff) + amount));
    return "#" + ((r << 16) | (g << 8) | b).toString(16).padStart(6, "0");
  }

  function hexToRgba(hex, alpha) {
    var num = parseInt(hex.replace("#", ""), 16);
    var r = (num >> 16) & 0xff;
    var g = (num >> 8) & 0xff;
    var b = num & 0xff;
    return "rgba(" + r + "," + g + "," + b + "," + alpha + ")";
  }

  // ── Build CSS (called with color) ─────────────────────────────
  function buildStyles(c) {
    var darker = adjustColor(c, -20);
    var lighter = adjustColor(c, 20);
    return (
      "" +
      ".cb-widget-launcher{position:fixed;right:20px;bottom:20px;z-index:2147483000;width:62px;height:62px;border:none;border-radius:999px;background:linear-gradient(135deg," + c + " 0%," + lighter + " 100%);color:#fff;font-size:23px;cursor:pointer;box-shadow:0 14px 36px " + hexToRgba(c, 0.35) + ";display:grid;place-items:center;transition:transform .2s ease, box-shadow .2s ease;}" +
      ".cb-widget-launcher:hover{transform:translateY(-2px) scale(1.02);box-shadow:0 18px 44px " + hexToRgba(c, 0.38) + ";}" +
      ".cb-widget-panel{position:fixed;right:20px;bottom:94px;z-index:2147483000;width:390px;max-width:calc(100vw - 20px);height:560px;background:#fff;border:1px solid #d7e0e0;border-radius:20px;box-shadow:0 24px 70px rgba(0,0,0,.22);overflow:hidden;display:none;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;}" +
      ".cb-widget-panel.cb-open{display:flex;flex-direction:column;animation:cbFadeUp .24s ease;}" +
      "@keyframes cbFadeUp{from{opacity:0;transform:translateY(8px) scale(.98);}to{opacity:1;transform:translateY(0) scale(1);}}" +
      ".cb-widget-header{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;background:linear-gradient(130deg," + c + " 0%," + darker + " 45%," + adjustColor(c, -30) + " 100%);color:#fff;}" +
      ".cb-widget-brand{display:flex;align-items:center;gap:10px;}" +
      ".cb-widget-avatar{width:30px;height:30px;border-radius:999px;background:rgba(255,255,255,.2);display:grid;place-items:center;font-size:14px;font-weight:700;}" +
      ".cb-widget-title{font-size:14px;font-weight:700;line-height:1.2;}" +
      ".cb-widget-status{font-size:11px;opacity:.92;display:flex;align-items:center;gap:6px;margin-top:2px;}" +
      ".cb-widget-status-dot{width:7px;height:7px;border-radius:999px;background:#34d399;box-shadow:0 0 0 4px rgba(52,211,153,.2);}" +
      ".cb-widget-close{border:none;background:rgba(255,255,255,.16);color:#fff;width:30px;height:30px;border-radius:999px;cursor:pointer;font-size:16px;display:grid;place-items:center;}" +
      ".cb-widget-close:hover{background:rgba(255,255,255,.24);}" +
      ".cb-widget-body{flex:1;padding:16px 14px;background:radial-gradient(1200px 480px at -300px -100px,#f0fdfa 5%,#f8fafc 45%,#ffffff 100%);color:#334155;overflow:auto;}" +
      ".cb-widget-msg{max-width:86%;padding:10px 12px;border-radius:14px;font-size:13px;line-height:1.5;margin-bottom:10px;word-break:break-word;}" +
      ".cb-widget-msg.bot{background:#f1f5f9;color:#0f172a;border:1px solid #e2e8f0;}" +
      ".cb-widget-msg.user{margin-left:auto;background:linear-gradient(130deg," + c + " 0%," + lighter + " 100%);color:#fff;border:1px solid " + hexToRgba(c, 0.3) + ";}" +
      ".cb-widget-typing{display:none;max-width:72px;padding:8px 10px;border-radius:14px;background:#f1f5f9;border:1px solid #e2e8f0;margin-bottom:10px;}" +
      ".cb-widget-typing.cb-show{display:inline-flex;align-items:center;gap:4px;}" +
      ".cb-widget-dot{width:6px;height:6px;border-radius:999px;background:" + c + ";opacity:.35;animation:cbBlink 1.1s infinite;}" +
      ".cb-widget-dot:nth-child(2){animation-delay:.15s;}" +
      ".cb-widget-dot:nth-child(3){animation-delay:.3s;}" +
      "@keyframes cbBlink{0%,80%,100%{opacity:.25;}40%{opacity:1;}}" +
      ".cb-widget-input{display:flex;gap:8px;padding:10px;border-top:1px solid #e2e8f0;background:#fff;}" +
      ".cb-widget-input input{flex:1;border:1px solid #cbd5e1;border-radius:12px;padding:10px 12px;font-size:13px;outline:none;transition:border-color .15s ease, box-shadow .15s ease;}" +
      ".cb-widget-input input:focus{border-color:" + c + ";box-shadow:0 0 0 3px " + hexToRgba(c, 0.15) + ";}" +
      ".cb-widget-input button{border:none;border-radius:12px;background:" + c + ";color:#fff;padding:0 14px;font-size:13px;font-weight:700;cursor:pointer;transition:background .2s ease;}" +
      ".cb-widget-input button:hover{background:" + darker + ";}" +
      ".cb-widget-note{padding:0 12px 10px;color:#64748b;font-size:11px;text-align:center;background:#fff;}" +
      "@media (max-width:640px){.cb-widget-panel{right:10px;left:10px;bottom:84px;width:auto;max-width:none;height:68vh;border-radius:18px;}.cb-widget-launcher{right:12px;bottom:12px;}}"
    );
  }

  // ── Style element (injected after config loads) ────────────────
  var style = document.createElement("style");

  // ── Build DOM ─────────────────────────────────────────────────
  var launcher = document.createElement("button");
  launcher.className = "cb-widget-launcher";
  launcher.type = "button";
  launcher.setAttribute("aria-label", "Open chatbot");
  launcher.textContent = "\uD83D\uDCAC";

  var panel = document.createElement("section");
  panel.className = "cb-widget-panel";

  var header = document.createElement("div");
  header.className = "cb-widget-header";

  var brand = document.createElement("div");
  brand.className = "cb-widget-brand";

  var avatar = document.createElement("div");
  avatar.className = "cb-widget-avatar";
  avatar.textContent = "AI";

  var titleWrap = document.createElement("div");
  var title = document.createElement("div");
  title.className = "cb-widget-title";
  title.textContent = botId ? "Support Assistant" : "AI Assistant";

  var status = document.createElement("div");
  status.className = "cb-widget-status";
  status.innerHTML = '<span class="cb-widget-status-dot"></span>Online';

  titleWrap.appendChild(title);
  titleWrap.appendChild(status);
  brand.appendChild(avatar);
  brand.appendChild(titleWrap);

  var closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "cb-widget-close";
  closeButton.setAttribute("aria-label", "Close chatbot");
  closeButton.textContent = "\u00d7";

  header.appendChild(brand);
  header.appendChild(closeButton);

  var body = document.createElement("div");
  body.className = "cb-widget-body";

  var welcome = document.createElement("div");
  welcome.className = "cb-widget-msg bot";
  welcome.textContent = "Hey there! How can I help you today?";
  body.appendChild(welcome);

  var typing = document.createElement("div");
  typing.className = "cb-widget-typing";
  typing.innerHTML =
    '<span class="cb-widget-dot"></span><span class="cb-widget-dot"></span><span class="cb-widget-dot"></span>';
  body.appendChild(typing);

  var form = document.createElement("form");
  form.className = "cb-widget-input";

  var input = document.createElement("input");
  input.type = "text";
  input.placeholder = "Type message...";
  input.required = true;

  var sendButton = document.createElement("button");
  sendButton.type = "submit";
  sendButton.textContent = "Send";

  form.appendChild(input);
  form.appendChild(sendButton);

  form.addEventListener("submit", function (event) {
    event.preventDefault();

    var value = input.value.trim();
    if (!value) {
      return;
    }

    var userMsg = document.createElement("div");
    userMsg.className = "cb-widget-msg user";
    userMsg.textContent = value;
    body.appendChild(userMsg);

    input.value = "";
    input.disabled = true;
    sendButton.disabled = true;
    typing.classList.add("cb-show");
    body.scrollTop = body.scrollHeight;

    fetch(apiBase + "/api/chatbot/widget/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ botId: botId, message: value }),
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        typing.classList.remove("cb-show");
        var botMsg = document.createElement("div");
        botMsg.className = "cb-widget-msg bot";
        botMsg.textContent = data.reply || data.error || "Something went wrong.";
        body.appendChild(botMsg);
        body.scrollTop = body.scrollHeight;
      })
      .catch(function () {
        typing.classList.remove("cb-show");
        var errMsg = document.createElement("div");
        errMsg.className = "cb-widget-msg bot";
        errMsg.textContent = "Sorry, could not reach the server. Please try again.";
        body.appendChild(errMsg);
        body.scrollTop = body.scrollHeight;
      })
      .finally(function () {
        input.disabled = false;
        sendButton.disabled = false;
        input.focus();
      });
  });

  panel.appendChild(header);
  panel.appendChild(body);
  panel.appendChild(form);

  var note = document.createElement("div");
  note.className = "cb-widget-note";
  note.textContent = "Powered by AI";
  panel.appendChild(note);

  launcher.addEventListener("click", function () {
    if (panel.classList.contains("cb-open")) {
      panel.classList.remove("cb-open");
      return;
    }

    panel.classList.add("cb-open");
    input.focus();
  });

  closeButton.addEventListener("click", function () {
    panel.classList.remove("cb-open");
  });

  // ── Show widget: inject styles + append to DOM ─────────────────
  function showWidget(color) {
    style.textContent = buildStyles(color);
    document.head.appendChild(style);
    document.body.appendChild(launcher);
    document.body.appendChild(panel);
  }

  // ── Fetch config first, then show with correct color (no flicker)
  if (botId) {
    fetch(apiBase + "/api/chatbot/widget/config/" + encodeURIComponent(botId))
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (data) {
        if (data && data.primaryColor && /^#[0-9a-fA-F]{6}$/.test(data.primaryColor)) {
          PRIMARY = data.primaryColor;
        }
        showWidget(PRIMARY);
      })
      .catch(function () {
        showWidget(PRIMARY);
      });
  } else {
    showWidget(PRIMARY);
  }
})();
