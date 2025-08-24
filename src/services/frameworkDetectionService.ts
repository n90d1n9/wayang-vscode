// services/frameworkDetectionService.ts

import * as fs from 'fs';
import * as path from 'path';
import { ProjectAnalysis } from '../types/frameworkTypes';
import { JavaDetector } from './frameworkDetectors/javaDetector';
import { JavaScriptDetector } from './frameworkDetectors/javascriptDetector';

import { LLMService } from './llmService';
import { BuildToolDetector } from './frameworkDetectors/buildToolDetector';
import { DotNetDetector } from './frameworkDetectors/dotNetDetector';
import { FrontendDetector } from './frameworkDetectors/frontendDetector';
import { GoDetector } from './frameworkDetectors/goDetector';
import { PHPDetector } from './frameworkDetectors/phpDetector';
import { PythonDetector } from './frameworkDetectors/pythonDetector';
export class FrameworkDetectionService {
    private llmService: LLMService;

    constructor(llmService: LLMService) {
        this.llmService = llmService;
    }

    async detectFrameworks(workspacePath: string): Promise<ProjectAnalysis> {
        // Phase 1: Traditional detection (fast)
        const traditionalResults = await this.runTraditionalDetection(workspacePath);
        
        // If traditional detection found clear results, return them
        if (this.isConfidentDetection(traditionalResults)) {
            return traditionalResults;
        }

        // Phase 2: LLM analysis (when traditional is uncertain)
        return await this.enhanceWithLLM(workspacePath, traditionalResults);
    }

    private async runTraditionalDetection(workspacePath: string): Promise<ProjectAnalysis> {
        const detectors = [
            new JavaDetector(workspacePath),
            new JavaScriptDetector(workspacePath),
            new PythonDetector(workspacePath),
            new PHPDetector(workspacePath),
            new DotNetDetector(workspacePath),
            new GoDetector(workspacePath),
            new FrontendDetector(workspacePath),
            new BuildToolDetector(workspacePath)
        ];

        const results: ProjectAnalysis[] = [];
        
        for (const detector of detectors) {
            results.push(await detector.detect());
        }

        return this.mergeResults(results);
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
            merged.frameworks = [...new Set([...merged.frameworks, ...result.frameworks])];
            merged.buildTools = [...new Set([...merged.buildTools, ...result.buildTools])];
            merged.hasTests = merged.hasTests || result.hasTests;
            merged.hasDocumentation = merged.hasDocumentation || result.hasDocumentation;
            
            result.languages.forEach((count, lang) => {
                merged.languages.set(lang, (merged.languages.get(lang) || 0) + count);
            });
        });

        return merged;
    }

    private isConfidentDetection(analysis: ProjectAnalysis): boolean {
        // Consider detection confident if we found specific frameworks or many build tools
        return analysis.frameworks.length > 0 || analysis.buildTools.length >= 2;
    }

    private async enhanceWithLLM(workspacePath: string, traditionalResults: ProjectAnalysis): Promise<ProjectAnalysis> {
        try {
            const projectStructure = this.getProjectStructure(workspacePath);
            const keyFiles = this.getKeyFilesContent(workspacePath);

            const prompt = this.createDetectionPrompt(projectStructure, keyFiles, traditionalResults);
            const llmAnalysis = await this.llmService.analyzeProject(prompt);

            return this.mergeLLMResults(traditionalResults, llmAnalysis);
        } catch (error) {
            console.error('LLM detection failed, falling back to traditional:', error);
            return traditionalResults;
        }
    }

    private getProjectStructure(workspacePath: string): string {
        try {
            const files = fs.readdirSync(workspacePath, { withFileTypes: true });
            return files
                .filter(dirent => !dirent.name.startsWith('.'))
                .map(dirent => dirent.isDirectory() ? `${dirent.name}/` : dirent.name)
                .join('\n');
        } catch (error) {
            return 'Unable to read project structure';
        }
    }

    private getKeyFilesContent(workspacePath: string): { [key: string]: string } {
        const keyFiles = [
            'package.json', 'pom.xml', 'build.gradle', 'composer.json', 
            'requirements.txt', 'pyproject.toml', 'go.mod', '*.csproj'
        ];

        const contents: { [key: string]: string } = {};
        
        keyFiles.forEach(filePattern => {
            try {
                const files = fs.readdirSync(workspacePath)
                    .filter(file => file.match(new RegExp(filePattern.replace('*', '.*'))));
                
                files.forEach(file => {
                    try {
                        const content = fs.readFileSync(path.join(workspacePath, file), 'utf8');
                        contents[file] = content.substring(0, 2000);
                    } catch (error) {
                        // Skip unreadable files
                    }
                });
            } catch (error) {
                // Skip if directory can't be read
            }
        });

        return contents;
    }

    private createDetectionPrompt(structure: string, keyFiles: { [key: string]: string }, traditionalResults: ProjectAnalysis): string {
        return `Analyze this project structure and determine the frameworks and technologies used.`;
    }

    private mergeLLMResults(traditional: ProjectAnalysis, llm: any): ProjectAnalysis {
        return {
            ...traditional,
            frameworks: [...new Set([...traditional.frameworks, ...(llm.frameworks || [])])],
            buildTools: [...new Set([...traditional.buildTools, ...(llm.buildTools || [])])],
            platform: llm.platform || traditional.platform
        };
    }
}