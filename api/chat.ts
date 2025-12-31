import {
    ChatTokenResponse,
    EnsureDirectChatResponse,
    FamilyChatResponse,
    Interest,
    PaginatedMessagesResponse,
    PostMessageRequest,
    PostMessageResponse,
    PublishKeysRequest,
    UserKeysResponse,
} from '../types/chat';
import { get, post } from './httpClient';

// Wrapper functions for chat REST endpoints. All paths relative to base API URL.

export const chatApi = {
  getChatToken: () => post<ChatTokenResponse>('/chat/token', {} , { auth: true }),
  getFamilyChat: () => get<FamilyChatResponse>('/chat/family', { auth: true }),
  ensureDirectChat: (targetUserId: string) => post<EnsureDirectChatResponse>(`/chat/direct/${encodeURIComponent(targetUserId)}`, {}, { auth: true }),
  postMessage: (data: PostMessageRequest) => post<PostMessageResponse>('/chat/messages', data, { auth: true }),
  getMessages: (chatId: string, params: { limit?: number; before?: number; after?: number } = {}) => {
    const qp = new URLSearchParams();
    qp.set('chatId', chatId);
    if (params.limit) qp.set('limit', String(params.limit));
    if (params.before) qp.set('before', String(params.before));
    if (params.after) qp.set('after', String(params.after));
    return get<PaginatedMessagesResponse>(`/chat/messages?${qp.toString()}`, { auth: true });
  },
  // Interests (optional UI)
  listInterests: () => get<{ interests: Interest[] }>('/chat/interests', { auth: true }),
  addInterest: (code: string) => post<{ ok: true; code: string }>('/chat/interests', { code }, { auth: true }),
  deleteInterest: (code: string) => post<{ ok: true }>(`/chat/interests/${encodeURIComponent(code)}`, { _method: 'DELETE' }, { auth: true }), // emulate DELETE if server expects DELETE change accordingly
  // Phase 2 crypto (placeholder)
  publishKeys: (payload: PublishKeysRequest) => post<{ ok: true }>('/chat/keys/publish', payload, { auth: true }),
  getUserKeys: (userId: string) => get<UserKeysResponse>(`/chat/keys/${encodeURIComponent(userId)}`, { auth: true }),
  consumeOneTimeKey: () => post<{ key?: string }>('/chat/keys/consume-one-time', {}, { auth: true }),
};

// NOTE: Internal bootstrap endpoints intentionally omitted here to avoid accidental client shipping.
// If needed for dev tooling, place them behind a DEV flag in a separate module (api/chat.internal.ts).
