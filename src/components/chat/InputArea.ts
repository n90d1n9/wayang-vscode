export class InputArea {
  render(state: any): string {
    return `
      <div class="input-container">
          <div class="input-header">
              <span class="input-mode" id="currentMode">${this.getModeIndicator(state.mode)}</span>
              <div class="input-actions">
                  <button class="message-action" onclick="addCodeSnippet()" title="Add Code Snippet">📝</button>
                  <button class="message-action" onclick="toggleStreaming()" title="Toggle Streaming" id="streamToggle">🌊</button>
                  <button class="message-action" onclick="showHelp()" title="Help & Tips">❓</button>
              </div>
          </div>
          
          <textarea 
              id="messageInput" 
              class="message-input" 
              placeholder="${this.getPlaceholder(state.mode)}"
              rows="1"
          ></textarea>
          
          <div class="input-bottom">
              <div class="input-features">
                  <label class="feature-toggle">
                      <input type="checkbox" class="feature-checkbox" id="includeContext" ${state.includeContext ? 'checked' : ''}>
                      Include project context
                  </label>
                  <label class="feature-toggle">
                      <input type="checkbox" class="feature-checkbox" id="autoApply" ${state.autoApply ? 'checked' : ''}>
                      Auto-apply changes
                  </label>
                  <label class="feature-toggle">
                      <input type="checkbox" class="feature-checkbox" id="streamingMode" ${state.streamingMode ? 'checked' : ''}>
                      Streaming mode
                  </label>
              </div>
              <button id="sendButton" class="send-button" onclick="sendMessage()">
                  <span id="sendButtonText">Send</span>
              </button>
          </div>
      </div>`;
  }

  private getModeIndicator(mode: string = 'chat'): string {
    const modeConfig = {
      chat: '💬 Chat Mode',
      code: '💻 Code Mode',
      review: '🔍 Review Mode',
      test: '🧪 Test Mode'
    };
    
    return modeConfig[mode as keyof typeof modeConfig] || modeConfig.chat;
  }

  private getPlaceholder(mode: string = 'chat'): string {
    const placeholderConfig = {
      chat: 'Ask me anything about your code...',
      code: 'Describe the code you want to generate or analyze...',
      review: 'Ask me to review your code for issues...',
      test: 'Request test generation or test analysis...'
    };
    
    return placeholderConfig[mode as keyof typeof placeholderConfig] || placeholderConfig.chat;
  }
}