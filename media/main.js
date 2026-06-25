const vscode = acquireVsCodeApi();

// Global state
let appState = {
    isWaitingForResponse: false,
    currentMode: 'chat',
    isStreaming: false,
    sessions: [],
    isSessionsPanelOpen: false,
    isSearchOpen: false,
    projectContext: {},
    searchResults: []
};

// Initialize application
document.addEventListener("DOMContentLoaded", () => {
    initializeApp();
    setupEventListeners();
});

function initializeApp() {
    console.log("Initializing Wayang Chat...");
    
    // Initialize UI components
    initializeToolbar();
    initializeSessions();
    initializeModeButtons();
    initializeInputArea();
    
    // Send ready message to extension
    vscode.postMessage({ type: 'webviewReady' });
}

function setupEventListeners() {
    // Delegated event listeners for dynamic content
    document.addEventListener('click', (event) => {
        const target = event.target;
        
        // Handle toolbar buttons
        if (target.matches('.toolbar-btn')) {
            handleToolbarAction(target.dataset.action, target.dataset);
            return;
        }
        
        // Handle session items
        if (target.matches('.session-item')) {
            const sessionId = target.dataset.sessionId;
            if (sessionId) {
                switchSession(sessionId);
            }
            return;
        }
        
        // Handle session delete buttons
        if (target.matches('.session-delete')) {
            event.stopPropagation();
            const sessionId = target.dataset.sessionId;
            if (sessionId) {
                deleteSession(sessionId);
            }
            return;
        }
        
        // Handle mode buttons
        if (target.matches('.mode-btn')) {
            const mode = target.dataset.mode;
            if (mode) {
                setMode(mode);
            }
            return;
        }
        
        // Handle header buttons
        if (target.matches('.header-btn')) {
            handleHeaderAction(target.dataset.action);
            return;
        }
    });

    // Input event listeners
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');
    
    if (messageInput && sendButton) {
        messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
        
        sendButton.addEventListener('click', sendMessage);
    }
}

function initializeToolbar() {
    console.log("Initializing toolbar...");
    // Toolbar is handled by delegated event listeners
}

function initializeSessions() {
    console.log("Initializing sessions...");
    // Sessions are handled by delegated event listeners
}

function initializeModeButtons() {
    console.log("Initializing mode buttons...");
    // Set initial active mode
    const activeModeBtn = document.querySelector(`.mode-btn[data-mode="${appState.currentMode}"]`);
    if (activeModeBtn) {
        activeModeBtn.classList.add('active');
    }
}

function initializeInputArea() {
    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
        // Auto-resize textarea
        messageInput.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 150) + 'px';
        });
    }
}

// Action handlers
function handleToolbarAction(action, data) {
    switch (action) {
        case 'toggleSessions':
            toggleSessions();
            break;
        case 'createNewSession':
            createNewSession();
            break;
        case 'analyzeProject':
            analyzeProject();
            break;
        case 'clearChat':
            clearChat();
            break;
        case 'showExportMenu':
            showExportMenu();
            break;
        case 'toggleSearch':
            toggleSearch();
            break;
        case 'saveConversation':
            saveConversation();
            break;
        case 'loadConversation':
            loadConversation();
            break;
        case 'shareConversation':
            shareConversation();
            break;
        default:
            console.warn('Unknown toolbar action:', action);
    }
}

function handleHeaderAction(action) {
    switch (action) {
        case 'toggleContext':
            toggleProjectContext();
            break;
        case 'setMode':
            // Handled by mode buttons directly
            break;
        default:
            console.warn('Unknown header action:', action);
    }
}

// Core functionality
function sendMessage() {
    const messageInput = document.getElementById('messageInput');
    if (!messageInput) return;
    
    const message = messageInput.value.trim();
    if (!message || appState.isWaitingForResponse) return;

    vscode.postMessage({
        type: 'sendMessage',
        text: message,
        mode: appState.currentMode
    });

    messageInput.value = '';
    messageInput.style.height = 'auto';
    appState.isWaitingForResponse = true;
    updateSendButton();
}

function setMode(mode) {
    appState.currentMode = mode;
    
    // Update UI
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
    });
    
    // Update input placeholder
    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
        const placeholders = {
            chat: 'Ask me anything about your code...',
            code: 'Describe the code you want to generate or analyze...',
            review: 'Ask me to review your code for issues...',
            test: 'Request test generation or test analysis...'
        };
        messageInput.placeholder = placeholders[mode] || placeholders.chat;
    }
    
    vscode.postMessage({ type: 'setMode', mode: mode });
}

// Session management
function toggleSessions() {
    vscode.postMessage({ type: 'toggleSessions' });
}

function createNewSession() {
    vscode.postMessage({ type: 'createNewSession' });
}

function switchSession(sessionId) {
    vscode.postMessage({ type: 'switchSession', sessionId: sessionId });
}

function deleteSession(sessionId) {
    vscode.postMessage({ type: 'deleteSession', sessionId: sessionId });
}

// Other actions
function analyzeProject() {
    vscode.postMessage({ type: 'analyzeProject' });
}

function clearChat() {
    vscode.postMessage({ type: 'clearChat' });
}

function showExportMenu() {
    vscode.postMessage({ type: 'showExportMenu' });
}

function toggleSearch() {
    vscode.postMessage({ type: 'toggleSearch' });
}

function saveConversation() {
    vscode.postMessage({ type: 'saveConversation' });
}

function loadConversation() {
    vscode.postMessage({ type: 'loadConversation' });
}

function shareConversation() {
    vscode.postMessage({ type: 'shareConversation' });
}

function toggleProjectContext() {
    vscode.postMessage({ type: 'toggleProjectContext' });
}

function updateSendButton() {
    const sendButton = document.getElementById('sendButton');
    const sendButtonText = document.getElementById('sendButtonText');
    
    if (!sendButton || !sendButtonText) return;
    
    if (appState.isWaitingForResponse) {
        sendButton.disabled = true;
        sendButton.classList.add('streaming');
        sendButtonText.textContent = '🛑 Stop';
        sendButton.onclick = stopGeneration;
    } else {
        sendButton.disabled = false;
        sendButton.classList.remove('streaming');
        sendButtonText.textContent = '🚀 Send';
        sendButton.onclick = sendMessage;
    }
}

function stopGeneration() {
    vscode.postMessage({ type: 'stopGeneration' });
    appState.isWaitingForResponse = false;
    updateSendButton();
}

// Message handling from extension
window.addEventListener('message', (event) => {
    const message = event.data;
    
    switch (message.type) {
        case 'updateState':
            updateAppState(message.state);
            break;
        case 'updateChat':
            updateChatMessages(message.messages);
            break;
        case 'updateSessions':
            updateSessions(message.sessions);
            break;
        case 'toggleSessions':
            toggleSessionsUI(message.isOpen);
            break;
        case 'showToast':
            showToast(message.text, message.level);
            break;
        case 'updateProjectContext':
            updateProjectContext(message.context);
            break;
    }
});

function updateAppState(newState) {
    appState = { ...appState, ...newState };
    updateUI();
}

function updateUI() {
    updateSendButton();
    updateSessionUI();
    updateProjectContextUI();
}

function updateSessions(sessions) {
    appState.sessions = sessions;
    updateSessionUI();
}

function updateSessionUI() {
    const sessionsList = document.getElementById('sessionsList');
    if (!sessionsList) return;
    
    sessionsList.innerHTML = appState.sessions.map(session => `
        <div class="session-item" data-session-id="${session.id}">
            <div class="session-name">${session.name}</div>
            <div class="session-meta">
                <span>${session.messageCount} msgs</span>
                <span>${formatTimeAgo(session.lastActivity)}</span>
                <div class="session-actions">
                    ${session.id !== 'default' ? `
                        <button class="session-delete" data-action="deleteSession" data-session-id="${session.id}" title="Delete Session">✕</button>
                    ` : ''}
                </div>
            </div>
        </div>
    `).join('');
}

function toggleSessionsUI(isOpen) {
    appState.isSessionsPanelOpen = isOpen;
    const sessionsPanel = document.getElementById('sessionsPanel');
    if (sessionsPanel) {
        sessionsPanel.classList.toggle('open', isOpen);
    }
}

function updateProjectContext(context) {
    appState.projectContext = context;
    updateProjectContextUI();
}

function updateProjectContextUI() {
    const contextInfo = document.getElementById('contextInfo');
    const projectType = document.getElementById('projectType');
    
    if (contextInfo && appState.projectContext.projectType) {
        const context = appState.projectContext;
        const depCount = context.dependencies?.length || 0;
        const branch = context.gitBranch || 'no-git';
        contextInfo.textContent = `${context.projectType} • ${depCount} dependencies • ${branch} branch`;
    }
    
    if (projectType && appState.projectContext.projectType) {
        projectType.textContent = `🏗️ ${appState.projectContext.projectType}`;
    }
}

// Utility functions
function formatTimeAgo(timestamp) {
    const now = new Date();
    const time = new Date(timestamp);
    const diffMs = now - time;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return time.toLocaleDateString();
}

function showToast(message, level = 'info') {
    // Create toast notification
    const toast = document.createElement('div');
    toast.className = `toast toast-${level}`;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    // Remove after delay
    setTimeout(() => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    }, 3000);
}

// Add CSS for toast notifications
const toastStyles = document.createElement('style');
toastStyles.textContent = `
    .toast {
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 6px;
        color: white;
        z-index: 1000;
        animation: slideInRight 0.3s ease;
    }
    
    .toast-info {
        background: var(--vscode-notificationsInfoIcon-foreground);
    }
    
    .toast-success {
        background: var(--vscode-testing-iconPassed);
    }
    
    .toast-warning {
        background: var(--vscode-notificationsWarningIcon-foreground);
    }
    
    .toast-error {
        background: var(--vscode-errorForeground);
    }
    
    @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
`;
document.head.appendChild(toastStyles);