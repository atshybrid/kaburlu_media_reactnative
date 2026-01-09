/**
 * useArticleShare - Hook for sharing articles as images
 * 
 * Provides functions to capture and share articles as newspaper-style images
 */
import { loadTokens } from '@/services/auth';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Platform, Share } from 'react-native';
import type { ShareableArticleData, ShareableArticleImageRef } from '../components/ShareableArticleImage';

export interface ArticleShareOptions {
  article: ShareableArticleData;
  tenantName?: string;
  tenantLogoUrl?: string;
  tenantPrimaryColor?: string;
}

export interface UseArticleShareResult {
  shareRef: React.RefObject<ShareableArticleImageRef | null>;
  shareAsImage: () => Promise<void>;
  shareAsLink: () => Promise<void>;
  showShareOptions: () => void;
  isSharing: boolean;
  tenantInfo: {
    name: string;
    logoUrl: string;
    primaryColor: string;
  };
}

export function useArticleShare(options: ArticleShareOptions): UseArticleShareResult {
  const { article, tenantName: propTenantName, tenantLogoUrl: propTenantLogoUrl, tenantPrimaryColor } = options;
  const shareRef = useRef<ShareableArticleImageRef | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [tenantInfo, setTenantInfo] = useState({
    name: propTenantName || '',
    logoUrl: propTenantLogoUrl || '',
    primaryColor: tenantPrimaryColor || '#109edc',
  });

  // Load tenant info from session
  useEffect(() => {
    if (propTenantName && propTenantLogoUrl) {
      setTenantInfo({
        name: propTenantName,
        logoUrl: propTenantLogoUrl,
        primaryColor: tenantPrimaryColor || '#109edc',
      });
      return;
    }

    (async () => {
      try {
        const t = await loadTokens();
        const session: any = (t as any)?.session;
        const ds = session?.domainSettings;
        const colors = ds?.data?.theme?.colors;
        const primary = colors?.primary || colors?.accent;
        const logo = ds?.data?.seo?.ogImageUrl || ds?.data?.branding?.logoUrl;
        const tn = session?.tenant?.name;

        setTenantInfo({
          name: tn || '',
          logoUrl: logo || '',
          primaryColor: /^#[0-9A-Fa-f]{6}$/.test(primary) ? primary : '#109edc',
        });
      } catch {
        // Keep defaults
      }
    })();
  }, [propTenantName, propTenantLogoUrl, tenantPrimaryColor]);

  // Share as image
  const shareAsImage = useCallback(async () => {
    if (!shareRef.current) {
      console.warn('[useArticleShare] shareRef not available');
      return;
    }
    setIsSharing(true);
    try {
      await shareRef.current.captureAndShare();
    } catch (e) {
      console.error('[useArticleShare] Share as image failed:', e);
    } finally {
      setIsSharing(false);
    }
  }, []);

  // Share as link
  const shareAsLink = useCallback(async () => {
    const url = article.webArticleUrl;
    if (!url) {
      Alert.alert('No Link', 'This article does not have a web link yet.');
      return;
    }

    setIsSharing(true);
    try {
      const message = `${article.title}\n\n${url}`;
      await Share.share(
        Platform.OS === 'android'
          ? { message }
          : { message, url, title: article.title }
      );
    } catch (e) {
      console.error('[useArticleShare] Share as link failed:', e);
    } finally {
      setIsSharing(false);
    }
  }, [article.title, article.webArticleUrl]);

  // Show share options
  const showShareOptions = useCallback(() => {
    const options: { text: string; onPress: () => void }[] = [
      { text: 'Share as Image', onPress: shareAsImage },
    ];

    if (article.webArticleUrl) {
      options.push({ text: 'Share Link', onPress: shareAsLink });
    }

    options.push({ text: 'Cancel', onPress: () => {} });

    Alert.alert(
      'Share Article',
      'Choose how to share this article',
      options.map(o => ({
        text: o.text,
        onPress: o.onPress,
        style: o.text === 'Cancel' ? 'cancel' as const : 'default' as const,
      })),
      { cancelable: true }
    );
  }, [shareAsImage, shareAsLink, article.webArticleUrl]);

  return {
    shareRef,
    shareAsImage,
    shareAsLink,
    showShareOptions,
    isSharing,
    tenantInfo,
  };
}

export default useArticleShare;
