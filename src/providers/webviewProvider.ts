import * as vscode from "vscode";
import { AgentClient } from "../clients/agentClient";
import { ChatService } from "../services/chatService";
import { SessionService } from "../services/sessionService";
import { ProjectService } from "../services/projectService";
import { MessageHandler } from "../handlers/messageHandler";
import { LLMService } from "../services/llmService";
import { ChatPanel } from "../components/chat/chatPanel";

export class WayangWebviewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = "wayangChat";
    private _view?: vscode.WebviewView;
    
    private chatService: ChatService;
    private sessionService: SessionService;
    private projectService: ProjectService;
    private llmService: LLMService;
    private messageHandler?: MessageHandler;

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
        const chatPanel = new ChatPanel(webview, this._extensionUri);
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
            this.sessionService.setAllSessions(saved);
        }
    }

    public showMemories(memories: any[]) {
        if (this._view) {
            // Update the state with memories
            this.updateWebviewState({ memories: memories });
        }
    }

    private updateWebviewState(newState: any) {
        // If you have a state management system, update it here
        // Then trigger a re-render or send update message
        if (this._view) {
            this._view.webview.postMessage({
                type: "updateState",
                state: newState
            });
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

    // Add method to handle LLM analysis requests
    public async analyzeProjectWithLLM(): Promise<any> {
        try {
            const analysis = await this.projectService.analyzeProject();
            return analysis;
        } catch (error) {
            console.error("LLM analysis failed:", error);
            throw error;
        }
    }
}