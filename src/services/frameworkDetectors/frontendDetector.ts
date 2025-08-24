import { BaseDetector } from './baseDetector';
import { ProjectAnalysis } from '../../types/frameworkTypes';
import { createDefaultAnalysis } from '../../utils/helper';


export class FrontendDetector extends BaseDetector {

    constructor(workspacePath: string) {
        super(workspacePath);
    }

    async detect(): Promise<ProjectAnalysis> {
        const result = createDefaultAnalysis();

        // Detect build tools and CSS frameworks
        result.buildTools.push(...this.detectBuildTools());
        result.frameworks.push(...this.detectCssFrameworks());
        result.frameworks.push(...this.detectByConfigFiles());

        return result;
    }

    private detectBuildTools(): string[] {
        const tools: string[] = [];
        const buildFiles: { [key: string]: string } = {
            'webpack.config.js': 'Webpack',
            'vite.config.js': 'Vite',
            'rollup.config.js': 'Rollup',
            'parcel.config.js': 'Parcel',
            'esbuild.config.js': 'esbuild',
            'tsconfig.json': 'TypeScript',
            'babel.config.js': 'Babel',
            'postcss.config.js': 'PostCSS',
            'snowpack.config.js': 'Snowpack'
        };

        Object.keys(buildFiles).forEach(file => {
            if (this.hasFile(file)) {
                tools.push(buildFiles[file]);
            }
        });

        return tools;
    }

    private detectCssFrameworks(): string[] {
        const frameworks: string[] = [];
        const cssFiles: { [key: string]: string } = {
            'tailwind.config.js': 'Tailwind CSS',
            'bootstrap.config.js': 'Bootstrap',
            'material-ui.config.js': 'Material-UI',
            'antd.config.js': 'Ant Design',
            'bulma.config.js': 'Bulma',
            'foundation.config.js': 'Foundation',
            'semantic-ui.config.js': 'Semantic UI'
        };

        Object.keys(cssFiles).forEach(file => {
            if (this.hasFile(file)) {
                frameworks.push(cssFiles[file]);
            }
        });

        return frameworks;
    }

    private detectByConfigFiles(): string[] {
        const frameworks: string[] = [];
        const configFiles: { [key: string]: string } = {
            'angular.json': 'Angular',
            'vue.config.js': 'Vue.js',
            'svelte.config.js': 'Svelte',
            'ember-cli-build.js': 'Ember.js',
            'astro.config.js': 'Astro',
            'svelte-kit.config.js': 'SvelteKit',
            'remix.config.js': 'Remix'
        };

        Object.keys(configFiles).forEach(file => {
            if (this.hasFile(file)) {
                frameworks.push(configFiles[file]);
            }
        });

        return frameworks;
    }
}