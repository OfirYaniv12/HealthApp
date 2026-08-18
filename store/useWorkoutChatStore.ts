import { create } from 'zustand';

export type WorkoutChatMessage = {
    id: string;
    sender: 'user' | 'bot';
    text?: string;
    image?: string;
    isWorkoutCard?: boolean;
    workoutData?: { name: string; duration_minutes: number; calories_burned: number; summary?: string };
    usedModel?: string;
};

interface WorkoutChatState {
    messages: WorkoutChatMessage[];
    addMessage: (msg: WorkoutChatMessage) => void;
    clearMessages: () => void;
    setMessages: (updater: WorkoutChatMessage[] | ((prev: WorkoutChatMessage[]) => WorkoutChatMessage[])) => void;
}

export const useWorkoutChatStore = create<WorkoutChatState>((set) => ({
    messages: [
        { id: '1', sender: 'bot', text: 'היי! איזה אימון עשית ולכמה זמן?' }
    ],
    addMessage: (msg) => set((state) => ({ messages: [...state.messages, msg] })),
    clearMessages: () => set({ 
        messages: [{ id: '1', sender: 'bot', text: 'היי! איזה אימון עשית ולכמה זמן?' }] 
    }),
    setMessages: (updater) => set((state) => ({
        messages: typeof updater === 'function' ? updater(state.messages) : updater
    }))
}));
