/**
 * Tenant E-Paper - Shows digital newspapers for current tenant with date selector
 * Features: Date selection, cover view, full page viewer with swipe, download options
 */

import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { getTenantEpaper, EpaperEdition, EpaperPage } from '@/services/api';
import { loadTokens } from '@/services/auth';
import { Ionicons } from '@expo/vector-icons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback, useState, useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Image,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  PanResponder,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  Share,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Zoomable Image Component
function ZoomableImage({ uri }: { uri: string }) {
  const scale = useRef(new Animated.Value(1)).current;
  const lastScale = useRef(1);
  const [loading, setLoading] = useState(true);

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gestureState) => gestureState.numberActiveTouches > 1,
    onPanResponderMove: (_, gestureState) => {
      if (gestureState.numberActiveTouches === 2) {
        const newScale = Math.max(1, Math.min(4, lastScale.current * (1 + gestureState.dy / 500)));
        scale.setValue(newScale);
      }
    },
    onPanResponderRelease: () => {
      lastScale.current = (scale as any)._value || 1;
      if (lastScale.current < 1.1) {
        Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();
        lastScale.current = 1;
      }
    },
  });

  return (
    <View style={styles.zoomContainer} {...panResponder.panHandlers}>
      {loading && (
        <View style={styles.imageLoader}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      )}
      <Animated.Image
        source={{ uri }}
        style={[styles.pageImage, { transform: [{ scale }] }]}
        resizeMode="contain"
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
      />
    </View>
  );
}

// Full Page Viewer Modal
function PageViewerModal({
  visible,
  pages,
  initialPage,
  onClose,
  editionName,
}: {
  visible: boolean;
  pages: EpaperPage[];
  initialPage: number;
  onClose: () => void;
  editionName: string;
}) {
  const [currentPage, setCurrentPage] = useState(initialPage);
  const flatListRef = useRef<FlatList>(null);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const page = Math.round(offsetX / SCREEN_WIDTH);
    setCurrentPage(page);
  };

  const downloadImage = async (page: EpaperPage) => {
    try {
      Alert.alert(
        'డౌన్‌లోడ్ చేయండి',
        'ఈ చిత్రాన్ని మీ డివైస్‌లో సేవ్ చేయాలా?',
        [
          { text: 'రద్దు చేయండి', style: 'cancel' },
          {
            text: 'డౌన్‌లోడ్',
            onPress: () => {
              Linking.openURL(page.imageUrlJpeg);
              Alert.alert('విజయం!', 'బ్రౌజర్‌లో తెరుచుకుంటుంది. డౌన్‌లోడ్ చేయడానికి లాంగ్ ప్రెస్ చేయండి');
            },
          },
        ]
      );
    } catch (error) {
      console.error('Download failed:', error);
      Alert.alert('లోపం', 'డౌన్‌లోడ్ విఫలమైంది');
    }
  };

  const shareImage = async (page: EpaperPage) => {
    try {
      await Share.share({
        message: `పేజీ ${page.pageNumber}`,
        url: page.imageUrlJpeg,
      });
    } catch (error) {
      console.error('Share failed:', error);
    }
  };

  const renderPage = ({ item, index }: { item: EpaperPage; index: number }) => (
    <View style={{ width: SCREEN_WIDTH }}>
      <ZoomableImage uri={item.imageUrlWebp} />
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[styles.modalContainer, { backgroundColor: '#000' }]}>
        {/* Header */}
        <View style={styles.modalHeader}>
          <Pressable onPress={onClose} style={styles.modalCloseBtn}>
            <Ionicons name="close" size={28} color="#fff" />
          </Pressable>
          <View style={styles.modalHeaderCenter}>
            <Text style={styles.modalTitle}>{editionName}</Text>
            <Text style={styles.modalPageInfo}>
              పేజీ {currentPage + 1} / {pages.length}
            </Text>
          </View>
          <View style={styles.modalActions}>
            <Pressable
              onPress={() => shareImage(pages[currentPage])}
              style={styles.modalActionBtn}
            >
              <Ionicons name="share-outline" size={24} color="#fff" />
            </Pressable>
            <Pressable
              onPress={() => downloadImage(pages[currentPage])}
              style={styles.modalActionBtn}
            >
              <Ionicons name="download-outline" size={24} color="#fff" />
            </Pressable>
          </View>
        </View>

        {/* Page Viewer */}
        <FlatList
          ref={flatListRef}
          data={pages}
          keyExtractor={(item) => item.id}
          renderItem={renderPage}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          initialScrollIndex={initialPage}
          getItemLayout={(_, index) => ({
            length: SCREEN_WIDTH,
            offset: SCREEN_WIDTH * index,
            index,
          })}
        />

        {/* Page Navigation */}
        <View style={styles.pageNavigation}>
          <Pressable
            onPress={() => {
              if (currentPage > 0) {
                flatListRef.current?.scrollToIndex({ index: currentPage - 1 });
              }
            }}
            disabled={currentPage === 0}
            style={[styles.navBtn, currentPage === 0 && { opacity: 0.3 }]}
          >
            <Ionicons name="chevron-back" size={28} color="#fff" />
          </Pressable>
          <Pressable
            onPress={() => {
              if (currentPage < pages.length - 1) {
                flatListRef.current?.scrollToIndex({ index: currentPage + 1 });
              }
            }}
            disabled={currentPage === pages.length - 1}
            style={[styles.navBtn, currentPage === pages.length - 1 && { opacity: 0.3 }]}
          >
            <Ionicons name="chevron-forward" size={28} color="#fff" />
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

export default function TenantEpaperScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const router = useRouter();

  const [editions, setEditions] = useState<EpaperEdition[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [selectedEdition, setSelectedEdition] = useState<EpaperEdition | null>(null);
  const [tenantDomain, setTenantDomain] = useState<string>('');

  const fetchEpaper = useCallback(async (dateToLoad = selectedDate) => {
    try {
      // Get tenant domain from session storage if not already set
      let domain = tenantDomain;
      if (!domain) {
        try {
          const tokens = await loadTokens();
          console.log('[EPAPER] Session Data:', JSON.stringify(tokens?.session, null, 2));
          if (tokens?.session?.domain?.domain) {
            // Extract domain from session storage (saved during login)
            const baseDomain = tokens.session.domain.domain;
            console.log('[EPAPER] Base Domain from Session:', baseDomain);
            // Construct epaper subdomain: epaper.{domain}
            domain = `epaper.${baseDomain}`;
            console.log('[EPAPER] Constructed Epaper Domain:', domain);
            setTenantDomain(domain);
          } else {
            console.warn('[EPAPER] No domain found in session storage!');
            console.warn('[EPAPER] Available session keys:', tokens?.session ? Object.keys(tokens.session) : 'No session');
          }
        } catch (err) {
          console.error('Failed to get tenant domain:', err);
        }
      } else {
        console.log('[EPAPER] Using cached tenant domain:', domain);
      }

      const dateStr = dateToLoad.toISOString().split('T')[0]; // YYYY-MM-DD
      const response = await getTenantEpaper(dateStr, domain);

      if (response && response.editions) {
        setEditions(response.editions);
      } else {
        setEditions([]);
      }
    } catch (e) {
      console.error('Failed to fetch epaper:', e);
      Alert.alert('లోపం', 'ఈ-పేపర్ లోడ్ చేయడంలో విఫలమైంది');
      setEditions([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedDate, tenantDomain]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchEpaper();
    }, [fetchEpaper])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchEpaper();
  }, [fetchEpaper]);

  const handleDateChange = (event: any, date?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (date) {
      setSelectedDate(date);
      setLoading(true);
      fetchEpaper(date);
    }
  };

  const goToPreviousDay = () => {
    const prevDay = new Date(selectedDate);
    prevDay.setDate(prevDay.getDate() - 1);
    setSelectedDate(prevDay);
    setLoading(true);
    fetchEpaper(prevDay);
  };

  const goToNextDay = () => {
    const nextDay = new Date(selectedDate);
    nextDay.setDate(nextDay.getDate() + 1);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (nextDay <= today) {
      setSelectedDate(nextDay);
      setLoading(true);
      fetchEpaper(nextDay);
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('te-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const openEdition = (edition: EpaperEdition) => {
    setSelectedEdition(edition);
    setViewerVisible(true);
  };

  const downloadPDF = async (edition: EpaperEdition) => {
    try {
      Alert.alert(
        'PDF డౌన్‌లోడ్',
        'PDF ఫైల్‌ను తెరవాలా?',
        [
          { text: 'రద్దు చేయండి', style: 'cancel' },
          {
            text: 'తెరువు',
            onPress: () => {
              Linking.openURL(edition.issue.pdfUrl);
            },
          },
        ]
      );
    } catch (error) {
      console.error('PDF open failed:', error);
      Alert.alert('లోపం', 'PDF తెరవడంలో విఫలమైంది');
    }
  };

  const renderEdition = ({ item }: { item: EpaperEdition }) => (
    <View style={[styles.editionCard, { backgroundColor: theme.card ?? theme.background }]}>
      {/* Cover Image */}
      <Pressable onPress={() => openEdition(item)} style={styles.coverContainer}>
        <Image
          source={{ uri: item.coverImageUrlWebp }}
          style={styles.coverImage}
          resizeMode="cover"
        />
        <View style={styles.pageBadge}>
          <Ionicons name="layers-outline" size={12} color="#fff" />
          <Text style={styles.pageBadgeText}>{item.issue.pageCount} పేజీలు</Text>
        </View>
      </Pressable>

      {/* Edition Info */}
      <View style={styles.editionInfo}>
        <View style={styles.editionHeader}>
          <Ionicons name="newspaper" size={20} color={theme.tint} />
          <Text style={[styles.editionName, { color: theme.text }]} numberOfLines={1}>
            {item.name}
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <Pressable
            onPress={() => openEdition(item)}
            style={[styles.actionBtn, { backgroundColor: theme.tint }]}
          >
            <Ionicons name="book-outline" size={18} color="#fff" />
            <Text style={styles.actionBtnText}>చదవండి</Text>
          </Pressable>

          <Pressable
            onPress={() => downloadPDF(item)}
            style={[styles.actionBtn, { backgroundColor: '#10B981' }]}
          >
            <Ionicons name="download-outline" size={18} color="#fff" />
            <Text style={styles.actionBtnText}>PDF</Text>
          </Pressable>

          <Pressable
            onPress={() => Linking.openURL(item.issue.pdfUrl)}
            style={[styles.actionBtn, { backgroundColor: '#6366F1' }]}
          >
            <Ionicons name="open-outline" size={18} color="#fff" />
            <Text style={styles.actionBtnText}>తెరువు</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <MaterialIcons name="arrow-back" size={24} color={theme.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: theme.text }]}>ఈ-పేపర్</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.tint} />
          <Text style={[styles.loadingText, { color: theme.text }]}>లోడ్ అవుతోంది...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color={theme.text} />
        </Pressable>
        <View style={styles.headerContent}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>ఈ-పేపర్</Text>
          <Text style={[styles.headerSubtitle, { color: theme.muted ?? theme.tabIconDefault }]}>
            {editions.length} ఎడిషన్{editions.length > 1 ? 'లు' : ''}
          </Text>
        </View>
      </View>

      {/* Date Selector */}
      <View style={[styles.dateSelector, { backgroundColor: theme.card ?? theme.background }]}>
        <Pressable onPress={goToPreviousDay} style={styles.dateNavBtn}>
          <Ionicons name="chevron-back" size={24} color={theme.tint} />
        </Pressable>

        <Pressable
          onPress={() => setShowDatePicker(true)}
          style={[styles.dateButton, { borderColor: theme.tint }]}
        >
          <Ionicons name="calendar-outline" size={20} color={theme.tint} />
          <Text style={[styles.dateText, { color: theme.text }]}>{formatDate(selectedDate)}</Text>
        </Pressable>

        <Pressable
          onPress={goToNextDay}
          disabled={selectedDate.toDateString() === new Date().toDateString()}
          style={[
            styles.dateNavBtn,
            selectedDate.toDateString() === new Date().toDateString() && { opacity: 0.3 },
          ]}
        >
          <Ionicons name="chevron-forward" size={24} color={theme.tint} />
        </Pressable>
      </View>

      {showDatePicker && (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleDateChange}
          maximumDate={new Date()}
        />
      )}

      {/* Editions List */}
      <FlatList
        data={editions}
        keyExtractor={(item) => item.id}
        renderItem={renderEdition}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.tint]}
            tintColor={theme.tint}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialIcons name="library-books" size={80} color={theme.muted ?? theme.tabIconDefault} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>ఈ-పేపర్ అందుబాటులో లేదు</Text>
            <Text style={[styles.emptySubtitle, { color: theme.muted ?? theme.tabIconDefault }]}>
              ఈ తేదీకి ఎటువంటి ఎడిషన్లు ప్రచురించబడలేదు
            </Text>
            <Pressable
              onPress={() => {
                setSelectedDate(new Date());
                setLoading(true);
                fetchEpaper(new Date());
              }}
              style={[styles.todayBtn, { backgroundColor: theme.tint }]}
            >
              <Ionicons name="today-outline" size={20} color="#fff" />
              <Text style={styles.todayBtnText}>నేటి ఎడిషన్</Text>
            </Pressable>
          </View>
        }
      />

      {/* Page Viewer Modal */}
      {selectedEdition && (
        <PageViewerModal
          visible={viewerVisible}
          pages={selectedEdition.issue.pages}
          initialPage={0}
          onClose={() => setViewerVisible(false)}
          editionName={selectedEdition.name}
        />
      )}
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  backBtn: {
    padding: 8,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  dateNavBtn: {
    padding: 8,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  dateText: {
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
  },
  listContent: {
    padding: 16,
    gap: 16,
  },
  editionCard: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  coverContainer: {
    position: 'relative',
    aspectRatio: 0.71, // Newspaper aspect ratio
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  pageBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  pageBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  editionInfo: {
    padding: 16,
    gap: 12,
  },
  editionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editionName: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 8,
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 64,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
  todayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 16,
  },
  todayBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  modalCloseBtn: {
    padding: 8,
  },
  modalHeaderCenter: {
    flex: 1,
    paddingHorizontal: 12,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  modalPageInfo: {
    color: '#fff',
    fontSize: 13,
    marginTop: 2,
    opacity: 0.8,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalActionBtn: {
    padding: 8,
  },
  zoomContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  pageImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT - 100,
  },
  imageLoader: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -25,
    marginTop: -25,
  },
  pageNavigation: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  navBtn: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
