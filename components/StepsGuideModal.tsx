import { getStepsKey, STEPS_ENDPOINT } from '@/utils/steps';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AlertManager as Alert } from '@/components/GlobalAlert';

/**
 * Step-by-step guide for connecting iPhone steps (Apple Health) through the "Shortcuts" app.
 * The shortcut sends steps per hour, so every hour lands on the right day by the user's day-reset time.
 */
export default function StepsGuideModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
    const [key, setKey] = useState<string | null>(null);
    const [loadingKey, setLoadingKey] = useState(false);
    const [copied, setCopied] = useState<'key' | 'url' | null>(null);

    useEffect(() => {
        if (!visible) return;
        setLoadingKey(true);
        getStepsKey().then(k => setKey(k)).finally(() => setLoadingKey(false));
    }, [visible]);

    const copy = async (text: string, what: 'key' | 'url') => {
        await Clipboard.setStringAsync(text);
        setCopied(what);
        setTimeout(() => setCopied(null), 2000);
    };

    const regenerate = () => {
        Alert.alert('להחליף מפתח?', 'המפתח הישן יפסיק לעבוד, ותצטרך להדביק את החדש בקיצור באייפון.', [
            { text: 'ביטול', style: 'cancel' },
            {
                text: 'החלף', style: 'destructive', onPress: async () => {
                    setLoadingKey(true);
                    const k = await getStepsKey(true);
                    setKey(k);
                    setLoadingKey(false);
                }
            },
        ]);
    };

    const Step = ({ n, title, children }: { n: number; title: string; children: React.ReactNode }) => (
        <View style={styles.step}>
            <View style={styles.stepHeader}>
                <View style={styles.stepNum}><Text style={styles.stepNumText}>{n}</Text></View>
                <Text style={styles.stepTitle}>{title}</Text>
            </View>
            <View style={{ gap: 6 }}>{children}</View>
        </View>
    );
    const P = ({ children }: { children: React.ReactNode }) => <Text style={styles.p}>{children}</Text>;
    const Action = ({ he, en, children }: { he: string; en: string; children?: React.ReactNode }) => (
        <View style={styles.action}>
            <Text style={styles.actionName}>{he} <Text style={styles.actionEn}>({en})</Text></Text>
            {children}
        </View>
    );

    return (
        <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
            <View style={styles.container}>
                <View style={styles.header}>
                    <Text style={styles.title}>חיבור צעדים מהאייפון</Text>
                    <TouchableOpacity onPress={onClose} accessibilityLabel="סגור">
                        <Ionicons name="close" size={28} color="#1e293b" />
                    </TouchableOpacity>
                </View>

                <ScrollView contentContainerStyle={styles.content}>
                    <Text style={styles.intro}>
                        האייפון סופר צעדים לבד (באפליקציית "בריאות"). כדי שהם יגיעו לכאן, יוצרים פעם אחת "קיצור" קטן באפליקציית קיצורים (Shortcuts) של אפל. לוקח בערך 10 דקות, ואחר כך הכול עובד לבד.
                    </Text>

                    <Step n={1} title="המפתח האישי והכתובת">
                        <P>תצטרך אותם בשלב 2. המפתח מאפשר רק לשלוח צעדים לחשבון שלך – לא לקרוא שום מידע.</P>
                        <View style={styles.copyBox}>
                            <Text style={styles.copyLabel}>המפתח שלך</Text>
                            {loadingKey ? <ActivityIndicator color="#3b82f6" /> : key ? (
                                <>
                                    <Text style={styles.copyValue} selectable numberOfLines={1}>{key}</Text>
                                    <TouchableOpacity style={styles.copyBtn} onPress={() => copy(key, 'key')}>
                                        <Ionicons name={copied === 'key' ? 'checkmark' : 'copy-outline'} size={16} color="#fff" />
                                        <Text style={styles.copyBtnText}>{copied === 'key' ? 'הועתק' : 'העתק מפתח'}</Text>
                                    </TouchableOpacity>
                                </>
                            ) : (
                                <Text style={styles.warn}>לא הצלחנו ליצור מפתח. ייתכן שהחיבור עדיין לא הופעל בשרת – נסה שוב מאוחר יותר.</Text>
                            )}
                        </View>
                        <View style={styles.copyBox}>
                            <Text style={styles.copyLabel}>הכתובת</Text>
                            <Text style={styles.copyValue} selectable numberOfLines={1}>{STEPS_ENDPOINT}</Text>
                            <TouchableOpacity style={styles.copyBtn} onPress={() => copy(STEPS_ENDPOINT, 'url')}>
                                <Ionicons name={copied === 'url' ? 'checkmark' : 'copy-outline'} size={16} color="#fff" />
                                <Text style={styles.copyBtnText}>{copied === 'url' ? 'הועתק' : 'העתק כתובת'}</Text>
                            </TouchableOpacity>
                        </View>
                        <P>טיפ: העתק כל אחד בתורו ממש לפני שמדביקים אותו בקיצור.</P>
                    </Step>

                    <Step n={2} title='יצירת הקיצור "שלח צעדים"'>
                        <P>פתח את אפליקציית קיצורים ← לשונית "קיצורים" ← לחץ + . תן לו את השם "שלח צעדים". עכשיו מוסיפים פעולות לפי הסדר (בשורת החיפוש של הפעולות למטה):</P>
                        <Action he="1. מצא דגימות בריאות" en="Find Health Samples">
                            <P>• סוג: צעדים{'\n'}• לחץ "הוסף מסנן" ← "תאריך התחלה" ← "בטווח האחרון" ← 2 ימים{'\n'}• קבץ לפי: שעה (Group By: Hour){'\n'}• מיין לפי: תאריך התחלה</P>
                        </Action>
                        <Action he="2. חזור עם כל אחד" en="Repeat with Each">
                            <P>יופיע אוטומטית עם "דגימות בריאות". שתי הפעולות הבאות נכנסות בתוך החזרה.</P>
                        </Action>
                        <Action he="3. עצב תאריך" en="Format Date">
                            <P>• לחץ על "תאריך" ← "פריט חזרה" ← בחר "תאריך התחלה" (Start Date){'\n'}• פורמט תאריך: ISO 8601{'\n'}• הפעל "כלול שעה" (Include Time)</P>
                        </Action>
                        <Action he="4. טקסט" en="Text">
                            <P>כתוב בדיוק: [תאריך מעוצב]=[ערך]{'\n'}• "תאריך מעוצב" – משתנה מפעולה 3{'\n'}• סימן = רגיל{'\n'}• "ערך" – לחץ "פריט חזרה" ← בחר "ערך" (Value){'\n'}בלי רווחים לפני או אחרי ה-=</P>
                        </Action>
                        <Action he="5. צרף טקסט" en="Combine Text">
                            <P>מחוץ לחזרה (אחרי "סיים חזרה"): צרף את "תוצאות החזרה" עם "שורה חדשה" (New Lines).</P>
                        </Action>
                        <Action he="6. קבל תוכן של כתובת URL" en="Get Contents of URL">
                            <P>• כתובת: הדבק את הכתובת משלב 1{'\n'}• לחץ על החץ להרחבה ← שיטה (Method): POST{'\n'}• גוף בקשה (Request Body): JSON{'\n'}• הוסף שדה "טקסט": מפתח key, ערך – הדבק את המפתח משלב 1{'\n'}• הוסף שדה "טקסט": מפתח data, ערך – בחר את "טקסט מצורף" מפעולה 5</P>
                        </Action>
                    </Step>

                    <Step n={3} title="בדיקה ראשונה">
                        <P>לחץ על ▶ להריץ את הקיצור. בפעם הראשונה האייפון ישאל:</P>
                        <P>• גישה לנתוני "בריאות" – אפשר "צעדים"{'\n'}• חיבור לכתובת – "אפשר"</P>
                        <P>אם הכול תקין תופיע הודעה "✓ הצעדים עודכנו". בהגדרות כאן יופיע "מחובר", ובמסך הבית – הצעדים של היום.</P>
                    </Step>

                    <Step n={4} title="עדכון אוטומטי">
                        <P>בלשונית "אוטומציה" בקיצורים לוחצים + ויוצרים אוטומציה לכל אחד מאלה. בכל אחת: בוחרים "הפעל מיד" (Run Immediately), מכבים "הודע כשמופעל", ובפעולה בוחרים "הפעל קיצור" ← "שלח צעדים".</P>
                        <P>מומלץ (ברירת המחדל שלנו):{'\n'}• אפליקציה ← WhatsApp ← "נפתחת" – המסך תמיד פתוח שם{'\n'}• אפליקציה ← Safari או Chrome (מה שאתה משתמש) ← "נפתחת"{'\n'}• מטען ← "מחובר" – הסכום הסופי של היום בלילה</P>
                        <P>אפשר לבחור גם אחרים לפי הנוחות: פתיחת כל אפליקציה אחרת, שעות קבועות ביום, הגעה הביתה, חיבור ל-Wi-Fi של הבית, או ידנית עם Siri ("שלח צעדים") / ווידג'ט.</P>
                    </Step>

                    <View style={styles.infoBox}>
                        <Text style={styles.infoTitle}>טוב לדעת</Text>
                        <P>• הקיצור שולח את הצעדים של היומיים האחרונים מחולקים לשעות, וכל שעה נכנסת ליום הנכון לפי שעת החלפת היום שלך בהגדרות (למשל צעדים ב-00:30 עם החלפה ב-02:00 נספרים ליום הקודם).</P>
                        <P>• אפל נועלת את נתוני "בריאות" כשהטלפון נעול – אם הקיצור רץ כשהטלפון נעול, הוא פשוט מדלג. הצעדים לא הולכים לאיבוד ויגיעו בפעם הבאה.</P>
                        <P>• שליחה חוזרת רק מעדכנת – אין כפילויות, גם אם הקיצור רץ הרבה פעמים ביום.</P>
                        <P>• הצעדים נכנסים לציון היומי רק כשהמעקב פעיל ויש נתונים. אם אין עדכון, זה לא מוריד לך ציון.</P>
                        <P>• עובד עם אייפון ואפליקציית "בריאות" של אפל (גם בלי שעון). באנדרואיד החיבור הזה לא זמין.</P>
                    </View>

                    <View style={styles.infoBox}>
                        <Text style={styles.infoTitle}>משהו לא עובד?</Text>
                        <P>• "מפתח לא תקין" – העתק שוב את המפתח משלב 1 והדבק בפעולה 6.{'\n'}• "לא התקבלו נתוני צעדים" – בדוק את פעולות 3-5 (הטקסט צריך להיראות כמו 2026-11-11T21:00:00+02:00=840).{'\n'}• המספר שונה מאפליקציית "בריאות" – ודא שבפעולה 1 נבחר "קבץ לפי: שעה".{'\n'}• עדיין לא מסתדר? צלם מסך של הקיצור.</P>
                    </View>

                    {key && (
                        <TouchableOpacity onPress={regenerate} style={{ alignSelf: 'center', marginTop: 8, marginBottom: 24 }}>
                            <Text style={styles.regen}>החלף מפתח (למשל אם החלפת טלפון)</Text>
                        </TouchableOpacity>
                    )}
                </ScrollView>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    header: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    title: { fontSize: 20, fontWeight: 'bold', color: '#1e293b' },
    content: { padding: 16, gap: 14, paddingBottom: 40 },
    intro: { fontSize: 15, color: '#334155', textAlign: 'right', lineHeight: 22 },
    step: { backgroundColor: '#fff', borderRadius: 16, padding: 16, gap: 10, borderWidth: 1, borderColor: '#e2e8f0' },
    stepHeader: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
    stepNum: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#3b82f6', justifyContent: 'center', alignItems: 'center' },
    stepNumText: { color: '#fff', fontWeight: 'bold' },
    stepTitle: { fontSize: 17, fontWeight: 'bold', color: '#1e293b', textAlign: 'right', flex: 1 },
    p: { fontSize: 14, color: '#475569', textAlign: 'right', lineHeight: 21 },
    action: { backgroundColor: '#f8fafc', borderRadius: 10, padding: 10, gap: 4, borderRightWidth: 3, borderRightColor: '#93c5fd' },
    actionName: { fontSize: 15, fontWeight: 'bold', color: '#1e293b', textAlign: 'right' },
    actionEn: { fontSize: 13, fontWeight: 'normal', color: '#64748b' },
    copyBox: { backgroundColor: '#f8fafc', borderRadius: 10, padding: 10, gap: 6, borderWidth: 1, borderColor: '#e2e8f0' },
    copyLabel: { fontSize: 12, color: '#64748b', textAlign: 'right' },
    copyValue: { fontSize: 13, color: '#1e293b', textAlign: 'left', fontFamily: 'monospace' },
    copyBtn: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#3b82f6', borderRadius: 8, paddingVertical: 8 },
    copyBtnText: { color: '#fff', fontWeight: 'bold' },
    warn: { fontSize: 13, color: '#b45309', textAlign: 'right' },
    infoBox: { backgroundColor: '#eff6ff', borderRadius: 16, padding: 16, gap: 6 },
    infoTitle: { fontSize: 16, fontWeight: 'bold', color: '#1e3a8a', textAlign: 'right' },
    regen: { color: '#64748b', fontSize: 13, textDecorationLine: 'underline' },
});
