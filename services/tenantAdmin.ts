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
