import * as fs from 'fs';
import * as path from 'path';
import { FrameworkDetectionResult, ProjectAnalysis } from '../../types/frameworkTypes';

export abstract class BaseDetector {
    protected workspacePath: string;

    constructor(workspacePath: string) {
        this.workspacePath = workspacePath;
    }

    abstract detect(): Promise<ProjectAnalysis>;

    protected hasFile(pattern: string): boolean {
        try {
            if (pattern.includes('*')) {
                const files = fs.readdirSync(this.workspacePath);
                return files.some(file => file.match(new RegExp(pattern.replace('*', '.*'))));
            }
            
            if (pattern.includes('/')) {
                return fs.existsSync(path.join(this.workspacePath, pattern));
            }
            
            return fs.existsSync(path.join(this.workspacePath, pattern));
        } catch (error) {
            return false;
        }
    }

    protected fileContains(filePattern: string, searchText: string): boolean {
        try {
            const files = fs.readdirSync(this.workspacePath);
            const matchingFiles = files.filter(file => file.match(new RegExp(filePattern.replace('*', '.*'))));
            
            for (const file of matchingFiles) {
                const content = fs.readFileSync(path.join(this.workspacePath, file), 'utf8');
                if (content.toLowerCase().includes(searchText.toLowerCase())) {
                    return true;
                }
            }
            
            return false;
        } catch (error) {
            return false;
        }
    }

    protected readJsonFile(filePath: string): any {
        try {
            const content = fs.readFileSync(path.join(this.workspacePath, filePath), 'utf8');
            return JSON.parse(content);
        } catch (error) {
            return null;
        }
    }

    protected isTestFile(filePath: string): boolean {
        const testPatterns = [
            /\.test\./,
            /\.spec\./,
            /test\./,
            /_test\./,
            /_spec\./,
            /\/test\//,
            /\/tests\//,
            /\/__tests__\//,
            /\/spec\//,
            /\/specs\//
        ];
        
        return testPatterns.some(pattern => pattern.test(filePath));
    }

    protected isDocumentationFile(filePath: string): boolean {
        const docPatterns = [
            /\.md$/,
            /\.txt$/,
            /readme/i,
            /license/i,
            /changelog/i,
            /contributing/i,
            /\/docs?\//,
            /\/documentation\//
        ];
        
        return docPatterns.some(pattern => pattern.test(filePath.toLowerCase()));
    }

}