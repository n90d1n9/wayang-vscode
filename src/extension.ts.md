import * as vscode from 'vscode';

import { AgentClient } from './clients/agentClient';
import { MemoryService } from './services/memoryService';
import { WayangWebviewProvider } from './providers/webviewProvider';
import { WayangProvider } from './providers/codingAgentProvider';
import { FileWatcher } from './services/fileWatcher';

export function activate(context: vscode.ExtensionContext) {
    console.log('Wayang Agent Extension is now active');

    // Initialize services
    const memoryService = new MemoryService(context);
    const agentClient = new AgentClient();
    const fileWatcher = new FileWatcher();
    
    // Initialize providers
    const wayangProvider = new WayangProvider(context, agentClient, memoryService);
    //const webviewProvider = new WayangWebviewProvider(context.extensionUri, agentClient);
const webviewProvider = new WayangWebviewProvider(context.extensionUri);

    // Register tree data provider for agent tasks
    vscode.window.createTreeView('wayangTasks', {
        treeDataProvider: wayangProvider,
        showCollapseAll: true
    });

    // Register webview provider for chat interface
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('wayangChat', webviewProvider)
    );

    // Register commands
    const commands = [
        // Main agent commands
        vscode.commands.registerCommand('wayang.sendQuery', async () => {
            const input = await vscode.window.showInputBox({
                placeHolder: 'Enter your request (e.g., "Find and fix bugs in current file")',
                prompt: 'What would you like the coding agent to do?'
            });
            
            if (input) {
                await wayangProvider.executeQuery(input);
            }
        }),

        vscode.commands.registerCommand('wayang.analyzeFile', async (uri?: vscode.Uri) => {
            const fileUri = uri || vscode.window.activeTextEditor?.document.uri;
            if (fileUri) {
                const query = `Analyze the file ${fileUri.fsPath} for potential improvements, bugs, and code quality issues`;
                await wayangProvider.executeQuery(query, { fileUri: fileUri.fsPath });
            }
        }),

        vscode.commands.registerCommand('wayang.generateTests', async () => {
            const activeEditor = vscode.window.activeTextEditor;
            if (activeEditor) {
                const document = activeEditor.document;
                const query = `Generate comprehensive unit tests for the code in ${document.fileName}`;
                await wayangProvider.executeQuery(query, { 
                    fileContent: document.getText(),
                    fileName: document.fileName,
                    language: document.languageId
                });
            }
        }),

        vscode.commands.registerCommand('wayang.explainCode', async () => {
            const activeEditor = vscode.window.activeTextEditor;
            if (activeEditor && activeEditor.selection) {
                const selectedText = activeEditor.document.getText(activeEditor.selection);
                if (selectedText) {
                    const query = `Explain this code and its functionality: ${selectedText}`;
                    await wayangProvider.executeQuery(query, { codeSnippet: selectedText });
                }
            }
        }),

        vscode.commands.registerCommand('wayang.refactorCode', async () => {
            const activeEditor = vscode.window.activeTextEditor;
            if (activeEditor && activeEditor.selection) {
                const selectedText = activeEditor.document.getText(activeEditor.selection);
                if (selectedText) {
                    const query = `Refactor this code for better performance, readability, and maintainability: ${selectedText}`;
                    await wayangProvider.executeQuery(query, { 
                        codeSnippet: selectedText,
                        refactorRequest: true 
                    });
                }
            }
        }),

        vscode.commands.registerCommand('wayang.findAndFix', async () => {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (workspaceFolder) {
                const query = `Scan the workspace for potential bugs, security issues, and code smells, then suggest fixes`;
                await wayangProvider.executeQuery(query, { 
                    workspacePath: workspaceFolder.uri.fsPath 
                });
            }
        }),

        // Memory and context commands
        vscode.commands.registerCommand('wayang.clearMemory', async () => {
            await memoryService.clearMemory();
            vscode.window.showInformationMessage('Agent memory cleared');
        }),

        vscode.commands.registerCommand('wayang.showMemory', async () => {
            const memories = await memoryService.getRecentMemories();
           // webviewProvider.showMemories(memories);
        }),

        // Configuration commands
        vscode.commands.registerCommand('wayang.configure', async () => {
            await vscode.commands.executeCommand('workbench.action.openSettings', '@ext:wayang');
        }),

        // Task management commands
        vscode.commands.registerCommand('wayang.refreshTasks', () => {
            wayangProvider.refresh();
        }),

        vscode.commands.registerCommand('wayang.cancelTask', (task) => {
            wayangProvider.cancelTask(task);
        })
    ];

    context.subscriptions.push(...commands);

    // Register file system watcher for auto-context
    const watcher = vscode.workspace.createFileSystemWatcher('**/*.{js,ts,py,java,go,rs,cpp,c,h}');
    
    watcher.onDidChange(async (uri) => {
        if (vscode.workspace.getConfiguration('wayang').get('autoContext', false)) {
            await fileWatcher.onFileChanged(uri, memoryService);
        }
    });

    context.subscriptions.push(watcher);

    // Register status bar
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.text = '$(robot) Wayang Code';
    statusBarItem.command = 'wayang.sendQuery';
    statusBarItem.tooltip = 'Click to send a query to the coding agent';
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);

    // Initialize connection to backend
    agentClient.initialize().then(() => {
        vscode.window.showInformationMessage('Wayang Code backend connected successfully');
        statusBarItem.text = '$(robot) Agent Ready';
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.prominentBackground');
    }).catch((error) => {
        vscode.window.showErrorMessage(`Failed to connect to Wayang Code backend: ${error.message}`);
        statusBarItem.text = '$(error) Agent Offline';
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
    });
}


export function deactivate() {
    console.log('Wayang Code Extension is now deactivated');
}