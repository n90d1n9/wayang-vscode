export class Header {
  render(state: any): string {
    return `
      <div class="header">
          <div class="session-info">
              <div class="session-name" id="sessionName">${state.sessionName || 'Default Session'}</div>
              <div class="session-status" id="sessionStatus">
                  💬 <span id="messageCount">${state.messageCount || 0}</span> messages
                  <span id="streamingIndicator"></span>
              </div>
          </div>
          <div class="mode-selector">
              <button class="mode-btn ${state.mode === 'chat' ? 'active' : ''}" data-mode="chat">💬 Chat</button>
              <button class="mode-btn ${state.mode === 'code' ? 'active' : ''}" data-mode="code">💻 Code</button>
              <button class="mode-btn ${state.mode === 'review' ? 'active' : ''}" data-mode="review">🔍 Review</button>
              <button class="mode-btn ${state.mode === 'test' ? 'active' : ''}" data-mode="test">🧪 Test</button>
          </div>
      </div>`;
  }
}