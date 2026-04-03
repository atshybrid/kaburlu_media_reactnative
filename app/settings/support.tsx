import { Collapsible } from '@/components/Collapsible';
import { WEB_BASE_URL } from '@/config/appConfig';
import { useThemeColor } from '@/hooks/useThemeColor';
import { getDeviceIdentity } from '@/services/device';
import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import Constants from 'expo-constants';
import { useEffect, useState } from 'react';
import { Alert, Linking, Platform, Pressable, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const CONTACT_EMAIL = 'team@kaburlutoday.com';
const CONTACT_PHONE = '+919118191991';
const CONTACT_PHONE_DISPLAY = '+91 9118191991';

export default function SupportScreen() {
  const bg = useThemeColor({}, 'background');
  const card = useThemeColor({}, 'card');
  const border = useThemeColor({}, 'border');
  const text = useThemeColor({}, 'text');
  const muted = useThemeColor({}, 'muted');

  const [deviceId, setDeviceId] = useState<string>('');
  const [deviceModel, setDeviceModel] = useState<string>('');

  useEffect(() => {
    (async () => {
      try {
        const id = await getDeviceIdentity();
        setDeviceId(id.deviceId);
        setDeviceModel(id.deviceModel || 'Unknown');
      } catch {}
    })();
  }, []);

  const versionName = (Constants as any)?.expoConfig?.version || (Constants as any)?.nativeAppVersion || '1.0.0';
  const buildCode = (Constants as any)?.expoConfig?.android?.versionCode || (Constants as any)?.nativeBuildVersion || '';

  const sendEmail = (kind: 'support' | 'feature' | 'issue' = 'support') => {
    const to = CONTACT_EMAIL;
    const subject = encodeURIComponent(
      `Kaburlu ${kind === 'feature' ? 'Feature Request' : kind === 'issue' ? 'Issue Report' : 'Support'} — v${versionName} (${Platform.OS}${buildCode ? `, ${buildCode}` : ''})`
    );
    const body = encodeURIComponent(
  `Hello Kaburlu team,%0D%0A%0D%0A` +
      `${kind === 'feature' ? 'I have a feature idea: ...' : kind === 'issue' ? 'I found an issue: ...' : 'I need help with...'}%0D%0A%0D%0A` +
      `—%0D%0ADevice ID: ${deviceId}%0D%0ADevice: ${deviceModel}%0D%0APlatform: ${Platform.OS}%0D%0AApp: v${versionName}${buildCode ? ` (${buildCode})` : ''}`
    );
    const url = `mailto:${to}?subject=${subject}&body=${body}`;
    Linking.openURL(url).catch(() => Alert.alert('Error', 'Unable to open mail'));
  };

  const openSupport = () => {
    Linking.openURL(`${WEB_BASE_URL}/support`).catch(() => Alert.alert('Error', 'Unable to open website'));
  };

  const rateUs = () => {
  const pkg = (Constants as any)?.expoConfig?.android?.package || 'com.media.kaburlu';
    const url = `market://details?id=${pkg}`;
    const webUrl = `https://play.google.com/store/apps/details?id=${pkg}`;
    Linking.openURL(url).catch(() => Linking.openURL(webUrl).catch(() => Alert.alert('Error', 'Unable to open Play Store')));
  };

  const shareApp = async () => {
    try {
  const pkg = (Constants as any)?.expoConfig?.android?.package || 'com.media.kaburlu';
      const link = `https://play.google.com/store/apps/details?id=${pkg}`;
  await Share.share({ message: `Try Kaburlu — fast, beautiful news. ${link}` });
    } catch {}
  };

  const copyDebugInfo = async () => {
  const info = `Kaburlu v${versionName}${buildCode ? ` (${buildCode})` : ''}\nPlatform: ${Platform.OS}\nDevice: ${deviceModel}\nDevice ID: ${deviceId}`;
    try {
      await Clipboard.setStringAsync(info);
      Alert.alert('Copied', 'Debug info copied to clipboard');
    } catch {
      Alert.alert('Failed', 'Unable to copy');
    }
  };

  const ItemRow = ({ icon, title, subtitle, onPress }: { icon: any; title: string; subtitle?: string; onPress?: () => void }) => (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [styles.row, { backgroundColor: card, borderColor: border }, pressed && { opacity: 0.92 }]}> 
      <View style={styles.rowLeft}>
        <View style={[styles.iconWrap, { borderColor: border }]}>
          <Feather name={icon} size={18} color={text} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.rowTitle, { color: text }]}>{title}</Text>
          {!!subtitle && <Text style={[styles.rowSubtitle, { color: muted }]}>{subtitle}</Text>}
        </View>
      </View>
      <Feather name="chevron-right" size={18} color={muted} />
    </Pressable>
  );

  return (
    <View style={[styles.safe, { backgroundColor: bg }]}> 
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}> 
          <View style={styles.headerIconWrap}><Feather name="help-circle" size={20} color={text} /></View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: text }]}>Support & Feedback</Text>
            <Text style={[styles.subtitle, { color: muted }]}>We’re here to help — reach us anytime</Text>
          </View>
        </View>
        {/* ── Contact Us — prominently shown per Google Play News Policy ── */}
        <View style={[styles.contactCard, { backgroundColor: '#0F172A', borderColor: '#1E293B' }]}>
          <Text style={styles.contactCardTitle}>Contact Us</Text>
          <Text style={styles.contactCardSub}>Kaburlu Media — reach us directly</Text>

          <TouchableOpacity
            style={styles.contactRow}
            onPress={() => Linking.openURL(`mailto:${CONTACT_EMAIL}`).catch(() => {})}
            activeOpacity={0.75}
          >
            <View style={styles.contactIconWrap}>
              <Feather name="mail" size={18} color="#60A5FA" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.contactLabel}>Email</Text>
              <Text style={styles.contactValue}>{CONTACT_EMAIL}</Text>
            </View>
            <Feather name="chevron-right" size={16} color="#64748B" />
          </TouchableOpacity>

          <View style={styles.contactDivider} />

          <TouchableOpacity
            style={styles.contactRow}
            onPress={() => Linking.openURL(`tel:${CONTACT_PHONE}`).catch(() => {})}
            activeOpacity={0.75}
          >
            <View style={styles.contactIconWrap}>
              <Feather name="phone" size={18} color="#34D399" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.contactLabel}>Phone</Text>
              <Text style={styles.contactValue}>{CONTACT_PHONE_DISPLAY}</Text>
            </View>
            <Feather name="chevron-right" size={16} color="#64748B" />
          </TouchableOpacity>

          <View style={styles.contactDivider} />

          <TouchableOpacity
            style={styles.contactRow}
            onPress={() => Linking.openURL('https://www.kaburlutoday.com/contact').catch(() => {})}
            activeOpacity={0.75}
          >
            <View style={styles.contactIconWrap}>
              <Feather name="globe" size={18} color="#A78BFA" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.contactLabel}>Website</Text>
              <Text style={styles.contactValue}>www.kaburlutoday.com/contact</Text>
            </View>
            <Feather name="chevron-right" size={16} color="#64748B" />
          </TouchableOpacity>
        </View>
        <View style={[styles.card, { backgroundColor: card, borderColor: border }]}> 
          <Text style={[styles.cardTitle, { color: text }]}>Get help</Text>
          <View style={styles.separator} />
          <ItemRow icon="mail" title="Contact support" subtitle="Email us your questions" onPress={() => sendEmail('support')} />
          <View style={styles.divider} />
          <ItemRow icon="alert-circle" title="Report an issue" subtitle="Email report (fallback web)" onPress={() => {
            // Try email first, fallback to support page if mail cannot open
            const to = CONTACT_EMAIL;
            const subject = encodeURIComponent(`Kaburlu Issue Report — v${versionName} (${Platform.OS}${buildCode ? `, ${buildCode}` : ''})`);
            const body = encodeURIComponent(
              `Hello Kaburlu team,%0D%0A%0D%0A` +
              `I found an issue: ...%0D%0A%0D%0A` +
              `Steps to reproduce:%0D%0A1.%0D%0A2.%0D%0A3.%0D%0A%0D%0A` +
              `—%0D%0ADevice ID: ${deviceId}%0D%0ADevice: ${deviceModel}%0D%0APlatform: ${Platform.OS}%0D%0AApp: v${versionName}${buildCode ? ` (${buildCode})` : ''}`
            );
            const url = `mailto:${to}?subject=${subject}&body=${body}`;
            Linking.openURL(url).catch(() => openSupport());
          }} />
          <View style={styles.divider} />
          <ItemRow icon="star" title="Rate us" subtitle="Love the app? Leave a review" onPress={rateUs} />
        </View>

        <View style={[styles.card, { backgroundColor: card, borderColor: border }]}> 
          <Text style={[styles.cardTitle, { color: text }]}>Feedback</Text>
          <View style={styles.separator} />
          <ItemRow icon="message-square" title="Feature request" subtitle="Tell us what to build next" onPress={() => sendEmail('feature')} />
          <View style={styles.divider} />
          <ItemRow icon="share-2" title="Share Kaburlu" subtitle="Invite friends to try the app" onPress={shareApp} />
        </View>

        <View style={[styles.card, { backgroundColor: card, borderColor: border }]}> 
          <Text style={[styles.cardTitle, { color: text }]}>App info</Text>
          <View style={styles.separator} />
          <ItemRow icon="info" title={`Version ${versionName}${buildCode ? ` (${buildCode})` : ''}`} subtitle={`${Platform.OS} • ${deviceModel}`} onPress={copyDebugInfo} />
        </View>

        <View style={[styles.card, { backgroundColor: card, borderColor: border }]}> 
          <Text style={[styles.cardTitle, { color: text }]}>FAQ</Text>
          <View style={styles.separator} />
          <View style={styles.faqList}>
            <View style={[styles.faqItem, { borderColor: border }]}> 
              <Collapsible title="How do I report a bug?">
                <Text style={[styles.faqText, { color: text }]}>Use the “Report an issue” option above. It will open your email with device details pre-filled. Describe steps to reproduce and attach screenshots if possible.</Text>
              </Collapsible>
            </View>
            <View style={[styles.faqItem, { borderColor: border }]}> 
              <Collapsible title="How to change my language?">
                <Text style={[styles.faqText, { color: text }]}>Go to Settings → Language, pick your preferred language. News and categories will update accordingly.</Text>
              </Collapsible>
            </View>
            <View style={[styles.faqItem, { borderColor: border }]}> 
              <Collapsible title="Why is posting limited?">
                <Text style={[styles.faqText, { color: text }]}>To prevent spam, posting requires basic profile details and respects limits. If you’re blocked by a validation, check the chips at the bottom of Post screen.</Text>
              </Collapsible>
            </View>
            <View style={[styles.faqItem, { borderColor: border }]}> 
              <Collapsible title="How to enable App Lock?">
                <Text style={[styles.faqText, { color: text }]}>Go to Settings → Privacy & Security → App Lock. Enable and follow prompts to set up biometrics or device PIN fallback.</Text>
              </Collapsible>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  headerIconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.04)', marginRight: 12 },
  title: { fontSize: 20, fontWeight: '800' },
  subtitle: { marginTop: 2 },

  // Prominent "Contact Us" card
  contactCard: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 14 },
  contactCardTitle: { color: '#F1F5F9', fontSize: 18, fontWeight: '800', marginBottom: 2 },
  contactCardSub: { color: '#94A3B8', fontSize: 12, marginBottom: 14 },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  contactIconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },
  contactLabel: { color: '#94A3B8', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  contactValue: { color: '#F1F5F9', fontSize: 14, fontWeight: '700', marginTop: 1 },
  contactDivider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 2 },

  card: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 12, marginBottom: 14 },
  cardTitle: { fontSize: 14, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(0,0,0,0.08)', marginVertical: 8 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, paddingVertical: 10, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth },
  rowLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  iconWrap: { width: 34, height: 34, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  rowTitle: { fontSize: 16, fontWeight: '700' },
  rowSubtitle: { marginTop: 2, fontSize: 12 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(0,0,0,0.08)', marginVertical: 8 },
  faqList: { gap: 8 },
  faqItem: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: 8 },
  faqText: { fontSize: 14, lineHeight: 20 },
});
