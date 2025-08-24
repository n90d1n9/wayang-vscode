export class WelcomeMessage {
  render(): string {
    return `
      <div class="welcome-message">
          <h3>🎭 Welcome to Wayang Code!</h3>
          <p>Your intelligent coding companion powered by Quarkus backend</p>
          
          <div class="welcome-features">
              ${this.renderFeatureCard('code', '💻 Code Generation', 'Generate, refactor, and optimize code with AI assistance')}
              ${this.renderFeatureCard('review', '🔍 Code Review', 'Comprehensive code analysis and bug detection')}
              ${this.renderFeatureCard('test', '🧪 Test Generation', 'Automated unit test creation and validation')}
              ${this.renderFeatureCard('chat', '💬 Smart Chat', 'Context-aware conversations about your codebase')}
              ${this.renderFeatureCard('analyze', '📊 Project Analysis', 'Deep insights into your project structure')}
              ${this.renderFeatureCard('files', '📁 File Explorer', 'Navigate and analyze project files')}
          </div>
          
          <p><strong>🚀 Select a mode above and start coding!</strong></p>
      </div>`;
  }

  private renderFeatureCard(action: string, title: string, description: string): string {
    let onClickAction = '';
    
    switch (action) {
      case 'code':
      case 'review':
      case 'test':
      case 'chat':
        onClickAction = `setModeAndFocus('${action}')`;
        break;
      case 'analyze':
        onClickAction = 'analyzeProject()';
        break;
      case 'files':
        onClickAction = 'showProjectFiles()';
        break;
      default:
        onClickAction = 'setModeAndFocus("chat")';
    }

    return `
      <div class="feature-card" onclick="${onClickAction}">
          <div class="feature-title">${title}</div>
          <div class="feature-desc">${description}</div>
      </div>`;
  }
}