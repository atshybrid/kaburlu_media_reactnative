import { useDeviceLayout } from '@/hooks/useDeviceLayout';
import ImageWithSkeleton from '@/components/ui/ImageWithSkeleton';
import { StyleSheet, Text, View } from 'react-native';
import type { ArticleLayoutComponent } from './types';

const FullBleedImageLayout: ArticleLayoutComponent = ({ article }) => {
  const { scaleFontSize, imageHeight, horizontalPadding } = useDeviceLayout();

  const bodyWords = (article.body || '').split(/\s+/).filter(Boolean).length;
  const heroHeight = imageHeight(bodyWords);
  const titleSize = scaleFontSize(22);
  const bodySize = scaleFontSize(16);

  return (
    <View style={styles.container}>
      <ImageWithSkeleton
        uri={article.image || article.images?.[0] || ''}
        style={[styles.hero, { height: heroHeight }]}
        contentFit="cover"
        contentPosition="center"
      />
      <View style={[styles.content, { paddingHorizontal: horizontalPadding }]}>
        <Text style={[styles.title, { fontSize: titleSize, lineHeight: Math.round(titleSize * 1.3) }]}>
          {article.title}
        </Text>
        {article.body ? (
          <Text style={[styles.body, { fontSize: bodySize, lineHeight: Math.round(bodySize * 1.6) }]} numberOfLines={15}>
            {article.body}
          </Text>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  hero: { width: '100%', backgroundColor: '#eee' },
  content: { paddingVertical: 16 },
  title: { fontWeight: '800', marginBottom: 8, color: '#111' },
  body: { color: '#374151' },
});

export default FullBleedImageLayout;
