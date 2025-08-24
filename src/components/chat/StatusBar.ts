export class StatusBar {
  render(state: any): string {
    return `
      <div class="status-bar">
          <div class="status-item">
              <span id="projectType">${this.getProjectTypeIndicator(state.projectContext)}</span>
          </div>
          <div class="status-item">
              <div class="connection-indicator"></div>
              <span id="connectionStatus">Connected</span>
          </div>
          <div class="status-item">
              <span id="tokenCount">${state.tokenCount || 0} tokens</span>
          </div>
      </div>`;
  }

  private getProjectTypeIndicator(context: any): string {
    if (!context || !context.projectType) {
      return '🏗️ Loading...';
    }
    
    const depCount = context.dependencies?.length || 0;
    const branch = context.gitBranch || 'no-git';
    return `🏗️ ${context.projectType} • ${depCount} dependencies • ${branch} branch`;
  }
}