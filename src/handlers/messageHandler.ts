import * as vscode from 'vscode';
import { ChatService } from '../services/chatService';
import { SessionService } from '../services/sessionService';
import { ProjectService } from '../services/projectService';
import { isAxiosError } from 'axios';
import { MessageFactory } from '../utils/messageFactory';

export class MessageHandler {
    constructor(
        private chatService: ChatService,
        private sessionService: SessionService,
        private projectService: ProjectService,
        private webviewView: vscode.WebviewView
    ) {}

    async handleMessage(message: any) {
        try {
            switch (message.type) {
                case "sendMessage":
                    await this.handleSendMessage(message.text, message.mode);
                    break;
                case "clearChat":
                    this.handleClearChat();
                    break;
                case "exportChat":
                    await this.handleExportChat(message.format);
                    break;
                case "newSession":
                    await this.handleNewSession();
                    break;
                case "switchSession":
                    await this.handleSwitchSession(message.sessionId);
                    break;
                case "deleteSession":
                    await this.handleDeleteSession(message.sessionId);
                    break;
                case "regenerateResponse":
                    await this.handleRegenerateResponse();
                    break;
                case "stopGeneration":
                    this.handleStopGeneration();
                    break;
                case "toggleStreaming":
                    this.handleToggleStreaming();
                    break;
                case "applyCodeSuggestion":
                    await this.handleApplyCodeSuggestion(message.code, message.file);
                    break;
                case "previewCodeChanges":
                    await this.handlePreviewCodeChanges(message.changes);
                    break;
                case "saveConversation":
                    await this.handleSaveConversation();
                    break;
                case "loadConversation":
                    await this.handleLoadConversation();
                    break;
                case "setAgentMode":
                    this.handleSetAgentMode(message.mode);
                    break;
                case "addCodeSnippet":
                    this.handleAddCodeSnippet(message.code, message.language);
                    break;
                case "shareConversation":
                    await this.handleShareConversation();
                    break;
                case "searchHistory":
                    this.handleSearchHistory(message.query);
                    break;
                case "pinMessage":
                    this.handlePinMessage(message.messageId);
                    break;
                case "editMessage":
                    this.handleEditMessage(message.messageId, message.newContent);
                    break;
                case "updateSetting":
                    this.handleUpdateSetting(message.setting, message.value);
                    break;
                case "getProjectFiles":
                    await this.handleGetProjectFiles();
                    break;
                case "analyzeProject":
                    await this.handleAnalyzeProject();
                    break;
                case "generateTests":
                    await this.handleGenerateTests(message.filePath);
                    break;
                case "optimizeCode":
                    await this.handleOptimizeCode(message.filePath);
                    break;
                case "addToMemory":
                    this.handleAddToMemory(message.content);
                    break;
                default:
                    console.warn("Unknown message type:", message.type);
            }
        } catch (error) {
            this.handleError(error);
        }
    }

    private async handleSendMessage(text: string, mode: string) {
        if (!text.trim()) {return; }

        const context = this.getEnhancedContext();
        try {
            const { taskId, loadingMessageId } = await this.chatService.handleUserMessage(text, mode, context);
            this.updateWebview();
            
        } catch (error) {
            this.handleError(error);
        }
    }

    private handleClearChat() {
        this.chatService.clearChat();
        this.updateWebview();
        this.saveChatHistory();
    }

    private async handleExportChat(format: string) {
        const content = this.formatConversationForExport(format);
        const document = await vscode.workspace.openTextDocument({
            content,
            language: format === "json" ? "json" : "markdown",
        });
        await vscode.window.showTextDocument(document);
    }

    private async handleNewSession() {
        const sessionId = this.sessionService.createNewSession();
        const messages = this.sessionService.switchSession(sessionId);
        this.chatService.setChatHistory(messages);
        this.updateWebview();
        this.updateSessionsList();
        this.sessionService.saveToWorkspace();
    }

    private async handleSwitchSession(sessionId: string) {
        const messages = this.sessionService.switchSession(sessionId);
        this.chatService.setChatHistory(messages);
        this.updateWebview();
        this.updateSessionsList();
    }

    private async handleDeleteSession(sessionId: string) {
        const success = this.sessionService.deleteSession(sessionId);
        if (success) {
            this.updateSessionsList();
            this.sessionService.saveToWorkspace();
            vscode.window.showInformationMessage("Session deleted");
        } else {
            vscode.window.showWarningMessage("Cannot delete the only session");
        }
    }

    private async handleRegenerateResponse() {
        const messages = this.chatService.getChatHistory();
        const lastUserMessage = [...messages].reverse().find(msg => msg.type === "user");
        
        if (lastUserMessage) {
            // Remove last assistant response
            const lastAssistantIndex = [...messages].reverse()
                .findIndex(msg => msg.type === "assistant");
            
            if (lastAssistantIndex !== -1) {
                const actualIndex = messages.length - 1 - lastAssistantIndex;
                messages.splice(actualIndex, 1);
                this.chatService.setChatHistory(messages);
            }
            
            // Resend the last user message
            await this.handleSendMessage(lastUserMessage.content, lastUserMessage.mode || "chat");
        }
    }

    private handleStopGeneration() {
        this.chatService.stopGeneration();
        this.updateWebview();
    }

    private handleToggleStreaming() {
        const isStreaming = this.chatService.getIsStreaming();
        this.chatService.setIsStreaming(!isStreaming);
        vscode.window.showInformationMessage(
            `Streaming ${!isStreaming ? 'enabled' : 'disabled'}`
        );
    }

    private async handleApplyCodeSuggestion(code: string, filePath?: string) {
        try {
            if (filePath) {
                const document = await vscode.workspace.openTextDocument(filePath);
                const edit = new vscode.WorkspaceEdit();
                const fullRange = new vscode.Range(0, 0, document.lineCount, 0);
                edit.replace(document.uri, fullRange, code);
                await vscode.workspace.applyEdit(edit);
            } else {
                const activeEditor = vscode.window.activeTextEditor;
                if (activeEditor) {
                    const selection = activeEditor.selection;
                    await activeEditor.edit(editBuilder => {
                        if (selection.isEmpty) {
                            editBuilder.insert(selection.active, code);
                        } else {
                            editBuilder.replace(selection, code);
                        }
                    });
                }
            }
            
            vscode.window.showInformationMessage("Code applied successfully!");
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to apply code: ${error}`);
        }
    }

    private async handlePreviewCodeChanges(changes: any[]) {
        for (const change of changes) {
            try {
                const originalUri = vscode.Uri.file(change.file);
                const originalDocument = await vscode.workspace.openTextDocument(originalUri);
                
                const tempDocument = await vscode.workspace.openTextDocument({
                    content: change.content,
                    language: originalDocument.languageId,
                });
                
                await vscode.commands.executeCommand(
                    'vscode.diff',
                    originalUri,
                    tempDocument.uri,
                    `${this.getFileName(change.file)} (Preview Changes)`
                );
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to preview ${change.file}: ${error}`);
            }
        }
    }

    private async handleSaveConversation() {
        const content = this.formatConversationForExport("json");
        const uri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file(`wayang-conversation-${Date.now()}.json`),
            filters: { 'JSON files': ['json'] }
        });

        if (uri) {
            await vscode.workspace.fs.writeFile(uri, Buffer.from(content));
            vscode.window.showInformationMessage("Conversation saved successfully!");
        }
    }

    private async handleLoadConversation() {
        const uris = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectMany: false,
            filters: { 'JSON files': ['json'] }
        });

        if (uris && uris[0]) {
            try {
                const content = await vscode.workspace.fs.readFile(uris[0]);
                const data = JSON.parse(content.toString());
                
                if (data.messages && Array.isArray(data.messages)) {
                    this.chatService.setChatHistory(data.messages);
                    this.updateWebview();
                    vscode.window.showInformationMessage("Conversation loaded successfully!");
                }
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to load conversation: ${error}`);
            }
        }
    }

    private handleSetAgentMode(mode: string) {
        this.webviewView.webview.postMessage({
            type: "modeChanged",
            mode: mode,
        });
    }

    private handleAddCodeSnippet(code: string, language: string) {
    const content = `\`\`\`${language}\n${code}\n\`\`\`\n\nPlease analyze this code snippet.`;
    const snippetMessage = MessageFactory.createUserMessage(content, "code");
    this.chatService.getChatHistory().push(snippetMessage);
    this.updateWebview();
    this.saveChatHistory();
}

    private async handleShareConversation() {
        const content = this.formatConversationForExport("markdown");
        const tempDocument = await vscode.workspace.openTextDocument({
            content,
            language: "markdown",
        });
        await vscode.window.showTextDocument(tempDocument);
    }

    private handleSearchHistory(query: string) {
        const results = this.chatService.getChatHistory().filter(msg => 
            msg.content.toLowerCase().includes(query.toLowerCase())
        );

        this.webviewView.webview.postMessage({
            type: "searchResults",
            results: results,
            query: query,
        });
    }

    private handlePinMessage(messageId: string) {
        const messages = this.chatService.getChatHistory();
        const messageIndex = messages.findIndex(msg => msg.id === messageId);
        if (messageIndex !== -1) {
            messages[messageIndex].pinned = !messages[messageIndex].pinned;
            this.updateWebview();
            this.saveChatHistory();
        }
    }

    private handleEditMessage(messageId: string, newContent: string) {
        const messages = this.chatService.getChatHistory();
        const messageIndex = messages.findIndex(msg => msg.id === messageId);
        if (messageIndex !== -1) {
            messages[messageIndex].content = newContent;
            messages[messageIndex].edited = true;
            this.updateWebview();
            this.saveChatHistory();
        }
    }

    private handleUpdateSetting(setting: string, value: any) {
        vscode.workspace.getConfiguration("wayang").update(
            setting,
            value,
            vscode.ConfigurationTarget.Workspace
        );
    }

    private async handleGetProjectFiles() {
        try {
            const files = await vscode.workspace.findFiles("**/*.{js,ts,java,py,go,rs,php,cs}", "**/node_modules/**", 100);
            const fileList = files.map(uri => ({
                path: vscode.workspace.asRelativePath(uri),
                name: this.getFileName(uri.fsPath),
                type: this.getFileExtension(uri.fsPath),
            }));

            this.webviewView.webview.postMessage({
                type: "projectFiles",
                files: fileList,
            });
        } catch (error) {
            console.error("Error getting project files:", error);
        }
    }

    private async handleAnalyzeProject() {
    try {
        const analysis = await this.projectService.analyzeProject();
        const content = this.formatProjectAnalysis(analysis);
        const analysisMessage = MessageFactory.createAssistantMessage(content, undefined, {
            analysis: analysis
        });
        
        this.chatService.getChatHistory().push(analysisMessage);
        this.updateWebview();
        this.saveChatHistory();
    } catch (error) {
        this.handleError(error);
    }
}

    private async handleGenerateTests(filePath: string) {
        // Implementation for test generation
        vscode.window.showInformationMessage(`Generating tests for ${filePath}`);
    }

    private async handleOptimizeCode(filePath: string) {
        // Implementation for code optimization
        vscode.window.showInformationMessage(`Optimizing code for ${filePath}`);
    }

    private handleAddToMemory(content: string) {
        // Implementation for adding to memory
        vscode.window.showInformationMessage("Added to memory");
    }

    private getEnhancedContext() {
        return {
            editor: this.getEditorContext(),
            project: this.projectService.getProjectContext(),
            sessionId: this.sessionService.getCurrentSessionId(),
            recentHistory: this.getRecentHistory(5),
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
            lineCount: document.lineCount,
            isDirty: document.isDirty,
        };
    }

    private getRecentHistory(count: number): any[] {
        return this.chatService.getChatHistory().slice(-count * 2);
    }

    private formatConversationForExport(format: string): string {
        const messages = this.chatService.getChatHistory();
        
        if (format === "json") {
            return JSON.stringify({
                sessionId: this.sessionService.getCurrentSessionId(),
                timestamp: new Date().toISOString(),
                messages: messages,
                projectContext: this.projectService.getProjectContext(),
            }, null, 2);
        }

        // Markdown format
        const header = `# Wayang Code Conversation\n\n**Session:** ${this.sessionService.getCurrentSessionId()}\n**Date:** ${new Date().toLocaleString()}\n\n---\n\n`;
        
        const messageContent = messages
            .map((msg) => {
                const role = msg.type === "user" ? "👤 **You**" : "🤖 **Wayang Code**";
                const timestamp = msg.timestamp.toLocaleString();
                const pinned = msg.pinned ? " 📌" : "";
                const edited = msg.edited ? " ✏️" : "";
                const mode = msg.mode ? ` (${msg.mode} mode)` : "";
                
                return `## ${role}${pinned}${edited}${mode}\n*${timestamp}*\n\n${msg.content}\n\n---\n`;
            })
            .join("\n");

        return header + messageContent;
    }

    private formatProjectAnalysis(analysis: any): string {
    let content = "## 📊 Project Analysis\n\n";
    
    content += `**Total Files:** ${analysis.totalFiles}\n\n`;
    
    if (analysis.languages && analysis.languages.size > 0) {
    content += "**Languages Distribution:**\n";
    // Fix: Explicitly type the array created by Array.from
    Array.from(analysis.languages.entries() as Iterable<[string, number]>).forEach(([lang, count]) => {
      content += `- ${lang.toUpperCase()}: ${count} files\n`;
    });
    content += "\n";
  }
    
    if (analysis.frameworks && analysis.frameworks.length > 0) {
        content += "**Frameworks & Libraries:**\n";
        analysis.frameworks.forEach((framework: string) => {
            content += `- ${framework}\n`;
        });
        content += "\n";
    }
    
    if (analysis.buildTools && analysis.buildTools.length > 0) {
        content += "**Build Tools & Package Managers:**\n";
        analysis.buildTools.forEach((tool: string) => {
            content += `- ${tool}\n`;
        });
        content += "\n";
    }
    
    content += `**Code Quality Score:** ${analysis.codeQuality}/10\n`;
    content += `**Complexity Score:** ${analysis.complexity}/10\n\n`;
    
    content += `**Has Tests:** ${analysis.hasTests ? '✅ Yes' : '❌ No'}\n`;
    content += `**Has Documentation:** ${analysis.hasDocumentation ? '✅ Yes' : '❌ No'}\n`;

    return content;
}

    private getFileName(filePath: string): string {
        return require('path').basename(filePath);
    }

    private getFileExtension(filePath: string): string {
        return require('path').extname(filePath).substring(1);
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

    private updateSessionsList() {
        this.webviewView.webview.postMessage({
            type: "updateSessions",
            sessions: this.sessionService.getSessionList(),
        });
    }

    private saveChatHistory() {
        vscode.workspace.getConfiguration("wayang").update(
            "chatHistory",
            this.chatService.getChatHistory(),
            vscode.ConfigurationTarget.Workspace,
        );
    }

    private handleError(error: any) {
    const errorMsg = MessageFactory.createErrorMessage(error);
    this.chatService.getChatHistory().push(errorMsg);
    this.updateWebview();
    this.saveChatHistory();
}
}