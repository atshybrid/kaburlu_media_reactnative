import { create } from 'zustand';
import { chatApi } from '../api/chat';
import { setAuthToken } from '../api/httpClient';
import { firebaseSignInWithCustomToken } from '../services/firebase';
import { Chat, ChatMessageState, EnsureDirectChatResponse, FamilyChatResponse, Message, MessageMap, UserProfile } from '../types/chat';

export interface ChatState {
  user?: UserProfile;
  chats: Record<string, Chat>;
  directChatIds: string[]; // separate ordering if needed
  familyChatId?: string;
  activeChatId?: string;
  messages: Record<string, ChatMessageState>; // key: chatId
  initializing: boolean;
  firebaseReady: boolean;
  error?: string;
  // Actions
  setActiveChat: (chatId: string) => void;
  upsertMessages: (chatId: string, msgs: Message[], opts?: { prepend?: boolean }) => void;
  optimisticAddMessage: (chatId: string, temp: Message) => void;
  replaceMessage: (chatId: string, real: Message, tempId?: string) => void;
  initFamily: (opts?: { force?: boolean }) => Promise<void>;
  ensureDirectChat: (targetUserId: string) => Promise<EnsureDirectChatResponse>;
  signInFirebase: () => Promise<void>;
}

function mergeMessages(existing: ChatMessageState | undefined, incoming: Message[], prepend = false): ChatMessageState {
  const state: ChatMessageState = existing || { ids: [], byId: {} as MessageMap };
  for (const m of incoming) {
    state.byId[m.id] = { ...(state.byId[m.id] || {}), ...m };
  }
  const newIds = incoming.map(m => m.id);
  if (prepend) {
    // maintain order oldest -> newest; assume existing.ids already oldest->newest
    const set = new Set(state.ids);
    const combined = [...newIds.filter(id => !set.has(id)), ...state.ids];
    state.ids = combined.sort((a, b) => state.byId[a].createdAt - state.byId[b].createdAt);
  } else {
    const set = new Set(state.ids);
    for (const id of newIds) if (!set.has(id)) state.ids.push(id);
    state.ids.sort((a, b) => state.byId[a].createdAt - state.byId[b].createdAt);
  }
  if (state.ids.length) {
    state.oldestTimestamp = state.byId[state.ids[0]].createdAt;
    state.newestTimestamp = state.byId[state.ids[state.ids.length - 1]].createdAt;
  }
  return { ...state };
}

export const useChatStore = create<ChatState>((set: any, get: () => ChatState) => ({
  user: undefined,
  chats: {},
  directChatIds: [],
  familyChatId: undefined,
  activeChatId: undefined,
  messages: {},
  initializing: false,
  firebaseReady: false,
  error: undefined,
  setActiveChat: (chatId: string) => set({ activeChatId: chatId }),
  upsertMessages: (chatId: string, msgs: Message[], opts?: { prepend?: boolean }) => set((state: ChatState) => ({
    messages: { ...state.messages, [chatId]: mergeMessages(state.messages[chatId], msgs, !!opts?.prepend) },
  })),
  optimisticAddMessage: (chatId: string, temp: Message) => set((state: ChatState) => {
    const existing = state.messages[chatId];
    return { messages: { ...state.messages, [chatId]: mergeMessages(existing, [temp]) } };
  }),
  replaceMessage: (chatId: string, real: Message, tempId?: string) => set((state: ChatState) => {
    const slice = state.messages[chatId];
    if (!slice) return {};
    if (tempId && slice.byId[tempId]) {
      // Replace id
      delete slice.byId[tempId];
      slice.ids = slice.ids.filter(i => i !== tempId);
    }
    const merged = mergeMessages(slice, [real]);
    return { messages: { ...state.messages, [chatId]: merged } };
  }),
  signInFirebase: async () => {
    // Acquire custom token from backend then sign in.
    const tokenResp = await chatApi.getChatToken();
    await firebaseSignInWithCustomToken(tokenResp.token);
    set({ firebaseReady: true });
  },
  initFamily: async ({ force }: { force?: boolean } = {}) => {
    if (get().initializing && !force) return;
    set({ initializing: true, error: undefined });
    try {
      const resp: FamilyChatResponse = await chatApi.getFamilyChat();
      const chats: Record<string, Chat> = { [resp.familyChat.id]: resp.familyChat };
      const directIds: string[] = [];
      (resp.directChats || []).forEach(c => { chats[c.id] = c; directIds.push(c.id); });
      set({
        user: resp.user,
        chats,
        directChatIds: directIds,
        familyChatId: resp.familyChat.id,
        activeChatId: resp.familyChat.id,
        initializing: false,
      });
    } catch (e: any) {
      set({ error: e?.message || 'Failed to load family chat', initializing: false });
    }
  },
  ensureDirectChat: async (targetUserId: string) => {
    const resp = await chatApi.ensureDirectChat(targetUserId);
    const chatId = resp.chatId;
    const chats = { ...get().chats };
    if (!chats[chatId]) {
      // minimal placeholder until refreshed by family fetch or separate fetch
      chats[chatId] = { id: chatId, type: 'DIRECT', createdAt: Date.now() } as Chat;
    }
    set((state: ChatState) => ({ chats, directChatIds: state.directChatIds.includes(chatId) ? state.directChatIds : [...state.directChatIds, chatId] }));
    return resp;
  },
}));

// Helper to configure auth token (backend session/JWT) early in app bootstrap
export function bootstrapChatAuth(sessionToken: string) {
  setAuthToken(sessionToken);
}
