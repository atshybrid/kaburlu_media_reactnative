import { Image } from 'expo-image';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import type { ArticleLayoutComponent } from './types';

const { width } = Dimensions.get('window');

const CardStackLayout: ArticleLayoutComponent = ({ article }) => {
  return (
    <View style={styles.container}>
      <View style={[styles.card, { transform: [{ rotate: '-2deg' }]}]} />
      <View style={[styles.card, { transform: [{ rotate: '2deg' }]}]} />
      <View style={[styles.card, styles.cardTop]}>
        <Image source={{ uri: article.image || article.images?.[0] || '' }} style={styles.image} contentFit="cover" />
        <View style={styles.pad}>
          <Text style={styles.title}>{article.title}</Text>
          {article.body ? <Text style={styles.body} numberOfLines={8}>{article.body}</Text> : null}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' },
  card: { position: 'absolute', width: width - 24, height: Math.round((width - 24) * 1.2), backgroundColor: '#fff', borderRadius: 16, elevation: 4, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  cardTop: { transform: [{ rotate: '0deg' }], overflow: 'hidden' },
  image: { width: '100%', height: '50%', backgroundColor: '#e5e7eb' },
  pad: { padding: 14 },
  title: { fontSize: 22, fontWeight: '900', color: '#0f172a', marginBottom: 6 },
  body: { fontSize: 16, lineHeight: 24, color: '#334155' },
});

export default CardStackLayout;
