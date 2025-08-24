// components/chat_panel.ts
import * as vscode from 'vscode';
import { Header } from './header';

import { Messages } from './messages';
import { InputArea } from './inputArea';
import { StatusBar } from './statusBar';
import { Toolbar } from './toolbar';
import { SessionsPanel } from './sessionPanel';

export class ChatPanel {
    private webview: vscode.Webview;
    private extensionUri: vscode.Uri;
    private state: any;

    constructor(webview: vscode.Webview, extensionUri: vscode.Uri, initialState: any = {}) {
        this.webview = webview;
        this.extensionUri = extensionUri;
        this.state = { 
            mode: 'chat',
            messages: [],
            sessions: [],
            ...initialState 
        };
    }

    public render(): string {
        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Wayang Code Chat</title>
                <style>
                    ${this.getStyles()}
                </style>
            </head>
            <body>
                <div class="chat-container">
                    ${new Header().render(this.state)}
                    
                    <div class="main-content">
                        <div class="sidebar">
                            ${new SessionsPanel().render(this.state)}
                            ${this.getProjectContext()}
                        </div>
                        
                        <div class="chat-area">
                            <div class="chat-messages" id="chatMessages">
                                ${new Messages().render(this.state)}
                            </div>
                            ${new InputArea().render(this.state)}
                        </div>
                    </div>
                    
                    ${new StatusBar().render(this.state)}
                </div>
                
                <script>
                    ${this.getClientScript()}
                </script>
            </body>
            </html>`;
    }

    private getStyles(): string {
        return `
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { 
                font-family: var(--vscode-font-family);
                font-size: var(--vscode-font-size);
                color: var(--vscode-foreground);
                background: var(--vscode-editor-background);
                height: 100vh;
                overflow: hidden;
            }
            
            .chat-container {
                display: flex;
                flex-direction: column;
                height: 100vh;
            }
            
            .main-content {
                display: flex;
                flex: 1;
                overflow: hidden;
            }
            
            .sidebar {
                width: 250px;
                background: var(--vscode-sideBar-background);
                border-right: 1px solid var(--vscode-sideBar-border);
                overflow-y: auto;
            }
            
            .chat-area {
                flex: 1;
                display: flex;
                flex-direction: column;
                min-width: 0;
            }
            
            .chat-messages {
                flex: 1;
                overflow-y: auto;
                padding: 16px;
            }
            
            .header {
                background: var(--vscode-titleBar-activeBackground);
                padding: 12px 16px;
                border-bottom: 1px solid var(--vscode-titleBar-border);
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .session-info {
                display: flex;
                flex-direction: column;
                gap: 4px;
            }
            
            .session-name {
                font-weight: 600;
                color: var(--vscode-titleBar-activeForeground);
            }
            
            .session-status {
                font-size: 0.85em;
                opacity: 0.8;
                color: var(--vscode-titleBar-activeForeground);
            }
            
            .mode-selector {
                display: flex;
                background: var(--vscode-button-secondaryBackground);
                padding: 4px;
                border-radius: 6px;
                gap: 2px;
            }
            
            .mode-btn {
                padding: 6px 12px;
                border: none;
                border-radius: 4px;
                background: transparent;
                color: var(--vscode-button-secondaryForeground);
                cursor: pointer;
                font-size: 0.9em;
            }
            
            .mode-btn.active {
                background: var(--vscode-button-background);
                color: var(--vscode-button-foreground);
            }
            
            .project-context {
                background: var(--vscode-badge-background);
                color: var(--vscode-badge-foreground);
                padding: 10px 12px;
                font-size: 0.8em;
                border-bottom: 1px solid var(--vscode-widget-border);
            }
            
            .input-container {
                padding: 16px;
                background: var(--vscode-input-background);
                border-top: 1px solid var(--vscode-input-border);
            }
            
            .message-input {
                width: 100%;
                padding: 12px;
                border: 1px solid var(--vscode-input-border);
                border-radius: 6px;
                background: var(--vscode-input-background);
                color: var(--vscode-input-foreground);
                font-family: inherit;
                resize: none;
                min-height: 40px;
                margin-bottom: 8px;
            }
            
            .input-bottom {
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .send-button {
                padding: 8px 16px;
                background: var(--vscode-button-background);
                color: var(--vscode-button-foreground);
                border: none;
                border-radius: 4px;
                cursor: pointer;
            }
            
            .status-bar {
                background: var(--vscode-statusBar-background);
                color: var(--vscode-statusBar-foreground);
                padding: 6px 12px;
                font-size: 0.8em;
                border-top: 1px solid var(--vscode-statusBar-border);
                display: flex;
                justify-content: space-between;
            }
            
            .message {
                margin-bottom: 16px;
                padding: 12px;
                border-radius: 8px;
                background: var(--vscode-input-background);
                border: 1px solid var(--vscode-input-border);
            }
            
            .message.user {
                background: var(--vscode-inputOption-activeBackground);
                margin-left: 20px;
            }
            
            .message.assistant {
                background: var(--vscode-editor-selectionBackground);
                margin-right: 20px;
            }
            
            .message-header {
                font-weight: 600;
                margin-bottom: 8px;
                font-size: 0.9em;
                opacity: 0.8;
            }
            
            .welcome-message {
                text-align: center;
                padding: 40px 20px;
                color: var(--vscode-descriptionForeground);
            }
            
            @media (max-width: 768px) {
                .main-content {
                    flex-direction: column;
                }
                
                .sidebar {
                    width: 100%;
                    max-height: 200px;
                }
            }
        `;
    }

    private getClientScript(): string {
        return `
            const vscode = acquireVsCodeApi();
            let isWaitingForResponse = false;
            let currentMode = 'chat';

            class ChatClient {
                constructor() {
                    this.initialize();
                }

                initialize() {
                    this.setupEventListeners();
                    this.updateSendButton();
                }

                setupEventListeners() {
                    // Message input
                    const messageInput = document.getElementById('messageInput');
                    if (messageInput) {
                        messageInput.addEventListener('keydown', (e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                this.sendMessage();
                            }
                        });
                        
                        messageInput.addEventListener('input', () => {
                            this.autoResizeTextarea(messageInput);
                        });
                    }

                    // Mode buttons
                    document.querySelectorAll('.mode-btn').forEach(btn => {
                        btn.addEventListener('click', () => {
                            const mode = btn.dataset.mode;
                            this.setMode(mode);
                        });
                    });

                    // Send button
                    const sendButton = document.getElementById('sendButton');
                    if (sendButton) {
                        sendButton.addEventListener('click', () => this.sendMessage());
                    }

                    // Handle messages from extension
                    window.addEventListener('message', (event) => {
                        const message = event.data;
                        switch (message.type) {
                            case 'updateChat':
                                this.updateChatMessages(message.messages);
                                break;
                            case 'showMemories':
                                this.showMemories(message.memories);
                                break;
                        }
                    });
                }

                sendMessage() {
                    const input = document.getElementById('messageInput');
                    const message = input.value.trim();

                    if (!message || isWaitingForResponse) return;

                    vscode.postMessage({
                        type: 'sendMessage',
                        text: message,
                        mode: currentMode
                    });

                    input.value = '';
                    input.style.height = 'auto';
                    isWaitingForResponse = true;
                    this.updateSendButton();
                }

                setMode(mode) {
                    currentMode = mode;
                    document.querySelectorAll('.mode-btn').forEach(btn => {
                        btn.classList.toggle('active', btn.dataset.mode === mode);
                    });
                }

                updateChatMessages(messages) {
                    const chatMessages = document.getElementById('chatMessages');
                    if (!chatMessages) return;

                    chatMessages.innerHTML = '';

                    if (messages.length === 0) {
                        chatMessages.innerHTML = '
                            <div class="welcome-message">
                                <h3>🎭 Welcome to Wayang Code!</h3>
                                <p>Your intelligent coding companion</p>
                            </div>
                        ';
                        return;
                    }

                    messages.forEach(msg => {
                        const messageDiv = document.createElement('div');
                        messageDiv.className = \`message \${msg.type}\`;
                        if (msg.loading) messageDiv.classList.add('loading');
                        
                        messageDiv.innerHTML = \`
                            <div class="message-header">
                                \${msg.type === 'user' ? '👤 You' : '🤖 Wayang Code'}
                                \${msg.loading ? '<span style="margin-left: 8px;">⚙️</span>' : ''}
                            </div>
                            <div class="message-content">\${this.formatMessage(msg.content)}</div>
                        \`;

                        chatMessages.appendChild(messageDiv);
                    });

                    chatMessages.scrollTop = chatMessages.scrollHeight;
                    isWaitingForResponse = messages.some(msg => msg.loading);
                    this.updateSendButton();
                }

                formatMessage(content) {
                    return content
                        .replace(/\\*\\*(.*?)\\*\\*/g, '<strong>$1</strong>')
                        .replace(/\\*(.*?)\\*/g, '<em>$1</em>')
                        .replace(/\\n/g, '<br>');
                }

                updateSendButton() {
                    const sendButton = document.getElementById('sendButton');
                    if (sendButton) {
                        sendButton.disabled = isWaitingForResponse;
                        sendButton.textContent = isWaitingForResponse ? 'Sending...' : 'Send';
                    }
                }

                autoResizeTextarea(textarea) {
                    textarea.style.height = 'auto';
                    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
                }

                showMemories(memories) {
                    console.log('Showing memories:', memories);
                    // Implement memories display if needed
                }
            }

            // Initialize when DOM is loaded
            document.addEventListener('DOMContentLoaded', () => {
                new ChatClient();
            });
        `;
    }

    private getProjectContext(): string {
        return `
            <div class="project-context">
                <span id="contextInfo">Loading project context...</span>
            </div>
        `;
    }

    public updateState(newState: any): void {
        this.state = { ...this.state, ...newState };
    }
}