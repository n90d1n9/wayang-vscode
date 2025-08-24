import { ProjectAnalysis } from '../types/frameworkTypes';

function isAxiosError(error: unknown): error is import('axios').AxiosError {
    return (error as any).isAxiosError !== undefined;
}

export function createDefaultAnalysis(): ProjectAnalysis {
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

export function simpleIDgenerator(): string {
    return  `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}