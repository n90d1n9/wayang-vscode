import * as vscode from "vscode";
import axios, { AxiosInstance, isAxiosError } from "axios";
import WebSocket from "ws";
import { AgentResponse, AgentRequest } from "../types/agentTypes";


export class AgentClient {
    private httpClient: AxiosInstance;
    private wsClient: WebSocket | null = null;
    private baseUrl: string;
    private eventHandlers: Map<string, (response: AgentResponse) => void> =
        new Map();

    constructor() {
        const config = vscode.workspace.getConfiguration("wayang");
        this.baseUrl = config.get("backendUrl", "http://localhost:8080");

        this.httpClient = axios.create({
            baseURL: `${this.baseUrl}/api/v1`,
            timeout: 30000,
            headers: {
                "Content-Type": "application/json",
                "User-Agent": "VSCode-Wayang/1.0.0",
            },
        });

        this.setupHttpInterceptors();
    }

    private setupHttpInterceptors() {
        // Request interceptor for authentication
        this.httpClient.interceptors.request.use(
            (config) => {
                const apiKey = vscode.workspace.getConfiguration("wayang")
                    .get("apiKey");
                if (apiKey) {
                    config.headers["Authorization"] = `Bearer ${apiKey}`;
                }
                return config;
            },
            (error) => Promise.reject(error),
        );

        // Response interceptor for error handling
        this.httpClient.interceptors.response.use(
            (response) => response,
            (error) => {
                console.error(
                    "API Error:",
                    error.response?.data || error.message,
                );
                return Promise.reject(error);
            },
        );
    }

    async initialize(): Promise<void> {
    try {
        await this.httpClient.get("/health");
        await this.initializeWebSocket();
        console.log("Agent client initialized successfully");
    } catch (error: any) {
        if (isAxiosError(error)) {
            console.error("HTTP error during init:", {
                status: error.response?.status,
                data: error.response?.data,
                message: error.message,
            });
        } else {
            console.error("Non-HTTP error during init:", error);
        }
        throw error; // rethrow original, don’t wrap in a new Error
    }
}


    private async initializeWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
        const wsUrl = this.baseUrl.replace("http", "ws") + "/ws/agent";
        this.wsClient = new WebSocket(wsUrl);

        let resolved = false;

        this.wsClient.on("open", () => {
            console.log("WebSocket connection established");
            resolved = true;
            resolve();
        });

        this.wsClient.on("message", (data: WebSocket.Data) => {
            try {
                const response: AgentResponse = JSON.parse(data.toString());
                this.handleWebSocketMessage(response);
            } catch (error) {
                console.error("Failed to parse WebSocket message:", error);
            }
        });

        this.wsClient.on("error", (error) => {
            console.error("WebSocket error:", error);
            if (!resolved) {reject(error);} // only reject if init hasn’t succeeded
        });

        this.wsClient.on("close", () => {
            console.warn("WebSocket closed, retrying in 5s...");
            setTimeout(() => this.initializeWebSocket().catch(console.error), 5000);
        });
    });
}


    private handleWebSocketMessage(response: AgentResponse) {
        const handler = this.eventHandlers.get(response.id);
        if (handler) {
            handler(response);
        }
    }

    async sendQuery(request: AgentRequest): Promise<string> {
        try {
            const response = await this.httpClient.post(
                "/agent/query",
                request,
            );
            return response.data.taskId;
        } catch (error) {
            console.error("Failed to send query:", error);

            // Use a type guard to narrow the type of 'error'
            if (isAxiosError(error)) {
                // Now TypeScript knows 'error' is an AxiosError, and we can safely access its properties.
                throw new Error(
                    `Failed to send query: ${
                        error.response?.data?.message || error.message
                    }`,
                );
            } else {
                // Handle other types of errors (e.g., a network error or a plain string)
                throw new Error(`Failed to send query: ${String(error)}`);
            }
        }
    }

    async getTaskStatus(taskId: string): Promise<AgentResponse> {
        try {
            const response = await this.httpClient.get(`/agent/task/${taskId}`);
            return response.data;
        } catch (error) {
            console.error("Failed to get task status:", error);

            if (isAxiosError(error)) {
                throw new Error(
                    `Failed to get task status: ${
                        error.response?.data?.message || error.message
                    }`,
                );
            } else {
                throw new Error(`Failed to get task status: ${String(error)}`);
            }
        }
    }

    async cancelTask(taskId: string): Promise<void> {
        try {
            await this.httpClient.delete(`/agent/task/${taskId}`);
        } catch (error) {
            console.error("Failed to cancel task:", error);

            if (isAxiosError(error)) {
                throw new Error(
                    `Failed to cancel task: ${
                        error.response?.data?.message || error.message
                    }`,
                );
            } else {
                throw new Error(`Failed to cancel task: ${String(error)}`);
            }
        }
    }

    async getTaskHistory(): Promise<AgentResponse[]> {
        try {
            const response = await this.httpClient.get("/agent/history");
            return response.data;
        } catch (error) {
            console.error("Failed to get task history:", error);
            return [];
        }
    }

    async analyzeWorkspace(workspacePath: string): Promise<any> {
        try {
            const response = await this.httpClient.post("/agent/analyze", {
                workspacePath,
            });
            return response.data;
        } catch (error) {
            console.error("Failed to analyze workspace:", error);

            if (isAxiosError(error)) {
                throw new Error(
                    `Failed to analyze workspace: ${
                        error.response?.data?.message || error.message
                    }`,
                );
            } else {
                throw new Error(`Failed to analyze workspace: ${String(error)}`);
            }
        }
    }

    async getMemoryContext(): Promise<any[]> {
        try {
            const response = await this.httpClient.get("/agent/memory");
            return response.data;
        } catch (error) {
            console.error("Failed to get memory context:", error);
            return [];
        }
    }

    async addMemoryContext(context: any): Promise<void> {
        try {
            await this.httpClient.post("/agent/memory", context);
        } catch (error) {
            console.error("Failed to add memory context:", error);
        }
    }

    async clearMemory(): Promise<void> {
        try {
            await this.httpClient.delete("/agent/memory");
        } catch (error) {
            console.error("Failed to clear memory:", error);

            if (isAxiosError(error)) {
                throw new Error(
                    `Failed to clear memory: ${
                        error.response?.data?.message || error.message
                    }`,
                );
            } else {
                throw new Error(`Failed to clear memory: ${String(error)}`);
            }
        }
    }

    onTaskUpdate(
        taskId: string,
        callback: (response: AgentResponse) => void,
    ): void {
        this.eventHandlers.set(taskId, callback);
    }

    offTaskUpdate(taskId: string): void {
        this.eventHandlers.delete(taskId);
    }

    async getAvailableModels(): Promise<string[]> {
        try {
            const response = await this.httpClient.get("/models");
            return response.data;
        } catch (error) {
            console.error("Failed to get available models:", error);
            return [];
        }
    }

    async updateConfiguration(config: any): Promise<void> {
        try {
            await this.httpClient.put("/agent/config", config);
        } catch (error) {
            console.error("Failed to update configuration:", error);
            if (isAxiosError(error)) {
            throw new Error(
                `Failed to update configuration: ${
                    error.response?.data?.message || error.message
                }`,
            );
            } else {
                throw new Error(`Failed to update configuration: ${String(error)}`);
            }
        }
    }

    dispose(): void {
        if (this.wsClient) {
            this.wsClient.close();
            this.wsClient = null;
        }
        this.eventHandlers.clear();
    }
}
