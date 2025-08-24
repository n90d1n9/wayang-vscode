
  export function getCleanStyles(): string {
        return `
            /* CSS Variables for VS Code Theme Integration */
        :root {
            --vscode-font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
            --vscode-font-size: 13px;
            --vscode-foreground: #cccccc;
            --vscode-editor-background: #1e1e1e;
            --vscode-sideBar-background: #252526;
            --vscode-sideBar-border: #3c3c3c;
            --vscode-titleBar-activeBackground: #2d2d30;
            --vscode-titleBar-border: #3c3c3c;
            --vscode-titleBar-activeForeground: #cccccc;
            --vscode-button-secondaryBackground: #3c3c3c;
            --vscode-button-secondaryForeground: #cccccc;
            --vscode-button-secondaryHoverBackground: #454545;
            --vscode-button-background: #0e639c;
            --vscode-button-foreground: #ffffff;
            --vscode-button-hoverBackground: #1177bb;
            --vscode-badge-background: #4d4d4d;
            --vscode-badge-foreground: #ffffff;
            --vscode-widget-border: #3c3c3c;
            --vscode-input-background: #3c3c3c;
            --vscode-input-border: #3c3c3c;
            --vscode-input-foreground: #cccccc;
            --vscode-focusBorder: #0078d4;
            --vscode-descriptionForeground: #989898;
            --vscode-icon-foreground: #c5c5c5;
            --vscode-toolbar-hoverBackground: #2a2d2e;
            --vscode-statusBar-background: #007acc;
            --vscode-statusBar-foreground: #ffffff;
            --vscode-statusBar-border: #3c3c3c;
            --vscode-quickInput-background: #252526;
            --vscode-quickInput-border: #3c3c3c;
            --vscode-quickInputList-focusBackground: #094771;
            --vscode-inputOption-hoverBackground: #454545;
            --vscode-testing-iconPassed: #73c991;
            --vscode-editor-inactiveSelectionBackground: #3a3d41;
            --vscode-editor-selectionBackground: #264f78;
        }

        * { 
            box-sizing: border-box; 
            margin: 0; 
            padding: 0; 
        }
        
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            height: 100vh;
            overflow: hidden;
        }
        
        .chat-container {
            display: flex;
            flex-direction: column;
            height: 100vh;
            max-height: 100vh;
        }
        
        /* Main content layout */
        .main-content {
            display: flex;
            flex: 1;
            overflow: hidden;
            gap: 0;
        }
        
        .sidebar {
            width: 280px;
            min-width: 280px;
            background: var(--vscode-sideBar-background);
            border-right: 1px solid var(--vscode-sideBar-border);
            display: flex;
            flex-direction: column;
            overflow-y: auto;
        }
        
        .chat-area {
            flex: 1;
            display: flex;
            flex-direction: column;
            min-width: 0;
        }
        
        /* Header improvements */
        .header {
            background: var(--vscode-titleBar-activeBackground);
            padding: 12px 16px;
            border-bottom: 1px solid var(--vscode-titleBar-border);
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-shrink: 0;
        }
        
        .session-info {
            display: flex;
            flex-direction: column;
            gap: 4px;
        }
        
        .session-name {
            font-weight: 600;
            font-size: 1.1em;
            color: var(--vscode-titleBar-activeForeground);
        }
        
        .session-status {
            font-size: 0.85em;
            opacity: 0.8;
            color: var(--vscode-titleBar-activeForeground);
        }
        
        .mode-selector {
            display: flex;
            background: var(--vscode-button-secondaryBackground);
            padding: 4px;
            border-radius: 6px;
            gap: 2px;
        }
        
        .mode-btn {
            padding: 6px 12px;
            border: none;
            border-radius: 4px;
            background: transparent;
            color: var(--vscode-button-secondaryForeground);
            cursor: pointer;
            font-size: 0.9em;
            transition: all 0.2s ease;
            min-width: 60px;
        }
        
        .mode-btn:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }
        
        .mode-btn.active {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }
        
        /* Project context */
        .project-context {
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            padding: 10px 12px;
            font-size: 0.8em;
            border-bottom: 1px solid var(--vscode-widget-border);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .context-toggle {
            background: none;
            border: none;
            color: var(--vscode-badge-foreground);
            cursor: pointer;
            font-size: 0.9em;
        }
        
        /* Sessions panel */
        .sessions-panel {
            padding: 12px;
            border-bottom: 1px solid var(--vscode-widget-border);
        }
        
        .sessions-header {
            font-weight: 600;
            margin-bottom: 8px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .session-list {
            display: flex;
            flex-direction: column;
            gap: 4px;
        }
        
        .session-item {
            padding: 6px 8px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 0.9em;
        }
        
        .session-item:hover {
            background-color: var(--vscode-inputOption-hoverBackground);
        }
        
        .session-item.active {
            background-color: var(--vscode-quickInputList-focusBackground);
        }
        
        /* Toolbar improvements */
        .toolbar {
            padding: 8px 12px;
            background: var(--vscode-editor-background);
            border-bottom: 1px solid var(--vscode-widget-border);
            flex-shrink: 0;
        }
        
        .toolbar-group {
            display: flex;
            gap: 6px;
            flex-wrap: wrap;
        }
        
        .session-btn, .clear-button, .export-button {
            padding: 6px 10px;
            border: 1px solid var(--vscode-button-border);
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border-radius: 4px;
            cursor: pointer;
            font-size: 0.85em;
            transition: all 0.2s ease;
        }
        
        .session-btn:hover, .clear-button:hover, .export-button:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }
        
        /* Messages area */
        .chat-messages {
            flex: 1;
            overflow-y: auto;
            padding: 16px;
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
        
        .message {
            max-width: 85%;
            padding: 10px 14px;
            border-radius: 8px;
            line-height: 1.4;
        }
        
        .message-user {
            align-self: flex-end;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }
        
        .message-bot {
            align-self: flex-start;
            background-color: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
        }
        
        .welcome-message {
            text-align: center;
            padding: 40px 20px;
            color: var(--vscode-descriptionForeground);
        }
        
        .welcome-message h3 {
            color: var(--vscode-foreground);
            margin-bottom: 16px;
            font-size: 1.3em;
        }
        
        .welcome-features {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 12px;
            margin: 24px 0;
        }
        
        .feature-card {
            background: var(--vscode-quickInput-background);
            padding: 16px;
            border-radius: 8px;
            border: 1px solid var(--vscode-quickInput-border);
            text-align: left;
            cursor: pointer;
            transition: all 0.2s ease;
        }
        
        .feature-card:hover {
            background: var(--vscode-quickInputList-focusBackground);
            transform: translateY(-2px);
        }
        
        .feature-title {
            font-weight: 600;
            margin-bottom: 6px;
            color: var(--vscode-foreground);
        }
        
        .feature-desc {
            font-size: 0.85em;
            line-height: 1.4;
        }
        
        /* Input area improvements */
        .input-container {
            padding: 16px;
            background: var(--vscode-input-background);
            border-top: 1px solid var(--vscode-input-border);
            flex-shrink: 0;
        }
        
        .input-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
            font-size: 0.85em;
        }
        
        .input-mode {
            color: var(--vscode-descriptionForeground);
            font-weight: 500;
        }
        
        .input-actions {
            display: flex;
            gap: 4px;
        }
        
        .message-action {
            background: none;
            border: none;
            padding: 4px;
            border-radius: 3px;
            cursor: pointer;
            color: var(--vscode-icon-foreground);
            font-size: 0.9em;
        }
        
        .message-action:hover {
            background: var(--vscode-toolbar-hoverBackground);
        }
        
        .message-input {
            width: 100%;
            padding: 12px;
            border: 1px solid var(--vscode-input-border);
            border-radius: 6px;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            font-family: inherit;
            font-size: inherit;
            resize: none;
            min-height: 40px;
            max-height: 120px;
            margin-bottom: 8px;
        }
        
        .message-input:focus {
            outline: none;
            border-color: var(--vscode-focusBorder);
        }
        
        .input-bottom {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .input-features {
            display: flex;
            gap: 12px;
            align-items: center;
        }
        
        .feature-toggle {
            display: flex;
            align-items: center;
            gap: 4px;
            font-size: 0.8em;
            color: var(--vscode-descriptionForeground);
            cursor: pointer;
        }
        
        .feature-checkbox {
            width: 14px;
            height: 14px;
            cursor: pointer;
        }
        
        .send-button {
            padding: 8px 16px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-weight: 500;
            min-width: 60px;
        }
        
        .send-button:hover {
            background: var(--vscode-button-hoverBackground);
        }
        
        .send-button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        
        /* Status bar */
        .status-bar {
            background: var(--vscode-statusBar-background);
            color: var(--vscode-statusBar-foreground);
            padding: 6px 12px;
            font-size: 0.8em;
            border-top: 1px solid var(--vscode-statusBar-border);
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-shrink: 0;
        }
        
        .status-item {
            display: flex;
            align-items: center;
            gap: 6px;
        }
        
        .connection-indicator {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: var(--vscode-testing-iconPassed);
        }
        
        /* Search container */
        .search-container {
            padding: 12px;
            border-bottom: 1px solid var(--vscode-widget-border);
            display: none;
        }
        
        .search-input {
            width: 100%;
            padding: 8px 12px;
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            font-family: inherit;
            font-size: 0.9em;
        }
        
        .search-input:focus {
            outline: none;
            border-color: var(--vscode-focusBorder);
        }
        
        .search-results {
            margin-top: 8px;
            max-height: 200px;
            overflow-y: auto;
        }
        
        /* Responsive design */
        @media (max-width: 768px) {
            .main-content {
                flex-direction: column;
            }
            
            .sidebar {
                width: 100%;
                min-width: auto;
                max-height: 200px;
                border-right: none;
                border-bottom: 1px solid var(--vscode-sideBar-border);
            }
            
            .mode-selector {
                flex-wrap: wrap;
                justify-content: center;
            }
            
            .mode-btn {
                min-width: 50px;
                font-size: 0.8em;
                padding: 4px 8px;
            }
            
            .message {
                max-width: 95%;
            }
        }
        `;
    }
