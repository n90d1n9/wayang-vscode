import { BaseDetector } from './baseDetector';
import { FrameworkDetectionResult } from '../../types/frameworkTypes';

export class PHPDetector extends BaseDetector {

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

        if (!this.hasFile('composer.json')) {
            return result;
        }

        result.buildTools.push('Composer');

        // Detect frameworks from composer.json
        const composerJson = this.readJsonFile('composer.json');
        if (composerJson) {
            result.frameworks.push(...this.detectFromComposerJson(composerJson));
        }

        // Detect by specific files
        result.frameworks.push(...this.detectByConfigFiles());

        return result;
    }

    private detectFromComposerJson(composerJson: any): string[] {
        const frameworks: string[] = [];
        
        const phpFrameworks: { [key: string]: string } = {
            'laravel/framework': 'Laravel',
            'symfony/symfony': 'Symfony',
            'cakephp/cakephp': 'CakePHP',
            'codeigniter4/codeigniter4': 'CodeIgniter',
            'yiisoft/yii2': 'Yii 2',
            'yiisoft/yii': 'Yii',
            'slim/slim': 'Slim',
            'lumen/lumen': 'Lumen',
            'laminas/laminas': 'Laminas',
            'phalcon/cphalcon': 'Phalcon',
            'spiral/framework': 'Spiral'
        };

        const allDeps = {
            ...composerJson.require,
            ...composerJson['require-dev']
        };

        Object.keys(allDeps || {}).forEach(dep => {
            if (phpFrameworks[dep]) {
                frameworks.push(phpFrameworks[dep]);
            }
        });

        return frameworks;
    }

    private detectByConfigFiles(): string[] {
        const frameworks: string[] = [];
        
        if (this.hasFile('artisan')) { frameworks.push('Laravel');}
        if (this.hasFile('bin/console')) { frameworks.push('Symfony');}
        if (this.hasFile('web/index.php') && this.fileContains('web/index.php', 'cakephp')) { frameworks.push('CakePHP');} 
        if (this.hasFile('public/index.php') && this.fileContains('public/index.php', 'codeigniter')) {frameworks.push('CodeIgniter');}
        
        return frameworks;
    }
}