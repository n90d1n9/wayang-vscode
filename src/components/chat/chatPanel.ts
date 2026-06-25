// src/components/chat/chatPanel.ts
import * as vscode from "vscode";
import { Header } from "./Header";
import { StatusBar } from "./StatusBar";
import { InputArea } from "./InputArea";
import { Messages } from "./Messages";
import { SettingsPanel } from "./SettingsPanel";

export class ChatPanel {
  private webview: vscode.Webview;
  private extensionUri: vscode.Uri;
  private state: any;
  
  constructor(webview: vscode.Webview, extensionUri: vscode.Uri, initialState: any = {}) {
    this.webview = webview;
    this.extensionUri = extensionUri;
    this.state = initialState;
  }

  public updateState(newState: any): void {
    this.state = { ...this.state, ...newState };
  }

  public render(): string {
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Wayang Code</title>
            <link rel="stylesheet" href="${this.resourceUri('media', 'style.css')}">
            <link rel="stylesheet" href="${vscode.Uri.joinPath(this.extensionUri, 'node_modules', '@vscode', 'codicons', 'dist', 'codicon.css').toString()}">
        </head>
        <body>
        <div class="app-container">
            ${new Header().render(this.state)}
            
            ${new SettingsPanel().render(this.state)}
            
            <div class="main-content">
                <aside class="sidebar">
                    ${this.renderDashboard()}
                    ${this.renderProjectSection()}
                    ${this.renderSessionsSection()}
                </aside>

                <section class="chat-section">
                    <div class="chat-messages" id="chatMessages">
                        ${new Messages().render(this.state)}
                        ${this.state.isStreaming ? `<div class="typing-indicator"><span class="codicon codicon-loading codicon-modifier-spin"></span> Assistant is thinking...</div>` : ""}
                    </div>
                    <div class="chat-input-container">
                        ${new InputArea().render(this.state)}
                    </div>
                </section>
            </div>

            <footer class="status-bar">
                ${new StatusBar().render(this.state)}
            </footer>
        </div>
        
        <script src="${this.resourceUri('media', 'main.js')}"></script>
        </body>
        </html>
    `;
  }

  private renderDashboard(): string {
    const tokenUsage = this.state.tokenUsage || { input: 0, output: 0, total: 0 };
    const quotaLimit = this.state.quotaLimit || 100000;
    const remaining = quotaLimit - tokenUsage.total;
    const percentage = Math.min((tokenUsage.total / quotaLimit) * 100, 100);
    
    return `
        <div class="dashboard-card">
            <div class="dashboard-header">
                <h3><span class="codicon codicon-graph"></span> Usage Dashboard</h3>
                <button class="icon-btn" onclick="refreshDashboard()" title="Refresh">
                    <span class="codicon codicon-refresh"></span>
                </button>
            </div>
            
            <div class="usage-overview">
                <div class="usage-stat">
                    <div class="stat-icon input">
                        <span class="codicon codicon-arrow-up"></span>
                    </div>
                    <div class="stat-info">
                        <span class="stat-label">Input Tokens</span>
                        <span class="stat-value">${tokenUsage.input.toLocaleString()}</span>
                    </div>
                </div>
                
                <div class="usage-stat">
                    <div class="stat-icon output">
                        <span class="codicon codicon-arrow-down"></span>
                    </div>
                    <div class="stat-info">
                        <span class="stat-label">Output Tokens</span>
                        <span class="stat-value">${tokenUsage.output.toLocaleString()}</span>
                    </div>
                </div>
                
                <div class="usage-stat">
                    <div class="stat-icon total">
                        <span class="codicon codicon-symbol-numeric"></span>
                    </div>
                    <div class="stat-info">
                        <span class="stat-label">Total Tokens</span>
                        <span class="stat-value">${tokenUsage.total.toLocaleString()}</span>
                    </div>
                </div>
            </div>
            
            <div class="quota-meter">
                <div class="quota-header">
                    <span class="quota-label">Quota Usage</span>
                    <span class="quota-text">${tokenUsage.total.toLocaleString()} / ${quotaLimit.toLocaleString()}</span>
                </div>
                <div class="quota-bar">
                    <div class="quota-fill" style="width: ${percentage}%"></div>
                </div>
                <div class="quota-remaining">
                    <span class="codicon codicon-check"></span>
                    <span>${remaining.toLocaleString()} tokens remaining</span>
                </div>
            </div>
            
            <div class="model-info-card">
                <div class="model-badge">
                    <span class="codicon codicon-ai"></span>
                    <span>${this.state.serverConfig?.selectedModel || 'No model selected'}</span>
                </div>
                <div class="server-status">
                    <span class="status-dot ${this.state.isConnected ? 'connected' : 'disconnected'}"></span>
                    <span>${this.state.serverConfig?.serverUrl || 'Not configured'}</span>
                </div>
            </div>
        </div>
    `;
  }

  private renderProjectSection(): string {
    const projects = this.state.projects || [];
    const currentProject = this.state.currentProject;
    
    return `
        <div class="section-card">
            <div class="section-header">
                <h3><span class="codicon codicon-folder"></span> Projects</h3>
                <div class="section-actions">
                    <button class="icon-btn" onclick="createProject()" title="New Project">
                        <span class="codicon codicon-plus"></span>
                    </button>
                </div>
            </div>
            
            <div class="project-list" id="projectList">
                ${projects.length === 0 ? `
                    <div class="empty-state">
                        <span class="codicon codicon-folder-opened"></span>
                        <p>No projects yet</p>
                    </div>
                ` : projects.map((project: any) => `
                    <div class="project-item ${currentProject?.id === project.id ? 'active' : ''}" 
                         data-project-id="${project.id}" 
                         onclick="switchProject('${project.id}')">
                        <div class="project-info">
                            <span class="codicon codicon-folder-active"></span>
                            <span class="project-name">${project.name}</span>
                        </div>
                        <div class="project-meta">
                            <span class="project-sessions">${project.sessionCount || 0} sessions</span>
                            <div class="project-actions">
                                <button class="action-btn" onclick="event.stopPropagation(); renameProject('${project.id}')" title="Rename">
                                    <span class="codicon codicon-pencil"></span>
                                </button>
                                <button class="action-btn danger" onclick="event.stopPropagation(); deleteProject('${project.id}')" title="Delete">
                                    <span class="codicon codicon-trash"></span>
                                </button>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
  }

  private renderSessionsSection(): string {
    const sessions = this.state.sessions || [];
    const currentSession = this.state.currentSession;
    
    return `
        <div class="section-card">
            <div class="section-header">
                <h3><span class="codicon codicon-comment-discussion"></span> Sessions</h3>
                <div class="section-actions">
                    <button class="icon-btn" onclick="createNewSession()" title="New Session">
                        <span class="codicon codicon-plus"></span>
                    </button>
                </div>
            </div>
            
            <div class="session-list" id="sessionList">
                ${sessions.length === 0 ? `
                    <div class="empty-state">
                        <span class="codicon codicon-comment"></span>
                        <p>No sessions yet</p>
                        <button class="primary-btn" onclick="createNewSession()">
                            <span class="codicon codicon-plus"></span> Create Session
                        </button>
                    </div>
                ` : sessions.map((session: any) => `
                    <div class="session-item ${currentSession?.id === session.id ? 'active' : ''}" 
                         data-session-id="${session.id}" 
                         onclick="switchSession('${session.id}')">
                        <div class="session-info">
                            <span class="codicon codicon-comment"></span>
                            <span class="session-name">${session.name}</span>
                        </div>
                        <div class="session-meta">
                            ${session.tokenUsage ? `
                                <span class="token-badge">
                                    <span class="codicon codicon-symbol-numeric"></span>
                                    ${session.tokenUsage.total?.toLocaleString() || 0}
                                </span>
                            ` : ''}
                            <span class="session-time">${this.formatTime(session.updatedAt)}</span>
                        </div>
                        <div class="session-actions">
                            <button class="action-btn" onclick="event.stopPropagation(); duplicateSession('${session.id}')" title="Duplicate">
                                <span class="codicon codicon-copy"></span>
                            </button>
                            <button class="action-btn" onclick="event.stopPropagation(); renameSession('${session.id}')" title="Rename">
                                <span class="codicon codicon-pencil"></span>
                            </button>
                            <button class="action-btn danger" onclick="event.stopPropagation(); deleteSession('${session.id}')" title="Delete">
                                <span class="codicon codicon-trash"></span>
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
  }

  private formatTime(timestamp?: string): string {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  }

  private resourceUri(...segments: string[]): string {
    const uri = vscode.Uri.joinPath(this.extensionUri, ...segments);
    return this.webview.asWebviewUri(uri).toString();
  }
}
