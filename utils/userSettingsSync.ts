import { useUserStore } from '@/store/useUserStore';
import { supabase } from '@/utils/supabase';

/**
 * Keeps the user's personal settings (day-reset time, which nutrients are tracked) in Supabase,
 * so they are the same on every device (phone app and website) instead of living only in the
 * browser/phone storage.
 *
 * Requires a `settings` jsonb column on the `users` table:
 *   alter table public.users add column if not exists settings jsonb;
 * Until that column exists, syncing is skipped silently and the app keeps working locally.
 */

export interface SyncedSettings {
    resetTime?: string;
    trackedNutrients?: Record<string, boolean>;
    updatedAt?: number;
}

const pickSettings = (): SyncedSettings | null => {
    const user = useUserStore.getState().user;
    if (!user) return null;
    return {
        resetTime: user.resetTime || '00:00',
        trackedNutrients: user.trackedNutrients || undefined,
        updatedAt: user.settingsUpdatedAt || Date.now(),
    };
};

/** Saves the current settings to the server. Call after the user changes a setting. */
export const pushUserSettings = async () => {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        const settings = pickSettings();
        if (!session?.user || !settings) return;
        const { error } = await supabase.from('users').update({ settings }).eq('id', session.user.id);
        if (error) console.warn('[settings sync] push skipped:', error.message);
    } catch (e) {
        console.warn('[settings sync] push failed', e);
    }
};

/** Loads settings from the server; the newer copy (server or this device) wins. */
export const pullUserSettings = async () => {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        const store = useUserStore.getState();
        if (!session?.user || !store.user) return;
        const { data, error } = await supabase.from('users').select('settings').eq('id', session.user.id).single();
        if (error) { console.warn('[settings sync] pull skipped:', error.message); return; }

        const remote: SyncedSettings | null = data?.settings || null;
        const localUpdatedAt = store.user.settingsUpdatedAt || 0;
        if (remote && (remote.updatedAt || 0) > localUpdatedAt) {
            store.setUser({
                ...store.user,
                resetTime: remote.resetTime || store.user.resetTime,
                trackedNutrients: remote.trackedNutrients || store.user.trackedNutrients,
                settingsUpdatedAt: remote.updatedAt,
            });
        } else if (!remote || (remote.updatedAt || 0) < localUpdatedAt) {
            // Server has nothing yet (or an older copy): upload this device's settings
            await pushUserSettings();
        }
    } catch (e) {
        console.warn('[settings sync] pull failed', e);
    }
};
