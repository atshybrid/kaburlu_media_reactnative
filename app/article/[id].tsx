
import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, ScrollView } from 'react-native';
import ArticleDetailCard from '@/components/ui/ArticleDetailCard';
import { Article } from '@/types';
import { getArticleById } from '@/services/api';


export default function ArticleDetailScreen() {
  const { id, isShortId } = useLocalSearchParams<{ id: string; isShortId?: string }>();
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('[ARTICLE] ========================================');
    console.log('[ARTICLE] Screen loaded with id:', id, 'isShortId:', isShortId);
    console.log('[ARTICLE] ========================================');
    
    if (id) {
      // Check if this is a short ID from deep link
      const shouldResolveShortId = isShortId === 'true';
      
      console.log('[ARTICLE] Fetching article with id:', id, 'resolveShortId:', shouldResolveShortId);
      
      getArticleById(id, shouldResolveShortId)
        .then(response => {
          console.log('[ARTICLE] API response:', response ? 'Got article' : 'No article', response?.id);
          if (response) {
            setArticle(response);
          } else {
            setError("Article not found.");
          }
        })
        .catch(err => {
          console.error('[ARTICLE] API error:', err);
          setError(err.message)
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      console.log('[ARTICLE] No id provided!');
      setError("No article ID provided.");
      setLoading(false);
    }
  }, [id, isShortId]);

  if (loading) {
    return <ActivityIndicator size="large" style={styles.center} />;
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Error: {error}</Text>
      </View>
    );
  }

  if (!article) {
    return (
      <View style={styles.center}>
        <Text>Article not found.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <ArticleDetailCard
        title={article.title}
        body={article.body}
        imageUrl={article.image}
        authorName={article.author.name}
        authorAvatar={article.author.avatar}
        date={new Date(article.createdAt).toLocaleDateString()}
        onAuthorPress={() => {
          // Implement author press navigation if needed
          console.log(`Navigate to author screen for ID: ${article.author.id}`);
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: 'red',
  },
});
