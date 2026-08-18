import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Ionicons } from '@expo/vector-icons';
import { Drawer } from 'expo-router/drawer';
import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import CustomDrawerContent from '@/components/CustomDrawerContent';

export default function DrawerLayout() {
    const colorScheme = useColorScheme();

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <Drawer
                drawerContent={(props) => <CustomDrawerContent {...props} />}
                screenOptions={{
                    headerShown: false,
                    drawerPosition: 'right',
                    drawerActiveTintColor: Colors[colorScheme ?? 'light'].tint,
                    drawerLabelStyle: { textAlign: 'right', fontSize: 16 }
                }}
            >
                <Drawer.Screen
                    name="index"
                    options={{
                        drawerLabel: 'ראשי',
                        title: 'ראשי',
                        drawerIcon: ({ color, size }) => (
                            <Ionicons name="home-outline" size={size} color={color} />
                        )
                    }}
                />
                <Drawer.Screen
                    name="my-recipes"
                    options={{
                        drawerLabel: 'המתכונים שלי',
                        title: 'המתכונים שלי',
                        drawerIcon: ({ color, size }) => (
                            <Ionicons name="restaurant-outline" size={size} color={color} />
                        )
                    }}
                />
                <Drawer.Screen
                    name="my-workouts"
                    options={{
                        drawerLabel: 'האימונים שלי',
                        title: 'האימונים שלי',
                        drawerIcon: ({ color, size }) => (
                            <Ionicons name="barbell-outline" size={size} color={color} />
                        )
                    }}
                />
                <Drawer.Screen
                    name="workout-history"
                    options={{
                        drawerLabel: 'היסטוריית אימונים',
                        title: 'היסטוריית אימונים',
                        drawerIcon: ({ color, size }) => (
                            <Ionicons name="time-outline" size={size} color={color} />
                        )
                    }}
                />
                <Drawer.Screen
                    name="calendar"
                    options={{
                        drawerLabel: 'לוח השנה שלי',
                        title: 'לוח השנה שלי',
                        drawerIcon: ({ color, size }) => (
                            <Ionicons name="calendar-outline" size={size} color={color} />
                        )
                    }}
                />
                <Drawer.Screen
                    name="edit-profile"
                    options={{
                        drawerLabel: 'עדכון פרטים אישיים',
                        title: 'עדכון פרטים אישיים',
                        drawerIcon: ({ color, size }) => (
                            <Ionicons name="person-circle-outline" size={size} color={color} />
                        )
                    }}
                />
                <Drawer.Screen
                    name="settings"
                    options={{
                        drawerLabel: 'הגדרות',
                        title: 'הגדרות',
                        drawerIcon: ({ color, size }) => (
                            <Ionicons name="settings-outline" size={size} color={color} />
                        )
                    }}
                />

                {/* HIDDEN SCREENS */}
                <Drawer.Screen
                    name="daily-summary"
                    options={{
                        drawerItemStyle: { display: 'none' },
                        headerShown: false
                    }}
                />
                <Drawer.Screen
                    name="recommendations"
                    options={{
                        drawerItemStyle: { display: 'none' },
                        headerShown: false
                    }}
                />
                <Drawer.Screen
                    name="daily-score"
                    options={{
                        drawerItemStyle: { display: 'none' },
                        headerShown: false
                    }}
                />
            </Drawer>
        </GestureHandlerRootView>
    );
}
