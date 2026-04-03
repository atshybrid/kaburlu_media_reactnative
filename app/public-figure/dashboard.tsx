/**
 * PUBLIC_FIGURE Dashboard
 * 
 * Voice-activated news briefing for public figures
 * - Auto-plays question voice on mount
 * - Shows loading/listening animation
 * - Plays response audio
 * - Displays personalized news feed
 */

import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { getPublicFigureIdFromName, isPublicFigure } from '@/services/roles';
import { loadTokens } from '@/services/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import LottieView from 'lottie-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  BackHandler,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Voice file mapping
const VOICE_FILES = {
  bandisanjay: require('@/assets/audio/sample_voice/Bandisanjay_voice.mp3'),
  kavitha: require('@/assets/audio/sample_voice/Kavitha.mp3'),
  cm: require('@/assets/audio/sample_voice/CM_voice.mp3'),
  ktr: require('@/assets/audio/sample_voice/KTR_sample.mp3'),
};

const FIGURE_NAMES = {
  bandisanjay: 'Bandi Sanjay',
  kavitha: 'Kavitha',
  cm: 'Chief Minister',
  ktr: 'KTR',
};

// Sample news articles (no backend call)
const SAMPLE_NEWS = {
  // News featuring the public figure
  myNews: [
    {
      id: 'my1',
      title: 'బండి సంజయ్ గారు జనసభలో భారీ ప్రతిస్పందన',
      summary: 'నిర్మల్ నియోజకవర్గంలో జరిగిన జనసభలో వేలాది మంది పాల్గొన్నారు',
      category: 'Politics',
      timestamp: '1 hour ago',
      source: 'కబుర్లు న్యూస్',
      image: '📰',
    },
    {
      id: 'my2',
      title: 'రాష్ట్ర అభివృద్ధి పథకాల సమీక్ష',
      summary: 'రాష్ట్ర ప్రభుత్వం ప్రారంభించిన కొత్త అభివృద్ధి పథకాల వివరాలు',
      category: 'Development',
      timestamp: '3 hours ago',
      source: 'తెలంగాణ టుడే',
      image: '📋',
    },
    {
      id: 'my3',
      title: 'యువత కోసం ప్రత్యేక ఉద్యోగ మేళా',
      summary: 'నిరుద్యోగ యువతకు ఉద్యోగావకాశాలు కల్పించే కార్యక్రమం',
      category: 'Employment',
      timestamp: '5 hours ago',
      source: 'వార్తా వాణి',
      image: '💼',
    },
  ],
  
  // Trending news
  trending: [
    {
      id: 'tr1',
      title: 'హైదరాబాద్ మెట్రో కొత్త లైన్ ప్రారంభం',
      summary: 'రవాణా సౌకర్యాలు మెరుగుపరచడానికి కొత్త మెట్రో మార్గం',
      category: 'Infrastructure',
      timestamp: '2 hours ago',
      views: '25K వ్యూస్',
      trending: true,
    },
    {
      id: 'tr2',
      title: 'రైతులకు ఉచిత విద్యుత్ పథకం ప్రారంభం',
      summary: '24 గంటల ఉచిత విద్యుత్ సౌకర్యం అందుబాటులోకి',
      category: 'Agriculture',
      timestamp: '4 hours ago',
      views: '18K వ్యూస్',
      trending: true,
    },
    {
      id: 'tr3',
      title: 'IT రంగంలో 50,000 కొత్త ఉద్యోగాలు',
      summary: 'హైదరాబాద్ టెక్ కంపెనీలు భారీ నియామకాలు',
      category: 'Technology',
      timestamp: '6 hours ago',
      views: '32K వ్యూస్',
      trending: true,
    },
  ],
  
  // Today's podcasts
  podcasts: [
    {
      id: 'pod1',
      title: 'రాజకీయ విశ్లేషణ - తెలంగాణ ప్రస్థానం',
      description: 'రాష్ట్ర రాజకీయ పరిస్థితులపై లోతైన చర్చ',
      duration: '45 నిమిషాలు',
      host: 'రామకృష్ణ',
      category: 'Politics',
      timestamp: 'నేడు ఉదయం 9:00',
    },
    {
      id: 'pod2',
      title: 'అభివృద్ధి చర్చ - కొత్త పథకాలు',
      description: 'రాష్ట్ర అభివృద్ధి పథకాల సమగ్ర సమీక్ష',
      duration: '30 నిమిషాలు',
      host: 'లక్ష్మి',
      category: 'Development',
      timestamp: 'నేడు మధ్యాహ్నం 2:00',
    },
    {
      id: 'pod3',
      title: 'రైతు సమస్యలు మరియు పరిష్కారాలు',
      description: 'వ్యవసాయ రంగ సవాళ్లపై నిపుణుల అభిప్రాయాలు',
      duration: '40 నిమిషాలు',
      host: 'వెంకటేష్',
      category: 'Agriculture',
      timestamp: 'నేడు సాయంత్రం 5:00',
    },
  ],
};

const KAVITHA_SAMPLE_NEWS = {
  // News featuring Kavitha (today samples)
  myNews: [
    {
      id: 'kv_my1',
      title: 'కవిత గారి ఆధ్వర్యంలో మహిళా సాధికారత సమావేశం',
      summary: 'హైదరాబాద్‌లో జరిగిన మహిళా సాధికారత కార్యక్రమంలో పలు కీలక అంశాలపై చర్చించారు',
      category: 'Politics',
      timestamp: 'today 9:30 AM',
      source: 'కబుర్లు న్యూస్',
      image: '📰',
    },
    {
      id: 'kv_my2',
      title: 'గ్రామీణ మహిళల స్వయం ఉపాధికి కొత్త మార్గదర్శకాలు',
      summary: 'స్వయం సహాయక సంఘాల కోసం ప్రత్యేక శిక్షణా కేంద్రాల ఏర్పాటు పై ప్రకటన చేశారు',
      category: 'Development',
      timestamp: 'today 12:15 PM',
      source: 'తెలంగాణ టుడే',
      image: '📋',
    },
    {
      id: 'kv_my3',
      title: 'యువతీ విద్యార్థినుల కోసం స్కిల్ డెవలప్‌మెంట్ డ్రైవ్ ప్రారంభం',
      summary: 'ఉద్యోగ అవకాశాల కోసం రాష్ట్రవ్యాప్తంగా ప్రత్యేక శిక్షణా శిబిరాలు నిర్వహించనున్నారు',
      category: 'Employment',
      timestamp: 'today 4:40 PM',
      source: 'వార్తా వాణి',
      image: '💼',
    },
  ],

  trending: [
    {
      id: 'kv_tr1',
      title: 'కవిత ప్రసంగం సోషల్ మీడియాలో ట్రెండ్ అవుతోంది',
      summary: 'మహిళా అభివృద్ధి పై చేసిన వ్యాఖ్యలు విస్తృతంగా చర్చకు దారితీశాయి',
      category: 'Politics',
      timestamp: 'today 2:10 PM',
      views: '29K వ్యూస్',
      trending: true,
    },
    {
      id: 'kv_tr2',
      title: 'స్వయం సహాయక సంఘాల కోసం ప్రత్యేక ఆర్థిక పథకం',
      summary: 'రాష్ట్ర మహిళా సంఘాలకు తక్కువ వడ్డీతో రుణ సదుపాయాలు కల్పించనున్నారు',
      category: 'Development',
      timestamp: 'today 3:30 PM',
      views: '22K వ్యూస్',
      trending: true,
    },
    {
      id: 'kv_tr3',
      title: 'యువ మహిళా నేతలతో కవిత సమావేశం',
      summary: 'భవిష్యత్ నాయకత్వంపై రాష్ట్రవ్యాప్తంగా యువతితో చర్చలు కొనసాగుతున్నాయి',
      category: 'Leadership',
      timestamp: 'today 5:05 PM',
      views: '18K వ్యూస్',
      trending: true,
    },
  ],

  podcasts: [
    {
      id: 'kv_pod1',
      title: 'మహిళా సాధికారత: కవిత విజన్',
      description: 'రాష్ట్ర మహిళా అభివృద్ధి కోసం అమలు చేయబోయే కొత్త కార్యక్రమాలపై చర్చ',
      duration: '35 నిమిషాలు',
      host: 'సంధ్య',
      category: 'Politics',
      timestamp: 'నేడు ఉదయం 10:00',
    },
    {
      id: 'kv_pod2',
      title: 'గ్రామీణ మహిళల ఉపాధి అవకాశాలు',
      description: 'గ్రామీణ ప్రాంతాల్లో మహిళల కోసం ఉపాధి సృష్టిపై నిపుణుల విశ్లేషణ',
      duration: '28 నిమిషాలు',
      host: 'శిల్పా',
      category: 'Development',
      timestamp: 'నేడు మధ్యాహ్నం 1:30',
    },
    {
      id: 'kv_pod3',
      title: 'యువ మహిళా నాయకత్వం - ప్రత్యేక సంచిక',
      description: 'యువతీ నాయకత్వ అభివృద్ధిపై ప్రత్యేక కార్యక్రమం',
      duration: '32 నిమిషాలు',
      host: 'దీప్తి',
      category: 'Leadership',
      timestamp: 'నేడు సాయంత్రం 6:00',
    },
  ],
};

export default function PublicFigureDashboard() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const c = Colors[colorScheme];
  const isDark = colorScheme === 'dark';

  const [loading, setLoading] = useState(true);
  const [figureId, setFigureId] = useState<keyof typeof VOICE_FILES>('bandisanjay');
  const [figureName, setFigureName] = useState('');
  const [playbackState, setPlaybackState] = useState<'idle' | 'question' | 'listening' | 'response' | 'done'>('done');
  const [activeTab, setActiveTab] = useState<'myNews' | 'trending' | 'podcasts'>('myNews');

  const questionSoundRef = useRef<Audio.Sound | null>(null);
  const responseSoundRef = useRef<Audio.Sound | null>(null);
  const listeningAnim = useRef(new Animated.Value(0)).current;
  const hasPlayedOnceRef = useRef(false);
  const shouldAbortRef = useRef(false);
  const isPlayingRef = useRef(false);

  const primary = useMemo(() => c.tint, [c.tint]);
  const activeSampleNews = useMemo(
    () => (figureId === 'kavitha' ? KAVITHA_SAMPLE_NEWS : SAMPLE_NEWS),
    [figureId]
  );

  // Check role and redirect if not PUBLIC_FIGURE
  useEffect(() => {
    const checkRole = async () => {
      try {
        const tokens = await loadTokens();
        if (!tokens?.jwt) {
          Alert.alert('Access Denied', 'Please login first.');
          router.replace('/auth/login' as any);
          return;
        }

        // Decode JWT to get role and name
        const payload = JSON.parse(atob(tokens.jwt.split('.')[1]));
        const role = payload?.role;
        const name = payload?.name || tokens?.user?.name || '';
        
        if (!isPublicFigure(role)) {
          Alert.alert('Access Denied', 'This dashboard is only for public figures.');
          router.replace('/news' as any);
          return;
        }

        // Detect figure ID from mobile/name.
        // Priority: explicit mobile mapping for known public figures.
        const payloadMobile = String(
          payload?.mobileNumber || payload?.mobile || payload?.phoneNumber || payload?.phone || ''
        ).replace(/\D/g, '');
        const storedMobile = String(
          (await AsyncStorage.getItem('profile_mobile')) ||
          (await AsyncStorage.getItem('last_login_mobile')) ||
          ''
        ).replace(/\D/g, '');

        const effectiveMobile = payloadMobile || storedMobile;
        const fid = effectiveMobile === '9133622005'
          ? 'kavitha'
          : getPublicFigureIdFromName(name);

        setFigureId(fid as keyof typeof VOICE_FILES);
        setFigureName(FIGURE_NAMES[fid as keyof typeof FIGURE_NAMES] || name || 'Public Figure');
        setLoading(false);
      } catch {
        Alert.alert('Error', 'Failed to load profile');
        router.replace('/news' as any);
      }
    };

    checkRole();
  }, [router]);

  // Configure audio mode - don't continue in background
  useEffect(() => {
    const setupAudio = async () => {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
        });
      } catch (error) {
        console.error('[Audio Mode] Setup error:', error);
      }
    };
    setupAudio();
  }, []);

  // Listening animation
  useEffect(() => {
    if (playbackState === 'listening') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(listeningAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
          Animated.timing(listeningAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
        ])
      ).start();
    } else {
      listeningAnim.setValue(0);
    }
  }, [playbackState, listeningAnim]);

  // Play a sound and wait for it to actually finish via status callback
  const playAndWait = useCallback((source: number, soundRef: React.MutableRefObject<Audio.Sound | null>): Promise<void> => {
    return new Promise((resolve) => {
      let resolved = false;
      let capturedSound: Audio.Sound | null = null;

      const finish = () => {
        if (resolved) return;
        resolved = true;
        soundRef.current = null;
        capturedSound?.unloadAsync().catch(() => {});
        resolve();
      };

      Audio.Sound.createAsync(
        source,
        { shouldPlay: true, isLooping: false, volume: 1.0 },
        (status) => {
          if (status.isLoaded && status.didJustFinish) {
            finish();
          }
        }
      ).then(({ sound }) => {
        capturedSound = sound;
        soundRef.current = sound;
        // Safety fallback: wait for duration + 500ms, then resolve anyway (max 60s)
        sound.getStatusAsync().then((st) => {
          const dur = (st.isLoaded && st.durationMillis && st.durationMillis > 0)
            ? st.durationMillis + 500
            : 60000;
          setTimeout(finish, dur);
        });
      }).catch(() => {
        if (!resolved) { resolved = true; resolve(); }
      });
    });
  }, []);

  // Voice sequence function (called manually, not auto)
  const playVoiceSequence = useCallback(async () => {
    if (isPlayingRef.current) {
      console.log('[Voice] Already playing, ignoring...');
      return;
    }
    isPlayingRef.current = true;
    shouldAbortRef.current = false;

    try {
      // Clean up any existing sounds first
      if (questionSoundRef.current) {
        await questionSoundRef.current.unloadAsync().catch(() => {});
        questionSoundRef.current = null;
      }
      if (responseSoundRef.current) {
        await responseSoundRef.current.unloadAsync().catch(() => {});
        responseSoundRef.current = null;
      }

      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: false });

      const voiceFile = VOICE_FILES[figureId as keyof typeof VOICE_FILES];
      if (!voiceFile) {
        console.warn('[Voice] No voice file for figureId:', figureId);
        setPlaybackState('done');
        return;
      }

      // Step 1: Play question voice — wait for actual finish
      if (shouldAbortRef.current) return;
      setPlaybackState('question');
      await playAndWait(voiceFile, questionSoundRef);

      // Step 2: Listening state
      if (shouldAbortRef.current) return;
      setPlaybackState('listening');
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Step 3: Play response — wait for actual finish
      if (shouldAbortRef.current) return;
      setPlaybackState('response');
      await playAndWait(voiceFile, responseSoundRef);

      // Step 4: Done
      if (!shouldAbortRef.current) {
        setPlaybackState('done');
        hasPlayedOnceRef.current = true;
      }
    } catch (error: any) {
      console.error('[Voice Sequence] Error:', error);
      setPlaybackState('done');
    } finally {
      isPlayingRef.current = false;
    }
  }, [figureId, playAndWait]);

  const stopVoicePlayback = useCallback(async () => {
    shouldAbortRef.current = true;
    isPlayingRef.current = false;

    if (questionSoundRef.current) {
      await questionSoundRef.current.stopAsync().catch(() => {});
      await questionSoundRef.current.unloadAsync().catch(() => {});
      questionSoundRef.current = null;
    }

    if (responseSoundRef.current) {
      await responseSoundRef.current.stopAsync().catch(() => {});
      await responseSoundRef.current.unloadAsync().catch(() => {});
      responseSoundRef.current = null;
    }
  }, []);

  // NOTE: Voice only plays on manual button click (Replay button: "మళ్లీ వినండి")

  // Cleanup sounds on unmount
  useEffect(() => {
    return () => {
      questionSoundRef.current?.unloadAsync().catch(console.error);
      responseSoundRef.current?.unloadAsync().catch(console.error);
    };
  }, []);

  const handleReplay = useCallback(async () => {
    try {
      await stopVoicePlayback();
      await new Promise(resolve => setTimeout(resolve, 50));
      await playVoiceSequence();
    } catch (error) {
      console.error('[Replay] Error:', error);
    }
  }, [playVoiceSequence, stopVoicePlayback]);

  const handleLogout = useCallback(async () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          try {
            const { softLogout } = await import('@/services/auth');
            await softLogout();
            router.replace('/news' as any);
          } catch (err) {
            console.error('[Logout] Error:', err);
          }
        },
      },
    ]);
  }, [router]);

  // Reset abort flag when screen gains focus
  useFocusEffect(
    useCallback(() => {
      shouldAbortRef.current = false;
    }, [])
  );

  // Android back button: go to news instead of exiting
  useFocusEffect(
    useCallback(() => {
      const onBack = () => {
        router.replace('/news' as any);
        return true;
      };
      const subscription = BackHandler.addEventListener('hardwareBackPress', onBack);
      return () => subscription.remove();
    }, [router])
  );
  // Stop audio when navigating away
  useFocusEffect(
    React.useCallback(() => {
      return () => {
        // Set abort flag to stop ongoing sequence
        shouldAbortRef.current = true;
        
        // Immediately stop playback state to prevent further audio
        setPlaybackState('done');
        
        // Stop and unload all sounds synchronously (fire and forget)
        if (questionSoundRef.current) {
          questionSoundRef.current.stopAsync().catch(() => {});
          questionSoundRef.current.unloadAsync().catch(() => {});
          questionSoundRef.current = null;
        }
        if (responseSoundRef.current) {
          responseSoundRef.current.stopAsync().catch(() => {});
          responseSoundRef.current.unloadAsync().catch(() => {});
          responseSoundRef.current = null;
        }
      };
    }, [])
  );
  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
        <ActivityIndicator size="large" color={primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]} edges={['top']}>
      <LinearGradient
        colors={isDark ? ['#0a1628', '#1a2744'] : ['#EBF4FF', '#F0F7FF']}
        style={StyleSheet.absoluteFill}
      />

      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.replace('/news' as any)} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={primary} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Image source={require('@/assets/images/app-icon.png')} style={styles.headerLogo} />
          <View>
            <ThemedText style={styles.greeting}>నమస్కారం</ThemedText>
            <ThemedText style={styles.figureName}>{figureName}</ThemedText>
          </View>
        </View>
        <Pressable onPress={handleLogout} style={styles.logoutBtn}>
          <Ionicons name="log-out-outline" size={24} color={primary} />
        </Pressable>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Voice Status Card */}
        <View style={[styles.voiceCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.9)', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
          {playbackState === 'question' && (
            <View style={styles.voiceStatus}>
              <LottieView
                source={require('@/assets/lotti/Artificial Intelligence.json')}
                autoPlay
                loop
                style={styles.voiceLottie}
              />
              <ThemedText style={styles.voiceText}>ప్రశ్న అడుగుతున్నారు...</ThemedText>
            </View>
          )}

          {playbackState === 'listening' && (
            <View style={styles.voiceStatus}>
              <Animated.View style={[styles.listeningPulse, { opacity: listeningAnim, transform: [{ scale: listeningAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.3] }) }] }]}>
                <Ionicons name="mic" size={40} color={primary} />
              </Animated.View>
              <ThemedText style={styles.voiceText}>వింటున్నాను...</ThemedText>
            </View>
          )}

          {playbackState === 'response' && (
            <View style={styles.voiceStatus}>
              <Ionicons name="volume-high" size={48} color={primary} />
              <ThemedText style={styles.voiceText}>సమాధానం చెబుతున్నాను...</ThemedText>
            </View>
          )}

          {playbackState === 'done' && (
            <View style={styles.voiceStatus}>
              <Ionicons name="checkmark-circle" size={48} color="#4CAF50" />
              <ThemedText style={styles.voiceText}>ఈ రోజు వార్తలు సిద్ధంగా ఉన్నాయి</ThemedText>
              <Pressable onPress={handleReplay} style={[styles.replayBtn, { borderColor: primary }]}>
                <Ionicons name="refresh" size={20} color={primary} />
                <Text style={[styles.replayText, { color: primary }]}>మళ్లీ వినండి</Text>
              </Pressable>
            </View>
          )}

          {/* audio error hidden intentionally — audio is optional */}
        </View>

        {/* News Feed */}
        {playbackState === 'done' && (
          <View style={styles.newsSection}>
            {/* Tabs */}
            <View style={styles.tabContainer}>
              <Pressable
                onPress={() => {
                  setActiveTab('myNews');
                  playVoiceSequence();
                }}
                style={[styles.tab, activeTab === 'myNews' && { borderBottomColor: primary, borderBottomWidth: 3 }]}
              >
                <Ionicons name="person" size={20} color={activeTab === 'myNews' ? primary : isDark ? '#999' : '#666'} />
                <Text style={[styles.tabText, { color: activeTab === 'myNews' ? primary : isDark ? '#999' : '#666' }]}>
                  నా వార్తలు
                </Text>
              </Pressable>
              
              <Pressable
                onPress={() => setActiveTab('trending')}
                style={[styles.tab, activeTab === 'trending' && { borderBottomColor: primary, borderBottomWidth: 3 }]}
              >
                <Ionicons name="trending-up" size={20} color={activeTab === 'trending' ? primary : isDark ? '#999' : '#666'} />
                <Text style={[styles.tabText, { color: activeTab === 'trending' ? primary : isDark ? '#999' : '#666' }]}>
                  ట్రెండింగ్
                </Text>
              </Pressable>
              
              <Pressable
                onPress={() => setActiveTab('podcasts')}
                style={[styles.tab, activeTab === 'podcasts' && { borderBottomColor: primary, borderBottomWidth: 3 }]}
              >
                <Ionicons name="mic" size={20} color={activeTab === 'podcasts' ? primary : isDark ? '#999' : '#666'} />
                <Text style={[styles.tabText, { color: activeTab === 'podcasts' ? primary : isDark ? '#999' : '#666' }]}>
                  పాడ్‌కాస్ట్‌లు
                </Text>
              </Pressable>
            </View>

            {/* My News Tab Content */}
            {activeTab === 'myNews' && (
              <View style={styles.tabContent}>
                <ThemedText style={styles.sectionTitle}>మీరు ఉన్న వార్తలు</ThemedText>
                {activeSampleNews.myNews.map((article) => (
                  <Pressable
                    key={article.id}
                    style={[styles.newsCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#fff', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }]}
                    onPress={() => {
                      Alert.alert(article.title, article.summary);
                    }}
                  >
                    <View style={styles.newsHeader}>
                      <Text style={styles.newsEmoji}>{article.image}</Text>
                      <View style={{ flex: 1 }}>
                        <View style={[styles.categoryBadge, { backgroundColor: `${primary}20` }]}>
                          <Text style={[styles.categoryText, { color: primary }]}>{article.category}</Text>
                        </View>
                      </View>
                      <Text style={[styles.timestamp, { color: isDark ? '#999' : '#666' }]}>{article.timestamp}</Text>
                    </View>
                    <ThemedText style={styles.newsTitle}>{article.title}</ThemedText>
                    <ThemedText style={styles.newsSummary}>{article.summary}</ThemedText>
                    <View style={styles.newsFooter}>
                      <Text style={[styles.sourceText, { color: isDark ? '#999' : '#666' }]}>
                        <Ionicons name="newspaper-outline" size={14} /> {article.source}
                      </Text>
                      <Ionicons name="arrow-forward" size={18} color={primary} />
                    </View>
                  </Pressable>
                ))}
              </View>
            )}

            {/* Trending Tab Content */}
            {activeTab === 'trending' && (
              <View style={styles.tabContent}>
                <ThemedText style={styles.sectionTitle}>ట్రెండింగ్ వార్తలు 🔥</ThemedText>
                {activeSampleNews.trending.map((article) => (
                  <Pressable
                    key={article.id}
                    style={[styles.newsCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#fff', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }]}
                    onPress={() => {
                      Alert.alert(article.title, article.summary);
                    }}
                  >
                    <View style={styles.newsHeader}>
                      <View style={[styles.categoryBadge, { backgroundColor: `${primary}20` }]}>
                        <Text style={[styles.categoryText, { color: primary }]}>{article.category}</Text>
                      </View>
                      <Text style={[styles.timestamp, { color: isDark ? '#999' : '#666' }]}>{article.timestamp}</Text>
                    </View>
                    <ThemedText style={styles.newsTitle}>{article.title}</ThemedText>
                    <ThemedText style={styles.newsSummary}>{article.summary}</ThemedText>
                    <View style={styles.newsFooter}>
                      <Text style={[styles.viewsText, { color: '#FF6B6B' }]}>
                        <Ionicons name="eye" size={14} /> {article.views}
                      </Text>
                      <Ionicons name="arrow-forward" size={18} color={primary} />
                    </View>
                  </Pressable>
                ))}
              </View>
            )}

            {/* Podcasts Tab Content */}
            {activeTab === 'podcasts' && (
              <View style={styles.tabContent}>
                <ThemedText style={styles.sectionTitle}>ఈ రోజు పాడ్‌కాస్ట్‌లు 🎙️</ThemedText>
                {activeSampleNews.podcasts.map((podcast) => (
                  <Pressable
                    key={podcast.id}
                    style={[styles.podcastCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#fff', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }]}
                    onPress={() => {
                      Alert.alert(podcast.title, podcast.description);
                    }}
                  >
                    <View style={styles.podcastHeader}>
                      <View style={[styles.podcastIcon, { backgroundColor: `${primary}20` }]}>
                        <Ionicons name="mic" size={28} color={primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <ThemedText style={styles.podcastTitle}>{podcast.title}</ThemedText>
                        <Text style={[styles.podcastHost, { color: isDark ? '#999' : '#666' }]}>
                          <Ionicons name="person-circle-outline" size={14} /> {podcast.host}
                        </Text>
                      </View>
                    </View>
                    <ThemedText style={styles.podcastDescription}>{podcast.description}</ThemedText>
                    <View style={styles.podcastFooter}>
                      <View style={[styles.categoryBadge, { backgroundColor: `${primary}15` }]}>
                        <Text style={[styles.categoryText, { color: primary, fontSize: 11 }]}>{podcast.category}</Text>
                      </View>
                      <Text style={[styles.podcastDuration, { color: isDark ? '#999' : '#666' }]}>
                        <Ionicons name="time-outline" size={14} /> {podcast.duration}
                      </Text>
                      <Text style={[styles.podcastTime, { color: primary }]}>
                        <Ionicons name="calendar-outline" size={14} /> {podcast.timestamp}
                      </Text>
                    </View>
                    <Pressable style={[styles.playBtn, { backgroundColor: primary }]}>
                      <Ionicons name="play" size={16} color="#fff" />
                      <Text style={styles.playBtnText}>ప్లే చేయండి</Text>
                    </Pressable>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  backBtn: {
    padding: 8,
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginLeft: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerLogo: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  greeting: {
    fontSize: 12,
    opacity: 0.7,
  },
  figureName: {
    fontSize: 16,
    fontWeight: '700',
  },
  logoutBtn: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    gap: 20,
  },
  voiceCard: {
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    alignItems: 'center',
    minHeight: 200,
    justifyContent: 'center',
  },
  voiceStatus: {
    alignItems: 'center',
    gap: 16,
  },
  voiceLottie: {
    width: 120,
    height: 120,
  },
  listeningPulse: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(33, 150, 243, 0.1)',
  },
  voiceText: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  replayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 1.5,
    marginTop: 8,
  },
  replayText: {
    fontSize: 15,
    fontWeight: '600',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: 'rgba(244, 67, 54, 0.1)',
    borderRadius: 8,
    marginTop: 12,
  },
  errorText: {
    fontSize: 13,
    color: '#f44336',
  },
  newsSection: {
    gap: 12,
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
  },
  tabContent: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  newsCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    gap: 10,
  },
  newsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  newsEmoji: {
    fontSize: 24,
  },
  categoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  timestamp: {
    fontSize: 12,
  },
  newsTitle: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },
  newsSummary: {
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.8,
  },
  newsFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  sourceText: {
    fontSize: 12,
  },
  viewsText: {
    fontSize: 12,
    fontWeight: '600',
  },
  podcastCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    gap: 12,
  },
  podcastHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  podcastIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  podcastTitle: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },
  podcastHost: {
    fontSize: 13,
    marginTop: 4,
  },
  podcastDescription: {
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.8,
  },
  podcastFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  podcastDuration: {
    fontSize: 12,
  },
  podcastTime: {
    fontSize: 12,
    fontWeight: '600',
  },
  playBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginTop: 4,
  },
  playBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
