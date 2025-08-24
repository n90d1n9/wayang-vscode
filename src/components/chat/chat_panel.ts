import { Uri, Webview } from 'vscode';
import * as fs from "fs";
import * as path from "path";

import { Header } from './Header';
import { StatusBar } from './StatusBar';
import { InputArea } from './InputArea';
import { Messages } from './Messages';
import { SessionsPanel } from './SessionPanel';


export class ChatPanel {
  private webview: Webview;
  private state: any;
   private extensionUri: Uri;



  constructor(webview: Webview, extensionUri: Uri,initialState: any = {}) {
    this.webview = webview;
    this.extensionUri = extensionUri;
    this.state = {
      mode: 'chat',
      messages: [],
      sessions: [],
      isSessionsPanelOpen: false,
      includeContext: true,
      autoApply: false,
      streamingMode: false,
      tokenCount: 0,
      ...initialState
    };
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
    // Extract CSS from your original code
    return `
      * { box-sizing: border-box; }
      body { font-family: var(--vscode-font-family); /* ... rest of styles */ }
      /* All your CSS styles here */
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