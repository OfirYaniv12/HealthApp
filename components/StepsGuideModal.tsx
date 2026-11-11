import { AlertManager as Alert } from '@/components/GlobalAlert';
import { getStepsKey, STEPS_ENDPOINT } from '@/utils/steps';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

/**
 * Step-by-step guide for connecting iPhone steps (Apple Health) through the "Shortcuts" app.
 * The guide text is Hebrew; the names of the buttons switch between the phone's language
 * (English / Hebrew), since that's what the user actually sees on screen.
 * Images are real screenshots of a correctly configured shortcut (English phone), key hidden.
 */

type Lang = 'en' | 'he';

const detectPhoneLanguage = (): Lang => {
    try {
        if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
            return (navigator.language || '').toLowerCase().startsWith('he') ? 'he' : 'en';
        }
    } catch (e) { }
    return 'en';
};

export default function StepsGuideModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
    const [key, setKey] = useState<string | null>(null);
    const [loadingKey, setLoadingKey] = useState(false);
    const [copied, setCopied] = useState<'key' | 'url' | null>(null);
    const [lang, setLang] = useState<Lang>(detectPhoneLanguage());

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
        Alert.alert('להחליף מפתח?', 'המפתח הישן יפסיק לעבוד, ותצטרך להדביק את החדש בקיצור באייפון (פעולה 6).', [
            { text: 'ביטול', style: 'cancel' },
            {
                text: 'החלף', style: 'destructive', onPress: async () => {
                    setLoadingKey(true);
                    setKey(await getStepsKey(true));
                    setLoadingKey(false);
                }
            },
        ]);
    };

    // A button / label as it appears on the phone, in the phone's language
    const B = ({ en, he }: { en: string; he: string }) => (
        <Text style={styles.btn}>{lang === 'en' ? en : he}</Text>
    );
    // An action name: in Hebrew mode also show the English name (helps when searching)
    const ActionName = ({ en, he }: { en: string; he: string }) => (
        <Text style={styles.actionName}>
            {lang === 'en' ? en : he}
            {lang === 'he' ? <Text style={styles.actionEn}>  ({en})</Text> : null}
        </Text>
    );
    const P = ({ children }: { children: React.ReactNode }) => <Text style={styles.p}>{children}</Text>;
    const Li = ({ n, children }: { n?: number | string; children: React.ReactNode }) => (
        <View style={styles.li}>
            <Text style={styles.liNum}>{n !== undefined ? `${n}.` : '•'}</Text>
            <Text style={styles.liText}>{children}</Text>
        </View>
    );
    const Section = ({ n, title, children }: { n: number; title: string; children: React.ReactNode }) => (
        <View style={styles.section}>
            <View style={styles.sectionHeader}>
                <View style={styles.sectionNum}><Text style={styles.sectionNumText}>{n}</Text></View>
                <Text style={styles.sectionTitle}>{title}</Text>
            </View>
            <View style={{ gap: 8 }}>{children}</View>
        </View>
    );
    const Action = ({ n, en, he, children }: { n: number; en: string; he: string; children: React.ReactNode }) => (
        <View style={styles.action}>
            <Text style={styles.actionLabel}>פעולה {n}</Text>
            <ActionName en={en} he={he} />
            <View style={{ gap: 6, marginTop: 4 }}>{children}</View>
        </View>
    );
    const Note = ({ children }: { children: React.ReactNode }) => (
        <View style={styles.note}><Ionicons name="alert-circle-outline" size={18} color="#b45309" /><Text style={styles.noteText}>{children}</Text></View>
    );
    const Screenshot = ({ source, caption, ratio }: { source: any; caption: string; ratio: number }) => (
        <View style={styles.shot}>
            <Image source={source} style={[styles.shotImg, { width: 290, height: Math.round(290 / ratio) }]} resizeMode="contain" />
            <Text style={styles.shotCaption}>{caption}{lang === 'he' ? ' (צילום מאייפון באנגלית)' : ''}</Text>
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

                {/* Phone language switch: changes only the names of the buttons in the guide */}
                <View style={styles.langBar}>
                    <Text style={styles.langLabel}>שפת הטלפון שלך:</Text>
                    <View style={styles.segment}>
                        {(['he', 'en'] as Lang[]).map(l => (
                            <TouchableOpacity key={l} style={[styles.segBtn, lang === l && styles.segBtnActive]} onPress={() => setLang(l)}>
                                <Text style={[styles.segText, lang === l && styles.segTextActive]}>{l === 'en' ? 'English' : 'עברית'}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                <ScrollView contentContainerStyle={styles.content}>
                    <Text style={styles.intro}>
                        האייפון סופר צעדים לבד (באפליקציית Health / בריאות). כדי שהם יגיעו לכאן, יוצרים פעם אחת "קיצור" באפליקציית Shortcuts (קיצורים) של אפל. לוקח בערך 10 דקות, ואחר כך הכול עובד לבד.
                    </Text>
                    {lang === 'he' && (
                        <Note>שמות הכפתורים בעברית עשויים להיות מעט שונים בגרסאות iOS שונות. ליד כל פעולה מופיע גם השם באנגלית, ואפשר לחפש לפי מילת המפתח (למשל "בריאות", "חזור", "תאריך").</Note>
                    )}

                    <Section n={1} title="להעתיק את המפתח והכתובת">
                        <P>תצטרך אותם בפעולה 6. המפתח מאפשר רק לשלוח צעדים לחשבון שלך – לא לקרוא שום מידע.</P>
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
                                <Text style={styles.warn}>לא הצלחנו ליצור מפתח כרגע. נסה שוב מאוחר יותר.</Text>
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
                        <P>טיפ: מעתיקים כל אחד רק ממש לפני שמדביקים אותו (בפעולה 6).</P>
                    </Section>

                    <Section n={2} title="ליצור את הקיצור">
                        <Li n={1}>פותחים את אפליקציית <B en="Shortcuts" he="קיצורים" /> ולוחצים <B en="+" he="+" /> (בגרסאות חדשות הוא בתחתית המסך באמצע, בישנות – למעלה מימין).</Li>
                        <Li n={2}>לוחצים על השם למעלה (עם החץ הקטן לידו) ← <B en="Rename" he="שנה שם" /> ← כותבים <B en="Send Steps" he="Send Steps" />.</Li>
                        <Li n={3}>מוסיפים 6 פעולות, אחת אחרי השנייה, דרך שורת החיפוש <B en="Search" he="חיפוש" /> בתחתית המסך.</Li>

                        <Action n={1} en="Find Health Samples" he="מצא דגימות בריאות">
                            <Li n={1}>מחפשים <B en="Find Health Samples" he="בריאות" /> ולוחצים על הפעולה.</Li>
                            <Li n={2}>לוחצים על <B en="Type" he="סוג" /> ובוחרים <B en="Steps" he="צעדים" />.</Li>
                            <Li n={3}>לוחצים <B en="Add Filter" he="הוסף מסנן" /> ← בוחרים <B en="Start Date" he="תאריך התחלה" /> ← <B en="is in the last" he="באחרונים" /> ← כותבים <B en="2" he="2" /> ← <B en="days" he="ימים" />.</Li>
                            <Li n={4}><B en="Group by" he="קבץ לפי" />: בוחרים <B en="Hour" he="שעה" />.</Li>
                            <Li n={5}><B en="Sort by" he="מיין לפי" />: <B en="Start Date" he="תאריך התחלה" />. (<B en="Fill Missing" he="מלא חסרים" /> יכול להישאר דלוק.)</Li>
                            <Screenshot source={require('../assets/images/steps-guide-action1.jpg')} caption="ככה פעולה 1 צריכה להיראות" ratio={600 / 800} />
                        </Action>

                        <Action n={2} en="Repeat with Each" he="חזור עם כל אחד">
                            <Li n={1}>סוגרים את הפעולה הקודמת עם החץ <B en="<" he="<" /> למעלה משמאל.</Li>
                            <Li n={2}>מחפשים <B en="Repeat with Each" he="חזור" /> ולוחצים עליה.</Li>
                            <Li n={3}>יופיעו שתי שורות: <B en="Repeat with each item in Health Samples" he="חזור עם כל פריט ב-דגימות בריאות" /> ומתחתיה <B en="End Repeat" he="סיים חזרה" />. לא משנים בהן כלום.</Li>
                        </Action>

                        <Action n={3} en="Format Date" he="עצב תאריך">
                            <Li n={1}>מחפשים <B en="Format Date" he="תאריך" /> ולוחצים עליה.</Li>
                            <Note>חשוב: הפעולה נוספת בסוף, אבל היא צריכה להיות בתוך החזרה. לוחצים עליה לחיצה ארוכה וגוררים למעלה עד שהיא בין "Repeat with each" לבין "End Repeat". כשהיא במקום הנכון היא מוזזת קצת פנימה.</Note>
                            <Li n={2}>לוחצים על <B en="Date" he="תאריך" /> ← בוחרים <B en="Repeat Item" he="פריט חזרה" />.</Li>
                            <Li n={3}>לוחצים שוב על <B en="Repeat Item" he="פריט חזרה" /> ← בוחרים <B en="Start Date" he="תאריך התחלה" />.</Li>
                            <Li n={4}>לוחצים על החץ <B en=">" he=">" /> שבצד הפעולה ← <B en="Date Format" he="פורמט תאריך" />: בוחרים <B en="ISO 8601" he="ISO 8601" />.</Li>
                            <Li n={5}>מדליקים את <B en="Include ISO 8601 Time" he="כלול שעה ב-ISO 8601" /> (ירוק).</Li>
                            <P>בשורה של הפעולה יהיה כתוב עכשיו <B en="Format  Start Date" he="עצב  תאריך התחלה" /> – זה תקין.</P>
                        </Action>

                        <Action n={4} en="Text" he="טקסט">
                            <Li n={1}>מחפשים <B en="Text" he="טקסט" /> ובוחרים את הפעולה שנקראת פשוט כך (אייקון צהוב).</Li>
                            <Li n={2}>גם אותה גוררים לתוך החזרה – מתחת לפעולה 3 ומעל <B en="End Repeat" he="סיים חזרה" />.</Li>
                            <Li n={3}>לוחצים בתוך התיבה. מעל המקלדת מופיעה שורת כפתורים כחולים:</Li>
                            <Li>לוחצים <B en="Formatted Date" he="תאריך מעוצב" /></Li>
                            <Li>מקלידים את הסימן <B en="=" he="=" /></Li>
                            <Li>לוחצים <B en="Repeat Item" he="פריט חזרה" /></Li>
                            <Li n={4}>עכשיו לוחצים על המילה <B en="Repeat Item" he="פריט חזרה" /> שבתוך התיבה. נפתח חלון, ובו מתחת ל-<B en="Get" he="קבל" /> בוחרים <B en="Value" he="ערך" /> (יופיע ✓ לידו).</Li>
                            <Screenshot source={require('../assets/images/steps-guide-action4-value.jpg')} caption="החלון שנפתח: בוחרים Value" ratio={600 / 748} />
                            <Note>אחרי הבחירה בתיבה עדיין כתוב <B en="Formatted Date = Repeat Item" he="תאריך מעוצב = פריט חזרה" /> – זה בסדר גמור, השורה לא משתנה. כדי לבדוק שזה נכון, לוחצים שוב על <B en="Repeat Item" he="פריט חזרה" /> ורואים ✓ ליד <B en="Value" he="ערך" />.</Note>
                            <Screenshot source={require('../assets/images/steps-guide-action3-4.jpg')} caption="ככה פעולות 3 ו-4 צריכות להיראות בסוף" ratio={600 / 465} />
                        </Action>

                        <Action n={5} en="Combine Text" he="צרף טקסט">
                            <Li n={1}>מחפשים <B en="Combine Text" he="צרף טקסט" /> ולוחצים. הפעם לא גוררים – היא צריכה להיות מתחת ל-<B en="End Repeat" he="סיים חזרה" />.</Li>
                            <Li n={2}>אם כתוב <B en="Spaces" he="רווחים" />, לוחצים עליו ובוחרים <B en="New Lines" he="שורות חדשות" />.</Li>
                        </Action>

                        <Action n={6} en="Get Contents of URL" he="קבל תוכן של URL">
                            <Li n={1}>בשלב 1 כאן לוחצים <Text style={styles.btn}>העתק כתובת</Text>, וחוזרים לקיצורים.</Li>
                            <Li n={2}>מחפשים <B en="Get Contents of URL" he="URL" /> ולוחצים.</Li>
                            <Li n={3}>לוחצים על <B en="URL" he="URL" /> ← לחיצה ארוכה ← <B en="Paste" he="הדבק" />.</Li>
                            <Li n={4}>לוחצים על החץ <B en=">" he=">" /> בצד הפעולה כדי לפתוח עוד הגדרות.</Li>
                            <Li n={5}><B en="Method" he="שיטה" />: מחליפים מ-<B en="GET" he="GET" /> ל-<B en="POST" he="POST" />.</Li>
                            <Li n={6}><B en="Request Body" he="גוף הבקשה" />: בוחרים <B en="JSON" he="JSON" />.</Li>
                            <Li n={7}><B en="Add new field" he="הוסף שדה חדש" /> ← <B en="Text" he="טקסט" />: בשדה הראשון כותבים <Text style={styles.code}>key</Text>. עוברים לכאן, לוחצים <Text style={styles.btn}>העתק מפתח</Text>, חוזרים ומדביקים בשדה השני.</Li>
                            <Li n={8}>שוב <B en="Add new field" he="הוסף שדה חדש" /> ← <B en="Text" he="טקסט" />: בשדה הראשון כותבים <Text style={styles.code}>data</Text>, ובשדה השני בוחרים מהכפתורים הכחולים <B en="Combined Text" he="טקסט משולב" />.</Li>
                            <Screenshot source={require('../assets/images/steps-guide-action6.jpg')} caption="ככה פעולות 5 ו-6 צריכות להיראות" ratio={600 / 865} />
                            <Li n={9}>שומרים: לוחצים על החץ <B en="<" he="<" /> למעלה משמאל (בגרסאות ישנות: <B en="Done" he="סיום" /> למעלה).</Li>
                        </Action>
                    </Section>

                    <Section n={3} title="בדיקה ראשונה">
                        <Li n={1}>פותחים את הקיצור <B en="Send Steps" he="Send Steps" /> ולוחצים <B en="▶" he="▶" /> (למטה מימין).</Li>
                        <Li n={2}>אם נשאלים על גישה לבריאות: <B en="Allow Access" he="אפשר גישה" /> ← מסמנים <B en="Steps" he="צעדים" /> ← <B en="Allow" he="אפשר" />.</Li>
                        <Li n={3}>אם נשאלים על חיבור לכתובת: <B en="Always Allow" he="אפשר תמיד" />.</Li>
                        <Li n={4}>מתחת לפעולה 6 תופיע תשובה עם <Text style={styles.code}>"ok" : true</Text> וההודעה "✓ הצעדים עודכנו (… שעות, … צעדים)". העברית שם עשויה להיראות הפוכה – זה בסדר.</Li>
                        <Screenshot source={require('../assets/images/steps-guide-test-result.jpg')} caption="ככה נראית הצלחה" ratio={600 / 246} />
                        <Li n={5}>באפליקציה: כאן בהגדרות יופיע "מחובר", ובמסך הבית – "צעדים היום".</Li>
                    </Section>

                    <Section n={4} title="עדכון אוטומטי">
                        <P>ככה הצעדים מתעדכנים לבד, בלי ללחוץ כלום. ממליצים על שתי אוטומציות: כשפותחים WhatsApp, וכשפותחים את הדפדפן שבו פתוחה האפליקציה (Safari, או Chrome).</P>

                        <Text style={styles.sub}>אוטומציה 1: כשפותחים WhatsApp</Text>
                        <Li n={1}>באפליקציית <B en="Shortcuts" he="קיצורים" /> לוחצים <B en="+" he="+" /> כדי ליצור קיצור חדש (כמו בשלב 2).</Li>
                        <Li n={2}>בחלון שבתחתית המסך לוחצים על הכפתור <B en="Automation" he="אוטומציה (Automation)" />.</Li>
                        <Screenshot source={require('../assets/images/steps-guide-auto-chip.jpg')} caption="לוחצים Automation" ratio={600 / 276} />
                        <Li n={3}>נפתחת רשימה. גוללים למטה עד הכותרת <B en="Apps" he="אפליקציות (Apps)" /> ולוחצים <B en="App" he="אפליקציה (App)" />.</Li>
                        <Screenshot source={require('../assets/images/steps-guide-auto-app.jpg')} caption="לוחצים App" ratio={600 / 250} />
                        <Li n={4}>למעלה מופיע כרטיס שמתחיל ב-<B en="When" he="כאשר (When)" />. אם לא כתוב בו WhatsApp, לוחצים על שם האפליקציה הכחול ובוחרים <B en="WhatsApp" he="WhatsApp" />.</Li>
                        <Li n={5}>מוודאים שבסוף הכרטיס כתוב <B en="Opened" he="נפתח (Opened)" /> (ולא Closed).</Li>
                        <Li n={6}>לוחצים על החץ העגול שליד <B en="Opened" he="נפתח (Opened)" /> ובודקים:</Li>
                        <Li><B en="Automation" he="אוטומציה (Automation)" /> דלוק (ירוק). ככה זה רץ לבד בלי לשאול.</Li>
                        <Li><B en="Notify" he="הודע (Notify)" /> כבוי. ככה לא קופצת הודעה בכל פתיחה.</Li>
                        <Screenshot source={require('../assets/images/steps-guide-auto-toggles.jpg')} caption="Automation דלוק, Notify כבוי" ratio={600 / 281} />
                        <Li n={7}>לוחצים על שורת החיפוש <B en="Search" he="חיפוש" /> בתחתית, כותבים <B en="Run Shortcut" he="הפעל קיצור" /> ולוחצים על התוצאה.</Li>
                        <Li n={8}>בפעולה החדשה לוחצים על המילה הכחולה <B en="Shortcut" he="קיצור" /> ובוחרים <B en="Send Steps" he="Send Steps" />.</Li>
                        <Li n={9}>לא חובה: לוחצים על השם למעלה ← <B en="Rename" he="שנה שם" /> ← כותבים <B en="WhatsApp Steps" he="WhatsApp Steps" />.</Li>
                        <Li n={10}>שומרים: לוחצים על החץ <B en="<" he="<" /> למעלה משמאל.</Li>
                        <Screenshot source={require('../assets/images/steps-guide-auto-final.jpg')} caption="ככה האוטומציה צריכה להיראות בסוף" ratio={600 / 252} />
                        <P>בדיקה: סוגרים את WhatsApp לגמרי (מחליקים למעלה ומעיפים אותו), פותחים אותו שוב ומחכים 5 שניות. אחר כך נכנסים לכאן – בכרטיס "צעדים היום" במסך הבית אמור להיות כתוב "עודכן עכשיו".</P>

                        <Text style={styles.sub}>אוטומציה 2: כשנכנסים לאפליקציה</Text>
                        <P>אותם שלבים בדיוק, רק שבשלב 4 בוחרים <B en="Safari" he="Safari" /> במקום WhatsApp (ובשלב 9 אפשר לקרוא לה <B en="Safari Steps" he="Safari Steps" />). אם אתה פותח את האפליקציה גם דרך Chrome – עושים עוד אחת כזו עם <B en="Chrome" he="Chrome" />.</P>
                        <Screenshot source={require('../assets/images/steps-guide-auto-list.jpg')} caption="ככה זה נראה ברשימת הקיצורים כשהכול מוכן" ratio={600 / 359} />

                        <Note>בגרסאות iOS ישנות יותר המסך אחר: בתחתית יש לשונית <B en="Automation" he="אוטומציה" /> ← <B en="+" he="+" /> ← <B en="App" he="יישום" /> ← <B en="Choose" he="בחר" /> ← <B en="WhatsApp" he="WhatsApp" /> ← <B en="Done" he="סיום" /> ← מסמנים <B en="Is Opened" he="נפתח" /> ← <B en="Run Immediately" he="הפעל מיד" /> ומכבים <B en="Notify When Run" he="הודע בעת הפעלה" /> ← <B en="Next" he="הבא" /> ← <B en="New Blank Automation" he="אוטומציה ריקה חדשה" /> ← <B en="Add Action" he="הוסף פעולה" /> ← <B en="Run Shortcut" he="הפעל קיצור" /> ← <B en="Shortcut" he="קיצור" /> ← <B en="Send Steps" he="Send Steps" /> ← <B en="Done" he="סיום" />.</Note>
                        <P>אפשר גם טריגרים אחרים מאותה רשימה בשלב 3, לפי הנוחות: <B en="Charger" he="מטען" /> (כשמחברים למטען בלילה), <B en="Time of Day" he="שעה ביום" />, <B en="Wi-Fi" he="Wi-Fi" /> של הבית, או ידנית עם Siri ("Send Steps").</P>
                    </Section>

                    <View style={styles.infoBox}>
                        <Text style={styles.infoTitle}>טוב לדעת</Text>
                        <P>• הקיצור שולח את הצעדים של היומיים האחרונים מחולקים לשעות, וכל שעה נכנסת ליום הנכון לפי שעת החלפת היום שלך בהגדרות (למשל צעדים ב-00:30 עם החלפה ב-02:00 נספרים ליום הקודם).</P>
                        <P>• אפל נועלת את נתוני הבריאות כשהטלפון נעול – אם הקיצור רץ כשהטלפון נעול הוא פשוט מדלג. הצעדים לא הולכים לאיבוד ויגיעו בפעם הבאה.</P>
                        <P>• שליחה חוזרת רק מעדכנת – אין כפילויות גם אם הקיצור רץ הרבה פעמים ביום.</P>
                        <P>• הצעדים נכנסים לציון היומי רק כשהמעקב פעיל ויש נתונים. עדכון מאוחר לא מוריד ציון.</P>
                        <P>• עובד עם אייפון ואפליקציית הבריאות של אפל, גם בלי שעון. באנדרואיד החיבור הזה לא זמין.</P>
                    </View>

                    <View style={styles.infoBox}>
                        <Text style={styles.infoTitle}>משהו לא עובד?</Text>
                        <P>• "מפתח הצעדים לא תקין" – מעתיקים שוב את המפתח משלב 1 ומדביקים בפעולה 6.</P>
                        <P>• "לא התקבלו נתוני צעדים" – בודקים את פעולות 3–5. בפעולה 4 לוחצים על {lang === 'en' ? 'Repeat Item' : 'פריט חזרה'} ובודקים שיש ✓ ליד {lang === 'en' ? 'Value' : 'ערך'}.</P>
                        <P>• המספר שונה מאפליקציית הבריאות – בודקים שבפעולה 1 נבחר {lang === 'en' ? 'Group by: Hour' : 'קבץ לפי: שעה'}.</P>
                        <P>• עדיין לא מסתדר? צלם מסך של הקיצור ושלח.</P>
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
    langBar: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    langLabel: { fontSize: 14, color: '#475569', fontWeight: '600' },
    segment: { flexDirection: 'row-reverse', backgroundColor: '#f1f5f9', borderRadius: 10, padding: 3 },
    segBtn: { paddingVertical: 6, paddingHorizontal: 16, borderRadius: 8 },
    segBtnActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2, elevation: 1 },
    segText: { fontSize: 14, color: '#64748b', fontWeight: '600' },
    segTextActive: { color: '#1e293b' },
    content: { padding: 16, gap: 14, paddingBottom: 40 },
    intro: { fontSize: 15, color: '#334155', textAlign: 'right', lineHeight: 22 },
    section: { backgroundColor: '#fff', borderRadius: 16, padding: 16, gap: 10, borderWidth: 1, borderColor: '#e2e8f0' },
    sectionHeader: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
    sectionNum: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#3b82f6', justifyContent: 'center', alignItems: 'center' },
    sectionNumText: { color: '#fff', fontWeight: 'bold' },
    sub: { fontSize: 15, fontWeight: 'bold', color: '#1e293b', textAlign: 'right', marginTop: 6 },
    sectionTitle: { fontSize: 17, fontWeight: 'bold', color: '#1e293b', textAlign: 'right', flex: 1 },
    p: { fontSize: 14, color: '#475569', textAlign: 'right', lineHeight: 22 },
    li: { flexDirection: 'row-reverse', gap: 6, alignItems: 'flex-start' },
    liNum: { fontSize: 14, color: '#94a3b8', fontWeight: 'bold', minWidth: 16, textAlign: 'right', lineHeight: 22 },
    liText: { flex: 1, fontSize: 14, color: '#334155', textAlign: 'right', lineHeight: 22 },
    btn: { fontWeight: 'bold', color: '#1d4ed8' },
    code: { fontWeight: 'bold', color: '#0f172a', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
    action: { backgroundColor: '#f8fafc', borderRadius: 12, padding: 12, gap: 2, borderWidth: 1, borderColor: '#e2e8f0' },
    actionLabel: { fontSize: 12, color: '#64748b', textAlign: 'right' },
    actionName: { fontSize: 16, fontWeight: 'bold', color: '#1e293b', textAlign: 'right' },
    actionEn: { fontSize: 13, fontWeight: 'normal', color: '#64748b' },
    note: { flexDirection: 'row-reverse', gap: 8, backgroundColor: '#fffbeb', borderRadius: 10, padding: 10, alignItems: 'flex-start' },
    noteText: { flex: 1, fontSize: 13, color: '#92400e', textAlign: 'right', lineHeight: 20 },
    shot: { alignItems: 'center', gap: 6, marginTop: 6 },
    shotImg: { borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
    shotCaption: { fontSize: 12, color: '#64748b', textAlign: 'center' },
    copyBox: { backgroundColor: '#f8fafc', borderRadius: 10, padding: 10, gap: 6, borderWidth: 1, borderColor: '#e2e8f0' },
    copyLabel: { fontSize: 12, color: '#64748b', textAlign: 'right' },
    copyValue: { fontSize: 13, color: '#1e293b', textAlign: 'left', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
    copyBtn: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#3b82f6', borderRadius: 8, paddingVertical: 8 },
    copyBtnText: { color: '#fff', fontWeight: 'bold' },
    warn: { fontSize: 13, color: '#b45309', textAlign: 'right' },
    infoBox: { backgroundColor: '#eff6ff', borderRadius: 16, padding: 16, gap: 6 },
    infoTitle: { fontSize: 16, fontWeight: 'bold', color: '#1e3a8a', textAlign: 'right' },
    regen: { color: '#64748b', fontSize: 13, textDecorationLine: 'underline' },
});
