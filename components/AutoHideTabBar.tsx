import { Colors } from '@/constants/Colors';
import { useTabBarVisibility } from '@/context/TabBarVisibilityContext';
import { useColorScheme } from '@/hooks/useColorScheme';
// Center FAB shows language icon if available, otherwise branded text (Ka / chat)
import { getLanguageIcon } from '@/icons/languageIcons';
// Ka Chat FAB navigation, no post auth needed
import AsyncStorage from '@react-native-async-storage/async-storage';
// no AsyncStorage needed for FAB content now
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { usePathname, useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { canAccessPostNewsByRole, getCachedProfileRole } from '@/services/roles';

export default function AutoHideTabBar(props: BottomTabBarProps) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const router = useRouter();
  const { isTabBarVisible } = useTabBarVisibility();
  const insets = useSafeAreaInsets();
  const [measuredHeight, setMeasuredHeight] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const animatedRef = useRef(new Animated.Value(isTabBarVisible ? 1 : 0));
  const scaleRef = useRef(new Animated.Value(0.98));
  const fabScale = useRef(new Animated.Value(1));
  const [langCode, setLangCode] = useState<string>('');
  const LanguageIcon = getLanguageIcon(langCode);
  const [profileRole, setProfileRole] = useState<string>('');

  const routes = props.state.routes;
  const activeIndex = props.state.index;
  const activeRouteName = routes[activeIndex]?.name;
  const pathname = usePathname();
  // Hide the tab bar on full-screen flows like Post Article (explore), Ka Chat, or Account (tech)
  const onExplore = typeof pathname === 'string' && /(^|\/)explore$/.test(pathname);
  const onKaChat = typeof pathname === 'string' && /(^|\/)kachat$/.test(pathname);
  const hiddenOnRoute = onExplore || onKaChat || activeRouteName === 'tech';
  const shouldShow = isTabBarVisible && !hiddenOnRoute;

  React.useEffect(() => {
    Animated.timing(animatedRef.current, {
      toValue: shouldShow ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
    if (shouldShow) {
      Animated.spring(scaleRef.current, {
        toValue: 1,
        friction: 8,
        tension: 80,
        useNativeDriver: true,
      }).start();
    } else {
      scaleRef.current.setValue(0.98);
    }
  }, [shouldShow]);

  const translateY = animatedRef.current.interpolate({
    inputRange: [0, 1],
    outputRange: [measuredHeight + Math.max(insets.bottom, 0), 0],
  });

  // Solid background comes from theme.card

  // Active indicator (removed) positioning placeholder
  const tabCount = routes.length || 1;
  const tabWidth = containerWidth > 0 ? containerWidth / tabCount : 0;
  const pillWidth = 38;
  const pillLeft = Math.max(0, activeIndex * tabWidth + (tabWidth - pillWidth) / 2);

  React.useEffect(() => {
    // scale FAB when Post Article (explore) or Ka Chat is focused
    const focused = onExplore || onKaChat;
    Animated.spring(fabScale.current, {
      toValue: focused ? 1.06 : 1,
      useNativeDriver: true,
      bounciness: 8,
      speed: 10,
    }).start();
  }, [pillLeft, onExplore, onKaChat]);

  // Load selected language for optional center FAB icon
  React.useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem('selectedLanguage');
        const code = stored ? JSON.parse(stored)?.code ?? '' : '';
        setLangCode(code || '');
      } catch {}
    })();
  }, []);

  // Load role for role-gated Post behavior
  React.useEffect(() => {
    (async () => {
      const r = await getCachedProfileRole();
      if (r) setProfileRole(r);
    })();
  }, []);

  const onContainerLayout = (e: any) => setContainerWidth(e.nativeEvent.layout.width);
  const goToKaChat = () => {
    try {
      // use object form to satisfy expo-router types
      router.push({ pathname: '/kachat' as any });
    } catch (e) {
      console.warn('[FAB] navigate to Ka Chat failed:', e);
    }
  };

  // Debounce map for tab presses
  // removed debounce map (was used for career sheet)

  return (
    <Animated.View
      style={[
        styles.container,
        {
          paddingBottom: Math.max(insets.bottom, 8),
          transform: [{ translateY }],
        },
      ]}
      onLayout={(e) => setMeasuredHeight(e.nativeEvent.layout.height)}
  pointerEvents={shouldShow ? 'auto' : 'none'}
  accessibilityElementsHidden={!shouldShow}
  importantForAccessibility={shouldShow ? 'yes' : 'no-hide-descendants'}
    >
      <Animated.View style={[styles.shadowWrap, { transform: [{ scale: scaleRef.current }] }]}>
        <View
          style={[
            styles.inner,
            {
              backgroundColor: theme.card,
              borderTopColor: theme.border,
              borderTopWidth: StyleSheet.hairlineWidth,
            },
          ]}
          onLayout={onContainerLayout}
        >
          <View style={styles.tabRow}>
            {/* Determine only the visible tab routes and enforce order [news, donations] [center] [career, tech] */}
            {(['news', 'donations'] as const).map((name) => {
              const route = routes.find((r) => r.name === name);
              if (!route) return <View key={`missing-${name}`} style={styles.tabItem} />;
              const isFocused = activeRouteName === route.name;
              const { options } = props.descriptors[route.key];
              const label = (options.tabBarLabel as string) || options.title || route.name;
              const color = isFocused ? (colorScheme === 'dark' ? '#fff' : theme.tint) : theme.tabIconDefault;
              const size = 24;
              const icon =
                typeof options.tabBarIcon === 'function'
                  ? options.tabBarIcon({ focused: isFocused, color, size })
                  : null;
              return (
                <Pressable
                  key={route.key}
                  style={({ pressed }) => [styles.tabItem, pressed && { opacity: 0.7 }]}
                  accessibilityRole="button"
                  accessibilityState={isFocused ? { selected: true } : {}}
                  accessibilityLabel={label}
                  onPress={() => {
                    if (!isFocused) {
                      // @ts-ignore expo-router compatible
                      props.navigation.navigate(route.name as never);
                    }
                  }}
                >
                  <View style={styles.tabIconWrap}>{icon}</View>
                  <Text style={[styles.tabLabel, { color }]} numberOfLines={1}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}

            {/* Center slot placeholder - shows the Ka Chat label to align like a tab */}
            <View style={styles.tabItem} pointerEvents="none">
              <View style={{ height: 24 }} />
              <Text
                style={[
                  styles.tabLabel,
                  { color: onExplore ? theme.tint : theme.tabIconDefault },
                ]}
                numberOfLines={1}
              >
                Ka Chat
              </Text>
            </View>

            {/* Right two tabs: Post (explore) and Account (tech) */}
            {(['explore', 'tech'] as const).map((name) => {
              const route = routes.find((r) => r.name === name);
              if (!route) return <View key={`missing-${name}`} style={styles.tabItem} />;
              const isFocused = activeRouteName === route.name;
              const { options } = props.descriptors[route.key];
              const label = (options.tabBarLabel as string) || options.title || route.name;
              const color = isFocused ? (colorScheme === 'dark' ? '#fff' : theme.tint) : theme.tabIconDefault;
              const size = 24;
              const icon =
                typeof options.tabBarIcon === 'function'
                  ? options.tabBarIcon({ focused: isFocused, color, size })
                  : null;
              const onPress = async () => {
                // Special case: "Post" tab should go to Post News for tenant editorial roles.
                if (route.name === 'explore') {
                  const role = profileRole || (await getCachedProfileRole());
                  if (canAccessPostNewsByRole(role)) {
                    try {
                      router.push('/post-news' as any);
                      return;
                    } catch {}
                  }
                }
                if (!isFocused) {
                  // @ts-ignore expo-router compatible
                  props.navigation.navigate(route.name as never);
                }
              };
              return (
                <Pressable
                  key={route.key}
                  style={({ pressed }) => [styles.tabItem, pressed && { opacity: 0.7 }]}
                  accessibilityRole="button"
                  accessibilityState={isFocused ? { selected: true } : {}}
                  accessibilityLabel={label}
                  onPress={() => { void onPress(); }}
                >
                  <View style={styles.tabIconWrap}>{icon}</View>
                  <Text style={[styles.tabLabel, { color }]} numberOfLines={1}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        {/* Floating center FAB (clickable). Only show when tab bar is visible */}
        {shouldShow && (
          <Animated.View
            style={[
              styles.fabWrap,
              {
                // Place FAB so the label visually aligns with other tab labels
                bottom: Math.max(insets.bottom, 8) + 14,
                transform: [{ scale: fabScale.current }],
              },
            ]}
          >
            <Pressable
              onPress={goToKaChat}
              accessibilityRole="button"
              accessibilityLabel="Ka Chat"
              style={({ pressed }) => [styles.fab, { backgroundColor: theme.secondary }, pressed && styles.fabPressed]}
              android_ripple={{ color: 'rgba(0,0,0,0.08)', borderless: true }}
            >
              <View style={styles.fabInner}>
                {LanguageIcon ? (
                  <LanguageIcon width={28} height={28} fill="#ffffff" />
                ) : (
                  <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={styles.fabKa}>Ka</Text>
                    <Text style={styles.fabChat}>chat</Text>
                  </View>
                )}
              </View>
            </Pressable>
          </Animated.View>
        )}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  shadowWrap: {
    elevation: 0,
    borderRadius: 0,
  },
  inner: {
    borderRadius: 0,
    overflow: 'hidden',
    minHeight: 62,
    // backgroundColor moved to themed inline style
    paddingHorizontal: 0, // remove left/right padding to maximize usable width
  },
  tabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 6,
    paddingHorizontal: 0,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  tabIconWrap: {
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  fabWrap: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: 52, // lift to avoid overlapping center label
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    // backgroundColor themed at render time
    backgroundColor: Colors.light.secondary,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 10,
    overflow: 'hidden',
  },
  fabPressed: { opacity: 0.92 },
  fabInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabKa: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 20,
  },
  fabChat: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 12,
    marginTop: -2,
    opacity: 0.95,
  },
  fabLabel: {
    marginTop: 8,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '600',
    color: Colors.light.text,
  },
  fabDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#fff',
    opacity: 0.9,
  },
});