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
  name: string;
  code?: string;
  level?: ReporterLevel;
  tenantId?: string | null;
  createdAt?: string;
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
};

export async function generateReporterIdCard(tenantId: string, reporterId: string): Promise<GenerateReporterIdCardResponse> {
  return await request<GenerateReporterIdCardResponse>(`/tenants/${tenantId}/reporters/${reporterId}/id-card`, {
    method: 'POST',
  });
}

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

export async function getReporterIdCard(tenantId: string, reporterId: string): Promise<ReporterIdCard> {
  return await request<ReporterIdCard>(`/tenants/${tenantId}/reporters/${reporterId}/id-card`, {
    method: 'GET',
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
