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
