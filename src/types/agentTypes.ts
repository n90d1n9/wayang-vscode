
interface BaseTreeItem {
    itemType: 'task' | 'step';
    label: string;
    description?: string;
}

export interface AgentRequest {
    id: string;
    query: string;
    context?: Record<string, any>;
    streaming?: boolean;
    workspace?: string;
    files?: string[];
}

export interface AgentResponse {
    id: string;
    status: "planning" | "executing" | "summarizing" | "completed" | "error";
    message: string;
    data?: any;
    steps?: ExecutionStep[];
    progress?: number;
    error?: string;
}

export interface ExecutionStep {
    id: string;
    type: "planning" | "execution" | "tool" | "reasoning";
    description: string;
    name: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    result?: any;
    error?: string;
    startTime?: number;
    endTime?: number;
    tool?: string;
    output?: string;
}