// Chat domain types for KaChat frontend
// These are client-side representations derived from backend + Firestore.
// Keep them minimal and evolvable. ALWAYS avoid leaking server-only fields.

export type ChatType = 'FAMILY' | 'DIRECT';

export interface Chat {
  id: string;
  type: ChatType;
  title?: string;
  createdAt: number; // epoch ms
  updatedAt?: number; // epoch ms
  memberCount?: number;
}

export interface ChatMember {
  id: string; // could be chatId_userId compound or server generated
  chatId: string;
  userId: string;
  joinedAt: number; // epoch ms
}

export type MessageType = 'TEXT'; // extend later (IMAGE, FILE, etc.)

export interface Message {
  id: string; // Firestore document id
  chatId: string;
  senderUserId: string;
  content: string;
  type: MessageType;
  createdAt: number; // epoch ms
  // Client-side helper flags (not persisted):
  pending?: boolean; // optimistic local message not yet confirmed by backend
  error?: boolean; // failed to send after retries
  sample?: boolean; // seed/demo marker from backend
}

// REST API response shapes (approximate; refine against backend schema when available)
export interface ChatTokenResponse { token: string; }

export interface FamilyChatResponse {
  familyChat: Chat;
  directChats?: Chat[];
  user: UserProfile; // current user summary
  interests?: Interest[];
}

export interface EnsureDirectChatResponse { chatId: string; created: boolean; }

export interface PostMessageRequest { chatId: string; content: string; type?: MessageType; }
export interface PostMessageResponse { id: string; chatId: string; content: string; senderUserId: string; createdAt: number; type: MessageType; }

export interface PaginatedMessagesResponse {
  messages: Message[]; // normalized
  // Optionally backend may supply paging cursors; we still use timestamp query params per spec.
  before?: number; // oldest message timestamp returned
  after?: number; // newest message timestamp returned
}

export interface Interest { code: string; label?: string; }

export interface UserProfile {
  id: string;
  displayName?: string;
  avatarUrl?: string;
  // Add lightweight fields only; do NOT add secrets.
}

export interface PublishKeysRequest {
  identityKey: string;
  signedPreKey: string;
  oneTimePreKeys: string[];
}

export interface UserKeysResponse {
  identityKey: string;
  signedPreKey: string;
  oneTimePreKeys?: string[]; // maybe truncated
}

// Generic error format (wrap HTTP fetching errors)
export interface ApiErrorShape {
  status?: number;
  code?: string;
  message: string;
  retryable?: boolean;
}

export type MessageMap = { [id: string]: Message };
export type ChatMessageState = { ids: string[]; byId: MessageMap; fullyLoaded?: boolean; oldestTimestamp?: number; newestTimestamp?: number; }; // basic normalized slice per chat

// Utility guard
export function isMessage(obj: any): obj is Message { return obj && typeof obj.id === 'string' && typeof obj.chatId === 'string'; }

// TODO: refine once backend OpenAPI / schema available.
