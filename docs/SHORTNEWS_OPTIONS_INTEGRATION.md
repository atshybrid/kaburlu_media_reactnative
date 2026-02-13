# ShortNews Options Integration Guide

Complete guide for integrating ShortNews Options API in the React Native app.

## 📋 Table of Contents
1. [API Overview](#api-overview)
2. [Frontend Integration](#frontend-integration)
3. [UI Components](#ui-components)
4. [Share Image Examples](#share-image-examples)
5. [Usage Examples](#usage-examples)

---

## 🔌 API Overview

### Available Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/shortnews-options` | Create a new option |
| GET | `/shortnews-options/by-shortnews/:id/counts` | Get positive/negative counts |
| GET | `/shortnews-options/by-shortnews/:id` | List all options for a shortnews |
| GET | `/shortnews-options/by-shortnews/:id/me` | Get my option for a shortnews |
| GET | `/shortnews-options/by-user/:userId` | List user's options |
| PUT | `/shortnews-options/:id` | Update option (owner only) |
| DELETE | `/shortnews-options/:id` | Delete option (owner only) |

### Authentication
All requests require JWT token:
```
Authorization: Bearer <JWT_TOKEN>
```

---

## 💻 Frontend Integration

### 1. Service Layer (`services/api.ts`)

```typescript
import { 
  createShortNewsOption,
  getShortNewsOptionCounts,
  getShortNewsOptions,
  getMyShortNewsOption,
  updateShortNewsOption,
  deleteShortNewsOption,
  type ShortNewsOption,
  type ShortNewsOptionCounts,
  type ShortNewsOptionType,
} from '@/services/api';
```

### 2. Usage in Components

#### Create an Option
```typescript
const handleSubmitOption = async () => {
  try {
    const option = await createShortNewsOption({
      shortNewsId: 'sn123',
      content: 'Need more water tankers',
      type: 'NEGATIVE', // or 'POSITIVE'
    });
    console.log('Option created:', option);
  } catch (error) {
    if (error.message.includes('already posted')) {
      Alert.alert('Already Posted', 'You already shared your opinion');
    } else if (error.message.includes('50 characters')) {
      Alert.alert('Too Long', 'Opinion must be 50 characters or less');
    }
  }
};
```

#### Get Counts
```typescript
const loadCounts = async (shortNewsId: string) => {
  const counts = await getShortNewsOptionCounts(shortNewsId);
  console.log('Counts:', counts);
  // { shortNewsId: 'sn123', positive: 12, negative: 3, total: 15 }
};
```

#### Get My Option
```typescript
const loadMyOption = async (shortNewsId: string) => {
  const myOption = await getMyShortNewsOption(shortNewsId);
  if (myOption) {
    console.log('My option:', myOption.content);
  } else {
    console.log('I haven\'t posted an option yet');
  }
};
```

#### List All Options
```typescript
const loadAllOptions = async (shortNewsId: string) => {
  const options = await getShortNewsOptions(shortNewsId);
  options.forEach(option => {
    console.log(`${option.user?.name}: ${option.content} (${option.type})`);
  });
};
```

#### Update My Option
```typescript
const updateMyOption = async (optionId: string) => {
  const updated = await updateShortNewsOption(optionId, {
    content: 'Need more water tankers ASAP!',
  });
  console.log('Updated:', updated);
};
```

#### Delete My Option
```typescript
const deleteMyOption = async (optionId: string) => {
  await deleteShortNewsOption(optionId);
  console.log('Deleted successfully');
};
```

---

## 🎨 UI Components

### ShortNewsOptions Component

Located at: `/components/ShortNewsOptions.tsx`

**Features:**
- ✅ Displays option counts (positive/negative/total)
- ✅ Shows top 3 options from other users
- ✅ Allows users to add/edit their option (max 50 chars)
- ✅ Positive/Negative type selector
- ✅ Full bottom sheet to view all options
- ✅ Delete option functionality

**Usage:**
```tsx
import ShortNewsOptions from '@/components/ShortNewsOptions';

<ShortNewsOptions 
  shortNewsId={article.id}
  onCountsChange={(counts) => {
    console.log('Counts updated:', counts);
  }}
/>
```

**Visual Layout:**
```
┌─────────────────────────────────────────┐
│  👍 12 Agree | 👎 3 Disagree | 💬 15    │ ← Counts Row
├─────────────────────────────────────────┤
│  [👍 Your Opinion]                       │
│  Need more water tankers                 │ ← My Option (if exists)
│  [Edit icon]                             │
├─────────────────────────────────────────┤
│  OR                                      │
├─────────────────────────────────────────┤
│  [+ Share your opinion (50 chars max)]  │ ← Add Button (if no option)
├─────────────────────────────────────────┤
│  Top Opinions                            │
│  ┌───────────────────────────────────┐  │
│  │ [Avatar] Suresh                   │  │
│  │ 👍 Agrees                         │  │
│  │ Need more water tankers           │  │
│  └───────────────────────────────────┘  │ ← Top Option #1
│  ┌───────────────────────────────────┐  │
│  │ [Avatar] Ramesh                   │  │
│  │ 👎 Disagrees                      │  │
│  │ No water problem in my area       │  │
│  └───────────────────────────────────┘  │ ← Top Option #2
│                                          │
│  [View all 15 opinions →]               │ ← View All Button
└─────────────────────────────────────────┘
```

---

## 📸 Share Image Examples

### ShareableShortNewsImage Component

Located at: `/components/ShareableShortNewsImage.tsx`

**Layout Structure (600px total height):**

#### Top 80% (480px) - Content Area
```
┌──────────────────────────────────────┐
│  [Kaburlu Media Logo]                │
│                                      │
│  ┌───────────────────────────────┐  │
│  │                               │  │
│  │     [Cover Image]             │  │
│  │                               │  │
│  └───────────────────────────────┘  │
│                                      │
│  Heavy rain in market area           │ ← Title (2 lines max)
│                                      │
│  Water logging near market, roads    │
│  blocked. Traffic disrupted...       │ ← Content (4 lines, 60 words max)
└──────────────────────────────────────┘
```

#### Bottom 20% (120px) - Options/Caption Area

**Option A: When Options Exist**
```
┌──────────────────────────────────────┐
│  👍 12 Agree | 👎 3 Disagree | 💬 15 │ ← Stats Row (35px)
├──────────────────────────────────────┤
│  👍 Suresh: Need more water tankers  │ ← Top Option #1
│  👎 Ramesh: No problem in my area    │ ← Top Option #2
└──────────────────────────────────────┘
```

**Option B: When Only Reporter Caption Exists**
```
┌──────────────────────────────────────┐
│  [Photo]  "నా అభిప్రాయం ప్రకారం     │
│            ఇది చాలా ముఖ్యం"          │ ← Caption (40 chars max)
│            - Reporter Name            │ ← Attribution
└──────────────────────────────────────┘
```

### Integration in ArticlePage

The `ArticlePage` component automatically:
1. Displays `ShortNewsOptions` below article content
2. Fetches option counts when component loads
3. When sharing, checks if options exist
4. If options exist, generates share image with options
5. If only caption exists, shows caption in share image

**Share Flow:**
```
User taps Share Button
        ↓
Check: Has Options?
        ↓
    YES → Use ShareableShortNewsImage with options data
           - Fetch top 2 options
           - Include counts (positive/negative/total)
           - Generate image with options in bottom 20%
        ↓
    NO → Check: Has Caption?
           ↓
       YES → Use ShareableShortNewsImage with caption
              - Show reporter photo + caption
           ↓
       NO → Regular article sharing (full text capture)
```

---

## 📱 Usage Examples

### Example 1: Complete Flow in a Screen

```tsx
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import ShortNewsOptions from '@/components/ShortNewsOptions';
import ShareableShortNewsImage, { ShareableShortNewsImageRef } from '@/components/ShareableShortNewsImage';

const ShortNewsDetailScreen = ({ article }) => {
  const [optionCounts, setOptionCounts] = useState(null);
  const [showShare, setShowShare] = useState(false);
  const shareRef = useRef<ShareableShortNewsImageRef>(null);

  const handleShare = async () => {
    setShowShare(true);
    await new Promise(r => setTimeout(r, 100));
    await shareRef.current?.captureAndShare();
    setShowShare(false);
  };

  return (
    <ScrollView>
      {/* Article Content */}
      <Text style={styles.title}>{article.title}</Text>
      <Text style={styles.body}>{article.content}</Text>

      {/* Options Component */}
      <ShortNewsOptions 
        shortNewsId={article.id}
        onCountsChange={setOptionCounts}
      />

      {/* Share Button */}
      <TouchableOpacity onPress={handleShare}>
        <Text>Share</Text>
      </TouchableOpacity>

      {/* Share Image Modal */}
      <ShareableShortNewsImage
        ref={shareRef}
        visible={showShare}
        shortNews={{
          id: article.id,
          title: article.title,
          content: article.content,
          coverImageUrl: article.imageUrl,
          options: optionCounts ? {
            positive: optionCounts.positive,
            negative: optionCounts.negative,
            total: optionCounts.total,
            topOptions: [], // Fetched in onCaptureStart
          } : undefined,
        }}
      />
    </ScrollView>
  );
};
```

### Example 2: State Management with Options

```tsx
const [myOption, setMyOption] = useState<ShortNewsOption | null>(null);
const [counts, setCounts] = useState<ShortNewsOptionCounts | null>(null);
const [loading, setLoading] = useState(true);

useEffect(() => {
  const loadData = async () => {
    try {
      const [countsData, myOptionData] = await Promise.all([
        getShortNewsOptionCounts(shortNewsId),
        getMyShortNewsOption(shortNewsId),
      ]);
      
      setCounts(countsData);
      setMyOption(myOptionData);
    } catch (error) {
      console.error('Failed to load:', error);
    } finally {
      setLoading(false);
    }
  };
  
  loadData();
}, [shortNewsId]);
```

### Example 3: Error Handling

```typescript
const handleCreateOption = async (content: string, type: ShortNewsOptionType) => {
  try {
    const option = await createShortNewsOption({
      shortNewsId,
      content,
      type,
    });
    
    setMyOption(option);
    Alert.alert('Success', 'Your opinion has been shared!');
    
  } catch (error: any) {
    // Handle specific errors
    if (error.message.includes('already posted')) {
      Alert.alert(
        'Already Posted',
        'You already shared your opinion. Would you like to edit it?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Edit', onPress: () => openEditModal() },
        ]
      );
    } else if (error.message.includes('50 characters')) {
      Alert.alert('Too Long', 'Please keep your opinion under 50 characters');
    } else if (error.status === 401) {
      Alert.alert('Sign In Required', 'Please sign in to share your opinion');
    } else {
      Alert.alert('Error', error.message || 'Failed to submit option');
    }
  }
};
```

---

## 🎯 All Article Layout Styles

The ShortNewsOptions component appears **identically** across all 6 active article layout styles because they all use the `ArticlePage` component as their base:

### Style 1: Classic (ArticlePage)
- Standard scrolling layout
- Options appear below article body
- Full engagement buttons at bottom

### Style 2: Newspaper (LayoutTwo)
- Newspaper masthead with transliteration
- Options integrated below content
- Traditional newspaper feel

### Style 3: Broadsheet (BroadsheetLayout)
- Classic newspaper with drop cap
- Options section after article text
- Formal layout style

### Style 5: Editorial (EditorialColumnLayout)
- Author-focused opinion layout
- Options appear naturally after editorial content
- Emphasizes community discussion

### Style 6: Breaking News (BreakingNewsLayout)
- Urgent news with red banner
- Options provide instant public reaction
- Real-time sentiment visible

### Style 8: Tabloid (TabloidBoldLayout)
- Viral/trending style
- Options amplify engagement
- Bold, attention-grabbing design

**Note:** Styles 4 (Magazine) and 7 (Photo Essay) are currently disabled.

### Visual Example Across Styles

All styles show the same options UI:

```
┌─────────────────────────────────────────┐
│                                          │
│  [Article Content Varies by Style]      │
│                                          │
├─────────────────────────────────────────┤ ← Options Section (Same in All)
│  👍 12 Agree | 👎 3 Disagree | 💬 15    │
│  [Your Opinion or Add Button]           │
│  Top Opinions:                           │
│  • Suresh: Need water tankers           │
│  • Ramesh: No problem here              │
│  [View all 15 opinions →]               │
└─────────────────────────────────────────┘
```

---

## 🔄 Data Flow Diagram

```
ArticlePage Component
        ↓
    Renders
        ↓
ShortNewsOptions Component
        ↓
    Loads Data
        ↓
┌───────────────────────────────┐
│ API: getShortNewsOptionCounts │ → Displays counts
│ API: getMyShortNewsOption     │ → Shows/hides add button
│ API: getShortNewsOptions      │ → Renders top 3 options
└───────────────────────────────┘
        ↓
    User Actions
        ↓
┌───────────────────────────────┐
│ Add Option → createShortNewsOption    │
│ Edit Option → updateShortNewsOption   │
│ Delete Option → deleteShortNewsOption │
│ View All → Modal with all options     │
└───────────────────────────────┘
        ↓
    Share Button Pressed
        ↓
ShareableShortNewsImage
        ↓
┌───────────────────────────────┐
│ Fetch top options for image   │
│ Generate image with:           │
│  - Article content (top 80%)   │
│  - Options/Caption (bottom 20%)│
│ Share via WhatsApp/Social      │
└───────────────────────────────┘
```

---

## ✅ Testing Checklist

### Basic Functionality
- [ ] Create option (POSITIVE type)
- [ ] Create option (NEGATIVE type)
- [ ] View counts update in real-time
- [ ] Top 3 options display correctly
- [ ] "View all" shows complete list
- [ ] Edit existing option
- [ ] Delete option with confirmation
- [ ] Error handling for duplicate option
- [ ] Error handling for >50 characters

### Share Functionality
- [ ] Share with options (includes counts + top 2)
- [ ] Share with caption only (no options)
- [ ] Share with both caption and options (options take priority)
- [ ] Image generation quality (600x600, clear text)
- [ ] WhatsApp share works
- [ ] Social media share works

### Edge Cases
- [ ] No options yet (shows add button)
- [ ] Exactly 1 option (no "view all" button)
- [ ] 100+ options (pagination/performance)
- [ ] Very long usernames in options list
- [ ] Special characters in option content
- [ ] Network errors during API calls
- [ ] Simultaneous edits by multiple users

---

## 🐛 Common Issues & Solutions

### Issue: "You already posted an option"
**Solution:** Check if user has existing option before allowing create. Use `getMyShortNewsOption()` first.

### Issue: Option not appearing in list
**Solution:** Reload options list after create/update. Call `loadTopOptions()` and `loadData()` after successful submission.

### Issue: Share image not including options
**Solution:** Ensure `optionCounts` state is set before opening share modal. Check `onCountsChange` callback is wired up.

### Issue: "content must be 50 characters or less"
**Solution:** Add client-side validation with `maxLength={50}` on TextInput and character counter.

---

## 📝 Type Definitions

```typescript
// Option Type
type ShortNewsOptionType = 'POSITIVE' | 'NEGATIVE';

// Option Object
interface ShortNewsOption {
  id: string;
  shortNewsId: string;
  userId: string;
  type: ShortNewsOptionType;
  content: string;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    name: string;
    profilePhotoUrl?: string;
  };
  shortNews?: {
    id: string;
    title: string;
    content: string;
    mediaUrls: string[];
    createdAt: string;
  };
}

// Counts Object
interface ShortNewsOptionCounts {
  shortNewsId: string;
  positive: number;
  negative: number;
  total: number;
}

// Create Input
interface CreateShortNewsOptionInput {
  shortNewsId: string;
  content: string;
  type?: ShortNewsOptionType; // defaults to POSITIVE
}

// Update Input
interface UpdateShortNewsOptionInput {
  content: string;
}
```

---

## 🚀 Quick Start

1. **Import necessary APIs:**
   ```typescript
   import {
     createShortNewsOption,
     getShortNewsOptionCounts,
     getShortNewsOptions,
     getMyShortNewsOption,
   } from '@/services/api';
   ```

2. **Add ShortNewsOptions component:**
   ```tsx
   <ShortNewsOptions 
     shortNewsId={article.id}
     onCountsChange={setCounts}
   />
   ```

3. **Enable sharing with options:**
   ```tsx
   <ShareableShortNewsImage
     shortNews={{
       ...articleData,
       options: counts ? {
         positive: counts.positive,
         negative: counts.negative,
         total: counts.total,
       } : undefined,
     }}
   />
   ```

That's it! The feature is now fully integrated. 🎉

---

## 📞 Support

For backend API issues, contact backend team.
For frontend issues, check:
- `/components/ShortNewsOptions.tsx`
- `/components/ShareableShortNewsImage.tsx`
- `/components/ArticlePage.tsx`
- `/services/api.ts` (lines 2860+)
