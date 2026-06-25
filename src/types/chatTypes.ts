export interface ChatMessage {
    id: string;
    type: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
    loading?: boolean;
    error?: boolean;
    mode?: string;
    context?: any;
    codeChanges?: any[];

    analysis?: any;
    toolUse?: any;
    confidence?: number;
    sources?: string[];
    pinned?: boolean;
    edited?: boolean;
    system?: boolean;
    codeSuggestions?: CodeSuggestion[];
}

export interface ProjectContext {
    workspacePath?: string;
    projectType?: string;
    dependencies?: string[];
    gitBranch?: string;
    recentFiles?: string[];
    openTabs?: string[];
}

export interface ChatMessage {
  id: string;
  memoryReferences?: string[];
}

export interface CodeSuggestion {
  title?: string;
  file?: string;
  code: string;
  language?: string;
  explanation?: string;
}

export interface ChatSession {
  id: string;
  name: string;
  messageCount: number;
  lastActivity: Date;
  isActive: boolean;
}


export interface ChatSettings {
  autoApplyChanges: boolean;
  includeProjectContext: boolean;
  streamingMode: boolean;
}

export interface SessionInfo {
    id: string;
    name: string;
    messageCount: number;
    lastActivity: Date;
    isActive: boolean;
}

export type LoadingMessages = {
    chat: string;
    code: string;
    review: string;
    test: string;
};


export interface MemoryItem {
    id: string;
    query?: string;
    summary?: string;
    timestamp: Date;
    importance?: 'low' | 'medium' | 'high';
    context?: any;
    type: 'context' | 'result' | 'interaction';
    content: any;
    relevanceScore?: number;
    tags?: string[];
}

export type StreamCallback = (chatHistory: ChatMessage[]) => void;

export interface WebviewState {
    isSessionsPanelOpen: boolean;
    currentMode: string;
    sessions: any[];
    projectContext: any;
    chatHistory: any[];
    // Add other state properties as needed
}