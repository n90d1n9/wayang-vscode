import { ChatMessage } from "../../types/chatTypes";
import { Memories } from "./memories";
import { WelcomeMessage } from "./welcomeMessage";


export class Messages {
  render(state: any): string {
        const messages = state.messages || [];
        const memories = state.memories || [];
        
        if (messages.length === 0 && memories.length === 0) {
            return `<div class="chat-messages" id="chatMessages"></div>`;
        }

        return `
            <div class="chat-messages" id="chatMessages">
                ${memories.length > 0 ? new Memories().render(memories) : ''}
                ${messages.map((msg: ChatMessage) => this.renderMessage(msg)).join('')}
            </div>
        `;
    }

  private renderMessage(message: ChatMessage): string {
    const timestamp = typeof message.timestamp === 'string' 
      ? new Date(message.timestamp) 
      : message.timestamp;

    return `
      <div class="message ${message.type} ${message.loading ? 'loading' : ''} ${message.error ? 'error' : ''} ${message.pinned ? 'pinned' : ''} ${message.edited ? 'edited' : ''}" id="message-${message.id}">
          <div class="message-header">
              <span>${this.getMessageIcon(message.type)} ${this.getMessageRole(message.type)}${message.mode ? ` (${message.mode})` : ''}</span>
              <div class="message-actions">
                  ${this.getMessageActions(message)}
              </div>
          </div>
          <div class="message-content">
              ${this.getMessageContent(message)}
          </div>
      </div>`;
  }

  private getMessageIcon(type: string): string {
    return type === 'user' ? '👤' : '🤖';
  }

  private getMessageRole(type: string): string {
    return type === 'user' ? 'You' : 'Wayang Code';
  }

  private getMessageActions(message: ChatMessage): string {
    if (message.loading) {return '';};
    
    if (message.type === 'assistant') {
      return `
        <button class="message-action" onclick="regenerateResponse('${message.id}')" title="Regenerate">🔄</button>
        <button class="message-action" onclick="copyMessage('${message.id}')" title="Copy">📋</button>
        <button class="message-action" onclick="pinMessage('${message.id}')" title="Pin">${message.pinned ? '📌' : '📍'}</button>
        <button class="message-action" onclick="addToMemory('${message.id}')" title="Remember">🧠</button>
      `;
    } else {
      return `
        <button class="message-action" onclick="editMessage('${message.id}')" title="Edit">✏️</button>
        <button class="message-action" onclick="copyMessage('${message.id}')" title="Copy">📋</button>
        <button class="message-action" onclick="pinMessage('${message.id}')" title="Pin">${message.pinned ? '📌' : '📍'}</button>
        <button class="message-action" onclick="retryMessage('${message.id}')" title="Retry">🔄</button>
      `;
    }
  }

  private getMessageContent(message: ChatMessage): string {
    let content = this.formatMessageContent(message.content);
    
    if (message.confidence) {
      content = this.addConfidenceIndicator(message.confidence) + content;
    }
    
    if (message.codeSuggestions?.length) {
      content += message.codeSuggestions.map(suggestion => 
        this.renderCodeSuggestion(suggestion)
      ).join('');
    }
    
    content += this.renderTimestamp(message.timestamp);
    
    return content;
  }

  private formatMessageContent(content: string): string {
    // Simple formatting for server-side rendering
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/```(\w+)?\n([\s\S]*?)\n```/g, (match, lang, code) => {
        return `<pre data-language="${lang || 'code'}"><code>${this.escapeHtml(code)}</code></pre>`;
      })
      .replace(/\`([^`]+)\`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>');
  }

  private addConfidenceIndicator(confidence: number): string {
    const confidenceIcon = confidence > 0.8 ? '🟢' : confidence > 0.6 ? '🟡' : '🔴';
    const confidenceText = confidence > 0.8 ? 'High' : confidence > 0.6 ? 'Medium' : 'Low';
    
    return `
      <div class="confidence-indicator">
          ${confidenceIcon} ${confidenceText} Confidence (${Math.round(confidence * 100)}%)
      </div>`;
  }

  private renderCodeSuggestion(suggestion: any): string {
    return `
      <div class="code-suggestion fade-in">
          <div class="code-suggestion-header">
              <span>💡 ${suggestion.title || suggestion.file || 'Code Suggestion'}</span>
              <div>
                  <button class="apply-code-btn" onclick="applyCodeSuggestion('${this.escapeHtml(suggestion.code)}', '${suggestion.file || ''}')">
                      Apply
                  </button>
                  <button class="message-action" onclick="previewCode('${this.escapeHtml(suggestion.code)}', '${suggestion.file || ''}')">
                      Preview
                  </button>
              </div>
          </div>
          <div class="code-suggestion-content">
              <pre data-language="${suggestion.language || 'code'}"><code>${this.escapeHtml(suggestion.code)}</code></pre>
              ${suggestion.explanation ? `<em>${suggestion.explanation}</em>` : ''}
          </div>
      </div>`;
  }

  private renderTimestamp(timestamp: Date | string): string {
    const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
    return `
      <div style="font-size: 0.75em; opacity: 0.6; margin-top: 8px; text-align: right;">
          ${date.toLocaleString()}
      </div>`;
  }

  private escapeHtml(text: string): string {
    // Server-side HTML escaping
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}