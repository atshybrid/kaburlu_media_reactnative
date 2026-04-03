/**
 * Daily Newspaper - Newspaper Archive with Advanced Filters
 * Shows published articles with smart filtering & column layouts
 */

import { ThemedText } from '@/components/ThemedText';
import BottomSheet from '@/components/ui/BottomSheet';
import { Colors } from '@/constants/Colors';
import KaburluEnglishLogo from '@/assets/spashlogos/english.svg';
import { searchCombinedLocations, CombinedLocationItem } from '@/services/locations';
import { getTenantReporters, TenantReporter } from '@/services/reporters';
import {
  getNewspaperArticles,
  NewspaperArticle,
  deleteNewspaperArticle,
  setPriorityNewspaperArticle,
} from '@/services/tenantAdmin';
import { loadTokens } from '@/services/auth';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Image } from 'expo-image';
import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback, useState, useMemo, useRef, useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme as useRNColorScheme,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import ViewShot from 'react-native-view-shot';
import RNShare from 'react-native-share';

export default function DailyNewspaperScreen() {
  const scheme = useRNColorScheme() ?? 'light';
  const c = Colors[scheme];
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [articles, setArticles] = useState<NewspaperArticle[]>([]);
  const [totalCount, setTotalCount] = useState(0);

  // Action sheet & share state
  const [actionItem, setActionItem] = useState<NewspaperArticle | null>(null);
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [shareArticle, setShareArticle] = useState<NewspaperArticle | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [sharingInProgress, setSharingInProgress] = useState(false);
  const shotRef = useRef<any>(null);
  
  // Filter Bottom Sheet
  const [showFilters, setShowFilters] = useState(false);
  
  // Filter States
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [fromDate, setFromDate] = useState<Date | undefined>();
  const [toDate, setToDate] = useState<Date | undefined>();
  const [showFromDatePicker, setShowFromDatePicker] = useState(false);
  const [showToDatePicker, setShowToDatePicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [stateId, setStateId] = useState('');
  const [districtId, setDistrictId] = useState('');
  const [mandalId, setMandalId] = useState('');
  const [reporterId, setReporterId] = useState('');
  const [minCharCount, setMinCharCount] = useState('');
  const [maxCharCount, setMaxCharCount] = useState('');
  
  // Location Search
  const [locationQuery, setLocationQuery] = useState('');
  const [locationResults, setLocationResults] = useState<CombinedLocationItem[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<CombinedLocationItem | null>(null);
  const [showLocationResults, setShowLocationResults] = useState(false);
  
  // Reporter Search
  const [reporterQuery, setReporterQuery] = useState('');
  const [reporters, setReporters] = useState<TenantReporter[]>([]);
  const [selectedReporter, setSelectedReporter] = useState<TenantReporter | null>(null);
  const [showReporterResults, setShowReporterResults] = useState(false);
  const [loadingReporters, setLoadingReporters] = useState(false);
  
  // Debounce timer refs
  const locationSearchTimer = useRef<NodeJS.Timeout | null>(null);
  
  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (locationSearchTimer.current) {
        clearTimeout(locationSearchTimer.current);
      }
    };
  }, []);

  const loadArticles = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const params: any = {
        limit: 100,
      };

      // Status filter
      if (selectedStatus !== 'ALL') {
        params.status = selectedStatus;
      }

      // Date range
      if (fromDate) {
        params.fromDate = fromDate.toISOString();
      }
      if (toDate) {
        const endOfDay = new Date(toDate);
        endOfDay.setHours(23, 59, 59, 999);
        params.toDate = endOfDay.toISOString();
      }

      // Location filters
      if (stateId) params.stateId = stateId;
      if (districtId) params.districtId = districtId;
      if (mandalId) params.mandalId = mandalId;

      // Reporter filter
      if (reporterId) params.reporterId = reporterId;

      // Character count range
      if (minCharCount) params.minCharCount = parseInt(minCharCount);
      if (maxCharCount) params.maxCharCount = parseInt(maxCharCount);

      const response = await getNewspaperArticles(params);

      let filteredArticles = response.items || [];
      
      // Client-side search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        filteredArticles = filteredArticles.filter(article => 
          article.title.toLowerCase().includes(query) ||
          article.lead?.toLowerCase().includes(query) ||
          article.placeName?.toLowerCase().includes(query)
        );
      }

      setArticles(filteredArticles);
      setTotalCount(filteredArticles.length);
    } catch (error) {
      console.error('Failed to load newspaper articles:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedStatus, fromDate, toDate, searchQuery, stateId, districtId, mandalId, reporterId, minCharCount, maxCharCount]);

  useFocusEffect(
    useCallback(() => {
      loadArticles();
    }, [loadArticles])
  );

  const handleFromDateChange = (event: any, date?: Date) => {
    setShowFromDatePicker(Platform.OS === 'ios');
    if (date) setFromDate(date);
  };

  const handleToDateChange = (event: any, date?: Date) => {
    setShowToDatePicker(Platform.OS === 'ios');
    if (date) setToDate(date);
  };

  const clearFilters = () => {
    setSelectedStatus('ALL');
    setFromDate(undefined);
    setToDate(undefined);
    setSearchQuery('');
    setStateId('');
    setDistrictId('');
    setMandalId('');
    setReporterId('');
    setMinCharCount('');
    setMaxCharCount('');
    setSelectedLocation(null);
    setLocationQuery('');
    setSelectedReporter(null);
    setReporterQuery('');
  };
  
  // Load reporters when filter sheet opens
  const loadReporters = useCallback(async () => {
    if (reporters.length > 0) return; // Already loaded
    
    setLoadingReporters(true);
    try {
      const tokens = await loadTokens();
      const tenantId = tokens?.session?.tenant?.id;
      if (!tenantId) return;
      
      const data = await getTenantReporters(tenantId, { active: true });
      setReporters(data);
    } catch (error) {
      console.error('Failed to load reporters:', error);
    } finally {
      setLoadingReporters(false);
    }
  }, [reporters.length]);
  
  // Search locations with debounce
  const searchLocations = useCallback(async (query: string) => {
    // Clear existing timer
    if (locationSearchTimer.current) {
      clearTimeout(locationSearchTimer.current);
    }
    
    if (!query.trim() || query.length < 2) {
      setLocationResults([]);
      setShowLocationResults(false);
      return;
    }
    
    // Debounce the search
    locationSearchTimer.current = setTimeout(async () => {
      try {
        const response = await searchCombinedLocations(query, 10);
        setLocationResults(response.items);
        setShowLocationResults(true);
      } catch (error) {
        console.error('Failed to search locations:', error);
        setLocationResults([]);
      }
    }, 300); // 300ms debounce
  }, []);
  
  // Handle location selection
  const handleLocationSelect = (location: CombinedLocationItem) => {
    setSelectedLocation(location);
    setLocationQuery(location.match.name);
    
    // Set IDs based on location type and hierarchy
    if (location.state) setStateId(location.state.id);
    if (location.district) setDistrictId(location.district.id);
    if (location.mandal) setMandalId(location.mandal.id);
    
    setShowLocationResults(false);
  };
  
  // Filter reporters by search query - memoized
  const filteredReporters = useMemo(() => {
    return reporters.filter(r => {
      if (!reporterQuery.trim()) return true;
      const query = reporterQuery.toLowerCase();
      return (
        r.fullName?.toLowerCase().includes(query) ||
        r.mobileNumber?.includes(query) ||
        r.state?.name?.toLowerCase().includes(query) ||
        r.district?.name?.toLowerCase().includes(query) ||
        r.mandal?.name?.toLowerCase().includes(query)
      );
    });
  }, [reporters, reporterQuery]);

  const activeFilterCount = () => {
    let count = 0;
    if (selectedStatus !== 'ALL') count++;
    if (fromDate || toDate) count++;
    if (selectedLocation || stateId || districtId || mandalId) count++;
    if (selectedReporter || reporterId) count++;
    if (minCharCount || maxCharCount) count++;
    return count;
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

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // ── Action Handlers ────────────────────────────────────────────────────────

  const handleEdit = (item: NewspaperArticle) => {
    setShowActionSheet(false);
    router.push({
      pathname: '/tenant/article/[id]',
      params: { id: item.id, source: 'daily-newspaper' },
    } as any);
  };

  const handleDelete = (item: NewspaperArticle) => {
    setShowActionSheet(false);
    Alert.alert(
      'Delete Article',
      `Delete "${item.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              await deleteNewspaperArticle(item.id);
              setArticles((prev) => prev.filter((a) => a.id !== item.id));
              setTotalCount((n) => n - 1);
            } catch {
              Alert.alert('Error', 'Failed to delete article');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleSetPriority = async (item: NewspaperArticle) => {
    setShowActionSheet(false);
    setActionLoading(true);
    try {
      await setPriorityNewspaperArticle(item.id, 'top');
      Alert.alert('Done', `"${item.title}" set to top priority`);
    } catch {
      Alert.alert('Error', 'Failed to set priority');
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenShare = (item: NewspaperArticle) => {
    setShowActionSheet(false);
    setShareArticle(item);
    setShowShareModal(true);
  };

  const handleCaptureShare = async () => {
    if (!shotRef.current || !shareArticle) return;
    setSharingInProgress(true);
    try {
      const uri = await shotRef.current.capture();
      const art = shareArticle as any;
      const shareUrl = art.shortId
        ? `https://s.kaburlumedia.com/${art.shortId}`
        : art.webArticleUrl
          ? art.webArticleUrl
          : `https://kaburlumedia.com`;
      const message = `${shareArticle.title}\n\n${shareUrl}`;
      try {
        await RNShare.open({
          title: shareArticle.title,
          message,
          url: `file://${uri}`,
          type: 'image/png',
          failOnCancel: false,
        });
      } catch {
        await Share.share({ title: shareArticle.title, message });
      }
    } catch {
      Alert.alert('Error', 'Failed to generate share image');
    } finally {
      setSharingInProgress(false);
    }
  };

  // ── Newspaper Cutting Preview (rendered inside share modal) ────────────────

  const NewspaperCuttingView = ({ article }: { article: NewspaperArticle }) => {
    const cutWidth = Math.min(screenWidth - 32, 400);
    const cutHeight = Math.min(screenHeight * 0.72, 640);
    const compact = cutWidth <= 360;
    const titleFont = compact ? 18 : 22;
    const subTitleFont = compact ? 12 : 13;
    const bodyFont = compact ? 12 : 13;
    const art = article as any;
    const today = new Date().toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
    const imgUri = article.coverImageUrl
      || art.baseArticle?.contentJson?.raw?.coverImageUrl
      || art.baseArticle?.contentJson?.raw?.images?.[0]
      || art.webArticle?.thumbnailUrl
      || '';
    const subTitle = article.subTitle || art.heading || '';
    const dateline = article.dateline || '';
    const bodyText = (art.content || art.lead || '').trim();
    const imageHeight = Math.min(Math.round(cutWidth * 0.46), compact ? 150 : 185);

    const normalizedBody = bodyText.replace(/\s+/g, ' ').trim();
    const preferredColumns = normalizedBody.length > 1700 ? 3 : normalizedBody.length > 900 ? 2 : 1;
    const columnCount = cutWidth < 360 ? Math.min(preferredColumns, 2) : preferredColumns;
    const maxChars = columnCount === 1 ? 1200 : columnCount === 2 ? 1800 : 2400;
    const clippedBody = normalizedBody.slice(0, maxChars);
    const words = clippedBody ? clippedBody.split(' ') : [];
    const wordsPerColumn = Math.max(1, Math.ceil(words.length / Math.max(1, columnCount)));
    const bodyColumns = Array.from({ length: columnCount }, (_, index) =>
      words.slice(index * wordsPerColumn, (index + 1) * wordsPerColumn).join(' '),
    ).filter(Boolean);

    // Reporter info
    const reporterName = art.author?.profile?.fullName || art.reporterName || '';
    const designation = art.author?.profile?.designationName
      || art.author?.designation?.name
      || art.designationName || '';
    const workplace = article.placeName || art.author?.profile?.placeName || '';
    const reporterPhoto = art.author?.profile?.profilePhotoUrl || '';
    const reporterInitial = reporterName ? reporterName.trim().charAt(0).toUpperCase() : 'R';

    return (
      <View style={[ncs.cutting, { width: cutWidth, height: cutHeight }]}>
        {/* ── Scissor top ── */}
        <View style={ncs.scissorRow}>
          <Text style={ncs.scissorIcon}>✂</Text>
          <View style={ncs.scissorDash} />
        </View>

        {/* ── Masthead ── */}
        <View style={ncs.mastheadRow}>
          <KaburluEnglishLogo width={130} height={Math.round(130 * 272 / 512)} />
          <View style={ncs.mastheadRight}>
            <Text style={ncs.mastheadDate}>{today}</Text>
            {article.placeName ? (
              <Text style={ncs.mastheadEdition}>{article.placeName} Edition</Text>
            ) : null}
          </View>
        </View>
        <View style={ncs.mastheadLine} />

        {/* ── Headline block ── */}
        <View style={ncs.headlineBlock}>
          <Text style={[ncs.cuttingHeadline, { fontSize: titleFont, lineHeight: compact ? 24 : 28 }]}>{article.title}</Text>
          {subTitle ? (
            <View style={ncs.subTitleRow}>
              <Text style={ncs.subTitleBullet}>•</Text>
              <Text style={[ncs.subTitleText, { fontSize: subTitleFont, lineHeight: compact ? 18 : 19 }]}>{subTitle}</Text>
            </View>
          ) : null}
        </View>
        <View style={ncs.mastheadLine} />

        {/* ── Cover image ── */}
        {imgUri ? (
          <Image
            source={{ uri: imgUri }}
            style={[ncs.cuttingImage, { height: imageHeight }]}
            contentFit="cover"
            contentPosition="center"
          />
        ) : (
          <View style={[ncs.imageFallback, { height: imageHeight }]}>
            <Text style={ncs.imageFallbackText}>Image unavailable</Text>
          </View>
        )}

        {/* ── Body text ── */}
        {bodyColumns.length > 0 ? (
          <View style={ncs.contentArea}>
            <View style={ncs.columnsRow}>
              {bodyColumns.map((colText, idx) => (
                <View key={idx} style={[ncs.column, { marginRight: idx === bodyColumns.length - 1 ? 0 : 8 }]}>
                  <Text style={[ncs.cuttingLead, { fontSize: bodyFont, lineHeight: compact ? 17 : 19 }]}>
                    {idx === 0 && dateline ? <Text style={[ncs.dateline, { fontSize: bodyFont }]}>({dateline}) </Text> : null}
                    {colText}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* ── Reporter footer ── */}
        <View style={ncs.footerBlock}>
          <View style={ncs.footerDivider} />
          {(reporterName || designation || workplace) ? (
            <View style={ncs.reporterCard}>
              {reporterPhoto ? (
                <Image source={{ uri: reporterPhoto }} style={ncs.reporterAvatar} contentFit="cover" />
              ) : (
                <View style={ncs.reporterAvatarFallback}>
                  <Text style={ncs.reporterAvatarInitial}>{reporterInitial}</Text>
                </View>
              )}
              <View style={ncs.reporterInfo}>
                {reporterName ? <Text style={ncs.reporterName}>{reporterName}</Text> : null}
                {designation ? <Text style={ncs.reporterDesig}>{designation}</Text> : null}
                {workplace ? <Text style={ncs.reporterPlace}>📍 {workplace}</Text> : null}
              </View>
            </View>
          ) : null}
        </View>

        {/* ── Scissor bottom ── */}
        <View style={[ncs.scissorRow, { flexDirection: 'row-reverse' }]}>
          <Text style={ncs.scissorIcon}>✂</Text>
          <View style={ncs.scissorDash} />
        </View>
      </View>
    );
  };

  const renderArticle = ({ item }: { item: NewspaperArticle }) => {
    const statusColor = getStatusColor(item.status);

    return (
      <Pressable
        onPress={() =>
          router.push({
            pathname: '/tenant/article/[id]',
            params: { id: item.id, source: 'daily-newspaper' },
          } as any)
        }
        style={[styles.articleCard, { backgroundColor: c.card }]}
      >
        {/* Image */}
        <View style={styles.imageWrapper}>
          {item.coverImageUrl ? (
            <Image
              source={{ uri: item.coverImageUrl }}
              style={styles.coverImage}
              contentFit="cover"
            />
          ) : (
            <View style={styles.imagePlaceholder}>
              <MaterialIcons name="article" size={48} color="#D1D5DB" />
            </View>
          )}

          {/* Status Badge */}
          <View style={[styles.statusTag, { backgroundColor: statusColor }]}>
            <Text style={styles.statusTagText}>{item.status}</Text>
          </View>

          {/* ⋮ Menu button */}
          <Pressable
            onPress={() => { setActionItem(item); setShowActionSheet(true); }}
            style={styles.moreMenuBtn}
            hitSlop={8}
          >
            <MaterialIcons name="more-vert" size={22} color="#fff" />
          </Pressable>
        </View>

        {/* Content */}
        <View style={styles.cardContent}>
          <View style={styles.locationRow}>
            <MaterialIcons name="location-on" size={12} color="#F59E0B" />
            <Text style={styles.locationLabel} numberOfLines={1}>{item.placeName}</Text>
          </View>
          <Text style={[styles.cardTitle, { color: c.text }]} numberOfLines={2}>
            {item.title}
          </Text>
          {item.lead && (
            <Text style={[styles.cardLead, { color: c.muted }]} numberOfLines={2}>
              {item.lead}
            </Text>
          )}

          <View style={styles.cardFooter}>
            <View style={styles.metaItem}>
              <MaterialIcons name="access-time" size={12} color="#9CA3AF" />
              <Text style={styles.metaText}>{formatTime(item.createdAt)}</Text>
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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#F9FAFB' }]} edges={['bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16, backgroundColor: '#fff' }]}>
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
          >
            <MaterialIcons name="arrow-back" size={24} color="#111827" />
          </Pressable>

          <View style={styles.headerCenter}>
            <ThemedText style={styles.headerTitle}>Newspaper Archive</ThemedText>
            <ThemedText style={styles.headerSubtitle}>{totalCount} articles</ThemedText>
          </View>

          <Pressable
            onPress={() => setShowFilters(true)}
            style={({ pressed }) => [styles.filterBtn, pressed && { opacity: 0.6 }]}
          >
            <MaterialIcons name="filter-list" size={24} color="#F59E0B" />
            {activeFilterCount() > 0 && (
              <View style={styles.filterBadge}>
                <ThemedText style={styles.filterBadgeText}>{activeFilterCount()}</ThemedText>
              </View>
            )}
          </Pressable>
        </View>

        {/* Search Bar */}
        <View style={styles.searchBar}>
          <MaterialIcons name="search" size={20} color="#9CA3AF" />
          <TextInput
            style={[styles.searchInput, { color: c.text }]}
            placeholder="Search articles..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')}>
              <MaterialIcons name="close" size={18} color="#9CA3AF" />
            </Pressable>
          )}
        </View>
      </View>

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
            colors={['#F59E0B']}
            tintColor="#F59E0B"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialIcons name="article" size={64} color="#D1D5DB" />
            <ThemedText style={styles.emptyTitle}>No Articles Found</ThemedText>
            <ThemedText style={styles.emptySubtitle}>
              Try adjusting your filters
            </ThemedText>
          </View>
        }
      />

      {/* Filter Bottom Sheet */}
      <BottomSheet
        visible={showFilters}
        onClose={() => {
          setShowFilters(false);
          setShowLocationResults(false);
          setShowReporterResults(false);
          Keyboard.dismiss();
        }}
        snapPoints={[0.85]}
        initialSnapIndex={0}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          <ScrollView 
            style={styles.filterSheet} 
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled={true}
          >
          <View style={styles.filterHeader}>
            <ThemedText style={styles.filterTitle}>Filters</ThemedText>
            <Pressable onPress={clearFilters}>
              <ThemedText style={styles.clearBtn}>Clear All</ThemedText>
            </Pressable>
          </View>

          {/* Status Filter */}
          <View style={styles.filterSection}>
            <ThemedText style={styles.filterSectionTitle}>Status</ThemedText>
            <View style={styles.chipRow}>
              {['ALL', 'PUBLISHED', 'PENDING', 'DRAFT', 'REJECTED'].map((status) => (
                <Pressable
                  key={status}
                  onPress={() => setSelectedStatus(status)}
                  style={[
                    styles.filterChip,
                    selectedStatus === status && styles.filterChipActive,
                  ]}
                >
                  <ThemedText
                    style={[
                      styles.filterChipText,
                      selectedStatus === status && styles.filterChipTextActive,
                    ]}
                  >
                    {status}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Date Range */}
          <View style={styles.filterSection}>
            <ThemedText style={styles.filterSectionTitle}>Date Range</ThemedText>
            <View style={styles.dateRow}>
              <Pressable
                onPress={() => setShowFromDatePicker(true)}
                style={styles.dateInput}
              >
                <MaterialIcons name="calendar-today" size={16} color="#6B7280" />
                <ThemedText style={styles.dateText}>
                  {fromDate ? formatDate(fromDate) : 'From Date'}
                </ThemedText>
              </Pressable>
              <ThemedText style={styles.dateSeparator}>→</ThemedText>
              <Pressable
                onPress={() => setShowToDatePicker(true)}
                style={styles.dateInput}
              >
                <MaterialIcons name="calendar-today" size={16} color="#6B7280" />
                <ThemedText style={styles.dateText}>
                  {toDate ? formatDate(toDate) : 'To Date'}
                </ThemedText>
              </Pressable>
            </View>
            {(fromDate || toDate) && (
              <Pressable
                onPress={() => {
                  setFromDate(undefined);
                  setToDate(undefined);
                }}
                style={styles.clearDateBtn}
              >
                <ThemedText style={styles.clearDateText}>Clear Dates</ThemedText>
              </Pressable>
            )}
          </View>

          {/* Location Filters */}
          <View style={styles.filterSection}>
            <ThemedText style={styles.filterSectionTitle}>Location</ThemedText>
            <View style={styles.autocompleteWrapper}>
              <TextInput
                style={[styles.input, { color: c.text }]}
                placeholder="Search location..."
                placeholderTextColor="#9CA3AF"
                value={locationQuery}
                onChangeText={(text) => {
                  setLocationQuery(text);
                  searchLocations(text);
                }}
                onFocus={() => {
                  if (locationResults.length > 0) setShowLocationResults(true);
                }}
              />
              {selectedLocation && (
                <Pressable
                  onPress={() => {
                    setSelectedLocation(null);
                    setLocationQuery('');
                    setStateId('');
                    setDistrictId('');
                    setMandalId('');
                    setShowLocationResults(false);
                  }}
                  style={styles.clearInputBtn}
                >
                  <MaterialIcons name="close" size={18} color="#6B7280" />
                </Pressable>
              )}
              
              {showLocationResults && locationResults.length > 0 && (
                <View style={styles.autocompleteResults} pointerEvents="box-none">
                  <ScrollView 
                    keyboardShouldPersistTaps="always"
                    nestedScrollEnabled={true}
                    style={{ maxHeight: 200 }}
                  >
                    {locationResults.map((location, index) => (
                      <Pressable
                        key={`${location.type}-${location.match.id}-${index}`}
                        onPress={() => handleLocationSelect(location)}
                        style={styles.autocompleteItem}
                      >
                        <MaterialIcons name="location-on" size={16} color="#F59E0B" />
                        <View style={styles.autocompleteItemText}>
                          <ThemedText style={styles.autocompleteLabel}>
                            {location.match.name}
                          </ThemedText>
                          <ThemedText style={styles.autocompleteSubLabel}>
                            {[
                              location.mandal?.name,
                              location.district?.name,
                              location.state?.name
                            ].filter(Boolean).join(', ')}
                          </ThemedText>
                        </View>
                        <ThemedText style={styles.autocompleteBadge}>
                          {location.type}
                        </ThemedText>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>
            
            {selectedLocation && (
              <View style={styles.selectedChip}>
                <MaterialIcons name="location-on" size={14} color="#F59E0B" />
                <ThemedText style={styles.selectedChipText}>
                  {selectedLocation.match.name} ({selectedLocation.type})
                </ThemedText>
              </View>
            )}
          </View>

          {/* Reporter Filter */}
          <View style={styles.filterSection}>
            <ThemedText style={styles.filterSectionTitle}>Reporter</ThemedText>
            <View style={styles.autocompleteWrapper}>
              <TextInput
                style={[styles.input, { color: c.text }]}
                placeholder="Search reporter..."
                placeholderTextColor="#9CA3AF"
                value={reporterQuery}
                onChangeText={setReporterQuery}
                onFocus={() => {
                  loadReporters();
                  setShowReporterResults(true);
                }}
              />
              {selectedReporter && (
                <Pressable
                  onPress={() => {
                    setSelectedReporter(null);
                    setReporterQuery('');
                    setReporterId('');
                    setShowReporterResults(false);
                  }}
                  style={styles.clearInputBtn}
                >
                  <MaterialIcons name="close" size={18} color="#6B7280" />
                </Pressable>
              )}
              
              {showReporterResults && !loadingReporters && filteredReporters.length > 0 && (
                <View style={styles.autocompleteResults} pointerEvents="box-none">
                  <ScrollView 
                    keyboardShouldPersistTaps="always"
                    nestedScrollEnabled={true}
                    style={{ maxHeight: 200 }}
                  >
                    {filteredReporters.slice(0, 20).map((reporter) => (
                      <Pressable
                        key={reporter.id}
                        onPress={() => {
                          setSelectedReporter(reporter);
                          setReporterQuery(reporter.fullName || reporter.mobileNumber || '');
                          setReporterId(reporter.id);
                          setShowReporterResults(false);
                        }}
                        style={styles.autocompleteItem}
                      >
                        <MaterialIcons name="person" size={16} color="#3B82F6" />
                        <View style={styles.autocompleteItemText}>
                          <ThemedText style={styles.autocompleteLabel}>
                            {reporter.fullName || 'Unknown'}
                          </ThemedText>
                          <ThemedText style={styles.autocompleteSubLabel}>
                            {reporter.mobileNumber} • {[
                              reporter.mandal?.name,
                              reporter.district?.name
                            ].filter(Boolean).join(', ')}
                          </ThemedText>
                        </View>
                        <ThemedText style={styles.autocompleteBadge}>
                          {reporter.level}
                        </ThemedText>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}
              
              {loadingReporters && (
                <View style={styles.loadingIndicator}>
                  <ActivityIndicator size="small" color="#F59E0B" />
                  <ThemedText style={styles.loadingText}>Loading reporters...</ThemedText>
                </View>
              )}
            </View>
            
            {selectedReporter && (
              <View style={styles.selectedChip}>
                <MaterialIcons name="person" size={14} color="#3B82F6" />
                <ThemedText style={styles.selectedChipText}>
                  {selectedReporter.fullName} ({selectedReporter.level})
                </ThemedText>
              </View>
            )}
          </View>

          {/* Character Count Range */}
          <View style={styles.filterSection}>
            <ThemedText style={styles.filterSectionTitle}>Character Count</ThemedText>
            <View style={styles.rangeRow}>
              <TextInput
                style={[styles.rangeInput, { color: c.text }]}
                placeholder="Min"
                placeholderTextColor="#9CA3AF"
                keyboardType="numeric"
                value={minCharCount}
                onChangeText={setMinCharCount}
              />
              <ThemedText style={styles.rangeSeparator}>-</ThemedText>
              <TextInput
                style={[styles.rangeInput, { color: c.text }]}
                placeholder="Max"
                placeholderTextColor="#9CA3AF"
                keyboardType="numeric"
                value={maxCharCount}
                onChangeText={setMaxCharCount}
              />
            </View>
          </View>

          {/* Apply Button */}
          <Pressable
            onPress={() => {
              setShowFilters(false);
              loadArticles();
            }}
            style={styles.applyBtn}
          >
            <ThemedText style={styles.applyBtnText}>Apply Filters</ThemedText>
          </Pressable>

          <View style={{ height: 40 }} />
        </ScrollView>
        </KeyboardAvoidingView>
      </BottomSheet>

      {/* Date Pickers */}
      {showFromDatePicker && (
        <DateTimePicker
          value={fromDate || new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleFromDateChange}
          maximumDate={toDate || new Date()}
        />
      )}
      {showToDatePicker && (
        <DateTimePicker
          value={toDate || new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleToDateChange}
          minimumDate={fromDate}
          maximumDate={new Date()}
        />
      )}

      {/* ── Action Sheet Modal ──────────────────────────────── */}
      <Modal
        visible={showActionSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowActionSheet(false)}
      >
        <Pressable style={styles.sheetOverlay} onPress={() => setShowActionSheet(false)}>
          <View style={styles.actionSheet}>
            <View style={styles.sheetHandle} />
            {actionItem && (
              <Text style={styles.sheetTitle} numberOfLines={2}>{actionItem.title}</Text>
            )}
            <Pressable style={styles.sheetRow} onPress={() => actionItem && handleOpenShare(actionItem)}>
              <View style={[styles.sheetIcon, { backgroundColor: '#EFF6FF' }]}>
                <MaterialIcons name="share" size={20} color="#3B82F6" />
              </View>
              <Text style={styles.sheetRowText}>Share (Newspaper Cutting)</Text>
              <MaterialIcons name="chevron-right" size={20} color="#D1D5DB" />
            </Pressable>
            <Pressable style={styles.sheetRow} onPress={() => actionItem && handleSetPriority(actionItem)}>
              <View style={[styles.sheetIcon, { backgroundColor: '#FFFBEB' }]}>
                <MaterialIcons name="vertical-align-top" size={20} color="#F59E0B" />
              </View>
              <Text style={styles.sheetRowText}>Set as Top Priority</Text>
              <MaterialIcons name="chevron-right" size={20} color="#D1D5DB" />
            </Pressable>
            <Pressable style={styles.sheetRow} onPress={() => actionItem && handleEdit(actionItem)}>
              <View style={[styles.sheetIcon, { backgroundColor: '#ECFDF5' }]}>
                <MaterialIcons name="edit" size={20} color="#10B981" />
              </View>
              <Text style={styles.sheetRowText}>Edit Article</Text>
              <MaterialIcons name="chevron-right" size={20} color="#D1D5DB" />
            </Pressable>
            <Pressable style={styles.sheetRow} onPress={() => actionItem && handleDelete(actionItem)}>
              <View style={[styles.sheetIcon, { backgroundColor: '#FEF2F2' }]}>
                <MaterialIcons name="delete-outline" size={20} color="#EF4444" />
              </View>
              <Text style={[styles.sheetRowText, { color: '#EF4444' }]}>Delete Article</Text>
              <MaterialIcons name="chevron-right" size={20} color="#D1D5DB" />
            </Pressable>
            <Pressable style={styles.sheetCancelBtn} onPress={() => setShowActionSheet(false)}>
              <Text style={styles.sheetCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* ── Share Preview Modal ─────────────────────────────── */}
      <Modal
        visible={showShareModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowShareModal(false)}
      >
        <View style={styles.shareModalBg}>
          <View style={styles.shareModalCard}>
            <Text style={styles.shareModalTitle}>Share Preview</Text>

            {shareArticle && (
              <ViewShot ref={shotRef} options={{ format: 'png', quality: 0.95 }}>
                <NewspaperCuttingView article={shareArticle} />
              </ViewShot>
            )}

            <View style={styles.shareModalActions}>
              <Pressable
                style={styles.shareCancelBtn}
                onPress={() => { setShowShareModal(false); setShareArticle(null); }}
              >
                <Text style={styles.shareCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.shareConfirmBtn, sharingInProgress && { opacity: 0.6 }]}
                onPress={handleCaptureShare}
                disabled={sharingInProgress}
              >
                {sharingInProgress ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <MaterialIcons name="share" size={18} color="#fff" />
                    <Text style={styles.shareConfirmText}>Share Now</Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Global loading overlay ──────────────────────────── */}
      {actionLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#F59E0B" />
        </View>
      )}
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
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
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
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
    fontWeight: '500',
  },
  filterBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  filterBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  filterBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#fff',
  },

  /* Search Bar */
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
  },

  /* Article List */
  listContent: {
    padding: 16,
    gap: 12,
  },
  articleCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 3,
  },
  imageWrapper: {
    width: '100%',
    height: 200,
    backgroundColor: '#F3F4F6',
    position: 'relative',
  },
  coverImage: {
    width: '100%',
    height: 200,
  },
  imagePlaceholder: {
    width: '100%',
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusTag: {
    position: 'absolute',
    top: 8,
    right: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusTagText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  cardContent: {
    padding: 14,
    gap: 8,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationLabel: {
    fontSize: 11,
    color: '#92400E',
    fontWeight: '700',
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 22,
    letterSpacing: -0.3,
  },
  cardLead: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
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
    paddingVertical: 80,
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
  },

  /* Filter Bottom Sheet */
  filterSheet: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
  },
  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  filterTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
  },
  clearBtn: {
    fontSize: 14,
    fontWeight: '700',
    color: '#EF4444',
  },
  filterSection: {
    marginBottom: 24,
  },
  filterSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 12,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterChipActive: {
    backgroundColor: '#F59E0B',
    borderColor: '#F59E0B',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
  },
  filterChipTextActive: {
    color: '#fff',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dateInput: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  dateText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '600',
  },
  dateSeparator: {
    fontSize: 16,
    color: '#9CA3AF',
  },
  clearDateBtn: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  clearDateText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#EF4444',
  },
  input: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    fontSize: 14,
    color: '#111827',
    marginBottom: 10,
  },
  rangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rangeInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    fontSize: 14,
    color: '#111827',
  },
  rangeSeparator: {
    fontSize: 16,
    color: '#9CA3AF',
    fontWeight: '700',
  },
  applyBtn: {
    backgroundColor: '#F59E0B',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  applyBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.5,
  },
  
  /* Autocomplete */
  autocompleteWrapper: {
    position: 'relative',
  },
  clearInputBtn: {
    position: 'absolute',
    right: 12,
    top: 12,
    zIndex: 10,
  },
  autocompleteResults: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 8,
    marginTop: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 8,
    zIndex: 1000,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  autocompleteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  autocompleteItemText: {
    flex: 1,
  },
  autocompleteLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  autocompleteSubLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  autocompleteBadge: {
    fontSize: 9,
    fontWeight: '800',
    color: '#F59E0B',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  selectedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 8,
  },
  selectedChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400E',
  },
  loadingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
  },

  /* ── Article card additions ─────────────────────────────────── */
  moreMenuBtn: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineActions: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 6,
  },
  inlineBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  inlineBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },

  /* ── Action Sheet ──────────────────────────────────────────── */
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  actionSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 36,
    paddingTop: 12,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 16,
    lineHeight: 20,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 14,
  },
  sheetIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetRowText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  sheetCancelBtn: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 14,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
  },
  sheetCancelText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#374151',
  },

  /* ── Share Modal ───────────────────────────────────────────── */
  shareModalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  shareModalCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 440,
    maxHeight: '90%',
  },
  shareModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 16,
    textAlign: 'center',
  },
  shareModalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  shareCancelBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  shareCancelText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#374151',
  },
  shareConfirmBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#1D4ED8',
  },
  shareConfirmText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },

  /* ── Loading overlay ────────────────────────────────────────── */
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// ── Newspaper Cutting StyleSheet ─────────────────────────────────────────────
const ncs = StyleSheet.create({
  // ── Outer wrapper ────────────────────────────────────────────────────────────
  cutting: {
    backgroundColor: '#FFFDF5',
    alignSelf: 'center',
    overflow: 'hidden',
    borderRadius: 6,
  },

  // ── Scissor edges ────────────────────────────────────────────────────────────
  scissorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFDF5',
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  scissorIcon: {
    fontSize: 16,
    color: '#8B7355',
    marginHorizontal: 4,
  },
  scissorDash: {
    flex: 1,
    height: 1.5,
    borderStyle: 'dashed',
    borderColor: '#8B7355',
    borderWidth: 1,
  },

  // ── Masthead ─────────────────────────────────────────────────────────────────
  mastheadRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  mastheadRight: {
    alignItems: 'flex-end',
    paddingTop: 4,
  },
  mastheadDate: {
    fontSize: 10,
    color: '#111827',
    fontWeight: '600',
  },
  mastheadEdition: {
    fontSize: 9,
    color: '#4B5563',
    marginTop: 3,
  },
  mastheadLine: {
    height: 3,
    backgroundColor: '#C8A45E',
  },

  // ── Headline block (title + subtitle) ────────────────────────────────────────
  headlineBlock: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
    backgroundColor: '#FFFDF5',
  },
  cuttingHeadline: {
    fontSize: 22,
    fontWeight: '900',
    color: '#111827',
    lineHeight: 28,
    letterSpacing: -0.5,
    fontFamily: 'serif',
  },
  subTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 6,
  },
  subTitleBullet: {
    fontSize: 14,
    fontWeight: '900',
    color: '#1A1A1A',
    marginRight: 5,
    lineHeight: 20,
  },
  subTitleText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: '#1A1A1A',
    lineHeight: 19,
  },

  // ── Cover image ───────────────────────────────────────────────────────────────
  cuttingImage: {
    width: '100%',
  },
  imageFallback: {
    width: '100%',
    backgroundColor: '#EEE8D8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageFallbackText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
  },

  // ── Highlight points ──────────────────────────────────────────────────────────
  pointsBox: {
    backgroundColor: '#F9F3E0',
    borderLeftWidth: 3,
    borderLeftColor: '#C8A45E',
    marginHorizontal: 14,
    marginTop: 10,
    marginBottom: 2,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 5,
  },
  pointRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  pointBullet: {
    fontSize: 8,
    color: '#C8A45E',
    marginRight: 6,
    marginTop: 4,
  },
  pointText: {
    flex: 1,
    fontSize: 12,
    color: '#1F2937',
    lineHeight: 18,
    fontWeight: '500',
  },

  // ── Body text ─────────────────────────────────────────────────────────────────
  contentArea: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 8,
    flex: 1,
  },
  columnsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  column: {
    flex: 1,
  },
  dateline: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1A1A1A',
    fontStyle: 'italic',
  },
  cuttingLead: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 20,
    textAlign: 'left',
  },

  // ── Footer ────────────────────────────────────────────────────────────────────
  footerBlock: {
    paddingHorizontal: 14,
    paddingBottom: 10,
    paddingTop: 8,
  },
  footerDivider: {
    height: 1,
    backgroundColor: '#C8A45E',
    opacity: 0.6,
    marginBottom: 7,
  },
  reporterCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F6EF',
    borderWidth: 1,
    borderColor: '#E6DDC8',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  reporterAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    marginRight: 10,
    backgroundColor: '#E5E7EB',
  },
  reporterAvatarFallback: {
    width: 42,
    height: 42,
    borderRadius: 21,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D1D5DB',
  },
  reporterAvatarInitial: {
    fontSize: 16,
    fontWeight: '800',
    color: '#374151',
  },
  reporterInfo: {
    flex: 1,
  },
  reporterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginBottom: 4,
  },
  reporterName: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  reporterDesig: {
    fontSize: 10,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  reporterPlace: {
    fontSize: 11,
    color: '#6B7280',
  },
});
