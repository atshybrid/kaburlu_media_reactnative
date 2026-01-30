import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadTokens } from './auth';
import { HttpError, request } from './http';
import { createNewspaperArticle } from './api';
import type { AIRewriteUnifiedResponse } from './aiRewriteUnified';
import type { CombinedLocationItem } from './locations';

type UploadedPhoto = {
  photoId: string;
  url: string;
  caption: string;
  alt: string;
};

type UnifiedArticlePayload = {
  tenantId?: string;
  domainId?: string | null;
  baseArticle: {
    languageCode: string;
    newsType: string;
    category: {
      categoryId: string;
      categoryName: string;
    };
  };
  location: {
    inputText: string;
    resolved: {
      village?: { id: string; name: string } | null;
      mandal?: { id: string; name: string } | null;
      district?: { id: string; name: string } | null;
      state?: { id: string; name: string } | null;
    };
    dateline: {
      placeName: string;
      date: string;
      formatted: string;
    };
  };
  printArticle: {
    headline: string;
    subtitle: string | null;
    body: string[];
    highlights: string[] | null;
    responses: string[] | null;
  };
  webArticle: {
    headline: string;
    lead: string;
    sections?: {
      subhead: string | null;
      paragraphs: string[];
    }[];
    seo: {
      slug: string;
      metaTitle: string;
      metaDescription: string;
      keywords: string[];
    };
  };
  shortNews: {
    h1: string;
    h2: string | null;
    content: string;
  };
  media: {
    images: {
      url: string;
      caption: string;
      alt: string;
    }[];
  };
  publishControl: {
    publishReady: boolean;
    reason: string;
  };
};

type SubmitResult = {
  success: boolean;
  message: string;
  status?: string;
  data?: any;
};

export async function submitUnifiedArticle(): Promise<SubmitResult> {
  try {
    const DEBUG_FULL = (() => {
      const raw = String(process.env.EXPO_PUBLIC_HTTP_DEBUG ?? '').toLowerCase();
      return raw === '1' || raw === 'true' || raw === 'on' || raw === 'yes';
    })();

    // Load all stored data
    const [responseStr, locationStr, photosStr, tenantIdStr, languageCode, tokens] = await Promise.all([
      AsyncStorage.getItem('AI_REWRITE_RESPONSE'),
      AsyncStorage.getItem('SELECTED_LOCATION'),
      AsyncStorage.getItem('UPLOADED_PHOTOS'),
      AsyncStorage.getItem('AI_REWRITE_TENANT_ID'),
      AsyncStorage.getItem('AI_REWRITE_LANGUAGE'),
      loadTokens(),
    ]);

    if (!responseStr) {
      return { success: false, message: 'No article data found' };
    }

    const response: AIRewriteUnifiedResponse = JSON.parse(responseStr);
    const selectedLocation: CombinedLocationItem | null = locationStr ? JSON.parse(locationStr) : null;
    const uploadedPhotos: UploadedPhoto[] = photosStr ? JSON.parse(photosStr) : [];

    // Get tenant info from session
    const session = (tokens as any)?.session;
    const tenant = session?.tenant;
    const sessionTenantId = String(tenant?.id || '').trim();
    const finalTenantId = tenantIdStr || sessionTenantId;

    if (!finalTenantId) {
      return { success: false, message: 'Tenant ID not found' };
    }

    // Get category ID from detected category
    const detectedCategory = response.detected_category || response.selected_category?.name || '';
    
    // Fetch categories to find ID
    const categoriesUrl = `/categories/tenant?tenantId=${encodeURIComponent(finalTenantId)}`;
    const categoriesRes = await request<any>(categoriesUrl, { method: 'GET' });
    const categoriesPayload = (categoriesRes as any)?.data ?? categoriesRes;
    const categoriesList = Array.isArray(categoriesPayload?.categories) ? categoriesPayload.categories : [];
    
    const foundCategory = categoriesList.find(
      (cat: any) => 
        cat.nameDefault === detectedCategory || 
        cat.name === detectedCategory || 
        cat.slug === detectedCategory.toLowerCase()
    );

    if (!foundCategory) {
      return { success: false, message: `Category "${detectedCategory}" not found` };
    }

    // Build location object
    const locationResolved: any = {};
    
    if (selectedLocation) {
      if (selectedLocation.village) {
        locationResolved.village = {
          id: selectedLocation.village.id,
          name: selectedLocation.village.name,
        };
      }
      if (selectedLocation.mandal) {
        locationResolved.mandal = {
          id: selectedLocation.mandal.id,
          name: selectedLocation.mandal.name,
        };
      }
      if (selectedLocation.district) {
        locationResolved.district = {
          id: selectedLocation.district.id,
          name: selectedLocation.district.name,
        };
      }
      if (selectedLocation.state) {
        locationResolved.state = {
          id: selectedLocation.state.id,
          name: selectedLocation.state.name,
        };
      }
    }

    // Build media array
    const mediaImages = uploadedPhotos.map((photo) => ({
      url: photo.url,
      caption: photo.caption,
      alt: photo.alt,
    }));

    // Ensure we have at least one location scope for downstream APIs
    const loc = {
      stateId: selectedLocation?.state?.id,
      districtId: selectedLocation?.district?.id,
      mandalId: selectedLocation?.mandal?.id,
      villageId: selectedLocation?.village?.id,
    };
    const hasAnyLoc = !!(loc.stateId || loc.districtId || loc.mandalId || loc.villageId);
    if (!hasAnyLoc) {
      return { success: false, message: 'Please select a location before submitting' };
    }

    // Convert body array to sections for web article
    const webSections = response.web_article.subheads
      ? response.web_article.subheads.map((subhead, index) => ({
          subhead,
          paragraphs: [response.web_article.body[index] || ''],
        }))
      : response.web_article.body.map((para) => ({
          subhead: null,
          paragraphs: [para],
        }));

    // Build complete payload
    const payload: UnifiedArticlePayload = {
      tenantId: finalTenantId,
      domainId: null,
      baseArticle: {
        languageCode: languageCode || 'te',
        newsType: response.print_article.news_type || 'News',
        category: {
          categoryId: foundCategory.id,
          categoryName: detectedCategory,
        },
      },
      location: {
        inputText: response.print_article.dateline.place,
        resolved: locationResolved,
        dateline: {
          placeName: response.print_article.dateline.place,
          date: new Date().toISOString().split('T')[0], // Current date
          formatted: `${response.print_article.dateline.place}, ${response.print_article.dateline.date}`,
        },
      },
      printArticle: {
        headline: response.print_article.headline,
        subtitle: response.print_article.subtitle,
        body: response.print_article.body,
        highlights: response.print_article.highlights,
        responses: response.print_article.responses_or_testimonials,
      },
      webArticle: {
        headline: response.web_article.headline,
        lead: response.web_article.lead,
        sections: webSections,
        seo: {
          slug: response.web_article.seo.url_slug,
          metaTitle: response.web_article.seo.meta_title,
          metaDescription: response.web_article.seo.meta_description,
          keywords: response.web_article.seo.keywords,
        },
      },
      shortNews: {
        h1: response.short_mobile_article.h1,
        h2: response.short_mobile_article.h2,
        content: response.short_mobile_article.body,
      },
      media: {
        images: mediaImages,
      },
      publishControl: {
        publishReady: response.status.publish_ready,
        reason: response.status.validation_issues.join(', ') || '',
      },
    };

    if (__DEV__) {
      try {
        console.log('[unifiedArticle] → /articles/unified payload summary', {
          tenantId: payload.tenantId,
          languageCode: payload.baseArticle.languageCode,
          newsType: payload.baseArticle.newsType,
          categoryId: payload.baseArticle.category.categoryId,
          categoryName: payload.baseArticle.category.categoryName,
          images: payload.media.images.length,
          publishReady: payload.publishControl.publishReady,
        });

        if (DEBUG_FULL) {
          console.log('=== ARTICLES UNIFIED FULL PAYLOAD (copy to Swagger) ===');
          console.log(JSON.stringify(payload, null, 2));
          console.log('=== END ARTICLES UNIFIED FULL PAYLOAD ===');
        }
      } catch {}
    }

    // Submit to unified API (preferred). If backend has a 500, fall back to legacy endpoint.
    let result: any;
    try {
      result = await request<any>('/articles/unified', {
        method: 'POST',
        body: payload,
      });
    } catch (e: any) {
      const isHttp = e instanceof HttpError;
      const status = isHttp ? e.status : 0;
      const details = isHttp ? (e.body?.details || e.body?.message || e.body?.error) : undefined;

      // Backend bug signature we saw: Cannot read properties of undefined (reading 'findFirst')
      const shouldFallback = status === 500;
      if (!shouldFallback) throw e;

      console.warn('[unifiedArticle] /articles/unified failed, falling back to /articles/newspaper', {
        status,
        details,
      });

      const title = String(response.web_article.headline || response.print_article.headline || '').trim();
      const subTitle = response.print_article.subtitle ? String(response.print_article.subtitle).trim() : undefined;
      const lead = String(response.web_article.lead || '').trim() || undefined;
      const dateLine = String(response.print_article.dateline?.place || '').trim() || undefined;

      const paragraphs = Array.isArray(response.web_article.body)
        ? response.web_article.body.map((t) => String(t || '').trim()).filter(Boolean)
        : [];

      const legacy = await createNewspaperArticle({
        languageCode: payload.baseArticle.languageCode,
        categoryId: foundCategory.id,
        title,
        ...(subTitle ? { subTitle } : {}),
        ...(dateLine ? { dateLine } : {}),
        newspaperName: 'Kaburlu today',
        bulletPoints: Array.isArray(response.print_article.highlights) ? response.print_article.highlights.slice(0, 5) : undefined,
        ...(lead ? { lead } : {}),
        ...(paragraphs.length ? { content: paragraphs.map((text) => ({ type: 'paragraph' as const, text })) } : {}),
        ...(mediaImages[0]?.url ? { coverImageUrl: mediaImages[0].url } : {}),
        ...(mediaImages.length ? { images: mediaImages.map((m) => m.url).filter(Boolean) } : {}),
        location: {
          ...(loc.stateId ? { stateId: loc.stateId } : {}),
          ...(loc.districtId ? { districtId: loc.districtId } : {}),
          ...(loc.mandalId ? { mandalId: loc.mandalId } : {}),
          ...(loc.villageId ? { villageId: loc.villageId } : {}),
        },
        status: 'draft',
      });

      if (__DEV__ && DEBUG_FULL) {
        try {
          console.log('=== ARTICLES NEWSPAPER FALLBACK INPUT (copy to Swagger /articles/newspaper) ===');
          console.log(JSON.stringify({
            languageCode: payload.baseArticle.languageCode,
            categoryId: foundCategory.id,
            title,
            subTitle,
            dateLine,
            newspaperName: 'Kaburlu today',
            bulletPoints: Array.isArray(response.print_article.highlights) ? response.print_article.highlights.slice(0, 5) : undefined,
            lead,
            content: paragraphs.map((text) => ({ type: 'paragraph' as const, text })),
            coverImageUrl: mediaImages[0]?.url,
            images: mediaImages.map((m) => m.url).filter(Boolean),
            location: {
              ...(loc.stateId ? { stateId: loc.stateId } : {}),
              ...(loc.districtId ? { districtId: loc.districtId } : {}),
              ...(loc.mandalId ? { mandalId: loc.mandalId } : {}),
              ...(loc.villageId ? { villageId: loc.villageId } : {}),
            },
            status: 'draft',
          }, null, 2));
          console.log('=== END ARTICLES NEWSPAPER FALLBACK INPUT ===');
        } catch {}
      }

      // Shape it like a unified success payload for caller
      result = {
        success: true,
        status: 'DRAFT',
        message: 'Created via fallback endpoint (/articles/newspaper)',
        data: legacy,
      };
    }

    if (result.success) {
      return {
        success: true,
        message: result.message || 'Article created successfully',
        status: result.status,
        data: result.data,
      };
    } else {
      return {
        success: false,
        message: result.message || result.error || 'Failed to create article',
      };
    }
  } catch (error: any) {
    if (error instanceof HttpError) {
      console.error('Submit unified article error:', {
        status: error.status,
        body: error.body,
        message: error.message,
      });
    } else {
      console.error('Submit unified article error:', error);
    }
    return {
      success: false,
      message: error?.message || 'An error occurred while submitting the article',
    };
  }
}
