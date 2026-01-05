import { create } from 'zustand';

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
};

export type PostNewsDraftState = {
  draft: PostNewsDraft;
  setDraft: (patch: Partial<PostNewsDraft>) => void;
  resetDraft: () => void;
  setBullets: (bullets: string[]) => void;
  setImageUris: (imageUris: string[]) => void;
};

export const usePostNewsDraftStore = create<PostNewsDraftState>((set) => ({
  draft: emptyDraft,
  setDraft: (patch) => set((s) => ({ draft: { ...s.draft, ...patch } })),
  resetDraft: () => set({ draft: emptyDraft }),
  setBullets: (bullets) => set((s) => ({ draft: { ...s.draft, bullets } })),
  setImageUris: (imageUris) => set((s) => ({ draft: { ...s.draft, imageUris } })),
}));
