import { layouts } from '@/components/articleLayouts/registry';
import type { Article } from '@/types';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  Dimensions,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Sample article for testing layouts
const sampleArticle: Article = {
  id: 'test-article-123',
  title: 'తెలంగాణ రాష్ట్రంలో కొత్త విద్యా విధానం అమలు - విద్యార్థులకు మంచి భవిష్యత్తు',
  summary: 'తెలంగాణ ప్రభుత్వం కొత్త విద్యా విధానాన్ని ప్రకటించింది. ఈ విధానం వల్ల విద్యార్థులకు మెరుగైన అవకాశాలు లభిస్తాయని అధికారులు చెప్పారు.',
  body: `తెలంగాణ ప్రభుత్వం విద్యా రంగంలో సమూల మార్పులకు శ్రీకారం చుట్టింది. రాష్ట్ర ముఖ్యమంత్రి ఈ రోజు కొత్త విద్యా విధానాన్ని ప్రకటించారు.

ఈ విధానంలో ముఖ్యమైన అంశాలు:
• అన్ని పాఠశాలల్లో డిజిటల్ క్లాస్ రూమ్‌లు
• ఉచిత ల్యాప్‌టాప్‌లు విద్యార్థులకు
• నూతన బోధనా పద్ధతులు
• ఉపాధ్యాయులకు ప్రత్యేక శిక్షణ

విద్యా శాఖ మంత్రి మాట్లాడుతూ, "మన రాష్ట్రంలో ప్రతి విద్యార్థి నాణ్యమైన విద్యను పొందాలని మేము కోరుకుంటున్నాము. ఈ విధానం ద్వారా అది సాధ్యమవుతుంది" అని తెలిపారు.

ఈ విధానం వచ్చే విద్యా సంవత్సరం నుండి అమలులోకి వస్తుంది. రాష్ట్రంలోని అన్ని ప్రభుత్వ పాఠశాలల్లో దీనిని అమలు చేయనున్నారు.`,
  image: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800',
  images: [
    'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800',
    'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800',
    'https://images.unsplash.com/photo-1509062522246-3755977927d7?w=800',
  ],
  category: { id: 'education', name: 'విద్య' },
  publisherName: 'Kaburlu News',
  createdAt: new Date().toISOString(),
  likes: 245,
} as Article;

export default function TestScreen() {
  const router = useRouter();
  const [currentLayoutIndex, setCurrentLayoutIndex] = useState(0);

  const currentLayout = useMemo(() => layouts[currentLayoutIndex], [currentLayoutIndex]);
  const LayoutComponent = currentLayout.component;

  const goBack = () => router.back();
  
  const prevLayout = () => {
    setCurrentLayoutIndex(i => (i === 0 ? layouts.length - 1 : i - 1));
  };
  
  const nextLayout = () => {
    setCurrentLayoutIndex(i => (i === layouts.length - 1 ? 0 : i + 1));
  };

  return (
    <View style={styles.container}>
      {/* Top bar with layout selector */}
      <SafeAreaView style={styles.topBar}>
        <Pressable onPress={goBack} style={styles.backBtn}>
          <Feather name="arrow-left" size={24} color="#fff" />
        </Pressable>
        
        <View style={styles.layoutSelector}>
          <Pressable onPress={prevLayout} style={styles.arrowBtn}>
            <Feather name="chevron-left" size={28} color="#fff" />
          </Pressable>
          
          <View style={styles.layoutInfo}>
            <Text style={styles.layoutNumber}>
              Style {currentLayoutIndex + 1} / {layouts.length}
            </Text>
            <Text style={styles.layoutName}>{currentLayout.name}</Text>
            <Text style={styles.layoutKey}>key: {currentLayout.key}</Text>
          </View>
          
          <Pressable onPress={nextLayout} style={styles.arrowBtn}>
            <Feather name="chevron-right" size={28} color="#fff" />
          </Pressable>
        </View>
      </SafeAreaView>

      {/* Layout preview */}
      <View style={styles.layoutPreview}>
        <LayoutComponent 
          article={sampleArticle} 
          index={0} 
          totalArticles={1} 
        />
      </View>

      {/* Bottom layout list */}
      <View style={styles.bottomBar}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.layoutList}
        >
          {layouts.map((layout, idx) => (
            <Pressable 
              key={layout.key}
              style={[
                styles.layoutTab,
                currentLayoutIndex === idx && styles.layoutTabActive
              ]}
              onPress={() => setCurrentLayoutIndex(idx)}
            >
              <Text style={[
                styles.layoutTabNumber,
                currentLayoutIndex === idx && styles.layoutTabTextActive
              ]}>
                {idx + 1}
              </Text>
              <Text style={[
                styles.layoutTabName,
                currentLayoutIndex === idx && styles.layoutTabTextActive
              ]}>
                {layout.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  topBar: {
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    zIndex: 100,
  },
  backBtn: {
    position: 'absolute',
    left: 16,
    top: 50,
    zIndex: 10,
    padding: 8,
  },
  layoutSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 60,
  },
  arrowBtn: {
    padding: 8,
  },
  layoutInfo: {
    alignItems: 'center',
    minWidth: 150,
  },
  layoutNumber: {
    color: '#888',
    fontSize: 12,
    fontWeight: '600',
  },
  layoutName: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    marginVertical: 2,
  },
  layoutKey: {
    color: '#666',
    fontSize: 11,
    fontFamily: 'monospace',
  },
  layoutPreview: {
    flex: 1,
    backgroundColor: '#000',
  },
  bottomBar: {
    backgroundColor: '#1a1a1a',
    borderTopWidth: 1,
    borderTopColor: '#333',
    paddingVertical: 8,
  },
  layoutList: {
    paddingHorizontal: 12,
    gap: 8,
  },
  layoutTab: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#2a2a2a',
    borderRadius: 20,
    alignItems: 'center',
    minWidth: 80,
  },
  layoutTabActive: {
    backgroundColor: '#DC2626',
  },
  layoutTabNumber: {
    color: '#888',
    fontSize: 11,
    fontWeight: '700',
  },
  layoutTabName: {
    color: '#ccc',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  layoutTabTextActive: {
    color: '#fff',
  },
});
