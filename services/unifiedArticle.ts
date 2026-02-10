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
  const startTime = Date.now();
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('[PostNews] 🚀 SUBMIT STARTED at', new Date().toISOString());
  console.log('═══════════════════════════════════════════════════════════════');
  
  try {
    const DEBUG_FULL = (() => {
      const raw = String(process.env.EXPO_PUBLIC_HTTP_DEBUG ?? '').toLowerCase();
      return raw === '1' || raw === 'true' || raw === 'on' || raw === 'yes';
    })();

    // Load all stored data
    console.log('[PostNews] 📦 Loading stored data...');
    const [responseStr, locationStr, photosStr, tenantIdStr, languageCode, tokens] = await Promise.all([
      AsyncStorage.getItem('AI_REWRITE_RESPONSE'),
      AsyncStorage.getItem('SELECTED_LOCATION'),
      AsyncStorage.getItem('UPLOADED_PHOTOS'),
      AsyncStorage.getItem('AI_REWRITE_TENANT_ID'),
      AsyncStorage.getItem('AI_REWRITE_LANGUAGE'),
      loadTokens(),
    ]);

    console.log('[PostNews] 📦 Data loaded:', {
      hasResponse: !!responseStr,
      hasLocation: !!locationStr,
      hasPhotos: !!photosStr,
      tenantIdFromStorage: tenantIdStr,
      languageCode,
      hasTokens: !!tokens,
      hasJwt: !!(tokens as any)?.jwt,
    });

    if (!responseStr) {
      console.error('[PostNews] ❌ ERROR: No article data found in storage');
      return { success: false, message: 'No article data found' };
    }

    const response: AIRewriteUnifiedResponse = JSON.parse(responseStr);
    const selectedLocation: CombinedLocationItem | null = locationStr ? JSON.parse(locationStr) : null;
    const uploadedPhotos: UploadedPhoto[] = photosStr ? JSON.parse(photosStr) : [];

    console.log('[PostNews] 📝 AI Response parsed:', {
      detected_category: response.detected_category,
      selected_category: response.selected_category?.name,
      print_headline: response.print_article?.headline?.substring(0, 50) + '...',
      web_headline: response.web_article?.headline?.substring(0, 50) + '...',
      publish_ready: response.status?.publish_ready,
      validation_issues: response.status?.validation_issues,
    });

    console.log('[PostNews] 📍 Location:', selectedLocation ? {
      village: selectedLocation.village?.name,
      mandal: selectedLocation.mandal?.name,
      district: selectedLocation.district?.name,
      state: selectedLocation.state?.name,
    } : 'NO LOCATION SELECTED');

    console.log('[PostNews] 🖼️ Photos:', {
      count: uploadedPhotos.length,
      urls: uploadedPhotos.map(p => p.url?.substring(0, 60) + '...'),
    });

    // Get tenant info from session
    const session = (tokens as any)?.session;
    const tenant = session?.tenant;
    const sessionTenantId = String(tenant?.id || '').trim();
    const finalTenantId = tenantIdStr || sessionTenantId;

    console.log('[PostNews] 🏢 Tenant:', {
      tenantIdFromStorage: tenantIdStr,
      sessionTenantId,
      finalTenantId,
      tenantName: tenant?.name,
    });

    if (!finalTenantId) {
      console.error('[PostNews] ❌ ERROR: Tenant ID not found');
      return { success: false, message: 'Tenant ID not found' };
    }

    // Get category ID from detected category
    const detectedCategory = response.detected_category || response.selected_category?.name || '';
    
    console.log('[PostNews] 📂 Fetching categories for tenant:', finalTenantId);
    
    // Fetch categories to find ID
    const categoriesUrl = `/categories/tenant?tenantId=${encodeURIComponent(finalTenantId)}`;
    const categoriesRes = await request<any>(categoriesUrl, { method: 'GET' });
    const categoriesPayload = (categoriesRes as any)?.data ?? categoriesRes;
    const categoriesList = Array.isArray(categoriesPayload?.categories) ? categoriesPayload.categories : [];
    
    console.log('[PostNews] 📂 Categories fetched:', {
      totalCategories: categoriesList.length,
      lookingFor: detectedCategory,
      availableCategories: categoriesList.slice(0, 10).map((c: any) => c.nameDefault || c.name),
    });
    
    const foundCategory = categoriesList.find(
      (cat: any) => 
        cat.nameDefault === detectedCategory || 
        cat.name === detectedCategory || 
        cat.slug === detectedCategory.toLowerCase()
    );

    if (!foundCategory) {
      console.error('[PostNews] ❌ ERROR: Category not found:', {
        searchedFor: detectedCategory,
        availableCategories: categoriesList.map((c: any) => c.nameDefault || c.name),
      });
      return { success: false, message: `Category "${detectedCategory}" not found` };
    }

    console.log('[PostNews] ✅ Category found:', {
      id: foundCategory.id,
      name: foundCategory.nameDefault || foundCategory.name,
      slug: foundCategory.slug,
    });

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
    
    console.log('[PostNews] 📍 Location IDs:', loc);
    
    if (!hasAnyLoc) {
      console.error('[PostNews] ❌ ERROR: No location selected');
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
          // Add timestamp + random suffix to ensure unique slug
          slug: `${response.web_article.seo.url_slug}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
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

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('[PostNews] 📦 PAYLOAD READY');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('[PostNews] Payload Summary:', {
      tenantId: payload.tenantId,
      languageCode: payload.baseArticle.languageCode,
      newsType: payload.baseArticle.newsType,
      categoryId: payload.baseArticle.category.categoryId,
      categoryName: payload.baseArticle.category.categoryName,
      locationInputText: payload.location.inputText,
      locationResolved: payload.location.resolved,
      printHeadline: payload.printArticle.headline?.substring(0, 50),
      webHeadline: payload.webArticle.headline?.substring(0, 50),
      shortNewsH1: payload.shortNews.h1?.substring(0, 50),
      imagesCount: payload.media.images.length,
      imageUrls: payload.media.images.map(i => i.url?.substring(0, 60)),
      publishReady: payload.publishControl.publishReady,
      validationReason: payload.publishControl.reason,
    });

    console.log('[PostNews] 📋 FULL PAYLOAD (for backend debug):');
    console.log(JSON.stringify(payload, null, 2));
    console.log('═══════════════════════════════════════════════════════════════');

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

    // Submit to unified API (preferred). If backend has 404/500, fall back to legacy endpoint.
    let result: any;
    try {
      console.log('═══════════════════════════════════════════════════════════════');
      console.log('[PostNews] 🌐 Submitting to /articles/unified...');
      console.log('[PostNews] Validating payload before submit:');
      console.log('  ✓ baseArticle:', !!payload.baseArticle);
      console.log('  ✓ baseArticle.languageCode:', payload.baseArticle?.languageCode);
      console.log('  ✓ baseArticle.category.categoryId:', payload.baseArticle?.category?.categoryId);
      console.log('  ✓ location:', !!payload.location);
      console.log('  ✓ location.resolved:', !!payload.location?.resolved);
      console.log('  ✓ location.resolved.state:', !!payload.location?.resolved?.state);
      console.log('  ✓ location.resolved.district:', !!payload.location?.resolved?.district);
      console.log('  ✓ printArticle:', !!payload.printArticle);
      console.log('  ✓ printArticle.headline:', payload.printArticle?.headline?.substring(0, 50));
      console.log('  ✓ printArticle.body length:', payload.printArticle?.body?.length);
      console.log('  ✓ media.images length:', payload.media?.images?.length);
      console.log('═══════════════════════════════════════════════════════════════');
      const submitStartTime = Date.now();
      
      result = await request<any>('/articles/unified', {
        method: 'POST',
        body: payload,
      });
      
      console.log('[PostNews] ✅ /articles/unified SUCCESS:', {
        timeTaken: Date.now() - submitStartTime + 'ms',
        success: result.success,
        status: result.status,
        message: result.message,
        articleId: result.data?.id || result.data?.articleId,
      });
    } catch (e: any) {
      const isHttp = e instanceof HttpError;
      const status = isHttp ? e.status : 0;
      const details = isHttp ? (e.body?.details || e.body?.message || e.body?.error) : undefined;
      const fullBody = isHttp ? e.body : undefined;

      console.error('═══════════════════════════════════════════════════════════════');
      console.error('[PostNews] ❌ /articles/unified FAILED:');
      console.error('[PostNews] HTTP Status:', status);
      console.error('[PostNews] Error Type:', isHttp ? 'HttpError' : 'Other');
      console.error('═══════════════════════════════════════════════════════════════');
      console.error('[PostNews] Error details:', {
        status,
        details,
        message: e?.message,
        isHttpError: isHttp,
      });
      if (fullBody) {
        console.error('[PostNews] Full error body:', JSON.stringify(fullBody, null, 2));
      }
      console.error('[PostNews] Error stack:', e?.stack);
      console.error('═══════════════════════════════════════════════════════════════');

      console.warn('[unifiedArticle] /articles/unified failed:', { status, details, message: e?.message });

      // Fallback to legacy endpoint on 404 (not deployed) or 500 (backend bug)
      // DO NOT fallback on 400 - that means our payload is wrong and we should fix it
      const shouldFallback = status === 404 || status === 500;
      if (!shouldFallback) {
        console.error('[PostNews] ❌ Not falling back - status is', status);
        if (status === 400) {
          console.error('[PostNews] 400 Bad Request - payload validation failed');
          console.error('[PostNews] This indicates a frontend payload structure issue');
          console.error('[PostNews] Check the error details above for which field is missing/invalid');
        }
        console.error('[PostNews] Throwing error instead of falling back');
        throw e;
      }

      console.log('═══════════════════════════════════════════════════════════════');
      console.log('[PostNews] 🔄 Falling back to /articles/newspaper endpoint...');
      console.log('[PostNews] Fallback reason: unified returned', status);
      console.log('═══════════════════════════════════════════════════════════════');
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
        // NOTE: status is NOT sent - it's server-controlled
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
      
      console.log('[PostNews] ✅ Fallback /articles/newspaper SUCCESS:', {
        articleId: legacy?.id || legacy?.articleId,
        status: 'DRAFT',
      });
    }

    const totalTime = Date.now() - startTime;
    
    if (result.success) {
      console.log('═══════════════════════════════════════════════════════════════');
      console.log('[PostNews] 🎉 SUBMIT COMPLETE - SUCCESS');
      console.log('[PostNews] Total time:', totalTime + 'ms');
      console.log('[PostNews] Result:', {
        success: true,
        message: result.message,
        status: result.status,
        articleId: result.data?.id || result.data?.articleId,
      });
      console.log('═══════════════════════════════════════════════════════════════');
      return {
        success: true,
        message: result.message || 'Article created successfully',
        status: result.status,
        data: result.data,
      };
    } else {
      console.error('═══════════════════════════════════════════════════════════════');
      console.error('[PostNews] ❌ SUBMIT COMPLETE - FAILED');
      console.error('[PostNews] Total time:', totalTime + 'ms');
      console.error('[PostNews] Result:', {
        success: false,
        message: result.message || result.error,
      });
      console.error('═══════════════════════════════════════════════════════════════');
      return {
        success: false,
        message: result.message || result.error || 'Failed to create article',
      };
    }
  } catch (error: any) {
    const totalTime = Date.now() - startTime;
    console.error('═══════════════════════════════════════════════════════════════');
    console.error('[PostNews] 💥 EXCEPTION CAUGHT');
    console.error('[PostNews] Total time:', totalTime + 'ms');
    console.error('═══════════════════════════════════════════════════════════════');
    
    if (error instanceof HttpError) {
      console.error('[PostNews] HttpError:', {
        status: error.status,
        message: error.message,
        body: JSON.stringify(error.body, null, 2),
      });
      console.error('Submit unified article error:', {
        status: error.status,
        body: error.body,
        message: error.message,
      });
    } else {
      console.error('[PostNews] Error:', {
        name: error?.name,
        message: error?.message,
        stack: error?.stack,
      });
      console.error('Submit unified article error:', error);
    }
    console.error('═══════════════════════════════════════════════════════════════');
    return {
      success: false,
      message: error?.message || 'An error occurred while submitting the article',
    };
  }
}
