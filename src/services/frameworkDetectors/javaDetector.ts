import { BaseDetector } from './baseDetector';
import { FrameworkDetectionResult } from '../../types/frameworkTypes';

export class JavaDetector extends BaseDetector {
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

        if (!this.hasFile('pom.xml') && !this.hasFile('build.gradle')) {
            return result;
        }

        // Detect build tools
        if (this.hasFile('pom.xml')) {
            result.buildTools.push('Maven');
        }
        if (this.hasFile('build.gradle') || this.hasFile('build.gradle.kts')) {
            result.buildTools.push('Gradle');
        }

        // Detect frameworks
        result.frameworks.push(...this.detectJavaFrameworks());

        return result;
    }

    private detectJavaFrameworks(): string[] {
        const frameworks: string[] = [];
        
        // Spring Boot
        if (this.hasFile('src/main/resources/application.properties') ||
            this.hasFile('src/main/resources/application.yml')) {
            frameworks.push('Spring Boot');
        }

        // Quarkus
        if (this.fileContains('pom.xml', 'quarkus') ||
            this.fileContains('build.gradle', 'quarkus')) {
            frameworks.push('Quarkus');
        }

        // Micronaut
        if (this.fileContains('pom.xml', 'micronaut') ||
            this.fileContains('build.gradle', 'micronaut')) {
            frameworks.push('Micronaut');
        }

        // Jakarta EE
        if (this.fileContains('pom.xml', 'jakarta') ||
            this.fileContains('pom.xml', 'javax')) {
            frameworks.push('Jakarta EE');
        }

        // Hibernate
        if (this.fileContains('pom.xml', 'hibernate') ||
            this.fileContains('build.gradle', 'hibernate')) {
            frameworks.push('Hibernate');
        }

        // Spring specific modules
        if (this.fileContains('pom.xml', 'spring-boot-starter-web')) {
            frameworks.push('Spring Web');
        }
        if (this.fileContains('pom.xml', 'spring-boot-starter-data')) {
            frameworks.push('Spring Data');
        }
        if (this.fileContains('pom.xml', 'spring-boot-starter-security')) {
            frameworks.push('Spring Security');
        }

        return frameworks;
    }
}