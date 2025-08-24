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
                input.focus();}
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
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.chatClient = new ChatClient();
});