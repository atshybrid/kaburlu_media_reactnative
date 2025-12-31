import { collection, DocumentData, getDocs, limit, onSnapshot, orderBy, query, QueryDocumentSnapshot, startAfter, where } from 'firebase/firestore';
import { useCallback, useEffect, useRef, useState } from 'react';
import { chatApi } from '../api/chat';
import { getDb } from '../services/firebase';
import { useChatStore } from '../state/chatStore';
import { Message } from '../types/chat';

interface UseMessagesOptions { pageSize?: number; chatId?: string; }

interface UseMessagesResult {
  messages: Message[];
  loading: boolean;
  error?: string;
  sendMessage: (content: string) => Promise<void>;
  loadOlder: () => Promise<void>; // pagination
  hasMore: boolean;
}

// Normalizes Firestore docs into Message objects (assumes server populates all fields)
function docToMessage(doc: DocumentData): Message {
  const data = doc.data();
  return {
    id: doc.id,
    chatId: data.chatId,
    senderUserId: data.senderUserId,
    content: data.content,
    type: data.type || 'TEXT',
    createdAt: data.createdAt,
    sample: data.sample,
  } as Message;
}

export function useMessages(chatId?: string, opts: UseMessagesOptions = {}): UseMessagesResult {
  const pageSize = opts.pageSize || 30;
  const { upsertMessages, optimisticAddMessage, replaceMessage } = useChatStore((s: any) => ({
    upsertMessages: s.upsertMessages,
    optimisticAddMessage: s.optimisticAddMessage,
    replaceMessage: s.replaceMessage,
  }));
  const slice = useChatStore((s: any) => (chatId ? s.messages[chatId] : undefined));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const unsubscribeRef = useRef<() => void | undefined>(undefined);
  const lastDocRef = useRef<QueryDocumentSnapshot | undefined>(undefined);
  const initialLoadedRef = useRef<boolean>(false);

  // Subscribe real-time
  useEffect(() => {
    if (!chatId) return;
    const db = getDb();
    const q = query(
      collection(db, 'messages'),
      where('chatId', '==', chatId),
      orderBy('createdAt', 'desc'),
      limit(pageSize)
    );
    setLoading(true);
    unsubscribeRef.current?.();
    unsubscribeRef.current = onSnapshot(q, snap => {
      const msgs: Message[] = [];
      snap.docChanges().forEach(change => {
        const m = docToMessage(change.doc);
        msgs.push(m);
      });
      if (msgs.length) {
        // Firestore query ordering is desc; we reverse for chronological UI
        const chronological = msgs.slice().sort((a, b) => a.createdAt - b.createdAt);
        upsertMessages(chatId, chronological); // append at end
      }
      // Track last doc for pagination (oldest doc due to desc order is last in snapshot docs array)
      const docs = snap.docs;
      if (docs.length) {
        lastDocRef.current = docs[docs.length - 1];
      }
      if (!initialLoadedRef.current) {
        setLoading(false);
        initialLoadedRef.current = true;
      }
    }, (err) => {
      setError(err.message);
      setLoading(false);
    });
    return () => { unsubscribeRef.current?.(); };
  }, [chatId, pageSize, upsertMessages]);

  const sendMessage = useCallback(async (content: string) => {
    if (!chatId || !content.trim()) return;
    // optimistic
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    optimisticAddMessage(chatId, {
      id: tempId,
      chatId,
      senderUserId: 'me', // TODO: replace with store user id
      content,
      type: 'TEXT',
      createdAt: Date.now(),
      pending: true,
    });
    try {
      const resp = await chatApi.postMessage({ chatId, content, type: 'TEXT' });
      const real: Message = { ...resp, type: resp.type || 'TEXT' } as Message;
      replaceMessage(chatId, real, tempId);
    } catch (e) {
      replaceMessage(chatId, { id: tempId, chatId, senderUserId: 'me', content, type: 'TEXT', createdAt: Date.now(), error: true, pending: false }, tempId);
  }
  }, [chatId, optimisticAddMessage, replaceMessage]);

  const loadOlder = useCallback(async () => {
    if (!chatId || !lastDocRef.current) return;
    try {
      const db = getDb();
      const q = query(
        collection(db, 'messages'),
        where('chatId', '==', chatId),
        orderBy('createdAt', 'desc'),
        startAfter(lastDocRef.current),
        limit(pageSize)
      );
      const snap = await getDocs(q);
      const docs = snap.docs;
      if (docs.length) {
        lastDocRef.current = docs[docs.length - 1];
        const msgs = docs.map(d => docToMessage(d)).sort((a, b) => a.createdAt - b.createdAt);
        upsertMessages(chatId, msgs, { prepend: true });
      }
    } catch (e: any) {
      setError(e.message);
    }
  }, [chatId, pageSize, upsertMessages]);

  const hasMore = !!lastDocRef.current; // simplistic; refine with fullyLoaded flag

  return {
  messages: slice ? slice.ids.map((id: string) => slice.byId[id]) : [],
    loading,
    error,
    sendMessage,
    loadOlder,
    hasMore,
  };
}
