import { BaseDetector } from './baseDetector';
import { FrameworkDetectionResult } from '../../types/frameworkTypes';
import * as fs from 'fs';
import path from 'path';

export class PythonDetector extends BaseDetector {

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

        if (!this.hasFile('requirements.txt') && !this.hasFile('pyproject.toml') && !this.hasFile('setup.py')) {
            return result;
        }

        result.buildTools.push('pip');
        if (this.hasFile('pyproject.toml')) { result.buildTools.push('Poetry'); }
        if (this.hasFile('Pipfile')) { result.buildTools.push('Pipenv'); }

        // Detect frameworks from requirements
        result.frameworks.push(...this.detectFromRequirements());
        
        // Detect by specific files
        result.frameworks.push(...this.detectByConfigFiles());

        return result;
    }

    private detectFromRequirements(): string[] {
        const frameworks: string[] = [];
        
        try {
            if (this.hasFile('requirements.txt')) {
                const requirements = fs.readFileSync(path.join(this.workspacePath, 'requirements.txt'), 'utf8');
                
                const pythonFrameworks: { [key: string]: string } = {
                    'django': 'Django',
                    'flask': 'Flask',
                    'fastapi': 'FastAPI',
                    'tornado': 'Tornado',
                    'pyramid': 'Pyramid',
                    'bottle': 'Bottle',
                    'cherrypy': 'CherryPy',
                    'sanic': 'Sanic',
                    'aiohttp': 'AioHTTP',
                    'requests': 'Requests',
                    'numpy': 'NumPy',
                    'pandas': 'Pandas',
                    'tensorflow': 'TensorFlow',
                    'pytorch': 'PyTorch',
                    'scikit-learn': 'Scikit-learn',
                    'pytest': 'Pytest',
                    'unittest': 'unittest',
                    'django-rest-framework': 'Django REST Framework',
                    'celery': 'Celery'
                };

                Object.keys(pythonFrameworks).forEach(pkg => {
                    if (requirements.toLowerCase().includes(pkg.toLowerCase())) {
                        frameworks.push(pythonFrameworks[pkg]);
                    }
                });
            }
        } catch (error) {
            console.error('Error detecting Python frameworks:', error);
        }

        return frameworks;
    }

    private detectByConfigFiles(): string[] {
        const frameworks: string[] = [];
        
        if (this.hasFile('manage.py')) { frameworks.push('Django');}
        if (this.hasFile('app.py') && this.fileContains('app.py', 'flask')) { frameworks.push('Flask'); }
        if (this.hasFile('main.py') && this.fileContains('main.py', 'fastapi')) { frameworks.push('FastAPI'); }
        if (this.hasFile('docker-compose.yml')) { frameworks.push('Docker'); }
        
        return frameworks;
    }
}