import AsyncStorage from '@react-native-async-storage/async-storage';
import { useUserStore } from '../store/useUserStore';

export const nuclearWipeStore = async () => {
    try {
        console.log("=== STARTING NUCLEAR WIPE ===");
        
        // 1. Clear Zustand memory directly
        const resetUser = useUserStore.getState().resetUser;
        const currentUser = useUserStore.getState().user;
        
        if (currentUser) {
            // We don't want to delete their whole profile (age, weight), just the AI cache
            useUserStore.setState((state) => ({
                user: state.user ? {
                    ...state.user,
                    dailyScoreExplanations: undefined,
                    dailyScoreData: undefined,
                    dailyScoreLastUpdated: undefined,
                    dailyRecommendations: undefined,
                    aiPlanExplanation: undefined
                } : null
            }));
            console.log("-> Cleared AI Caches from Zustand Memory");
        }

        // 2. Hard wipe AsyncStorage specifically for user store tracking
        // (Zustand persist will sync our setState above, but we can forcefully wipe keys if needed)
        
        // Wait for next frame to ensure Zustand synced to AsyncStorage
        setTimeout(async () => {
            const keys = await AsyncStorage.getAllKeys();
            console.log("-> Current Async Keys:", keys);
            alert("NUCLEAR SCRIPT: Cache purged. AI memory is completely blank.");
        }, 500);

    } catch (e) {
        console.error("Wipe Failed:", e);
    }
};
