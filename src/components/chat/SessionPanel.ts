import { ChatSession } from "../../types/chatTypes";

export class SessionsPanel {
  render(state: any): string {
    const sessions = state.sessions || [];
    const isOpen = state.isSessionsPanelOpen || false;
    
    return `
      <div class="sessions-panel ${isOpen ? 'open' : ''}" id="sessionsPanel">
          <div id="sessionsList">
              ${sessions.map((session: ChatSession) => this.renderSessionItem(session)).join('')}
          </div>
      </div>`;
  }

  private renderSessionItem(session: ChatSession): string {
    return `
      <div class="session-item ${session.isActive ? 'active' : ''}" onclick="switchSession('${session.id}')">
          <div class="session-name">${session.name}</div>
          <div class="session-meta">
              <span>${session.messageCount} msgs</span>
              <span>${this.formatTimeAgo(session.lastActivity)}</span>
              <div class="session-actions">
                  ${session.id !== 'default' ? `
                    <button class="session-delete" onclick="deleteSession('${session.id}'); event.stopPropagation();" title="Delete Session">✕</button>
                  ` : ''}
              </div>
          </div>
      </div>`;
  }

  private formatTimeAgo(timestamp: Date): string {
  const now = new Date();
  const time = new Date(timestamp);
  const diffMs = now.getTime() - time.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) {
    return 'now';
  }
  if (diffMins < 60) {
    return `${diffMins}m`;
  }
  if (diffHours < 24) {
    return `${diffHours}h`;
  }
  if (diffDays < 7) {
    return `${diffDays}d`;
  }
  return time.toLocaleDateString();
}
}