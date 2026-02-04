# ID Card API Migration Guide

Quick guide for updating existing code to use the new ID card API implementation.

---

## 🔄 What Changed

### Before (Old Implementation)
- Mixed endpoint patterns
- Deprecated functions with warnings
- Missing PDF management endpoints
- No role-based helper

### After (New Implementation) ✅
- Clear separation: TENANT_ADMIN vs REPORTER endpoints
- Complete API coverage (GET, POST, DELETE, PATCH, regenerate)
- Role-based helper class for easier usage
- Proper TypeScript types for all operations

---

## 📝 Function Name Changes

### No Changes Needed! ✅

All existing function names remain the same. They've been updated internally but maintain backward compatibility.

**TENANT_ADMIN Functions** (already in use):
```typescript
// Still the same function names
generateReporterIdCard(tenantId, reporterId)
getReporterIdCard(tenantId, reporterId)
resendIdCardToWhatsApp(tenantId, reporterId)
regenerateReporterIdCard(tenantId, reporterId, input?)

// NEW functions added
deleteIdCardPdf(tenantId, reporterId)
updateIdCardPdf(tenantId, reporterId, input)
```

**REPORTER Functions** (already in use):
```typescript
// Still the same function names
generateMyIdCard()
getMyIdCard()  // NEW - previously missing
resendMyIdCardToWhatsApp()
regenerateMyIdCard(input?)
```

---

## ✅ Files Already Using Correct APIs

### 1. `/app/reporter/id-card.tsx`
**Status**: ✅ No changes needed

Already using:
- `generateMyIdCard()`
- `resendMyIdCardToWhatsApp()`
- `regenerateMyIdCard()`

### 2. `/app/tenant/reporter/[id].tsx`
**Status**: ✅ No changes needed

Already using:
- `generateReporterIdCard(tenantId, reporterId)`
- `getReporterIdCard(tenantId, reporterId)`
- `resendIdCardToWhatsApp(tenantId, reporterId)`

---

## 🆕 Optional Improvements

### Option 1: Add Missing GET Call (Reporter Screen)

**Current**:
```typescript
// /app/reporter/id-card.tsx
const loadData = async () => {
  const data = await getReporterMe();
  setReporter(data);
};
```

**Enhanced** (load ID card separately):
```typescript
import { getMyIdCard } from '@/services/reporters';

const loadData = async () => {
  const [reporter, idCard] = await Promise.all([
    getReporterMe(),
    getMyIdCard()
  ]);
  setReporter(reporter);
  setIdCard(idCard);
};
```

### Option 2: Use Helper Class (Optional)

**Current** (works fine):
```typescript
if (role === 'TENANT_ADMIN') {
  await generateReporterIdCard(tenantId, reporterId);
} else {
  await generateMyIdCard();
}
```

**With Helper** (cleaner):
```typescript
import { createIdCardHelper } from '@/services/idCardHelper';

const idCardApi = createIdCardHelper(role, tenantId);
await idCardApi.issueIdCard(reporterId);
// Works for both TENANT_ADMIN and REPORTER roles
```

---

## 🆕 New Features Available

### 1. Delete PDF (Admin Only)
Clear PDF URL to force regeneration:
```typescript
import { deleteIdCardPdf } from '@/services/reporters';

// Clear old PDF
await deleteIdCardPdf(tenantId, reporterId);

// Next resend will auto-generate fresh PDF
await resendIdCardToWhatsApp(tenantId, reporterId);
```

### 2. Update PDF with Custom URL (Admin Only)
If you generated PDF elsewhere:
```typescript
import { updateIdCardPdf } from '@/services/reporters';

await updateIdCardPdf(tenantId, reporterId, {
  pdfUrl: "https://your-cdn.com/custom-id-card.pdf",
  sendWhatsApp: true  // Optional: send immediately
});
```

### 3. Regenerate with Options
```typescript
// Keep same card number
await regenerateReporterIdCard(tenantId, reporterId, {
  keepCardNumber: true,
  reason: "Photo updated"
});

// Or for reporter
await regenerateMyIdCard({
  keepCardNumber: true,
  reason: "Updated profile"
});
```

### 4. Null-Safe GET
GET functions now return `null` instead of throwing 404:
```typescript
const card = await getReporterIdCard(tenantId, reporterId);
if (card) {
  console.log('Card exists:', card.cardNumber);
} else {
  console.log('No card issued yet');
}
```

---

## 🔍 Type Updates

All types are enhanced with optional fields:

```typescript
type GenerateReporterIdCardResponse = {
  success?: boolean;
  id?: string;
  cardNumber?: string;
  issuedAt?: string;
  expiresAt?: string;
  pdfUrl?: string | null;
  alreadyExists?: boolean;
  whatsappSent?: boolean;
  pdfGenerating?: boolean;        // NEW
  previousCardNumber?: string;    // NEW
  message?: string;
};

type RegenerateIdCardInput = {    // NEW type
  keepCardNumber?: boolean;
  reason?: string;
};

type UpdateIdCardPdfInput = {     // NEW type
  pdfUrl: string;
  sendWhatsApp?: boolean;
};
```

---

## 🚫 What NOT to Change

**Don't change**:
- Existing function calls in UI components
- Import statements (same functions, improved internally)
- Error handling logic
- UI flow and user experience

**Everything works as before, but better!** ✅

---

## 📊 Summary

| Feature | Before | After | Action Needed |
|---------|--------|-------|---------------|
| TENANT_ADMIN issue card | ✅ | ✅ | ✅ None |
| TENANT_ADMIN get card | ✅ | ✅ Enhanced (null-safe) | ✅ None |
| TENANT_ADMIN WhatsApp | ✅ | ✅ | ✅ None |
| TENANT_ADMIN regenerate | ⚠️ Deprecated | ✅ Fixed | ✅ None |
| TENANT_ADMIN delete PDF | ❌ | ✅ NEW | 🆕 Optional |
| TENANT_ADMIN update PDF | ❌ | ✅ NEW | 🆕 Optional |
| REPORTER issue card | ✅ | ✅ | ✅ None |
| REPORTER get card | ❌ | ✅ NEW | 🆕 Optional |
| REPORTER WhatsApp | ✅ | ✅ | ✅ None |
| REPORTER regenerate | ✅ | ✅ Enhanced | ✅ None |
| Helper class | ❌ | ✅ NEW | 🆕 Optional |

---

## ✅ Migration Checklist

- [x] Updated API functions in `services/reporters.ts`
- [x] Created helper class in `services/idCardHelper.ts`
- [x] Verified existing UI code works without changes
- [x] Added new types for regenerate/update operations
- [x] Added comprehensive documentation
- [ ] (Optional) Use helper class in new features
- [ ] (Optional) Add GET call in reporter screen
- [ ] (Optional) Use new PDF management endpoints

---

## 🎯 Recommendation

**For existing code**: No changes needed! ✅

**For new features**: Consider using `IdCardHelper` class for cleaner role-based logic.

**Example new component**:
```typescript
import { createIdCardHelper } from '@/services/idCardHelper';

export function IdCardManager({ role, tenantId, reporterId }: Props) {
  const idCardApi = useMemo(
    () => createIdCardHelper(role, tenantId),
    [role, tenantId]
  );

  const handleIssue = async () => {
    await idCardApi.issueIdCard(reporterId);
  };

  const handleWhatsApp = async () => {
    await idCardApi.sendWhatsApp(reporterId);
  };

  // Works for both TENANT_ADMIN and REPORTER!
}
```

---

**Migration Status**: ✅ Complete - No Breaking Changes  
**Last Updated**: February 5, 2026
