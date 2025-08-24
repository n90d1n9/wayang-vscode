import * as vscode from 'vscode';
import * as fs from 'fs';
import path from 'path';


import { ProjectAnalysis } from '../types/frameworkTypes';
import { DetectionCache } from './cacheService';
import { FrameworkDetectionService } from './frameworkDetectionService';
import { BuildToolDetector } from './frameworkDetectors/buildToolDetector';
import { DotNetDetector } from './frameworkDetectors/dotNetDetector';
import { FrontendDetector } from './frameworkDetectors/frontendDetector';
import { JavaDetector } from './frameworkDetectors/javaDetector';
import { JavaScriptDetector } from './frameworkDetectors/javascriptDetector';
import { PythonDetector } from './frameworkDetectors/pythonDetector';
import { LLMService } from './llmService';
import { PHPDetector } from './frameworkDetectors/phpDetector';
import { GoDetector } from './frameworkDetectors/goDetector';

export class ProjectService {
    private projectContext: any = {};
    private detectionService: FrameworkDetectionService;
    private cache: DetectionCache;

    constructor(llmService: LLMService) {
        this.cache = new DetectionCache();
        this.detectionService = new FrameworkDetectionService(llmService);
        this.initializeProjectContext();
    }

    private initializeProjectContext() {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders) {
            this.projectContext = {
                workspacePath: workspaceFolders[0].uri.fsPath,
                projectType: this.detectProjectType(workspaceFolders[0].uri.fsPath),
                dependencies: this.getDependencies(),
                gitBranch: this.getCurrentGitBranch(),
            };
        }
    }

    async analyzeProject(): Promise<ProjectAnalysis> {
        const workspacePath = this.projectContext.workspacePath;
        
        if (!workspacePath) {
            return this.getEmptyAnalysis();
        }

        // Check cache first
        const cached = this.cache.get(workspacePath);
        if (cached) {
            return cached;
        }

        // Use hybrid detection
        const analysis = await this.detectionService.detectFrameworks(workspacePath);
        
        // Cache results
        this.cache.set(workspacePath, analysis);
        
        return analysis;
    }

    async quickAnalyze(): Promise<ProjectAnalysis> {
        const workspacePath = this.projectContext.workspacePath;
        if (!workspacePath) {
            return this.getEmptyAnalysis();
        }

        // Fast path: traditional detection only
        const traditionalDetectors = this.initializeDetectors();
        const results = await Promise.all(
            traditionalDetectors.map(detector => detector.detect(workspacePath))
        );
        
        return this.mergeResults(results);
    }

    private initializeDetectors(): any[] {
        return [
            new JavaDetector(''),
            new JavaScriptDetector(''),
            new PythonDetector(''),
            new PHPDetector(''),
            new DotNetDetector(''),
            new GoDetector(''),
            new FrontendDetector(''),
            new BuildToolDetector('')
        ];
    }

    private mergeResults(results: ProjectAnalysis[]): ProjectAnalysis {
        const merged: ProjectAnalysis = {
            totalFiles: 0,
            languages: new Map<string, number>(),
            complexity: 0,
            codeQuality: 0,
            frameworks: [],
            buildTools: [],
            hasTests: false,
            hasDocumentation: false,
            platform: 'Unknown'
        };

        results.forEach(result => {
            // Merge frameworks and build tools (remove duplicates)
            merged.frameworks = [...new Set([...merged.frameworks, ...result.frameworks])];
            merged.buildTools = [...new Set([...merged.buildTools, ...result.buildTools])];
            
            // Merge boolean flags
            merged.hasTests = merged.hasTests || result.hasTests;
            merged.hasDocumentation = merged.hasDocumentation || result.hasDocumentation;
            
            // Merge languages
            result.languages.forEach((count, lang) => {
                merged.languages.set(lang, (merged.languages.get(lang) || 0) + count);
            });
        });

        // Calculate metrics
        merged.complexity = this.calculateComplexity(merged);
        merged.codeQuality = this.calculateCodeQuality(merged);
        merged.platform = this.determinePlatform(merged);

        return merged;
    }

    private getEmptyAnalysis(): ProjectAnalysis {
        return {
            totalFiles: 0,
            languages: new Map<string, number>(),
            complexity: 0,
            codeQuality: 0,
            frameworks: [],
            buildTools: [],
            hasTests: false,
            hasDocumentation: false,
            platform: 'Unknown'
        };
    }

    private determinePlatform(analysis: ProjectAnalysis): string {
        if (analysis.frameworks.some(f => f.includes('Spring') || f.includes('Quarkus'))) { return 'Java';}
        if (analysis.frameworks.some(f => f.includes('React') || f.includes('Vue') || f.includes('Angular'))) { return 'JavaScript/TypeScript';}
        if (analysis.frameworks.some(f => f.includes('Django') || f.includes('Flask'))) { return 'Python';}
        if (analysis.frameworks.some(f => f.includes('Laravel') || f.includes('Symfony'))) { return 'PHP';}
        if (analysis.frameworks.some(f => f.includes('ASP.NET'))) { return '.NET';}
        if (analysis.frameworks.some(f => f.includes('Gin') || f.includes('Echo'))) {  return 'Go';}
        return 'Mixed/Unknown';
    }

    private calculateComplexity(analysis: ProjectAnalysis): number {
        const codeFiles = Array.from(analysis.languages.values())
            .reduce((sum: number, count: number) => sum + count, 0);
        
        return Math.min(codeFiles / 10, 10);
    }

    private calculateCodeQuality(analysis: ProjectAnalysis): number {
        let quality = 5;
        
        if (analysis.hasTests) { quality += 3;}
        if (analysis.hasDocumentation) { quality += 2;}
        if (analysis.frameworks.length > 0) { quality += 1;}
        if (analysis.buildTools.length > 0) { quality += 1;}
        
        if (analysis.totalFiles > 100) { quality -= 1;}
        if (analysis.totalFiles > 500) { quality -= 2;}
        
        return Math.max(1, Math.min(quality, 10));
    }

    // Existing methods from your original ProjectService
    private detectProjectType(workspacePath: string): string {
        const projectFiles = [
            { file: "pom.xml", type: "Maven/Java" },
            { file: "build.gradle", type: "Gradle/Java" },
            { file: "package.json", type: "Node.js" },
            { file: "requirements.txt", type: "Python" },
            { file: "Cargo.toml", type: "Rust" },
            { file: "go.mod", type: "Go" },
            { file: "composer.json", type: "PHP" },
            { file: "*.csproj", type: "C#/.NET" },
        ];

        for (const project of projectFiles) {
            if (this.hasFile(workspacePath, project.file)) {
                return project.type;
            }
        }

        return "Unknown";
    }

    private getDependencies(): string[] {
        try {
            const workspacePath = this.projectContext.workspacePath;
            if (!workspacePath) {return [];}

            if (this.hasFile(workspacePath, "package.json")) {
                const packageJson = JSON.parse(
                    fs.readFileSync(path.join(workspacePath, "package.json"), "utf8")
                );
                return Object.keys({
                    ...packageJson.dependencies,
                    ...packageJson.devDependencies,
                });
            }

            // Add other dependency detection methods...
            
        } catch (error) {
            console.error("Error reading dependencies:", error);
        }
        
        return [];
    }

    private getCurrentGitBranch(): string {
        try {
            const workspacePath = this.projectContext.workspacePath;
            if (!workspacePath) {return "unknown";}

            const gitHeadPath = path.join(workspacePath, ".git", "HEAD");
            if (fs.existsSync(gitHeadPath)) {
                const headContent = fs.readFileSync(gitHeadPath, "utf8").trim();
                if (headContent.startsWith("ref: refs/heads/")) {
                    return headContent.substring("ref: refs/heads/".length);
                }
            }
            return "main";
        } catch (error) {
            return "unknown";
        }
    }

    private hasFile(workspacePath: string, pattern: string): boolean {
        try {
            if (pattern.includes('*')) {
                const files = fs.readdirSync(workspacePath);
                return files.some(file => file.match(new RegExp(pattern.replace('*', '.*'))));
            }
            
            return fs.existsSync(path.join(workspacePath, pattern));
        } catch (error) {
            return false;
        }
    }

    getProjectContext(): any {
        return this.projectContext;
    }

    updateProjectContext(): any {
        this.projectContext.dependencies = this.getDependencies();
        this.projectContext.gitBranch = this.getCurrentGitBranch();
        return this.projectContext;
    }
}