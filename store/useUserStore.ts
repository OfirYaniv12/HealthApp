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
    dailyScoreData?: Record<string, any>; // Centralized exact score objects
    dailyRecommendations?: {
        dateStr: string;
        hash: string;
        timestamp: number;
        data: { short: string[]; full: string };
    };
}

interface UserState {
    user: UserData | null;
    setUser: (user: UserData) => void;
    updateTargets: (targets: UserData['daily_targets']) => void;
    updateTrackedNutrients: (nutrients: Record<string, boolean>) => void;
    updateAiPlan: (targets: UserData['daily_targets'], explanation: string) => void;
    setDailyScoreExplanation: (dateStr: string, explanation: string, timestamp?: number) => void;
    setDailyScoreData: (dateStr: string, scoreData: any) => void;
    setDailyRecommendations: (dateStr: string, hash: string, timestamp: number, data: { short: string[]; full: string }) => void;
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
            setDailyScoreExplanation: (date: string, explanation: string, timestamp?: number) => {
                set((state) => ({
                    user: state.user
                        ? {
                            ...state.user,
                            dailyScoreExplanations: {
                                ...(state.user.dailyScoreExplanations || {}),
                                [date]: explanation,
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
            resetUser: () => set({ user: null }),
        }),
        {
            name: 'user-storage',
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);
