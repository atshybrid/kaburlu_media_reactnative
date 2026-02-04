import { request } from './http';

export type ReporterLevel = 'STATE' | 'DISTRICT' | 'MANDAL' | 'ASSEMBLY' | string | null;

export type ReporterStats = {
  newspaperArticles?: {
    total?: { submitted?: number; published?: number; rejected?: number };
    currentMonth?: { submitted?: number; published?: number; rejected?: number };
  };
  webArticleViews?: { total?: number; currentMonth?: number };
  subscriptionPayment?: {
    currentMonth?: { year?: number; month?: number; status?: string | null };
  };
};

export type ReporterDesignation = {
  id: string;
  tenantId: string | null;
  level: ReporterLevel;
  levelOrder: number;
  code: string;
  name: string;
  nativeName: string;  // Telugu name (e.g., "మండల రిపోర్టర్")
  createdAt: string;
  updatedAt: string;
  updatedAt?: string;
};

export type ReporterLocationRef = { id: string; name: string };

export type TenantReporter = {
  id: string;
  tenantId: string;
  userId: string;
  level: ReporterLevel;
  designationId: string | null;
  stateId: string | null;
  districtId: string | null;
  mandalId: string | null;
  assemblyConstituencyId: string | null;
  subscriptionActive: boolean;
  monthlySubscriptionAmount: number | null;
  idCardCharge: number | null;
  autoPublish?: boolean;
  manualLoginEnabled?: boolean;
  manualLoginDays?: number;
  kycStatus: string;
  kycData?: {
    aadhaarNumber?: string;
    panNumber?: string;
    aadharNumberMasked?: string;
    panNumberMasked?: string;
    workProofUrl?: string;
    verification?: {
      status?: string;
      notes?: string;
      verifiedAadhar?: boolean;
      verifiedPan?: boolean;
      verifiedWorkProof?: boolean;
      verifiedAt?: string;
      verifiedByUserId?: string;
    };
  } | null;
  profilePhotoUrl: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;

  designation: ReporterDesignation | null;
  state: ReporterLocationRef | null;
  district: ReporterLocationRef | null;
  mandal: ReporterLocationRef | null;
  assemblyConstituency: ReporterLocationRef | null;

  fullName: string | null;
  mobileNumber: string | null;
  stats: ReporterStats | null;
};

export type GetTenantReportersParams = {
  active?: boolean;
  level?: Exclude<ReporterLevel, null>;
  stateId?: string;
  districtId?: string;
  mandalId?: string;
};

export type CreateTenantReporterInput = {
  designationId: string;
  level: Exclude<ReporterLevel, null>;

  // Exactly one is required depending on `level`
  stateId?: string;
  districtId?: string;
  assemblyConstituencyId?: string;
  mandalId?: string;

  fullName: string;
  mobileNumber: string;

  subscriptionActive?: boolean;
  monthlySubscriptionAmount?: number;
  idCardCharge?: number;

  manualLoginEnabled?: boolean;
  manualLoginDays?: number;
  autoPublish?: boolean;
};

function toQuery(params: Record<string, any>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    sp.set(k, String(v));
  }
  const qs = sp.toString();
  return qs ? `?${qs}` : '';
}

export async function getTenantReporters(tenantId: string, params: GetTenantReportersParams = {}): Promise<TenantReporter[]> {
  const qs = toQuery({
    active: params.active ?? true,
    level: params.level,
    stateId: params.stateId,
    districtId: params.districtId,
    mandalId: params.mandalId,
  });
  return await request<TenantReporter[]>(`/tenants/${tenantId}/reporters${qs}`);
}

export async function getTenantReporter(tenantId: string, reporterId: string): Promise<TenantReporter> {
  return await request<TenantReporter>(`/tenants/${tenantId}/reporters/${reporterId}`);
}

export async function getReporterDesignations(): Promise<ReporterDesignation[]> {
  return await request<ReporterDesignation[]>(`/reporter-designations`);
}

export async function createTenantReporter(tenantId: string, input: CreateTenantReporterInput): Promise<TenantReporter> {
  return await request<TenantReporter>(`/tenants/${tenantId}/reporters`, {
    method: 'POST',
    body: input,
  });
}

export type ReporterAvailabilityInput = {
  designationId: string;
  level: Exclude<ReporterLevel, null>;

  stateId?: string;
  districtId?: string;
  assemblyConstituencyId?: string;
  mandalId?: string;
};

export type ReporterAvailabilityResponse = {
  available: boolean;
  maxAllowed?: number;
  current?: number;
  designationId?: string;
  level?: Exclude<ReporterLevel, null>;
  location?: { field?: string; id?: string };
  pricing?: {
    subscriptionEnabled?: boolean;
    currency?: string;
    monthlySubscriptionAmount?: number;
    idCardCharge?: number;
  };
  payment?: {
    required?: boolean;
    amount?: number;
    currency?: string;
  };
};

export async function checkPublicReporterAvailability(
  tenantId: string,
  input: ReporterAvailabilityInput,
): Promise<ReporterAvailabilityResponse> {
  return await request<ReporterAvailabilityResponse>(`/public-join/tenants/${tenantId}/reporters/availability`, {
    method: 'POST',
    body: input,
    noAuth: true,
  });
}

export type UpdateReporterAutoPublishResponse = {
  success: boolean;
  reporterId: string;
  tenantId: string;
  autoPublish: boolean;
};

export async function updateReporterAutoPublish(
  tenantId: string,
  reporterId: string,
  autoPublish: boolean,
): Promise<UpdateReporterAutoPublishResponse> {
  return await request<UpdateReporterAutoPublishResponse>(`/tenants/${tenantId}/reporters/${reporterId}/auto-publish`, {
    method: 'PATCH',
    body: { autoPublish },
  });
}

export type GenerateReporterIdCardResponse = {
  success?: boolean;
  reporterId?: string;
  tenantId?: string;
  message?: string;
  url?: string;
  id?: string;
  cardNumber?: string;
  issuedAt?: string;
  expiresAt?: string;
  pdfUrl?: string | null;
  alreadyExists?: boolean;
  whatsappSent?: boolean;
  pdfGenerating?: boolean;
  previousCardNumber?: string;
};

export type RegenerateIdCardInput = {
  keepCardNumber?: boolean;
  reason?: string;
};

export type UpdateIdCardPdfInput = {
  pdfUrl: string;
  sendWhatsApp?: boolean;
};

export type UpdateIdCardPdfResponse = {
  id: string;
  cardNumber: string;
  pdfUrl: string;
  issuedAt: string;
  expiresAt: string;
  whatsappSent?: boolean;
  whatsappMessageId?: string;
  whatsappError?: string | null;
};

export type DeleteIdCardPdfResponse = {
  success: boolean;
  message: string;
};

/* ─────────────────────────────────────────────────────────────────────────────
 * REPORTER Self-Service ID Card APIs (/reporters/me/...)
 * ───────────────────────────────────────────────────────────────────────────── */

/** Get own ID Card (for REPORTER role) */
export async function getMyIdCard(): Promise<ReporterIdCard | null> {
  try {
    return await request<ReporterIdCard>('/reporters/me/id-card', {
      method: 'GET',
    });
  } catch (err: any) {
    if (err?.status === 404) return null;
    throw err;
  }
}

/** Generate own ID Card (for REPORTER role) - First time issue */
export async function generateMyIdCard(): Promise<GenerateReporterIdCardResponse> {
  return await request<GenerateReporterIdCardResponse>('/reporters/me/id-card', {
    method: 'POST',
  });
}

/** Resend own ID Card via WhatsApp (for REPORTER role) - auto-generates PDF if missing */
export async function resendMyIdCardToWhatsApp(): Promise<ResendIdCardWhatsAppResponse> {
  return await request<ResendIdCardWhatsAppResponse>('/reporters/me/id-card/resend', {
    method: 'POST',
  });
}

/** Regenerate own ID Card (for REPORTER role) - new card record optionally */
export async function regenerateMyIdCard(input?: RegenerateIdCardInput): Promise<GenerateReporterIdCardResponse> {
  return await request<GenerateReporterIdCardResponse>('/reporters/me/id-card/regenerate', {
    method: 'POST',
    body: input || { keepCardNumber: true },
  });
}

/* ─────────────────────────────────────────────────────────────────────────────
 * TENANT_ADMIN ID Card Management APIs (/tenants/{tenantId}/reporters/{reporterId}/...)
 * ───────────────────────────────────────────────────────────────────────────── */

export type ReporterIdCard = {
  id: string;
  reporterId: string;
  cardNumber: string;
  issuedAt: string;
  expiresAt: string;
  pdfUrl?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type ResendIdCardWhatsAppResponse = {
  success: boolean;
  message: string;
  messageId?: string;
  sentTo?: string;
};

/** Get reporter's ID card (for TENANT_ADMIN) */
export async function getReporterIdCard(tenantId: string, reporterId: string): Promise<ReporterIdCard | null> {
  try {
    return await request<ReporterIdCard>(`/tenants/${tenantId}/reporters/${reporterId}/id-card`, {
      method: 'GET',
    });
  } catch (err: any) {
    if (err?.status === 404) return null;
    throw err;
  }
}

/** Generate/issue ID card for a reporter (for TENANT_ADMIN) - First time issue */
export async function generateReporterIdCard(tenantId: string, reporterId: string): Promise<GenerateReporterIdCardResponse> {
  return await request<GenerateReporterIdCardResponse>(`/tenants/${tenantId}/reporters/${reporterId}/id-card`, {
    method: 'POST',
  });
}

/** Send ID card via WhatsApp (for TENANT_ADMIN) - auto-generates PDF if missing */
export async function resendIdCardToWhatsApp(tenantId: string, reporterId: string): Promise<ResendIdCardWhatsAppResponse> {
  return await request<ResendIdCardWhatsAppResponse>(`/tenants/${tenantId}/reporters/${reporterId}/id-card/resend`, {
    method: 'POST',
  });
}

/** Regenerate ID card (for TENANT_ADMIN) - full regenerate with new card record optionally */
export async function regenerateReporterIdCard(
  tenantId: string, 
  reporterId: string, 
  input?: RegenerateIdCardInput
): Promise<GenerateReporterIdCardResponse> {
  return await request<GenerateReporterIdCardResponse>(`/tenants/${tenantId}/reporters/${reporterId}/id-card/regenerate`, {
    method: 'POST',
    body: input || { keepCardNumber: true },
  });
}

/** Delete ID card PDF (for TENANT_ADMIN) - clears pdfUrl, next resend will regenerate */
export async function deleteIdCardPdf(tenantId: string, reporterId: string): Promise<DeleteIdCardPdfResponse> {
  return await request<DeleteIdCardPdfResponse>(`/tenants/${tenantId}/reporters/${reporterId}/id-card/pdf`, {
    method: 'DELETE',
  });
}

/** Update ID card PDF URL and optionally send via WhatsApp (for TENANT_ADMIN) */
export async function updateIdCardPdf(
  tenantId: string, 
  reporterId: string, 
  input: UpdateIdCardPdfInput
): Promise<UpdateIdCardPdfResponse> {
  return await request<UpdateIdCardPdfResponse>(`/tenants/${tenantId}/reporters/${reporterId}/id-card/pdf`, {
    method: 'PATCH',
    body: input,
  });
}

export type VerifyReporterKycInput = {
  status: string;
  notes?: string;
  verifiedAadhar?: boolean;
  verifiedPan?: boolean;
  verifiedWorkProof?: boolean;
};

export type VerifyReporterKycResponse = {
  id: string;
  tenantId: string;
  kycStatus: string;
  kycData?: any;
};

export async function verifyReporterKyc(
  tenantId: string,
  reporterId: string,
  input: VerifyReporterKycInput,
): Promise<VerifyReporterKycResponse> {
  return await request<VerifyReporterKycResponse>(`/tenants/${tenantId}/reporters/${reporterId}/kyc/verify`, {
    method: 'PATCH',
    body: input,
  });
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Reporter Dashboard APIs (for logged-in reporters)
 * These use JWT auth and don't require tenantId/reporterId in the URL
 * ───────────────────────────────────────────────────────────────────────────── */

export type ReporterOverviewCard = {
  key: string;
  title: string;
  primary: { label: string; value: string | number | boolean };
  secondary?: Array<{ label: string; value: string | number | boolean }>;
  drilldown?: { href: string };
};

export type ReporterOverviewResponse = {
  kind: 'reporter_overview';
  tenant: {
    id: string;
    name: string;
    slug?: string;
  };
  reporter: {
    id: string;
    tenantId: string;
    designation?: { id: string; code: string; name: string; level?: string };
    level?: string;
    active: boolean;
    kycStatus: string;
    subscriptionActive: boolean;
    monthlySubscriptionAmount?: number;
  };
  cards: ReporterOverviewCard[];
  generatedAt: string;
};

export async function getReporterDashboardOverview(): Promise<ReporterOverviewResponse> {
  return await request<ReporterOverviewResponse>('/dashboard/reporter/overview');
}

export type MyProfileResponse = {
  reporter: {
    id: string;
    tenantId: string;
    userId: string;
    designation?: { id: string; code: string; name: string; level?: string };
    level?: string;
    active: boolean;
    kycStatus: string | null;
    subscriptionActive: boolean;
    monthlySubscriptionAmount?: number;
    idCardCharge?: number;
    fullName?: string;
    mobileNumber?: string;
    profilePhotoUrl?: string;
    autoPublish?: boolean;
    stateId?: string;
    districtId?: string;
    mandalId?: string;
    assemblyConstituencyId?: string;
    state?: { id: string; name: string };
    district?: { id: string; name: string };
    mandal?: { id: string; name: string };
    tenant?: { id: string; name: string; slug?: string };
  };
};

export async function getMyProfile(): Promise<MyProfileResponse> {
  return await request<MyProfileResponse>('/dashboard/my/profile');
}

/* ─────────────────────────────────────────────────────────────────────────────
 * GET /reporters/me - Current Reporter Full Profile with Stats
 * ───────────────────────────────────────────────────────────────────────────── */

export type ReporterMeResponse = {
  id: string;
  tenantId: string;
  userId: string;
  level: ReporterLevel;
  designationId: string | null;
  stateId: string | null;
  districtId: string | null;
  mandalId: string | null;
  assemblyConstituencyId: string | null;
  subscriptionActive: boolean;
  monthlySubscriptionAmount: number | null;
  idCardCharge: number | null;
  kycStatus: string | null;
  kycData: {
    documents?: {
      panNumberMasked?: string;
      aadharNumberMasked?: string;
    };
    submittedAt?: string;
  } | null;
  profilePhotoUrl: string | null;
  manualLoginEnabled: boolean;
  manualLoginDays: number | null;
  manualLoginActivatedAt: string | null;
  manualLoginExpiresAt: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  autoPublish: boolean;
  fullName: string | null;
  mobileNumber: string | null;

  designation: ReporterDesignation | null;
  state: ReporterLocationRef | null;
  district: ReporterLocationRef | null;
  mandal: ReporterLocationRef | null;
  assemblyConstituency: ReporterLocationRef | null;
  idCard: {
    id: string;
    cardNumber: string;
    issuedAt: string;
    expiresAt: string;
    status: string;
    pdfUrl?: string;
  } | null;

  stats: ReporterStats | null;

  // Access Control - for overlay screens
  accessStatus?: {
    status: 'ACTIVE' | 'PAYMENT_REQUIRED' | 'ACCESS_EXPIRED';
    reason?: string;
    action: 'NONE' | 'PAY' | 'CONTACT_PUBLISHER';
  };

  // Payment details when payment required
  paymentStatus?: {
    required: boolean;
    outstanding?: Array<{
      type: 'ONBOARDING' | 'MONTHLY_SUBSCRIPTION';
      amount: number;
      currency: string;
      year: number;
      month: number;
      status: string;
      paymentId?: string;
      razorpayOrderId?: string;
    }>;
    razorpay?: {
      orderId?: string;
      amount?: number;
      currency?: string;
    };
  };

  // Manual login status
  manualLoginStatus?: {
    enabled: boolean;
    expiresAt?: string;
    daysRemaining?: number;
    expired: boolean;
    publisherContact?: {
      name?: string;
      phone?: string;
      message?: string;
    };
  };
};

/** Get current reporter's full profile with stats */
export async function getReporterMe(): Promise<ReporterMeResponse> {
  return await request<ReporterMeResponse>('/reporters/me');
}

export type MyIdCardDashboardResponse = {
  reporterId: string;
  tenantId: string;
  idCard: {
    id: string;
    cardNumber: string;
    issuedAt: string;
    expiresAt: string;
    status: string;
    pdfUrl?: string;
  } | null;
};

/** Get ID card info from dashboard (includes additional context) */
export async function getMyIdCardDashboard(): Promise<MyIdCardDashboardResponse> {
  return await request<MyIdCardDashboardResponse>('/dashboard/my/id-card');
}

export type MyPaymentItem = {
  id: string;
  amount: number;
  status: string;
  dueDate?: string;
  createdAt: string;
};

export type MyPaymentsResponse = {
  reporterId: string;
  tenantId: string;
  count: number;
  items: MyPaymentItem[];
};

export async function getMyPayments(status?: string, take = 50): Promise<MyPaymentsResponse> {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  params.set('take', String(take));
  const qs = params.toString();
  return await request<MyPaymentsResponse>(`/dashboard/my/payments${qs ? `?${qs}` : ''}`);
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Reporter KYC APIs
 * ───────────────────────────────────────────────────────────────────────────── */

export type SubmitReporterKycInput = {
  aadharNumberMasked?: string;
  panNumberMasked?: string;
  workProofUrl?: string;
};

export type SubmitReporterKycResponse = {
  id: string;
  tenantId: string;
  kycStatus: string;
  kycData?: {
    documents?: {
      aadharNumberMasked?: string;
      panNumberMasked?: string;
      workProofUrl?: string;
    };
    submittedAt?: string;
  };
};

/** Reporter submits their own KYC documents */
export async function submitReporterKyc(
  tenantId: string,
  reporterId: string,
  input: SubmitReporterKycInput,
): Promise<SubmitReporterKycResponse> {
  return await request<SubmitReporterKycResponse>(`/tenants/${tenantId}/reporters/${reporterId}/kyc`, {
    method: 'POST',
    body: input,
  });
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Reporter Profile Photo APIs
 * ───────────────────────────────────────────────────────────────────────────── */

export type UpdateProfilePhotoResponse = {
  id: string;
  tenantId: string;
  profilePhotoUrl: string | null;
};

/** Reporter updates their own profile photo */
export async function updateReporterProfilePhoto(
  tenantId: string,
  reporterId: string,
  profilePhotoUrl: string,
): Promise<UpdateProfilePhotoResponse> {
  return await request<UpdateProfilePhotoResponse>(`/tenants/${tenantId}/reporters/${reporterId}/profile-photo`, {
    method: 'PATCH',
    body: { profilePhotoUrl },
  });
}

/** Reporter deletes their own profile photo */
export async function deleteReporterProfilePhoto(
  tenantId: string,
  reporterId: string,
): Promise<UpdateProfilePhotoResponse> {
  return await request<UpdateProfilePhotoResponse>(`/tenants/${tenantId}/reporters/${reporterId}/profile-photo`, {
    method: 'DELETE',
  });
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Tenant Admin - Reporter Management APIs
 * ───────────────────────────────────────────────────────────────────────────── */

export type UpdateTenantReporterInput = {
  designationId?: string;
  level?: Exclude<ReporterLevel, null>;
  stateId?: string;
  districtId?: string;
  mandalId?: string;
  assemblyConstituencyId?: string;
  active?: boolean;
  subscriptionActive?: boolean;
  monthlySubscriptionAmount?: number;
  idCardCharge?: number;
  manualLoginEnabled?: boolean;
  manualLoginDays?: number;
  autoPublish?: boolean;
};

/** Admin updates a reporter's details */
export async function updateTenantReporter(
  tenantId: string,
  reporterId: string,
  input: UpdateTenantReporterInput,
): Promise<TenantReporter> {
  return await request<TenantReporter>(`/tenants/${tenantId}/reporters/${reporterId}`, {
    method: 'PUT',
    body: input,
  });
}

export type ToggleLoginAccessResponse = {
  id: string;
  tenantId: string;
  manualLoginEnabled: boolean;
};

/** Admin toggles a reporter's login access */
export async function toggleReporterLoginAccess(
  tenantId: string,
  reporterId: string,
  loginEnabled: boolean,
): Promise<ToggleLoginAccessResponse> {
  return await request<ToggleLoginAccessResponse>(`/tenants/${tenantId}/reporters/${reporterId}/login-access`, {
    method: 'PATCH',
    body: { loginEnabled },
  });
}

export type GenerateIdCardWithExpiryInput = {
  expiresAt?: string;
};

/** Admin generates ID card for a reporter (KYC must be APPROVED) */
export async function generateReporterIdCardWithExpiry(
  tenantId: string,
  reporterId: string,
  input?: GenerateIdCardWithExpiryInput,
): Promise<GenerateReporterIdCardResponse> {
  return await request<GenerateReporterIdCardResponse>(`/tenants/${tenantId}/reporters/${reporterId}/id-card`, {
    method: 'POST',
    body: input || {},
  });
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Reporter Dashboard - My Newspaper Articles
 * GET /api/v1/dashboard/my/newspaper-articles
 * ───────────────────────────────────────────────────────────────────────────── */

export type NewspaperArticleStatus = 'DRAFT' | 'PENDING' | 'PUBLISHED' | 'ARCHIVED' | 'REJECTED';

export type NewspaperArticleWebArticle = {
  id: string;
  slug: string;
  status: string;
  url?: string;
  languageCode?: string;
  title?: string;
  viewCount?: number;
  publishedAt?: string;
};

export type MyNewspaperArticle = {
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
  // Additional image fallbacks
  imageUrl?: string;
  coverImage?: string;
  thumbnailUrl?: string;
  sportLink?: string;
  sportLinkDomain?: string;
  sportLinkSlug?: string;
  webArticleId?: string;
  webArticleStatus?: string;
  webArticleUrl?: string;
  webArticleViewCount?: number;
  webArticle?: NewspaperArticleWebArticle;
  // BaseArticle for detailed responses
  baseArticle?: {
    contentJson?: {
      raw?: {
        coverImageUrl?: string;
        images?: string[];
      };
    };
  };
};

export type MyNewspaperArticlesResponse = {
  data: MyNewspaperArticle[];
  nextCursor?: string | null;
  total?: number;
};

export type GetMyNewspaperArticlesParams = {
  status?: NewspaperArticleStatus;
  limit?: number;
  cursor?: string;
};

/** Get reporter's own newspaper articles with pagination and status filter */
export async function getMyNewspaperArticles(
  params: GetMyNewspaperArticlesParams = {},
): Promise<MyNewspaperArticlesResponse> {
  const sp = new URLSearchParams();
  if (params.status) sp.set('status', params.status);
  if (params.limit) sp.set('limit', String(params.limit));
  if (params.cursor) sp.set('cursor', String(params.cursor));
  const qs = sp.toString();
  return await request<MyNewspaperArticlesResponse>(`/dashboard/my/newspaper-articles${qs ? `?${qs}` : ''}`);
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Reporter Dashboard - My Web Articles
 * GET /api/v1/dashboard/my/web-articles
 * ───────────────────────────────────────────────────────────────────────────── */

export type MyWebArticle = {
  id: string;
  tenantId: string;
  authorId: string;
  slug: string;
  title: string;
  status: string;
  url?: string;
  viewCount?: number;
  publishedAt?: string;
  createdAt: string;
  coverImageUrl?: string;
  category?: { id: string; name: string };
};

export type MyWebArticlesResponse = {
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  data: MyWebArticle[];
};

export type GetMyWebArticlesParams = {
  status?: string;
  page?: number;
  pageSize?: number;
};

/** Get reporter's own web articles with pagination and status filter */
export async function getMyWebArticles(
  params: GetMyWebArticlesParams = {},
): Promise<MyWebArticlesResponse> {
  const sp = new URLSearchParams();
  if (params.status) sp.set('status', params.status);
  if (params.page) sp.set('page', String(params.page));
  if (params.pageSize) sp.set('pageSize', String(params.pageSize));
  const qs = sp.toString();
  return await request<MyWebArticlesResponse>(`/dashboard/my/web-articles${qs ? `?${qs}` : ''}`);
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Newspaper Article CRUD Operations
 * GET/PUT/DELETE /api/v1/articles/newspaper/{articleId}
 * ───────────────────────────────────────────────────────────────────────────── */

export type NewspaperArticleBaseArticle = {
  contentJson?: {
    raw?: {
      title?: string;
      images?: string[];
      content?: string;
      dateline?: string;
      domainId?: string;
      categoryIds?: string[];
      locationRef?: {
        city?: string;
        address?: string;
        placeId?: string;
        stateId?: string;
        mandalId?: string;
        stateName?: string;
        villageId?: string;
        districtId?: string;
        mandalName?: string;
        displayName?: string;
        villageName?: string;
        districtName?: string;
      };
      bulletPoints?: string[];
      languageCode?: string;
      coverImageUrl?: string;
    };
    web?: {
      meta?: { seoTitle?: string; metaDescription?: string };
      slug?: string;
      tags?: string[];
      title?: string;
      subtitle?: string;
      plainText?: string;
      contentHtml?: string;
      categories?: string[];
    };
  };
  viewCount?: number;
};

export type NewspaperArticleDetail = {
  id: string;
  tenantId: string;
  authorId: string;
  languageId?: string;
  categoryId?: string;
  baseArticleId?: string;
  title: string;
  subTitle?: string;
  lead?: string;
  heading?: string;
  points?: string[];
  dateline?: string;
  content?: string;
  stateId?: string;
  districtId?: string;
  mandalId?: string;
  villageId?: string;
  placeName?: string;
  status: NewspaperArticleStatus;
  createdAt: string;
  updatedAt?: string;
  baseArticle?: NewspaperArticleBaseArticle;
  webArticle?: NewspaperArticleWebArticle;
  webArticleId?: string;
  webArticleStatus?: string;
  webArticleUrl?: string;
  webArticleViewCount?: number;
  viewCount?: number;
  sportLink?: string;
  sportLinkDomain?: string;
  sportLinkSlug?: string;
};

/**
 * Get a single newspaper article by ID
 * GET /api/v1/articles/newspaper/{articleId}
 */
export async function getNewspaperArticleById(
  articleId: string,
): Promise<NewspaperArticleDetail> {
  return await request<NewspaperArticleDetail>(`/articles/newspaper/${articleId}`);
}

export type UpdateNewspaperArticlePayload = {
  title?: string;
  subTitle?: string;
  content?: string;
  lead?: string;
  heading?: string;
  points?: string[];
  categoryId?: string;
  status?: NewspaperArticleStatus;
};

export type UpdateNewspaperArticleResponse = {
  id: string;
  tenantId: string;
  title: string;
  subTitle?: string;
  status: NewspaperArticleStatus;
  updatedAt: string;
};

/**
 * Update a newspaper article
 * PUT /api/v1/articles/newspaper/{articleId}
 */
export async function updateNewspaperArticle(
  articleId: string,
  payload: UpdateNewspaperArticlePayload,
): Promise<UpdateNewspaperArticleResponse> {
  return await request<UpdateNewspaperArticleResponse>(`/articles/newspaper/${articleId}`, {
    method: 'PUT',
    body: payload,
  });
}

export type DeleteNewspaperArticleResponse = {
  success: boolean;
  message?: string;
};

/**
 * Delete a newspaper article
 * DELETE /api/v1/articles/newspaper/{articleId}
 */
export async function deleteNewspaperArticle(
  articleId: string,
): Promise<DeleteNewspaperArticleResponse> {
  return await request<DeleteNewspaperArticleResponse>(`/articles/newspaper/${articleId}`, {
    method: 'DELETE',
  });
}


