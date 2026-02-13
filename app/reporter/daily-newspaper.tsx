/**
 * Daily Newspaper - Reporter View
 * Shows today's published articles by this reporter in newspaper style
 */

import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@/constants/Colors';
import { getNewspaperArticles, NewspaperArticle } from '@/services/tenantAdmin';
import { loadTokens } from '@/services/auth';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StatusBar,
  StyleSheet,
  View,
  useColorScheme as useRNColorScheme,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';

export default function ReporterDailyNewspaperScreen() {
  const scheme = useRNColorScheme() ?? 'light';
  const c = Colors[scheme];
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [articles, setArticles] = useState<NewspaperArticle[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  const loadArticles = useCallback(async (isRefresh = false, dateToLoad = selectedDate) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      // Get reporter ID from tokens
      const tokens = await loadTokens();
      const userId = (tokens as any)?.session?.user?.id;

      // Get selected date range
      const dayStart = new Date(dateToLoad);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const response = await getNewspaperArticles({
        limit: 50,
        authorId: userId, // Filter by current reporter
      });

      // Filter for selected date's articles
      const dateArticles = (response.items || []).filter((article) => {
        const articleDate = new Date(article.createdAt);
        return articleDate >= dayStart && articleDate < dayEnd;
      });

      setArticles(dateArticles);
      setTotalCount(dateArticles.length);
    } catch (error) {
      console.error('Failed to load newspaper articles:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedDate]);

  useFocusEffect(
    useCallback(() => {
      loadArticles();
    }, [loadArticles])
  );

  const handleDateChange = (event: any, date?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (date) {
      setSelectedDate(date);
      loadArticles(false, date);
    }
  };

  const goToPreviousDay = () => {
    const prevDay = new Date(selectedDate);
    prevDay.setDate(prevDay.getDate() - 1);
    setSelectedDate(prevDay);
    loadArticles(false, prevDay);
  };

  const goToNextDay = () => {
    const nextDay = new Date(selectedDate);
    nextDay.setDate(nextDay.getDate() + 1);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (nextDay <= today) {
      setSelectedDate(nextDay);
      loadArticles(false, nextDay);
    }
  };

  const goToToday = () => {
    const today = new Date();
    setSelectedDate(today);
    loadArticles(false, today);
  };

  const isToday = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selected = new Date(selectedDate);
    selected.setHours(0, 0, 0, 0);
    return selected.getTime() === today.getTime();
  };

  const getPriorityBadge = (priority: number) => {
    if (priority === 1) return { label: 'TOP', color: '#EF4444', icon: 'whatshot' };
    if (priority === 2) return { label: 'FEATURED', color: '#F59E0B', icon: 'star' };
    if (priority === 3) return { label: 'PRIORITY', color: '#3B82F6', icon: 'flag' };
    return null;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PUBLISHED': return '#10B981';
      case 'PENDING': return '#F59E0B';
      case 'DRAFT': return '#6B7280';
      case 'REJECTED': return '#EF4444';
      default: return '#6B7280';
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
  };

  const renderArticle = ({ item }: { item: NewspaperArticle }) => {
    const priority = getPriorityBadge(3); // Default priority
    const statusColor = getStatusColor(item.status);
    
    // Calculate word count
    const wordCount = item.content ? item.content.split(/\s+/).length : 0;

    return (
      <Pressable
        onPress={() => {
          // Navigate to article detail
        }}
        style={({ pressed }) => [
          styles.articleCard,
          { backgroundColor: c.card, borderLeftColor: statusColor },
          pressed && { opacity: 0.8 },
        ]}
      >
        {/* Image Section */}
        <View style={styles.imageContainer}>
          {item.coverImageUrl ? (
            <Image
              source={{ uri: item.coverImageUrl }}
              style={styles.articleImage}
              contentFit="cover"
            />
          ) : (
            <View style={[styles.imagePlaceholder, { backgroundColor: '#E5E7EB' }]}>
              <MaterialIcons name="article" size={32} color="#9CA3AF" />
            </View>
          )}
          
          {/* Priority Badge */}
          {priority && (
            <View style={[styles.priorityBadge, { backgroundColor: priority.color }]}>
              <MaterialIcons name={priority.icon as any} size={12} color="#fff" />
              <ThemedText style={styles.priorityText}>{priority.label}</ThemedText>
            </View>
          )}
        </View>

        {/* Content Section */}
        <View style={styles.contentSection}>
          {/* Location & Status */}
          <View style={styles.metaRow}>
            <View style={styles.locationBadge}>
              <MaterialIcons name="place" size={12} color="#6B7280" />
              <ThemedText style={styles.locationText}>{item.placeName}</ThemedText>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: `${statusColor}15` }]}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <ThemedText style={[styles.statusText, { color: statusColor }]}>
                {item.status}
              </ThemedText>
            </View>
          </View>

          {/* Title */}
          <ThemedText style={[styles.articleTitle, { color: c.text }]} numberOfLines={2}>
            {item.title}
          </ThemedText>

          {/* Lead */}
          <ThemedText style={[styles.articleLead, { color: c.muted }]} numberOfLines={2}>
            {item.lead}
          </ThemedText>

          {/* Footer Info */}
          <View style={styles.footerRow}>
            <View style={styles.timeInfo}>
              <MaterialIcons name="schedule" size={14} color="#9CA3AF" />
              <ThemedText style={styles.timeText}>{formatTime(item.createdAt)}</ThemedText>
            </View>
            <View style={styles.wordCount}>
              <MaterialIcons name="text-fields" size={14} color="#9CA3AF" />
              <ThemedText style={styles.wordCountText}>{wordCount} words</ThemedText>
            </View>
          </View>
        </View>
      </Pressable>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: '#F9FAFB' }]} edges={['top', 'bottom']}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color="#F59E0B" />
          <ThemedText style={styles.loadingText}>Loading articles...</ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  const displayDate = selectedDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#F9FAFB' }]} edges={['bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Newspaper Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16, backgroundColor: '#fff' }]}>
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
          >
            <MaterialIcons name="arrow-back" size={24} color="#111827" />
          </Pressable>

          <View style={styles.headerCenter}>
            <View style={styles.newspaperIcon}>
              <MaterialIcons name="newspaper" size={28} color="#8B5CF6" />
            </View>
            <View>
              <ThemedText style={styles.headerTitle}>
                {isToday() ? "My Daily Articles" : "My Article Archive"}
              </ThemedText>
              <ThemedText style={styles.headerDate}>{displayDate}</ThemedText>
            </View>
          </View>

          {!isToday() && (
            <Pressable
              onPress={goToToday}
              style={({ pressed }) => [
                styles.todayBtn,
                pressed && { opacity: 0.6 },
              ]}
            >
              <ThemedText style={styles.todayBtnText}>Today</ThemedText>
            </Pressable>
          )}
          {isToday() && <View style={styles.placeholder} />}
        </View>

        {/* Stats Bar */}
        <View style={styles.statsBar}>
          <View style={styles.statItem}>
            <ThemedText style={styles.statNumber}>{totalCount}</ThemedText>
            <ThemedText style={styles.statLabel}>Total</ThemedText>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <ThemedText style={[styles.statNumber, { color: '#10B981' }]}>
              {articles.filter(a => a.status === 'PUBLISHED').length}
            </ThemedText>
            <ThemedText style={styles.statLabel}>Published</ThemedText>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <ThemedText style={[styles.statNumber, { color: '#F59E0B' }]}>
              {articles.filter(a => a.status === 'PENDING').length}
            </ThemedText>
            <ThemedText style={styles.statLabel}>Pending</ThemedText>
          </View>
        </View>

        {/* Date Navigation */}
        <View style={styles.dateNav}>
          <Pressable
            onPress={goToPreviousDay}
            style={({ pressed }) => [
              styles.dateNavBtn,
              pressed && { opacity: 0.6 },
            ]}
          >
            <MaterialIcons name="chevron-left" size={24} color="#6B7280" />
            <ThemedText style={styles.dateNavText}>Previous</ThemedText>
          </Pressable>

          <Pressable
            onPress={() => setShowDatePicker(true)}
            style={({ pressed }) => [
              styles.datePickerBtn,
              pressed && { opacity: 0.8 },
            ]}
          >
            <MaterialIcons name="calendar-today" size={18} color="#8B5CF6" />
            <ThemedText style={styles.datePickerText}>
              {selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </ThemedText>
          </Pressable>

          <Pressable
            onPress={goToNextDay}
            disabled={isToday()}
            style={({ pressed }) => [
              styles.dateNavBtn,
              pressed && { opacity: 0.6 },
              isToday() && { opacity: 0.3 },
            ]}
          >
            <ThemedText style={styles.dateNavText}>Next</ThemedText>
            <MaterialIcons name="chevron-right" size={24} color="#6B7280" />
          </Pressable>
        </View>
      </View>

      {/* Date Picker Modal */}
      {showDatePicker && (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleDateChange}
          maximumDate={new Date()}
        />
      )}

      {/* Articles List */}
      <FlatList
        data={articles}
        renderItem={renderArticle}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadArticles(true)}
            colors={['#8B5CF6']}
            tintColor="#8B5CF6"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialIcons name="article" size={64} color="#D1D5DB" />
            <ThemedText style={styles.emptyTitle}>No Articles</ThemedText>
            <ThemedText style={styles.emptySubtitle}>
              You haven&apos;t published any articles on this date
            </ThemedText>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  /* Header */
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: '#E5E7EB',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
    gap: 12,
  },
  newspaperIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F3E8FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -0.5,
  },
  headerDate: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
    fontWeight: '500',
  },
  placeholder: {
    width: 40,
  },
  todayBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#8B5CF6',
    borderRadius: 8,
  },
  todayBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },

  /* Date Navigation */
  dateNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    gap: 8,
  },
  dateNavBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
  },
  dateNavText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  datePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#F3E8FF',
    borderWidth: 1,
    borderColor: '#8B5CF6',
  },
  datePickerText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#5B21B6',
  },

  /* Stats Bar */
  statsBar: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
  },
  statLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
    fontWeight: '600',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#E5E7EB',
  },

  /* Article Card */
  listContent: {
    padding: 16,
    gap: 16,
  },
  articleCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 3,
  },

  /* Image Section */
  imageContainer: {
    width: 120,
    position: 'relative',
  },
  articleImage: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  priorityBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  priorityText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  /* Content Section */
  contentSection: {
    flex: 1,
    padding: 12,
    gap: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '600',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  /* Title & Lead */
  articleTitle: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
    letterSpacing: -0.2,
  },
  articleLead: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },

  /* Footer */
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  timeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  wordCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  wordCountText: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '600',
  },

  /* Loading & Empty States */
  loadingCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
    textAlign: 'center',
  },
});
