const vscode = acquireVsCodeApi();

// Global state
let appState = {
    isWaitingForResponse: false,
    currentMode: 'chat',
    isStreaming: false,
    sessions: [],
    projects: [],
    currentProject: null,
    currentSession: null,
    tokenUsage: { input: 0, output: 0, total: 0 },
    quotaLimit: 100000,
    serverConfig: {
        serverUrl: 'http://localhost:8080',
        apiKey: '',
        selectedModel: '',
        availableModels: [],
        temperature: 0.7,
        maxTokens: 2048,
        streamEnabled: true
    },
    isConnected: false
};

// Initialize application
document.addEventListener("DOMContentLoaded", () => {
    initializeApp();
    setupEventListeners();
});

function initializeApp() {
    console.log("Initializing Wayang Chat...");
    updateUI();
    vscode.postMessage({ type: 'webviewReady' });
}

function setupEventListeners() {
    // Delegated event listeners for dynamic content
    document.addEventListener('click', (event) => {
        const target = event.target.closest('.action-btn, .icon-btn, .primary-btn, .session-item, .project-item, .send-btn, .mode-btn');
        
        if (!target) return;
        
        // Session actions
        if (target.classList.contains('action-btn')) {
            event.stopPropagation();
            const action = target.getAttribute('onclick');
            if (action && action.includes('duplicateSession')) {
                const sessionId = action.match(/'([^']+)'/)[1];
                duplicateSession(sessionId);
            } else if (action && action.includes('renameSession')) {
                const sessionId = action.match(/'([^']+)'/)[1];
                renameSessionPrompt(sessionId);
            } else if (action && action.includes('deleteSession')) {
                const sessionId = action.match(/'([^']+)'/)[1];
                deleteSession(sessionId);
            } else if (action && action.includes('renameProject')) {
                const projectId = action.match(/'([^']+)'/)[1];
                renameProjectPrompt(projectId);
            } else if (action && action.includes('deleteProject')) {
                const projectId = action.match(/'([^']+)'/)[1];
                deleteProject(projectId);
            }
            return;
        }
        
        // Session/Project selection
        if (target.classList.contains('session-item')) {
            const sessionId = target.dataset.sessionId;
            if (sessionId) switchSession(sessionId);
            return;
        }
        
        if (target.classList.contains('project-item')) {
            const projectId = target.dataset.projectId;
            if (projectId) switchProject(projectId);
            return;
        }
        
        // Icon buttons
        if (target.classList.contains('icon-btn')) {
            const onclick = target.getAttribute('onclick');
            if (onclick === 'createNewSession()') createNewSession();
            else if (onclick === 'createProject()') createProjectPrompt();
            else if (onclick === 'refreshDashboard()') refreshDashboard();
            return;
        }
        
        // Primary buttons
        if (target.classList.contains('primary-btn')) {
            const onclick = target.getAttribute('onclick');
            if (onclick === 'createNewSession()') createNewSession();
            return;
        }
    });

    // Input event listeners
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');
    
    if (messageInput) {
        messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
        
        messageInput.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 150) + 'px';
        });
    }
    
    if (sendButton) {
        sendButton.addEventListener('click', sendMessage);
    }
}

// Core functions
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

function createNewSession() {
    vscode.postMessage({ type: 'createNewSession' });
}

function switchSession(sessionId) {
    vscode.postMessage({ type: 'resumeSession', sessionId: sessionId });
}

function duplicateSession(sessionId) {
    vscode.postMessage({ type: 'duplicateSession', sessionId: sessionId });
}

function renameSessionPrompt(sessionId) {
    const session = appState.sessions.find(s => s.id === sessionId);
    const newName = prompt('Enter new session name:', session?.name || 'Session');
    if (newName && newName.trim()) {
        vscode.postMessage({ type: 'renameSession', sessionId: sessionId, newName: newName.trim() });
    }
}

function deleteSession(sessionId) {
    if (confirm('Are you sure you want to delete this session?')) {
        vscode.postMessage({ type: 'deleteSession', sessionId: sessionId });
    }
}

function createProjectPrompt() {
    const name = prompt('Enter project name:');
    if (name && name.trim()) {
        vscode.postMessage({ type: 'createProject', name: name.trim() });
    }
}

function switchProject(projectId) {
    vscode.postMessage({ type: 'switchProject', projectId: projectId });
}

function renameProjectPrompt(projectId) {
    const project = appState.projects.find(p => p.id === projectId);
    const newName = prompt('Enter new project name:', project?.name || 'Project');
    if (newName && newName.trim()) {
        vscode.postMessage({ type: 'renameProject', projectId: projectId, newName: newName.trim() });
    }
}

function deleteProject(projectId) {
    if (confirm('Are you sure you want to delete this project? All sessions will be deleted.')) {
        vscode.postMessage({ type: 'deleteProject', projectId: projectId });
    }
}

function refreshDashboard() {
    vscode.postMessage({ type: 'refreshTokenUsage' });
    showToast('Dashboard refreshed', 'info');
}

function updateSendButton() {
    const sendButton = document.getElementById('sendButton');
    const sendButtonText = document.getElementById('sendButtonText');
    
    if (!sendButton || !sendButtonText) return;
    
    if (appState.isWaitingForResponse) {
        sendButton.disabled = true;
        sendButtonText.textContent = '⏹ Stop';
        sendButton.onclick = stopGeneration;
    } else {
        sendButton.disabled = false;
        sendButtonText.textContent = '🚀 Send';
        sendButton.onclick = sendMessage;
    }
}

function stopGeneration() {
    vscode.postMessage({ type: 'stopGeneration' });
    appState.isWaitingForResponse = false;
    updateSendButton();
}

function updateUI() {
    updateSendButton();
}

function showToast(message, level = 'info') {
    vscode.postMessage({ type: 'showToast', text: message, level: level });
}

// Message handling from extension
window.addEventListener('message', (event) => {
    const message = event.data;
    
    switch (message.type) {
        case 'updateState':
            appState = { ...appState, ...message.state };
            updateUI();
            break;
        case 'updateSessions':
            appState.sessions = message.sessions;
            renderSessions();
            break;
        case 'updateProjects':
            appState.projects = message.projects;
            renderProjects();
            break;
        case 'updateTokenUsage':
            appState.tokenUsage = message.tokenUsage;
            renderDashboard();
            break;
        case 'updateServerConfig':
            appState.serverConfig = message.config;
            break;
        case 'connectionStatus':
            appState.isConnected = message.status === 'connected';
            break;
        case 'showToast':
            showToast(message.text, message.level);
            break;
    }
});

function renderSessions() {
    const sessionList = document.getElementById('sessionList');
    if (!sessionList) return;
    
    // Re-render is handled by the extension sending updated HTML
    vscode.postMessage({ type: 'renderSessions' });
}

function renderProjects() {
    const projectList = document.getElementById('projectList');
    if (!projectList) return;
    
    vscode.postMessage({ type: 'renderProjects' });
}

function renderDashboard() {
    // Dashboard re-render is handled by extension
    vscode.postMessage({ type: 'renderDashboard' });
}
