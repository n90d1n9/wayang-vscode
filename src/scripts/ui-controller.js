// scripts/client-script.js

// A class to handle all UI-related DOM manipulations
class UIController {
    constructor() {
        this.messageInput = document.getElementById('messageInput');
        this.chatMessages = document.getElementById('chatMessages');
        this.sendButton = document.getElementById('sendButton');
        this.modeIndicator = document.getElementById('currentMode');
    }

    // Set the placeholder and indicator text based on the mode
    updateModeDisplay(mode, placeholder, indicator) {
        if (this.messageInput) { this.messageInput.placeholder = placeholder; }
        if (this.modeIndicator) { this.modeIndicator.textContent = indicator; }
        
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });
    }

    // Toggle the disabled state and text of the send button
    updateSendButtonState(isWaiting) {
        if (this.sendButton) {
            this.sendButton.disabled = isWaiting;
            this.sendButton.textContent = isWaiting ? 'Sending...' : 'Send';
        }
    }

    // Render all chat messages to the DOM
    renderChatMessages(messages, formatMessage) {
        if (!this.chatMessages) { return; }

        this.chatMessages.innerHTML = '';

        if (messages.length === 0) {
            this.showWelcomeMessage();
            return;
        }

        messages.forEach(msg => {
            const messageDiv = document.createElement('div');
            messageDiv.className = `message ${msg.type}`;
            if (msg.loading) { messageDiv.classList.add('loading'); }
            if (msg.error) { messageDiv.classList.add('error'); }

            const header = `
                <div class="message-header">
                    <span>${msg.type === 'user' ? '👤 You' : '🤖 Wayang Code'}</span>
                    ${msg.loading ? '<span class="loading-indicator">⚙️</span>' : ''}
                </div>
            `;
            const content = `<div class="message-content">${formatMessage(msg.content)}</div>`;
            
            messageDiv.innerHTML = header + content;
            this.chatMessages.appendChild(messageDiv);
        });

        this.scrollToBottom();
    }
    
    // Show a welcome message when the chat is empty
    showWelcomeMessage() {
        const welcomeMessage = document.createElement('div');
        welcomeMessage.className = 'welcome-message';
        welcomeMessage.innerHTML = `
            <h3>👋 Welcome to Wayang Code!</h3>
            <p>Your intelligent coding companion</p>
        `;
        this.chatMessages.appendChild(welcomeMessage);
    }
    
    // Auto-resize the message input
    resizeInput() {
        if (this.messageInput) {
            this.messageInput.style.height = 'auto';
            this.messageInput.style.height = Math.min(this.messageInput.scrollHeight, 150) + 'px';
        }
    }
    
    // Scroll the chat messages to the bottom
    scrollToBottom() {
        if (this.chatMessages) {
            this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        }
    }
}

// A class to handle all event listeners and user input
class EventHandler {
    constructor(client) {
        this.client = client;
    }

    setup() {
        this.setupInputListeners();
        this.setupModeButtons();
        this.setupToolbarListeners();
        this.setupGlobalShortcuts();
        
        window.addEventListener('message', this.client.handleExtensionMessage.bind(this.client));
    }
    
    setupInputListeners() {
        const input = this.client.ui.messageInput;
        if (input) {
            input.addEventListener('input', () => this.client.ui.resizeInput());
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.client.sendMessage();
                }
            });
        }
    }

    setupModeButtons() {
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const mode = btn.dataset.mode;
                this.client.setModeAndFocus(mode);
            });
        });
    }
    
    setupToolbarListeners() {
        const header = document.querySelector('.header');
        if (header) {
            header.addEventListener('mouseenter', () => this.client.isToolbarVisible = true);
            header.addEventListener('mouseleave', () => this.client.isToolbarVisible = false);
        }
    }

    setupGlobalShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case 'k': e.preventDefault(); this.client.clearChat(); break;
                    case 'f': e.preventDefault(); this.client.toggleSearch(); break;
                    case 'n': if (e.shiftKey) { e.preventDefault(); this.client.createNewSession(); } break;
                }
            }
        });
    }
}

// The main client class, now much cleaner
class ChatClient {
    constructor() {
        this.vscode = acquireVsCodeApi();
        this.ui = new UIController();
        this.eventHandler = new EventHandler(this);

        this.isWaitingForResponse = false;
        this.currentMode = 'chat';
        this.isStreaming = false;
        this.isToolbarVisible = false;

        this.initialize();
    }

    initialize() {
        this.eventHandler.setup();
        this.setMode('chat');
        setTimeout(() => this.ui.messageInput.focus(), 500);
    }

    // Core functionality methods are now more focused
    sendMessage() {
        const message = this.ui.messageInput.value.trim();
        if (!message || this.isWaitingForResponse) { return; }

        this.vscode.postMessage({
            type: 'sendMessage',
            text: message,
            mode: this.currentMode
        });
        
        this.ui.messageInput.value = '';
        this.ui.resizeInput();
        this.isWaitingForResponse = true;
        this.ui.updateSendButtonState(true);
    }
    
    setMode(mode) {
        this.currentMode = mode;
        const modeConfig = {
            chat: { placeholder: 'Ask me anything...', indicator: '💬 Chat' },
            code: { placeholder: 'Describe the code...', indicator: '💻 Code' },
            review: { placeholder: 'Ask for a code review...', indicator: '🔍 Review' },
            test: { placeholder: 'Request test generation...', indicator: '🧪 Test' }
        };
        const config = modeConfig[mode] || modeConfig.chat;
        this.ui.updateModeDisplay(mode, config.placeholder, config.indicator);
    }

    setModeAndFocus(mode) {
        this.setMode(mode);
        if (this.ui.messageInput) { this.ui.messageInput.focus(); }
    }
    
    // This method now only handles extension messages and delegates to other methods
    handleExtensionMessage(event) {
        const message = event.data;
        switch (message.type) {
            case 'updateChat':
                this.isWaitingForResponse = message.messages.some(msg => msg.loading);
                this.ui.renderChatMessages(message.messages, this.formatMessageContent);
                this.ui.updateSendButtonState(this.isWaitingForResponse);
                break;
            case 'modeChanged':
                this.setMode(message.mode);
                break;
            // All other message handlers
            case 'updateSessions':
            case 'showMemories':
            case 'searchResults':
            case 'projectContextUpdated':
                // ... delegate to specific methods like this.updateSessions(message.sessions);
                break;
        }
    }

    // Helper method for formatting content
    formatMessageContent(content) {
        // ... (your existing implementation)
    }
    
    // Other methods like clearChat, toggleSearch, etc.
}

window.addEventListener('DOMContentLoaded', () => {
    window.chatClient = new ChatClient();
});