# Reporter Management - User Flow Diagram

## 1. Delete Reporter Flow

```
Reporter List Screen
  │
  ├─> Tap "⋮" (More Menu) on Reporter Card
  │     │
  │     └─> Action Menu Modal Appears
  │           ├─> వివరాలు చూడండి (View Details)
  │           ├─> డిజిగ్నేషన్ మార్చండి (Transfer)
  │           └─> తొలగించండి (Delete) ◄─── TAP HERE
  │                 │
  │                 └─> Delete Confirmation Modal
  │                       │
  │                       ├─ ⚠️ Warning: మొబైల్ నంబర్ విడుదల అవుతుంది
  │                       ├─ 💡 Hint: డీయాక్టివేట్ చేయండి (safer)
  │                       │
  │                       ├─> [డీయాక్టివేట్] Button (Orange)
  │                       │     │
  │                       │     └─> API: PATCH /active { active: false }
  │                       │           │
  │                       │           ├─ Success ✓
  │                       │           │   ├─> Update reporter in list
  │                       │           │   ├─> Close modal
  │                       │           │   └─> Alert: "రిపోర్టర్ డీయాక్టివేట్ చేయబడింది"
  │                       │           │
  │                       │           └─ Error ✗
  │                       │               └─> Alert: Error message
  │                       │
  │                       ├─> [తొలగించు] Button (Red)
  │                       │     │
  │                       │     └─> API: DELETE /reporters/{id}
  │                       │           │
  │                       │           ├─ Success ✓
  │                       │           │   ├─> Remove from list
  │                       │           │   ├─> Close modal
  │                       │           │   └─> Alert: "రిపోర్టర్ తొలగించబడింది"
  │                       │           │
  │                       │           └─ Error ✗
  │                       │               ├─ "cannot delete yourself"
  │                       │               │   └─> "మీరు మీ స్వంత ప్రొఫైల్‌ని తొలగించలేరు"
  │                       │               └─ Other errors
  │                       │                   └─> "తొలగించడం విఫలమైంది"
  │                       │
  │                       └─> [రద్దు] Button (Cancel)
  │                             └─> Close modal (no action)
  │
  └─> Back to Reporter List
```

---

## 2. Transfer Designation Flow

```
Reporter List Screen
  │
  ├─> Tap "⋮" (More Menu) on Reporter Card
  │     │
  │     └─> Action Menu Modal Appears
  │           ├─> వివరాలు చూడండి (View Details)
  │           ├─> డిజిగ్నేషన్ మార్చండి (Transfer) ◄─── TAP HERE
  │           │     │
  │           │     └─> Load Designations
  │           │           │
  │           │           ├─ Success ✓
  │           │           │   └─> Transfer Modal Opens
  │           │           │
  │           │           └─ Error ✗
  │           │               └─> Alert: "డిజిగ్నేషన్లు లోడ్ కాలేదు"
  │           │
  │           └─> Transfer Designation Modal
  │                 │
  │                 ├─ Header: Reporter Name + [X] Close
  │                 │
  │                 ├─ Designation List (Scrollable)
  │                 │   ├─> ○ రాష్ట్ర రిపోర్టర్ (STATE)
  │                 │   ├─> ● జిల్లా రిపోర్టర్ (DISTRICT) ◄─── SELECTED
  │                 │   ├─> ○ మండల రిపోర్టర్ (MANDAL)
  │                 │   └─> ○ నియోజకవర్గ రిపోర్టర్ (ASSEMBLY)
  │                 │
  │                 └─> [మార్చు] Button (Enabled when selected)
  │                       │
  │                       └─> API: PATCH /assignment { designationId, level }
  │                             │
  │                             ├─ Success ✓
  │                             │   ├─> Reload reporter list
  │                             │   ├─> Close modal
  │                             │   └─> Alert: "డిజిగ్నేషన్ మార్చబడింది"
  │                             │
  │                             └─ Error ✗
  │                                 ├─ 409 Limit Reached
  │                                 │   └─> "ఈ డిజిగ్నేషన్ కోసం రిపోర్టర్ల లిమిట్ చేరుకుంది"
  │                                 ├─ "cannot change yourself"
  │                                 │   └─> "మీరు మీ స్వంత అసైన్‌మెంట్‌ని మార్చలేరు"
  │                                 └─ Other errors
  │                                     └─> "మార్చడం విఫలమైంది"
  │
  └─> Back to Reporter List (with updated data)
```

---

## 3. Component Hierarchy

```
TenantReportersScreen (Main Component)
  │
  ├─> SafeAreaView
  │     │
  │     ├─> FlatList
  │     │     │
  │     │     ├─> ListHeaderComponent
  │     │     │     ├─ Header (Back, Title, Search)
  │     │     │     ├─ Designation Filter Chips
  │     │     │     └─ KYC Filter Banner
  │     │     │
  │     │     └─> renderItem: ReporterCard
  │     │           │
  │     │           ├─ Avatar
  │     │           ├─ Content (Name, Designation, Location, Phone)
  │     │           ├─ Status Dot
  │     │           ├─ More Button (⋮)
  │     │           │
  │     │           └─> Action Menu Modal
  │     │                 ├─ View Details
  │     │                 ├─ Transfer Designation
  │     │                 └─ Delete
  │     │
  │     ├─> FAB (+ Add Reporter)
  │     │
  │     ├─> Delete Confirmation Modal
  │     │     ├─ Icon
  │     │     ├─ Title
  │     │     ├─ Reporter Name
  │     │     ├─ Warning Banner
  │     │     ├─ Hint
  │     │     └─ Action Buttons
  │     │         ├─ [డీయాక్టివేట్]
  │     │         ├─ [తొలగించు]
  │     │         └─ [రద్దు]
  │     │
  │     └─> Transfer Designation Modal
  │           ├─ Header (Title + Close)
  │           ├─ Label
  │           ├─ Designation List
  │           │   └─ Designation Items (Radio)
  │           └─ [మార్చు] Button
  │
  └─> End
```

---

## 4. State Flow Diagram

```
Initial State:
  selectedReporter: null
  deleteModalVisible: false
  transferModalVisible: false
  actionLoading: false
  designations: []
  selectedDesignation: null

User taps "తొలగించండి":
  ↓
  setSelectedReporter(reporter)
  setDeleteModalVisible(true)
  
User confirms delete:
  ↓
  setActionLoading(true)
  ↓
  API Call → DELETE /reporters/{id}
  ↓
  Success:
    setReporters(filtered list) ← Remove deleted reporter
    setDeleteModalVisible(false)
    setSelectedReporter(null)
    setActionLoading(false)
    Alert.alert("Success")
  
  Error:
    setActionLoading(false)
    Alert.alert("Error")

User taps "డిజిగ్నేషన్ మార్చండి":
  ↓
  setSelectedReporter(reporter)
  ↓
  API Call → GET /reporter-designations
  ↓
  Success:
    setDesignations(data)
    setSelectedDesignation(reporter.designationId)
    setTransferModalVisible(true)
  
  Error:
    Alert.alert("Load failed")

User selects designation & confirms:
  ↓
  setActionLoading(true)
  ↓
  API Call → PATCH /assignment { designationId, level }
  ↓
  Success:
    load(true) ← Reload entire list
    setTransferModalVisible(false)
    setSelectedReporter(null)
    setSelectedDesignation(null)
    setActionLoading(false)
    Alert.alert("Success")
  
  Error:
    setActionLoading(false)
    Alert.alert("Error with context")
```

---

## 5. API Call Sequence

### Delete Reporter:
```
1. User Action
   └─> handleDeletePress(reporter)
       └─> setSelectedReporter(reporter)
       └─> setDeleteModalVisible(true)

2. User Confirms Delete
   └─> confirmDelete()
       ├─> setActionLoading(true)
       ├─> await deleteReporter(tenantId, reporterId)
       ├─> setReporters(filtered)  ← Optimistic update
       ├─> setDeleteModalVisible(false)
       ├─> setSelectedReporter(null)
       ├─> setActionLoading(false)
       └─> Alert.alert("Success")
```

### Transfer Designation:
```
1. User Action
   └─> handleTransferPress(reporter)
       ├─> setSelectedReporter(reporter)
       ├─> await getReporterDesignations(tenantId)
       ├─> setDesignations(data)
       ├─> setSelectedDesignation(reporter.designationId)
       └─> setTransferModalVisible(true)

2. User Selects Designation
   └─> setSelectedDesignation(designationId)

3. User Confirms Transfer
   └─> confirmTransfer()
       ├─> setActionLoading(true)
       ├─> await transferReporterAssignment(tenantId, reporterId, {...})
       ├─> await load(true)  ← Full reload from server
       ├─> setTransferModalVisible(false)
       ├─> setSelectedReporter(null)
       ├─> setSelectedDesignation(null)
       ├─> setActionLoading(false)
       └─> Alert.alert("Success")
```

---

## 6. Visual States

### Reporter Card States:
```
Normal State:
┌──────────────────────────────────┐
│ [Avatar] Name            [●] [⋮] │
│         Designation • Location   │
│         📞 Phone                  │
└──────────────────────────────────┘

Menu Open:
┌──────────────────────────────────┐
│ [Avatar] Name            [●] [⋮] │
│         Designation • Location   │  ┌─────────────────────┐
│         📞 Phone                  │  │ Reporter Name       │
└──────────────────────────────────┘  ├─────────────────────┤
                                      │ 👁️ వివరాలు చూడండి  │
                                      │ 🔄 డిజిగ్నేషన్ మార్చండి │
                                      │ 🗑️ తొలగించండి       │
                                      ├─────────────────────┤
                                      │ ✕ రద్దు            │
                                      └─────────────────────┘
```

### Delete Modal States:
```
Normal:
┌─────────────────────────────────┐
│        [🗑️ Icon]                 │
│   రిపోర్టర్ తొలగించాలా?          │
│        Reporter Name             │
│                                  │
│ ⚠️ మొబైల్ నంబర్ విడుదల అవుతుంది   │
│ 💡 బదులుగా డీయాక్టివేట్ చేయండి    │
│                                  │
│ [      డీయాక్టివేట్      ]       │  Orange
│ [        తొలగించు        ]       │  Red
│ [         రద్దు          ]       │  Gray
└─────────────────────────────────┘

Loading:
┌─────────────────────────────────┐
│        [🗑️ Icon]                 │
│   రిపోర్టర్ తొలగించాలా?          │
│        Reporter Name             │
│                                  │
│ ⚠️ మొబైల్ నంబర్ విడుదల అవుతుంది   │
│ 💡 బదులుగా డీయాక్టివేట్ చేయండి    │
│                                  │
│         [Loading Spinner]        │
│    దయచేసి వేచి ఉండండి...          │
└─────────────────────────────────┘
```

### Transfer Modal States:
```
Normal:
┌─────────────────────────────────┐
│ డిజిగ్నేషన్ మార్చండి        [✕]  │
│ Reporter Name                    │
├─────────────────────────────────┤
│ కొత్త డిజిగ్నేషన్                │
├─────────────────────────────────┤
│ ○ రాష్ట్ర రిపోర్టర్              │
│   రాష్ట్రం                       │
├─────────────────────────────────┤
│ ● జిల్లా రిపోర్టర్               │  ← Selected (highlighted)
│   జిల్లా                         │
├─────────────────────────────────┤
│ ○ మండల రిపోర్టర్                 │
│   మండలం                          │
├─────────────────────────────────┤
│                                  │
│ [      ✓ మార్చు        ]        │  Enabled
└─────────────────────────────────┘

Loading:
┌─────────────────────────────────┐
│ డిజిగ్నేషన్ మార్చండి        [✕]  │
│ Reporter Name                    │
├─────────────────────────────────┤
│ కొత్త డిజిగ్నేషన్                │
├─────────────────────────────────┤
│ ...                              │
│                                  │
│      [Loading Spinner]           │
│       మార్చుతోంది...              │
└─────────────────────────────────┘
```

---

## 7. Error Scenarios & Recovery

| Scenario | User Action | System Response | User Recovery |
|----------|-------------|-----------------|---------------|
| Network timeout | Tap Delete/Transfer | Alert: "Network error" | Retry operation |
| Cannot delete self | Tap Delete on own profile | "మీరు మీ స్వంత ప్రొఫైల్‌ని తొలగించలేరు" | Select different reporter |
| Designation limit | Confirm transfer to full designation | "లిమిట్ చేరుకుంది" | Choose different designation |
| Reporter not found | Confirm delete on deleted reporter | 404 error message | Refresh list |
| Server error (500) | Any API call | "సర్వర్ లోపం. మళ్ళీ ప్రయత్నించండి." | Retry after some time |
| Designations load failed | Open transfer modal | "డిజిగ్నేషన్లు లోడ్ కాలేదు" | Close modal, try again |
| Stale data | View reporter after changes | Shows outdated info | Pull to refresh |

---

## 8. Future Enhancement: Location Selection Flow

**When implemented, the transfer flow will have 2 steps:**

```
Step 1: Select Designation
  ↓
  User selects "జిల్లా రిపోర్టర్" (DISTRICT level)
  ↓
Step 2: Select Location
  ↓
  Show District Picker Modal
  ├─ List all districts in state
  ├─ Radio button selection
  └─ Tap [Next]
  ↓
Step 3: Confirm Preview
  ↓
  Show summary:
  - New Designation: జిల్లా రిపోర్టర్
  - New Location: విజయవాడ జిల్లా
  ↓
  Tap [Confirm] → API Call
```

**Level-based Location Pickers:**
- STATE → No picker (state-wide)
- DISTRICT → District picker
- MANDAL → District picker → Mandal picker
- ASSEMBLY → District picker → Constituency picker
