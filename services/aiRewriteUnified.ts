import { request } from './http';

export type LanguageInfo = {
  code: string;
  name: string;
  script: string;
  region?: string | null;
};

export type DatelineInfo = {
  place: string;
  date: string;
  newspaper: string;
};

export type PrintArticle = {
  news_type: string;
  headline: string;
  subtitle: string | null;
  dateline: DatelineInfo;
  body: string[];
  highlights: string[] | null;
  fact_box: string | null;
  responses_or_testimonials: string[] | null;
  editor_note: string | null;
};

export type WebArticle = {
  headline: string;
  dateline: string;
  lead: string;
  body: string[];
  subheads: string[] | null;
  seo: {
    url_slug: string;
    meta_title: string;
    meta_description: string;
    keywords: string[];
    image_alt: string;
  };
};

export type ShortMobileArticle = {
  h1: string;
  h2: string | null;
  body: string;
};

export type MediaPhoto = {
  id: string;
  photo_type: string;
  scene: string;
  usage: string[];
  mandatory: boolean;
  caption_suggestion: Record<string, string>;
  alt_suggestion: Record<string, string>;
};

export type MediaRequirements = {
  must_photos: MediaPhoto[];
  support_photos: MediaPhoto[];
};

export type SelectedCategory = {
  name: string;
  ai_detected: string;
  match_type: string;
};

export type AIRewriteUnifiedResponse = {
  detected_category: string;
  print_article: PrintArticle;
  web_article: WebArticle;
  short_mobile_article: ShortMobileArticle;
  media_requirements: MediaRequirements;
  internal_evidence: {
    required_items: string[];
    completion_percentage: number;
  };
  status: {
    publish_ready: boolean;
    validation_issues: string[];
    approval_status: string;
  };
  selected_category: SelectedCategory;
};

export type AIRewriteUnifiedRequest = {
  rawText: string;
  categories: string[];
  newspaperName: string;
  language: LanguageInfo;
  temperature?: number;
  model?: string;
};

export async function aiRewriteUnified(
  params: AIRewriteUnifiedRequest
): Promise<AIRewriteUnifiedResponse> {
  // Sanitize rawText if it has escaped characters from clipboard/editor
  const cleanText = String(params.rawText || '')
    .replace(/^"+|"+$/g, '')   // remove outer quotes
    .replace(/\\"/g, '"')      // unescape quotes
    .replace(/\\n/g, '\n');    // real newlines

  const payload = {
    rawText: cleanText, // pass directly, fetch will handle JSON encoding
    categories: params.categories,
    newspaperName: params.newspaperName,
    language: params.language,
    temperature: params.temperature ?? 0.2,
    model: params.model ?? '4o mini',  // Match swagger model name
  };

  // Debug checks
  console.log('=== AI REWRITE UNIFIED DEBUG ===');
  console.log('rawText type:', typeof payload.rawText);
  console.log('rawText starts with quote?', payload.rawText.startsWith('"'));
  console.log('rawText has escaped newlines?', payload.rawText.includes('\\n'));
  console.log('rawText preview (first 100 chars):', payload.rawText.substring(0, 100));
  console.log('=== FULL PAYLOAD ===');
  console.log(JSON.stringify(payload, null, 2));
  console.log('=== END PAYLOAD ===');

  const response = await request<AIRewriteUnifiedResponse>('/ai/rewrite/unified?debug=true', {
    method: 'POST',
    body: payload,
  });

  return response;
}

/**
 * Get category nameDefault values for AI API
 * Fetches categories from tenant and extracts nameDefault field
 */
export async function getCategoryNamesForAI(tenantId: string, domainId?: string): Promise<string[]> {
  try {
    const params = new URLSearchParams();
    params.set('tenantId', tenantId);
    if (domainId) params.set('domainId', domainId);
    
    const url = `/categories/tenant?${params.toString()}`;
    console.log('[getCategoryNamesForAI] URL:', url);
    
    const res = await request<any>(url, { method: 'GET' });
    
    const payload = (res as any)?.data ?? res;
    const categories = Array.isArray(payload?.categories) ? payload.categories : [];
    
    console.log('[getCategoryNamesForAI] Categories count:', categories.length);
    console.log('[getCategoryNamesForAI] First category:', JSON.stringify(categories[0], null, 2));
    
    // Extract nameDefault from each category (including children)
    const nameDefaults: string[] = [];
    
    for (const cat of categories) {
      const nameDefault = String(cat?.nameDefault || cat?.slug || '').trim();
      if (nameDefault) {
        nameDefaults.push(nameDefault);
      }
      
      // Add children's nameDefault
      if (Array.isArray(cat?.children)) {
        for (const child of cat.children) {
          const childNameDefault = String(child?.nameDefault || child?.slug || '').trim();
          if (childNameDefault) {
            nameDefaults.push(childNameDefault);
          }
        }
      }
    }
    
    console.log('[getCategoryNamesForAI] Extracted names:', JSON.stringify(nameDefaults, null, 2));
    
    return nameDefaults.filter(Boolean);
  } catch (error) {
    console.error('Failed to get category names:', error);
    return [];
  }
}

