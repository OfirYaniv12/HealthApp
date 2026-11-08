import { useUserStore } from './store/useUserStore';

export const forceClearRecommendationsCache = () => {
    const todayDateStr = new Date().toISOString().split('T')[0];
    useUserStore.getState().setDailyRecommendations(todayDateStr, 'force-clear', 0, null as any);
    console.log('Cleared recommendations cache');
};
