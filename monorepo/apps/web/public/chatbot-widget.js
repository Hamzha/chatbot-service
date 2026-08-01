(function () {
  if (window.__chatbotWidgetLoaded) {
    return;
  }

  var scriptEl = document.currentScript;
  if (!scriptEl) {
    var scripts = document.querySelectorAll("script[data-bot-id]");
    scriptEl = scripts[scripts.length - 1] || null;
  }
  var botId = scriptEl ? scriptEl.getAttribute("data-bot-id") : null;

  if (!botId) {
    return;
  }

  // Derive the app origin from the script src so the iframe always points at our domain.
  var appOrigin = "";
  if (scriptEl && scriptEl.src) {
    try {
      var srcUrl = new URL(scriptEl.src);
      appOrigin = srcUrl.origin;
    } catch (_) {}
  }

  if (!appOrigin) {
    return;
  }

  window.__chatbotWidgetLoaded = true;

  var widgetUrl = appOrigin + "/widget/" + encodeURIComponent(botId);

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
      ".cb-widget-launcher{position:fixed;right:20px;bottom:20px;z-index:2147483000;width:62px;height:62px;border:none;border-radius:999px;background:linear-gradient(135deg," +
      c +
      " 0%," +
      lighter +
      " 100%);color:#fff;font-size:23px;cursor:pointer;box-shadow:0 14px 36px " +
      hexToRgba(c, 0.35) +
      ";display:grid;place-items:center;transition:transform .2s ease, box-shadow .2s ease;}" +
      ".cb-widget-launcher:hover{transform:translateY(-2px) scale(1.02);box-shadow:0 18px 44px " +
      hexToRgba(c, 0.38) +
      ";}" +
      ".cb-widget-panel{position:fixed;right:20px;bottom:94px;z-index:2147483000;width:390px;max-width:calc(100vw - 20px);height:560px;background:#fff;border:1px solid #d7e0e0;border-radius:20px;box-shadow:0 24px 70px rgba(0,0,0,.22);overflow:hidden;display:none;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;}" +
      ".cb-widget-panel.cb-open{display:flex;flex-direction:column;animation:cbFadeUp .24s ease;}" +
      "@keyframes cbFadeUp{from{opacity:0;transform:translateY(8px) scale(.98);}to{opacity:1;transform:translateY(0) scale(1);}}" +
      ".cb-widget-header{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;background:linear-gradient(130deg," +
      c +
      " 0%," +
      darker +
      " 45%," +
      adjustColor(c, -30) +
      " 100%);color:#fff;}" +
      ".cb-widget-brand{display:flex;align-items:center;gap:10px;}" +
      ".cb-widget-avatar{width:30px;height:30px;border-radius:999px;background:rgba(255,255,255,.2);display:grid;place-items:center;font-size:14px;font-weight:700;}" +
      ".cb-widget-title{font-size:14px;font-weight:700;line-height:1.2;}" +
      ".cb-widget-status{font-size:11px;opacity:.92;display:flex;align-items:center;gap:6px;margin-top:2px;}" +
      ".cb-widget-status-dot{width:7px;height:7px;border-radius:999px;background:#34d399;box-shadow:0 0 0 4px rgba(52,211,153,.2);}" +
      ".cb-widget-close{border:none;background:rgba(255,255,255,.16);color:#fff;width:30px;height:30px;border-radius:999px;cursor:pointer;font-size:16px;display:grid;place-items:center;}" +
      ".cb-widget-close:hover{background:rgba(255,255,255,.24);}" +
      ".cb-widget-frame{flex:1;width:100%;border:0;background:#fff;}" +
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

  var frame = document.createElement("iframe");
  frame.className = "cb-widget-frame";
  frame.title = "Chatbot widget";
  frame.setAttribute("loading", "lazy");
  frame.src = widgetUrl;

  panel.appendChild(header);
  panel.appendChild(frame);

  launcher.addEventListener("click", function () {
    if (panel.classList.contains("cb-open")) {
      panel.classList.remove("cb-open");
      return;
    }

    panel.classList.add("cb-open");
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

  showWidget(PRIMARY);
})();
