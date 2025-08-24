import * as vscode from 'vscode';
import { ChatService } from '../services/chatService';
import { SessionService } from '../services/sessionService';
import { ProjectService } from '../services/projectService';

export class MessageHandler {
    constructor(
        private chatService: ChatService,
        private sessionService: SessionService,
        private projectService: ProjectService,
        private webviewView: vscode.WebviewView
    ) {}

    async handleMessage(message: any) {
        switch (message.type) {
            case "sendMessage":
                await this.handleSendMessage(message.text, message.mode);
                break;
            case "clearChat":
                this.handleClearChat();
                break;
            case "regenerateResponse":
                this.handleRegenerateResponse();
                break;
            // Add other message types...
        }
    }

    private async handleSendMessage(text: string, mode: string) {
        const context = this.getEnhancedContext();
        try {
            const { taskId, loadingMessageId } = await this.chatService.handleUserMessage(text, mode, context);
            
            // Update webview
            this.updateWebview();
            
        } catch (error) {
            this.handleError(error);
        }
    }

    private handleClearChat() {
        this.chatService.clearChat();
        this.updateWebview();
    }

    private handleRegenerateResponse() {
        // Implementation...
    }

    private getEnhancedContext() {
        return {
            editor: this.getEditorContext(),
            project: this.projectService.getProjectContext(),
            sessionId: this.sessionService.getCurrentSessionId(),
        };
    }

    private getEditorContext() {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) {return {};}

        const document = activeEditor.document;
        const selection = activeEditor.selection;

        return {
            fileName: document.fileName,
            languageId: document.languageId,
            selectedText: selection.isEmpty ? undefined : document.getText(selection),
            cursorPosition: document.offsetAt(activeEditor.selection.active),
        };
    }

    private updateWebview() {
        this.webviewView.webview.postMessage({
            type: "updateChat",
            messages: this.chatService.getChatHistory(),
            sessionId: this.sessionService.getCurrentSessionId(),
            isStreaming: this.chatService.getIsStreaming(),
            projectContext: this.projectService.getProjectContext(),
        });
    }

    private handleError(error: any) {
        // Error handling implementation...
    }
}