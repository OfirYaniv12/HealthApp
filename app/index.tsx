import { useUserStore } from '@/store/useUserStore';
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { supabase } from '@/utils/supabase';

export default function Index() {
    const [mounted, setMounted] = useState(false);
    const user = useUserStore((state) => state.user);
    const resetUser = useUserStore((state) => state.resetUser);

    const [hydrated, setHydrated] = useState(false);
    const [sessionChecked, setSessionChecked] = useState(false);
    const [hasSession, setHasSession] = useState(false);

    useEffect(() => {
        setMounted(true);
        const hasHydratedInitially = useUserStore.persist.hasHydrated();
        setHydrated(hasHydratedInitially);

        if (!hasHydratedInitially) {
            const unsubFinishHydration = useUserStore.persist.onFinishHydration(() => setHydrated(true));
            const fallback = setTimeout(() => {
                if (useUserStore.persist.hasHydrated()) {
                    setHydrated(true);
                } else {
                    setHydrated(true);
                }
            }, 2000);
            return () => {
                unsubFinishHydration();
                clearTimeout(fallback);
            };
        }
    }, []);

    useEffect(() => {
        let isMounted = true;
        
        const checkSession = async () => {
            try {
                const { data: { session }, error } = await supabase.auth.getSession();
                if (session && !error) {
                    if (isMounted) setHasSession(true);
                    
                    if (!useUserStore.getState().user?.full_name) {
                        const { data: userData } = await supabase.from('users').select('*').eq('id', session.user.id).single();
                        if (userData && userData.full_name) {
                            useUserStore.getState().setUser(userData);
                        }
                    }
                } else {
                    if (isMounted) setHasSession(false);
                }
            } catch (error) {
                console.error("Session check error:", error);
                if (isMounted) setHasSession(false);
            } finally {
                if (isMounted) setSessionChecked(true);
            }
        };
        
        checkSession();

        // Ultimate fallback to guarantee the loading screen clears
        const fallback = setTimeout(() => {
            if (isMounted && !sessionChecked) {
                setSessionChecked(true);
            }
        }, 3000);

        return () => {
            isMounted = false;
            clearTimeout(fallback);
        };
    }, []);

    useEffect(() => {
        // Force complete onboarding if the user profile is incomplete
        if (hydrated && user && !user.full_name) {
            resetUser();
        }
    }, [hydrated, user]);

    if (!mounted || !hydrated || !sessionChecked) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" />
            </View>
        );
    }

    if (!hasSession) {
        return <Redirect href={'/login' as any} />;
    }

    if (user && user.full_name) {
        return <Redirect href={'/(drawer)' as any} />;
    } else {
        return <Redirect href={'/onboarding' as any} />;
    }
}
