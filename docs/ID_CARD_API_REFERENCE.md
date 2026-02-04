# ID Card API Reference - Final Implementation

Complete guide for ID card operations in React Native app with role-based endpoints.

---

## 📋 Overview

**Two endpoint patterns:**
- **TENANT_ADMIN**: `/api/v1/tenants/{tenantId}/reporters/{reporterId}/id-card...`
- **REPORTER**: `/api/v1/reporters/me/id-card...`

**Base URL**: `https://your-api.com` (or `http://localhost:3001` for local dev)

---

## 🔑 A) TENANT_ADMIN APIs

### 1. First Time ID Card Issue (Create Record)

**Endpoint**: `POST /api/v1/tenants/{tenantId}/reporters/{reporterId}/id-card`

**Headers**: `Authorization: Bearer <token>`

**Request Body**: None

**Response** (200/201):
```typescript
{
  id: string;              // "cml1dujij000ebzyj0xgtcpyq"
  reporterId: string;      // "cml1b4zw80006bzyjmv35ytnk"
  cardNumber: string;      // "PA2026020002"
  issuedAt: string;        // "2026-02-04T10:00:00.000Z"
  expiresAt: string;       // "2026-12-31T00:00:00.000Z"
  pdfUrl: string | null;   // null initially
  createdAt: string;
  updatedAt: string;
}
```

**Common Errors**:
- `403` - Profile photo missing or payment rules failed
- `404` - Reporter or settings not found

**React Native Function**:
```typescript
import { generateReporterIdCard } from '@/services/reporters';

const result = await generateReporterIdCard(tenantId, reporterId);
```

---

### 2. Get ID Card + PDF URL

**Endpoint**: `GET /api/v1/tenants/{tenantId}/reporters/{reporterId}/id-card`

**Response**:
- If exists → card object (same as above)
- If not created → `null` (or `404`)

**Use Case**:
- If `pdfUrl` exists → show "Download/Open"
- If `pdfUrl` null → show "Generate PDF / Send WhatsApp"

**React Native Function**:
```typescript
import { getReporterIdCard } from '@/services/reporters';

const card = await getReporterIdCard(tenantId, reporterId);
// Returns null if not found (instead of throwing 404)
```

---

### 3. Send WhatsApp (Auto-generate PDF if Missing) ⭐ Best Single Endpoint

**Endpoint**: `POST /api/v1/tenants/{tenantId}/reporters/{reporterId}/id-card/resend`

**What it does**:
- `pdfUrl` exists → sends same PDF via WhatsApp
- `pdfUrl` missing → auto-generate PDF and then send

**Response**:
```typescript
{
  success: boolean;        // true
  message: string;         // "ID card PDF sent via WhatsApp"
  messageId?: string;      // "wamid.xxx"
  sentTo?: string;         // "91******9134"
}
```

**Errors**:
- `400` - ID card not found OR mobile missing
- `403` - Not authorized

**React Native Function**:
```typescript
import { resendIdCardToWhatsApp } from '@/services/reporters';

const result = await resendIdCardToWhatsApp(tenantId, reporterId);
```

---

### 4. Regenerate PDF Only (Same Card Number)

**Recommended Flow** (no new card record):

**Step 1**: Delete PDF URL
```
DELETE /api/v1/tenants/{tenantId}/reporters/{reporterId}/id-card/pdf
```
Response:
```typescript
{ success: true, message: "PDF URL cleared. Next resend/regenerate will create fresh PDF." }
```

**Step 2**: Resend (auto-generates + sends WhatsApp)
```
POST /api/v1/tenants/{tenantId}/reporters/{reporterId}/id-card/resend
```

**React Native Functions**:
```typescript
import { deleteIdCardPdf, resendIdCardToWhatsApp } from '@/services/reporters';

// Delete old PDF
await deleteIdCardPdf(tenantId, reporterId);

// Auto-generate new PDF + send WhatsApp
await resendIdCardToWhatsApp(tenantId, reporterId);
```

---

### 5. Full Regenerate (New Card Record Optional)

**Endpoint**: `POST /api/v1/tenants/{tenantId}/reporters/{reporterId}/id-card/regenerate`

**Request Body** (optional):
```typescript
{
  keepCardNumber?: boolean;  // true to keep same card number
  reason?: string;           // "Photo updated"
}
```

**Response**:
```typescript
{
  id: string;                    // New ID card row
  reporterId: string;
  cardNumber: string;            // "PA2026020002"
  issuedAt: string;              // "2026-02-05T10:00:00.000Z"
  expiresAt: string;
  pdfUrl: string | null;
  previousCardNumber?: string;   // Previous card number
  pdfGenerating?: boolean;       // true
  whatsappSent?: boolean;        // true
  message?: string;              // "ID card regenerated..."
}
```

**React Native Function**:
```typescript
import { regenerateReporterIdCard } from '@/services/reporters';

const result = await regenerateReporterIdCard(tenantId, reporterId, {
  keepCardNumber: true,
  reason: "Photo updated"
});
```

---

### 6. Store Pre-Generated PDF + Send WhatsApp

**Endpoint**: `PATCH /api/v1/tenants/{tenantId}/reporters/{reporterId}/id-card/pdf`

**Request Body**:
```typescript
{
  pdfUrl: string;          // "https://kaburlu-news.b-cdn.net/id-cards/PA2026020002.pdf"
  sendWhatsApp?: boolean;  // true to send after storing
}
```

**Response**:
```typescript
{
  id: string;
  cardNumber: string;
  pdfUrl: string;
  issuedAt: string;
  expiresAt: string;
  whatsappSent?: boolean;
  whatsappMessageId?: string;
  whatsappError?: string | null;
}
```

**React Native Function**:
```typescript
import { updateIdCardPdf } from '@/services/reporters';

const result = await updateIdCardPdf(tenantId, reporterId, {
  pdfUrl: "https://cdn.example.com/id-card.pdf",
  sendWhatsApp: true
});
```

---

## 👤 B) REPORTER Self-Service APIs

Reporters use `/reporters/me/...` endpoints (no tenantId/reporterId needed).

### 1. Get My ID Card

**Endpoint**: `GET /api/v1/reporters/me/id-card`

**React Native Function**:
```typescript
import { getMyIdCard } from '@/services/reporters';

const card = await getMyIdCard();
// Returns null if not found
```

---

### 2. Generate My ID Card (First Time)

**Endpoint**: `POST /api/v1/reporters/me/id-card`

**React Native Function**:
```typescript
import { generateMyIdCard } from '@/services/reporters';

const result = await generateMyIdCard();
```

---

### 3. Send My ID Card via WhatsApp

**Endpoint**: `POST /api/v1/reporters/me/id-card/resend`

**React Native Function**:
```typescript
import { resendMyIdCardToWhatsApp } from '@/services/reporters';

const result = await resendMyIdCardToWhatsApp();
```

---

### 4. Regenerate My ID Card

**Endpoint**: `POST /api/v1/reporters/me/id-card/regenerate`

**Request Body** (optional):
```typescript
{
  keepCardNumber?: boolean;
  reason?: string;
}
```

**React Native Function**:
```typescript
import { regenerateMyIdCard } from '@/services/reporters';

const result = await regenerateMyIdCard({
  keepCardNumber: true,
  reason: "Updated profile photo"
});
```

---

## 🎯 UI Logic Pattern

```typescript
import { loadTokens } from '@/services/auth';
import { createIdCardHelper } from '@/services/idCardHelper';

// In your component
const role = session?.role; // 'TENANT_ADMIN' or 'REPORTER'
const tenantId = session?.tenantId;

// Create helper
const idCardApi = createIdCardHelper(role, tenantId);

// Operations work for both roles
const card = await idCardApi.getIdCard(reporterId); // reporterId ignored for REPORTER role
const result = await idCardApi.issueIdCard(reporterId);
const whatsapp = await idCardApi.sendWhatsApp(reporterId);
const regenerated = await idCardApi.regenerate(reporterId, { keepCardNumber: true });
```

**Simple branching**:
```typescript
if (role === 'TENANT_ADMIN') {
  // Use tenant admin endpoints with reporterId
  await generateReporterIdCard(tenantId, reporterId);
  await resendIdCardToWhatsApp(tenantId, reporterId);
} else if (role === 'REPORTER') {
  // Use self-service endpoints
  await generateMyIdCard();
  await resendMyIdCardToWhatsApp();
}
```

---

## 📦 Complete Function Reference

### TENANT_ADMIN Functions
```typescript
// services/reporters.ts

// Get
getReporterIdCard(tenantId, reporterId) → ReporterIdCard | null

// Issue
generateReporterIdCard(tenantId, reporterId) → GenerateReporterIdCardResponse

// WhatsApp
resendIdCardToWhatsApp(tenantId, reporterId) → ResendIdCardWhatsAppResponse

// Regenerate
regenerateReporterIdCard(tenantId, reporterId, input?) → GenerateReporterIdCardResponse

// PDF Management
deleteIdCardPdf(tenantId, reporterId) → DeleteIdCardPdfResponse
updateIdCardPdf(tenantId, reporterId, input) → UpdateIdCardPdfResponse
```

### REPORTER Functions
```typescript
// services/reporters.ts

// Get
getMyIdCard() → ReporterIdCard | null

// Issue
generateMyIdCard() → GenerateReporterIdCardResponse

// WhatsApp
resendMyIdCardToWhatsApp() → ResendIdCardWhatsAppResponse

// Regenerate
regenerateMyIdCard(input?) → GenerateReporterIdCardResponse
```

### Helper Class (Recommended)
```typescript
// services/idCardHelper.ts

import { createIdCardHelper } from '@/services/idCardHelper';

const helper = createIdCardHelper(role, tenantId);

helper.getIdCard(reporterId?)
helper.issueIdCard(reporterId?)
helper.sendWhatsApp(reporterId?)
helper.regenerate(reporterIdOrInput?, inputIfAdmin?)
helper.deletePdf(reporterId)      // TENANT_ADMIN only
helper.updatePdf(reporterId, input) // TENANT_ADMIN only
```

---

## ✅ Current Implementation Status

### ✅ Completed
- [x] All TENANT_ADMIN functions implemented
- [x] All REPORTER self-service functions implemented
- [x] Type definitions for all requests/responses
- [x] Error handling with null returns for 404s
- [x] Helper class for role-based operations
- [x] Full PDF management (DELETE, PATCH endpoints)
- [x] Regenerate with options (keepCardNumber, reason)

### Files Updated
1. `services/reporters.ts` - All ID card API functions
2. `services/idCardHelper.ts` - Role-based helper (NEW)
3. `app/reporter/id-card.tsx` - Already using correct functions ✅
4. `app/tenant/reporter/[id].tsx` - Already using correct functions ✅

---

## 🚀 Usage Examples

### Example 1: Admin Issues ID Card
```typescript
const handleGenerateIdCard = async () => {
  try {
    const result = await generateReporterIdCard(tenantId, reporterId);
    console.log('Card issued:', result.cardNumber);
    
    // Auto-send via WhatsApp
    await resendIdCardToWhatsApp(tenantId, reporterId);
  } catch (error) {
    console.error('Failed:', error.message);
  }
};
```

### Example 2: Reporter Generates Own Card
```typescript
const handleGenerateMyCard = async () => {
  try {
    const result = await generateMyIdCard();
    if (result.alreadyExists) {
      alert('Card already exists!');
    } else {
      alert('Card generated and sent to WhatsApp!');
    }
  } catch (error) {
    console.error('Failed:', error.message);
  }
};
```

### Example 3: Check and Display Card
```typescript
const loadIdCard = async () => {
  const card = await (isAdmin 
    ? getReporterIdCard(tenantId, reporterId)
    : getMyIdCard()
  );
  
  if (card) {
    console.log('Card Number:', card.cardNumber);
    console.log('Expires:', card.expiresAt);
    if (card.pdfUrl) {
      console.log('PDF available:', card.pdfUrl);
    }
  } else {
    console.log('No ID card issued yet');
  }
};
```

### Example 4: Regenerate After Photo Update
```typescript
const handlePhotoUpdated = async () => {
  // Admin can regenerate with reason
  await regenerateReporterIdCard(tenantId, reporterId, {
    keepCardNumber: true,
    reason: "Profile photo updated"
  });
  
  // Reporter regenerates own
  await regenerateMyIdCard({
    keepCardNumber: true,
    reason: "Updated photo"
  });
};
```

---

## 🔒 Authorization

All endpoints require JWT authentication:
```typescript
Headers: {
  Authorization: Bearer <jwt_token>
}
```

Load token in React Native:
```typescript
import { loadTokens } from '@/services/auth';

const tokens = await loadTokens();
const jwt = tokens?.jwt;
// httpClient automatically adds this to requests
```

---

## 📝 Notes

1. **WhatsApp Send is Smart**: The `/resend` endpoint auto-generates PDF if missing, so you can just call it directly
2. **Get Functions Return Null**: When ID card doesn't exist, GET functions return `null` instead of throwing 404
3. **Role Detection**: Helper class automatically uses correct endpoints based on role
4. **PDF Regeneration**: Two options:
   - Quick: Delete PDF URL + Resend (same card record)
   - Full: Call `/regenerate` (optional new card record)
5. **Validation**: Backend validates profile photo and payment status before issuing

---

## 🎨 Common UI Flows

### Tenant Admin Screen
```
[View Reporter] → Check if ID card exists
  ├─ No Card → [Generate ID Card] button
  │   └─ Success → [Send WhatsApp] button appears
  └─ Has Card → Show card details
      ├─ [Send WhatsApp] button
      ├─ [Regenerate] button (if photo updated)
      └─ [Download PDF] link (if pdfUrl exists)
```

### Reporter Self-Service Screen
```
[My ID Card] → Load my card
  ├─ No Card → [Generate My ID Card] button
  │   └─ Success → Shows card + WhatsApp sent message
  └─ Has Card → Show my card details
      ├─ [Resend to WhatsApp] button
      ├─ [Regenerate] button
      └─ [Download PDF] link
```

---

**Last Updated**: February 5, 2026  
**API Version**: v1  
**Status**: ✅ Production Ready
