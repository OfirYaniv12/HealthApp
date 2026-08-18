import { Ionicons } from '@expo/vector-icons';
import { DrawerContentComponentProps, DrawerContentScrollView, DrawerItemList } from '@react-navigation/drawer';
import React from 'react';
import { Image, StyleSheet, Text, View, Platform, StatusBar } from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function CustomDrawerContent(props: DrawerContentComponentProps) {
    return (
        <DrawerContentScrollView {...props} contentContainerStyle={styles.container}>
            {/* Drawer Header */}
            <View style={styles.header}>
                <Image 
                    source={require('../assets/images/icon.png')} 
                    style={styles.logo} 
                    resizeMode="contain" 
                />
                <Text style={styles.title}>HealthApp</Text>
            </View>

            {/* Default Drawer Items */}
            <View style={styles.itemsContainer}>
                <DrawerItemList {...props} />
            </View>
        </DrawerContentScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flexGrow: 1,
    },
    header: {
        alignItems: 'center',
        paddingVertical: 20,
        backgroundColor: '#f8fafc',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        marginBottom: 12,
        gap: 8
    },
    logo: {
        width: 60,
        height: 60,
        borderRadius: 16,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1e293b',
    },
    itemsContainer: {
        flex: 1,
    }
});
