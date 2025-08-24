export interface FrameworkDetectionResult {
    frameworks: string[];
    buildTools: string[];
    hasTests: boolean;
    hasDocumentation: boolean;
    languages: Map<string, number>;
}

export interface FrameworkDetector {
    detect(workspacePath: string): Promise<FrameworkDetectionResult>;
    requiredFiles?: string[];
}

export interface ProjectAnalysis {
    totalFiles: number;
    languages: Map<string, number>;
    complexity: number;
    codeQuality: number;
    frameworks: string[];
    buildTools: string[];
    hasTests: boolean;
    hasDocumentation: boolean;
    platform: string;
}

