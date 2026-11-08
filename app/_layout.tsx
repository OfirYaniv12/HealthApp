import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { Platform } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';


import { GlobalAlert } from '@/components/GlobalAlert';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    // Web: the closed side menu sits just off-screen to the right; without this the whole
    // page can be dragged sideways and screens/windows look cut off on the right edge.
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.documentElement.style.overflowX = 'hidden';
      document.body.style.overflowX = 'hidden';
    }
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding" options={{ headerShown: false }} />
          <Stack.Screen name="(drawer)" options={{ headerShown: false }} />
          <Stack.Screen name="add-meal" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
          <Stack.Screen name="add-workout" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
          <Stack.Screen name="select-workout" options={{ headerShown: false, presentation: 'transparentModal' }} />
          <Stack.Screen name="manual-entry" options={{ headerShown: false, presentation: 'modal' }} />
          <Stack.Screen name="daily-log" options={{ headerShown: false }} />
          <Stack.Screen name="nutritional-analysis" options={{ headerShown: false }} />
          <Stack.Screen name="customize-nutrients" options={{ headerShown: false, presentation: 'modal' }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        </Stack>
        <GlobalAlert />
        <StatusBar style="auto" />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
