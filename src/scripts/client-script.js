// src/scripts/client-script.js
(function () {
  const vscode = acquireVsCodeApi();

  // ----- DOM refs
  const chatMessages = () => document.getElementById("chatMessages");
  const msgInput = () => document.getElementById("messageInput");
  const sendBtn = () => document.getElementById("sendButton");

  // ----- events
  document.addEventListener("click", (e) => {
    const t = e.target;
    if (!t) return;

    if (t.id === "sendButton") {
      sendMessage();
    }
    if (t.id === "contextToggleBtn") {
      toggleContext();
    }
  });

  document.addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.keyCode === 13) && !e.shiftKey && document.activeElement === msgInput()) {
      e.preventDefault();
      sendMessage();
    }
  });

  function sendMessage() {
    const input = msgInput();
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;

    vscode.postMessage({
      type: "sendMessage",
      text,
      mode: "chat"
    });

    input.value = "";
  }

  function toggleContext() {
    const info = document.getElementById("contextInfo");
    const toggle = document.getElementById("contextToggle");
    if (!info || !toggle) return;
    const hidden = info.style.display === "none";
    info.style.display = hidden ? "" : "none";
    toggle.textContent = hidden ? "📋 Hide" : "📋 Show";
  }

  // ----- message handlers (extension -> webview)
  window.addEventListener("message", (event) => {
    const msg = event.data;
    if (!msg || !msg.type) return;

    switch (msg.type) {
      case "updateChat":
        renderMessages(msg.messages || []);
        break;
      case "updateSessions":
        // Optionally render session list if your SessionsPanel uses DOM updates
        break;
      case "updateState":
        // Merge state if needed
        break;
      case "projectContextUpdated":
        // Update context UI if you expose more fields
        break;
    }
  });

  function renderMessages(messages) {
    const container = chatMessages();
    if (!container) return;
    container.innerHTML = "";

    if (!messages.length) {
      const welcome = document.createElement("div");
      welcome.className = "welcome-message";
      welcome.innerHTML = `
        <h3>🎭 Welcome to Wayang Code!</h3>
        <p>Your intelligent coding companion</p>
      `;
      container.appendChild(welcome);
      return;
    }

    for (const m of messages) {
      const div = document.createElement("div");
      div.className = `message ${m.type || "assistant"} ${m.loading ? "loading" : ""} ${m.error ? "error" : ""}`;

      const header = document.createElement("div");
      header.className = "message-header";
      header.textContent = m.type === "user" ? "👤 You" : "🤖 Wayang Code";

      const body = document.createElement("div");
      body.className = "message-content";
      body.innerHTML = formatContent(m.content || "");

      div.appendChild(header);
      div.appendChild(body);
      container.appendChild(div);
    }

    container.scrollTop = container.scrollHeight;
  }

  function formatContent(content) {
    return content
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      .replace(/```([\s\S]*?)```/g, "<pre><code>$1</code></pre>")
      .replace(/`(.*?)`/g, "<code>$1</code>")
      .replace(/\n/g, "<br>");
  }
})();
