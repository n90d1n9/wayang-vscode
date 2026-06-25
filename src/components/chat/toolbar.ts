export class Toolbar {
    render(state: any): string {
        return `
            <div class="toolbar">
                <div class="toolbar-group">
                    <button class="toolbar-btn" data-action="toggleSessions" title="Manage Sessions">
                        📁 Sessions
                    </button>
                    <button class="toolbar-btn" data-action="createNewSession" title="Create New Session">
                        ➕ New
                    </button>
                    <button class="toolbar-btn" data-action="analyzeProject" title="Analyze Project">
                        📊 Analyze
                    </button>
                </div>
                
                <div class="toolbar-group">
                    <button class="toolbar-btn" data-action="clearChat" title="Clear Current Chat">
                        🗑️ Clear
                    </button>
                    <button class="toolbar-btn" data-action="showExportMenu" title="Export Conversation">
                        📤 Export
                    </button>
                    <button class="toolbar-btn" data-action="toggleSearch" title="Search History">
                        🔍 Search
                    </button>
                </div>
                
                <div class="toolbar-group">
                    <button class="toolbar-btn" data-action="saveConversation" title="Save to File">
                        💾 Save
                    </button>
                    <button class="toolbar-btn" data-action="loadConversation" title="Load from File">
                        📂 Load
                    </button>
                    <button class="toolbar-btn" data-action="shareConversation" title="Share Conversation">
                        🔗 Share
                    </button>
                </div>
            </div>
        `;
    }
}