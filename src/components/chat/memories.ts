import { MemoryItem } from "../../types/chatTypes";

export class Memories {
    render(memories: MemoryItem[]): string {
        if (!memories || memories.length === 0) {
            return '';
        }

        return `
            <div class="memories-section slide-up">
                <div class="memories-header">
                    <strong>🧠 Recent Memory Context (${memories.length} items)</strong>
                </div>
                <div class="memories-list">
                    ${memories.map(memory => this.renderMemoryItem(memory)).join('')}
                </div>
            </div>
        `;
    }

    private renderMemoryItem(memory: MemoryItem): string {
        return `
            <div class="memory-item">
                <span class="memory-content">${this.escapeHtml(memory.query || memory.summary || 'Memory item')}</span>
                <span class="memory-timestamp">${this.formatTimeAgo(memory.timestamp)}</span>
            </div>
        `;
    }

    private formatTimeAgo(timestamp: Date | string): string {
        const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        if (diffMins < 1) {return 'now';}
        if (diffMins < 60) {return `${diffMins}m ago`;}
        if (diffHours < 24) {return `${diffHours}h ago`;}
        if (diffDays < 7) {return `${diffDays}d ago`;}
        return date.toLocaleDateString();
    }

    private escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
}