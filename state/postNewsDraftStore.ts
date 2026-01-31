import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

// AsyncStorage keys to clear when resetting post news draft
const POST_NEWS_ASYNC_KEYS = [
  'AI_REWRITE_RESPONSE',
  'AI_REWRITE_TENANT_ID',
  'AI_REWRITE_LANGUAGE',
  'SELECTED_LOCATION',
  'UPLOADED_PHOTOS',
  'UPLOADED_VIDEO',
  'FORMATTED_DATELINE',
] as const;

/** Clear all AsyncStorage keys related to post-news flow */
export async function clearPostNewsAsyncStorage(): Promise<void> {
  try {
    await Promise.all(POST_NEWS_ASYNC_KEYS.map((key) => AsyncStorage.removeItem(key)));
    console.log('[PostNews] Cleared AsyncStorage keys:', POST_NEWS_ASYNC_KEYS.join(', '));
  } catch (e) {
    console.warn('[PostNews] Failed to clear AsyncStorage:', e);
  }
}

export type DraftLocation = {
  latitude: number;
  longitude: number;
  label?: string;
  source?: 'gps' | 'manual' | 'geocode' | 'unknown';
};

export type DraftDateLine = {
  locationId: string;
  locationType?: string;
  nameEn: string;
  nameLocalized?: string;
  text?: string;
};

export type PostNewsDraft = {
  languageId?: string;
  languageCode?: string;
  categoryId?: string;
  categoryName?: string;
  categorySlug?: string;
  title: string;
  subtitle?: string;
  locationQuery?: string;
  dateLine?: DraftDateLine | null;
  bullets: string[];
  body: string;

  coverImageUri?: string;
  coverCaption?: string;
  imageUris: string[];

  // Step-3 optional media
  videoUri?: string;
};

const emptyDraft: PostNewsDraft = {
  categoryId: undefined,
  categoryName: undefined,
  categorySlug: undefined,
  title: '',
  subtitle: undefined,
  locationQuery: '',
  dateLine: null,
  bullets: [],
  body: '',
  coverImageUri: undefined,
  coverCaption: undefined,
  imageUris: [],

  videoUri: undefined,
};

export type PostNewsDraftState = {
  draft: PostNewsDraft;
  justPosted: boolean;
  setDraft: (patch: Partial<PostNewsDraft>) => void;
  resetDraft: () => void;
  setBullets: (bullets: string[]) => void;
  setImageUris: (imageUris: string[]) => void;
  setJustPosted: (val: boolean) => void;
};

export const usePostNewsDraftStore = create<PostNewsDraftState>((set) => ({
  draft: emptyDraft,
  justPosted: false,
  setDraft: (patch) => set((s) => ({ draft: { ...s.draft, ...patch } })),
  // Keep justPosted flag intact during reset - it will be cleared when user enters post-news fresh
  // Also clear AsyncStorage keys to prevent old images from appearing
  resetDraft: () => {
    clearPostNewsAsyncStorage(); // Fire and forget async clear
    return set((s) => ({ draft: emptyDraft, justPosted: s.justPosted }));
  },
  setBullets: (bullets) => set((s) => ({ draft: { ...s.draft, bullets } })),
  setImageUris: (imageUris) => set((s) => ({ draft: { ...s.draft, imageUris } })),
  setJustPosted: (val) => set({ justPosted: val }),
}));
