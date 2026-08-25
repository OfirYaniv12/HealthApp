import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Platform, Alert as NativeAlert } from 'react-native';

export class AlertManager {
    static setAlertState: any = null;
    static alert(title: string, message?: string, buttons?: any[], options?: any) {
        if (Platform.OS === 'web') {
            if (AlertManager.setAlertState) {
                AlertManager.setAlertState({ visible: true, title, message, buttons });
            } else {
                if (buttons && buttons.length > 0) {
                     window.confirm(title + '\n' + (message || '')) ? (buttons.find(b => b.style !== 'cancel')?.onPress?.()) : (buttons.find(b => b.style === 'cancel')?.onPress?.());
                } else {
                     window.alert(title + '\n' + (message || ''));
                }
            }
        } else {
            NativeAlert.alert(title, message, buttons, options);
        }
    }
}

export const GlobalAlert = () => {
    const [alertState, setAlertState] = useState({ visible: false, title: '', message: '', buttons: [] as any[] });

    useEffect(() => {
        AlertManager.setAlertState = setAlertState;
    }, []);

    if (!alertState.visible) return null;

    const buttons = alertState.buttons && alertState.buttons.length > 0 
        ? alertState.buttons 
        : [{ text: 'אישור', onPress: () => {} }];

    return (
        <Modal transparent visible animationType="fade">
            <View style={styles.overlay}>
                <View style={styles.alertBox}>
                    <Text style={styles.title}>{alertState.title}</Text>
                    {!!alertState.message && <Text style={styles.message}>{alertState.message}</Text>}
                    <View style={styles.buttonRow}>
                        {buttons.map((btn, index) => {
                            const isCancel = btn.style === 'cancel';
                            const isDestructive = btn.style === 'destructive';
                            return (
                                <TouchableOpacity 
                                    key={index} 
                                    style={[styles.button, isCancel ? styles.cancelBtn : (isDestructive ? styles.destructiveBtn : styles.defaultBtn)]} 
                                    onPress={() => {
                                        setAlertState(prev => ({ ...prev, visible: false }));
                                        if (btn.onPress) btn.onPress();
                                    }}
                                >
                                    <Text style={[styles.buttonText, isCancel ? styles.cancelBtnText : (isDestructive ? styles.destructiveBtnText : styles.defaultBtnText)]}>
                                        {btn.text}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.4)', justifyContent: 'center', alignItems: 'center', zIndex: 9999 },
    alertBox: { backgroundColor: '#fff', borderRadius: 24, padding: 24, width: '85%', maxWidth: 400, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 10, alignItems: 'center' },
    title: { fontSize: 20, fontWeight: 'bold', color: '#1e293b', marginBottom: 12, textAlign: 'center' },
    message: { fontSize: 16, color: '#64748b', textAlign: 'center', marginBottom: 24, lineHeight: 22 },
    buttonRow: { flexDirection: 'row-reverse', justifyContent: 'center', gap: 12, width: '100%' },
    button: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    defaultBtn: { backgroundColor: '#3b82f6' },
    cancelBtn: { backgroundColor: '#f1f5f9' },
    destructiveBtn: { backgroundColor: '#ef4444' },
    buttonText: { fontSize: 16, fontWeight: 'bold' },
    defaultBtnText: { color: '#fff' },
    cancelBtnText: { color: '#64748b' },
    destructiveBtnText: { color: '#fff' }
});
