import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import type { ArticleLayoutComponent } from './types';

const MinimalTitleFirstLayout: ArticleLayoutComponent = ({ article }) => {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{article.title}</Text>
        {article.author?.name ? (
          <Text style={styles.meta}>{article.author.name} • {new Date(article.createdAt || Date.now()).toLocaleDateString()}</Text>
        ) : null}
      </View>
      <Image source={{ uri: article.image || article.images?.[0] || '' }} style={styles.thumb} contentFit="cover" />
      {article.body ? (
        <Text style={styles.body} numberOfLines={12}>{article.body}</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 16 },
  header: { marginBottom: 8 },
  title: { fontSize: 24, fontWeight: '900', color: '#0f172a' },
  meta: { marginTop: 4, color: '#64748b' },
  thumb: { width: '100%', height: 220, backgroundColor: '#e5e7eb', borderRadius: 10, marginVertical: 10 },
  body: { fontSize: 16, lineHeight: 24, color: '#334155' },
});

export default MinimalTitleFirstLayout;
