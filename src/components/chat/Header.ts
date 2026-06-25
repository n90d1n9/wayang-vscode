export class Header {
    render(state: any): string {
        return `
            <div class="header">
                <div class="session-info">
                    <span class="session-name" id="sessionName">${state.sessionId || 'Default Session'}</span>
                    <span class="session-status" id="sessionStatus">❌ ${state.messageCount || 0} messages</span>
                </div>
                <div class="mode-selector">
                    <button class="mode-btn" data-mode="chat" data-action="setMode">💬 Chat</button>
                    <button class="mode-btn" data-mode="code" data-action="setMode">💻 Code</button>
                    <button class="mode-btn" data-mode="review" data-action="setMode">🔍 Review</button>
                    <button class="mode-btn" data-mode="test" data-action="setMode">🧪 Test</button>
                </div>
                <div class="header-actions">
                    <button class="header-btn" data-action="toggleSettings" title="Server Settings">
                        ⚙️ Settings
                    </button>
                    <button class="header-btn" data-action="toggleContext" title="Toggle Project Context">
                        📋 ${state.showContext ? 'Hide' : 'Show'} Context
                    </button>
                </div>
            </div>
        `;
    }
}