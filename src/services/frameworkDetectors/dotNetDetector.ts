import { BaseDetector } from './baseDetector';
import { FrameworkDetectionResult } from '../../types/frameworkTypes';

import * as fs from 'fs';
import path from 'path';

export class DotNetDetector extends BaseDetector {
    constructor(workspacePath: string) {
        super(workspacePath);
    }
    async detect(): Promise<FrameworkDetectionResult> {
        const result: FrameworkDetectionResult = {
            frameworks: [],
            buildTools: [],
            hasTests: false,
            hasDocumentation: false,
            languages: new Map()
        };

        if (!this.hasFile('*.csproj') && !this.hasFile('*.sln') && !this.hasFile('*.fsproj')) {
            return result;
        }

        result.buildTools.push('dotnet');

        // Detect frameworks from project files
        result.frameworks.push(...this.detectFromProjectFiles());

        return result;
    }

    private detectFromProjectFiles(): string[] {
        const frameworks: string[] = [];
        
        try {
            const csprojFiles = fs.readdirSync(this.workspacePath)
                .filter(file => file.endsWith('.csproj') || file.endsWith('.fsproj'));
            
            for (const projectFile of csprojFiles) {
                const content = fs.readFileSync(path.join(this.workspacePath, projectFile), 'utf8');
                
                if (content.includes('Microsoft.NET.Sdk.Web')) {
                    frameworks.push('ASP.NET Core');
                }
                if (content.includes('Microsoft.NET.Sdk.BlazorWebAssembly')) {
                    frameworks.push('Blazor WebAssembly');
                }
                if (content.includes('Microsoft.NET.Sdk.Razor')) {
                    frameworks.push('Razor Pages');
                }
                if (content.includes('Xamarin')) {
                    frameworks.push('Xamarin');
                }
                if (content.includes('EntityFramework')) {
                    frameworks.push('Entity Framework');
                }
                if (content.includes('Microsoft.AspNetCore')) {
                    frameworks.push('ASP.NET Core');
                }
                if (content.includes('Microsoft.EntityFrameworkCore')) {
                    frameworks.push('Entity Framework Core');
                }
            }

            // Detect by specific files
            if (this.hasFile('Startup.cs')) {frameworks.push('ASP.NET Core');}
            if (this.hasFile('Program.cs') && this.fileContains('Program.cs', 'WebApplication')) {
                frameworks.push('ASP.NET Core 6+');
            }
            if (this.hasFile('appsettings.json')) {frameworks.push('ASP.NET Core');}
            
        } catch (error) {
            console.error('Error detecting .NET frameworks:', error);
        }

        return [...new Set(frameworks)]; // Remove duplicates
    }
}