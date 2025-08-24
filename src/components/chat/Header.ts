export class Header {
  render(state: any): string {
        return `
            <div class="header">
                <div class="session-info">
                    <div class="session-name">${state.sessionName || 'Default Session'}</div>
                    <div class="session-status">
                        💬 ${state.messageCount || 0} messages
                        ${state.isStreaming ? '<span class="streaming-indicator">🌊</span>' : ''}
                    </div>
                </div>
                <div class="mode-selector">
                    <button class="mode-btn ${state.mode === 'chat' ? 'active' : ''}" data-mode="chat" title="Chat">💬</button>
                    <button class="mode-btn ${state.mode === 'code' ? 'active' : ''}" data-mode="code" title="Code">💻</button>
                    <button class="mode-btn ${state.mode === 'review' ? 'active' : ''}" data-mode="review" title="Review">🔍</button>
                    <button class="mode-btn ${state.mode === 'test' ? 'active' : ''}" data-mode="test" title="Test">🧪</button>
                </div>
            </div>
        `;
    }
}