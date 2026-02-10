/**
 * ID Card Helper - Role-based API calls wrapper
 * 
 * Simplifies ID card operations based on user role:
 * - TENANT_ADMIN: Uses /tenants/{tenantId}/reporters/{reporterId}/... endpoints
 * - REPORTER: Uses /reporters/me/... endpoints
 * 
 * Usage:
 * ```ts
 * const helper = new IdCardHelper(role, tenantId);
 * 
 * // Get ID card
 * const card = await helper.getIdCard(reporterId);
 * 
 * // Issue new ID card
 * const result = await helper.issueIdCard(reporterId);
 * 
 * // Send via WhatsApp (auto-generates PDF if missing)
 * const response = await helper.sendWhatsApp(reporterId);
 * 
 * // Full regenerate
 * const regenerated = await helper.regenerate(reporterId, { keepCardNumber: true });
 * ```
 */

import {
  generateMyIdCard,
  generateReporterIdCard,
  getMyIdCard,
  getReporterIdCard,
  regenerateMyIdCard,
  regenerateReporterIdCard,
  resendIdCardToWhatsApp,
  resendMyIdCardToWhatsApp,
  deleteIdCardPdf,
  updateIdCardPdf,
  getIdCardPdfUrl,
  type GenerateReporterIdCardResponse,
  type RegenerateIdCardInput,
  type ReporterIdCard,
  type ResendIdCardWhatsAppResponse,
  type UpdateIdCardPdfInput,
  type UpdateIdCardPdfResponse,
  type DeleteIdCardPdfResponse,
} from './reporters';

export type UserRole = 'TENANT_ADMIN' | 'REPORTER' | 'SUPER_ADMIN' | string;

export class IdCardHelper {
  private role: UserRole;
  private tenantId?: string;

  constructor(role: UserRole, tenantId?: string) {
    this.role = role;
    this.tenantId = tenantId;
  }

  /**
   * Get ID card for a reporter
   * - TENANT_ADMIN: Gets any reporter's card
   * - REPORTER: Gets own card only (reporterId ignored)
   */
  async getIdCard(reporterId?: string): Promise<ReporterIdCard | null> {
    if (this.isAdmin()) {
      if (!this.tenantId || !reporterId) {
        throw new Error('Tenant ID and Reporter ID required for admin operations');
      }
      return await getReporterIdCard(this.tenantId, reporterId);
    } else {
      return await getMyIdCard();
    }
  }

  /**
   * Issue/Generate ID card (first time)
   * - TENANT_ADMIN: Issues card for any reporter
   * - REPORTER: Issues own card only (reporterId ignored)
   */
  async issueIdCard(reporterId?: string): Promise<GenerateReporterIdCardResponse> {
    if (this.isAdmin()) {
      if (!this.tenantId || !reporterId) {
        throw new Error('Tenant ID and Reporter ID required for admin operations');
      }
      return await generateReporterIdCard(this.tenantId, reporterId);
    } else {
      return await generateMyIdCard();
    }
  }

  /**
   * Send ID card via WhatsApp (auto-generates PDF if missing)
   * - TENANT_ADMIN: Sends any reporter's card
   * - REPORTER: Sends own card only (reporterId ignored)
   */
  async sendWhatsApp(reporterId?: string): Promise<ResendIdCardWhatsAppResponse> {
    if (this.isAdmin()) {
      if (!this.tenantId || !reporterId) {
        throw new Error('Tenant ID and Reporter ID required for admin operations');
      }
      return await resendIdCardToWhatsApp(this.tenantId, reporterId);
    } else {
      return await resendMyIdCardToWhatsApp();
    }
  }

  /**
   * Regenerate ID card (full regenerate with optional new card number)
   * - TENANT_ADMIN: Regenerates any reporter's card
   * - REPORTER: Regenerates own card only (reporterId ignored)
   */
  async regenerate(
    reporterIdOrInput?: string | RegenerateIdCardInput,
    inputIfAdmin?: RegenerateIdCardInput
  ): Promise<GenerateReporterIdCardResponse> {
    if (this.isAdmin()) {
      const reporterId = typeof reporterIdOrInput === 'string' ? reporterIdOrInput : undefined;
      const input = typeof reporterIdOrInput === 'object' ? reporterIdOrInput : inputIfAdmin;
      
      if (!this.tenantId || !reporterId) {
        throw new Error('Tenant ID and Reporter ID required for admin operations');
      }
      return await regenerateReporterIdCard(this.tenantId, reporterId, input);
    } else {
      const input = typeof reporterIdOrInput === 'object' ? reporterIdOrInput : undefined;
      return await regenerateMyIdCard(input);
    }
  }

  /**
   * Delete ID card PDF URL (TENANT_ADMIN only)
   * Next resend/regenerate will create fresh PDF
   */
  async deletePdf(reporterId: string): Promise<DeleteIdCardPdfResponse> {
    if (!this.isAdmin()) {
      throw new Error('Only TENANT_ADMIN can delete PDF URLs');
    }
    if (!this.tenantId) {
      throw new Error('Tenant ID required for admin operations');
    }
    return await deleteIdCardPdf(this.tenantId, reporterId);
  }

  /**
   * Update ID card PDF URL and optionally send via WhatsApp (TENANT_ADMIN only)
   * Use this if you generated PDF elsewhere and want to store+send
   */
  async updatePdf(reporterId: string, input: UpdateIdCardPdfInput): Promise<UpdateIdCardPdfResponse> {
    if (!this.isAdmin()) {
      throw new Error('Only TENANT_ADMIN can update PDF URLs');
    }
    if (!this.tenantId) {
      throw new Error('Tenant ID required for admin operations');
    }
    return await updateIdCardPdf(this.tenantId, reporterId, input);
  }

  /**
   * Get PDF download URL (PUBLIC API - works for both roles)
   * Returns the direct download URL for the ID card PDF
   * 
   * @param reporterId - Reporter ID (optional for REPORTER role - uses own ID from token)
   * @returns Download URL (requires Authorization header when fetching)
   */
  getPdfUrl(reporterId?: string): string {
    const id = this.isAdmin() ? reporterId : reporterId; // For reporter, reporterId is still needed
    if (!id) {
      throw new Error('Reporter ID required');
    }
    return getIdCardPdfUrl(id);
  }

  private isAdmin(): boolean {
    const r = String(this.role || '').toUpperCase();
    return r === 'TENANT_ADMIN' || r === 'SUPER_ADMIN';
  }
}

/**
 * Quick helper factory function
 * 
 * @example
 * ```ts
 * const idCardApi = createIdCardHelper(role, tenantId);
 * const card = await idCardApi.getIdCard(reporterId);
 * await idCardApi.sendWhatsApp(reporterId);
 * ```
 */
export function createIdCardHelper(role: UserRole, tenantId?: string): IdCardHelper {
  return new IdCardHelper(role, tenantId);
}
