import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { MemoryService } from './memoryService';

export interface FileChangeEvent {
    uri: vscode.Uri;
    type: 'created' | 'modified' | 'deleted';
    timestamp: number;
    content?: string;
    language?: string;
    size?: number;
}

export interface FileAnalysisResult {
    complexity: number;
    linesOfCode: number;
    functions: string[];
    imports: string[];
    potentialIssues: string[];
}

export class FileWatcher {
    private watchers: vscode.FileSystemWatcher[] = [];
    private changeBuffer: Map<string, FileChangeEvent> = new Map();
    private debounceTimeout: NodeJS.Timeout | null = null;
    private readonly DEBOUNCE_DELAY = 500; // ms
    private readonly MAX_FILE_SIZE = 1024 * 1024; // 1MB
    
    // Supported file extensions for analysis
    private readonly SUPPORTED_EXTENSIONS = new Set([
        '.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.go', '.rs', 
        '.cpp', '.c', '.h', '.hpp', '.cs', '.php', '.rb', '.swift',
        '.kt', '.scala', '.sh', '.ps1', '.sql', '.json', '.yaml', '.yml'
    ]);

    constructor() {
        this.initializeWatchers();
    }

    private initializeWatchers(): void {
        // Watch for various file types
        const patterns = [
            '**/*.{js,ts,jsx,tsx}', // JavaScript/TypeScript
            '**/*.{py,pyw}',        // Python
            '**/*.{java,kt,scala}', // JVM languages
            '**/*.{go,rs}',         // Go/Rust
            '**/*.{cpp,c,h,hpp,cc,cxx}', // C/C++
            '**/*.{cs,fs,vb}',      // .NET languages
            '**/*.{php,rb,swift}',  // Other languages
            '**/*.{json,yaml,yml,toml}', // Config files
            '**/*.{md,txt,rst}',    // Documentation
            '**/Dockerfile',        // Docker
            '**/package.json',      // Node.js
            '**/pom.xml',          // Maven
            '**/build.gradle',     // Gradle
            '**/Cargo.toml',       // Rust
            '**/go.mod',           // Go modules
            '**/requirements.txt', // Python
            '**/.env*'             // Environment files
        ];

        patterns.forEach(pattern => {
            const watcher = vscode.workspace.createFileSystemWatcher(pattern);
            
            watcher.onDidCreate(uri => this.handleFileChange(uri, 'created'));
            watcher.onDidChange(uri => this.handleFileChange(uri, 'modified'));
            watcher.onDidDelete(uri => this.handleFileChange(uri, 'deleted'));
            
            this.watchers.push(watcher);
        });
    }

    async onFileChanged(uri: vscode.Uri, memoryService: MemoryService): Promise<void> {
        try {
            const fileInfo = await this.getFileInfo(uri);
            if (!fileInfo) return;

            const analysis = await this.analyzeFile(uri);

            // Store file change context using existing MemoryService interface
            await memoryService.addContext({
                taskId: `file_change_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                query: `File modified: ${uri.fsPath}`,
                context: {
                    filePath: uri.fsPath,
                    language: fileInfo.language,
                    changeType: 'modified',
                    analysis: analysis,
                    fileSize: fileInfo.size,
                    complexity: analysis.complexity,
                    potentialIssues: analysis.potentialIssues
                },
                timestamp: new Date().toISOString()
            });

            // Trigger analysis if enabled
            if (this.shouldAnalyzeFile(uri)) {
                await this.performFileAnalysis(uri, memoryService);
            }

        } catch (error) {
            console.error(`Error processing file change for ${uri.fsPath}:`, error);
        }
    }

    private handleFileChange(uri: vscode.Uri, type: 'created' | 'modified' | 'deleted'): void {
        const key = uri.toString();
        
        // Buffer changes to avoid excessive processing
        this.changeBuffer.set(key, {
            uri,
            type,
            timestamp: Date.now()
        });

        // Debounce processing
        if (this.debounceTimeout) {
            clearTimeout(this.debounceTimeout);
        }

        this.debounceTimeout = setTimeout(() => {
            this.processBufferedChanges();
        }, this.DEBOUNCE_DELAY);
    }

    private async processBufferedChanges(): Promise<void> {
        const changes = Array.from(this.changeBuffer.values());
        this.changeBuffer.clear();

        for (const change of changes) {
            try {
                await this.processFileChange(change);
            } catch (error) {
                console.error(`Error processing change for ${change.uri.fsPath}:`, error);
            }
        }
    }

    private async processFileChange(change: FileChangeEvent): Promise<void> {
        const config = vscode.workspace.getConfiguration('wayang');
        
        if (!config.get('fileWatcher.enabled', true)) {
            return;
        }

        // Emit event for other components
        vscode.commands.executeCommand('wayang.internal.fileChanged', change);

        // Auto-analyze if configured
        if (config.get('fileWatcher.autoAnalyze', false) && change.type !== 'deleted') {
            await this.triggerAutoAnalysis(change.uri);
        }
    }

    private async triggerAutoAnalysis(uri: vscode.Uri): Promise<void> {
        try {
            const analysis = await this.analyzeFile(uri);
            
            // Send to backend for processing if there are potential issues
            if (analysis.potentialIssues.length > 0) {
                vscode.commands.executeCommand('wayang.internal.reportIssues', {
                    file: uri.fsPath,
                    issues: analysis.potentialIssues,
                    analysis
                });
            }

        } catch (error) {
            console.error(`Auto-analysis failed for ${uri.fsPath}:`, error);
        }
    }

    private async performFileAnalysis(uri: vscode.Uri, memoryService: MemoryService): Promise<void> {
        try {
            const analysis = await this.analyzeFile(uri);
            
            // Store the analysis results
            await memoryService.addResult({
                taskId: `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                result: analysis,
                summary: `File analysis for ${uri.fsPath}: ${analysis.potentialIssues.length} issues found, complexity: ${analysis.complexity}`,
                timestamp: new Date().toISOString()
            });

            // Show notification if significant issues found
            if (analysis.potentialIssues.length > 2) {
                const action = await vscode.window.showWarningMessage(
                    `Found ${analysis.potentialIssues.length} potential issues in ${path.basename(uri.fsPath)}`,
                    'View Details',
                    'Dismiss'
                );

                if (action === 'View Details') {
                    // Show issues in a webview or output channel
                    vscode.commands.executeCommand('wayang.showAnalysisDetails', {
                        file: uri.fsPath,
                        analysis
                    });
                }
            }

        } catch (error) {
            console.error(`File analysis failed for ${uri.fsPath}:`, error);
        }
    }

    private async analyzeFile(uri: vscode.Uri): Promise<FileAnalysisResult> {
        const analysis: FileAnalysisResult = {
            complexity: 0,
            linesOfCode: 0,
            functions: [],
            imports: [],
            potentialIssues: []
        };

        try {
            const document = await vscode.workspace.openTextDocument(uri);
            const content = document.getText();
            const lines = content.split('\n');
            
            analysis.linesOfCode = lines.filter(line => line.trim().length > 0).length;
            
            // Basic static analysis based on language
            const languageId = document.languageId;
            
            switch (languageId) {
                case 'typescript':
                case 'javascript':
                    this.analyzeJavaScriptTypeScript(content, analysis);
                    break;
                case 'python':
                    this.analyzePython(content, analysis);
                    break;
                case 'java':
                    this.analyzeJava(content, analysis);
                    break;
                default:
                    this.analyzeGeneric(content, analysis);
            }

            // Calculate complexity (simple heuristic)
            analysis.complexity = this.calculateComplexity(content, languageId);

        } catch (error) {
            analysis.potentialIssues.push(`Analysis failed: ${error}`);
        }

        return analysis;
    }

    private analyzeJavaScriptTypeScript(content: string, analysis: FileAnalysisResult): void {
        // Extract functions
        const functionRegex = /(?:function\s+(\w+)|(\w+)\s*[=:]\s*(?:async\s+)?(?:function|\([^)]*\)\s*=>))/g;
        let match;
        while ((match = functionRegex.exec(content)) !== null) {
            analysis.functions.push(match[1] || match[2]);
        }

        // Extract imports
        const importRegex = /import\s+.*?from\s+['"]([^'"]+)['"]/g;
        while ((match = importRegex.exec(content)) !== null) {
            analysis.imports.push(match[1]);
        }

        // Check for common issues
        if (content.includes('console.log')) {
            analysis.potentialIssues.push('Contains console.log statements');
        }
        if (content.includes('any')) {
            analysis.potentialIssues.push('Uses TypeScript "any" type');
        }
        if (content.match(/function\s+\w+\([^)]*\)\s*{[\s\S]*?}\s*(?=function|\s*$)/g)?.some(fn => fn.length > 1000)) {
            analysis.potentialIssues.push('Contains very long functions');
        }
    }

    private analyzePython(content: string, analysis: FileAnalysisResult): void {
        // Extract functions
        const functionRegex = /def\s+(\w+)\s*\(/g;
        let match;
        while ((match = functionRegex.exec(content)) !== null) {
            analysis.functions.push(match[1]);
        }

        // Extract imports
        const importRegex = /(?:from\s+(\S+)\s+)?import\s+([^#\n]+)/g;
        while ((match = importRegex.exec(content)) !== null) {
            const module = match[1] || match[2].split(',')[0].trim();
            analysis.imports.push(module);
        }

        // Check for common issues
        if (content.includes('print(')) {
            analysis.potentialIssues.push('Contains print statements');
        }
        if (!content.includes('"""') && analysis.linesOfCode > 50) {
            analysis.potentialIssues.push('Large file without docstrings');
        }
    }

    private analyzeJava(content: string, analysis: FileAnalysisResult): void {
        // Extract methods
        const methodRegex = /(?:public|private|protected)?\s*(?:static)?\s*\w+\s+(\w+)\s*\([^)]*\)\s*{/g;
        let match;
        while ((match = methodRegex.exec(content)) !== null) {
            analysis.functions.push(match[1]);
        }

        // Extract imports
        const importRegex = /import\s+([^;]+);/g;
        while ((match = importRegex.exec(content)) !== null) {
            analysis.imports.push(match[1]);
        }

        // Check for common issues
        if (content.includes('System.out.print')) {
            analysis.potentialIssues.push('Contains System.out.print statements');
        }
        if (content.split('\n').some(line => line.length > 120)) {
            analysis.potentialIssues.push('Contains very long lines');
        }
    }

    private analyzeGeneric(content: string, analysis: FileAnalysisResult): void {
        // Basic analysis for other languages
        const lines = content.split('\n');
        const longLines = lines.filter(line => line.length > 120);
        if (longLines.length > 0) {
            analysis.potentialIssues.push(`Contains ${longLines.length} long lines`);
        }

        // Check for TODO/FIXME comments
        const todoRegex = /(?:TODO|FIXME|HACK|XXX):/gi;
        const todos = content.match(todoRegex);
        if (todos && todos.length > 0) {
            analysis.potentialIssues.push(`Contains ${todos.length} TODO/FIXME comments`);
        }
    }

    private calculateComplexity(content: string, languageId: string): number {
        let complexity = 1; // Base complexity

        // Count control flow statements
        const controlFlowPatterns = [
            /\bif\b/g,
            /\belse\b/g,
            /\bwhile\b/g,
            /\bfor\b/g,
            /\bswitch\b/g,
            /\bcatch\b/g,
            /\btry\b/g,
            /\b&&\b/g,
            /\b\|\|\b/g
        ];

        controlFlowPatterns.forEach(pattern => {
            const matches = content.match(pattern);
            if (matches) {
                complexity += matches.length;
            }
        });

        return Math.min(complexity, 100); // Cap at 100
    }

    private shouldAnalyzeFile(uri: vscode.Uri): boolean {
        const ext = path.extname(uri.fsPath);
        if (!this.SUPPORTED_EXTENSIONS.has(ext)) {
            return false;
        }

        // Skip node_modules and other common directories
        const skipDirs = ['node_modules', '.git', 'dist', 'build', 'target', '__pycache__'];
        return !skipDirs.some(dir => uri.fsPath.includes(dir));
    }

    private async getFileInfo(uri: vscode.Uri): Promise<{ language: string; size: number } | null> {
        try {
            const stat = await vscode.workspace.fs.stat(uri);
            if (stat.size > this.MAX_FILE_SIZE) {
                return null; // Skip large files
            }

            const document = await vscode.workspace.openTextDocument(uri);
            return {
                language: document.languageId,
                size: stat.size
            };
        } catch (error) {
            return null;
        }
    }

    public async getRecentChanges(limit: number = 10): Promise<FileChangeEvent[]> {
        // Return recent changes from buffer
        return Array.from(this.changeBuffer.values())
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, limit);
    }

    public startWatching(): void {
        // Watchers are already initialized, but this can be used to resume if paused
        console.log('FileWatcher: Started watching files');
    }

    public stopWatching(): void {
        this.watchers.forEach(watcher => watcher.dispose());
        this.watchers = [];
        
        if (this.debounceTimeout) {
            clearTimeout(this.debounceTimeout);
            this.debounceTimeout = null;
        }
        
        this.changeBuffer.clear();
        console.log('FileWatcher: Stopped watching files');
    }

    public dispose(): void {
        this.stopWatching();
    }
}