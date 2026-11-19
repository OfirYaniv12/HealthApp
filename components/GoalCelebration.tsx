import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';

/**
 * Small "you did it" effects for a reached goal (steps, weekly workouts):
 * gold colours, a slow shine across the progress bar, a pulsing trophy and a one-time confetti burst.
 */

export const GOLD = {
    bg: '#fffbea',
    border: '#facc15',
    iconBg: '#fef08a',
    icon: '#ca8a04',
    text: '#a16207',
    fill: '#eab308',
    fillLight: '#fde047',
};

const useNative = Platform.OS !== 'web';

/** Gold progress fill with a light stripe that sweeps across it every few seconds. */
export function GoldFill({ height = 10 }: { height?: number }) {
    const x = useRef(new Animated.Value(0)).current;
    const [w, setW] = useState(0);
    useEffect(() => {
        const loop = Animated.loop(Animated.sequence([
            Animated.timing(x, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: useNative }),
            Animated.delay(1800),
            Animated.timing(x, { toValue: 0, duration: 0, useNativeDriver: useNative }),
        ]));
        loop.start();
        return () => loop.stop();
    }, [x]);
    const translateX = x.interpolate({ inputRange: [0, 1], outputRange: [-60, w + 60] });
    return (
        <View style={{ flex: 1, height, borderRadius: height / 2, backgroundColor: GOLD.fill, overflow: 'hidden' }} onLayout={e => setW(e.nativeEvent.layout.width)}>
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: height / 2, backgroundColor: GOLD.fillLight, opacity: 0.55 }} />
            <Animated.View style={{ position: 'absolute', top: 0, bottom: 0, width: 40, backgroundColor: 'rgba(255,255,255,0.65)', transform: [{ translateX }, { skewX: '-20deg' }] }} />
        </View>
    );
}

/** A trophy in a gold circle that pulses a few times when it appears. */
export function TrophyBadge({ size = 44 }: { size?: number }) {
    const s = useRef(new Animated.Value(0.6)).current;
    useEffect(() => {
        Animated.sequence([
            Animated.spring(s, { toValue: 1, friction: 4, tension: 120, useNativeDriver: useNative }),
            Animated.loop(Animated.sequence([
                Animated.timing(s, { toValue: 1.12, duration: 380, useNativeDriver: useNative }),
                Animated.timing(s, { toValue: 1, duration: 380, useNativeDriver: useNative }),
            ]), { iterations: 3 }),
        ]).start();
    }, [s]);
    return (
        <Animated.View style={[styles.badge, { width: size, height: size, borderRadius: size / 2, transform: [{ scale: s }] }]}>
            <Ionicons name="trophy" size={size * 0.5} color={GOLD.icon} />
        </Animated.View>
    );
}

const COLORS = ['#facc15', '#eab308', '#f59e0b', '#fde047', '#10b981', '#3b82f6', '#f472b6'];

/**
 * Confetti that bursts once per goal per day (remembered on the device, so it doesn't replay on every visit).
 * Render it inside a card with position: 'relative'; it covers the card and ignores touches.
 */
export function ConfettiBurst({ play, celebrateKey }: { play: boolean; celebrateKey: string }) {
    const [run, setRun] = useState(false);
    const pieces = useRef(Array.from({ length: 22 }, (_, i) => ({
        v: new Animated.Value(0),
        angle: (Math.PI * 2 * i) / 22 + Math.random() * 0.4,
        dist: 60 + Math.random() * 90,
        color: COLORS[i % COLORS.length],
        size: 5 + Math.random() * 5,
        round: Math.random() > 0.5,
    }))).current;

    useEffect(() => {
        if (!play) return;
        let cancelled = false;
        const storageKey = `celebrated:${celebrateKey}`;
        (async () => {
            try {
                if (await AsyncStorage.getItem(storageKey)) return;
                await AsyncStorage.setItem(storageKey, '1');
            } catch (e) { /* storage unavailable: still celebrate */ }
            if (cancelled) return;
            setRun(true);
            Animated.stagger(12, pieces.map(p => Animated.timing(p.v, {
                toValue: 1, duration: 1300, easing: Easing.out(Easing.cubic), useNativeDriver: useNative,
            }))).start(() => setRun(false));
        })();
        return () => { cancelled = true; };
    }, [play, celebrateKey, pieces]);

    if (!run) return null;
    return (
        <View pointerEvents="none" style={styles.overlay}>
            {pieces.map((p, i) => {
                const tx = p.v.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(p.angle) * p.dist * 1.6] });
                const ty = p.v.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, Math.sin(p.angle) * p.dist - 20, Math.sin(p.angle) * p.dist + 40] });
                const opacity = p.v.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] });
                const rotate = p.v.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${(i % 2 ? 1 : -1) * 540}deg`] });
                return (
                    <Animated.View key={i} style={{
                        position: 'absolute', width: p.size, height: p.round ? p.size : p.size * 1.8,
                        borderRadius: p.round ? p.size / 2 : 1, backgroundColor: p.color, opacity,
                        transform: [{ translateX: tx }, { translateY: ty }, { rotate }],
                    }} />
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    badge: { backgroundColor: GOLD.iconBg, justifyContent: 'center', alignItems: 'center', shadowColor: GOLD.fill, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.5, shadowRadius: 8, elevation: 3 },
    overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', zIndex: 5 },
});
