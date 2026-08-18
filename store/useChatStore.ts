import { create } from 'zustand';

export type ChatMessage = {
    id: string;
    sender: 'user' | 'bot';
    text?: string;
    image?: string;
    isMealCard?: boolean;
    mealData?: { name: string; calories: number; protein: number; carbs: number; fat: number; fiber?: number; sodium?: number; sugar?: number; summary?: string };
    usedModel?: string;
};

interface ChatState {
    messages: ChatMessage[];
    addMessage: (msg: ChatMessage) => void;
    clearMessages: () => void;
    setMessages: (updater: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => void;
}

export const useChatStore = create<ChatState>((set) => ({
    messages: [
        { id: '1', sender: 'bot', text: 'היי! אני עוזר התזונה מבוסס ה-AI של HealthApp. מה אכלת היום?' }
    ],
    addMessage: (msg) => set((state) => ({ messages: [...state.messages, msg] })),
    clearMessages: () => set({ 
        messages: [{ id: '1', sender: 'bot', text: 'היי! אני עוזר התזונה מבוסס ה-AI של HealthApp. מה אכלת היום?' }] 
    }),
    setMessages: (updater) => set((state) => ({
        messages: typeof updater === 'function' ? (updater as any)(state.messages) : updater
    }))
}));
