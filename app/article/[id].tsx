
import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import ArticleDetailCard from '@/components/ui/ArticleDetailCard';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ErrorState from '@/components/ui/ErrorState';
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
            setError(null);
          } else {
            setError("Article not found. It may have been removed or doesn't exist.");
          }
        })
        .catch(err => {
          console.error('[ARTICLE] API error:', err);
          setError(err.message || "Failed to load article. Please check your connection.")
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

  const handleRetry = () => {
    setLoading(true);
    setError(null);
    
    if (id) {
      const shouldResolveShortId = isShortId === 'true';
      
      getArticleById(id, shouldResolveShortId)
        .then(response => {
          if (response) {
            setArticle(response);
            setError(null);
          } else {
            setError("Article not found. It may have been removed or doesn't exist.");
          }
        })
        .catch(err => {
          console.error('[ARTICLE] API error:', err);
          setError(err.message || "Failed to load article. Please check your connection.")
        })
        .finally(() => {
          setLoading(false);
        });
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <LoadingSpinner 
          fullScreen 
          text="Loading article..." 
          size="large"
        />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <ErrorState
          title="Failed to load article"
          message={error}
          icon="error"
          variant="error"
        />
      </View>
    );
  }

  if (!article) {
    return (
      <View style={styles.container}>
        <ErrorState
          title="Article not found"
          message="This article may have been removed or doesn't exist."
          icon="article"
          variant="info"
        />
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
