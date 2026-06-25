

interface ChatMessage {
    id: string;
    type: "user" | "assistant";
    content: string;
    timestamp: Date;
    loading?: boolean;
    error?: boolean;
    mode?: string;
    context?: any;
    codeChanges?: any[];
    codeSuggestions?: any[];
    analysis?: any;
    toolUse?: any;
    confidence?: number;
    sources?: string[];
    pinned?: boolean;
    edited?: boolean;
    system?: boolean;
}

interface ProjectContext {
    workspacePath?: string;
    projectType?: string;
    dependencies?: string[];
    gitBranch?: string;
    recentFiles?: string[];
    openTabs?: string[];
}import * as vscode from "vscode";
import { AgentClient } from "../clients/agentClient";
import { isAxiosError } from "axios";
import * as fs from "fs";
import * as path from "path";

export class WayangWebviewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = "wayangChat";
    private _view?: vscode.WebviewView;
    private chatHistory: ChatMessage[] = [];
    private isStreaming: boolean = false;
    private currentStreamMessageId?: string;
    private chatSessions: Map<string, ChatMessage[]> = new Map();
    private currentSessionId: string = "default";
    private projectContext: ProjectContext = {};

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly agentClient: AgentClient,
    ) {
        this.initializeProjectContext();
        this.setupFileWatcher();
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri],
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(
            (message) => {
                switch (message.type) {
                    case "sendMessage":
                        this.handleUserMessage(message.text, message.mode);
                        break;
                    case "clearChat":
                        this.clearChat();
                        break;
                    case "exportChat":
                        this.exportChat(message.format);
                        break;
                    case "newSession":
                        this.createNewSession();
                        break;
                    case "switchSession":
                        this.switchSession(message.sessionId);
                        break;
                    case "deleteSession":
                        this.deleteSession(message.sessionId);
                        break;
                    case "regenerateResponse":
                        this.regenerateLastResponse();
                        break;
                    case "stopGeneration":
                        this.stopGeneration();
                        break;
                    case "toggleStreaming":
                        this.toggleStreaming();
                        break;
                    case "applyCodeSuggestion":
                        this.applyCodeSuggestion(message.code, message.file);
                        break;
                    case "previewCodeChanges":
                        this.previewCodeChanges(message.changes);
                        break;
                    case "saveConversation":
                        this.saveConversationToFile();
                        break;
                    case "loadConversation":
                        this.loadConversationFromFile();
                        break;
                    case "setAgentMode":
                        this.setAgentMode(message.mode);
                        break;
                    case "addCodeSnippet":
                        this.addCodeSnippetToMessage(message.code, message.language);
                        break;
                    case "shareConversation":
                        this.shareConversation();
                        break;
                    case "searchHistory":
                        this.searchHistory(message.query);
                        break;
                    case "pinMessage":
                        this.pinMessage(message.messageId);
                        break;
                    case "editMessage":
                        this.editMessage(message.messageId, message.newContent);
                        break;
                    case "updateSetting":
                        this.updateSetting(message.setting, message.value);
                        break;
                    case "getProjectFiles":
                        this.getProjectFiles();
                        break;
                    case "analyzeProject":
                        this.analyzeProject();
                        break;
                    case "generateTests":
                        this.generateTests(message.filePath);
                        break;
                    case "optimizeCode":
                        this.optimizeCode(message.filePath);
                        break;
                    case "addToMemory":
                        this.addToMemory(message.content);
                        break;
                }
            },
            undefined,
            [],
        );

        // Load chat history and sessions
        this.loadChatSessions();
        this.loadChatHistory();
        this.updateSessionsList();
    }

    private async handleUserMessage(message: string, mode: string = "chat") {
        if (!this._view || !message.trim()) return;

        // Add user message to chat
        const userMessage: ChatMessage = {
            id: Date.now().toString(),
            type: "user",
            content: message,
            timestamp: new Date(),
            mode: mode,
            context: this.getEnhancedContext(),
        };

        this.chatHistory.push(userMessage);
        this.updateWebview();

        try {
            // Create agent request with enhanced context
            const taskId = await this.agentClient.sendQuery({
                id: userMessage.id,
                query: message,
                context: {
                    ...this.getEditorContext(),
                    projectContext: this.projectContext,
                    mode: mode,
                    chatHistory: this.getRecentHistory(5),
                    sessionId: this.currentSessionId,
                },
                streaming: this.isStreaming,
            });

            // Add loading message
            const loadingMessage: ChatMessage = {
                id: `loading_${taskId}`,
                type: "assistant",
                content: this.getLoadingMessage(mode),
                timestamp: new Date(),
                loading: true,
                mode: mode,
            };

            this.chatHistory.push(loadingMessage);
            this.updateWebview();
            this.currentStreamMessageId = loadingMessage.id;

            // Listen for response (streaming or regular)
            if (this.isStreaming) {
                this.agentClient.onTaskStream(taskId, (chunk) => {
                    this.handleStreamChunk(loadingMessage.id, chunk);
                });
            }

            this.agentClient.onTaskUpdate(taskId, (response) => {
                this.handleAgentResponse(loadingMessage.id, response);
            });
        } catch (error) {
            this.handleError(error);
        }
    }

    private getLoadingMessage(mode: string): string {
        const messages = {
            chat: "Thinking...",
            code: "Analyzing code...",
            review: "Reviewing code...",
            test: "Generating tests...",
        };
        return messages[mode] || "Processing...";
    }

    private handleStreamChunk(messageId: string, chunk: any) {
        const messageIndex = this.chatHistory.findIndex((msg) => msg.id === messageId);
        
        if (messageIndex !== -1) {
            const currentMessage = this.chatHistory[messageIndex];
            
            if (chunk.type === "content") {
                if (currentMessage.loading) {
                    currentMessage.content = chunk.data;
                    currentMessage.loading = false;
                } else {
                    currentMessage.content += chunk.data;
                }
            } else if (chunk.type === "tool_use") {
                currentMessage.toolUse = chunk.data;
            } else if (chunk.type === "code_suggestion") {
                currentMessage.codeSuggestions = [
                    ...(currentMessage.codeSuggestions || []),
                    chunk.data
                ];
            }

            this.updateWebview();
        }
    }

    private handleAgentResponse(loadingMessageId: string, response: any) {
        const loadingIndex = this.chatHistory.findIndex((msg) =>
            msg.id === loadingMessageId
        );

        if (loadingIndex !== -1) {
            const responseMessage: ChatMessage = {
                ...this.chatHistory[loadingIndex],
                content: this.formatAgentResponse(response),
                loading: false,
                error: response.status === "error",
                codeChanges: response.data?.codeChanges,
                codeSuggestions: response.data?.codeSuggestions,
                analysis: response.data?.analysis,
                toolUse: response.data?.toolUse,
                confidence: response.confidence,
                sources: response.sources,
            };

            this.chatHistory[loadingIndex] = responseMessage;
            this.updateWebview();
            this.currentStreamMessageId = undefined;

            // Auto-apply code changes if enabled
            if (response.data?.codeChanges && this.shouldAutoApply()) {
                this.previewCodeChanges(response.data.codeChanges);
            }
        }
    }

    private formatAgentResponse(response: any): string {
        let content = response.message || "Task completed";

        // Add confidence indicator
        if (response.confidence) {
            const confidenceEmoji = response.confidence > 0.8 ? "🟢" : 
                                   response.confidence > 0.6 ? "🟡" : "🔴";
            content = `${confidenceEmoji} (${Math.round(response.confidence * 100)}% confidence)\n\n${content}`;
        }

        if (response.data) {
            if (response.data.codeChanges) {
                content += "\n\n**📝 Code Changes:**";
                response.data.codeChanges.forEach((change: any, index: number) => {
                    content += `\n\n${index + 1}. **${change.file}** (${change.type || 'modify'})`;
                    content += `\n```${change.language || "text"}\n${change.content}\n````;
                    if (change.explanation) {
                        content += `\n*${change.explanation}*`;
                    }
                });
            }

            if (response.data.analysis) {
                content += "\n\n**📊 Analysis Results:**";
                content += `\n${response.data.analysis.summary}`;
                
                if (response.data.analysis.metrics) {
                    content += "\n\n**Metrics:**";
                    Object.entries(response.data.analysis.metrics).forEach(([key, value]) => {
                        content += `\n- ${key}: ${value}`;
                    });
                }
            }

            if (response.data.explanation) {
                content += "\n\n**💡 Explanation:**";
                content += `\n${response.data.explanation.summary}`;
            }

            if (response.data.suggestions) {
                content += "\n\n**💭 Suggestions:**";
                response.data.suggestions.forEach((suggestion: string, index: number) => {
                    content += `\n${index + 1}. ${suggestion}`;
                });
            }

            if (response.data.tests) {
                content += "\n\n**🧪 Generated Tests:**";
                response.data.tests.forEach((test: any, index: number) => {
                    content += `\n\n**Test ${index + 1}: ${test.name}**`;
                    content += `\n```${test.language}\n${test.code}\n````;
                });
            }
        }

        // Add sources if available
        if (response.sources && response.sources.length > 0) {
            content += "\n\n**📚 Sources:**";
            response.sources.forEach((source: string, index: number) => {
                content += `\n${index + 1}. ${source}`;
            });
        }

        return content;
    }

    private createNewSession() {
        const sessionId = `session_${Date.now()}`;
        this.chatSessions.set(sessionId, []);
        this.switchSession(sessionId);
        this.updateSessionsList();
    }

    private switchSession(sessionId: string) {
        // Save current session
        this.chatSessions.set(this.currentSessionId, [...this.chatHistory]);
        
        // Switch to new session
        this.currentSessionId = sessionId;
        this.chatHistory = this.chatSessions.get(sessionId) || [];
        
        this.updateWebview();
        this.saveChatSessions();
    }

    private deleteSession(sessionId: string) {
        if (this.chatSessions.size > 1 && sessionId !== "default") {
            this.chatSessions.delete(sessionId);
            
            if (this.currentSessionId === sessionId) {
                this.currentSessionId = "default";
                this.chatHistory = this.chatSessions.get("default") || [];
                this.updateWebview();
            }
            
            this.updateSessionsList();
            this.saveChatSessions();
        }
    }

    private regenerateLastResponse() {
        const lastUserMessage = [...this.chatHistory].reverse()
            .find(msg => msg.type === "user");
        
        if (lastUserMessage) {
            // Remove last assistant response
            const lastAssistantIndex = [...this.chatHistory].reverse()
                .findIndex(msg => msg.type === "assistant");
            
            if (lastAssistantIndex !== -1) {
                const actualIndex = this.chatHistory.length - 1 - lastAssistantIndex;
                this.chatHistory.splice(actualIndex, 1);
            }
            
            // Resend the last user message
            this.handleUserMessage(lastUserMessage.content, lastUserMessage.mode);
        }
    }

    private stopGeneration() {
        if (this.currentStreamMessageId) {
            // Stop the streaming
            this.agentClient.cancelTask(this.currentStreamMessageId);
            
            // Update the loading message
            const messageIndex = this.chatHistory.findIndex(
                msg => msg.id === this.currentStreamMessageId
            );
            
            if (messageIndex !== -1) {
                this.chatHistory[messageIndex] = {
                    ...this.chatHistory[messageIndex],
                    content: this.chatHistory[messageIndex].content + "\n\n*Generation stopped by user*",
                    loading: false,
                };
                this.updateWebview();
            }
            
            this.currentStreamMessageId = undefined;
        }
    }

    private toggleStreaming() {
        this.isStreaming = !this.isStreaming;
        vscode.window.showInformationMessage(
            `Streaming ${this.isStreaming ? 'enabled' : 'disabled'}`
        );
    }

    private async applyCodeSuggestion(code: string, filePath?: string) {
        try {
            if (filePath) {
                // Apply to specific file
                const document = await vscode.workspace.openTextDocument(filePath);
                const edit = new vscode.WorkspaceEdit();
                const fullRange = new vscode.Range(0, 0, document.lineCount, 0);
                edit.replace(document.uri, fullRange, code);
                await vscode.workspace.applyEdit(edit);
            } else {
                // Apply to active editor
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

    private async previewCodeChanges(changes: any[]) {
        // Create a diff view for each change
        for (const change of changes) {
            try {
                const originalUri = vscode.Uri.file(change.file);
                const originalDocument = await vscode.workspace.openTextDocument(originalUri);
                
                // Create temporary document with changes
                const tempDocument = await vscode.workspace.openTextDocument({
                    content: change.content,
                    language: originalDocument.languageId,
                });
                
                // Show diff
                await vscode.commands.executeCommand(
                    'vscode.diff',
                    originalUri,
                    tempDocument.uri,
                    `${path.basename(change.file)} (Preview Changes)`
                );
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to preview ${change.file}: ${error}`);
            }
        }
    }

    private async saveConversationToFile() {
        const content = this.formatConversationForExport("json");
        const uri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file(`wayang-conversation-${Date.now()}.json`),
            filters: {
                'JSON files': ['json'],
                'Markdown files': ['md'],
                'Text files': ['txt']
            }
        });

        if (uri) {
            await vscode.workspace.fs.writeFile(uri, Buffer.from(content));
            vscode.window.showInformationMessage("Conversation saved successfully!");
        }
    }

    private async loadConversationFromFile() {
        const uris = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectMany: false,
            filters: {
                'JSON files': ['json']
            }
        });

        if (uris && uris[0]) {
            try {
                const content = await vscode.workspace.fs.readFile(uris[0]);
                const data = JSON.parse(content.toString());
                
                if (data.messages && Array.isArray(data.messages)) {
                    this.chatHistory = data.messages;
                    this.updateWebview();
                    vscode.window.showInformationMessage("Conversation loaded successfully!");
                }
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to load conversation: ${error}`);
            }
        }
    }

    private setAgentMode(mode: string) {
        if (this._view) {
            this._view.webview.postMessage({
                type: "modeChanged",
                mode: mode,
            });
        }
    }

    private addCodeSnippetToMessage(code: string, language: string) {
        const snippetMessage: ChatMessage = {
            id: Date.now().toString(),
            type: "user",
            content: ````${language}\n${code}\n```\n\nPlease analyze this code snippet.`,
            timestamp: new Date(),
            mode: "code",
        };

        this.chatHistory.push(snippetMessage);
        this.updateWebview();
    }

    private async shareConversation() {
        const content = this.formatConversationForExport("markdown");
        const tempDocument = await vscode.workspace.openTextDocument({
            content,
            language: "markdown",
        });

        await vscode.window.showTextDocument(tempDocument);
    }

    private searchHistory(query: string) {
        const results = this.chatHistory.filter(msg => 
            msg.content.toLowerCase().includes(query.toLowerCase())
        );

        if (this._view) {
            this._view.webview.postMessage({
                type: "searchResults",
                results: results,
                query: query,
            });
        }
    }

    private pinMessage(messageId: string) {
        const messageIndex = this.chatHistory.findIndex(msg => msg.id === messageId);
        if (messageIndex !== -1) {
            this.chatHistory[messageIndex].pinned = !this.chatHistory[messageIndex].pinned;
            this.updateWebview();
            this.saveChatHistory();
        }
    }

    private editMessage(messageId: string, newContent: string) {
        const messageIndex = this.chatHistory.findIndex(msg => msg.id === messageId);
        if (messageIndex !== -1) {
            this.chatHistory[messageIndex].content = newContent;
            this.chatHistory[messageIndex].edited = true;
            this.updateWebview();
            this.saveChatHistory();
        }
    }

    private updateSetting(setting: string, value: any) {
        vscode.workspace.getConfiguration("wayang").update(
            setting,
            value,
            vscode.ConfigurationTarget.Workspace
        );
    }

    private async getProjectFiles() {
        try {
            const files = await vscode.workspace.findFiles("**/*.{js,ts,java,py,go,rs,php,cs}", "**/node_modules/**", 100);
            const fileList = files.map(uri => ({
                path: vscode.workspace.asRelativePath(uri),
                name: path.basename(uri.fsPath),
                type: path.extname(uri.fsPath).substring(1),
            }));

            if (this._view) {
                this._view.webview.postMessage({
                    type: "projectFiles",
                    files: fileList,
                });
            }
        } catch (error) {
            console.error("Error getting project files:", error);
        }
    }

    private async analyzeProject() {
        try {
            const analysis = {
                totalFiles: 0,
                languages: new Map<string, number>(),
                complexity: 0,
                codeQuality: 0,
            };

            const files = await vscode.workspace.findFiles("**/*.{js,ts,java,py,go,rs,php,cs}", "**/node_modules/**", 50);
            analysis.totalFiles = files.length;

            for (const file of files) {
                const ext = path.extname(file.fsPath).substring(1);
                analysis.languages.set(ext, (analysis.languages.get(ext) || 0) + 1);
            }

            const analysisMessage: ChatMessage = {
                id: Date.now().toString(),
                type: "assistant",
                content: this.formatProjectAnalysis(analysis),
                timestamp: new Date(),
                analysis: analysis,
            };

            this.chatHistory.push(analysisMessage);
            this.updateWebview();
        } catch (error) {
            this.handleError(error);
        }
    }

    private formatProjectAnalysis(analysis: any): string {
        let content = "## 📊 Project Analysis\n\n";
        content += `**Total Files:** ${analysis.totalFiles}\n\n`;
        content += "**Languages Distribution:**\n";
        
        Array.from(analysis.languages.entries()).forEach(([lang, count]) => {
            content += `- ${lang.toUpperCase()}: ${count} files\n`;
        });

        return content;
    }

    private async generateTests(filePath: string) {
        try {
            const document = await vscode.workspace.openTextDocument(filePath);
            const code = document.getText();

            const testRequest = {
                filePath,
                code,
                language: document.languageId,
                testFramework: this.detectTestFramework(),
            };

            // Send to agent for test generation
            const response = await this.agentClient.generateTests(testRequest);
            
            const testMessage: ChatMessage = {
                id: Date.now().toString(),
                type: "assistant",
                content: this.formatTestGeneration(response),
                timestamp: new Date(),
                tests: response.tests,
            };

            this.chatHistory.push(testMessage);
            this.updateWebview();
        } catch (error) {
            this.handleError(error);
        }
    }

    private detectTestFramework(): string {
        const dependencies = this.projectContext.dependencies || [];
        
        if (dependencies.includes("junit")) return "junit";
        if (dependencies.includes("jest")) return "jest";
        if (dependencies.includes("pytest")) return "pytest";
        if (dependencies.includes("mocha")) return "mocha";
        
        return "default";
    }

    private formatTestGeneration(response: any): string {
        let content = "## 🧪 Generated Tests\n\n";
        
        if (response.tests) {
            response.tests.forEach((test: any, index: number) => {
                content += `### Test ${index + 1}: ${test.name}\n`;
                content += ````${test.language}\n${test.code}\n```\n\n`;
                if (test.description) {
                    content += `*${test.description}*\n\n`;
                }
            });
        }

        return content;
    }

    private async optimizeCode(filePath: string) {
        try {
            const document = await vscode.workspace.openTextDocument(filePath);
            const code = document.getText();

            const optimizationRequest = {
                filePath,
                code,
                language: document.languageId,
                optimizationType: "performance", // or "readability", "security"
            };

            const response = await this.agentClient.optimizeCode(optimizationRequest);
            
            const optimizationMessage: ChatMessage = {
                id: Date.now().toString(),
                type: "assistant",
                content: this.formatOptimization(response),
                timestamp: new Date(),
                codeChanges: response.optimizations,
            };

            this.chatHistory.push(optimizationMessage);
            this.updateWebview();
        } catch (error) {
            this.handleError(error);
        }
    }

    private formatOptimization(response: any): string {
        let content = "## 🚀 Code Optimization Results\n\n";
        content += `**Performance Improvement:** ${response.performanceGain || 'Unknown'}\n\n`;
        
        if (response.optimizations) {
            content += "**Optimizations Applied:**\n";
            response.optimizations.forEach((opt: any, index: number) => {
                content += `${index + 1}. ${opt.description}\n`;
            });
        }

        return content;
    }

    private addToMemory(content: string) {
        // Add important information to memory for future context
        this.agentClient.addMemory({
            content,
            timestamp: new Date(),
            sessionId: this.currentSessionId,
            importance: "high",
        });
    }

    private clearChat() {
        this.chatHistory = [];
        this.updateWebview();
        this.saveChatHistory();
    }

    private async exportChat(format: string = "markdown") {
        const content = this.formatConversationForExport(format);
        const document = await vscode.workspace.openTextDocument({
            content,
            language: format === "json" ? "json" : "markdown",
        });

        await vscode.window.showTextDocument(document);
    }

    private formatConversationForExport(format: string): string {
        if (format === "json") {
            return JSON.stringify({
                sessionId: this.currentSessionId,
                timestamp: new Date().toISOString(),
                messages: this.chatHistory,
                projectContext: this.projectContext,
            }, null, 2);
        }

        if (format === "html") {
            return this.generateHTMLExport();
        }

        // Markdown format
        const header = `# Wayang Code Conversation\n\n**Session:** ${this.currentSessionId}\n**Date:** ${new Date().toLocaleString()}\n**Project:** ${this.projectContext.projectType || 'Unknown'}\n\n---\n\n`;
        
        const messages = this.chatHistory
            .map((msg) => {
                const role = msg.type === "user" ? "👤 **You**" : "🤖 **Wayang Code**";
                const timestamp = msg.timestamp.toLocaleString();
                const pinned = msg.pinned ? " 📌" : "";
                const edited = msg.edited ? " ✏️" : "";
                const mode = msg.mode ? ` (${msg.mode} mode)` : "";
                
                return `## ${role}${pinned}${edited}${mode}\n*${timestamp}*\n\n${msg.content}\n\n---\n`;
            })
            .join("\n");

        return header + messages;
    }

    private generateHTMLExport(): string {
        const htmlTemplate = `
<!DOCTYPE html>
<html>
<head>
    <title>Wayang Code Conversation Export</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 40px; line-height: 1.6; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .message { margin: 20px 0; padding: 15px; border-radius: 8px; }
        .user { background: #e3f2fd; margin-left: 40px; }
        .assistant { background: #f3e5f5; margin-right: 40px; }
        .message-header { font-weight: bold; margin-bottom: 8px; }
        pre { background: #f8f8f8; padding: 12px; border-radius: 4px; overflow-x: auto; }
        code { background: #f0f0f0; padding: 2px 4px; border-radius: 3px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🎭 Wayang Code Conversation</h1>
        <p><strong>Session:</strong> ${this.currentSessionId}</p>
        <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>
        <p><strong>Project:</strong> ${this.projectContext.projectType || 'Unknown'}</p>
        <p><strong>Messages:</strong> ${this.chatHistory.length}</p>
    </div>
    ${this.chatHistory.map(msg => `
        <div class="message ${msg.type}">
            <div class="message-header">
                ${msg.type === 'user' ? '👤 You' : '🤖 Wayang Code'} 
                ${msg.pinned ? '📌' : ''} 
                ${msg.edited ? '✏️' : ''}
                - ${msg.timestamp.toLocaleString()}
            </div>
            <div>${this.formatMessageForHTML(msg.content)}</div>
        </div>
    `).join('')}
</body>
</html>`;
        
        return htmlTemplate;
    }

    private formatMessageForHTML(content: string): string {
        return content
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/```(\w+)?\n([\s\S]*?)\n```/g, '<pre><code>$2</code></pre>')
            .replace(/`(.*?)`/g, '<code>$1</code>')
            .replace(/\n/g, '<br>');
    }

    private initializeProjectContext() {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders) {
            this.projectContext = {
                workspacePath: workspaceFolders[0].uri.fsPath,
                projectType: this.detectProjectType(workspaceFolders[0].uri.fsPath),
                dependencies: this.getDependencies(),
                gitBranch: this.getCurrentGitBranch(),
            };
        }
    }

    private detectProjectType(workspacePath: string): string {
        const projectFiles = [
            { file: "pom.xml", type: "Maven/Java" },
            { file: "build.gradle", type: "Gradle/Java" },
            { file: "package.json", type: "Node.js" },
            { file: "requirements.txt", type: "Python" },
            { file: "Cargo.toml", type: "Rust" },
            { file: "go.mod", type: "Go" },
            { file: "composer.json", type: "PHP" },
            { file: "*.csproj", type: "C#/.NET" },
            { file: "application.properties", type: "Quarkus/Java" },
            { file: "src/main/resources/application.yml", type: "Spring Boot/Java" },
        ];

        for (const project of projectFiles) {
            if (fs.existsSync(path.join(workspacePath, project.file))) {
                return project.type;
            }
        }

        return "Unknown";
    }

    private getDependencies(): string[] {
        try {
            const workspacePath = this.projectContext.workspacePath;
            if (!workspacePath) return [];

            // Node.js dependencies
            if (fs.existsSync(path.join(workspacePath, "package.json"))) {
                const packageJson = JSON.parse(
                    fs.readFileSync(path.join(workspacePath, "package.json"), "utf8")
                );
                return Object.keys({
                    ...packageJson.dependencies,
                    ...packageJson.devDependencies,
                });
            }

            // Maven dependencies
            if (fs.existsSync(path.join(workspacePath, "pom.xml"))) {
                // Parse pom.xml for dependencies (simplified)
                const pomContent = fs.readFileSync(path.join(workspacePath, "pom.xml"), "utf8");
                const dependencyMatches = pomContent.match(/<artifactId>(.*?)<\/artifactId>/g);
                return dependencyMatches?.map(match => 
                    match.replace(/<\/?artifactId>/g, '')
                ) || [];
            }

            // Python dependencies
            if (fs.existsSync(path.join(workspacePath, "requirements.txt"))) {
                const requirements = fs.readFileSync(path.join(workspacePath, "requirements.txt"), "utf8");
                return requirements.split('\n')
                    .filter(line => line.trim() && !line.startsWith('#'))
                    .map(line => line.split(/[>=<]/)[0].trim());
            }
        } catch (error) {
            console.error("Error reading dependencies:", error);
        }
        
        return [];
    }

    private getCurrentGitBranch(): string {
        try {
            const workspacePath = this.projectContext.workspacePath;
            if (!workspacePath) return "unknown";

            const gitHeadPath = path.join(workspacePath, ".git", "HEAD");
            if (fs.existsSync(gitHeadPath)) {
                const headContent = fs.readFileSync(gitHeadPath, "utf8").trim();
                if (headContent.startsWith("ref: refs/heads/")) {
                    return headContent.substring("ref: refs/heads/".length);
                }
            }
            return "main";
        } catch (error) {
            return "unknown";
        }
    }

    private setupFileWatcher() {
        const watcher = vscode.workspace.createFileSystemWatcher("**/*");
        
        watcher.onDidChange(() => {
            this.updateProjectContext();
        });

        watcher.onDidCreate(() => {
            this.updateProjectContext();
        });

        watcher.onDidDelete(() => {
            this.updateProjectContext();
        });
    }

    private updateProjectContext() {
        this.projectContext.dependencies = this.getDependencies();
        this.projectContext.gitBranch = this.getCurrentGitBranch();
        
        if (this._view) {
            this._view.webview.postMessage({
                type: "projectContextUpdated",
                context: this.projectContext,
            });
        }
    }

    private getEnhancedContext() {
        return {
            editor: this.getEditorContext(),
            project: this.projectContext,
            recentFiles: this.getRecentFiles(),
            openTabs: this.getOpenTabs(),
        };
    }

    private getRecentFiles(): string[] {
        try {
            const workspacePath = this.projectContext.workspacePath;
            if (!workspacePath) return [];

            // Get recently modified files (last 24 hours)
            const files = fs.readdirSync(workspacePath, { withFileTypes: true })
                .filter(dirent => dirent.isFile())
                .map(dirent => {
                    const filePath = path.join(workspacePath, dirent.name);
                    const stats = fs.statSync(filePath);
                    return { name: dirent.name, mtime: stats.mtime };
                })
                .filter(file => {
                    const oneDayAgo = new Date();
                    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
                    return file.mtime > oneDayAgo;
                })
                .sort((a, b) => b.mtime.getTime() - a.mtime.getTime())
                .slice(0, 10)
                .map(file => file.name);

            return files;
        } catch (error) {
            return [];
        }
    }

    private getOpenTabs(): string[] {
        return vscode.window.tabGroups.all
            .flatMap(group => group.tabs)
            .map(tab => (tab.input as any)?.uri?.fsPath)
            .filter(Boolean);
    }

    private getRecentHistory(count: number): ChatMessage[] {
        return this.chatHistory.slice(-count * 2);
    }

    private shouldAutoApply(): boolean {
        return vscode.workspace.getConfiguration("wayang").get("autoApplyChanges", false);
    }

    private handleError(error: any) {
        let errorMessage = "An unexpected error occurred.";
        
        if (isAxiosError(error)) {
            errorMessage = `Network error: ${error.message}`;
        } else if (error instanceof Error) {
            errorMessage = error.message;
        }

        const errorMsg: ChatMessage = {
            id: `error_${Date.now()}`,
            type: "assistant",
            content: `❌ ${errorMessage}`,
            timestamp: new Date(),
            error: true,
        };

        this.chatHistory.push(errorMsg);
        this.updateWebview();
    }

    private updateWebview() {
        if (this._view) {
            this._view.webview.postMessage({
                type: "updateChat",
                messages: this.chatHistory,
                sessionId: this.currentSessionId,
                isStreaming: this.isStreaming,
                projectContext: this.projectContext,
            });
        }
        this.saveChatHistory();
    }

    private updateSessionsList() {
        if (this._view) {
            const sessions = Array.from(this.chatSessions.entries()).map(([id, messages]) => ({
                id,
                name: this.getSessionName(id, messages),
                messageCount: messages.length,
                lastActivity: this.getLastActivity(messages),
                isActive: id === this.currentSessionId,
            }));

            this._view.webview.postMessage({
                type: "updateSessions",
                sessions: sessions,
            });
        }
    }

    private getSessionName(sessionId: string, messages: ChatMessage[]): string {
        if (sessionId === "default") return "Default Session";
        
        const firstUserMessage = messages.find(msg => msg.type === "user");
        if (firstUserMessage) {
            return firstUserMessage.content.substring(0, 30) + "...";
        }
        
        return `Session ${sessionId.split("_")[1]}`;
    }

    private getLastActivity(messages: ChatMessage[]): Date {
        if (messages.length === 0) return new Date();
        return messages[messages.length - 1].timestamp;
    }

    private getEditorContext() {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) return {};

        const document = activeEditor.document;
        const selection = activeEditor.selection;

        return {
            fileName: document.fileName,
            languageId: document.languageId,
            selectedText: selection.isEmpty ? undefined : document.getText(selection),
            cursorPosition: document.offsetAt(activeEditor.selection.active),
            lineCount: document.lineCount,
            isDirty: document.isDirty,
            fullText: document.getText(),
        };
    }

    private loadChatHistory() {
        const saved = vscode.workspace.getConfiguration("wayang").get("chatHistory", []);
        this.chatHistory = Array.isArray(saved) ? saved : [];
        this.updateWebview();
    }

    private saveChatHistory() {
        vscode.workspace.getConfiguration("wayang").update(
            "chatHistory",
            this.chatHistory,
            vscode.ConfigurationTarget.Workspace,
        );
    }

    private loadChatSessions() {
        const saved = vscode.workspace.getConfiguration("wayang").get("chatSessions", {});
        if (typeof saved === "object" && saved !== null) {
            this.chatSessions = new Map(Object.entries(saved));
        }
        
        if (!this.chatSessions.has("default")) {
            this.chatSessions.set("default", []);
        }
    }

    private saveChatSessions() {
        const sessionsObj = Object.fromEntries(this.chatSessions);
        vscode.workspace.getConfiguration("wayang").update(
            "chatSessions",
            sessionsObj,
            vscode.ConfigurationTarget.Workspace,
        );
    }

    public showMemories(memories: any[]) {
        if (this._view) {
            this._view.webview.postMessage({
                type: "showMemories",
                memories: memories,
            });
        }
    }

    // Public methods for external integration
    public addMessage(message: ChatMessage) {
        this.chatHistory.push(message);
        this.updateWebview();
    }

    public getCurrentSession(): string {
        return this.currentSessionId;
    }

    public getProjectContext(): ProjectContext {
        return this.projectContext;
    }

    public refreshProjectContext() {
        this.initializeProjectContext();
        this.updateWebview();
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Wayang Code Chat</title>
            <style>
                * { box-sizing: border-box; }
                
                body {
                    font-family: var(--vscode-font-family);
                    font-size: var(--vscode-font-size);
                    color: var(--vscode-foreground);
                    background-color: var(--vscode-editor-background);
                    margin: 0;
                    padding: 0;
                    overflow-x: hidden;
                }
                
                .chat-container {
                    display: flex;
                    flex-direction: column;
                    height: 100vh;
                }
                
                .header {
                    background: linear-gradient(135deg, var(--vscode-titleBar-activeBackground), var(--vscode-button-background));
                    padding: 12px;
                    border-bottom: 1px solid var(--vscode-widget-border);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
                
                .session-info {
                    font-size: 0.9em;
                    color: var(--vscode-titleBar-activeForeground);
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                }
                
                .session-name {
                    font-weight: 600;
                }
                
                .session-status {
                    font-size: 0.8em;
                    opacity: 0.8;
                }
                
                .mode-selector {
                    display: flex;
                    gap: 4px;
                    background-color: var(--vscode-editor-background);
                    padding: 4px;
                    border-radius: 8px;
                    border: 1px solid var(--vscode-widget-border);
                }
                
                .mode-btn {
                    padding: 6px 12px;
                    border: none;
                    border-radius: 4px;
                    background-color: transparent;
                    color: var(--vscode-foreground);
                    cursor: pointer;
                    font-family: inherit;
                    font-size: 0.85em;
                    transition: all 0.2s ease;
                    white-space: nowrap;
                }
                
                .mode-btn:hover {
                    background-color: var(--vscode-toolbar-hoverBackground);
                }
                
                .mode-btn.active {
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                }
                
                .sessions-panel {
                    background-color: var(--vscode-sideBar-background);
                    border-bottom: 1px solid var(--vscode-widget-border);
                    max-height: 0;
                    overflow: hidden;
                    transition: max-height 0.3s ease-in-out;
                }
                
                .sessions-panel.open {
                    max-height: 250px;
                    overflow-y: auto;
                }
                
                .session-item {
                    padding: 10px 15px;
                    cursor: pointer;
                    border-bottom: 1px solid var(--vscode-widget-border);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    transition: background-color 0.2s ease;
                }
                
                .session-item:hover {
                    background-color: var(--vscode-list-hoverBackground);
                }
                
                .session-item.active {
                    background-color: var(--vscode-list-activeSelectionBackground);
                    color: var(--vscode-list-activeSelectionForeground);
                    border-left: 3px solid var(--vscode-button-background);
                }
                
                .session-name {
                    flex: 1;
                    font-size: 0.9em;
                    font-weight: 500;
                }
                
                .session-meta {
                    font-size: 0.8em;
                    color: var(--vscode-descriptionForeground);
                    display: flex;
                    gap: 8px;
                    align-items: center;
                }
                
                .session-actions {
                    display: flex;
                    gap: 4px;
                }
                
                .session-delete {
                    background: none;
                    border: none;
                    color: var(--vscode-errorForeground);
                    cursor: pointer;
                    padding: 4px;
                    border-radius: 3px;
                    font-size: 0.8em;
                    opacity: 0.7;
                    transition: all 0.2s ease;
                }
                
                .session-delete:hover {
                    background-color: var(--vscode-errorBackground);
                    opacity: 1;
                }
                
                .project-context {
                    background: linear-gradient(135deg, var(--vscode-badge-background), var(--vscode-button-secondaryBackground));
                    color: var(--vscode-badge-foreground);
                    padding: 10px 15px;
                    margin: 0;
                    font-size: 0.85em;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-bottom: 1px solid var(--vscode-widget-border);
                }
                
                .context-toggle {
                    background: none;
                    border: none;
                    color: var(--vscode-badge-foreground);
                    cursor: pointer;
                    font-size: 0.8em;
                    padding: 4px 8px;
                    border-radius: 4px;
                    transition: background-color 0.2s ease;
                }
                
                .context-toggle:hover {
                    background-color: var(--vscode-button-hoverBackground);
                }
                
                .search-container {
                    padding: 10px 15px;
                    background-color: var(--vscode-sideBar-background);
                    border-bottom: 1px solid var(--vscode-widget-border);
                }
                
                .search-input {
                    width: 100%;
                    padding: 8px 12px;
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 6px;
                    background-color: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    font-size: 0.9em;
                    transition: border-color 0.2s ease;
                }
                
                .search-input:focus {
                    outline: none;
                    border-color: var(--vscode-focusBorder);
                    box-shadow: 0 0 0 1px var(--vscode-focusBorder);
                }
                
                .search-results {
                    max-height: 200px;
                    overflow-y: auto;
                    background-color: var(--vscode-dropdown-background);
                    border: 1px solid var(--vscode-dropdown-border);
                    border-radius: 6px;
                    margin-top: 8px;
                    box-shadow: 0 4px 8px rgba(0,0,0,0.1);
                }
                
                .search-result {
                    padding: 10px 15px;
                    cursor: pointer;
                    font-size: 0.9em;
                    border-bottom: 1px solid var(--vscode-widget-border);
                    transition: background-color 0.2s ease;
                }
                
                .search-result:hover {
                    background-color: var(--vscode-list-hoverBackground);
                }
                
                .search-result:last-child {
                    border-bottom: none;
                }
                
                .toolbar {
                    display: flex;
                    gap: 8px;
                    margin: 12px;
                    flex-wrap: wrap;
                    align-items: center;
                }
                
                .toolbar-group {
                    display: flex;
                    gap: 6px;
                    align-items: center;
                    padding: 6px 8px;
                    border-radius: 6px;
                    background-color: var(--vscode-toolbar-background);
                    border: 1px solid var(--vscode-widget-border);
                }
                
                .chat-messages {
                    flex: 1;
                    overflow-y: auto;
                    padding: 0 12px;
                    margin-bottom: 10px;
                    scroll-behavior: smooth;
                }
                
                .message {
                    margin: 16px 0;
                    padding: 15px;
                    border-radius: 12px;
                    max-width: 100%;
                    word-wrap: break-word;
                    position: relative;
                    animation: fadeIn 0.4s ease-out;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                    border: 1px solid transparent;
                }
                
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(15px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                
                .message.user {
                    background: linear-gradient(135deg, var(--vscode-inputOption-activeBackground), var(--vscode-input-background));
                    margin-left: 50px;
                    border-bottom-right-radius: 6px;
                    border-color: var(--vscode-inputOption-activeBorder);
                }
                
                .message.assistant {
                    background: linear-gradient(135deg, var(--vscode-editor-selectionBackground), var(--vscode-editor-background));
                    margin-right: 50px;
                    border-bottom-left-radius: 6px;
                    border-color: var(--vscode-editor-selectionHighlightBorder);
                }
                
                .message.error {
                    background: linear-gradient(135deg, var(--vscode-inputValidation-errorBackground), var(--vscode-errorBackground));
                    border-color: var(--vscode-inputValidation-errorBorder);
                    margin-right: 50px;
                }
                
                .message.loading {
                    opacity: 0.8;
                    animation: pulse 2s infinite;
                }
                
                @keyframes pulse {
                    0%, 100% { opacity: 0.8; }
                    50% { opacity: 1; }
                }
                
                .message.pinned {
                    border-left: 4px solid var(--vscode-notificationsInfoIcon-foreground);
                    box-shadow: 0 2px 12px rgba(0,0,0,0.15);
                }
                
                .message.edited::after {
                    content: "✏️";
                    position: absolute;
                    top: 8px;
                    right: 8px;
                    font-size: 0.8em;
                    opacity: 0.6;
                }
                
                .message-header {
                    font-size: 0.85em;
                    opacity: 0.9;
                    margin-bottom: 10px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    font-weight: 600;
                }
                
                .message-actions {
                    display: flex;
                    gap: 6px;
                    opacity: 0;
                    transition: opacity 0.3s ease;
                }
                
                .message:hover .message-actions {
                    opacity: 1;
                }
                
                .message-action {
                    background: var(--vscode-button-secondaryBackground);
                    border: none;
                    color: var(--vscode-button-secondaryForeground);
                    cursor: pointer;
                    padding: 4px 6px;
                    border-radius: 4px;
                    font-size: 0.75em;
                    transition: all 0.2s ease;
                }
                
                .message-action:hover {
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    transform: translateY(-1px);
                }
                
                .message-content {
                    line-height: 1.6;
                }
                
                .message-content pre {
                    background-color: var(--vscode-textBlockQuote-background);
                    padding: 15px;
                    border-radius: 8px;
                    overflow-x: auto;
                    margin: 10px 0;
                    border: 1px solid var(--vscode-textBlockQuote-border);
                    position: relative;
                    box-shadow: inset 0 1px 3px rgba(0,0,0,0.1);
                }
                
                .message-content pre::before {
                    content: attr(data-language);
                    position: absolute;
                    top: 6px;
                    right: 10px;
                    font-size: 0.7em;
                    color: var(--vscode-descriptionForeground);
                    text-transform: uppercase;
                    background-color: var(--vscode-badge-background);
                    padding: 2px 6px;
                    border-radius: 3px;
                }
                
                .message-content code {
                    background-color: var(--vscode-textBlockQuote-background);
                    padding: 3px 6px;
                    border-radius: 4px;
                    font-size: 0.9em;
                    border: 1px solid var(--vscode-widget-border);
                }
                
                .code-suggestion {
                    background: linear-gradient(135deg, var(--vscode-diffEditor-insertedTextBackground), var(--vscode-editor-background));
                    border: 1px solid var(--vscode-diffEditor-insertedTextBorder);
                    border-radius: 8px;
                    margin: 12px 0;
                    overflow: hidden;
                    box-shadow: 0 3px 6px rgba(0,0,0,0.1);
                }
                
                .code-suggestion-header {
                    background: linear-gradient(135deg, var(--vscode-badge-background), var(--vscode-button-background));
                    color: var(--vscode-badge-foreground);
                    padding: 8px 15px;
                    font-size: 0.85em;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    font-weight: 600;
                }
                
                .code-suggestion-content {
                    padding: 12px;
                }
                
                .apply-code-btn {
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    padding: 6px 12px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 0.8em;
                    font-weight: 500;
                    transition: all 0.2s ease;
                }
                
                .apply-code-btn:hover {
                    background-color: var(--vscode-button-hoverBackground);
                    transform: translateY(-1px);
                    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                }
                
                .confidence-indicator {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 0.8em;
                    margin-bottom: 10px;
                    padding: 4px 8px;
                    border-radius: 12px;
                    background-color: var(--vscode-badge-background);
                    color: var(--vscode-badge-foreground);
                }
                
                .input-container {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                    padding: 15px;
                    border-top: 1px solid var(--vscode-widget-border);
                    background: linear-gradient(135deg, var(--vscode-input-background), var(--vscode-editor-background));
                }
                
                .input-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    font-size: 0.85em;
                }
                
                .input-mode {
                    color: var(--vscode-descriptionForeground);
                    font-weight: 600;
                }
                
                .input-actions {
                    display: flex;
                    gap: 6px;
                }
                
                .message-input {
                    padding: 12px 15px;
                    border: 2px solid var(--vscode-input-border);
                    border-radius: 8px;
                    background-color: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    font-family: inherit;
                    font-size: inherit;
                    resize: vertical;
                    min-height: 24px;
                    max-height: 150px;
                    transition: all 0.2s ease;
                }
                
                .message-input:focus {
                    outline: none;
                    border-color: var(--vscode-focusBorder);
                    box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.1);
                    transform: translateY(-1px);
                }
                
                .input-bottom {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 10px;
                }
                
                .input-features {
                    display: flex;
                    gap: 15px;
                    align-items: center;
                    flex-wrap: wrap;
                }
                
                .feature-toggle {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 0.8em;
                    color: var(--vscode-descriptionForeground);
                    cursor: pointer;
                    padding: 4px;
                    border-radius: 4px;
                    transition: color 0.2s ease;
                }
                
                .feature-toggle:hover {
                    color: var(--vscode-foreground);
                }
                
                .feature-checkbox {
                    width: 16px;
                    height: 16px;
                    cursor: pointer;
                }
                
                .send-button, .clear-button, .export-button, .session-btn {
                    padding: 10px 20px;
                    border: none;
                    border-radius: 6px;
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    cursor: pointer;
                    font-family: inherit;
                    font-size: 0.9em;
                    font-weight: 500;
                    transition: all 0.2s ease;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
                
                .send-button:hover, .clear-button:hover, .export-button:hover, .session-btn:hover {
                    background-color: var(--vscode-button-hoverBackground);
                    transform: translateY(-1px);
                    box-shadow: 0 4px 8px rgba(0,0,0,0.15);
                }
                
                .send-button:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                    transform: none;
                }
                
                .send-button.streaming {
                    background: linear-gradient(135deg, var(--vscode-errorBackground), var(--vscode-inputValidation-errorBackground));
                    color: var(--vscode-errorForeground);
                    animation: streamingPulse 1.5s infinite;
                }
                
                @keyframes streamingPulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.7; }
                }
                
                .loading-indicator {
                    display: inline-block;
                    animation: spin 1s linear infinite;
                }
                
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                
                .memories-section {
                    background: linear-gradient(135deg, var(--vscode-editor-inactiveSelectionBackground), var(--vscode-editor-selectionBackground));
                    border-radius: 10px;
                    padding: 15px;
                    margin: 15px 0;
                    border: 1px solid var(--vscode-widget-border);
                    box-shadow: 0 3px 6px rgba(0,0,0,0.1);
                }
                
                .memory-item {
                    padding: 8px 0;
                    border-bottom: 1px solid var(--vscode-widget-border);
                    font-size: 0.9em;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                
                .memory-item:last-child {
                    border-bottom: none;
                }
                
                .welcome-message {
                    text-align: center;
                    padding: 30px 20px;
                    color: var(--vscode-descriptionForeground);
                    background: linear-gradient(135deg, var(--vscode-editor-background), var(--vscode-editor-selectionBackground));
                    border-radius: 12px;
                    margin: 20px 0;
                    border: 1px solid var(--vscode-widget-border);
                }
                
                .welcome-message h3 {
                    color: var(--vscode-foreground);
                    margin-bottom: 10px;
                    font-size: 1.4em;
                }
                
                .welcome-features {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
                    gap: 15px;
                    margin: 20px 0;
                }
                
                .feature-card {
                    background: linear-gradient(135deg, var(--vscode-editor-selectionBackground), var(--vscode-button-secondaryBackground));
                    padding: 15px;
                    border-radius: 10px;
                    border: 1px solid var(--vscode-widget-border);
                    text-align: left;
                    transition: all 0.3s ease;
                    cursor: pointer;
                }
                
                .feature-card:hover {
                    transform: translateY(-3px);
                    box-shadow: 0 6px 12px rgba(0,0,0,0.15);
                    border-color: var(--vscode-button-background);
                }
                
                .feature-title {
                    font-weight: 600;
                    margin-bottom: 6px;
                    color: var(--vscode-foreground);
                    font-size: 0.95em;
                }
                
                .feature-desc {
                    font-size: 0.85em;
                    color: var(--vscode-descriptionForeground);
                    line-height: 1.4;
                }
                
                .typing-indicator {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 10px 15px;
                    color: var(--vscode-descriptionForeground);
                    font-style: italic;
                    font-size: 0.9em;
                    background-color: var(--vscode-editor-selectionBackground);
                    border-radius: 8px;
                    margin: 8px 0;
                }
                
                .typing-dots {
                    display: flex;
                    gap: 3px;
                }
                
                .typing-dot {
                    width: 5px;
                    height: 5px;
                    background-color: var(--vscode-descriptionForeground);
                    border-radius: 50%;
                    animation: typingDot 1.4s infinite ease-in-out;
                }
                
                .typing-dot:nth-child(2) { animation-delay: 0.2s; }
                .typing-dot:nth-child(3) { animation-delay: 0.4s; }
                
                @keyframes typingDot {
                    0%, 80%, 100% { transform: scale(0.8); opacity: 0.5; }
                    40% { transform: scale(1.2); opacity: 1; }
                }
                
                .status-bar {
                    background: linear-gradient(135deg, var(--vscode-statusBar-background), var(--vscode-titleBar-activeBackground));
                    color: var(--vscode-statusBar-foreground);
                    padding: 8px 15px;
                    font-size: 0.8em;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-top: 1px solid var(--vscode-widget-border);
                }
                
                .status-item {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }
                
                .connection-indicator {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background-color: var(--vscode-testing-iconPassed);
                    animation: connectionPulse 2s infinite;
                }
                
                @keyframes connectionPulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }
                
                /* Enhanced responsive design */
                @media (max-width: 700px) {
                    .message.user { margin-left: 25px; }
                    .message.assistant { margin-right: 25px; }
                    
                    .toolbar {
                        flex-direction: column;
                        gap: 10px;
                        align-items: stretch;
                    }
                    
                    .toolbar-group {
                        justify-content: space-around;
                    }
                    
                    .welcome-features {
                        grid-template-columns: 1fr;
                    }
                    
                    .mode-selector {
                        flex-wrap: wrap;
                    }
                    
                    .input-features {
                        flex-direction: column;
                        align-items: flex-start;
                        gap: 8px;
                    }
                }
                
                @media (max-width: 500px) {
                    .message.user { margin-left: 10px; }
                    .message.assistant { margin-right: 10px; }
                    
                    .header {
                        flex-direction: column;
                        gap: 10px;
                        align-items: stretch;
                    }
                    
                    .session-info {
                        text-align: center;
                    }
                }
                
                /* Enhanced scrollbar styling */
                ::-webkit-scrollbar {
                    width: 10px;
                }
                
                ::-webkit-scrollbar-track {
                    background: var(--vscode-scrollbarSlider-background);
                    border-radius: 5px;
                }
                
                ::-webkit-scrollbar-thumb {
                    background: linear-gradient(180deg, var(--vscode-scrollbarSlider-hoverBackground), var(--vscode-scrollbarSlider-background));
                    border-radius: 5px;
                    border: 1px solid var(--vscode-widget-border);
                }
                
                ::-webkit-scrollbar-thumb:hover {
                    background: var(--vscode-scrollbarSlider-activeBackground);
                }
                
                /* Utility classes */
                .hidden { display: none !important; }
                .fade-in { animation: fadeIn 0.3s ease-out; }
                .slide-up { animation: slideUp 0.3s ease-out; }
                
                @keyframes slideUp {
                    from { transform: translateY(20px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                
                /* Toast notifications */
                .toast {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    background: linear-gradient(135deg, var(--vscode-notificationsInfoIcon-foreground), var(--vscode-button-background));
                    color: white;
                    padding: 12px 20px;
                    border-radius: 8px;
                    z-index: 1000;
                    font-size: 0.9em;
                    font-weight: 500;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                    animation: slideInRight 0.4s ease-out;
                }
                
                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                
                @keyframes slideOutRight {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
                
                .highlight-animation {
                    animation: highlight 2s ease-out;
                }
                
                @keyframes highlight {
                    0% { background-color: var(--vscode-editor-findMatchHighlightBackground); transform: scale(1.02); }
                    100% { background-color: transparent; transform: scale(1); }
                }
                
                /* Enhanced content styling */
                .message-content a {
                    color: var(--vscode-textLink-foreground);
                    text-decoration: none;
                    border-bottom: 1px solid transparent;
                    transition: border-color 0.2s ease;
                }
                
                .message-content a:hover {
                    border-bottom-color: var(--vscode-textLink-foreground);
                }
                
                .message-content table {
                    border-collapse: collapse;
                    width: 100%;
                    margin: 12px 0;
                    border-radius: 6px;
                    overflow: hidden;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
                
                .message-content th,
                .message-content td {
                    border: 1px solid var(--vscode-widget-border);
                    padding: 10px 12px;
                    text-align: left;
                }
                
                .message-content th {
                    background: linear-gradient(135deg, var(--vscode-editor-selectionBackground), var(--vscode-button-secondaryBackground));
                    font-weight: 600;
                }
                
                .message-content tr:nth-child(even) {
                    background-color: var(--vscode-editor-inactiveSelectionBackground);
                }
                
                .message-content blockquote {
                    border-left: 4px solid var(--vscode-textBlockQuote-border);
                    background-color: var(--vscode-textBlockQuote-background);
                    margin: 12px 0;
                    padding: 12px 16px;
                    font-style: italic;
                    border-radius: 0 6px 6px 0;
                }
                
                /* Loading states */
                .skeleton {
                    background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
                    background-size: 200% 100%;
                    animation: loading 1.5s infinite;
                }
                
                @keyframes loading {
                    0% { background-position: 200% 0; }
                    100% { background-position: -200% 0; }
                }
            </style>
        </head>
        <body>
            <div class="chat-container">
                <!-- Enhanced Header -->
                <div class="header">
                    <div class="session-info">
                        <div class="session-name" id="sessionName">Default Session</div>
                        <div class="session-status" id="sessionStatus">
                            💬 <span id="messageCount">0</span> messages
                            <span id="streamingIndicator"></span>
                        </div>
                    </div>
                    <div class="mode-selector">
                        <button class="mode-btn active" data-mode="chat">💬 Chat</button>
                        <button class="mode-btn" data-mode="code">💻 Code</button>
                        <button class="mode-btn" data-mode="review">🔍 Review</button>
                        <button class="mode-btn" data-mode="test">🧪 Test</button>
                    </div>
                </div>
                
                <!-- Sessions Panel -->
                <div class="sessions-panel" id="sessionsPanel">
                    <div id="sessionsList"></div>
                </div>
                
                <!-- Project Context -->
                <div class="project-context" id="projectContext">
                    <span id="contextInfo">Loading project context...</span>
                    <button class="context-toggle" onclick="toggleProjectContext()">
                        <span id="contextToggle">📋 Hide</span>
                    </button>
                </div>
                
                <!-- Search Container -->
                <div class="search-container" id="searchContainer" style="display: none;">
                    <input type="text" class="search-input" id="searchInput" 
                           placeholder="Search conversation history..." />
                    <div class="search-results" id="searchResults"></div>
                </div>
                
                <!-- Enhanced Toolbar -->
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
                </div>
                
                <!-- Chat Messages -->
                <div class="chat-messages" id="chatMessages">
                    <div class="welcome-message">
                        <h3>🎭 Welcome to Wayang Code!</h3>
                        <p>Your intelligent coding companion powered by Quarkus backend</p>
                        
                        <div class="welcome-features">
                            <div class="feature-card" onclick="setModeAndFocus('code')">
                                <div class="feature-title">💻 Code Generation</div>
                                <div class="feature-desc">Generate, refactor, and optimize code with AI assistance</div>
                            </div>
                            <div class="feature-card" onclick="setModeAndFocus('review')">
                                <div class="feature-title">🔍 Code Review</div>
                                <div class="feature-desc">Comprehensive code analysis and bug detection</div>
                            </div>
                            <div class="feature-card" onclick="setModeAndFocus('test')">
                                <div class="feature-title">🧪 Test Generation</div>
                                <div class="feature-desc">Automated unit test creation and validation</div>
                            </div>
                            <div class="feature-card" onclick="setModeAndFocus('chat')">
                                <div class="feature-title">💬 Smart Chat</div>
                                <div class="feature-desc">Context-aware conversations about your codebase</div>
                            </div>
                            <div class="feature-card" onclick="analyzeProject()">
                                <div class="feature-title">📊 Project Analysis</div>
                                <div class="feature-desc">Deep insights into your project structure</div>
                            </div>
                            <div class="feature-card" onclick="showProjectFiles()">
                                <div class="feature-title">📁 File Explorer</div>
                                <div class="feature-desc">Navigate and analyze project files</div>
                            </div>
                        </div>
                        
                        <p><strong>🚀 Select a mode above and start coding!</strong></p>
                    </div>
                </div>
                
                <!-- Enhanced Input Container -->
                <div class="input-container">
                    <div class="input-header">
                        <span class="input-mode" id="currentMode">💬 Chat Mode</span>
                        <div class="input-actions">
                            <button class="message-action" onclick="addCodeSnippet()" title="Add Code Snippet">📝</button>
                            <button class="message-action" onclick="toggleStreaming()" title="Toggle Streaming" id="streamToggle">🌊</button>
                            <button class="message-action" onclick="showHelp()" title="Help & Tips">❓</button>
                        </div>
                    </div>
                    
                    <textarea 
                        id="messageInput" 
                        class="message-input" 
                        placeholder="Ask me anything about your code..."
                        rows="1"
                    ></textarea>
                    
                    <div class="input-bottom">
                        <div class="input-features">
                            <label class="feature-toggle">
                                <input type="checkbox" class="feature-checkbox" id="includeContext" checked>
                                Include project context
                            </label>
                            <label class="feature-toggle">
                                <input type="checkbox" class="feature-checkbox" id="autoApply">
                                Auto-apply changes
                            </label>
                            <label class="feature-toggle">
                                <input type="checkbox" class="feature-checkbox" id="streamingMode">
                                Streaming mode
                            </label>
                        </div>
                        <button id="sendButton" class="send-button" onclick="sendMessage()">
                            <span id="sendButtonText">Send</span>
                        </button>
                    </div>
                </div>
                
                <!-- Enhanced Status Bar -->
                <div class="status-bar">
                    <div class="status-item">
                        <span id="projectType">🏗️ Loading...</span>
                    </div>
                    <div class="status-item">
                        <div class="connection-indicator"></div>
                        <span id="connectionStatus">Connected</span>
                    </div>
                    <div class="status-item">
                        <span id="tokenCount">0 tokens</span>
                    </div>
                </div>
            </div>
            
            <script>
                const vscode = acquireVsCodeApi();
                let isWaitingForResponse = false;
                let currentMode = 'chat';
                let isStreaming = false;
                let sessions = [];
                let isSessionsPanelOpen = false;
                let isSearchOpen = false;
                let projectContext = {};
                let searchResults = [];
                let messageIdCounter = 0;
                
                // Handle messages from extension
                window.addEventListener('message', event => {
                    const message = event.data;
                    
                    switch (message.type) {
                        case 'updateChat':
                            updateChatMessages(message.messages);
                            updateStatus(message);
                            break;
                        case 'updateSessions':
                            updateSessions(message.sessions);
                            break;
                        case 'showMemories':
                            showMemories(message.memories);
                            break;
                        case 'modeChanged':
                            setMode(message.mode);
                            break;
                        case 'searchResults':
                            showSearchResults(message.results, message.query);
                            break;
                        case 'projectContextUpdated':
                            updateProjectContext(message.context);
                            break;
                        case 'projectFiles':
                            showProjectFiles(message.files);
                            break;
                    }
                });
                
                function updateChatMessages(messages) {
                    const chatMessages = document.getElementById('chatMessages');
                    const welcomeMessage = chatMessages.querySelector('.welcome-message');
                    
                    if (messages.length === 0) {
                        chatMessages.innerHTML = '';
                        if (welcomeMessage) {
                            chatMessages.appendChild(welcomeMessage.cloneNode(true));
                        }
                        return;
                    }
                    
                    // Clear existing messages
                    chatMessages.innerHTML = '';
                    
                    messages.forEach(msg => {
                        const messageDiv = createMessageElement(msg);
                        chatMessages.appendChild(messageDiv);
                    });
                    
                    // Smooth scroll to bottom
                    setTimeout(() => {
                        chatMessages.scrollTop = chatMessages.scrollHeight;
                    }, 100);
                    
                    // Update loading state
                    isWaitingForResponse = messages.some(msg => msg.loading);
                    updateSendButton();
                    
                    // Update message count
                    document.getElementById('messageCount').textContent = messages.length;
                    
                    // Update token count (estimate)
                    const totalTokens = messages.reduce((sum, msg) => sum + estimateTokens(msg.content), 0);
                    document.getElementById('tokenCount').textContent = `\${totalTokens} tokens`;
                }
                
                function createMessageElement(msg) {
                    const messageDiv = document.createElement('div');
                    messageDiv.className = `message \${msg.type}`;
                    messageDiv.id = `message-\${msg.id}`;
                    
                    if (msg.loading) messageDiv.classList.add('loading');
                    if (msg.error) messageDiv.classList.add('error');
                    if (msg.pinned) messageDiv.classList.add('pinned');
                    if (msg.edited) messageDiv.classList.add('edited');
                    
                    const headerDiv = document.createElement('div');
                    headerDiv.className = 'message-header';
                    
                    const roleSpan = document.createElement('span');
                    const roleEmoji = msg.type === 'user' ? '👤' : '🤖';
                    const roleName = msg.type === 'user' ? 'You' : 'Wayang Code';
                    const modeIndicator = msg.mode ? ` (\${msg.mode})` : '';
                    
                    roleSpan.innerHTML = `\${roleEmoji} \${roleName}\${modeIndicator}`;
                    
                    if (msg.loading) {
                        roleSpan.innerHTML += ' <span class="loading-indicator">⚙️</span>';
                    }
                    
                    const actionsDiv = document.createElement('div');
                    actionsDiv.className = 'message-actions';
                    
                    // Add message actions
                    if (!msg.loading) {
                        if (msg.type === 'assistant') {
                            actionsDiv.innerHTML = `
                                <button class="message-action" onclick="regenerateResponse('\${msg.id}')" title="Regenerate">🔄</button>
                                <button class="message-action" onclick="copyMessage('\${msg.id}')" title="Copy">📋</button>
                                <button class="message-action" onclick="pinMessage('\${msg.id}')" title="Pin">\${msg.pinned ? '📌' : '📍'}</button>
                                <button class="message-action" onclick="addToMemory('\${msg.id}')" title="Remember">🧠</button>
                            `;
                        } else {
                            actionsDiv.innerHTML = `
                                <button class="message-action" onclick="editMessage('\${msg.id}')" title="Edit">✏️</button>
                                <button class="message-action" onclick="copyMessage('\${msg.id}')" title="Copy">📋</button>
                                <button class="message-action" onclick="pinMessage('\${msg.id}')" title="Pin">\${msg.pinned ? '📌' : '📍'}</button>
                                <button class="message-action" onclick="retryMessage('\${msg.id}')" title="Retry">🔄</button>
                            `;
                        }
                    }
                    
                    headerDiv.appendChild(roleSpan);
                    headerDiv.appendChild(actionsDiv);
                    
                    const contentDiv = document.createElement('div');
                    contentDiv.className = 'message-content';
                    
                    // Add confidence indicator for assistant messages
                    if (msg.type === 'assistant' && msg.confidence) {
                        const confidenceDiv = document.createElement('div');
                        confidenceDiv.className = 'confidence-indicator';
                        const confidenceIcon = msg.confidence > 0.8 ? '🟢' : msg.confidence > 0.6 ? '🟡' : '🔴';
                        const confidenceText = msg.confidence > 0.8 ? 'High' : msg.confidence > 0.6 ? 'Medium' : 'Low';
                        confidenceDiv.innerHTML = `\${confidenceIcon} \${confidenceText} Confidence (\${Math.round(msg.confidence * 100)}%)`;
                        contentDiv.appendChild(confidenceDiv);
                    }
                    
                    const messageContent = document.createElement('div');
                    messageContent.innerHTML = formatMessageContent(msg.content);
                    contentDiv.appendChild(messageContent);
                    
                    // Add code suggestions if available
                    if (msg.codeSuggestions && msg.codeSuggestions.length > 0) {
                        msg.codeSuggestions.forEach(suggestion => {
                            const suggestionDiv = createCodeSuggestion(suggestion);
                            contentDiv.appendChild(suggestionDiv);
                        });
                    }
                    
                    // Add timestamp
                    const timestampDiv = document.createElement('div');
                    timestampDiv.style.cssText = 'font-size: 0.75em; opacity: 0.6; margin-top: 8px; text-align: right;';
                    timestampDiv.textContent = new Date(msg.timestamp).toLocaleString();
                    contentDiv.appendChild(timestampDiv);
                    
                    messageDiv.appendChild(headerDiv);
                    messageDiv.appendChild(contentDiv);
                    
                    return messageDiv;
                }
                
                function createCodeSuggestion(suggestion) {
                    const suggestionDiv = document.createElement('div');
                    suggestionDiv.className = 'code-suggestion fade-in';
                    
                    const headerDiv = document.createElement('div');
                    headerDiv.className = 'code-suggestion-header';
                    headerDiv.innerHTML = `
                        <span>💡 \${suggestion.title || suggestion.file || 'Code Suggestion'}</span>
                        <div>
                            <button class="apply-code-btn" onclick="applyCodeSuggestion('\${escapeHtml(suggestion.code)}', '\${suggestion.file || ''}')">
                                Apply
                            </button>
                            <button class="message-action" onclick="previewCode('\${escapeHtml(suggestion.code)}', '\${suggestion.file || ''}')">
                                Preview
                            </button>
                        </div>
                    `;
                    
                    const contentDiv = document.createElement('div');
                    contentDiv.className = 'code-suggestion-content';
                    contentDiv.innerHTML = `<pre data-language="\${suggestion.language || 'code'}"><code>\${escapeHtml(suggestion.code)}</code></pre>`;
                    
                    if (suggestion.explanation) {
                        const explanationDiv = document.createElement('div');
                        explanationDiv.innerHTML = `<em>\${suggestion.explanation}</em>`;
                        explanationDiv.style.marginTop = '8px';
                        explanationDiv.style.fontSize = '0.9em';
                        explanationDiv.style.color = 'var(--vscode-descriptionForeground)';
                        contentDiv.appendChild(explanationDiv);
                    }
                    
                    suggestionDiv.appendChild(headerDiv);
                    suggestionDiv.appendChild(contentDiv);
                    
                    return suggestionDiv;
                }
                
                function updateSessions(sessionsList) {
                    sessions = sessionsList;
                    const sessionsListDiv = document.getElementById('sessionsList');
                    sessionsListDiv.innerHTML = '';
                    
                    sessions.forEach(session => {
                        const sessionDiv = document.createElement('div');
                        sessionDiv.className = `session-item \${session.isActive ? 'active' : ''}`;
                        sessionDiv.onclick = () => switchSession(session.id);
                        
                        sessionDiv.innerHTML = `
                            <div class="session-name">\${session.name}</div>
                            <div class="session-meta">
                                <span>\${session.messageCount} msgs</span>
                                <span>\${formatTimeAgo(session.lastActivity)}</span>
                                <div class="session-actions">
                                    \${session.id !== 'default' ? `<button class="session-delete" onclick="deleteSession('\${session.id}'); event.stopPropagation();" title="Delete Session">✕</button>` : ''}
                                </div>
                            </div>
                        `;
                        
                        sessionsListDiv.appendChild(sessionDiv);
                    });
                }
                
                function updateStatus(data) {
                    if (data.sessionId) {
                        const session = sessions.find(s => s.id === data.sessionId);
                        document.getElementById('sessionName').textContent = session ? session.name : data.sessionId;
                    }
                    
                    if (data.projectContext) {
                        updateProjectContext(data.projectContext);
                    }
                    
                    const streamingIndicator = document.getElementById('streamingIndicator');
                    streamingIndicator.textContent = data.isStreaming ? '🌊 Streaming' : '';
                    
                    isStreaming = data.isStreaming || false;
                    document.getElementById('streamingMode').checked = isStreaming;
                    updateStreamToggle();
                }
                
                function updateProjectContext(context) {
                    projectContext = context;
                    const contextInfo = document.getElementById('contextInfo');
                    const projectType = document.getElementById('projectType');
                    
                    if (context.projectType) {
                        const depCount = context.dependencies?.length || 0;
                        const branch = context.gitBranch || 'no-git';
                        contextInfo.textContent = `\${context.projectType} • \${depCount} dependencies • \${branch} branch`;
                        projectType.textContent = `🏗️ \${context.projectType}`;
                    }
                }
                
                function formatMessageContent(content) {
                    return content
                        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                        .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>')
                        .replace(/```(\\w+)?\\n([\\s\\S]*?)\\n```/g, (match, lang, code) => {
                            return `<pre data-language="\${lang || 'code'}"><code>\${escapeHtml(code)}</code></pre>`;
                        })
                        .replace(/`([^`]+)`/g, '<code>$1</code>')
                        .replace(/\\n/g, '<br>')
                        .replace(/(https?:\\/\\/[^\\s]+)/g, '<a href="$1" target="_blank">$1</a>');
                }
                
                function escapeHtml(text) {
                    const div = document.createElement('div');
                    div.textContent = text;
                    return div.innerHTML;
                }
                
                function formatTimeAgo(timestamp) {
                    const now = new Date();
                    const time = new Date(timestamp);
                    const diffMs = now - time;
                    const diffMins = Math.floor(diffMs / 60000);
                    const diffHours = Math.floor(diffMs / 3600000);
                    const diffDays = Math.floor(diffMs / 86400000);
                    
                    if (diffMins < 1) return 'now';
                    if (diffMins < 60) return `\${diffMins}m`;
                    if (diffHours < 24) return `\${diffHours}h`;
                    if (diffDays < 7) return `\${diffDays}d`;
                    return time.toLocaleDateString();
                }
                
                function estimateTokens(text) {
                    // Rough token estimation (1 token ≈ 4 characters)
                    return Math.ceil(text.length / 4);
                }
                
                // Mode management
                function setMode(mode) {
                    currentMode = mode;
                    
                    // Update mode buttons
                    document.querySelectorAll('.mode-btn').forEach(btn => {
                        btn.classList.toggle('active', btn.dataset.mode === mode);
                    });
                    
                    // Update input placeholder and mode indicator
                    const input = document.getElementById('messageInput');
                    const modeIndicator = document.getElementById('currentMode');
                    
                    const modeConfig = {
                        chat: {
                            placeholder: 'Ask me anything about your code...',
                            indicator: '💬 Chat Mode',
                            emoji: '💬'
                        },
                        code: {
                            placeholder: 'Describe the code you want to generate or analyze...',
                            indicator: '💻 Code Mode',
                            emoji: '💻'
                        },
                        review: {
                            placeholder: 'Ask me to review your code for issues...',
                            indicator: '🔍 Review Mode',
                            emoji: '🔍'
                        },
                        test: {
                            placeholder: 'Request test generation or test analysis...',
                            indicator: '🧪 Test Mode',
                            emoji: '🧪'
                        }
                    };
                    
                    const config = modeConfig[mode] || modeConfig.chat;
                    input.placeholder = config.placeholder;
                    modeIndicator.textContent = config.indicator;
                    
                    // Add visual feedback
                    input.style.borderColor = 'var(--vscode-button-background)';
                    setTimeout(() => {
                        input.style.borderColor = 'var(--vscode-input-border)';
                    }, 500);
                }
                
                function setModeAndFocus(mode) {
                    setMode(mode);
                    document.getElementById('messageInput').focus();
                    
                    // Post mode change to extension
                    vscode.postMessage({ type: 'setAgentMode', mode: mode });
                }
                
                // Mode button handlers
                document.querySelectorAll('.mode-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const mode = btn.dataset.mode;
                        setModeAndFocus(mode);
                    });
                });
                
                function sendMessage() {
                    const input = document.getElementById('messageInput');
                    const message = input.value.trim();
                    
                    if (!message || isWaitingForResponse) return;
                    
                    vscode.postMessage({
                        type: 'sendMessage',
                        text: message,
                        mode: currentMode
                    });
                    
                    input.value = '';
                    input.style.height = 'auto';
                    isWaitingForResponse = true;
                    updateSendButton();
                    
                    // Add typing indicator
                    showTypingIndicator();
                }
                
                function showTypingIndicator() {
                    const chatMessages = document.getElementById('chatMessages');
                    const typingDiv = document.createElement('div');
                    typingDiv.className = 'typing-indicator';
                    typingDiv.id = 'typingIndicator';
                    typingDiv.innerHTML = `
                        🤖 Wayang Code is thinking
                        <div class="typing-dots">
                            <div class="typing-dot"></div>
                            <div class="typing-dot"></div>
                            <div class="typing-dot"></div>
                        </div>
                    `;
                    
                    chatMessages.appendChild(typingDiv);
                    chatMessages.scrollTop = chatMessages.scrollHeight;
                }
                
                function removeTypingIndicator() {
                    const typingIndicator = document.getElementById('typingIndicator');
                    if (typingIndicator) {
                        typingIndicator.remove();
                    }
                }
                
                function stopGeneration() {
                    vscode.postMessage({ type: 'stopGeneration' });
                    isWaitingForResponse = false;
                    updateSendButton();
                    removeTypingIndicator();
                }
                
                function regenerateResponse(messageId) {
                    vscode.postMessage({ type: 'regenerateResponse', messageId: messageId });
                    showTypingIndicator();
                }
                
                function copyMessage(messageId) {
                    const messageElement = document.getElementById(`message-\${messageId}`);
                    const content = messageElement.querySelector('.message-content').textContent;
                    navigator.clipboard.writeText(content).then(() => {
                        showToast('📋 Message copied to clipboard!');
                    }).catch(() => {
                        showToast('❌ Failed to copy message');
                    });
                }
                
                function pinMessage(messageId) {
                    vscode.postMessage({ type: 'pinMessage', messageId: messageId });
                }
                
                function editMessage(messageId) {
                    const messageElement = document.getElementById(`message-\${messageId}`);
                    const contentElement = messageElement.querySelector('.message-content');
                    const currentContent = contentElement.textContent;
                    
                    const newContent = prompt('Edit message:', currentContent);
                    if (newContent !== null && newContent !== currentContent) {
                        vscode.postMessage({ 
                            type: 'editMessage', 
                            messageId: messageId, 
                            newContent: newContent 
                        });
                    }
                }
                
                function retryMessage(messageId) {
                    const messageElement = document.getElementById(`message-\${messageId}`);
                    const content = messageElement.querySelector('.message-content').textContent;
                    
                    // Add the message to input
                    document.getElementById('messageInput').value = content;
                    document.getElementById('messageInput').focus();
                }
                
                function addToMemory(messageId) {
                    const messageElement = document.getElementById(`message-\${messageId}`);
                    const content = messageElement.querySelector('.message-content').textContent;
                    
                    vscode.postMessage({
                        type: 'addToMemory',
                        content: content
                    });
                    
                    showToast('🧠 Added to memory!');
                }
                
                function applyCodeSuggestion(code, file) {
                    vscode.postMessage({
                        type: 'applyCodeSuggestion',
                        code: code,
                        file: file
                    });
                }
                
                function previewCode(code, file) {
                    vscode.postMessage({
                        type: 'previewCodeChanges',
                        changes: [{ code: code, file: file }]
                    });
                }
                
                // Session management
                function toggleSessions() {
                    isSessionsPanelOpen = !isSessionsPanelOpen;
                    const panel = document.getElementById('sessionsPanel');
                    panel.classList.toggle('open', isSessionsPanelOpen);
                }
                
                function createNewSession() {
                    vscode.postMessage({ type: 'newSession' });
                    setTimeout(() => toggleSessions(), 300); // Close panel after creating
                }
                
                function switchSession(sessionId) {
                    vscode.postMessage({ type: 'switchSession', sessionId: sessionId });
                    setTimeout(() => toggleSessions(), 300); // Close panel after switching
                }
                
                function deleteSession(sessionId) {
                    if (confirm('🗑️ Are you sure you want to delete this session?\\n\\nThis action cannot be undone.')) {
                        vscode.postMessage({ type: 'deleteSession', sessionId: sessionId });
                    }
                }
                
                // Search functionality
                function toggleSearch() {
                    isSearchOpen = !isSearchOpen;
                    const container = document.getElementById('searchContainer');
                    container.style.display = isSearchOpen ? 'block' : 'none';
                    
                    if (isSearchOpen) {
                        document.getElementById('searchInput').focus();
                    } else {
                        document.getElementById('searchResults').innerHTML = '';
                    }
                }
                
                function searchHistory() {
                    const query = document.getElementById('searchInput').value.trim();
                    if (query.length >= 2) {
                        vscode.postMessage({ type: 'searchHistory', query: query });
                    } else {
                        document.getElementById('searchResults').innerHTML = '';
                    }
                }
                
                function showSearchResults(results, query) {
                    const resultsDiv = document.getElementById('searchResults');
                    resultsDiv.innerHTML = '';
                    
                    if (results.length === 0) {
                        resultsDiv.innerHTML = '<div class="search-result">🔍 No results found</div>';
                        return;
                    }
                    
                    results.forEach(result => {
                        const resultDiv = document.createElement('div');
                        resultDiv.className = 'search-result';
                        resultDiv.onclick = () => scrollToMessage(result.id);
                        
                        const preview = result.content.substring(0, 120) + (result.content.length > 120 ? '...' : '');
                        const highlightedPreview = preview.replace(
                            new RegExp(escapeRegex(query), 'gi'), 
                            `<mark style="background-color: var(--vscode-editor-findMatchHighlightBackground); padding: 1px 2px; border-radius: 2px;">\</mark>`
                        );
                        
                        const roleEmoji = result.type === 'user' ? '👤' : '🤖';
                        const roleName = result.type === 'user' ? 'You' : 'Wayang Code';
                        
                        resultDiv.innerHTML = `
                            <div style="font-weight: 600; margin-bottom: 4px;">
                                \${roleEmoji} \${roleName}
                                \${result.pinned ? '📌' : ''}
                                \${result.mode ? `<span style="color: var(--vscode-descriptionForeground);">(\${result.mode})</span>` : ''}
                            </div>
                            <div style="margin-bottom: 4px;">\${highlightedPreview}</div>
                            <div style="font-size: 0.8em; color: var(--vscode-descriptionForeground);">
                                \${formatTimeAgo(result.timestamp)}
                            </div>
                        `;
                        
                        resultsDiv.appendChild(resultDiv);
                    });
                }
                
                function escapeRegex(string) {
                    return string.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\');
                }
                
                function scrollToMessage(messageId) {
                    const messageElement = document.getElementById(`message-\${messageId}`);
                    if (messageElement) {
                        messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        messageElement.classList.add('highlight-animation');
                        
                        setTimeout(() => {
                            messageElement.classList.remove('highlight-animation');
                        }, 2000);
                    }
                    toggleSearch(); // Close search after navigating
                }
                
                // Export functionality
                function showExportMenu() {
                    const options = [
                        { format: 'markdown', icon: '📝', label: 'Markdown' },
                        { format: 'json', icon: '📄', label: 'JSON' },
                        { format: 'html', icon: '🌐', label: 'HTML' }
                    ];
                    
                    let menu = 'Choose export format:\\n\\n';
                    options.forEach((opt, index) => {
                        menu += `\${index + 1}. \${opt.icon} \${opt.label}\\n`;
                    });
                    
                    const choice = prompt(menu + '\\nEnter number (1-3):');
                    const selectedOption = options[parseInt(choice) - 1];
                    
                    if (selectedOption) {
                        vscode.postMessage({ type: 'exportChat', format: selectedOption.format });
                    }
                }
                
                function saveConversation() {
                    vscode.postMessage({ type: 'saveConversation' });
                }
                
                function loadConversation() {
                    if (confirm('⚠️ Loading will replace current conversation.\\n\\nContinue?')) {
                        vscode.postMessage({ type: 'loadConversation' });
                    }
                }
                
                function shareConversation() {
                    vscode.postMessage({ type: 'shareConversation' });
                }
                
                function analyzeProject() {
                    vscode.postMessage({ type: 'analyzeProject' });
                    showToast('📊 Analyzing project...');
                }
                
                function showProjectFiles() {
                    vscode.postMessage({ type: 'getProjectFiles' });
                }
                
                function showProjectFiles(files) {
                    const message = `## 📁 Project Files (\\${files.length})\\n\\n` +
                        files.map(file => `- **\${file.name}** (\${file.type}) - \${file.path}`).join('\\n');
                    
                    // Add as system message
                    const systemMessage = {
                        id: `system_\${Date.now()}`,
                        type: 'assistant',
                        content: message,
                        timestamp: new Date(),
                        system: true
                    };
                    
                    // This would be handled by the extension, but we can show immediate feedback
                    showToast(`📁 Found \${files.length} project files`);
                }
                
                // Other functions
                function clearChat() {
                    if (confirm('🗑️ Clear this conversation?\\n\\nThis action cannot be undone.')) {
                        vscode.postMessage({ type: 'clearChat' });
                    }
                }
                
                function toggleStreaming() {
                    isStreaming = !isStreaming;
                    document.getElementById('streamingMode').checked = isStreaming;
                    updateStreamToggle();
                    
                    vscode.postMessage({ type: 'toggleStreaming' });
                    showToast(`🌊 Streaming \${isStreaming ? 'enabled' : 'disabled'}`);
                }
                
                function updateStreamToggle() {
                    const toggleBtn = document.getElementById('streamToggle');
                    toggleBtn.textContent = isStreaming ? '🛑' : '🌊';
                    toggleBtn.title = isStreaming ? 'Disable Streaming' : 'Enable Streaming';
                }
                
                function toggleProjectContext() {
                    const contextDiv = document.getElementById('projectContext');
                    const isVisible = contextDiv.style.display !== 'none';
                    contextDiv.style.display = isVisible ? 'none' : 'block';
                    document.getElementById('contextToggle').textContent = isVisible ? '📋 Show' : '📋 Hide';
                }
                
                function addCodeSnippet() {
                    const code = prompt('📝 Enter code snippet:');
                    if (!code) return;
                    
                    const language = prompt('Programming language:', 'javascript');
                    if (!language) return;
                    
                    vscode.postMessage({
                        type: 'addCodeSnippet',
                        code: code,
                        language: language
                    });
                }
                
                function showHelp() {
                    const helpContent = `
# 🎭 Wayang Code Help

## Quick Start
1. **Select a mode** - Chat, Code, Review, or Test
2. **Type your question** - Be specific for better results
3. **Use context** - Select code before asking questions

## Features
- **💬 Smart Chat**: Natural conversation about code
- **💻 Code Generation**: Create functions, classes, components
- **🔍 Code Review**: Find bugs and improvements
- **🧪 Test Generation**: Automatic unit test creation
- **📁 Session Management**: Multiple conversation threads
- **🔍 Search**: Find previous conversations
- **📤 Export**: Save conversations in multiple formats

## Tips
- Select code in editor for context-aware responses
- Use \`code blocks\` when discussing specific code
- Pin important messages with 📌
- Try different modes for specialized responses

## Shortcuts
- **Enter**: Send message
- **Shift+Enter**: New line
- **Ctrl+K**: Clear chat
- **Ctrl+F**: Search history
                    `;
                    
                    // Show help as a temporary message
                    const helpDiv = document.createElement('div');
                    helpDiv.className = 'message assistant fade-in';
                    helpDiv.innerHTML = `
                        <div class="message-header">
                            <span>❓ Help & Tips</span>
                            <button class="message-action" onclick="this.parentElement.parentElement.remove()">✕</button>
                        </div>
                        <div class="message-content">\${formatMessageContent(helpContent)}</div>
                    `;
                    
                    const chatMessages = document.getElementById('chatMessages');
                    chatMessages.appendChild(helpDiv);
                    chatMessages.scrollTop = chatMessages.scrollHeight;
                }
                
                function updateSendButton() {
                    const sendButton = document.getElementById('sendButton');
                    const sendButtonText = document.getElementById('sendButtonText');
                    
                    if (isWaitingForResponse) {
                        sendButton.disabled = true;
                        sendButton.classList.add('streaming');
                        sendButtonText.textContent = '🛑 Stop';
                        sendButton.onclick = stopGeneration;
                    } else {
                        sendButton.disabled = false;
                        sendButton.classList.remove('streaming');
                        sendButtonText.textContent = '🚀 Send';
                        sendButton.onclick = sendMessage;
                        removeTypingIndicator();
                    }
                }
                
                function showMemories(memories) {
                    const chatMessages = document.getElementById('chatMessages');
                    const memoriesDiv = document.createElement('div');
                    memoriesDiv.className = 'memories-section slide-up';
                    
                    const headerDiv = document.createElement('div');
                    headerDiv.innerHTML = '<strong>🧠 Memory Context (' + memories.length + ' items)</strong>';
                    headerDiv.style.marginBottom = '10px';
                    memoriesDiv.appendChild(headerDiv);
                    
                    memories.forEach(memory => {
                        const memoryItem = document.createElement('div');
                        memoryItem.className = 'memory-item';
                        memoryItem.innerHTML = `
                            <span>\${memory.query || memory.summary}</span>
                            <span style="font-size: 0.8em; color: var(--vscode-descriptionForeground);">
                                \${formatTimeAgo(memory.timestamp)}
                            </span>
                        `;
                        memoriesDiv.appendChild(memoryItem);
                    });
                    
                    chatMessages.insertBefore(memoriesDiv, chatMessages.firstChild);
                    chatMessages.scrollTop = 0;
                }
                
                function showToast(message, type = 'info') {
                    const toast = document.createElement('div');
                    toast.className = 'toast';
                    
                    const bgColors = {
                        info: 'var(--vscode-notificationsInfoIcon-foreground)',
                        success: 'var(--vscode-testing-iconPassed)',
                        error: 'var(--vscode-errorForeground)',
                        warning: 'var(--vscode-notificationsWarningIcon-foreground)'
                    };
                    
                    toast.style.background = `linear-gradient(135deg, \${bgColors[type]}, var(--vscode-button-background))`;
                    toast.textContent = message;
                    
                    document.body.appendChild(toast);
                    
                    setTimeout(() => {
                        toast.style.animation = 'slideOutRight 0.4s ease-in';
                        setTimeout(() => {
                            if (document.body.contains(toast)) {
                                document.body.removeChild(toast);
                            }
                        }, 400);
                    }, 3000);
                }
                
                // Event listeners with enhanced functionality
                document.getElementById('messageInput').addEventListener('input', function() {
                    // Auto-resize
                    this.style.height = 'auto';
                    this.style.height = Math.min(this.scrollHeight, 150) + 'px';
                    
                    // Word count and character limit
                    const wordCount = this.value.trim().split(/\\s+/).length;
                    const charCount = this.value.length;
                    
                    // Show word count for long messages
                    if (charCount > 100) {
                        this.title = `\${wordCount} words, \${charCount} characters`;
                    } else {
                        this.title = '';
                    }
                });
                
                document.getElementById('messageInput').addEventListener('keydown', function(e) {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                    } else if (e.key === 'Escape') {
                        this.blur();
                    } else if (e.ctrlKey || e.metaKey) {
                        switch (e.key) {
                            case 'k':
                                e.preventDefault();
                                clearChat();
                                break;
                            case 'f':
                                e.preventDefault();
                                toggleSearch();
                                break;
                            case 's':
                                e.preventDefault();
                                saveConversation();
                                break;
                        }
                    }
                });
                
                document.getElementById('searchInput').addEventListener('input', function() {
                    clearTimeout(this.searchTimeout);
                    this.searchTimeout = setTimeout(() => {
                        if (this.value.trim()) {
                            searchHistory();
                        } else {
                            document.getElementById('searchResults').innerHTML = '';
                        }
                    }, 300);
                });
                
                // Settings handlers
                document.getElementById('autoApply').addEventListener('change', function() {
                    vscode.postMessage({
                        type: 'updateSetting',
                        setting: 'autoApplyChanges',
                        value: this.checked
                    });
                    
                    showToast(`🔧 Auto-apply \${this.checked ? 'enabled' : 'disabled'}`);
                });
                
                document.getElementById('includeContext').addEventListener('change', function() {
                    vscode.postMessage({
                        type: 'updateSetting',
                        setting: 'includeProjectContext',
                        value: this.checked
                    });
                    
                    showToast(`📋 Project context \${this.checked ? 'enabled' : 'disabled'}`);
                });
                
                document.getElementById('streamingMode').addEventListener('change', function() {
                    if (this.checked !== isStreaming) {
                        toggleStreaming();
                    }
                });
                
                // Keyboard shortcuts
                document.addEventListener('keydown', function(e) {
                    if (e.ctrlKey || e.metaKey) {
                        switch (e.key) {
                            case 'n':
                                if (e.shiftKey) {
                                    e.preventDefault();
                                    createNewSession();
                                }
                                break;
                            case 'e':
                                if (e.shiftKey) {
                                    e.preventDefault();
                                    showExportMenu();
                                }
                                break;
                        }
                    }
                });
                
                // Initialize application
                function initialize() {
                    updateSendButton();
                    setMode('chat');
                    updateStreamToggle();
                    
                    // Load user preferences
                    const savedSettings = JSON.parse(localStorage.getItem('wayangSettings') || '{}');
                    if (savedSettings.autoApply) {
                        document.getElementById('autoApply').checked = savedSettings.autoApply;
                    }
                    if (savedSettings.includeContext !== undefined) {
                        document.getElementById('includeContext').checked = savedSettings.includeContext;
                    }
                    
                    // Show welcome animation
                    const welcomeMessage = document.querySelector('.welcome-message');
                    if (welcomeMessage) {
                        welcomeMessage.style.animation = 'fadeIn 0.8s ease-out';
                    }
                    
                    // Focus input
                    setTimeout(() => {
                        document.getElementById('messageInput').focus();
                    }, 500);
                }
                
                // Save user preferences
                function saveSettings() {
                    const settings = {
                        autoApply: document.getElementById('autoApply').checked,
                        includeContext: document.getElementById('includeContext').checked,
                        streamingMode: isStreaming
                    };
                    localStorage.setItem('wayangSettings', JSON.stringify(settings));
                }
                
                // Auto-save settings on change
                document.querySelectorAll('.feature-checkbox').forEach(checkbox => {
                    checkbox.addEventListener('change', saveSettings);
                });
                
                // Enhanced error handling
                window.addEventListener('error', function(e) {
                    console.error('Webview error:', e);
                    showToast('❌ An error occurred. Check console for details.', 'error');
                });
                
                // Performance monitoring
                let performanceMetrics = {
                    messagesSent: 0,
                    responsesReceived: 0,
                    averageResponseTime: 0,
                    startTime: Date.now()
                };
                
                function trackPerformance(action, data = {}) {
                    performanceMetrics[action] = (performanceMetrics[action] || 0) + 1;
                    
                    if (action === 'responseReceived' && data.responseTime) {
                        const currentAvg = performanceMetrics.averageResponseTime;
                        const count = performanceMetrics.responsesReceived;
                        performanceMetrics.averageResponseTime = 
                            (currentAvg * (count - 1) + data.responseTime) / count;
                    }
                }
                
                // Initialize the application
                initialize();
                
                // Add CSS for additional features
                const additionalStyles = document.createElement('style');
                additionalStyles.textContent = `
                    .message-content h1, .message-content h2, .message-content h3 {
                        color: var(--vscode-foreground);
                        margin: 16px 0 8px 0;
                        font-weight: 600;
                    }
                    
                    .message-content h1 { font-size: 1.3em; }
                    .message-content h2 { font-size: 1.2em; }
                    .message-content h3 { font-size: 1.1em; }
                    
                    .message-content ul, .message-content ol {
                        margin: 8px 0;
                        padding-left: 20px;
                    }
                    
                    .message-content li {
                        margin: 4px 0;
                    }
                    
                    .message-content hr {
                        border: none;
                        height: 1px;
                        background: linear-gradient(90deg, transparent, var(--vscode-widget-border), transparent);
                        margin: 16px 0;
                    }
                    
                    .copy-code-btn {
                        position: absolute;
                        top: 8px;
                        right: 35px;
                        background: var(--vscode-button-secondaryBackground);
                        border: none;
                        color: var(--vscode-button-secondaryForeground);
                        padding: 4px 8px;
                        border-radius: 3px;
                        cursor: pointer;
                        font-size: 0.7em;
                        opacity: 0;
                        transition: opacity 0.2s ease;
                    }
                    
                    pre:hover .copy-code-btn {
                        opacity: 1;
                    }
                    
                    .copy-code-btn:hover {
                        background: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                    }
                `;
                document.head.appendChild(additionalStyles);
                
                // Add copy buttons to code blocks
                function addCopyButtonsToCodeBlocks() {
                    document.querySelectorAll('pre code').forEach(block => {
                        if (!block.parentElement.querySelector('.copy-code-btn')) {
                            const copyBtn = document.createElement('button');
                            copyBtn.className = 'copy-code-btn';
                            copyBtn.textContent = '📋';
                            copyBtn.title = 'Copy code';
                            copyBtn.onclick = () => {
                                navigator.clipboard.writeText(block.textContent).then(() => {
                                    copyBtn.textContent = '✅';
                                    setTimeout(() => {
                                        copyBtn.textContent = '📋';
                                    }, 1000);
                                    showToast('📋 Code copied!');
                                });
                            };
                            block.parentElement.appendChild(copyBtn);
                        }
                    });
                }
                
                // Enhanced MutationObserver for dynamic content
                const observer = new MutationObserver((mutations) => {
                    mutations.forEach((mutation) => {
                        if (mutation.type === 'childList') {
                            // Add copy buttons to new code blocks
                            addCopyButtonsToCodeBlocks();
                            
                            // Enhance new message elements
                            mutation.addedNodes.forEach(node => {
                                if (node.nodeType === Node.ELEMENT_NODE && node.classList?.contains('message')) {
                                    // Add intersection observer for scroll animations
                                    if ('IntersectionObserver' in window) {
                                        const scrollObserver = new IntersectionObserver((entries) => {
                                            entries.forEach(entry => {
                                                if (entry.isIntersecting) {
                                                    entry.target.style.transform = 'translateX(0)';
                                                    entry.target.style.opacity = '1';
                                                }
                                            });
                                        }, { threshold: 0.1 });
                                        
                                        scrollObserver.observe(node);
                                    }
                                }
                            });
                        }
                    });
                });
                
                observer.observe(document.getElementById('chatMessages'), {
                    childList: true,
                    subtree: true
                });
                
                // Enhanced accessibility
                function setupAccessibility() {
                    // Add ARIA labels
                    document.getElementById('messageInput').setAttribute('aria-label', 'Type your message');
                    document.getElementById('sendButton').setAttribute('aria-label', 'Send message');
                    document.getElementById('chatMessages').setAttribute('aria-label', 'Chat conversation');
                    
                    // Add keyboard navigation for messages
                    document.addEventListener('keydown', (e) => {
                        if (e.ctrlKey && e.key === 'ArrowUp') {
                            // Navigate to previous message
                            navigateMessages(-1);
                        } else if (e.ctrlKey && e.key === 'ArrowDown') {
                            // Navigate to next message
                            navigateMessages(1);
                        }
                    });
                }
                
                function navigateMessages(direction) {
                    const messages = document.querySelectorAll('.message');
                    const current = document.querySelector('.message.focused');
                    let index = current ? Array.from(messages).indexOf(current) : -1;
                    
                    // Remove current focus
                    if (current) current.classList.remove('focused');
                    
                    // Calculate new index
                    index += direction;
                    if (index < 0) index = messages.length - 1;
                    if (index >= messages.length) index = 0;
                    
                    // Focus new message
                    if (messages[index]) {
                        messages[index].classList.add('focused');
                        messages[index].scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }
                
                // Setup accessibility on load
                setupAccessibility();
                
                // Performance optimization - Virtual scrolling for large conversations
                function setupVirtualScrolling() {
                    const chatMessages = document.getElementById('chatMessages');
                    let isScrolling = false;
                    
                    chatMessages.addEventListener('scroll', () => {
                        if (!isScrolling) {
                            window.requestAnimationFrame(() => {
                                // Implement virtual scrolling logic here for very large conversations
                                // This would hide messages outside viewport for better performance
                                isScrolling = false;
                            });
                            isScrolling = true;
                        }
                    });
                }
                
                // setupVirtualScrolling(); // Uncomment for large conversations
                
                // Final initialization
                document.addEventListener('DOMContentLoaded', () => {
                    showToast('🎭 Wayang Code is ready!', 'success');
                });
            </script>
        </body>
        </html>`;
    }
}