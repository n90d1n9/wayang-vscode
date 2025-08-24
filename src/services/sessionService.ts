import * as vscode from 'vscode';
import { ChatMessage, SessionInfo } from '../types/chatTypes';

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
            const success = this.chatSessions.delete(sessionId);
            
            if (this.currentSessionId === sessionId) {
                this.currentSessionId = "default";
            }
            
            return success;
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

    

    getSessionList(): SessionInfo[] {
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
            const truncated = firstUserMessage.content.substring(0, 30);
            return truncated + (firstUserMessage.content.length > 30 ? "..." : "");
        }
        
        return `Session ${sessionId.split("_")[1]}`;
    }

    private getLastActivity(messages: ChatMessage[]): Date {
        if (messages.length === 0) {return new Date();};
        return messages[messages.length - 1].timestamp;
    }

    saveToWorkspace() {
        const sessionsObj = Object.fromEntries(this.chatSessions);
        vscode.workspace.getConfiguration("wayang").update(
            "chatSessions",
            sessionsObj,
            vscode.ConfigurationTarget.Workspace,
        );
    }

    setAllSessions(sessions: Record<string, ChatMessage[]>) {
        // Clear existing sessions
        this.chatSessions.clear();
        
        // Add all sessions from the record
        Object.entries(sessions).forEach(([id, messages]) => {
            // Ensure messages is always an array
            this.chatSessions.set(id, Array.isArray(messages) ? messages : []);
        });
        
        // Ensure default session exists
        if (!this.chatSessions.has("default")) {
            this.chatSessions.set("default", []);
        }
    }

    loadFromWorkspace() {
        try {
            // Use a more specific type for the default value
            const saved = vscode.workspace.getConfiguration("wayang").get<Record<string, ChatMessage[]>>(
                "chatSessions", 
                { default: [] } // Provide proper default structure
            );
            
            if (saved && typeof saved === "object" && !Array.isArray(saved)) {
                // Validate and convert the saved data
                const validSessions: Record<string, ChatMessage[]> = {};
                
                Object.entries(saved).forEach(([sessionId, messages]) => {
                    if (typeof sessionId === 'string' && Array.isArray(messages)) {
                        // Validate each message in the array
                        const validMessages = messages.filter(msg => 
                            msg && 
                            typeof msg.id === 'string' &&
                            typeof msg.type === 'string' &&
                            typeof msg.content === 'string' &&
                            msg.timestamp instanceof Date
                        );
                        
                        validSessions[sessionId] = validMessages;
                    }
                });
                
                this.setAllSessions(validSessions);
            }
        } catch (error) {
            console.error("Error loading sessions from workspace:", error);
            // Reset to default sessions on error
            this.chatSessions.clear();
            this.chatSessions.set("default", []);
        }
    }

    // Alternative simpler approach:
    loadFromWorkspaceSimple() {
        try {
            // Get the raw configuration value
            const saved = vscode.workspace.getConfiguration("wayang").get("chatSessions");
            
            if (saved && typeof saved === "object" && !Array.isArray(saved)) {
                // Type assertion with validation
                const sessions = saved as Record<string, any>;
                
                const validSessions: Record<string, ChatMessage[]> = {};
                
                Object.entries(sessions).forEach(([sessionId, messages]) => {
                    if (Array.isArray(messages)) {
                        // Convert timestamp strings to Date objects if needed
                        const processedMessages = messages.map(msg => ({
                            ...msg,
                            timestamp: msg.timestamp instanceof Date ? 
                                msg.timestamp : 
                                new Date(msg.timestamp || Date.now())
                        }));
                        
                        validSessions[sessionId] = processedMessages;
                    }
                });
                
                this.setAllSessions(validSessions);
            }
        } catch (error) {
            console.error("Error loading sessions:", error);
            this.chatSessions.clear();
            this.chatSessions.set("default", []);
        }
    }

    // Even simpler approach with type guards:
    private isValidSessionData(data: any): data is Record<string, ChatMessage[]> {
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
            return false;
        }
        
        return Object.entries(data).every(([key, value]) => {
            return typeof key === 'string' && Array.isArray(value);
        });
    }

    loadFromWorkspaceWithGuard() {
        const saved = vscode.workspace.getConfiguration("wayang").get("chatSessions");
        
        if (this.isValidSessionData(saved)) {
            this.setAllSessions(saved);
        } else {
            // Handle invalid or missing data
            this.chatSessions.clear();
            this.chatSessions.set("default", []);
        }
    }

}