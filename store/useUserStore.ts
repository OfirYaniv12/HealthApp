import { ActivityLevel, BodyType, GoalType, TargetPace, WorkoutFrequency } from '@/utils/calculators';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export interface UserData {
    id: string | null;
    full_name: string;
    gender: 'Male' | 'Female';
    age: number;
    height: number;
    weight: number;
    goal: GoalType;
    activity_level: ActivityLevel;
    workout_frequency: WorkoutFrequency;
    body_type: BodyType;
    target_pace?: TargetPace;
    daily_targets: {
        calories: number;
        protein: number;
        carbs: number;
        fat: number;
        fiber?: number;
        sodium?: number;
        sugar?: number;
    };
    trackedNutrients?: Record<string, boolean>;
    resetTime?: string; // e.g. "00:00" or "02:00"
    aiPlanExplanation?: string;
    dailyScoreExplanations?: Record<string, string>;
    dailyScoreLastUpdated?: Record<string, number>; // Maps date string to timestamp indicating when explanation was generated
    dailyScoreExplanationHashes?: Record<string, string>; // Maps date string to state fingerprint hash
    dailyScoreData?: Record<string, any>; // Centralized exact score objects
    dailyRecommendations?: { // Note: previous dailyRecommendations name supported
        dateStr: string;
        hash: string;
        timestamp: number;
        data: { short: string[]; full: string };
    };
    aiDailyCount?: { count: number; dateStr: string };
}

interface UserState {
    user: UserData | null;
    setUser: (user: UserData) => void;
    updateTargets: (targets: UserData['daily_targets']) => void;
    updateTrackedNutrients: (nutrients: Record<string, boolean>) => void;
    updateAiPlan: (targets: UserData['daily_targets'], explanation: string) => void;
    setDailyScoreExplanation: (dateStr: string, explanation: string, hash: string, timestamp?: number) => void;
    setDailyScoreData: (dateStr: string, scoreData: any) => void;
    setDailyRecommendations: (dateStr: string, hash: string, timestamp: number, data: { short: string[]; full: string }) => void;
    incrementDailyAiCount: () => void;
    triggerAiPlanUpdate: () => Promise<void>;
    resetUser: () => void;
}

export const useUserStore = create<UserState>()(
    persist(
        (set) => ({
            user: null,
            setUser: (user) => set({ user }),
            updateTargets: (targets) =>
                set((state) => ({
                    user: state.user ? { ...state.user, daily_targets: targets } : null
                })),
            updateTrackedNutrients: (nutrients) =>
                set((state) => ({
                    user: state.user ? { ...state.user, trackedNutrients: { ...(state.user.trackedNutrients || {}), ...nutrients } } : null
                })),
            updateAiPlan: (targets, explanation) =>
                set((state) => ({
                    user: state.user ? { ...state.user, daily_targets: targets, aiPlanExplanation: explanation } : null
                })),
            setDailyScoreExplanation: (date: string, explanation: string, hash: string, timestamp?: number) => {
                set((state) => ({
                    user: state.user
                        ? {
                            ...state.user,
                            dailyScoreExplanations: {
                                ...(state.user.dailyScoreExplanations || {}),
                                [date]: explanation,
                            },
                            dailyScoreExplanationHashes: {
                                ...(state.user.dailyScoreExplanationHashes || {}),
                                [date]: hash,
                            },
                            dailyScoreLastUpdated: {
                                ...(state.user.dailyScoreLastUpdated || {}),
                                [date]: timestamp || Date.now(),
                            }
                        }
                        : null,
                }));
            },
            setDailyScoreData: (dateStr, scoreData) =>
                set((state) => {
                    if (!state.user) return state;
                    return {
                        user: {
                            ...state.user,
                            dailyScoreData: {
                                ...(state.user.dailyScoreData || {}),
                                [dateStr]: scoreData
                            }
                        }
                    };
                }),
            setDailyRecommendations: (dateStr, hash, timestamp, data) =>
                set((state) => {
                    if (!state.user) return state;
                    return {
                        user: {
                            ...state.user,
                            dailyRecommendations: { dateStr, hash, timestamp, data }
                        }
                    };
                }),
            incrementDailyAiCount: () =>
                set((state) => {
                    if (!state.user) return state;
                    const today = new Date().toISOString().split('T')[0];
                    const current = state.user.aiDailyCount || { count: 0, dateStr: today };
                    const isSameFullDay = current.dateStr === today;
                    return {
                        user: {
                            ...state.user,
                            aiDailyCount: {
                                count: isSameFullDay ? current.count + 1 : 1,
                                dateStr: today
                            }
                        }
                    };
                }),
            triggerAiPlanUpdate: async () => {
                const state = useUserStore.getState();
                if (!state.user) return;
                try {
                    const { generatePersonalizedPlan } = require('@/utils/ai');
                    const result = await generatePersonalizedPlan(state.user);
                    if (result) {
                        set((s) => ({
                            user: s.user ? { ...s.user, daily_targets: result.targets, aiPlanExplanation: result.explanation } : null
                        }));
                    }
                } catch (e) {
                    console.error('Failed to trigger AI plan update:', e);
                }
            },
            resetUser: () => set({ user: null }),
        }),
        {
            name: 'user-storage',
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);
