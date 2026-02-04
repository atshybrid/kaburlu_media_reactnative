import { useRouter } from 'expo-router';
import LottieView from 'lottie-react-native';
import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../constants/Colors';
import { loadTokens } from '@/services/auth';
import { usePostNewsDraftStore } from '@/state/postNewsDraftStore';

export default function CongratsScreen() {
  const router = useRouter();
  const [userRole, setUserRole] = useState<string>('');
  const resetDraft = usePostNewsDraftStore((s) => s.reset);

  useEffect(() => {
    loadTokens().then(tokens => {
      const role = tokens?.decodedAccessToken?.role || '';
      console.log('[Congrats] User role loaded:', role);
      setUserRole(role);
    }).catch(err => {
      console.error('[Congrats] Failed to load tokens:', err);
      setUserRole('');
    });
  }, []);

  const handlePostAnother = () => {
    console.log('[Congrats] Post another clicked - starting');
    try {
      resetDraft(); // Clear previous article data
      console.log('[Congrats] Draft reset complete');
      
      // Direct navigation
      router.replace('/post-news');
      console.log('[Congrats] Navigation to post-news initiated');
    } catch (error) {
      console.error('[Congrats] Error in handlePostAnother:', error);
      Alert.alert('Navigation Error', String(error));
    }
  };

  const handleViewDashboard = () => {
    console.log('[Congrats] Dashboard clicked, role:', userRole);
    try {
      let targetRoute = '/news'; // Default fallback
      
      // Route based on user role
      if (userRole === 'TENANT_ADMIN' || userRole === 'SUPER_ADMIN') {
        console.log('[Congrats] Navigating to tenant dashboard');
        targetRoute = '/tenant/dashboard';
      } else if (userRole === 'REPORTER') {
        console.log('[Congrats] Navigating to reporter dashboard');
        targetRoute = '/reporter/dashboard';
      } else {
        console.log('[Congrats] Unknown role, going to news');
      }
      
      router.replace(targetRoute);
      console.log('[Congrats] Navigation to', targetRoute, 'initiated');
    } catch (error) {
      console.error('[Congrats] Error in handleViewDashboard:', error);
      Alert.alert('Navigation Error', String(error));
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.center} pointerEvents="box-none">
        <LottieView
          source={require('../assets/lotti/congratulation.json')}
          autoPlay
          loop={false}
          style={{ width: 260, height: 260 }}
          pointerEvents="none"
        />
        <Text style={styles.title}>అభినందనలు! 🎉</Text>
        <Text style={styles.subtitle}>మీ ఆర్టికల్ విజయవంతంగా సబ్మిట్ చేయబడింది.</Text>
        <View style={styles.actions} pointerEvents="box-none">
          <TouchableOpacity 
            style={styles.primaryBtn} 
            onPress={() => {
              console.log('[Congrats] ⭐ PRIMARY BUTTON PRESSED!');
              handlePostAnother();
            }}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.primaryBtnText}>📝 మరో న్యూస్ పోస్ట్ చేయండి</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.secondaryBtn} 
            onPress={() => {
              console.log('[Congrats] ⭐ SECONDARY BUTTON PRESSED!');
              handleViewDashboard();
            }}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.secondaryBtnText}>📊 డ్యాష్‌బోర్డ్ చూడండి</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#ffffff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  title: { fontSize: 24, fontWeight: '700', color: '#111', marginTop: 8 },
  subtitle: { fontSize: 15, color: '#475569', textAlign: 'center', marginTop: 6, lineHeight: 20 },
  actions: { marginTop: 28, width: '100%', gap: 14 },
  primaryBtn: { backgroundColor: Colors.light.primary, paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontSize: 15.5, fontWeight: '600' },
  secondaryBtn: { backgroundColor: '#f1f5f9', paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  secondaryBtnText: { color: Colors.light.primary, fontSize: 15.5, fontWeight: '600' },
});
