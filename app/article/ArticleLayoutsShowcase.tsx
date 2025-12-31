import ArticlePage from '@/components/ArticlePage';
import ArticleCardLayout3, { ArticleLayout3 } from '@/components/articleLayouts/ArticleCardLayout3';
import LayoutTwo from '@/components/articleLayouts/LayoutTwo';
import type { Article } from '@/types';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// Basic sample article data to feed into the three layouts.
// In real usage you would fetch or derive these from your article store/service.
const baseArticle: Article = {
  id: 'sample-1',
  title: 'Sample Headline: Breaking News Story',
  summary: 'Short summary for layout one demonstration.',
  body: 'Full body text for the sample headline used to demonstrate how layout one renders an article. This would normally be longer.',
  image: 'https://picsum.photos/1200/675?random=11',
  createdAt: new Date().toISOString(),
  publisherName: 'Kaburlu',
  publisherLogo: 'https://picsum.photos/100/100?random=12',
  author: { id: 'a1', name: 'Staff Reporter', avatar: 'https://picsum.photos/64/64?random=13' },
  category: 'General',
  isRead: false,
  likes: 10,
  comments: 2,
  tags: ['breaking'],
};

const secondArticle: Article = {
  ...baseArticle,
  id: 'sample-2',
  title: 'Economy Outlook Improves as Markets Rally',
  summary: 'Markets rally as sentiment shifts positive in morning trading.',
  body: 'Extended body for the economy outlook article. Demonstrates alternate layout styling.',
  image: 'https://picsum.photos/1200/675?random=14',
  category: 'Business',
  likes: 24,
};

// Additional articles could be added for extended demos.

const layout3Article: ArticleLayout3 = {
  id: 'l3-showcase',
  topCols: ['సంపుటి:5', 'సంచిక:12', 'శుక్రవారం', 'హైదరాబాద్'],
  category: 'సినిమా',
  subtitle: 'విభిన్న శైలులతో కొత్త విజువల్ ప్రెజెంటేషన్',
  titleLine: 'సమన్త',
  excerpt: 'లేఅవుట్ 3 ప్రదర్శన కోసం ఇది ఒక నమూనా వివరణ. శీర్షిక, ఉపశీర్షిక మరియు ఇతర అంశాల కలయికను చూపిస్తుంది.',
  imageUrl: 'https://picsum.photos/1200/675?random=33',
  authorName: 'Staff Reporter',
  reporterType: 'newspaper',
  reporterLogo: 'https://picsum.photos/200/200?random=34',
  brandName: 'Kaburlu',
  location: 'Hyderabad',
  time: '10:15 AM',
  likes: 54,
  comments: 3,
  shares: 7,
  tags: ['markets', 'bjp'],
};

type LayoutKey = 'layout1' | 'layout2' | 'layout3';

interface ShowcaseItem {
  key: LayoutKey;
  title: string;
}

const ITEMS: ShowcaseItem[] = [
  { key: 'layout1', title: 'Layout 1 (ArticlePage)' },
  { key: 'layout2', title: 'Layout 2' },
  { key: 'layout3', title: 'Layout 3 (Card)' },
];

const AUTO_INTERVAL_MS = 6000;

const ArticleLayoutsShowcase: React.FC = () => {
  const [active, setActive] = useState<LayoutKey>('layout1');
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  // Width could be used for responsive adjustments if needed later.

  const advance = useCallback(() => {
    setActive(prev => {
      const order: LayoutKey[] = ['layout1', 'layout2', 'layout3'];
      const idx = order.indexOf(prev);
      return order[(idx + 1) % order.length];
    });
  }, []);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(advance, AUTO_INTERVAL_MS);
  }, [advance]);

  useEffect(() => {
    resetTimer();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [active, resetTimer]);

  const renderActive = useMemo(() => {
    switch (active) {
      case 'layout1':
        return (
          <View style={styles.layoutContainer}>
            <ArticlePage article={baseArticle} index={0} totalArticles={3} />
          </View>
        );
      case 'layout2':
        return (
          <View style={styles.layoutContainer}>
            <LayoutTwo article={secondArticle} index={1} totalArticles={3} />
          </View>
        );
      case 'layout3':
        return (
            <View style={styles.layoutContainer}>
              <ArticleCardLayout3 item={layout3Article} />
            </View>
        );
      default:
        return null;
    }
  }, [active]);

  const onSelect = (k: LayoutKey) => {
    setActive(k);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Article Layouts Showcase</Text>
        <Text style={styles.sub}>Auto rotates every {(AUTO_INTERVAL_MS/1000).toFixed(0)}s. Tap a tab to lock.</Text>
      </View>
      <View style={styles.tabs}>
        {ITEMS.map(it => {
          const selected = it.key === active;
          return (
            <TouchableOpacity
              key={it.key}
              onPress={() => onSelect(it.key)}
              style={[styles.tab, selected && styles.tabActive]}
              accessibilityRole='button'
              accessibilityState={selected ? { selected: true } : undefined}
            >
              <Text style={[styles.tabText, selected && styles.tabTextActive]}>{it.title}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        {renderActive}
      </ScrollView>
    </SafeAreaView>
  );
};

export default ArticleLayoutsShowcase;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  sub: { fontSize: 12, color: '#666', marginTop: 2 },
  tabs: { flexDirection: 'row', paddingHorizontal: 8, marginTop: 8, marginBottom: 4 },
  tab: { flex: 1, paddingVertical: 10, marginHorizontal: 4, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: '#ccc', backgroundColor: '#f8f8f8', alignItems: 'center' },
  tabActive: { backgroundColor: '#2d2d2d' },
  tabText: { fontSize: 12, fontWeight: '600', color: '#333', textAlign: 'center' },
  tabTextActive: { color: '#fff' },
  scroll: { padding: 16, paddingBottom: 64 },
  layoutContainer: { width: '100%', alignSelf: 'center' },
});
