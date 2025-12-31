import { Image } from 'expo-image';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import type { ArticleLayoutComponent } from './types';

const { width } = Dimensions.get('window');

const FullBleedImageLayout: ArticleLayoutComponent = ({ article }) => {
  return (
    <View style={styles.container}>
      <Image source={{ uri: article.image || article.images?.[0] || '' }} style={styles.hero} contentFit="cover" />
      <View style={styles.content}>
        <Text style={styles.title}>{article.title}</Text>
        {article.body ? (<Text style={styles.body} numberOfLines={10}>{article.body}</Text>) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  hero: { width: '100%', height: Math.round(width * 0.8), backgroundColor: '#eee' },
  content: { padding: 16 },
  title: { fontSize: 22, fontWeight: '800', marginBottom: 8, color: '#111' },
  body: { fontSize: 16, lineHeight: 24, color: '#374151' },
});

export default FullBleedImageLayout;
