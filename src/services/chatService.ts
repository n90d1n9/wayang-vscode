import * as vscode from 'vscode';
import { AgentClient } from '../clients/agentClient';
import { ChatMessage, ProjectContext } from '../types/chatTypes';

export class ChatService {
    private chatHistory: ChatMessage[] = [];
    private isStreaming: boolean = false;
    private currentStreamMessageId?: string;

    constructor(private agentClient: AgentClient) {}

    async handleUserMessage(message: string, mode: string = "chat", context: any) {
        const userMessage: ChatMessage = {
            id: Date.now().toString(),
            type: "user",
            content: message,
            timestamp: new Date(),
            mode: mode,
            context: context,
        };

        this.chatHistory.push(userMessage);

        try {
            const taskId = await this.agentClient.sendQuery({
                id: userMessage.id,
                query: message,
                context: context,
                streaming: this.isStreaming,
            });

            const loadingMessage: ChatMessage = {
                id: `loading_${taskId}`,
                type: "assistant",
                content: this.getLoadingMessage(mode),
                timestamp: new Date(),
                loading: true,
                mode: mode,
            };

            this.chatHistory.push(loadingMessage);
            this.currentStreamMessageId = loadingMessage.id;

            return { taskId, loadingMessageId: loadingMessage.id };
        } catch (error) {
            throw error;
        }
    }

    handleStreamChunk(messageId: string, chunk: any) {
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
        }
    }

    handleAgentResponse(loadingMessageId: string, response: any) {
        const loadingIndex = this.chatHistory.findIndex((msg) => msg.id === loadingMessageId);

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
            this.currentStreamMessageId = undefined;
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

    private formatAgentResponse(response: any): string {
        // ... implementation from your original code
        return response.message || "Task completed";
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
}