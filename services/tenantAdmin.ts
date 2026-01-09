import { request } from './http';

// --- Auth ---

export type TenantAdminRole = 'TENANT_ADMIN' | string;

export type TenantAdminAuthUser = {
  userId: string;
  role: TenantAdminRole;
  languageId?: string;
};

export type TenantAdminLoginResponse = {
  success: boolean;
  message?: string;
  data: {
    jwt: string;
    refreshToken: string;
    expiresIn?: number;
    expiresAt?: number;
    user: TenantAdminAuthUser;
    // Tenant-scoped extras (present for TENANT_* roles)
    tenantId?: string;
    domainId?: string;
    tenant?: { id: string; name: string; slug?: string };
    domain?: { id: string; domain: string; isPrimary?: boolean; status?: string };
    domainSettings?: {
      id?: string;
      data?: {
        seo?: { ogImageUrl?: string };
        theme?: { colors?: { primary?: string; secondary?: string; accent?: string } };
        branding?: { logoUrl?: string };
      };
      updatedAt?: string;
    };
  };
};

export async function tenantAdminLogin(payload: { mobileNumber: string; mpin: string }) {
  // Same endpoint as regular login; exposed here as a dedicated module for Tenant Admin flows.
  const res = await request<TenantAdminLoginResponse>('/auth/login', {
    method: 'POST',
    body: payload,
    noAuth: true,
  });
  return res;
}

// --- Dashboard ---

export type TenantAdminOverviewCard = {
  key: string;
  title: string;
  primary: { label: string; value: number };
  secondary: { label: string; value: number }[];
  drilldown?: { href: string };
};

export type TenantAdminOverviewResponse = {
  kind: 'tenant_admin_overview' | string;
  tenant: { id: string; name: string; slug: string };
  cards: TenantAdminOverviewCard[];
  generatedAt?: string;
};

export async function getTenantAdminOverview(): Promise<TenantAdminOverviewResponse> {
  return await request<TenantAdminOverviewResponse>('/dashboard/admin/overview');
}

// --- Full Dashboard (v2) ---

export type TenantAdminProfile = {
  userId: string;
  reporterId: string;
  designation: { id: string; code: string; name: string };
  level: string;
  active: boolean;
  kycStatus: string;
};

export type TenantEntity = {
  registrationTitle?: string;
  nativeName?: string;
  periodicity?: string;
  ownerName?: string;
  publisherName?: string;
  editorName?: string;
  address?: string;
};

export type TenantInfo = {
  id: string;
  name: string;
  slug: string;
  prgiNumber?: string;
  prgiStatus?: string;
  stateId?: string;
  createdAt?: string;
  entity?: TenantEntity;
};

export type TenantBranding = {
  logoUrl?: string;
  faviconUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  headerHtml?: string | null;
};

export type TenantDomain = {
  id: string;
  domain: string;
  isPrimary: boolean;
  kind: 'NEWS' | 'EPAPER' | string;
  status: string;
};

export type TenantDomains = {
  total: number;
  active: number;
  pending: number;
  primary?: TenantDomain;
  list: TenantDomain[];
};

export type ReporterSummary = {
  id: string;
  level: string;
  kycStatus: string;
  active: boolean;
  createdAt?: string;
  user?: { mobileNumber?: string };
  designation?: { code: string; name: string };
};

export type TenantReporters = {
  total: number;
  active: number;
  inactive: number;
  kyc: { pending: number; submitted: number; approved: number; rejected: number };
  byLevel: { STATE?: number; DISTRICT?: number; MANDAL?: number; ASSEMBLY?: number };
  recentlyAdded?: ReporterSummary[];
};

export type ArticlePreview = {
  id: string;
  title: string;
  slug: string;
  viewCount?: number;
  publishedAt?: string;
};

export type TenantArticles = {
  web: {
    byStatus: { DRAFT?: number; PENDING?: number; PUBLISHED?: number; REJECTED?: number };
    published7d: number;
    published30d: number;
    totalViews: number;
    topViewed?: ArticlePreview[];
  };
  newspaper: {
    byStatus: { DRAFT?: number; PUBLISHED?: number };
    created30d: number;
  };
  raw: {
    newSubmissions: number;
    pendingReview: number;
  };
};

export type PaymentSummary = {
  id: string;
  status: string;
  amountMinor: number;
  mobile?: string;
  createdAt?: string;
};

export type TenantPayments = {
  pending: number;
  paid30d: number;
  revenue30d: number;
  recentPayments?: PaymentSummary[];
};

export type IdCardSettings = {
  templateId?: string;
  validityType?: string;
  validityDays?: number;
  idPrefix?: string;
  idDigits?: number;
};

export type TenantIdCards = {
  issued: number;
  issuedThisMonth: number;
  expiring30d: number;
  settings?: IdCardSettings;
};

export type SubscriptionPlan = {
  id: string;
  name: string;
  cycle: string;
  baseAmountMinor: number;
};

export type TenantSubscription = {
  id: string;
  status: string;
  plan?: SubscriptionPlan;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
};

export type TenantBilling = {
  subscription?: TenantSubscription;
  hasActiveSubscription: boolean;
};

export type TenantAiUsage = {
  eventsThisMonth: number;
  tokensThisMonth: number;
  limitThisMonth: number;
  limitReached: boolean;
};

export type TenantFeatureFlags = {
  enableMobileAppView?: boolean;
  aiArticleRewriteEnabled?: boolean;
  aiBillingEnabled?: boolean;
  aiMonthlyTokenLimit?: number;
};

export type QuickAction = {
  key: string;
  label: string;
  href: string;
  priority: 'high' | 'medium' | 'low';
};

export type RecentActivityItem = {
  type: 'article' | 'payment' | 'kyc' | string;
  id: string;
  title?: string;
  status?: string;
  amountMinor?: number;
  authorMobile?: string;
  reporterMobile?: string;
  at: string;
};

export type TenantAdminFullResponse = {
  kind: 'tenant_admin_full' | string;
  profile: TenantAdminProfile;
  tenant: TenantInfo;
  branding: TenantBranding;
  domains: TenantDomains;
  reporters: TenantReporters;
  articles: TenantArticles;
  payments: TenantPayments;
  idCards: TenantIdCards;
  billing: TenantBilling;
  aiUsage: TenantAiUsage;
  featureFlags: TenantFeatureFlags;
  ads?: { configured: number; list?: unknown[] };
  quickActions: QuickAction[];
  recentActivity: RecentActivityItem[];
  generatedAt?: string;
};

export async function getTenantAdminDashboard(): Promise<TenantAdminFullResponse> {
  return await request<TenantAdminFullResponse>('/dashboard/admin/full');
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Newspaper Article Approval APIs
 * For TENANT_ADMIN and TENANT_EDITOR roles
 * ───────────────────────────────────────────────────────────────────────────── */

export type NewspaperArticleStatus = 'DRAFT' | 'PENDING' | 'PUBLISHED' | 'REJECTED' | 'ARCHIVED';

export type NewspaperArticleAuthor = {
  id: string;
  profile?: {
    fullName?: string;
    profilePhotoUrl?: string;
  };
  mobileNumber?: string;
};

export type NewspaperArticleCategory = {
  id: string;
  name: string;
  slug?: string;
};

export type NewspaperArticleLanguage = {
  id: string;
  name: string;
  code: string;
};

export type NewspaperArticleWebArticle = {
  id: string;
  slug?: string;
  status?: string;
  url?: string;
  languageCode?: string;
  title?: string;
  viewCount?: number;
  publishedAt?: string | null;
};

export type NewspaperArticleBaseArticle = {
  contentJson?: unknown;
  viewCount?: number;
};

export type NewspaperArticle = {
  id: string;
  tenantId: string;
  authorId: string;
  baseArticleId?: string;
  categoryId?: string;
  languageId?: string;
  title: string;
  subTitle?: string;
  lead?: string;
  heading?: string;
  points?: string[];
  dateline?: string;
  placeName?: string;
  content?: string;
  status: NewspaperArticleStatus;
  createdAt: string;
  updatedAt?: string;
  viewCount?: number;
  coverImageUrl?: string;
  // Location IDs
  stateId?: string;
  districtId?: string;
  mandalId?: string;
  villageId?: string;
  // Sport link (live website URL)
  sportLink?: string;
  sportLinkDomain?: string;
  sportLinkSlug?: string;
  // Web article (linked website article)
  webArticle?: NewspaperArticleWebArticle;
  webArticleId?: string;
  webArticleStatus?: string;
  webArticleUrl?: string;
  webArticleViewCount?: number;
  // Relations
  author?: NewspaperArticleAuthor;
  baseArticle?: NewspaperArticleBaseArticle;
  category?: NewspaperArticleCategory;
  language?: NewspaperArticleLanguage;
};

export type NewspaperArticlesResponse = {
  total: number;
  items: NewspaperArticle[];
  nextCursor?: string | null;
};

export type GetNewspaperArticlesParams = {
  status?: NewspaperArticleStatus;
  limit?: number;
  cursor?: string;
  authorId?: string;
  categoryId?: string;
  languageId?: string;
  search?: string;
};

/**
 * Get newspaper articles for tenant admin/editor review
 * GET /api/v1/articles/newspaper
 */
export async function getNewspaperArticles(
  params: GetNewspaperArticlesParams = {},
): Promise<NewspaperArticlesResponse> {
  const sp = new URLSearchParams();
  if (params.status) sp.set('status', params.status);
  if (params.limit) sp.set('limit', String(params.limit));
  if (params.cursor) sp.set('cursor', String(params.cursor));
  if (params.authorId) sp.set('authorId', params.authorId);
  if (params.categoryId) sp.set('categoryId', params.categoryId);
  if (params.languageId) sp.set('languageId', params.languageId);
  if (params.search) sp.set('search', params.search);
  const qs = sp.toString();
  return await request<NewspaperArticlesResponse>(`/articles/newspaper${qs ? `?${qs}` : ''}`);
}

/**
 * Tenant dashboard list endpoint (cursor pagination)
 * GET /api/v1/dashboard/tenants/{tenantId}/newspaper-articles
 */
export async function getTenantDashboardNewspaperArticles(
  tenantId: string,
  params: GetNewspaperArticlesParams = {},
): Promise<NewspaperArticlesResponse> {
  const sp = new URLSearchParams();
  if (params.status) sp.set('status', params.status);
  if (params.limit) sp.set('limit', String(params.limit));
  if (params.cursor) sp.set('cursor', String(params.cursor));
  if (params.authorId) sp.set('authorId', params.authorId);
  if (params.categoryId) sp.set('categoryId', params.categoryId);
  if (params.languageId) sp.set('languageId', params.languageId);
  if (params.search) sp.set('search', params.search);
  const qs = sp.toString();
  return await request<NewspaperArticlesResponse>(`/dashboard/tenants/${encodeURIComponent(tenantId)}/newspaper-articles${qs ? `?${qs}` : ''}`);
}

/**
 * Get a single newspaper article by ID
 * GET /api/v1/articles/newspaper/{articleId}
 */
export async function getNewspaperArticle(articleId: string): Promise<NewspaperArticle> {
  return await request<NewspaperArticle>(`/articles/newspaper/${articleId}`);
}

export type UpdateNewspaperArticlePayload = {
  status?: NewspaperArticleStatus;
  title?: string;
  subTitle?: string;
  content?: string;
  categoryId?: string;
  // Add other editable fields as needed
};

export type UpdateNewspaperArticleResponse = {
  id: string;
  tenantId: string;
  title: string;
  status: NewspaperArticleStatus;
  updatedAt: string;
};

/**
 * Update newspaper article (approve/reject/edit)
 * PATCH /api/v1/articles/newspaper/{articleId}
 */
export async function updateNewspaperArticle(
  articleId: string,
  payload: UpdateNewspaperArticlePayload,
): Promise<UpdateNewspaperArticleResponse> {
  return await request<UpdateNewspaperArticleResponse>(`/articles/newspaper/${articleId}`, {
    method: 'PATCH',
    body: payload,
  });
}

/**
 * Approve a newspaper article (set status to PUBLISHED)
 */
export async function approveNewspaperArticle(
  articleId: string,
): Promise<UpdateNewspaperArticleResponse> {
  return updateNewspaperArticle(articleId, { status: 'PUBLISHED' });
}

/**
 * Reject a newspaper article (set status to REJECTED)
 */
export async function rejectNewspaperArticle(
  articleId: string,
): Promise<UpdateNewspaperArticleResponse> {
  return updateNewspaperArticle(articleId, { status: 'REJECTED' });
}
