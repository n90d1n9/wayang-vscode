// Client-side JavaScript that will be injected into the webview
class ChatClient {
    constructor() {
        this.vscode = acquireVsCodeApi();
        this.isWaitingForResponse = false;
        this.currentMode = 'chat';
        this.isStreaming = false;
        this.sessions = [];
        this.isSessionsPanelOpen = false;
        this.isSearchOpen = false;
        this.projectContext = {};
        this.searchResults = [];
        this.messageIdCounter = 0;

        this.initialize();
    }

    initialize() {
        this.setupEventListeners();
        this.updateSendButton();
        this.setMode('chat');
        this.updateStreamToggle();

        // Focus input after initialization
        setTimeout(() => {
            const input = document.getElementById('messageInput');
            if (input) {
                input.focus();
            }
        }, 500);
    }

    setupEventListeners() {
        // Message input events
        const messageInput = document.getElementById('messageInput');
        if (messageInput) {
            messageInput.addEventListener('input', this.handleInput.bind(this));
            messageInput.addEventListener('keydown', this.handleKeydown.bind(this));
        }

        // Search input events
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', this.handleSearchInput.bind(this));
        }

        // Mode buttons
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const mode = btn.dataset.mode;
                this.setModeAndFocus(mode);
            });
        });

        // Settings checkboxes
        document.querySelectorAll('.feature-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', this.saveSettings.bind(this));
        });

        // Global keyboard shortcuts
        document.addEventListener('keydown', this.handleGlobalKeydown.bind(this));
    }

    setupLayout() {
        // Hide toolbar by default, show on hover
        const toolbar = document.querySelector('.toolbar');
        if (toolbar) {
            toolbar.style.display = 'none';
        }

        // Add hover effect to show toolbar
        const header = document.querySelector('.header');
        if (header) {
            header.addEventListener('mouseenter', () => {
                this.toggleToolbar(true);
            });
            
            header.addEventListener('mouseleave', () => {
                this.toggleToolbar(false);
            });
        }
    }

    toggleToolbar(show) {
        const toolbar = document.querySelector('.toolbar');
        if (toolbar) {
            toolbar.style.display = show ? 'flex' : 'none';
        }
    }

    handleInput(event) {
        const input = event.target;
        // Auto-resize
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 150) + 'px';

        // Word count and character limit
        const wordCount = input.value.trim().split(/\s+/).length;
        const charCount = input.value.length;

        // Show word count for long messages
        if (charCount > 100) {
            input.title = `${wordCount} words, ${charCount} characters`;
        } else {
            input.title = '';
        }
    }

    handleKeydown(event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            this.sendMessage();
        } else if (event.key === 'Escape') {
            event.target.blur();
        } else if (event.ctrlKey || event.metaKey) {
            switch (event.key) {
                case 'k':
                    event.preventDefault();
                    this.clearChat();
                    break;
                case 'f':
                    event.preventDefault();
                    this.toggleSearch();
                    break;
                case 's':
                    event.preventDefault();
                    this.saveConversation();
                    break;
            }
        }
    }

    handleSearchInput(event) {
        clearTimeout(this.searchTimeout);
        this.searchTimeout = setTimeout(() => {
            if (event.target.value.trim()) {
                this.searchHistory(event.target.value);
            } else {
                const resultsDiv = document.getElementById('searchResults');
                if (resultsDiv) {
                    resultsDiv.innerHTML = '';
                };
            }
        }, 300);
    }

    handleGlobalKeydown(event) {
        if (event.ctrlKey || event.metaKey) {
            switch (event.key) {
                case 'n':
                    if (event.shiftKey) {
                        event.preventDefault();
                        this.createNewSession();
                    }
                    break;
                case 'e':
                    if (event.shiftKey) {
                        event.preventDefault();
                        this.showExportMenu();
                    }
                    break;
                case 'ArrowUp':
                    event.preventDefault();
                    this.navigateMessages(-1);
                    break;
                case 'ArrowDown':
                    event.preventDefault();
                    this.navigateMessages(1);
                    break;
            }
        }
    }

    // ... all the other methods from your original script
    // (sendMessage, setMode, updateStatus, etc.)



    /*     const vscode = acquireVsCodeApi();
        let isWaitingForResponse = false;
         */
    // Handle messages from extension
    /*  window.addEventListener('message', event => {
         const message = event.data;
         
         switch (message.type) {
             case 'updateChat':
                 updateChatMessages(message.messages);
                 break;
             case 'showMemories':
                 showMemories(message.memories);
                 break;
         }
     }); */

    updateChatMessages(messages) {
        const chatMessages = document.getElementById('chatMessages');
        const welcomeMessage = chatMessages.querySelector('.message.assistant');

        // Clear existing messages except welcome message
        chatMessages.innerHTML = '';
        if (messages.length === 0) {
            chatMessages.appendChild(welcomeMessage);
        }

        messages.forEach(msg => {
            const messageDiv = document.createElement('div');
            messageDiv.className = `message \${msg.type}`;

            if (msg.loading) {
                messageDiv.classList.add('loading');
            }
            if (msg.error) {
                messageDiv.classList.add('error');
            }

            const headerDiv = document.createElement('div');
            headerDiv.className = 'message-header';
            headerDiv.textContent = msg.type === 'user' ? 'You' : 'Wayang Code';
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

    formatMessageContent(content) {
        // Simple markdown-like formatting
        return content
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\`\`\`(\\w+)?\\n([\\s\\S]*?)\\n\`\`\`/g, '<pre><code>$2</code></pre>')
            .replace(/\`(.*?)\`/g, '<code>$1</code>')
            .replace(/\\n/g, '<br>');
    }

    sendMessage() {
        const input = document.getElementById('messageInput');
        const message = input.value.trim();

        if (!message || isWaitingForResponse) {return;}

        vscode.postMessage({
            type: 'sendMessage',
            text: message
        });

        input.value = '';
        input.style.height = 'auto';
        isWaitingForResponse = true;
        updateSendButton();
    }

    clearChat() {
        vscode.postMessage({ type: 'clearChat' });
    }

    exportChat() {
        vscode.postMessage({ type: 'exportChat' });
    }

    updateSendButton() {
        const sendButton = document.getElementById('sendButton');
        sendButton.disabled = isWaitingForResponse;
        sendButton.textContent = isWaitingForResponse ? 'Sending...' : 'Send';
    }

    showMemories(memories) {
        const chatMessages = document.getElementById('chatMessages');
        const memoriesDiv = document.createElement('div');
        memoriesDiv.className = 'memories-section';

        const headerDiv = document.createElement('div');
        headerDiv.innerHTML = '<strong>Recent Memory Context:</strong>';
        memoriesDiv.appendChild(headerDiv);

        memories.forEach(memory => {
            const memoryItem = document.createElement('div');
            memoryItem.className = 'memory-item';
            memoryItem.textContent = `\${memory.query || memory.summary} (\${new Date(memory.timestamp).toLocaleString()})`;
            memoriesDiv.appendChild(memoryItem);
        });

        chatMessages.appendChild(memoriesDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    updateSendButton() {
        const sendButton = document.getElementById('sendButton');
        sendButton.disabled = isWaitingForResponse;
        sendButton.textContent = isWaitingForResponse ? 'Sending...' : 'Send';
    }

    

}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.chatClient = new ChatClient();
});

// Auto-resize textarea
document.getElementById('messageInput').addEventListener('input', function () {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 100) + 'px';
});

// Send message on Enter (but not Shift+Enter)
document.getElementById('messageInput').addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});