import * as vscode from 'vscode';
import { AgentClient } from '../clients/agentClient';
import { ChatMessage, LoadingMessages, StreamCallback } from '../types/chatTypes';
import { simpleIDgenerator } from '../utils/helper';

export class ChatService {
    private chatHistory: ChatMessage[] = [];
    private isStreaming: boolean = false;
    private currentStreamMessageId?: string;

    private streamCallback?: StreamCallback;

    constructor(private agentClient: AgentClient) {}

    setStreamCallback(cb: StreamCallback) {
        this.streamCallback = cb;
    }

    async askAgent(message: string, mode: string = "chat", context: any = {}) {
        const userMessage: ChatMessage = {
            id: simpleIDgenerator(),
            type: "user",
            content: message,
            timestamp: new Date(),
            mode,
            context,
        };

        this.chatHistory.push(userMessage);

        const taskId = await this.agentClient.sendQuery({
            id: userMessage.id,
            query: message,
            context,
            streaming: this.isStreaming,
        });

        const loadingMessage: ChatMessage = {
            id: `loading_${taskId}`,
            type: "assistant",
            content: this.getLoadingMessage(mode),
            timestamp: new Date(),
            loading: true,
            mode,
        };

        this.chatHistory.push(loadingMessage);
        this.currentStreamMessageId = loadingMessage.id;

        // Notify initial loading
        this.streamCallback?.(this.chatHistory);

        return { taskId, loadingMessageId: loadingMessage.id };
    }

    handleStreamChunk(messageId: string, chunk: any) {
        const index = this.chatHistory.findIndex((msg) => msg.id === messageId);
        if (index === -1) return;

        const msg = this.chatHistory[index];

        if (chunk.type === "content") {
            if (msg.loading) {
                msg.content = chunk.data;
                msg.loading = false;
            } else {
                msg.content += chunk.data;
            }
        } else if (chunk.type === "code_suggestion") {
            msg.codeSuggestions = [...(msg.codeSuggestions || []), chunk.data];
        }

        // Notify webview about updated chat
        this.streamCallback?.(this.chatHistory);
    }

    handleAgentResponse(loadingMessageId: string, response: any) {
        const index = this.chatHistory.findIndex((msg) => msg.id === loadingMessageId);
        if (index === -1) return;

        const updated: ChatMessage = {
            ...this.chatHistory[index],
            content: this.formatAgentResponse(response),
            loading: false,
            codeChanges: response.data?.codeChanges,
            analysis: response.data?.analysis,
            toolUse: response.data?.toolUse,
            confidence: response.confidence,
            sources: response.sources,
        };

        this.chatHistory[index] = updated;
        this.currentStreamMessageId = undefined;

        this.streamCallback?.(this.chatHistory);
    }


    stopGeneration() {
        if (this.currentStreamMessageId) {
            const messageIndex = this.chatHistory.findIndex(
                msg => msg.id === this.currentStreamMessageId
            );
            
            if (messageIndex !== -1) {
                this.chatHistory[messageIndex] = {
                    ...this.chatHistory[messageIndex],
                    content: this.chatHistory[messageIndex].content + "\n\n*Generation stopped by user*",
                    loading: false,
                };
            }
            
            this.currentStreamMessageId = undefined;
        }
    }

    private getLoadingMessage(mode: string): string {
        const messages: LoadingMessages = {
            chat: "Thinking...",
            code: "Analyzing code...",
            review: "Reviewing code...",
            test: "Generating tests...",
        };
        
        if (mode in messages) {
            return messages[mode as keyof LoadingMessages];
        }
        
        return "Processing...";
    }

    private formatAgentResponse(response: any): string {
        let content = response.message || "Task completed";

        if (response.confidence) {
            const confidenceEmoji = response.confidence > 0.8 ? "🟢" : 
                                   response.confidence > 0.6 ? "🟡" : "🔴";
            content = `${confidenceEmoji} (${Math.round(response.confidence * 100)}% confidence)\n\n${content}`;
        }

        if (response.data?.codeChanges) {
            content += "\n\n**📝 Code Changes:**";
            response.data.codeChanges.forEach((change: any, index: number) => {
                content += `\n\n${index + 1}. **${change.file}** (${change.type || 'modify'})`;
                content += `\n\`\`\`${change.language || "text"}\n${change.content}\n\`\`\``;
                if (change.explanation) {
                    content += `\n*${change.explanation}*`;
                }
            });
        }

        if (response.data?.analysis) {
            content += "\n\n**📊 Analysis Results:**";
            content += `\n${response.data.analysis.summary}`;
        }

        if (response.data?.suggestions) {
            content += "\n\n**💭 Suggestions:**";
            response.data.suggestions.forEach((suggestion: string, index: number) => {
                content += `\n${index + 1}. ${suggestion}`;
            });
        }

        if (response.sources?.length > 0) {
            content += "\n\n**📚 Sources:**";
            response.sources.forEach((source: string, index: number) => {
                content += `\n${index + 1}. ${source}`;
            });
        }

        return content;
    }

    // Getters and setters
    getChatHistory(): ChatMessage[] {
        return this.chatHistory;
    }

    setChatHistory(history: ChatMessage[]) {
        this.chatHistory = history;
    }

    clearChat() {
        this.chatHistory = [];
    }

    getIsStreaming(): boolean {
        return this.isStreaming;
    }

    setIsStreaming(streaming: boolean) {
        this.isStreaming = streaming;
    }

    getCurrentStreamMessageId(): string | undefined {
        return this.currentStreamMessageId;
    }
}