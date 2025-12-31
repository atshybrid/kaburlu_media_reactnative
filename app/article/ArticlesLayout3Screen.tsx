import React, { useCallback } from 'react';
import { FlatList, SafeAreaView, StyleSheet, View } from 'react-native';
import ArticleCardLayout3, { ArticleLayout3 } from '../../components/articleLayouts/ArticleCardLayout3';

const SAMPLE_DATA: ArticleLayout3[] = [
  {
    id: 'l3-1',
    topCols: ['సంపుటి:1', 'సంచిక:3', 'గురువారం', 'కామారెడ్డి'],
    category: 'వినోదం.',
    subtitle: 'ఒకేసారి మూడు రకాల సమన్వయలు చుట్టుముట్టాయి',
    titleLine: 'సమన్త',
    excerpt:
      'ఒకేసారి మూడు రకాల సమన్వయలు చుట్టుముట్టాయి.. ఎంతో భాధపడగా "అది నేనే సమంత అన్నది" అని వార్తలు వచ్చాయి. స్టార్ హీరోయిన్ సమంత ప్రస్తావన...',
    imageUrl: 'https://picsum.photos/1200/675?random=21',
    authorName: 'Reporter Name',
    reporterType: 'newspaper',
    reporterLogo: 'https://picsum.photos/200/200?random=22',
    brandName: 'KhabarX',
    location: 'Hyderabad',
    time: '5:50 PM',
    likes: 230,
    comments: 10,
    shares: 43,
    tags: ['bjp'],
  },
];

const ArticlesLayout3Screen: React.FC = () => {
  const renderItem = useCallback(
    ({ item }: { item: ArticleLayout3 }) => <ArticleCardLayout3 item={item} />,
    []
  );
  const keyExtractor = useCallback((item: ArticleLayout3) => item.id, []);

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        data={SAMPLE_DATA}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.container}
        ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
      />
    </SafeAreaView>
  );
};

export default ArticlesLayout3Screen;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  container: { padding: 16, paddingBottom: 40 },
});
