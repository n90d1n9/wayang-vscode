import * as vscode from 'vscode';
import { ChatMessage } from '../types/chatTypes';

export class SessionService {
    private chatSessions: Map<string, ChatMessage[]> = new Map();
    private currentSessionId: string = "default";

    constructor() {
        this.initializeSessions();
    }

    private initializeSessions() {
        if (!this.chatSessions.has("default")) {
            this.chatSessions.set("default", []);
        }
    }

    createNewSession(): string {
        const sessionId = `session_${Date.now()}`;
        this.chatSessions.set(sessionId, []);
        return sessionId;
    }

    switchSession(sessionId: string): ChatMessage[] {
        // Save current session
        const currentHistory = this.getCurrentSessionHistory();
        this.chatSessions.set(this.currentSessionId, [...currentHistory]);
        
        // Switch to new session
        this.currentSessionId = sessionId;
        return this.chatSessions.get(sessionId) || [];
    }

    deleteSession(sessionId: string): boolean {
        if (this.chatSessions.size > 1 && sessionId !== "default") {
            this.chatSessions.delete(sessionId);
            return true;
        }
        return false;
    }

    getCurrentSessionId(): string {
        return this.currentSessionId;
    }

    getCurrentSessionHistory(): ChatMessage[] {
        return this.chatSessions.get(this.currentSessionId) || [];
    }

    setCurrentSessionHistory(history: ChatMessage[]) {
        this.chatSessions.set(this.currentSessionId, history);
    }

    getAllSessions(): Map<string, ChatMessage[]> {
        return this.chatSessions;
    }

    getSessionList() {
        return Array.from(this.chatSessions.entries()).map(([id, messages]) => ({
            id,
            name: this.getSessionName(id, messages),
            messageCount: messages.length,
            lastActivity: this.getLastActivity(messages),
            isActive: id === this.currentSessionId,
        }));
    }

    private getSessionName(sessionId: string, messages: ChatMessage[]): string {
        if (sessionId === "default") {return "Default Session";}
        
        const firstUserMessage = messages.find(msg => msg.type === "user");
        if (firstUserMessage) {
            return firstUserMessage.content.substring(0, 30) + "...";
        }
        
        return `Session ${sessionId.split("_")[1]}`;
    }

    private getLastActivity(messages: ChatMessage[]): Date {
        if (messages.length === 0) {return new Date();}
        return messages[messages.length - 1].timestamp;
    }
}