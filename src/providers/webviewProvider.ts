import * as vscode from "vscode";
import { AgentClient } from "../clients/agentClient";
import { isAxiosError } from "axios";

export class WayangWebviewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = "wayangChat";
    private _view?: vscode.WebviewView;
    private chatHistory: ChatMessage[] = [];

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly agentClient: AgentClient,
    ) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri],
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(
            (message) => {
                switch (message.type) {
                    case "sendMessage":
                        this.handleUserMessage(message.text);
                        break;
                    case "clearChat":
                        this.clearChat();
                        break;
                    case "exportChat":
                        this.exportChat();
                        break;
                }
            },
            undefined,
            [],
        );

        // Load chat history
        this.loadChatHistory();
    }

    private async handleUserMessage(message: string) {
        if (!this._view || !message.trim()) return;

        // Add user message to chat
        const userMessage: ChatMessage = {
            id: Date.now().toString(),
            type: "user",
            content: message,
            timestamp: new Date(),
        };

        this.chatHistory.push(userMessage);
        this.updateWebview();

        try {
            // Create agent request
            const taskId = await this.agentClient.sendQuery({
                id: userMessage.id,
                query: message,
                context: this.getEditorContext(),
            });

            // Add loading message
            const loadingMessage: ChatMessage = {
                id: `loading_${taskId}`,
                type: "assistant",
                content: "Thinking...",
                timestamp: new Date(),
                loading: true,
            };

            this.chatHistory.push(loadingMessage);
            this.updateWebview();

            // Listen for response
            this.agentClient.onTaskUpdate(taskId, (response) => {
                this.handleAgentResponse(loadingMessage.id, response);
            });
        } catch (error) {
            if (isAxiosError(error)) {
                const errorMessage: ChatMessage = {
                    id: `error_${Date.now()}`,
                    type: "assistant",
                    content: `I encountered an error: ${error.message}`,
                    timestamp: new Date(),
                    error: true,
                };

                this.chatHistory.push(errorMessage);
                this.updateWebview();
            }
        }
    }

    private handleAgentResponse(loadingMessageId: string, response: any) {
        const loadingIndex = this.chatHistory.findIndex((msg) =>
            msg.id === loadingMessageId
        );

        if (loadingIndex !== -1) {
            // Update the loading message with the response
            this.chatHistory[loadingIndex] = {
                ...this.chatHistory[loadingIndex],
                content: this.formatAgentResponse(response),
                loading: false,
                error: response.status === "error",
            };

            this.updateWebview();
        }
    }

    private formatAgentResponse(response: any): string {
        let content = response.message || "Task completed";

        if (response.data) {
            if (response.data.codeChanges) {
                content += "\n\n**Code Changes:**";
                response.data.codeChanges.forEach(
                    (change: any, index: number) => {
                        content += `\n${index + 1}. ${change.file}\n\`\`\`${
                            change.language || "text"
                        }\n${change.content}\n\`\`\``;
                    },
                );
            }

            if (response.data.analysis) {
                content += "\n\n**Analysis Results:**\n" +
                    response.data.analysis.summary;
            }

            if (response.data.explanation) {
                content += "\n\n**Explanation:**\n" +
                    response.data.explanation.summary;
            }
        }

        return content;
    }

    private clearChat() {
        this.chatHistory = [];
        this.updateWebview();
        this.saveChatHistory();
    }

    private async exportChat() {
        const chatContent = this.chatHistory
            .map((msg) =>
                `**${
                    msg.type === "user" ? "You" : "Agent"
                }** (${msg.timestamp.toLocaleString()}):\n${msg.content}`
            )
            .join("\n\n---\n\n");

        const document = await vscode.workspace.openTextDocument({
            content: chatContent,
            language: "markdown",
        });

        await vscode.window.showTextDocument(document);
    }

    private updateWebview() {
        if (this._view) {
            this._view.webview.postMessage({
                type: "updateChat",
                messages: this.chatHistory,
            });
        }
        this.saveChatHistory();
    }

    private getEditorContext() {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) return {};

        const document = activeEditor.document;
        const selection = activeEditor.selection;

        return {
            fileName: document.fileName,
            languageId: document.languageId,
            selectedText: selection.isEmpty
                ? undefined
                : document.getText(selection),
            cursorPosition: document.offsetAt(activeEditor.selection.active),
        };
    }

    private loadChatHistory() {
        // Load from workspace state or global state
        const saved = vscode.workspace.getConfiguration("wayang").get(
            "chatHistory",
            [],
        );
        this.chatHistory = Array.isArray(saved) ? saved : [];
        this.updateWebview();
    }

    private saveChatHistory() {
        vscode.workspace.getConfiguration("wayang").update(
            "chatHistory",
            this.chatHistory,
            vscode.ConfigurationTarget.Workspace,
        );
    }

    public showMemories(memories: any[]) {
        if (this._view) {
            this._view.webview.postMessage({
                type: "showMemories",
                memories: memories,
            });
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Coding Agent Chat</title>
            <style>
                body {
                    font-family: var(--vscode-font-family);
                    font-size: var(--vscode-font-size);
                    color: var(--vscode-foreground);
                    background-color: var(--vscode-editor-background);
                    margin: 0;
                    padding: 10px;
                    overflow-x: hidden;
                }
                
                .chat-container {
                    display: flex;
                    flex-direction: column;
                    height: 100vh;
                }
                
                .chat-messages {
                    flex: 1;
                    overflow-y: auto;
                    padding: 10px 0;
                    margin-bottom: 10px;
                }
                
                .message {
                    margin: 10px 0;
                    padding: 10px;
                    border-radius: 8px;
                    max-width: 100%;
                    word-wrap: break-word;
                }
                
                .message.user {
                    background-color: var(--vscode-inputOption-activeBackground);
                    margin-left: 20px;
                    border-bottom-right-radius: 3px;
                }
                
                .message.assistant {
                    background-color: var(--vscode-editor-selectionBackground);
                    margin-right: 20px;
                    border-bottom-left-radius: 3px;
                }
                
                .message.error {
                    background-color: var(--vscode-inputValidation-errorBackground);
                    border: 1px solid var(--vscode-inputValidation-errorBorder);
                }
                
                .message.loading {
                    opacity: 0.7;
                }
                
                .message-header {
                    font-size: 0.8em;
                    opacity: 0.8;
                    margin-bottom: 5px;
                }
                
                .message-content {
                    line-height: 1.5;
                }
                
                .message-content pre {
                    background-color: var(--vscode-textBlockQuote-background);
                    padding: 8px;
                    border-radius: 4px;
                    overflow-x: auto;
                    margin: 5px 0;
                }
                
                .message-content code {
                    background-color: var(--vscode-textBlockQuote-background);
                    padding: 2px 4px;
                    border-radius: 3px;
                }
                
                .input-container {
                    display: flex;
                    gap: 8px;
                    padding: 10px 0;
                    border-top: 1px solid var(--vscode-widget-border);
                }
                
                .message-input {
                    flex: 1;
                    padding: 8px 12px;
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 4px;
                    background-color: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    font-family: inherit;
                    font-size: inherit;
                    resize: vertical;
                    min-height: 20px;
                    max-height: 100px;
                }
                
                .message-input:focus {
                    outline: none;
                    border-color: var(--vscode-focusBorder);
                }
                
                .send-button, .clear-button, .export-button {
                    padding: 8px 16px;
                    border: none;
                    border-radius: 4px;
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    cursor: pointer;
                    font-family: inherit;
                    font-size: inherit;
                }
                
                .send-button:hover, .clear-button:hover, .export-button:hover {
                    background-color: var(--vscode-button-hoverBackground);
                }
                
                .send-button:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
                
                .toolbar {
                    display: flex;
                    gap: 8px;
                    margin-bottom: 10px;
                }
                
                .loading-indicator {
                    display: inline-block;
                    animation: spin 1s linear infinite;
                }
                
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                
                .memories-section {
                    background-color: var(--vscode-editor-inactiveSelectionBackground);
                    border-radius: 8px;
                    padding: 10px;
                    margin: 10px 0;
                }
                
                .memory-item {
                    padding: 5px 0;
                    border-bottom: 1px solid var(--vscode-widget-border);
                    font-size: 0.9em;
                }
                
                .memory-item:last-child {
                    border-bottom: none;
                }
            </style>
        </head>
        <body>
            <div class="chat-container">
                <div class="toolbar">
                    <button class="clear-button" onclick="clearChat()">Clear Chat</button>
                    <button class="export-button" onclick="exportChat()">Export</button>
                </div>
                
                <div class="chat-messages" id="chatMessages">
                    <div class="message assistant">
                        <div class="message-header">Coding Agent</div>
                        <div class="message-content">
                            👋 Hi! I'm your coding agent. I can help you with:
                            <ul>
                                <li>Analyzing and reviewing code</li>
                                <li>Finding and fixing bugs</li>
                                <li>Generating tests</li>
                                <li>Explaining code functionality</li>
                                <li>Refactoring and optimization</li>
                                <li>Code documentation</li>
                            </ul>
                            What would you like help with today?
                        </div>
                    </div>
                </div>
                
                <div class="input-container">
                    <textarea 
                        id="messageInput" 
                        class="message-input" 
                        placeholder="Ask me anything about your code..."
                        rows="1"
                    ></textarea>
                    <button id="sendButton" class="send-button" onclick="sendMessage()">Send</button>
                </div>
            </div>
            
            <script>
                const vscode = acquireVsCodeApi();
                let isWaitingForResponse = false;
                
                // Handle messages from extension
                window.addEventListener('message', event => {
                    const message = event.data;
                    
                    switch (message.type) {
                        case 'updateChat':
                            updateChatMessages(message.messages);
                            break;
                        case 'showMemories':
                            showMemories(message.memories);
                            break;
                    }
                });
                
                function updateChatMessages(messages) {
                    const chatMessages = document.getElementById('chatMessages');
                    const welcomeMessage = chatMessages.querySelector('.message.assistant');
                    
                    // Clear existing messages except welcome message
                    chatMessages.innerHTML = '';
                    if (messages.length === 0) {
                        chatMessages.appendChild(welcomeMessage);
                    }
                    
                    messages.forEach(msg => {
                        const messageDiv = document.createElement('div');
                        messageDiv.className = \`message \${msg.type}\`;
                        
                        if (msg.loading) {
                            messageDiv.classList.add('loading');
                        }
                        if (msg.error) {
                            messageDiv.classList.add('error');
                        }
                        
                        const headerDiv = document.createElement('div');
                        headerDiv.className = 'message-header';
                        headerDiv.textContent = msg.type === 'user' ? 'You' : 'Coding Agent';
                        if (msg.loading) {
                            headerDiv.innerHTML += ' <span class="loading-indicator">⚙️</span>';
                        }
                        
                        const contentDiv = document.createElement('div');
                        contentDiv.className = 'message-content';
                        contentDiv.innerHTML = formatMessageContent(msg.content);
                        
                        messageDiv.appendChild(headerDiv);
                        messageDiv.appendChild(contentDiv);
                        chatMessages.appendChild(messageDiv);
                    });
                    
                    // Scroll to bottom
                    chatMessages.scrollTop = chatMessages.scrollHeight;
                    
                    // Update loading state
                    isWaitingForResponse = messages.some(msg => msg.loading);
                    updateSendButton();
                }
                
                function formatMessageContent(content) {
                    // Simple markdown-like formatting
                    return content
                        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                        .replace(/\*(.*?)\*/g, '<em>$1</em>')
                        .replace(/\`\`\`(\\w+)?\\n([\\s\\S]*?)\\n\`\`\`/g, '<pre><code>$2</code></pre>')
                        .replace(/\`(.*?)\`/g, '<code>$1</code>')
                        .replace(/\\n/g, '<br>');
                }
                
                function sendMessage() {
                    const input = document.getElementById('messageInput');
                    const message = input.value.trim();
                    
                    if (!message || isWaitingForResponse) return;
                    
                    vscode.postMessage({
                        type: 'sendMessage',
                        text: message
                    });
                    
                    input.value = '';
                    input.style.height = 'auto';
                    isWaitingForResponse = true;
                    updateSendButton();
                }
                
                function clearChat() {
                    vscode.postMessage({ type: 'clearChat' });
                }
                
                function exportChat() {
                    vscode.postMessage({ type: 'exportChat' });
                }
                
                function updateSendButton() {
                    const sendButton = document.getElementById('sendButton');
                    sendButton.disabled = isWaitingForResponse;
                    sendButton.textContent = isWaitingForResponse ? 'Sending...' : 'Send';
                }
                
                function showMemories(memories) {
                    const chatMessages = document.getElementById('chatMessages');
                    const memoriesDiv = document.createElement('div');
                    memoriesDiv.className = 'memories-section';
                    
                    const headerDiv = document.createElement('div');
                    headerDiv.innerHTML = '<strong>Recent Memory Context:</strong>';
                    memoriesDiv.appendChild(headerDiv);
                    
                    memories.forEach(memory => {
                        const memoryItem = document.createElement('div');
                        memoryItem.className = 'memory-item';
                        memoryItem.textContent = \`\${memory.query || memory.summary} (\${new Date(memory.timestamp).toLocaleString()})\`;
                        memoriesDiv.appendChild(memoryItem);
                    });
                    
                    chatMessages.appendChild(memoriesDiv);
                    chatMessages.scrollTop = chatMessages.scrollHeight;
                }
                
                // Auto-resize textarea
                document.getElementById('messageInput').addEventListener('input', function() {
                    this.style.height = 'auto';
                    this.style.height = Math.min(this.scrollHeight, 100) + 'px';
                });
                
                // Send message on Enter (but not Shift+Enter)
                document.getElementById('messageInput').addEventListener('keydown', function(e) {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                    }
                });
                
                // Initialize
                updateSendButton();
            </script>
        </body>
        </html>`;
    }
}

interface ChatMessage {
    id: string;
    type: "user" | "assistant";
    content: string;
    timestamp: Date;
    loading?: boolean;
    error?: boolean;
}
