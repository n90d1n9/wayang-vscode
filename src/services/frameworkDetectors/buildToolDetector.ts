import { BaseDetector } from './baseDetector';
import { FrameworkDetectionResult } from '../../types/frameworkTypes';

export class BuildToolDetector extends BaseDetector {
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

        result.buildTools.push(...this.detectAllBuildTools());

        return result;
    }

    private detectAllBuildTools(): string[] {
        const tools: string[] = [];

        // CI/CD Tools
        const ciCdTools: { [key: string]: string } = {
            '.github/workflows': 'GitHub Actions',
            '.gitlab-ci.yml': 'GitLab CI',
            '.travis.yml': 'Travis CI',
            'Jenkinsfile': 'Jenkins',
            'azure-pipelines.yml': 'Azure Pipelines',
            'circleci/config.yml': 'CircleCI',
            'bitbucket-pipelines.yml': 'Bitbucket Pipelines'
        };

        Object.keys(ciCdTools).forEach(file => {
            if (this.hasFile(file)) {
                tools.push(ciCdTools[file]);
            }
        });

        // Containerization
        if (this.hasFile('Dockerfile')) {tools.push('Docker');}
        if (this.hasFile('docker-compose.yml') || this.hasFile('docker-compose.yaml')) {
            tools.push('Docker Compose');
        }

        // Package Managers
        if (this.hasFile('package.json')) {tools.push('npm/yarn/pnpm');}
        if (this.hasFile('pom.xml')) {tools.push('Maven');}
        if (this.hasFile('build.gradle')) {tools.push('Gradle');}
        if (this.hasFile('go.mod')) {tools.push('Go Modules');}
        if (this.hasFile('composer.json')) {tools.push('Composer');}
        if (this.hasFile('requirements.txt')) {tools.push('pip');}
        if (this.hasFile('pyproject.toml')) {tools.push('Poetry');}
        if (this.hasFile('Pipfile')) {tools.push('Pipenv');}

        // Other build tools
        if (this.hasFile('Makefile')) {tools.push('Make');}
        if (this.hasFile('CMakeLists.txt')) {tools.push('CMake');}
        if (this.hasFile('Rakefile')) {tools.push('Rake');}
        if (this.hasFile('Gruntfile.js')) {tools.push('Grunt');}
        if (this.hasFile('Gulpfile.js')) {tools.push('Gulp');}

        return [...new Set(tools)]; // Remove duplicates
    }
}