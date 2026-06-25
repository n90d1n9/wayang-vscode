export class SettingsPanel {
    render(state: any): string {
        const { 
            serverUrl = 'http://localhost:8080',
            apiKey = '',
            selectedModel = '',
            availableModels = [],
            temperature = 0.7,
            maxTokens = 2048,
            streamEnabled = true
        } = state.serverConfig || {};

        return `
            <div class="settings-panel ${state.isSettingsOpen ? 'open' : ''}">
                <div class="settings-header">
                    <h3>⚙️ Server Configuration</h3>
                    <button class="settings-close-btn" data-action="closeSettings" title="Close Settings">✕</button>
                </div>
                
                <div class="settings-content">
                    <div class="settings-section">
                        <h4>🔗 Connection</h4>
                        <div class="setting-item">
                            <label for="serverUrl">Server URL</label>
                            <input type="text" id="serverUrl" class="setting-input" 
                                   value="${serverUrl}" 
                                   placeholder="http://localhost:8080"
                                   data-setting="serverUrl" />
                            <span class="setting-hint">Local inference server endpoint</span>
                        </div>
                        
                        <div class="setting-item">
                            <label for="apiKey">API Key (Optional)</label>
                            <input type="password" id="apiKey" class="setting-input" 
                                   value="${apiKey}" 
                                   placeholder="Enter your API key"
                                   data-setting="apiKey" />
                            <span class="setting-hint">Required for authenticated servers</span>
                        </div>
                        
                        <div class="setting-item">
                            <button class="test-connection-btn" data-action="testConnection">
                                🔌 Test Connection
                            </button>
                            <span class="connection-status" id="connectionStatus"></span>
                        </div>
                    </div>
                    
                    <div class="settings-section">
                        <h4>🤖 Model Selection</h4>
                        <div class="setting-item">
                            <label for="modelSelect">Active Model</label>
                            <select id="modelSelect" class="setting-select" data-setting="selectedModel">
                                <option value="">Select a model...</option>
                                ${availableModels.length > 0 
                                    ? availableModels.map((model: string) => 
                                        `<option value="${model}" ${model === selectedModel ? 'selected' : ''}>${model}</option>`
                                      ).join('')
                                    : '<option value="" disabled>No models available</option>'
                                }
                            </select>
                            <button class="refresh-models-btn" data-action="refreshModels" title="Refresh model list">
                                🔄 Refresh
                            </button>
                        </div>
                        
                        <div class="model-info" id="modelInfo">
                            ${selectedModel ? `
                                <div class="model-badge">✅ ${selectedModel}</div>
                                <p class="model-description">Active model for code generation and analysis</p>
                            ` : `
                                <p class="model-placeholder">Select a model to start using AI features</p>
                            `}
                        </div>
                    </div>
                    
                    <div class="settings-section">
                        <h4>🎛️ Generation Parameters</h4>
                        <div class="setting-item">
                            <label for="temperature">Temperature: <span id="temperatureValue">${temperature}</span></label>
                            <input type="range" id="temperature" class="setting-range" 
                                   min="0" max="2" step="0.1" 
                                   value="${temperature}"
                                   data-setting="temperature" />
                            <div class="range-labels">
                                <span>Precise</span>
                                <span>Balanced</span>
                                <span>Creative</span>
                            </div>
                        </div>
                        
                        <div class="setting-item">
                            <label for="maxTokens">Max Tokens: <span id="maxTokensValue">${maxTokens}</span></label>
                            <input type="range" id="maxTokens" class="setting-range" 
                                   min="256" max="8192" step="256" 
                                   value="${maxTokens}"
                                   data-setting="maxTokens" />
                            <span class="setting-hint">Maximum response length</span>
                        </div>
                        
                        <div class="setting-item checkbox-item">
                            <input type="checkbox" id="streamEnabled" 
                                   ${streamEnabled ? 'checked' : ''}
                                   data-setting="streamEnabled" />
                            <label for="streamEnabled">Enable Streaming Responses</label>
                        </div>
                    </div>
                    
                    <div class="settings-actions">
                        <button class="save-settings-btn" data-action="saveSettings">
                            💾 Save Configuration
                        </button>
                        <button class="reset-settings-btn" data-action="resetSettings">
                            🔄 Reset Defaults
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
}
