const vscode = acquireVsCodeApi();
document.addEventListener("DOMContentLoaded", () => {
  const app = document.getElementById("app");
  if (!app) return;

  app.innerHTML = `
    <div style="padding: 16px; font-family: sans-serif;">
      <div id="chatContainer" style="
        border: 1px solid #ddd;
        border-radius: 8px;
        padding: 12px;
        height: 300px;
        overflow-y: auto;
        margin-bottom: 12px;">
        <p><b>Wayang Agent</b> ready 👋</p>
      </div>
      <div style="display: flex; gap: 8px;">
        <input id="chatInput" type="text" placeholder="Ask Wayang…" style="
          flex: 1;
          padding: 8px;
          border: 1px solid #ccc;
          border-radius: 4px;">
        <button id="sendBtn" style="
          padding: 8px 12px;
          background: #007acc;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;">
          Send
        </button>
      </div>
    </div>
  `;

  const chatContainer = document.getElementById("chatContainer");
  const input = document.getElementById("chatInput");
  const sendBtn = document.getElementById("sendBtn");

  function addMessage(sender, text) {
    const msg = document.createElement("p");
    msg.innerHTML = `<b>${sender}:</b> ${text}`;
    chatContainer.appendChild(msg);
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }

  sendBtn.addEventListener("click", () => {
    const text = input.value.trim();
    if (!text) return;
    addMessage("You", text);
    vscode.postMessage({ type: "userMessage", text });
    input.value = "";
  });

  // ✅ Listen for messages from extension
  window.addEventListener("message", (event) => {
    const message = event.data;
    if (message.type === "agentResponse") {
      addMessage("Wayang", message.text);
    }
  });
});


window.addEventListener("message", (event) => {
    const msg = event.data;
    switch (msg.type) {
        case "updateChatHTML":
            document.body.innerHTML = msg.html;
            break;
    }
});

// Listen to messages from extension
window.addEventListener("message", (event) => {
    const msg = event.data;

    switch (msg.type) {
        case "updateChatHTML":
            document.body.innerHTML = msg.html;
            scrollToBottom();
            break;

        case "updateState": // optional if you use state updates
            // Update specific sections if needed
            break;
    }
});

// Scroll chat container to the last message
function scrollToBottom() {
    const container = document.getElementById("chatMessages");
    if (container) {
        container.scrollTo({
            top: container.scrollHeight,
            behavior: "smooth"
        });
    }
}
