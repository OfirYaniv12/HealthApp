import { useUserStore } from '@/store/useUserStore';
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

export default function Index() {
    const [mounted, setMounted] = useState(false);
    const user = useUserStore((state) => state.user);
    const resetUser = useUserStore((state) => state.resetUser);

    const [hydrated, setHydrated] = useState(false);

    useEffect(() => {
        setMounted(true);
        const hasHydratedInitially = useUserStore.persist.hasHydrated();
        setHydrated(hasHydratedInitially);

        if (!hasHydratedInitially) {
            const unsubFinishHydration = useUserStore.persist.onFinishHydration(() => setHydrated(true));
            return () => {
                unsubFinishHydration();
            };
        }
    }, []);

    useEffect(() => {
        // Force complete onboarding if the user profile is incomplete (e.g. from an older version of the schema)
        if (hydrated && user && !user.full_name) {
            resetUser();
        }
    }, [hydrated, user]);

    if (!mounted || !hydrated) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" />
            </View>
        );
    }

    if (user && user.full_name) {
        return <Redirect href={'/(drawer)' as any} />;
    } else {
        return <Redirect href={'/onboarding' as any} />;
    }
}
