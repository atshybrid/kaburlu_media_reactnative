# Article Layout 3 Component

This document explains how to use the new `ArticleCardLayout3` and sample `ArticlesLayout3Screen`.

## Files
- `components/articleLayouts/ArticleCardLayout3.tsx` – Presentational card.
- `app/article/ArticlesLayout3Screen.tsx` – Demo FlatList screen.

## Props (ArticleLayout3)
```
id: string;
topCols?: string[];        // Up to 4 small top tokens (edition, issue, day, place...)
category?: string;          // Small muted category label
subtitle?: string;          // Orange (or rule-based) short line above title
titleLine?: string;         // Main large headline
excerpt?: string;           // Body preview / lead
imageUrl?: string;          // 16:9 image URL
authorName?: string;
reporterType?: 'citizen' | 'newspaper';
reporterLogo?: string;      // For newspaper type
reporterProfilePic?: string;// For citizen reporter
brandName?: string;         // Publication / brand
location?: string;          // City / place
time?: string;              // Timestamp string (already formatted)
likes?: number;
comments?: number;
shares?: number;
// Color overrides (optional)
titleColor?: string;
subtitleColor?: string;
// For dynamic title color inference
metaTitle?: string;
tags?: string[];
```

## Dynamic Title Colors
If you do not pass `titleColor` / `subtitleColor`, the component uses `pickTitleColorTheme()` from `TitleColorRules.ts` with `{ title, metaTitle, tags }`. Add or modify keyword rules there for brand-specific color palettes.

## Basic Usage
```tsx
import ArticleCardLayout3 from '../../components/articleLayouts/ArticleCardLayout3';

<ArticleCardLayout3
  item={{
    id: 'sample-1',
    topCols: ['సంపుటి:1', 'సంచిక:3', 'గురువారం', 'కామారెడ్డి'],
    category: 'వినోదం.',
    subtitle: 'ఒకేసారి మూడు రకాల సమన్వయలు చుట్టుముట్టాయి',
    titleLine: 'సమన్త',
    excerpt: 'ఒకేసారి మూడు రకాల సమన్వయలు చుట్టుముట్టాయి.. ఎంతో భాధపడగా... ',
    imageUrl: 'https://picsum.photos/1200/675?random=21',
    authorName: 'Reporter Name',
    reporterType: 'newspaper',
    reporterLogo: 'https://picsum.photos/200/200?random=22',
    brandName: 'KhabarX',
    location: 'Hyderabad',
    time: '5:50 PM',
    likes: 230,
    comments: 10,
    shares: 43,
    tags: ['bjp'],
  }}
/>
```

## Event Handlers
Optional props:
- `onPress(item)` – Card tap
- `onLikeToggle(item, liked, totalLikes)` – User toggles like
- `onCommentPress(item)` – Comments button tap
- `onSharePress(item)` – Share button tap
- `compact` – Smaller paddings & fonts

## Theming
Currently uses a placeholder `scheme = 'light'`. Replace with your existing theme hook (`useColorScheme` or custom) and supply correct palette from `Colors`.

## Extending
- Add skeleton loader by swapping image block when `!imageUrl` or while loading.
- Wrap in a higher-level list that loads more articles via pagination.
- Preprocess `time` into relative format (e.g., "5m ago") before passing.

## TODO Markers
- Integrate real theme detection.
- Add Press effects / animations for like toggle.
- Accessibility: localize labels (current text hard-coded in Telugu/English mix).

---
Drop this screen into a route (e.g., `app/article/layout3.tsx` that re-exports) to preview quickly.
