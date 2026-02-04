// Digital Daily - Newspaper list with horizontal swipe
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { DigitalPaper, getDigitalPapers } from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH * 0.75;
const CARD_HEIGHT = CARD_WIDTH * 1.4; // Newspaper aspect ratio

export default function DigitalDailyScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const router = useRouter();

  const [papers, setPapers] = useState<DigitalPaper[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPapers = useCallback(async () => {
    try {
      const response = await getDigitalPapers(50);
      setPapers(response.papers);
    } catch (e) {
      console.error('Failed to fetch digital papers:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchPapers();
  }, [fetchPapers]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPapers();
  }, [fetchPapers]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const openPaper = (paper: DigitalPaper) => {
    router.push({
      pathname: '/digital-daily/[id]',
      params: {
        id: paper.id,
        paperData: JSON.stringify(paper),
      },
    } as any);
  };

  const renderPaperCard = ({ item, index }: { item: DigitalPaper; index: number }) => (
    <Pressable
      style={[
        styles.card,
        {
          backgroundColor: theme.card ?? theme.background,
          shadowColor: theme.text,
        },
      ]}
      onPress={() => openPaper(item)}
      accessibilityRole="button"
      accessibilityLabel={`Open ${item.tenant.nativeName || item.tenant.name}`}
    >
      {/* Cover Image */}
      <View style={styles.coverContainer}>
        <Image
          source={{ uri: item.coverImageUrl }}
          style={styles.coverImage}
          resizeMode="cover"
        />
        {/* Page count badge */}
        <View style={styles.pageBadge}>
          <Ionicons name="layers-outline" size={12} color="#fff" />
          <Text style={styles.pageBadgeText}>{item.pageCount} pages</Text>
        </View>
      </View>

      {/* Paper Info */}
      <View style={styles.infoContainer}>
        <View style={styles.tenantRow}>
          <Image
            source={{ uri: item.tenant.logoUrl }}
            style={styles.tenantLogo}
            resizeMode="contain"
          />
          <View style={styles.tenantInfo}>
            <Text style={[styles.tenantName, { color: theme.text }]} numberOfLines={1}>
              {item.tenant.nativeName || item.tenant.name}
            </Text>
            <Text style={[styles.editionName, { color: theme.muted ?? theme.tabIconDefault }]} numberOfLines={1}>
              {item.edition.name}
            </Text>
          </View>
        </View>
        <Text style={[styles.dateText, { color: theme.muted ?? theme.tabIconDefault }]}>
          {formatDate(item.issueDate)}
        </Text>
      </View>
    </Pressable>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.tint} />
          <Text style={[styles.loadingText, { color: theme.text }]}>Loading newspapers...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Digital Daily</Text>
        <Text style={[styles.headerSubtitle, { color: theme.muted ?? theme.tabIconDefault }]}>
          Today&apos;s newspapers from across publishers
        </Text>
      </View>

      {/* Horizontal swipe list of papers */}
      <FlatList
        data={papers}
        keyExtractor={(item) => item.id}
        renderItem={renderPaperCard}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        snapToInterval={CARD_WIDTH + 16}
        decelerationRate="fast"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.tint} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="newspaper-outline" size={64} color={theme.tabIconDefault} />
            <Text style={[styles.emptyText, { color: theme.text }]}>No newspapers available today</Text>
            <Text style={[styles.emptySubtext, { color: theme.muted ?? theme.tabIconDefault }]}>
              Pull down to refresh
            </Text>
          </View>
        }
      />

      {/* Bottom hint */}
      {papers.length > 0 && (
        <View style={styles.hintContainer}>
          <Ionicons name="hand-left-outline" size={16} color={theme.tabIconDefault} />
          <Text style={[styles.hintText, { color: theme.muted ?? theme.tabIconDefault }]}>
            Swipe to browse • Tap to read
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 16,
  },
  card: {
    width: CARD_WIDTH,
    borderRadius: 16,
    overflow: 'hidden',
    marginRight: 16,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  coverContainer: {
    width: '100%',
    height: CARD_HEIGHT,
    backgroundColor: '#f0f0f0',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  pageBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pageBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  infoContainer: {
    padding: 14,
  },
  tenantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  tenantLogo: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
  },
  tenantInfo: {
    flex: 1,
  },
  tenantName: {
    fontSize: 15,
    fontWeight: '600',
  },
  editionName: {
    fontSize: 12,
    marginTop: 2,
  },
  dateText: {
    fontSize: 12,
    marginTop: 8,
  },
  emptyContainer: {
    width: SCREEN_WIDTH - 40,
    height: CARD_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 13,
  },
  hintContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingBottom: 100, // Space for tab bar
    paddingTop: 8,
  },
  hintText: {
    fontSize: 13,
  },
});
