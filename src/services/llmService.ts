import * as fs from 'fs';
import path from 'path';

import { AgentClient } from '../clients/agentClient';
import { simpleIDgenerator } from '../utils/helper';


export class LLMService {
    constructor(private agentClient: AgentClient) {}

    async analyzeProject(prompt: string): Promise<any> {
        try {
            //const requestId = uuidv4(); // Generate unique ID
            const requestId = simpleIDgenerator();
            const response = await this.agentClient.sendQuery({
                id: requestId, // Add the required id property
                query: prompt,
                context: {
                    task: 'framework_detection',
                    responseFormat: 'json'
                }
            });

            return this.parseLLMResponse(response);
        } catch (error) {
            throw new Error(`LLM analysis failed: ${error}`);
        }
    }


    private createSmartPrompt(samples: string[]): string {
        return `
Analyze this project structure and determine the frameworks, platforms, and technologies used.

I've sampled key files from the project:

${samples.join('\n\n')}

Please provide a comprehensive analysis in JSON format with:
- frameworks: string[] (specific frameworks like React, Spring Boot, Django, etc.)
- platforms: string[] (main platforms: JavaScript, Java, Python, .NET, etc.)
- buildTools: string[] (build tools and package managers: npm, Maven, pip, etc.)
- testingFrameworks: string[] (testing tools: Jest, JUnit, pytest, etc.)
- deploymentTools: string[] (deployment tools: Docker, Kubernetes, etc.)
- confidence: number (0-1 confidence score)
- reasoning: string (brief explanation of how you detected these)

Focus on identifying:
1. Main programming languages and platforms
2. Web frameworks (Frontend and Backend)
3. Build tools and package managers
4. Testing frameworks
5. Deployment and infrastructure tools
6. Any unusual or custom setups

Return only valid JSON without additional text.
`;
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
                testingFrameworks: [],
                deploymentTools: [],
                confidence: 0.5,
                reasoning: 'LLM analysis failed'
            };
        }
    }

    // Smart sampling for large projects
    async analyzeLargeProject(workspacePath: string): Promise<any> {
        const samples = this.sampleProjectFiles(workspacePath);
        const prompt = this.createSmartPrompt(samples);
        return this.analyzeProject(prompt);
    }

    private sampleProjectFiles(workspacePath: string): string[] {
        const samples: string[] = [];
        const maxFiles = 20;
        
        const keyFiles = [
            'package.json', 'pom.xml', 'build.gradle', 'composer.json',
            'requirements.txt', 'pyproject.toml', 'go.mod', '*.csproj',
            'Makefile', 'Dockerfile', 'docker-compose.yml', 'tsconfig.json',
            'webpack.config.js', 'vite.config.js', '.gitignore', 'README.md'
        ];

        keyFiles.forEach(pattern => {
            try {
                const files = fs.readdirSync(workspacePath)
                    .filter(file => file.match(new RegExp(pattern.replace('*', '.*'))))
                    .slice(0, 2);
                
                files.forEach(file => {
                    try {
                        const content = fs.readFileSync(path.join(workspacePath, file), 'utf8');
                        samples.push(`File: ${file}\nContent: ${content.substring(0, 500)}`);
                    } catch (error) {
                        // Skip unreadable files
                    }
                });
            } catch (error) {
                // Skip if directory can't be read
            }
        });

        // Sample source code files
        try {
            const sourceFiles = fs.readdirSync(workspacePath)
                .filter(file => file.match(/\.(js|ts|java|py|go|cs|php|rb|html|css|json|xml|yml|yaml)$/))
                .slice(0, 5);
            
            sourceFiles.forEach(file => {
                try {
                    const content = fs.readFileSync(path.join(workspacePath, file), 'utf8');
                    samples.push(`File: ${file}\nContent: ${content.substring(0, 300)}`);
                } catch (error) {
                    // Skip unreadable files
                }
            });
        } catch (error) {
            // Skip if directory can't be read
        }

        return samples.slice(0, maxFiles);
    }

    // Additional helper method for structured analysis
    async analyzeProjectStructure(workspacePath: string): Promise<any> {
        const structure = this.getProjectStructure(workspacePath);
        const prompt = this.createStructurePrompt(structure);
        return this.analyzeProject(prompt);
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

    private createStructurePrompt(structure: string): string {
        return `
Analyze this project structure and predict the technologies used:

Project Structure:
${structure}

Based on the directory structure and file patterns, what frameworks and technologies are likely used?
Provide your analysis in JSON format with:
- predictedFrameworks: string[]
- predictedPlatforms: string[] 
- confidence: number
- reasoning: string

Return only valid JSON.
`;
    }
}