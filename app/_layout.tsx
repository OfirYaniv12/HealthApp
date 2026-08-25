import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { initDB } from '@/db/database';
import { useColorScheme } from '@/hooks/use-color-scheme';


import { GlobalAlert } from '@/components/GlobalAlert';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    // initDB().catch(console.error);
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
