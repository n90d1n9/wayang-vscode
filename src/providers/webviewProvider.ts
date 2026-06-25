import * as vscode from "vscode";
import { AgentClient } from "../clients/agentClient";
import { ChatService } from "../services/chatService";
import { SessionService } from "../services/sessionService";
import { ProjectService } from "../services/projectService";
import { LLMService } from "../services/llmService";
import { ChatPanel } from "../components/chat/chatPanel";
import { MessageHandler } from "../handlers/messageHandler";
import { WebviewState } from "../types/chatTypes";

export class WayangWebviewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = "wayangChat";

    private _view?: vscode.WebviewView;
    private chatPanel?: ChatPanel;
    private messageHandler?: MessageHandler;

    private chatService: ChatService;
    private sessionService: SessionService;
    private projectService: ProjectService;
    private llmService: LLMService;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly agentClient: AgentClient,
    ) {
        this.chatService = new ChatService(agentClient);
        this.sessionService = new SessionService();
        this.llmService = new LLMService(agentClient);
        this.projectService = new ProjectService(this.llmService);
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        try {
            console.log("Resolving webview view...");
            this._view = webviewView;

            webviewView.webview.options = {
                enableScripts: true,
                localResourceRoots: [this._extensionUri],
            };

            console.log("Creating chat panel...");
            this.chatPanel = new ChatPanel(
                webviewView.webview,
                this._extensionUri,
                {
                    chatHistory: this.chatService.getChatHistory(),
                    sessionId: this.sessionService.getCurrentSessionId(),
                    projectContext: this.projectService.getProjectContext(),
                },
            );

            

            console.log("Setting webview HTML...");
            webviewView.webview.html = this._getHtmlForWebview(
                webviewView.webview,
            );

            // Add error handling for stream callback
            this.chatService.setStreamCallback((chatHistory) => {
                try {
                    this.chatPanel?.updateState({
                        chatHistory,
                        isStreaming: !!this.chatService
                            .getCurrentStreamMessageId(),
                    });

                    this.chatPanel?.updateState({ chatHistory });
                    this._view?.webview.postMessage({
                        type: "updateChatHTML",
                        html: this.chatPanel?.render(),
                    });
                } catch (error) {
                    console.error("Error in stream callback:", error);
                }
            });

            /* webviewView.webview.onDidReceiveMessage(async (message) => {
            try {
                switch (message.type) {
                    case "userMessage":
                        await this.chatService.askAgent(message.text, "chat", {});
                        break;

                    case "analyzeProject":
                        const analysis = await this.projectService.analyzeProject();
                        this.chatPanel?.updateState({ projectAnalysis: analysis });
                        this._view?.webview.postMessage({
                            type: "updateChatHTML",
                            html: this.chatPanel?.render(),
                        });
                        break;

                    default:
                        this.messageHandler?.handleMessage(message);
                }
            } catch (error) {
                console.error("Error handling message:", error);
                this._view?.webview.postMessage({
                    type: "error",
                    message: "An error occurred: " + (error instanceof Error ? error.message : String(error))
                });
            }
        }); */

            // In your webview provider's message handler
            webviewView.webview.onDidReceiveMessage(async (message) => {
                try {
                    switch (message.type) {
                        case "webviewReady":
                            console.log("Webview is ready");
                            // Send initial state
                            this._view?.webview.postMessage({
                                type: "updateState",
                                state: {
                                    sessions: this.sessionService
                                        .getAllSessions(),
                                    currentSessionId: this.sessionService
                                        .getCurrentSessionId(),
                                    projectContext: this.projectService
                                        .getProjectContext(),
                                    // ... other initial state
                                },
                            });
                            break;

                        case "sendMessage":
                            await this.chatService.askAgent(
                                message.text,
                                message.mode,
                                {},
                            );
                            break;

                        case "setMode":
                            // Handle mode change
                            break;

                        case "toggleSessions":
                            // Handle sessions panel toggle
                            const isOpen = !this.state.isSessionsPanelOpen;
                            this._view?.webview.postMessage({
                                type: "toggleSessions",
                                isOpen: isOpen,
                            });
                            break;

                        case "createNewSession":
                            const newSession = this.sessionService
                                .createNewSession();
                            this._view?.webview.postMessage({
                                type: "updateSessions",
                                sessions: this.sessionService.getAllSessions(),
                            });
                            break;

                        // Add other cases for the new message types
                        default:
                            console.log("Unknown message type:", message.type);
                    }
                } catch (error) {
                    console.error("Error handling message:", error);
                    this._view?.webview.postMessage({
                        type: "showToast",
                        text: "Error: " +
                            (error instanceof Error
                                ? error.message
                                : String(error)),
                        level: "error",
                    });
                }
            });
        } catch (error) {
            console.error("Error resolving webview:", error);
            webviewView.webview.html = `
            <!DOCTYPE html>
            <html>
            <body>
                <div style="padding: 20px; color: red;">
                    <h3>Error loading Wayang Chat</h3>
                    <p>${(error instanceof Error
                ? error.message
                : String(error))}</p>
                    <button onclick="location.reload()">Reload</button>
                </div>
            </body>
            </html>
        `;
        }
    }

    private state: WebviewState = {
        isSessionsPanelOpen: false,
        currentMode: 'chat',
        sessions: [],
        projectContext: {},
        chatHistory: []
    };

    private _getHtmlForWebview(webview: vscode.Webview): string {
        const styleUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, "media", "style.css"),
        );
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, "media", "main.js"),
        );
        const nonce = this.getNonce();

        return /*html*/ `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Security-Policy"
            content="default-src 'none';
                     img-src ${webview.cspSource} https:;
                     script-src 'nonce-${nonce}' ${webview.cspSource} 'unsafe-eval';
                     style-src ${webview.cspSource} 'unsafe-inline';
                     font-src ${webview.cspSource};
                     connect-src ${webview.cspSource};">
        <link rel="stylesheet" href="${styleUri}">
        <title>Wayang Chat</title>
    </head>
    <body>
        <div id="app">${
            this.chatPanel?.render() ?? "<div>Loading...</div>"
        }</div>
        <script nonce="${nonce}" src="${scriptUri}"></script>
    </body>
    </html>
    `;
    }

    private getNonce(): string {
        let text = "";
        const possible =
            "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(
                Math.floor(Math.random() * possible.length),
            );
        }
        return text;
    }

    private loadInitialState() {
        this.loadChatSessions();
        this.loadChatHistory();
        this.updateWebview();
    }

    private loadChatHistory() {
        const saved = vscode.workspace
            .getConfiguration("wayang")
            .get("chatHistory", []);
        this.chatService.setChatHistory(Array.isArray(saved) ? saved : []);
        this.chatPanel?.updateState({
            chatHistory: this.chatService.getChatHistory(),
        });
    }

    private loadChatSessions() {
        const saved = vscode.workspace
            .getConfiguration("wayang")
            .get("chatSessions", {});
        if (typeof saved === "object" && saved !== null) {
            this.sessionService.setAllSessions(saved);
        }
    }

    private updateWebview() {
        if (this._view && this.chatPanel) {
            // Send new HTML snapshot to the webview
            this._view.webview.postMessage({
                type: "updateHTML",
                html: this.chatPanel.render(),
            });
        }
    }

    // Expose public methods for external updates
    public refreshProjectContext() {
        this.projectService.updateProjectContext();
        this.chatPanel?.updateState({
            projectContext: this.projectService.getProjectContext(),
        });
        this.updateWebview();
    }

    public addMessage(message: any) {
        this.chatService.getChatHistory().push(message);
        this.chatPanel?.updateState({
            chatHistory: this.chatService.getChatHistory(),
        });
        this.updateWebview();
    }
}
