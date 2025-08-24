
export class Toolbar {
    render(state: any): string {
        return `
            <div class="toolbar">
          <div class="toolbar-group">
              <button class="session-btn" onclick="toggleSessions()" title="Manage Sessions">
                  📁 Sessions
              </button>
              <button class="session-btn" onclick="createNewSession()" title="Create New Session">
                  ➕ New
              </button>
              <button class="session-btn" onclick="analyzeProject()" title="Analyze Project">
                  📊 Analyze
              </button>
          </div>
          
          <div class="toolbar-group">
              <button class="clear-button" onclick="clearChat()" title="Clear Current Chat">
                  🗑️ Clear
              </button>
              <button class="export-button" onclick="showExportMenu()" title="Export Conversation">
                  📤 Export
              </button>
              <button class="session-btn" onclick="toggleSearch()" title="Search History">
                  🔍 Search
              </button>
          </div>
          
          <div class="toolbar-group">
              <button class="session-btn" onclick="saveConversation()" title="Save to File">
                  💾 Save
              </button>
              <button class="session-btn" onclick="loadConversation()" title="Load from File">
                  📂 Load
              </button>
              <button class="session-btn" onclick="shareConversation()" title="Share Conversation">
                  🔗 Share
              </button>
          </div>
      </div>
        `;
    }
}