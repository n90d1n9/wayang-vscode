// utils/messageFactory.ts
import { ChatMessage } from '../types/chatTypes';

export class MessageFactory {
    static createUserMessage(content: string, mode?: string, context?: any): ChatMessage {
        return {
            id: Date.now().toString(),
            type: 'user',
            content,
            timestamp: new Date(),
            mode,
            context,
        };
    }

    static createAssistantMessage(content: string, mode?: string, data?: any): ChatMessage {
        return {
            id: Date.now().toString(),
            type: 'assistant',
            content,
            timestamp: new Date(),
            mode,
            ...data, // Spread additional properties
        };
    }

    static createSystemMessage(content: string): ChatMessage {
        return {
            id: Date.now().toString(),
            type: 'system',
            content,
            timestamp: new Date(),
        };
    }

    static createErrorMessage(error: any): ChatMessage {
        let errorMessage = "An unexpected error occurred.";
        
        if (error instanceof Error) {
            errorMessage = error.message;
        }

        return {
            id: `error_${Date.now()}`,
            type: 'assistant',
            content: `❌ ${errorMessage}`,
            timestamp: new Date(),
            error: true,
        };
    }
}