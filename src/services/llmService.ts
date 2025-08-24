import * as fs from 'fs';
import path from 'path';

import { AgentClient } from '../clients/agentClient';


export class LLMService {
    constructor(private agentClient: AgentClient) {}

    async analyzeProject(prompt: string): Promise<any> {
        try {
            const response = await this.agentClient.sendQuery({
                query: prompt,
                context: {
                    task: 'framework_detection',
                    responseFormat: 'json'
                },
                streaming: false
            });

            // Parse and validate LLM response
            return this.parseLLMResponse(response);
        } catch (error) {
            throw new Error(`LLM analysis failed: ${error}`);
        }
    }

    private parseLLMResponse(response: any): any {
        try {
            // Extract JSON from LLM response
            const jsonMatch = response.message.match(/```json\n([\s\S]*?)\n```/) || 
                             response.message.match(/{[\s\S]*}/);
            
            if (jsonMatch) {
                return JSON.parse(jsonMatch[1] || jsonMatch[0]);
            }
            
            // Fallback: try to parse the entire message
            return JSON.parse(response.message);
        } catch (error) {
            console.error('Failed to parse LLM response:', error);
            return {
                frameworks: [],
                platforms: [],
                buildTools: [],
                confidence: 0.5,
                reasoning: 'LLM analysis failed'
            };
        }
    }

    // Smart sampling for large projects
    async analyzeLargeProject(workspacePath: string): Promise<any> {
        // Sample key files instead of reading everything
        const samples = this.sampleProjectFiles(workspacePath);
        const prompt = this.createSmartPrompt(samples);
        
        return this.analyzeProject(prompt);
    }

    private sampleProjectFiles(workspacePath: string): string[] {
        const samples: string[] = [];
        const maxFiles = 20; // Limit to avoid token overflow
        
        // Always include key configuration files
        const keyFiles = [
            'package.json', 'pom.xml', 'build.gradle', 'composer.json',
            'requirements.txt', 'go.mod', '*.csproj', 'Makefile',
            'Dockerfile', 'docker-compose.yml', 'tsconfig.json',
            'webpack.config.js', 'vite.config.js'
        ];

        keyFiles.forEach(pattern => {
            const files = fs.readdirSync(workspacePath)
                .filter(file => file.match(new RegExp(pattern.replace('*', '.*'))))
                .slice(0, 2); // Limit per pattern
            
            files.forEach(file => {
                try {
                    const content = fs.readFileSync(path.join(workspacePath, file), 'utf8');
                    samples.push(`File: ${file}\nContent: ${content.substring(0, 500)}`);
                } catch (error) {
                    // Skip unreadable files
                }
            });
        });

        // Sample source code files
        const sourceFiles = fs.readdirSync(workspacePath)
            .filter(file => file.match(/\.(js|ts|java|py|go|cs|php|rb)$/))
            .slice(0, 5);
        
        sourceFiles.forEach(file => {
            try {
                const content = fs.readFileSync(path.join(workspacePath, file), 'utf8');
                samples.push(`File: ${file}\nContent: ${content.substring(0, 300)}`);
            } catch (error) {
                // Skip unreadable files
            }
        });

        return samples.slice(0, maxFiles);
    }
}