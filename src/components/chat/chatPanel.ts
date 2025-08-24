import { Uri, Webview } from 'vscode';
import * as vscode from 'vscode';
import * as fs from "fs";
import * as path from "path";

import { Header } from './header';
import { StatusBar } from './statusBar';
import { InputArea } from './inputArea';
import { Messages } from './messages';
import { SessionsPanel } from './sessionPanel';


export class ChatPanel {
  private webview: Webview;
  private state: any;
   private extensionUri: Uri;


  constructor(webview: vscode.Webview, extensionUri: vscode.Uri, initialState: any = {}) {
        this.webview = webview;
        this.extensionUri = extensionUri;
        this.state = initialState;
    }

  public updateState(newState: any): void {
    this.state = { ...this.state, ...newState };
  }

  public render(): string {
        const scriptUri = this.getWebviewUri('src/scripts/client-script.js');
        
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
                    ${new SessionsPanel().render(this.state)}
                    ${this.getProjectContext()}
                    ${this.getSearchContainer()}
                    ${this.getToolbar()}
                    ${new Messages().render(this.state)}
                    ${new InputArea().render(this.state)}
                    ${new StatusBar().render(this.state)}
                </div>
                
                <script src="${scriptUri}"></script>
            </body>
            </html>`;
    }

  private getWebviewUri(relativePath: string): string {
    const filePath = path.join(this.extensionUri.fsPath, relativePath);
    return this.webview.asWebviewUri(Uri.file(filePath)).toString();
  }


  private getStyles(): string {
        return `
            /* Existing styles... */
            
            /* Memories section styles */
            .memories-section {
                background: linear-gradient(135deg, var(--vscode-editor-inactiveSelectionBackground), var(--vscode-editor-selectionBackground));
                border-radius: 10px;
                padding: 15px;
                margin: 15px;
                border: 1px solid var(--vscode-widget-border);
                box-shadow: 0 3px 6px rgba(0,0,0,0.1);
            }
            
            .memories-header {
                font-size: 0.9em;
                margin-bottom: 12px;
                color: var(--vscode-foreground);
                font-weight: 600;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            
            .memories-list {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            
            .memory-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 8px 12px;
                background-color: var(--vscode-input-background);
                border-radius: 6px;
                border: 1px solid var(--vscode-input-border);
                transition: background-color 0.2s ease;
            }
            
            .memory-item:hover {
                background-color: var(--vscode-inputOption-hoverBackground);
            }
            
            .memory-content {
                font-size: 0.85em;
                color: var(--vscode-foreground);
                flex: 1;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            
            .memory-timestamp {
                font-size: 0.75em;
                color: var(--vscode-descriptionForeground);
                margin-left: 8px;
                white-space: nowrap;
            }
            
            .slide-up {
                animation: slideUp 0.3s ease-out;
            }
            
            @keyframes slideUp {
                from { transform: translateY(20px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
            
            /* Responsive design for memories */
            @media (max-width: 600px) {
                .memory-item {
                    flex-direction: column;
                    align-items: flex-start;
                    gap: 4px;
                }
                
                .memory-timestamp {
                    margin-left: 0;
                    align-self: flex-end;
                }
            }
        `;
    }

  private getProjectContext(): string {
    return `
      <div class="project-context" id="projectContext">
          <span id="contextInfo">Loading project context...</span>
          <button class="context-toggle" onclick="toggleProjectContext()">
              <span id="contextToggle">📋 Hide</span>
          </button>
      </div>`;
  }

  private getSearchContainer(): string {
    return `
      <div class="search-container" id="searchContainer" style="display: none;">
          <input type="text" class="search-input" id="searchInput" 
                 placeholder="Search conversation history..." />
          <div class="search-results" id="searchResults"></div>
      </div>`;
  }

  private getToolbar(): string {
    return `
      <div class="toolbar">
          <div class="toolbar-group">
              <button class="session-btn" onclick="toggleSessions()" title="Manage Sessions">
                  📁 Sessions
              </button>
              <button class="session-btn" onclick="createNewSession()" title="Create New Session">
                  ➕ New
              </button>
              <button class="session-btn" onclick="analyzeProject()" title="Analyze Project">
                  📊 Analyze
              </button>
          </div>
          
          <div class="toolbar-group">
              <button class="clear-button" onclick="clearChat()" title="Clear Current Chat">
                  🗑️ Clear
              </button>
              <button class="export-button" onclick="showExportMenu()" title="Export Conversation">
                  📤 Export
              </button>
              <button class="session-btn" onclick="toggleSearch()" title="Search History">
                  🔍 Search
              </button>
          </div>
          
          <div class="toolbar-group">
              <button class="session-btn" onclick="saveConversation()" title="Save to File">
                  💾 Save
              </button>
              <button class="session-btn" onclick="loadConversation()" title="Load from File">
                  📂 Load
              </button>
              <button class="session-btn" onclick="shareConversation()" title="Share Conversation">
                  🔗 Share
              </button>
          </div>
      </div>`;
  }

  private getScript(): string {
    // Load the external client script
    const scriptPath = path.join(__dirname, '..', 'scripts', 'chat-client.js');
    try {
      return fs.readFileSync(scriptPath, 'utf8');
    } catch (error) {
      console.error('Error loading client script:', error);
      return `
        // Fallback minimal script
        const vscode = acquireVsCodeApi();
        console.log('Chat panel initialized');
      `;
    }
  }
}