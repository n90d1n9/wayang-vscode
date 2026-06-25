const vscode = acquireVsCodeApi();

// Global state
let appState = {
    isWaitingForResponse: false,
    currentMode: 'chat',
    isStreaming: false,
    sessions: [],
    isSessionsPanelOpen: false,
    isSearchOpen: false,
    isSettingsOpen: false,
    projectContext: {},
    searchResults: [],
    serverConfig: {
        serverUrl: 'http://localhost:8080',
        apiKey: '',
        selectedModel: '',
        availableModels: [],
        temperature: 0.7,
        maxTokens: 2048,
        streamEnabled: true
    }
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

        // Handle session action buttons (duplicate, rename)
        if (target.matches('.session-action-btn')) {
            event.stopPropagation();
            const action = target.dataset.action;
            const sessionId = target.dataset.sessionId;
            if (sessionId) {
                if (action === 'duplicateSession') {
                    duplicateSession(sessionId);
                } else if (action === 'renameSession') {
                    const newName = prompt('Enter new session name:', 'Session');
                    if (newName) {
                        renameSession(sessionId, newName);
                    }
                }
            }
            return;
        }

        // Handle project items
        if (target.matches('.project-item')) {
            const projectId = target.dataset.projectId;
            if (projectId) {
                switchProject(projectId);
            }
            return;
        }

        // Handle project action buttons
        if (target.matches('.project-action-btn')) {
            event.stopPropagation();
            const action = target.dataset.action;
            const projectId = target.dataset.projectId;
            if (projectId) {
                if (action === 'deleteProject') {
                    if (confirm('Are you sure you want to delete this project? All sessions will be deleted.')) {
                        deleteProject(projectId);
                    }
                } else if (action === 'renameProject') {
                    const newName = prompt('Enter new project name:', 'Project');
                    if (newName) {
                        renameProject(projectId, newName);
                    }
                }
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
        
        // Handle settings panel buttons
        if (target.matches('.settings-close-btn')) {
            handleHeaderAction('closeSettings');
            return;
        }
        
        if (target.matches('.test-connection-btn')) {
            testConnection();
            return;
        }
        
        if (target.matches('.refresh-models-btn')) {
            refreshModels();
            return;
        }
        
        if (target.matches('.save-settings-btn')) {
            saveServerSettings();
            return;
        }
        
        if (target.matches('.reset-settings-btn')) {
            resetServerSettings();
            return;
        }
        
        // Handle settings inputs
        if (target.matches('.setting-input') || target.matches('.setting-select') || 
            target.matches('.setting-range') || target.matches('.setting-checkbox')) {
            updateSettingFromInput(target);
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
        case 'toggleSettings':
            toggleSettings();
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
    vscode.postMessage({ type: 'resumeSession', sessionId: sessionId });
}

function duplicateSession(sessionId) {
    vscode.postMessage({ type: 'duplicateSession', sessionId: sessionId });
}

function renameSession(sessionId, newName) {
    vscode.postMessage({ type: 'renameSession', sessionId: sessionId, newName: newName });
}

function deleteSession(sessionId) {
    vscode.postMessage({ type: 'deleteSession', sessionId: sessionId });
}

// Project management
function createProject(name, path) {
    vscode.postMessage({ type: 'createProject', name: name, path: path });
}

function switchProject(projectId) {
    vscode.postMessage({ type: 'switchProject', projectId: projectId });
}

function deleteProject(projectId) {
    vscode.postMessage({ type: 'deleteProject', projectId: projectId });
}

function renameProject(projectId, newName) {
    vscode.postMessage({ type: 'renameProject', projectId: projectId, newName: newName });
}

function getTokenUsage(sessionId) {
    vscode.postMessage({ type: 'getTokenUsage', sessionId: sessionId });
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

function toggleSettings() {
    appState.isSettingsOpen = !appState.isSettingsOpen;
    vscode.postMessage({ 
        type: 'toggleSettings', 
        isOpen: appState.isSettingsOpen 
    });
    
    // Update UI
    const settingsPanel = document.getElementById('settingsPanel');
    if (settingsPanel) {
        settingsPanel.classList.toggle('open', appState.isSettingsOpen);
    }
}

function testConnection() {
    vscode.postMessage({ 
        type: 'testConnection',
        config: appState.serverConfig
    });
}

function refreshModels() {
    vscode.postMessage({ 
        type: 'refreshModels',
        config: appState.serverConfig
    });
}

function saveServerSettings() {
    vscode.postMessage({ 
        type: 'saveServerSettings',
        config: appState.serverConfig
    });
}

function resetServerSettings() {
    appState.serverConfig = {
        serverUrl: 'http://localhost:8080',
        apiKey: '',
        selectedModel: '',
        availableModels: [],
        temperature: 0.7,
        maxTokens: 2048,
        streamEnabled: true
    };
    
    // Update UI inputs
    updateSettingsUI();
    vscode.postMessage({ 
        type: 'resetServerSettings',
        config: appState.serverConfig
    });
}

function updateSettingsUI() {
    const serverUrlInput = document.getElementById('serverUrl');
    const apiKeyInput = document.getElementById('apiKey');
    const modelSelect = document.getElementById('modelSelect');
    const temperatureSlider = document.getElementById('temperature');
    const maxTokensSlider = document.getElementById('maxTokens');
    const streamCheckbox = document.getElementById('streamEnabled');
    
    if (serverUrlInput) serverUrlInput.value = appState.serverConfig.serverUrl;
    if (apiKeyInput) apiKeyInput.value = appState.serverConfig.apiKey;
    if (modelSelect) modelSelect.value = appState.serverConfig.selectedModel;
    if (temperatureSlider) {
        temperatureSlider.value = appState.serverConfig.temperature;
        document.getElementById('temperatureValue').textContent = appState.serverConfig.temperature;
    }
    if (maxTokensSlider) {
        maxTokensSlider.value = appState.serverConfig.maxTokens;
        document.getElementById('maxTokensValue').textContent = appState.serverConfig.maxTokens;
    }
    if (streamCheckbox) streamCheckbox.checked = appState.serverConfig.streamEnabled;
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
        case 'updateProjects':
            updateProjects(message.projects);
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
        case 'updateServerConfig':
            updateServerConfig(message.config);
            break;
        case 'connectionStatus':
            showConnectionStatus(message.status, message.message);
            break;
        case 'updateModels':
            updateAvailableModels(message.models);
            break;
        case 'updateTokenUsage':
            updateTokenUsageDisplay(message.tokenUsage);
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
                ${session.tokenUsage ? `<span class="token-badge">🪙 ${session.tokenUsage.totalTokens || 0}</span>` : ''}
                <div class="session-actions">
                    ${session.id !== 'default' ? `
                        <button class="session-action-btn" data-action="duplicateSession" data-session-id="${session.id}" title="Duplicate Session">📋</button>
                        <button class="session-action-btn" data-action="renameSession" data-session-id="${session.id}" title="Rename Session">✏️</button>
                        <button class="session-delete" data-action="deleteSession" data-session-id="${session.id}" title="Delete Session">✕</button>
                    ` : ''}
                </div>
            </div>
        </div>
    `).join('');
}

function updateProjects(projects) {
    appState.projects = projects;
    updateProjectUI();
}

function updateProjectUI() {
    const projectsList = document.getElementById('projectsList');
    if (!projectsList) return;

    projectsList.innerHTML = appState.projects.map(project => `
        <div class="project-item ${project.id === appState.currentProjectId ? 'active' : ''}" data-project-id="${project.id}">
            <div class="project-header">
                <div class="project-name">${project.name}</div>
                <div class="project-actions">
                    ${project.id !== 'default' ? `
                        <button class="project-action-btn" data-action="renameProject" data-project-id="${project.id}" title="Rename Project">✏️</button>
                        <button class="project-action-btn" data-action="deleteProject" data-project-id="${project.id}" title="Delete Project">✕</button>
                    ` : ''}
                </div>
            </div>
            <div class="project-meta">
                <span>${project.sessionCount} sessions</span>
                <span>${project.totalTokenUsage ? `🪙 ${project.totalTokenUsage.totalTokens || 0} tokens` : ''}</span>
                <span>${formatTimeAgo(project.lastActivity)}</span>
            </div>
        </div>
    `).join('');
}

function updateTokenUsageDisplay(tokenUsage) {
    const tokenUsageEl = document.getElementById('tokenUsageDisplay');
    if (!tokenUsageEl || !tokenUsage) return;

    const quotaText = tokenUsage.quotaLimit ? ` / ${tokenUsage.quotaLimit}` : '';
    const remainingText = tokenUsage.quotaRemaining !== undefined ? ` (${tokenUsage.quotaRemaining} remaining)` : '';
    
    tokenUsageEl.innerHTML = `
        <span class="token-metric">
            <span class="token-label">Input:</span>
            <span class="token-value">${tokenUsage.inputTokens || 0}</span>
        </span>
        <span class="token-metric">
            <span class="token-label">Output:</span>
            <span class="token-value">${tokenUsage.outputTokens || 0}</span>
        </span>
        <span class="token-metric total">
            <span class="token-label">Total:</span>
            <span class="token-value">${tokenUsage.totalTokens || 0}${quotaText}</span>
        </span>
        ${remainingText ? `<span class="quota-remaining">${remainingText}</span>` : ''}
    `;
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

function updateServerConfig(config) {
    appState.serverConfig = { ...appState.serverConfig, ...config };
    updateSettingsUI();
}

function showConnectionStatus(status, message) {
    const statusEl = document.getElementById('connectionStatus');
    if (!statusEl) return;
    
    statusEl.textContent = message || (status === 'success' ? 'Connected ✓' : 'Disconnected ✗');
    statusEl.className = `connection-status ${status}`;
    
    setTimeout(() => {
        statusEl.textContent = '';
        statusEl.className = 'connection-status';
    }, 3000);
}

function updateAvailableModels(models) {
    appState.serverConfig.availableModels = models;
    
    const modelSelect = document.getElementById('modelSelect');
    if (!modelSelect) return;
    
    modelSelect.innerHTML = `
        <option value="">Select a model...</option>
        ${models.length > 0 
            ? models.map(model => 
                `<option value="${model}" ${model === appState.serverConfig.selectedModel ? 'selected' : ''}>${model}</option>`
              ).join('')
            : '<option value="" disabled>No models available</option>'
        }
    `;
}

function updateSettingFromInput(target) {
    const setting = target.dataset.setting;
    if (!setting) return;
    
    let value;
    if (target.type === 'checkbox') {
        value = target.checked;
    } else if (target.type === 'range') {
        value = parseFloat(target.value);
    } else {
        value = target.value;
    }
    
    appState.serverConfig[setting] = value;
    
    // Update display values for sliders
    if (setting === 'temperature') {
        document.getElementById('temperatureValue').textContent = value;
    } else if (setting === 'maxTokens') {
        document.getElementById('maxTokensValue').textContent = value;
    }
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