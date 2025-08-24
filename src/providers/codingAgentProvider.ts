import * as vscode from "vscode";
import {
    AgentClient,
} from "../clients/agentClient";

import { v4 as uuidv4 } from "uuid";
import { MemoryService } from "../services/memoryService";
import { AgentRequest, AgentResponse, ExecutionStep } from "../types/agentTypes";



export class WayangProvider
    implements vscode.TreeDataProvider<AgentTaskItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<
        AgentTaskItem | undefined | null | void
    > = new vscode.EventEmitter<AgentTaskItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<
        AgentTaskItem | undefined | null | void
    > = this._onDidChangeTreeData.event;

    private tasks: Map<string, AgentTaskItem> = new Map();
    private activeProgress: Map<
        string,
        vscode.Progress<{ message: string; increment?: number }>
    > = new Map();

    constructor(
        private context: vscode.ExtensionContext,
        private agentClient: AgentClient,
        private memoryService: MemoryService,
    ) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: AgentTaskItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: AgentTaskItem): Promise<AgentTaskItem[]> {
        if (!element) {
            // Return root level tasks
            return Array.from(this.tasks.values()).sort((a, b) =>
                new Date(b.timestamp).getTime() -
                new Date(a.timestamp).getTime()
            );
        } else if (element.itemType === "task" && element.steps) {
            // For steps, we need to return AgentTaskItem[], but steps are AgentStepItem[]
            // We'll need to convert them or handle this differently
            // Since steps should be displayed as children, we'll cast them
            return element.steps as unknown as AgentTaskItem[];
        }
        return [];
    }

    async executeQuery(
        query: string,
        context?: Record<string, any>,
    ): Promise<void> {
        const taskId = uuidv4();
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

        // Create request using the correct AgentRequest interface
        const request: AgentRequest = {
            id: taskId, // Add the required id field
            query,
            context: {
                ...context,
                editor: this.getEditorContext(),
                workspace: workspaceFolder?.uri.fsPath,
                timestamp: new Date().toISOString(),
            },
            workspace: workspaceFolder?.uri.fsPath,
        };
        // Create task item
        const taskItem = new AgentTaskItem(
            taskId,
            query,
            "running",
            new Date(),
        );

        this.tasks.set(taskId, taskItem);
        this.refresh();

        // Show progress
        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Wayang Code",
            cancellable: true,
        }, async (progress, token) => {
            this.activeProgress.set(taskId, progress);
            progress.report({ message: "Initializing task..." });

            // Set up cancellation
            token.onCancellationRequested(() => {
                this.cancelTask(taskItem);
            });

            try {
                // Send query to backend via agent client
                const taskIdFromServer = await this.agentClient.sendQuery(
                    request,
                );
                // Now get the actual response using the task status
                const response = await this.agentClient.getTaskStatus(
                    taskIdFromServer,
                );

                // Handle initial response
                if (response) {
                    await this.handleTaskUpdate(taskId, response, progress);
                }

                // Store context in memory
                await this.memoryService.addContext({
                    taskId,
                    query,
                    context: request.context,
                    timestamp: new Date(),
                });
            } catch (error) {
                console.error("Task execution failed:", error);
                taskItem.status = "error";
                taskItem.description = `Error: ${
                    error instanceof Error ? error.message : "Unknown error"
                }`;
                taskItem.iconPath = new vscode.ThemeIcon("error");
                this.refresh();

                vscode.window.showErrorMessage(
                    `Task failed: ${
                        error instanceof Error ? error.message : "Unknown error"
                    }`,
                );
                this.activeProgress.delete(taskId);
            }
        });
    }

    private inferTaskType(
        query: string,
    ): "analyze" | "refactor" | "test" | "fix" | "explain" | "general" {
        const lowerQuery = query.toLowerCase();

        if (lowerQuery.includes("analyze") || lowerQuery.includes("analysis")) {
            return "analyze";
        }
        if (lowerQuery.includes("refactor") || lowerQuery.includes("improve")) {
            return "refactor";
        }
        if (lowerQuery.includes("test") || lowerQuery.includes("unit test")) {
            return "test";
        }
        if (
            lowerQuery.includes("fix") || lowerQuery.includes("bug") ||
            lowerQuery.includes("error")
        ) {return "fix";}
        if (
            lowerQuery.includes("explain") || lowerQuery.includes("what does")
        ) {return "explain";}

        return "general";
    }

    private async handleTaskUpdate(
        taskId: string,
        response: AgentResponse, // Now using the correct interface
        progress: vscode.Progress<{ message: string; increment?: number }>,
    ): Promise<void> {
        const taskItem = this.tasks.get(taskId);
        if (!taskItem) {return;}

        // Update task status - map the status values correctly
        taskItem.status = this.mapStatus(response.status);
        taskItem.description = response.message || response.status;

        // Update steps if provided
        if (response.steps) {
            taskItem.steps = response.steps.map((step) =>
                new AgentStepItem(step, taskId)
            );
        }

        // Update progress
        progress.report({
            message: response.message || `Task ${response.status}`,
        });

        // Handle completion or error
        if (response.status === "completed") {
            taskItem.iconPath = new vscode.ThemeIcon("check");
            taskItem.tooltip = `Completed: ${response.message}`;

            // Store results in memory
            await this.memoryService.addResult({
                taskId,
                result: response.data,
                summary: response.message || "Task completed",
                timestamp: new Date(),
            });

            // Show results
            await this.showTaskResults(taskItem, response);

            this.activeProgress.delete(taskId);

            vscode.window.showInformationMessage(
                `Task completed: ${response.message}`,
            );
        } else if (response.status === "error") {
            taskItem.iconPath = new vscode.ThemeIcon("error");
            taskItem.tooltip = `Error: ${response.error || response.message}`;

            vscode.window.showErrorMessage(
                `Task failed: ${response.error || response.message}`,
            );
            this.activeProgress.delete(taskId);
        } else {
            // Update icon based on status
            switch (response.status) {
                case "planning":
                case "executing":
                case "summarizing":
                    taskItem.iconPath = new vscode.ThemeIcon("loading~spin");
                    break;
            }
        }

        this.refresh();
    }

    // Helper method to map status values
    private mapStatus(
        status:
            | "planning"
            | "executing"
            | "summarizing"
            | "completed"
            | "error",
    ): string {
        const statusMap: Record<string, string> = {
            "planning": "running",
            "executing": "running",
            "summarizing": "running",
            "completed": "completed",
            "error": "error",
        };
        return statusMap[status] || status;
    }

    private async showTaskResults(
        taskItem: AgentTaskItem,
        response: AgentResponse,
    ): Promise<void> {
        if (!response.data) { return;}

        const result = response.data;

        // Handle different types of results
        if (result.codeChanges) {
            await this.handleCodeChanges(result.codeChanges);
        }

        if (result.analysis) {
            await this.showAnalysisResults(result.analysis);
        }

        if (result.tests) {
            await this.showGeneratedTests(result.tests);
        }

        if (result.explanation) {
            await this.showExplanation(result.explanation);
        }

        if (
            typeof result === "string" ||
            (result.content && typeof result.content === "string")
        ) {
            // Simple text result
            await this.showTextResult(result.content || result);
        }
    }

    private async showTextResult(content: string): Promise<void> {
        const document = await vscode.workspace.openTextDocument({
            content: content,
            language: "markdown",
        });
        await vscode.window.showTextDocument(
            document,
            vscode.ViewColumn.Beside,
        );
    }

    private async handleCodeChanges(codeChanges: any[]): Promise<void> {
        for (const change of codeChanges) {
            if (change.file && change.content) {
                const choice = await vscode.window.showInformationMessage(
                    `Apply changes to ${change.file}?`,
                    "Apply",
                    "View Diff",
                    "Skip",
                );

                if (choice === "Apply") {
                    await this.applyCodeChange(change);
                } else if (choice === "View Diff") {
                    await this.showCodeDiff(change);
                }
            }
        }
    }

    private async applyCodeChange(change: any): Promise<void> {
        try {
            const uri = vscode.Uri.file(change.file);
            const document = await vscode.workspace.openTextDocument(uri);

            const edit = new vscode.WorkspaceEdit();
            const fullRange = new vscode.Range(
                document.positionAt(0),
                document.positionAt(document.getText().length),
            );

            edit.replace(uri, fullRange, change.content);
            await vscode.workspace.applyEdit(edit);

            // Open and show the file
            await vscode.window.showTextDocument(document);
            vscode.window.showInformationMessage(
                `Applied changes to ${change.file}`,
            );
        } catch (error) {
            vscode.window.showErrorMessage(
                `Failed to apply changes: ${
                    error instanceof Error ? error.message : "Unknown error"
                }`,
            );
        }
    }

    private async showCodeDiff(change: any): Promise<void> {
        try {
            const originalUri = vscode.Uri.file(change.file);
            const modifiedUri = vscode.Uri.file(change.file + ".proposed");

            // Create temporary file with proposed changes
            await vscode.workspace.fs.writeFile(
                modifiedUri,
                Buffer.from(change.content, "utf8"),
            );

            // Open diff editor
            await vscode.commands.executeCommand(
                "vscode.diff",
                originalUri,
                modifiedUri,
                `${change.file} ↔ Proposed Changes`,
            );
        } catch (error) {
            vscode.window.showErrorMessage(
                `Failed to show diff: ${
                    error instanceof Error ? error.message : "Unknown error"
                }`,
            );
        }
    }

    private async showAnalysisResults(analysis: any): Promise<void> {
        const panel = vscode.window.createWebviewPanel(
            "wayangAnalysis",
            "Code Analysis Results",
            vscode.ViewColumn.Beside,
            { enableScripts: true },
        );

        panel.webview.html = this.getAnalysisWebviewContent(analysis);
    }

    private async showGeneratedTests(tests: any): Promise<void> {
        const choice = await vscode.window.showInformationMessage(
            "Generated tests are ready. What would you like to do?",
            "Create Test File",
            "View Tests",
            "Cancel",
        );

        if (choice === "Create Test File") {
            await this.createTestFile(tests);
        } else if (choice === "View Tests") {
            await this.showTestsInEditor(tests);
        }
    }

    private async createTestFile(tests: any): Promise<void> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {return;}

        const testFileName = tests.fileName || "generated.test.js";
        const testFilePath = vscode.Uri.joinPath(
            workspaceFolder.uri,
            "tests",
            testFileName,
        );

        try {
            await vscode.workspace.fs.writeFile(
                testFilePath,
                Buffer.from(tests.content, "utf8"),
            );
            const document = await vscode.workspace.openTextDocument(
                testFilePath,
            );
            await vscode.window.showTextDocument(document);

            vscode.window.showInformationMessage(
                `Test file created: ${testFileName}`,
            );
        } catch (error) {
            vscode.window.showErrorMessage(
                `Failed to create test file: ${
                    error instanceof Error ? error.message : "Unknown error"
                }`,
            );
        }
    }

    private async showTestsInEditor(tests: any): Promise<void> {
        const document = await vscode.workspace.openTextDocument({
            content: tests.content,
            language: tests.language || "javascript",
        });
        await vscode.window.showTextDocument(document);
    }

    private async showExplanation(explanation: any): Promise<void> {
        const panel = vscode.window.createWebviewPanel(
            "wayangExplanation",
            "Code Explanation",
            vscode.ViewColumn.Beside,
            { enableScripts: true },
        );

        panel.webview.html = this.getExplanationWebviewContent(explanation);
    }

    private getEditorContext(): any {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) {return {};}

        const document = activeEditor.document;
        const selection = activeEditor.selection;

        return {
            fileName: document.fileName,
            languageId: document.languageId,
            selectedText: selection.isEmpty
                ? undefined
                : document.getText(selection),
            cursorPosition: document.offsetAt(activeEditor.selection.active),
            lineCount: document.lineCount,
        };
    }

    async cancelTask(taskItem: AgentTaskItem): Promise<void> {
        try {
            // If your AgentClient has a cancel method, use it
            // await this.agentClient.cancelTask(taskItem.taskId);

            taskItem.status = "cancelled";
            taskItem.description = "Task cancelled by user";
            taskItem.iconPath = new vscode.ThemeIcon("circle-slash");
            this.refresh();

            this.activeProgress.delete(taskItem.taskId);

            vscode.window.showInformationMessage("Task cancelled");
        } catch (error) {
            vscode.window.showErrorMessage(
                `Failed to cancel task: ${
                    error instanceof Error ? error.message : "Unknown error"
                }`,
            );
        }
    }

    private getAnalysisWebviewContent(analysis: any): string {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Code Analysis</title>
                <style>
                    body { 
                        font-family: var(--vscode-font-family); 
                        padding: 20px; 
                        color: var(--vscode-foreground);
                        background: var(--vscode-editor-background);
                    }
                    .issue { 
                        margin: 10px 0; 
                        padding: 15px; 
                        border-left: 4px solid var(--vscode-editorWarning-foreground);
                        background: var(--vscode-editor-background);
                        border-radius: 4px;
                    }
                    .error { border-left-color: var(--vscode-editorError-foreground); }
                    .warning { border-left-color: var(--vscode-editorWarning-foreground); }
                    .info { border-left-color: var(--vscode-editorInfo-foreground); }
                    code { 
                        background: var(--vscode-textCodeBlock-background); 
                        padding: 2px 4px; 
                        border-radius: 3px;
                        font-family: var(--vscode-editor-font-family);
                    }
                    pre {
                        background: var(--vscode-textCodeBlock-background);
                        padding: 10px;
                        border-radius: 4px;
                        overflow-x: auto;
                    }
                </style>
            </head>
            <body>
                <h1>Code Analysis Results</h1>
                <div>
                    ${
            typeof analysis === "string"
                ? `<pre>${analysis}</pre>`
                : `<pre>${JSON.stringify(analysis, null, 2)}</pre>`
        }
                </div>
            </body>
            </html>
        `;
    }

    private getExplanationWebviewContent(explanation: any): string {
        const content = typeof explanation === "string"
            ? explanation
            : explanation.content || JSON.stringify(explanation, null, 2);

        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Code Explanation</title>
                <style>
                    body { 
                        font-family: var(--vscode-font-family); 
                        padding: 20px; 
                        line-height: 1.6;
                        color: var(--vscode-foreground);
                        background: var(--vscode-editor-background);
                    }
                    pre { 
                        background: var(--vscode-textCodeBlock-background); 
                        padding: 15px; 
                        border-radius: 5px; 
                        overflow-x: auto;
                        font-family: var(--vscode-editor-font-family);
                    }
                    .section { margin: 20px 0; }
                    .highlight { 
                        background: var(--vscode-editor-selectionBackground); 
                        padding: 2px 4px; 
                        border-radius: 3px; 
                    }
                    h1, h2 { color: var(--vscode-foreground); }
                </style>
            </head>
            <body>
                <h1>Code Explanation</h1>
                <div class="section">
                    <pre>${content}</pre>
                </div>
            </body>
            </html>
        `;
    }
}

export class AgentTaskItem extends vscode.TreeItem {
    public steps?: AgentStepItem[];
    public progress?: number;
    public itemType: "task" = "task";
    public timestamp: Date; // Make sure this exists
    public query: string; // Make sure this exists
    public status: string; // Make sure this exists

    constructor(
        public readonly taskId: string,
        query: string,
        status: string,
        timestamp: Date,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState =
            vscode.TreeItemCollapsibleState.Collapsed,
    ) {
        super(query, collapsibleState);

        this.query = query;
        this.status = status;
        this.timestamp = timestamp;

        this.description = status;
        this.tooltip = `${query} - ${status} (${timestamp.toLocaleString()})`;
        this.contextValue = "agentTask";

        // Set icon based on status
        switch (status) {
            case "running":
            case "in_progress":
                this.iconPath = new vscode.ThemeIcon("loading~spin");
                break;
            case "completed":
                this.iconPath = new vscode.ThemeIcon("check");
                break;
            case "error":
            case "failed":
                this.iconPath = new vscode.ThemeIcon("error");
                break;
            case "cancelled":
                this.iconPath = new vscode.ThemeIcon("circle-slash");
                break;
            case "pending":
                this.iconPath = new vscode.ThemeIcon("clock");
                break;
            default:
                this.iconPath = new vscode.ThemeIcon("gear");
        }
    }
}

export class AgentStepItem extends vscode.TreeItem {
    public itemType: "step" = "step";

    constructor(
        public readonly step: ExecutionStep, // This should now be compatible
        public readonly taskId: string,
    ) {
        super(step.name, vscode.TreeItemCollapsibleState.None);

        this.description = step.status;
        this.tooltip = `${step.name} - ${step.status}`;
        this.contextValue = "agentStep";

        // Set icon based on step status
        if (step.status === "failed") {
            this.iconPath = new vscode.ThemeIcon("error");
        } else if (step.status === "completed") {
            this.iconPath = new vscode.ThemeIcon("check");
        } else if (step.status === "running") {
            this.iconPath = new vscode.ThemeIcon("loading~spin");
        } else if (step.status === "pending") {
            this.iconPath = new vscode.ThemeIcon("clock");
        } else {
            this.iconPath = new vscode.ThemeIcon("circle-outline");
        }
    }
}
