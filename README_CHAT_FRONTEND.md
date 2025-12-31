# KaChat Frontend Module (MVP)

This folder of new files introduces a modular chat frontend for the existing backend + Firestore realtime layer.

## Overview
Implements:
- REST integration (`api/httpClient.ts`, `api/chat.ts`)
- Firebase app init with custom token sign-in (`services/firebase.ts`)
- Zustand store for chat + messages (`state/chatStore.ts`)
- Firestore subscription + pagination hook (`hooks/useMessages.ts`)
- Basic chat UI components (`components/chat/MessageList.tsx`, `MessageInput.tsx`)
- Screens for family chat + direct chat list + individual direct chat (`app/kachat/*`)
- Shared types (`types/chat.ts`)

## Integration Sequence
1. Obtain backend session/JWT via your existing auth flow (mobile login, etc.). Call `bootstrapChatAuth(sessionToken)` early (e.g., post-login) to set Authorization header for REST.
2. Call `useChatStore.getState().signInFirebase()` which:
   - POST `/chat/token` (custom token)
   - `signInWithCustomToken` into Firebase Auth.
3. Load membership: `useChatStore.getState().initFamily()` which fetches `/chat/family` and seeds state.
4. Mount `FamilyChatScreen` (e.g., route: `/kachat/FamilyChatScreen`). It will:
   - Use `useMessages(familyChatId)` to subscribe to Firestore `messages` for that chat.
   - Provide optimistic send via REST `POST /chat/messages`.
5. For direct chats navigate to `DirectChatListScreen` and then dynamic `/kachat/direct/[id]` route which loads or ensures direct chat.

## Pagination Logic
- Real-time listener queries latest `pageSize` messages ordered by `createdAt desc`; reversed locally to chronological.
- Older messages: `loadOlder()` fetches additional documents via Firestore `startAfter(lastDoc)` in descending order and merges (prepends) into store.
- TODO: Add REST fallback using `/chat/messages?before=` when/if Firestore paging gaps occur.

## Optimistic Send
- A temp message with id `temp-...` is inserted (`pending: true`).
- On REST success, temp entry replaced with server version.
- On failure, message marked `error: true` for potential retry UI (not yet implemented).

## Environment / Config
- Firebase web config is derived from existing `config/firebase.ts` which already safely gathers public values.
- Base API URL: set `EXPO_PUBLIC_API_BASE_URL`.

## Dev / Internal Endpoints
Internal bootstrap endpoints intentionally omitted from `api/chat.ts`. If needed (dev only), create `api/chat.internal.ts` guarded by a `__DEV__` condition.

## Encryption (Phase 2 Placeholder)
Interfaces defined (`PublishKeysRequest`, `UserKeysResponse`); API functions included but unused. Add a new hook later to manage key publish/consumption (X3DH). DO NOT expose private keys or secrets.

## Theming / Tokens
Current UI uses placeholder dark colors. Replace with your theme system (e.g., `useThemeColor`) and tokens. Marked TODO in `MessageList` and `MessageInput`.

## Future Enhancements (Backlog)
- Typing indicator (Firestore presence doc or RTDB path)
- Message grouping + timestamps separators
- Retry failed messages
- E2EE key lifecycle
- React Query layer (if additional caching desired) vs current minimal store
- Attachment / media messages

## Minimal Usage Snippet
```tsx
import { bootstrapChatAuth, useChatStore } from '../state/chatStore';

async function startChatFlow(sessionJwt: string) {
  bootstrapChatAuth(sessionJwt);
  await useChatStore.getState().signInFirebase();
  await useChatStore.getState().initFamily();
  // Now you can navigate to FamilyChatScreen
}
```

## Testing
- Run TypeScript check (task: Typecheck TS) to ensure types pass.
- Firestore interactions rely on `firebase` modular v10 (already in deps).

## Safety / Security
- No admin credentials or private keys embedded.
- Custom token only retrieved via authenticated REST call.
- Avoid calling internal admin endpoints from production bundle.

## File Map
- `types/chat.ts` — domain types
- `api/httpClient.ts` — fetch wrapper
- `api/chat.ts` — chat REST functions
- `services/firebase.ts` — firebase init + auth helpers
- `state/chatStore.ts` — Zustand store
- `hooks/useMessages.ts` — realtime + pagination hook
- `components/chat/MessageList.tsx` — list UI
- `components/chat/MessageInput.tsx` — input UI
- `app/kachat/FamilyChatScreen.tsx` — family chat screen
- `app/kachat/DirectChatListScreen.tsx` — direct chat list
- `app/kachat/direct/[id].tsx` — direct chat view

## TODO Markers
Search for `TODO:` to refine theming, user id injection, REST fallback pagination, route typing.

---
MVP delivered. Extend as product requirements evolve.
