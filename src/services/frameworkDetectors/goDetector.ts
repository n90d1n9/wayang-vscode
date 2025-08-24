import { BaseDetector } from './baseDetector';
import { FrameworkDetectionResult } from '../../types/frameworkTypes';
import * as fs from 'fs';
import path from 'path';

export class GoDetector extends BaseDetector {
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

        if (!this.hasFile('go.mod')) {
            return result;
        }

        result.buildTools.push('Go Modules');

        // Detect frameworks from go.mod
        result.frameworks.push(...this.detectFromGoMod());

        return result;
    }

    private detectFromGoMod(): string[] {
        const frameworks: string[] = [];
        
        try {
            const goMod = fs.readFileSync(path.join(this.workspacePath, 'go.mod'), 'utf8');
            
            const goFrameworks: { [key: string]: string } = {
                'gin': 'Gin',
                'echo': 'Echo',
                'fiber': 'Fiber',
                'gorilla/mux': 'Gorilla Mux',
                'beego': 'Beego',
                'revel': 'Revel',
                'chi': 'Chi',
                'kit': 'Go Kit',
                'micro': 'Micro',
                'gorm': 'GORM',
                'xorm': 'XORM',
                'ent': 'Ent',
                'sqlx': 'SQLx',
                'testify': 'Testify',
                'ginkgo': 'Ginkgo',
                'gomega': 'Gomega'
            };

            Object.keys(goFrameworks).forEach(pkg => {
                if (goMod.includes(pkg)) {
                    frameworks.push(goFrameworks[pkg]);
                }
            });
            
        } catch (error) {
            console.error('Error detecting Go frameworks:', error);
        }

        return frameworks;
    }
}