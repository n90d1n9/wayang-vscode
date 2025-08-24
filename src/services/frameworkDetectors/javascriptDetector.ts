import { BaseDetector } from './baseDetector';
import { FrameworkDetectionResult, ProjectAnalysis } from '../../types/frameworkTypes';
import { createDefaultAnalysis } from '../../utils/helper';

export class JavaScriptDetector extends BaseDetector {

     constructor(workspacePath: string) {
        super(workspacePath);
    }

    async detect(): Promise<ProjectAnalysis> {
            const result = createDefaultAnalysis();

        if (!this.hasFile('package.json')) {
            return result;
        }

        // Detect package managers
        if (this.hasFile('yarn.lock')) {result.buildTools.push('Yarn');}
        if (this.hasFile('pnpm-lock.yaml')) {result.buildTools.push('pnpm');}
        if (this.hasFile('package-lock.json')) {result.buildTools.push('npm');}

        // Detect frameworks from package.json
        const packageJson = this.readJsonFile('package.json');
        if (packageJson) {
            result.frameworks.push(...this.detectFromPackageJson(packageJson));
        }

        // Detect runtime
        if (this.hasFile('deno.json') || this.hasFile('deno.lock')) {
            result.frameworks.push('Deno');
        }

        // Detect specific frameworks by config files
        result.frameworks.push(...this.detectByConfigFiles());

        return result;
    }

    private detectFromPackageJson(packageJson: any): string[] {
        const frameworks: string[] = [];
        const allDeps = {
            ...packageJson.dependencies,
            ...packageJson.devDependencies
        };

        const frameworkMap: { [key: string]: string } = {
            // Frontend frameworks
            'react': 'React',
            'vue': 'Vue.js',
            'angular': 'Angular',
            'svelte': 'Svelte',
            'next': 'Next.js',
            'nuxt': 'Nuxt.js',
            'gatsby': 'Gatsby',
            'remix': 'Remix',
            'astro': 'Astro',
            
            // Backend frameworks
            'express': 'Express.js',
            'koa': 'Koa',
            'nest': 'NestJS',
            'adonisjs': 'AdonisJS',
            'meteor': 'Meteor',
            'hapi': 'Hapi',
            'fastify': 'Fastify',
            
            // Testing frameworks
            'jest': 'Jest',
            'mocha': 'Mocha',
            'chai': 'Chai',
            'cypress': 'Cypress',
            'playwright': 'Playwright',
            'vitest': 'Vitest',
            
            // Build tools
            'webpack': 'Webpack',
            'vite': 'Vite',
            'rollup': 'Rollup',
            'parcel': 'Parcel',
            'esbuild': 'esbuild',
            
            // UI libraries
            'tailwindcss': 'Tailwind CSS',
            'bootstrap': 'Bootstrap',
            'material-ui': 'Material-UI',
            'antd': 'Ant Design',
            
            // State management
            'redux': 'Redux',
            'mobx': 'MobX',
            'zustand': 'Zustand',
            
            // TypeScript
            'typescript': 'TypeScript'
        };

        Object.keys(allDeps).forEach(dep => {
            if (frameworkMap[dep]) {
                frameworks.push(frameworkMap[dep]);
            }
        });

        return frameworks;
    }

    private detectByConfigFiles(): string[] {
        const frameworks: string[] = [];
        const configFiles: { [key: string]: string } = {
            'next.config.js': 'Next.js',
            'next.config.ts': 'Next.js',
            'nuxt.config.js': 'Nuxt.js',
            'nuxt.config.ts': 'Nuxt.js',
            'vue.config.js': 'Vue.js',
            'angular.json': 'Angular',
            'svelte.config.js': 'Svelte',
            'astro.config.js': 'Astro',
            'remix.config.js': 'Remix',
            'ember-cli-build.js': 'Ember.js'
        };

        Object.keys(configFiles).forEach(file => {
            if (this.hasFile(file)) {
                frameworks.push(configFiles[file]);
            }
        });

        return frameworks;
    }
}