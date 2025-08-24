import * as fs from 'fs';
import { ProjectAnalysis } from "../types/frameworkTypes";


export class DetectionCache {
    private cache: Map<string, { result: ProjectAnalysis; timestamp: number }> = new Map();
    private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

    get(workspacePath: string): ProjectAnalysis | null {
        const key = this.getCacheKey(workspacePath);
        const cached = this.cache.get(key);
        
        if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
            return cached.result;
        }
        
        return null;
    }

    set(workspacePath: string, result: ProjectAnalysis): void {
        const key = this.getCacheKey(workspacePath);
        this.cache.set(key, { result, timestamp: Date.now() });
    }

    private getCacheKey(workspacePath: string): string {
        try {
            const stats = fs.statSync(workspacePath);
            return `${workspacePath}:${stats.mtimeMs}`;
        } catch (error) {
            return workspacePath;
        }
    }
}