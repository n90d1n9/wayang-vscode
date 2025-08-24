import * as vscode from 'vscode';

export interface MemoryItem {
    id: string;
    type: 'context' | 'result' | 'interaction';
    content: any;
    timestamp: string;
    relevanceScore?: number;
    tags?: string[];
}

export class MemoryService {
    private static readonly MEMORY_KEY = 'wayang.memory';
    private static readonly MAX_MEMORY_ITEMS = 100;
    
    private memoryCache: Map<string, MemoryItem> = new Map();

    constructor(private context: vscode.ExtensionContext) {
        this.loadMemoryFromStorage();
    }

    async addContext(context: {
        taskId: string;
        query: string;
        context: any;
        timestamp: string;
    }): Promise<void> {
        const memoryItem: MemoryItem = {
            id: `context_${context.taskId}`,
            type: 'context',
            content: {
                query: context.query,
                context: context.context,
                taskId: context.taskId
            },
            timestamp: context.timestamp,
            tags: this.extractTags(context.query)
        };

        this.memoryCache.set(memoryItem.id, memoryItem);
        await this.saveMemoryToStorage();
        await this.cleanupOldMemories();
    }

    async addResult(result: {
        taskId: string;
        result: any;
        summary: string;
        timestamp: string;
    }): Promise<void> {
        const memoryItem: MemoryItem = {
            id: `result_${result.taskId}`,
            type: 'result',
            content: {
                result: result.result,
                summary: result.summary,
                taskId: result.taskId
            },
            timestamp: result.timestamp,
            tags: this.extractTags(result.summary)
        };

        this.memoryCache.set(memoryItem.id, memoryItem);
        await this.saveMemoryToStorage();
        await this.cleanupOldMemories();
    }

    async addInteraction(interaction: {
        query: string;
        response: string;
        context?: any;
    }): Promise<void> {
        const memoryItem: MemoryItem = {
            id: `interaction_${Date.now()}`,
            type: 'interaction',
            content: {
                query: interaction.query,
                response: interaction.response,
                context: interaction.context
            },
            timestamp: new Date().toISOString(),
            tags: this.extractTags(interaction.query + ' ' + interaction.response)
        };

        this.memoryCache.set(memoryItem.id, memoryItem);
        await this.saveMemoryToStorage();
        await this.cleanupOldMemories();
    }

    async getRelevantMemories(query: string, limit: number = 5): Promise<MemoryItem[]> {
        const queryTags = this.extractTags(query);
        const queryTerms = query.toLowerCase().split(' ');

        // Calculate relevance scores
        const memoriesWithScores = Array.from(this.memoryCache.values()).map(memory => {
            let score = 0;

            // Tag matching
            if (memory.tags) {
                const commonTags = memory.tags.filter(tag => queryTags.includes(tag));
                score += commonTags.length * 2;
            }

            // Content similarity
            const contentText = JSON.stringify(memory.content).toLowerCase();
            queryTerms.forEach(term => {
                if (contentText.includes(term)) {
                    score += 1;
                }
            });

            // Recency bonus (more recent = higher score)
            const age = Date.now() - new Date(memory.timestamp).getTime();
            const recencyScore = Math.max(0, 1 - (age / (1000 * 60 * 60 * 24))); // Decay over 24 hours
            score += recencyScore * 0.5;

            memory.relevanceScore = score;
            return memory;
        });

        // Sort by relevance and return top results
        return memoriesWithScores
            .filter(memory => memory.relevanceScore! > 0)
            .sort((a, b) => b.relevanceScore! - a.relevanceScore!)
            .slice(0, limit);
    }

    async getRecentMemories(limit: number = 10): Promise<MemoryItem[]> {
        return Array.from(this.memoryCache.values())
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, limit);
    }

    async getMemoryByType(type: 'context' | 'result' | 'interaction'): Promise<MemoryItem[]> {
        return Array.from(this.memoryCache.values())
            .filter(memory => memory.type === type)
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }

    async searchMemories(searchTerm: string): Promise<MemoryItem[]> {
        const term = searchTerm.toLowerCase();
        
        return Array.from(this.memoryCache.values())
            .filter(memory => {
                const contentText = JSON.stringify(memory.content).toLowerCase();
                return contentText.includes(term) || 
                       memory.tags?.some(tag => tag.includes(term));
            })
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }

    async clearMemory(): Promise<void> {
        this.memoryCache.clear();
        await this.context.globalState.update(MemoryService.MEMORY_KEY, undefined);
    }

    async clearOldMemories(olderThanDays: number = 30): Promise<void> {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

        const itemsToDelete: string[] = [];
        
        for (const [id, memory] of this.memoryCache.entries()) {
            if (new Date(memory.timestamp) < cutoffDate) {
                itemsToDelete.push(id);
            }
        }

        itemsToDelete.forEach(id => this.memoryCache.delete(id));
        
        if (itemsToDelete.length > 0) {
            await this.saveMemoryToStorage();
        }
    }

    async getMemoryStats(): Promise<{
        totalItems: number;
        byType: Record<string, number>;
        oldestItem?: Date;
        newestItem?: Date;
        sizeMB: number;
    }> {
        const memories = Array.from(this.memoryCache.values());
        
        const stats = {
            totalItems: memories.length,
            byType: {
                context: 0,
                result: 0,
                interaction: 0
            },
            oldestItem: undefined as Date | undefined,
            newestItem: undefined as Date | undefined,
            sizeMB: 0
        };

        if (memories.length === 0) {
            return stats;
        }

        // Calculate type distribution
        memories.forEach(memory => {
            stats.byType[memory.type]++;
        });

        // Find oldest and newest items
        const timestamps = memories.map(m => new Date(m.timestamp));
        stats.oldestItem = new Date(Math.min(...timestamps.map(d => d.getTime())));
        stats.newestItem = new Date(Math.max(...timestamps.map(d => d.getTime())));

        // Estimate size in MB
        const dataString = JSON.stringify(Array.from(this.memoryCache.values()));
        stats.sizeMB = new Blob([dataString]).size / (1024 * 1024);

        return stats;
    }

    private async loadMemoryFromStorage(): Promise<void> {
        try {
            const storedMemories = this.context.globalState.get<MemoryItem[]>(MemoryService.MEMORY_KEY, []);
            this.memoryCache = new Map(storedMemories.map(item => [item.id, item]));
        } catch (error) {
            console.error('Failed to load memory from storage:', error);
            this.memoryCache = new Map();
        }
    }

    private async saveMemoryToStorage(): Promise<void> {
        try {
            const memoriesToStore = Array.from(this.memoryCache.values());
            await this.context.globalState.update(MemoryService.MEMORY_KEY, memoriesToStore);
        } catch (error) {
            console.error('Failed to save memory to storage:', error);
        }
    }

    private async cleanupOldMemories(): Promise<void> {
        if (this.memoryCache.size <= MemoryService.MAX_MEMORY_ITEMS) {
            return;
        }

        // Sort by timestamp and keep only the most recent items
        const sortedMemories = Array.from(this.memoryCache.values())
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        const itemsToKeep = sortedMemories.slice(0, MemoryService.MAX_MEMORY_ITEMS);
        
        this.memoryCache = new Map(itemsToKeep.map(item => [item.id, item]));
        await this.saveMemoryToStorage();
    }

    private extractTags(text: string): string[] {
        const words = text.toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 2);

        // Remove common stop words
        const stopWords = new Set(['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'has', 'was']);
        const filteredWords = words.filter(word => !stopWords.has(word));

        // Return unique words as tags
        return Array.from(new Set(filteredWords)).slice(0, 10); // Limit to 10 tags
    }
}