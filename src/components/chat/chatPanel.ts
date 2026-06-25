// src/components/chat/chatPanel.ts
import * as vscode from "vscode";
import { Header } from "./header";
import { StatusBar } from "./statusBar";
import { InputArea } from "./inputArea";
import { Messages } from "./messages";
import { SessionsPanel } from "./sessionPanel";
import { Toolbar } from "./toolbar";
import { getCleanStyles } from "./styles";
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

  // In ChatPanel.render()
// In ChatPanel.render()
public render(): string {
    return `
        <div class="container">
            <header class="header">
                ${new Header().render(this.state)}
            </header>
            
            ${new SettingsPanel().render(this.state)}
            
            <div class="chat-main">
                <aside class="sidebar">
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
                        <h3>Sessions</h3>
                        <button class="session-btn" onclick="createNewSession()" title="New Session">+</button>
                    </div>
                    ${new SessionsPanel().render(this.state)}
                    ${this.getProjectContext()}
                    <div style="margin-top:12px;">
                        ${new Toolbar().render(this.state)}
                    </div>
                </aside>

                <section class="chat-area">
                    <main class="chat-messages" id="chatMessages">
                        ${new Messages().render(this.state)}
                        ${this.state.isStreaming ? `<div class="typing-indicator">Assistant is typing<span class="dots">...</span></div>` : ""}
                    </main>
                    <div class="chat-input">
                        ${new InputArea().render(this.state)}
                    </div>
                </section>
            </div>

            <footer class="status-bar">
                ${new StatusBar().render(this.state)}
            </footer>
        </div>
    `;
}

  // --- helpers ---
  private resourceUri(...segments: string[]): string {
    const uri = vscode.Uri.joinPath(this.extensionUri, ...segments);
    return this.webview.asWebviewUri(uri).toString();
  }

  private getProjectContext(): string {
    return `
      <div class="project-context" id="projectContext">
        <span id="contextInfo">Loading project context...</span>
        <button class="context-toggle" id="contextToggleBtn">
          <span id="contextToggle">📋 Hide</span>
        </button>
      </div>`;
  }
}
