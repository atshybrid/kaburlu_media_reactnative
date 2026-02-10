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
import Svg, { Path } from 'react-native-svg';

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
      duration: 200,
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
      // Ensure complete hide by setting scale to 0
      Animated.timing(scaleRef.current, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [shouldShow]);

  const translateY = animatedRef.current.interpolate({
    inputRange: [0, 1],
    outputRange: [measuredHeight, 0],
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

  // Notch dimensions - adjusted for half-circle FAB integration
  const NOTCH_WIDTH = 80;
  const NOTCH_HEIGHT = 32;
  const NOTCH_RADIUS = 40;

  // Generate notched background path - semicircular cutout for FAB
  const generateNotchPath = (width: number) => {
    const centerX = width / 2;
    const radius = 32; // Half of FAB width (56/2 = 28) + some padding
    const notchDepth = 4; // How deep the notch goes into the bar
    
    return `
      M 0 0
      L ${centerX - radius} 0
      Q ${centerX - radius} ${notchDepth} ${centerX - radius * 0.7} ${notchDepth}
      A ${radius} ${radius} 0 0 0 ${centerX + radius * 0.7} ${notchDepth}
      Q ${centerX + radius} ${notchDepth} ${centerX + radius} 0
      L ${width} 0
      L ${width} 100
      L 0 100
      Z
    `;
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY }],
        },
      ]}
      onLayout={(e) => setMeasuredHeight(e.nativeEvent.layout.height)}
      pointerEvents={shouldShow ? 'auto' : 'none'}
      accessibilityElementsHidden={!shouldShow}
      importantForAccessibility={shouldShow ? 'yes' : 'no-hide-descendants'}
    >
      <Animated.View style={[styles.shadowWrap, { transform: [{ scale: scaleRef.current }] }]}>
        {/* Notched background SVG */}
        {containerWidth > 0 && (
          <View style={styles.notchSvgContainer}>
            <Svg width={containerWidth} height={100} style={{ position: 'absolute', top: 0 }}>
              <Path
                d={generateNotchPath(containerWidth)}
                fill={theme.card}
              />
            </Svg>
          </View>
        )}
        
        {/* Center FAB - positioned in the notch, only show when tab bar is visible */}
        {shouldShow && (
          <Animated.View
            style={[
              styles.centerFabWrap,
              {
                transform: [{ scale: fabScale.current }],
              },
            ]}
          >
            <Pressable
              onPress={goToKaChat}
              accessibilityRole="button"
              accessibilityLabel="Ka Chat"
              style={({ pressed }) => [
                styles.centerFab,
                { 
                  backgroundColor: onKaChat ? theme.tint : theme.secondary,
                  borderColor: colorScheme === 'dark' ? theme.card : '#fff',
                },
                pressed && styles.fabPressed,
              ]}
              android_ripple={{ color: 'rgba(255,255,255,0.2)', borderless: true }}
            >
              <View style={styles.fabInner}>
                {LanguageIcon ? (
                  <LanguageIcon width={26} height={26} fill="#ffffff" />
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

        <View
          style={[
            styles.inner,
            {
              backgroundColor: 'transparent',
              paddingBottom: Math.max(insets.bottom, 4),
            },
          ]}
          onLayout={onContainerLayout}
        >
          <View style={styles.tabRow}>
            {/* Left tabs: news, donations */}
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

            {/* Center spacer for the notch - Ka Chat label below the FAB */}
            <View style={styles.centerTabItem}>
              <View style={{ height: 28 }} />
              <Text
                style={[
                  styles.tabLabel,
                  { color: onKaChat ? theme.tint : theme.tabIconDefault },
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
                // Special case: "Post" tab - route based on role
                if (route.name === 'explore') {
                  const role = profileRole || (await getCachedProfileRole());
                  if (canAccessPostNewsByRole(role)) {
                    // Tenant editorial roles go to post-news
                    try {
                      router.push('/post-news' as any);
                      return;
                    } catch {}
                  } else {
                    // Citizen reporters and others go to explore (old flow)
                    if (!isFocused) {
                      props.navigation.navigate('explore' as never);
                    }
                    return;
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
    elevation: 8,
    borderRadius: 0,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: -4 },
    shadowRadius: 12,
  },
  notchSvgContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: 0,
  },
  inner: {
    borderRadius: 0,
    overflow: 'visible',
    minHeight: 64,
    paddingHorizontal: 2,
    zIndex: 1,
  },
  tabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingHorizontal: 2,
    paddingBottom: 4,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 2,
  },
  centerTabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 2,
    marginTop: 4,
  },
  tabIconWrap: {
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 3,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  centerFabWrap: {
    position: 'absolute',
    alignSelf: 'center',
    top: -20,
    zIndex: 10,
  },
  centerFab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.light.secondary,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    overflow: 'hidden',
    borderWidth: 4,
    borderColor: '#fff',
  },
  fabPressed: { opacity: 0.9, transform: [{ scale: 0.95 }] },
  fabInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabKa: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 18,
  },
  fabChat: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
    lineHeight: 11,
    marginTop: -1,
    opacity: 0.95,
  },
});