import * as vscode from 'vscode';
import { ProjectInfo, SessionInfo, TokenUsage, ChatMessage } from '../types/chatTypes';

export class ProjectSessionService {
    private projects: Map<string, ProjectInfo> = new Map();
    private sessions: Map<string, ChatMessage[]> = new Map();
    private currentProjectId: string | null = null;
    private currentSessionId: string | null = null;
    private tokenUsage: Map<string, TokenUsage> = new Map();

    constructor() {
        this.initializeDefaultProject();
    }

    private initializeDefaultProject() {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            const defaultProject: ProjectInfo = {
                id: 'default',
                name: workspaceFolders[0].name,
                path: workspaceFolders[0].uri.fsPath,
                createdAt: new Date(),
                lastActivity: new Date(),
                sessionCount: 1,
                totalTokenUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
            };
            this.projects.set('default', defaultProject);
            this.currentProjectId = 'default';
            
            // Create default session
            this.sessions.set('default', []);
            this.currentSessionId = 'default';
        }
    }

    // Project Management
    async createProject(name: string, path?: string): Promise<ProjectInfo> {
        const projectId = `project_${Date.now()}`;
        const workspacePath = path || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
        
        const project: ProjectInfo = {
            id: projectId,
            name,
            path: workspacePath,
            createdAt: new Date(),
            lastActivity: new Date(),
            sessionCount: 0,
            totalTokenUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
        };
        
        this.projects.set(projectId, project);
        await this.switchProject(projectId);
        this.saveToWorkspace();
        
        return project;
    }

    async switchProject(projectId: string): Promise<boolean> {
        if (!this.projects.has(projectId)) {
            return false;
        }
        
        // Save current session state
        if (this.currentSessionId) {
            this.saveCurrentSession();
        }
        
        this.currentProjectId = projectId;
        const project = this.projects.get(projectId)!;
        project.lastActivity = new Date();
        
        // Get or create first session for this project
        const sessions = this.getProjectSessions(projectId);
        if (sessions.length === 0) {
            await this.createNewSession(projectId);
        } else {
            this.currentSessionId = sessions[0].id;
        }
        
        this.saveToWorkspace();
        return true;
    }

    async deleteProject(projectId: string): Promise<boolean> {
        if (projectId === 'default' || !this.projects.has(projectId)) {
            return false;
        }
        
        // Delete all sessions associated with this project
        const sessions = this.getProjectSessions(projectId);
        for (const session of sessions) {
            this.sessions.delete(session.id);
        }
        
        this.projects.delete(projectId);
        
        // Switch to default if current project was deleted
        if (this.currentProjectId === projectId) {
            await this.switchProject('default');
        }
        
        this.saveToWorkspace();
        return true;
    }

    async renameProject(projectId: string, newName: string): Promise<boolean> {
        const project = this.projects.get(projectId);
        if (!project) {
            return false;
        }
        
        project.name = newName;
        project.lastActivity = new Date();
        this.saveToWorkspace();
        return true;
    }

    getProject(projectId: string): ProjectInfo | undefined {
        return this.projects.get(projectId);
    }

    getAllProjects(): ProjectInfo[] {
        return Array.from(this.projects.values()).sort((a, b) => 
            b.lastActivity.getTime() - a.lastActivity.getTime()
        );
    }

    getCurrentProject(): ProjectInfo | undefined {
        return this.currentProjectId ? this.projects.get(this.currentProjectId) : undefined;
    }

    getCurrentProjectId(): string | null {
        return this.currentProjectId;
    }

    // Session Management
    async createNewSession(projectId?: string): Promise<SessionInfo> {
        const targetProjectId = projectId || this.currentProjectId || 'default';
        const sessionId = `session_${Date.now()}`;
        
        this.sessions.set(sessionId, []);
        this.tokenUsage.set(sessionId, { 
            inputTokens: 0, 
            outputTokens: 0, 
            totalTokens: 0 
        });
        
        // Update project session count
        const project = this.projects.get(targetProjectId);
        if (project) {
            project.sessionCount++;
            project.lastActivity = new Date();
        }
        
        this.currentSessionId = sessionId;
        this.saveToWorkspace();
        
        return {
            id: sessionId,
            name: 'New Session',
            messageCount: 0,
            lastActivity: new Date(),
            isActive: true,
            projectId: targetProjectId,
            tokenUsage: this.tokenUsage.get(sessionId)
        };
    }

    async duplicateSession(sessionId: string): Promise<SessionInfo | null> {
        const originalMessages = this.sessions.get(sessionId);
        if (!originalMessages) {
            return null;
        }
        
        const newSessionId = `session_${Date.now()}_copy`;
        const duplicatedMessages = JSON.parse(JSON.stringify(originalMessages));
        
        this.sessions.set(newSessionId, duplicatedMessages);
        this.tokenUsage.set(newSessionId, { 
            ...this.tokenUsage.get(sessionId)!,
            inputTokens: 0,
            outputTokens: 0,
            totalTokens: 0
        });
        
        const sessionInfo = await this.createNewSession();
        sessionInfo.id = newSessionId;
        sessionInfo.name = `${this.getSessionNames().get(sessionId) || sessionId} (Copy)`;
        sessionInfo.messageCount = duplicatedMessages.length;
        
        this.currentSessionId = newSessionId;
        this.saveToWorkspace();
        
        return sessionInfo;
    }

    async resumeSession(sessionId: string): Promise<boolean> {
        if (!this.sessions.has(sessionId)) {
            return false;
        }
        
        this.saveCurrentSession();
        this.currentSessionId = sessionId;
        
        // Update project if session belongs to different project
        const session = this.getSessionInfo(sessionId);
        if (session?.projectId) {
            this.currentProjectId = session.projectId;
        }
        
        this.saveToWorkspace();
        return true;
    }

    async deleteSession(sessionId: string): Promise<boolean> {
        if (sessionId === 'default' || !this.sessions.has(sessionId)) {
            return false;
        }
        
        this.sessions.delete(sessionId);
        this.tokenUsage.delete(sessionId);
        
        // Update project session count
        const session = this.getSessionInfo(sessionId);
        if (session?.projectId) {
            const project = this.projects.get(session.projectId);
            if (project) {
                project.sessionCount = Math.max(0, project.sessionCount - 1);
            }
        }
        
        // Switch to another session if current was deleted
        if (this.currentSessionId === sessionId) {
            const sessions = this.getAllSessions();
            this.currentSessionId = sessions.length > 0 ? sessions[0].id : 'default';
        }
        
        this.saveToWorkspace();
        return true;
    }

    async renameSession(sessionId: string, newName: string): Promise<boolean> {
        // Store session names in a separate map or metadata
        const sessionNames = this.getSessionNames();
        sessionNames.set(sessionId, newName);
        this.updateSessionNames(sessionNames);
        this.saveToWorkspace();
        return true;
    }

    getSessionInfo(sessionId: string): SessionInfo | undefined {
        const messages = this.sessions.get(sessionId);
        if (!messages) {
            return undefined;
        }
        
        const sessionNames = this.getSessionNames();
        const name = sessionNames.get(sessionId) || this.generateSessionName(messages, sessionId);
        
        return {
            id: sessionId,
            name,
            messageCount: messages.length,
            lastActivity: messages.length > 0 ? messages[messages.length - 1].timestamp : new Date(),
            isActive: sessionId === this.currentSessionId,
            projectId: this.currentProjectId || undefined,
            tokenUsage: this.tokenUsage.get(sessionId)
        };
    }

    getProjectSessions(projectId: string): SessionInfo[] {
        const allSessions = this.getAllSessions();
        return allSessions.filter(s => s.projectId === projectId);
    }

    getAllSessions(): SessionInfo[] {
        const sessionIds = Array.from(this.sessions.keys());
        return sessionIds
            .map(id => this.getSessionInfo(id))
            .filter((s): s is SessionInfo => s !== undefined)
            .sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());
    }

    getCurrentSessionId(): string | null {
        return this.currentSessionId;
    }

    getCurrentSessionHistory(): ChatMessage[] {
        return this.currentSessionId ? (this.sessions.get(this.currentSessionId) || []) : [];
    }

    setCurrentSessionHistory(history: ChatMessage[]) {
        if (this.currentSessionId) {
            this.sessions.set(this.currentSessionId, history);
        }
    }

    // Token Usage Tracking
    updateTokenUsage(sessionId: string, inputTokens: number, outputTokens: number) {
        const usage = this.tokenUsage.get(sessionId) || { 
            inputTokens: 0, 
            outputTokens: 0, 
            totalTokens: 0 
        };
        
        usage.inputTokens += inputTokens;
        usage.outputTokens += outputTokens;
        usage.totalTokens += inputTokens + outputTokens;
        
        this.tokenUsage.set(sessionId, usage);
        
        // Update project totals
        const session = this.getSessionInfo(sessionId);
        if (session?.projectId) {
            const project = this.projects.get(session.projectId);
            if (project) {
                if (!project.totalTokenUsage) {
                    project.totalTokenUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
                }
                project.totalTokenUsage.inputTokens += inputTokens;
                project.totalTokenUsage.outputTokens += outputTokens;
                project.totalTokenUsage.totalTokens += inputTokens + outputTokens;
            }
        }
        
        this.saveToWorkspace();
    }

    setQuotaLimit(sessionId: string, limit: number, resetDate?: Date) {
        const usage = this.tokenUsage.get(sessionId) || { 
            inputTokens: 0, 
            outputTokens: 0, 
            totalTokens: 0 
        };
        
        usage.quotaLimit = limit;
        usage.quotaRemaining = Math.max(0, limit - usage.totalTokens);
        usage.resetDate = resetDate;
        
        this.tokenUsage.set(sessionId, usage);
        this.saveToWorkspace();
    }

    getTokenUsage(sessionId: string): TokenUsage | undefined {
        return this.tokenUsage.get(sessionId);
    }

    // Persistence
    private saveCurrentSession() {
        // Auto-save current session state
        this.saveToWorkspace();
    }

    private getSessionNames(): Map<string, string> {
        const saved = vscode.workspace.getConfiguration('wayang').get<Record<string, string>>('sessionNames', {});
        return new Map(Object.entries(saved));
    }

    private updateSessionNames(names: Map<string, string>) {
        const namesObj = Object.fromEntries(names);
        vscode.workspace.getConfiguration('wayang').update(
            'sessionNames',
            namesObj,
            vscode.ConfigurationTarget.Workspace
        );
    }

    private generateSessionName(messages: ChatMessage[], sessionId: string): string {
        if (sessionId === 'default') {
            return 'Default Session';
        }
        
        const firstUserMessage = messages.find(msg => msg.type === 'user');
        if (firstUserMessage) {
            const truncated = firstUserMessage.content.substring(0, 30);
            return truncated + (firstUserMessage.content.length > 30 ? '...' : '');
        }
        
        return `Session ${sessionId.split('_')[1]}`;
    }

    async saveToWorkspace() {
        const sessionsObj: Record<string, ChatMessage[]> = {};
        this.sessions.forEach((messages, sessionId) => {
            sessionsObj[sessionId] = messages;
        });
        
        const projectsObj: Record<string, ProjectInfo> = {};
        this.projects.forEach((project, projectId) => {
            projectsObj[projectId] = project;
        });
        
        const tokenUsageObj: Record<string, TokenUsage> = {};
        this.tokenUsage.forEach((usage, sessionId) => {
            tokenUsageObj[sessionId] = usage;
        });
        
        await vscode.workspace.getConfiguration('wayang').update(
            'chatSessions',
            sessionsObj,
            vscode.ConfigurationTarget.Workspace
        );
        
        await vscode.workspace.getConfiguration('wayang').update(
            'projects',
            projectsObj,
            vscode.ConfigurationTarget.Workspace
        );
        
        await vscode.workspace.getConfiguration('wayang').update(
            'tokenUsage',
            tokenUsageObj,
            vscode.ConfigurationTarget.Workspace
        );
    }

    loadFromWorkspace() {
        try {
            const savedSessions = vscode.workspace.getConfiguration('wayang').get<Record<string, any>>('chatSessions', {});
            const savedProjects = vscode.workspace.getConfiguration('wayang').get<Record<string, any>>('projects', {});
            const savedTokenUsage = vscode.workspace.getConfiguration('wayang').get<Record<string, any>>('tokenUsage', {});
            
            // Load projects
            if (savedProjects && typeof savedProjects === 'object') {
                Object.entries(savedProjects).forEach(([projectId, project]) => {
                    this.projects.set(projectId, {
                        ...project,
                        createdAt: new Date(project.createdAt),
                        lastActivity: new Date(project.lastActivity)
                    });
                });
            }
            
            // Load sessions
            if (savedSessions && typeof savedSessions === 'object') {
                Object.entries(savedSessions).forEach(([sessionId, messages]) => {
                    if (Array.isArray(messages)) {
                        const processedMessages = messages.map(msg => ({
                            ...msg,
                            timestamp: new Date(msg.timestamp || Date.now())
                        }));
                        this.sessions.set(sessionId, processedMessages);
                    }
                });
            }
            
            // Load token usage
            if (savedTokenUsage && typeof savedTokenUsage === 'object') {
                Object.entries(savedTokenUsage).forEach(([sessionId, usage]) => {
                    this.tokenUsage.set(sessionId, usage as TokenUsage);
                });
            }
            
            // Set defaults if not loaded
            if (this.projects.size === 0) {
                this.initializeDefaultProject();
            }
            
            if (!this.currentProjectId && this.projects.size > 0) {
                this.currentProjectId = Array.from(this.projects.keys())[0];
            }
            
            if (!this.currentSessionId && this.sessions.size > 0) {
                this.currentSessionId = Array.from(this.sessions.keys())[0];
            }
            
        } catch (error) {
            console.error('Error loading project/session data:', error);
            this.initializeDefaultProject();
        }
    }
}
