import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ProjectContext } from '../types/chatTypes';

export class ProjectService {
    private projectContext: ProjectContext = {};

    constructor() {
        this.initializeProjectContext();
    }

    initializeProjectContext() {
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

    getProjectContext(): ProjectContext {
        return this.projectContext;
    }

    updateProjectContext() {
        this.projectContext.dependencies = this.getDependencies();
        this.projectContext.gitBranch = this.getCurrentGitBranch();
        return this.projectContext;
    }

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
            if (fs.existsSync(path.join(workspacePath, project.file))) {
                return project.type;
            }
        }

        return "Unknown";
    }

    private getDependencies(): string[] {
        try {
            const workspacePath = this.projectContext.workspacePath;
            if (!workspacePath) {return [];}

            if (fs.existsSync(path.join(workspacePath, "package.json"))) {
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
}