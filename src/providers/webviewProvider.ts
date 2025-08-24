import * as vscode from "vscode";
import { AgentClient } from "../clients/agentClient";
import { ChatService } from "../services/chatService";
import { SessionService } from "../services/sessionService";
import { ProjectService } from "../services/projectService";
import { MessageHandler } from "../handlers/messageHandler";
import { ChatPanel } from "../components/chat/chat_panel";

export class WayangWebviewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = "wayangChat";
    private _view?: vscode.WebviewView;
    
    private chatService: ChatService;
    private sessionService: SessionService;
    private projectService: ProjectService;
    private messageHandler?: MessageHandler;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly agentClient: AgentClient,
    ) {
        this.chatService = new ChatService(agentClient);
        this.sessionService = new SessionService();
        this.projectService = new ProjectService();
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;
        this.messageHandler = new MessageHandler(
            this.chatService,
            this.sessionService,
            this.projectService,
            webviewView
        );

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri],
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(
            (message) => {
                this.messageHandler?.handleMessage(message);
            },
            undefined,
            [],
        );

        // Load initial state
        this.loadInitialState();
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        const chatPanel = new ChatPanel(webview);
        return chatPanel.render();
    }

    private loadInitialState() {
        this.loadChatSessions();
        this.loadChatHistory();
        this.updateSessionsList();
    }

    private loadChatHistory() {
        const saved = vscode.workspace.getConfiguration("wayang").get("chatHistory", []);
        this.chatService.setChatHistory(Array.isArray(saved) ? saved : []);
        this.updateWebview();
    }

    private loadChatSessions() {
        const saved = vscode.workspace.getConfiguration("wayang").get("chatSessions", {});
        if (typeof saved === "object" && saved !== null) {
            // Convert saved object back to Map
            const sessionsMap = new Map(Object.entries(saved));
            // You'll need to add a method to SessionService to set all sessions
        }
    }

    private updateWebview() {
        if (this._view) {
            this._view.webview.postMessage({
                type: "updateChat",
                messages: this.chatService.getChatHistory(),
                sessionId: this.sessionService.getCurrentSessionId(),
                isStreaming: this.chatService.getIsStreaming(),
                projectContext: this.projectService.getProjectContext(),
            });
        }
    }

    private updateSessionsList() {
        if (this._view) {
            this._view.webview.postMessage({
                type: "updateSessions",
                sessions: this.sessionService.getSessionList(),
            });
        }
    }

    // Public methods for external integration
    public addMessage(message: any) {
        this.chatService.getChatHistory().push(message);
        this.updateWebview();
    }

    public getCurrentSession(): string {
        return this.sessionService.getCurrentSessionId();
    }

    public getProjectContext() {
        return this.projectService.getProjectContext();
    }

    public refreshProjectContext() {
        this.projectService.updateProjectContext();
        this.updateWebview();
    }
}