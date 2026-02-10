# Reporter Management Features - Implementation Summary

## Overview
Added comprehensive reporter management features for Tenant Admin dashboard, including:
1. **Delete Reporter** - with confirmation and deactivation alternative
2. **Transfer Reporter Designation** - change designation/location assignment

## Backend API Integration

### Added to `services/reporters.ts`:

#### 1. Delete Reporter
```typescript
deleteReporter(tenantId: string, reporterId: string): Promise<DeleteReporterResponse>
```
- **Endpoint**: `DELETE /api/v1/tenants/{tenantId}/reporters/{reporterId}`
- **Description**: Soft deletes reporter, scrubs user data (mobile/email/mpin set to null)
- **Returns**: `{ success, deletedReporterId, releasedMobileNumber }`
- **Constraints**: Cannot delete own reporter profile
- **Use Case**: Permanent removal when reporter leaves organization

#### 2. Toggle Reporter Active Status
```typescript
toggleReporterActive(tenantId: string, reporterId: string, active: boolean): Promise<ToggleReporterActiveResponse>
```
- **Endpoint**: `PATCH /api/v1/tenants/{tenantId}/reporters/{reporterId}/active`
- **Body**: `{ active: true/false }`
- **Description**: Activate/deactivate reporter (recommended over delete)
- **Returns**: `{ success, reporterId, active }`
- **Use Case**: Temporarily suspend reporter while preserving all data

#### 3. Transfer Reporter Assignment
```typescript
transferReporterAssignment(tenantId: string, reporterId: string, assignment: TransferReporterAssignmentInput): Promise<TransferReporterAssignmentResponse>
```
- **Endpoint**: `PATCH /api/v1/tenants/{tenantId}/reporters/{reporterId}/assignment`
- **Body**: Can include designationId, level, stateId, districtId, divisionId, etc.
- **Description**: Change reporter's designation and/or location
- **Returns**: `{ success, reporterId, updatedFields }`
- **Constraints**: 
  - Cannot change own assignment
  - Validates against tenant reporter limits (409 if limit reached)

---

## UI/UX Implementation

### Updated `app/tenant/reporters.tsx`:

#### 1. Reporter Card - Enhanced with Actions Menu
- **New Features**:
  - Three-dot menu button (more-vert icon) on each reporter card
  - Tap to open action menu modal with options:
    - 👁️ **వివరాలు చూడండి** (View Details) - Opens reporter profile
    - 🔄 **డిజిగ్నేషన్ మార్చండి** (Transfer Designation) - Opens transfer modal
    - 🗑️ **తొలగించండి** (Delete) - Opens delete confirmation

#### 2. Delete Confirmation Modal
**Design Philosophy**: Safe deletion with alternatives

**Features**:
- ⚠️ Warning message explaining consequences in Telugu
- Two action options:
  1. **డీయాక్టివేట్** (Deactivate) - Orange button, safer option
     - Preserves all data
     - Can be reversed
     - Recommended approach
  2. **తొలగించు** (Delete) - Red button, permanent action
     - Releases mobile number
     - Scrubs user data
     - Keeps article history
- **Cancel** button to abort operation

**Error Handling**:
- "Cannot delete self" → Telugu message: "మీరు మీ స్వంత ప్రొఫైల్‌ని తొలగించలేరు"
- Generic errors → "తొలగించడం విఫలమైంది. మళ్ళీ ప్రయత్నించండి."

**Success Flow**:
- Removes reporter from list immediately
- Shows success alert: "రిపోర్టర్ తొలగించబడింది" or "రిపోర్టర్ డీయాక్టివేట్ చేయబడింది"

#### 3. Transfer Designation Modal
**Design Philosophy**: Simple designation change (future: location picker)

**Features**:
- **Header**: Shows reporter name and close button
- **Designation List**: 
  - Radio button selection
  - Shows native Telugu name (nativeName field)
  - Shows level in Telugu (రాష్ట్రం, జిల్లా, మండలం, నియోజకవర్గం)
  - Highlighted selection with primary color background
- **Confirm Button**: 
  - Disabled when no selection
  - Shows loading spinner during transfer
  - "మార్చు" (Change) text with check icon

**Error Handling**:
- **409 Limit Reached** → "ఈ డిజిగ్నేషన్ కోసం రిపోర్టర్ల లిమిట్ చేరుకుంది"
- **Cannot change self** → "మీరు మీ స్వంత అసైన్‌మెంట్‌ని మార్చలేరు"
- Generic errors → "మార్చడం విఫలమైంది. మళ్ళీ ప్రయత్నించండి."

**Success Flow**:
- Reloads reporter list to fetch updated data
- Shows success alert: "డిజిగ్నేషన్ మార్చబడింది"

---

## Component State Management

### New State Variables:
```typescript
const [selectedReporter, setSelectedReporter] = useState<TenantReporter | null>(null);
const [deleteModalVisible, setDeleteModalVisible] = useState(false);
const [transferModalVisible, setTransferModalVisible] = useState(false);
const [actionLoading, setActionLoading] = useState(false);
const [designations, setDesignations] = useState<ReporterDesignation[]>([]);
const [selectedDesignation, setSelectedDesignation] = useState<string | null>(null);
```

### Handler Functions:
1. `handleDeletePress(reporter)` - Opens delete confirmation
2. `handleTransferPress(reporter)` - Loads designations and opens transfer modal
3. `confirmDelete()` - Executes delete API call
4. `confirmDeactivate()` - Executes deactivate API call
5. `confirmTransfer()` - Executes transfer API call

---

## Styling

### New Styles Added:
- **cardWrapper** - Container for card with menu
- **moreBtn** - Three-dot menu button
- **modalOverlay** - Semi-transparent backdrop (rgba(0, 0, 0, 0.5))
- **actionMenu** - Popup menu with rounded corners
- **actionMenuItem** - Menu item with icon and text
- **confirmModal** - Delete confirmation dialog
- **confirmIcon** - Circular icon container (80x80)
- **confirmWarning** - Yellow warning banner
- **confirmActions** - Button group container
- **transferModal** - Full transfer dialog
- **designationList** - Scrollable designation options
- **designationItem** - Radio button list item
- **designationRadio** - Custom radio button

**Design System**:
- Primary Color: `#DC2626` (Red)
- Warning Color: `#F59E0B` (Orange)
- Success Color: `#10B981` (Green)
- Border Radius: 12-20px for modals
- Shadows: elevation 8-10 for modals
- Animations: fade for delete modal, slide for transfer modal

---

## Telugu Localization

All UI text is in Telugu:
- ✅ రిపోర్టర్ తొలగించాలా? (Delete reporter?)
- ✅ డిలీట్ చేస్తే మొబైల్ నంబర్ విడుదల అవుతుంది (Mobile number will be released)
- ✅ బదులుగా డీయాక్టివేట్ చేయండి (Deactivate instead)
- ✅ డిజిగ్నేషన్ మార్చండి (Change designation)
- ✅ వివరాలు చూడండి (View details)
- ✅ తొలగించు (Delete)
- ✅ రద్దు (Cancel)
- ✅ మార్చు (Change)
- ✅ విజయవంతం (Success)
- ✅ తప్పు (Error)

---

## Future Enhancements (Not Yet Implemented)

### 1. Location Selection in Transfer Flow
**Requirement**: After selecting designation, show location picker based on level
- STATE level → No location picker needed
- DISTRICT level → District picker
- MANDAL level → Mandal picker
- ASSEMBLY level → Constituency picker

**Implementation Plan**:
```typescript
// Step 1: Select designation
// Step 2: Show location picker modal
// Step 3: Confirm with preview of changes
```

### 2. Bulk Operations
- Multi-select reporters
- Bulk deactivate
- Bulk designation transfer

### 3. Activity Log
- Show history of designation changes
- Track who made changes and when

### 4. Advanced Filters
- Filter by active/inactive status
- Filter by designation
- Filter by location

---

## Testing Checklist

### Delete Flow:
- [ ] Open action menu on reporter card
- [ ] Tap "తొలగించండి" (Delete)
- [ ] Verify warning modal appears
- [ ] Tap "డీయాక్టివేట్" - should deactivate and close modal
- [ ] Tap "తొలగించు" - should delete and remove from list
- [ ] Tap "రద్దు" - should close modal without action
- [ ] Try deleting own profile - should show error message

### Transfer Flow:
- [ ] Open action menu on reporter card
- [ ] Tap "డిజిగ్నేషన్ మార్చండి"
- [ ] Verify designation list loads
- [ ] Select different designation
- [ ] Verify radio button highlights selection
- [ ] Tap "మార్చు" - should update and reload list
- [ ] Try with designation at limit - should show 409 error
- [ ] Try changing own designation - should show error

### UI/UX:
- [ ] Loading spinners appear during API calls
- [ ] Buttons disabled during loading
- [ ] Success alerts appear after successful operations
- [ ] Error alerts show appropriate Telugu messages
- [ ] Modals close properly after completion
- [ ] List updates reflect changes immediately

---

## API Error Codes Reference

| Code | Scenario | Telugu Message |
|------|----------|----------------|
| 400 | Cannot delete/change self | మీరు మీ స్వంత ప్రొఫైల్‌ని తొలగించలేరు |
| 404 | Reporter not found | రిపోర్టర్ కనుగొనబడలేదు |
| 409 | Designation limit reached | ఈ డిజిగ్నేషన్ కోసం రిపోర్టర్ల లిమిట్ చేరుకుంది |
| 500 | Server error | సర్వర్ లోపం. మళ్ళీ ప్రయత్నించండి. |

---

## Code Files Modified

1. **services/reporters.ts**
   - Added 3 new API functions
   - Added TypeScript types for request/response
   - Added comprehensive JSDoc comments

2. **app/tenant/reporters.tsx**
   - Updated imports (Modal, TouchableOpacity, ActivityIndicator, Alert)
   - Added state for modals and selections
   - Added handler functions for delete/transfer
   - Enhanced ReporterCard with action menu
   - Added Delete Confirmation Modal
   - Added Transfer Designation Modal
   - Added 200+ lines of new styles

**Total Lines Added**: ~400 lines
**No Breaking Changes**: All existing functionality preserved
