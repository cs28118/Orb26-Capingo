import { useCallback, useEffect, useRef, useState } from 'react';
import './chatbot.css';
import { triggerToast } from '../components/NotiHelper';
import { subscribeToAuth, type AuthUser } from '../firebaseAuth/authSubscribe';
import { unlockFromProfile } from '../utils/unlockFromProfile';

const STORAGE_KEY = 'capingo-chats';

const RECENT_WINDOW = 6;
const SUMMARIZE_AFTER = 10;
const SUMMARIZE_BATCH = 8;

const SUGGESTIONS = [
  'Summarise the water cycle',
  'Give me a study plan for this week',
  'Quiz me on quadratic equations',
  "Explain Newton's 3rd law with examples",
];

const FOLLOW_UP_CHIPS = [
  'Why is this important?',
  'Give me an example',
  'Quiz me on this',
];

type ActionStatus = 'pending' | 'confirmed' | 'cancelled' | 'expired';

type Message = {
  id: string;
  role: 'user' | 'assistant' | 'action';
  content: string;
  createdAt: number;
  action?: {
    tool: string;
    args?: Record<string, unknown>;
    status: ActionStatus;
    summary?: string;
    result?: unknown;
  };
};

type Chat = {
  id: string;
  title: string;
  messages: Message[];
  pinned?: boolean;
  updatedAt: number;
  memorySummary?: string;
  memoryUpToIndex?: number;
  messageCount?: number;
};

type ChatSummary = {
  id: string;
  title: string;
  pinned?: boolean;
  updatedAt: number;
  messageCount?: number;
};

type ApiMessage =
  | { role: 'user' | 'assistant'; content: string }
  | { role: 'action'; summary: string; content?: string };

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return 'Today';
  return new Date(timestamp).toLocaleDateString();
}

function truncateTitle(text: string, max = 28): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

function renderAssistantContent(text: string) {
  const paragraphs = text.split(/\n\n+/);
  return paragraphs.map((para, i) => {
    const trimmed = para.trim();
    if (!trimmed) return null;

    if (/^\d+\.\s/m.test(trimmed)) {
      const items = trimmed.split(/\n(?=\d+\.\s)/);
      return (
        <ol key={i}>
          {items.map((item, j) => (
            <li key={j} dangerouslySetInnerHTML={{ __html: formatInline(item.replace(/^\d+\.\s*/, '')) }} />
          ))}
        </ol>
      );
    }

    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const items = trimmed.split(/\n(?=[-*]\s)/);
      return (
        <ul key={i}>
          {items.map((item, j) => (
            <li key={j} dangerouslySetInnerHTML={{ __html: formatInline(item.replace(/^[-*]\s*/, '')) }} />
          ))}
        </ul>
      );
    }

    return <p key={i} dangerouslySetInnerHTML={{ __html: formatInline(trimmed) }} />;
  });
}

function formatInline(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

function loadChatsFromStorage(): Chat[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Chat[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveChatsToStorage(chats: Chat[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
}

function summaryToChat(summary: ChatSummary): Chat {
  return {
    id: summary.id,
    title: summary.title,
    pinned: summary.pinned,
    updatedAt: summary.updatedAt,
    messages: [],
    memoryUpToIndex: 0,
    messageCount: summary.messageCount,
  };
}

function isChatFullyLoaded(chat: Chat): boolean {
  const expected = chat.messageCount ?? chat.messages.length;
  return chat.messages.length > 0 || expected === 0;
}

function createChat(): Chat {
  return {
    id: `chat_${Date.now()}`,
    title: 'New chat',
    messages: [],
    memoryUpToIndex: 0,
    updatedAt: Date.now(),
  };
}

function toApiMessages(messages: Message[]): ApiMessage[] {
  return messages.flatMap((m) => {
    if (m.role === 'user' || m.role === 'assistant') {
      return [{ role: m.role, content: m.content }];
    }
    if (m.role === 'action' && m.action?.status && m.action.status !== 'pending') {
      return [
        {
          role: 'action' as const,
          summary: m.action.summary || m.content || 'Completed an in-app action',
        },
      ];
    }
    return [];
  });
}

/** Gemini payload: recent user/assistant only. Pending actions stay out of summarization. */
function getRecentMessages(messages: Message[]): ApiMessage[] {
  const textOnly = messages.filter((m) => m.role === 'user' || m.role === 'assistant');
  if (textOnly.length <= RECENT_WINDOW) return toApiMessages(textOnly);
  return toApiMessages(textOnly.slice(-RECENT_WINDOW));
}

function isPendingAction(m: Message): boolean {
  return m.role === 'action' && m.action?.status === 'pending';
}

async function refreshMemorySummary(
  chat: Chat,
  messageCount: number,
  base: string
): Promise<{ memorySummary?: string; memoryUpToIndex: number }> {
  let memorySummary = chat.memorySummary;
  let memoryUpToIndex = chat.memoryUpToIndex ?? 0;

  if (messageCount <= SUMMARIZE_AFTER) {
    return { memorySummary, memoryUpToIndex };
  }

  const summarizeEnd = messageCount - RECENT_WINDOW;
  if (summarizeEnd <= memoryUpToIndex) {
    return { memorySummary, memoryUpToIndex };
  }

  while (memoryUpToIndex < summarizeEnd) {
    // Never fold pending action messages into memory — keep them in the live window
    if (isPendingAction(chat.messages[memoryUpToIndex])) {
      break;
    }

    const batch: ApiMessage[] = [];
    let batchEnd = memoryUpToIndex;
    while (batchEnd < summarizeEnd && batch.length < SUMMARIZE_BATCH) {
      const m = chat.messages[batchEnd];
      if (isPendingAction(m)) break;
      if (m.role === 'user' || m.role === 'assistant') {
        batch.push({ role: m.role, content: m.content });
      } else if (m.role === 'action' && m.action?.status !== 'pending') {
        batch.push({
          role: 'action',
          summary: m.action?.summary || 'Completed an in-app action',
        });
      }
      batchEnd += 1;
    }

    if (batch.length === 0) break;

    const res = await fetch(`${base}/api/summarize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ existingSummary: memorySummary, messages: batch }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `Summarize failed (${res.status})`);
    }

    memorySummary = data.summary || memorySummary;
    memoryUpToIndex = batchEnd;
  }

  return { memorySummary, memoryUpToIndex };
}

function getApiBase(): string {
  const url = import.meta.env.VITE_API_URL;
  if (url) return url.replace(/\/$/, '');
  return '';
}

async function fetchChatList(uid: string): Promise<ChatSummary[]> {
  const res = await fetch(`${getApiBase()}/api/chats/${uid}`);
  if (!res.ok) throw new Error('Failed to load chats');
  const data = await res.json();
  return data.chats ?? [];
}

async function fetchFullChat(uid: string, chatId: string): Promise<Chat> {
  const res = await fetch(`${getApiBase()}/api/chats/${uid}/${chatId}`);
  if (!res.ok) throw new Error('Failed to load chat');
  return res.json();
}

async function deleteChatOnServer(uid: string, chatId: string): Promise<void> {
  const res = await fetch(`${getApiBase()}/api/chats/${uid}/${chatId}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to delete chat');
  }
}

async function persistChat(uid: string, chat: Chat): Promise<void> {
  const res = await fetch(`${getApiBase()}/api/chats/${uid}/${chat.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: chat.title,
      pinned: chat.pinned ?? false,
      messages: chat.messages,
      memorySummary: chat.memorySummary ?? '',
      memoryUpToIndex: chat.memoryUpToIndex ?? 0,
      updatedAt: chat.updatedAt,
    }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to save chat');
  }
}

async function createChatOnServer(uid: string, chat: Chat): Promise<Chat> {
  const res = await fetch(`${getApiBase()}/api/chats/${uid}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId: chat.id, title: chat.title }),
  });
  if (!res.ok) throw new Error('Failed to create chat');
  return res.json();
}

async function migrateLocalChats(uid: string, localChats: Chat[]): Promise<void> {
  for (const chat of localChats) {
    await persistChat(uid, chat);
  }
  localStorage.removeItem(STORAGE_KEY);
}

//function to give xp
const awardChatbotXP = async (uid: string) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/profile/quest-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: uid,
          actionType: 'chatMessage' 
        })
      });
      const data = await response.json();
      if (data.message && data.message.includes('XP')) {
        triggerToast('quest', 'QUEST', data.message);
      }
      if (data.leveledUp) {
        triggerToast('levelup', 'LEVEL UP!', `Level ${data.profile.level} Reached!`);
      }
      if (data.profile) {
        await unlockFromProfile(uid, data.profile);
      }
    } catch (err) {
      console.error("Failed to award Chat XP", err);
    }
};

const getTimestamp = () => Date.now();

export default function Chatbot() {
  const [chats, setChats] = useState<Chat[]>(() => {
    const stored = loadChatsFromStorage();
    if (stored.length > 0) {
      return [...stored].sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return b.updatedAt - a.updatedAt;
      });
    }
    return stored;
  });
  const [activeChatId, setActiveChatId] = useState<string | null>(
    chats.length > 0 ? chats[0].id : null
  );
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingChats, setIsLoadingChats] = useState(true);
  const [isLoadingChat, setIsLoadingChat] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [firebaseUser, setFirebaseUser] = useState<AuthUser | null>(null);
  const proactiveClaimedRef = useRef(false);

  useEffect(() => {
    const unsubscribe = subscribeToAuth((user) => {
      setFirebaseUser(user);
      if (!user) setIsLoadingChats(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!firebaseUser) return;

    const loadChats = async () => {
      setIsLoadingChats(true);
      try {
        let summaries = await fetchChatList(firebaseUser.uid);

        if (summaries.length === 0) {
          const localChats = loadChatsFromStorage();
          if (localChats.length > 0) {
            await migrateLocalChats(firebaseUser.uid, localChats);
            summaries = await fetchChatList(firebaseUser.uid);
          }
        }

        if (summaries.length === 0) {
          setChats([]);
          setActiveChatId(null);
          setSaveError('');
          return;
        }

        const chatList = summaries.map(summaryToChat);
        const sorted = [...summaries].sort((a, b) => {
          if (a.pinned && !b.pinned) return -1;
          if (!a.pinned && b.pinned) return 1;
          return b.updatedAt - a.updatedAt;
        });
        const firstId = sorted[0].id;

        setChats(chatList);
        setActiveChatId(firstId);

        const firstSummary = sorted[0];
        if ((firstSummary.messageCount ?? 0) > 0) {
          const full = await fetchFullChat(firebaseUser.uid, firstId);
          setChats((prev) => prev.map((c) => (c.id === firstId ? full : c)));
        } else {
          const emptyChat = chatList.find((c) => c.id === firstId);
          if (emptyChat) await maybeSeedProactiveOpening(emptyChat);
        }

        setSaveError('');
      } catch (err) {
        console.error('Error loading chats:', err);
        const localChats = loadChatsFromStorage();
        setChats(localChats);
        if (localChats.length > 0) {
          const sorted = [...localChats].sort((a, b) => {
            if (a.pinned && !b.pinned) return -1;
            if (!a.pinned && b.pinned) return 1;
            return b.updatedAt - a.updatedAt;
          });
          setActiveChatId(sorted[0].id);
        }
        setSaveError('Could not load chats from the server. Showing local copies.');
      } finally {
        setIsLoadingChats(false);
      }
    };

    loadChats();
  }, [firebaseUser]);

  const activeChat = chats.find((c) => c.id === activeChatId) ?? null;

  const sortedChats = [...chats].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return b.updatedAt - a.updatedAt;
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeChat?.messages, isLoading]);

  const updateChat = useCallback((chatId: string, updater: (chat: Chat) => Chat) => {
    setChats((prev) => prev.map((c) => (c.id === chatId ? updater(c) : c)));
  }, []);

  const handleSelectChat = async (chatId: string) => {
    setActiveChatId(chatId);
    setError(null);
    if (!firebaseUser) return;

    const chat = chats.find((c) => c.id === chatId);
    if (chat && isChatFullyLoaded(chat)) return;

    setIsLoadingChat(true);
    try {
      const full = await fetchFullChat(firebaseUser.uid, chatId);
      setChats((prev) => prev.map((c) => (c.id === chatId ? full : c)));
      setSaveError('');
    } catch (err) {
      console.error('Error loading chat:', err);
      setSaveError('Could not load this conversation.');
    } finally {
      setIsLoadingChat(false);
    }
  };

  const maybeSeedProactiveOpening = async (chat: Chat): Promise<Chat> => {
    if (!firebaseUser || proactiveClaimedRef.current) return chat;
    if (chat.messages.length > 0) return chat;
    try {
      const res = await fetch(
        `${getApiBase()}/api/dashboard/recommendations/${firebaseUser.uid}/chat-nudge?claim=1`
      );
      if (!res.ok) return chat;
      const data = await res.json();
      const text = String(data.openingMessage || '').trim();
      if (!text) return chat;
      proactiveClaimedRef.current = true;
      const opening: Message = {
        id: `msg_nudge_${getTimestamp()}`,
        role: 'assistant',
        content: text,
        createdAt: getTimestamp(),
      };
      const withOpening: Chat = {
        ...chat,
        messages: [opening],
        updatedAt: getTimestamp(),
      };
      setChats((prev) => prev.map((c) => (c.id === chat.id ? withOpening : c)));
      try {
        await persistChat(firebaseUser.uid, withOpening);
      } catch (err) {
        console.error('Error saving proactive opening:', err);
      }
      return withOpening;
    } catch (err) {
      console.error('Error loading chat nudge:', err);
      return chat;
    }
  };

  const handleNewChat = async () => {
    const chat = createChat();
    setChats((prev) => [chat, ...prev]);
    setActiveChatId(chat.id);
    setInput('');
    setError(null);

    if (!firebaseUser) return;

    try {
      await createChatOnServer(firebaseUser.uid, chat);
      setSaveError('');
      await maybeSeedProactiveOpening(chat);
    } catch (err) {
      console.error('Error creating chat:', err);
      setSaveError('Could not save new chat to the server.');
    }
  };

  const togglePin = async (chatId: string) => {
    const chat = chats.find((c) => c.id === chatId);
    if (!chat) return;

    const updated: Chat = { ...chat, pinned: !chat.pinned, updatedAt: Date.now() };
    setChats((prev) => prev.map((c) => (c.id === chatId ? updated : c)));

    if (!firebaseUser) return;

    try {
      await persistChat(firebaseUser.uid, updated);
      setSaveError('');
    } catch (err) {
      console.error('Error saving pin:', err);
      setSaveError('Could not save pin change.');
    }
  };

  const [renamingChatId, setRenamingChatId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const startRenaming = (chat: Chat) => {
    setRenamingChatId(chat.id);
    setRenameValue(chat.title);
  };

  const commitRename = async (chatId: string) => {
    const chat = chats.find((c) => c.id === chatId);
    const trimmed = renameValue.trim();
    setRenamingChatId(null);
    if (!chat || !trimmed || trimmed === chat.title) return;

    const updated: Chat = { ...chat, title: trimmed, updatedAt: getTimestamp() };
    setChats((prev) => prev.map((c) => (c.id === chatId ? updated : c)));

    if (!firebaseUser) return;
    try {
      await persistChat(firebaseUser.uid, updated);
      setSaveError('');
    } catch (err) {
      console.error('Error renaming chat:', err);
      setSaveError('Could not save the new chat name.');
    }
  };

  const handleDeleteChat = async (chatId: string) => {
    const chat = chats.find((c) => c.id === chatId);
    if (!chat) return;
    if (!window.confirm(`Delete "${chat.title}"? This can't be undone.`)) return;

    const remaining = chats.filter((c) => c.id !== chatId);
    setChats(remaining);
    if (activeChatId === chatId) {
      setActiveChatId(remaining[0]?.id ?? null);
    }

    if (!firebaseUser) return;
    try {
      await deleteChatOnServer(firebaseUser.uid, chatId);
      setSaveError('');
    } catch (err) {
      console.error('Error deleting chat:', err);
      setSaveError('Could not delete this chat.');
    }
  };

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    if (firebaseUser) {
      awardChatbotXP(firebaseUser.uid);
    }

    setError(null);

    let chatId = activeChatId;
    let currentChats = chats;

    if (!chatId) {
      const chat = createChat();
      chatId = chat.id;
      currentChats = [chat, ...chats];
      setChats(currentChats);
      setActiveChatId(chatId);

      if (firebaseUser) {
        try {
          await createChatOnServer(firebaseUser.uid, chat);
        } catch (err) {
          console.error('Error creating chat:', err);
        }
      }
    }

    const userMessage: Message = {
      id: `msg_${getTimestamp()}`,
      role: 'user',
      content: trimmed,
      createdAt: getTimestamp(),
    };

    const chatBefore = currentChats.find((c) => c.id === chatId)!;
    const title =
      chatBefore.messages.length === 0 ? truncateTitle(trimmed) : chatBefore.title;

    const withUser: Chat = {
      ...chatBefore,
      title,
      messages: [...chatBefore.messages, userMessage],
      updatedAt: getTimestamp(),
    };

    setChats((prev) => {
      const exists = prev.some((c) => c.id === chatId);
      if (!exists) return [withUser, ...prev.filter((c) => c.id !== chatId)];
      return prev.map((c) => (c.id === chatId ? withUser : c));
    });
    setInput('');

    setIsLoading(true);
    let chatToPersist: Chat = withUser;

    try {
      const base = getApiBase();
      const { memorySummary, memoryUpToIndex } = await refreshMemorySummary(
        withUser,
        withUser.messages.length,
        base
      );

      if (memorySummary !== withUser.memorySummary || memoryUpToIndex !== (withUser.memoryUpToIndex ?? 0)) {
        updateChat(chatId, (c) => ({
          ...c,
          memorySummary,
          memoryUpToIndex,
        }));
      }

      const res = await fetch(`${base}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: firebaseUser?.uid,
          chatId,
          memorySummary,
          messages: getRecentMessages(withUser.messages),
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || `Request failed (${res.status})`);
      }

      const nextMessages = [...withUser.messages];
      if (data.reply) {
        nextMessages.push({
          id: `msg_${getTimestamp()}`,
          role: 'assistant',
          content: data.reply,
          createdAt: getTimestamp(),
        });
      }
      if (data.action && data.action.id) {
        nextMessages.push(data.action as Message);
      }
      if (!data.reply && !data.action) {
        nextMessages.push({
          id: `msg_${getTimestamp()}`,
          role: 'assistant',
          content: '(No response)',
          createdAt: getTimestamp(),
        });
      }

      chatToPersist = {
        ...withUser,
        memorySummary,
        memoryUpToIndex,
        messages: nextMessages,
        updatedAt: getTimestamp(),
      };

      updateChat(chatId, () => chatToPersist);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get a response');
    } finally {
      setIsLoading(false);

      if (firebaseUser) {
        try {
          await persistChat(firebaseUser.uid, chatToPersist);
          setSaveError('');
        } catch (persistErr) {
          console.error('Error saving chat:', persistErr);
          setChats((prev) => {
            const updated = prev.some((c) => c.id === chatToPersist.id)
              ? prev.map((c) => (c.id === chatToPersist.id ? chatToPersist : c))
              : [chatToPersist, ...prev];
            saveChatsToStorage(updated);
            return prev;
          });
          setSaveError('Could not save conversation to the server. A local backup was kept.');
        }
      }
    }
  };

  const patchActionMessage = (chatId: string, message: Message) => {
    setChats((prev) =>
      prev.map((c) =>
        c.id !== chatId
          ? c
          : {
              ...c,
              messages: c.messages.map((m) => (m.id === message.id ? message : m)),
              updatedAt: Date.now(),
            }
      )
    );
  };

  const confirmAction = async (messageId: string) => {
    if (!firebaseUser || !activeChatId) return;
    setActionBusyId(messageId);
    setError(null);
    try {
      const res = await fetch(
        `${getApiBase()}/api/chats/${firebaseUser.uid}/${activeChatId}/actions/${messageId}/confirm`,
        { method: 'POST' }
      );
      const data = await res.json().catch(() => ({}));
      if (data.message) patchActionMessage(activeChatId, data.message as Message);
      if (!res.ok) {
        throw new Error(data.error || 'Could not confirm action');
      }
      const tool = (data.message as Message)?.action?.tool;
      const result = (data.message as Message)?.action?.result as
        | { xpAwarded?: number }
        | undefined;
      if (tool === 'create_flashcard_deck') {
        triggerToast('quest', 'DECK', 'Flashcard deck created from chat');
      } else if (tool === 'claim_login_streak') {
        triggerToast(
          'login',
          'STREAK',
          result?.xpAwarded ? `+${result.xpAwarded} XP claimed` : 'Streak claimed'
        );
      } else {
        triggerToast(
          'quest',
          'DONE',
          (data.message as Message)?.action?.summary || 'Action confirmed'
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Confirm failed');
    } finally {
      setActionBusyId(null);
    }
  };

  const cancelAction = async (messageId: string) => {
    if (!firebaseUser || !activeChatId) return;
    setActionBusyId(messageId);
    try {
      const res = await fetch(
        `${getApiBase()}/api/chats/${firebaseUser.uid}/${activeChatId}/actions/${messageId}/cancel`,
        { method: 'POST' }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not cancel action');
      if (data.message) patchActionMessage(activeChatId, data.message as Message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cancel failed');
    } finally {
      setActionBusyId(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const hasMessages = (activeChat?.messages.length ?? 0) > 0;

  if (isLoadingChats) {
    return (
      <div className="chatbot-page">
        <div className="page-loading-state">Loading your conversations...</div>
      </div>
    );
  }

  return (
    <div className="chatbot-page">
      <aside className="chatbot-sidebar-left">
        <div className="chat-subheader">
          <span className="chat-subheader-title">Chats</span>
          <button type="button" className="chat-subheader-btn" onClick={handleNewChat} title="New chat">
            +
          </button>
          <button
            type="button"
            className="chat-subheader-btn"
            onClick={() => activeChatId && togglePin(activeChatId)}
            title="Pin chat"
          >
            📌
          </button>
        </div>

        <div className="chat-recent-section">
          <p className="chat-recent-heading">Recent</p>
          <div className="chat-recent-list">
            {sortedChats.length === 0 ? (
              <div className="chat-recent-item active">
                <button type="button" className="chat-recent-item-main" onClick={handleNewChat}>
                  <span className="chat-recent-item-icon">💬</span>
                  <div className="chat-recent-item-body">
                    <span className="chat-recent-item-title">New chat</span>
                    <span className="chat-recent-item-time">Today</span>
                  </div>
                </button>
              </div>
            ) : (
              sortedChats.map((chat) => (
                <div
                  key={chat.id}
                  className={`chat-recent-item ${chat.id === activeChatId ? 'active' : ''}`}
                >
                  <button
                    type="button"
                    className="chat-recent-item-main"
                    onClick={() => handleSelectChat(chat.id)}
                  >
                    <span className="chat-recent-item-icon">{chat.pinned ? '📌' : '💬'}</span>
                    <div className="chat-recent-item-body">
                      {renamingChatId === chat.id ? (
                        <input
                          type="text"
                          className="chat-recent-item-rename-input"
                          value={renameValue}
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onBlur={() => commitRename(chat.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitRename(chat.id);
                            if (e.key === 'Escape') setRenamingChatId(null);
                          }}
                        />
                      ) : (
                        <span className="chat-recent-item-title">{chat.title}</span>
                      )}
                      <span className="chat-recent-item-time">{formatRelativeTime(chat.updatedAt)}</span>
                    </div>
                  </button>
                  <div className="chat-recent-item-actions">
                    <button
                      type="button"
                      className="chat-recent-item-action-btn"
                      title="Rename"
                      onClick={(e) => { e.stopPropagation(); startRenaming(chat); }}
                    >
                      ✏️
                    </button>
                    <button
                      type="button"
                      className="chat-recent-item-action-btn"
                      title="Delete"
                      onClick={(e) => { e.stopPropagation(); handleDeleteChat(chat.id); }}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="chat-help-cta">Need help with anything? Ask me anything!</div>
      </aside>

      <section className="chatbot-main">
        {hasMessages && activeChat && (
          <div className="chat-title-bar">
            <h2>{activeChat.title}</h2>
            <span className="chat-title-sparkle">✨</span>
            <button
              type="button"
              className="chat-pin-btn"
              onClick={() => togglePin(activeChat.id)}
              title={activeChat.pinned ? 'Unpin' : 'Pin'}
            >
              📌
            </button>
          </div>
        )}

        <div className="chat-messages-area">
          {isLoadingChat ? (
            <div className="chatbot-loading-inline">Loading conversation...</div>
          ) : !hasMessages ? (
            <div className="chat-empty-state">
              <h2>Ask Capingo AI anything</h2>
              <p>Try one of the suggestions on the right, or type below.</p>
            </div>
          ) : (
            <div className="chat-messages-list">
              {activeChat!.messages.map((msg) =>
                msg.role === 'user' ? (
                  <div key={msg.id} className="chat-message-user">
                    {msg.content}
                  </div>
                ) : msg.role === 'action' ? (
                  <div key={msg.id} className="chat-action-card" data-status={msg.action?.status}>
                    <p className="chat-action-summary">
                      {msg.action?.summary || 'Proposed action'}
                    </p>
                    {msg.action?.status === 'pending' && (
                      <div className="chat-action-buttons">
                        <button
                          type="button"
                          className="chat-chip chat-action-confirm"
                          disabled={actionBusyId === msg.id || isLoading}
                          onClick={() => void confirmAction(msg.id)}
                        >
                          {actionBusyId === msg.id
                            ? msg.action.tool === 'create_flashcard_deck'
                              ? 'Generating…'
                              : 'Working…'
                            : 'Confirm'}
                        </button>
                        <button
                          type="button"
                          className="chat-chip chat-action-cancel"
                          disabled={actionBusyId === msg.id || isLoading}
                          onClick={() => void cancelAction(msg.id)}
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                    {msg.action?.status === 'confirmed' && (
                      <p className="chat-action-resolved">✓ Done</p>
                    )}
                    {msg.action?.status === 'cancelled' && (
                      <p className="chat-action-resolved muted">Cancelled</p>
                    )}
                    {msg.action?.status === 'expired' && (
                      <p className="chat-action-resolved muted">
                        {(msg.action.result as { error?: string } | undefined)?.error ||
                          'Expired — ask Capingo to propose again'}
                      </p>
                    )}
                  </div>
                ) : (
                  <div key={msg.id} className="chat-message-assistant">
                    {renderAssistantContent(msg.content)}
                  </div>
                )
              )}
              {isLoading && (
                <div className="chat-loading" aria-label="Loading">
                  <span />
                  <span />
                  <span />
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {saveError && <div className="chat-save-error">{saveError}</div>}
        {error && <div className="chat-error-banner">{error}</div>}

        <div className="chat-input-section">
          {hasMessages && (
            <div className="chat-followup-chips">
              {FOLLOW_UP_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  className="chat-chip"
                  disabled={isLoading}
                  onClick={() => sendMessage(chip)}
                >
                  {chip}
                </button>
              ))}
            </div>
          )}

          <form className="chat-input-row" onSubmit={handleSubmit}>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={hasMessages ? 'Ask me anything...' : 'Explain how WW2 started'}
              rows={1}
              disabled={isLoading}
            />
            <button type="submit" className="chat-send-btn" disabled={isLoading || !input.trim()} aria-label="Send">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
              </svg>
            </button>
          </form>
        </div>
      </section>

      <aside className="chatbot-sidebar-right">
        <div className="chat-ai-card">
          <img src="/capingo-logo.png" alt="Capingo AI" />
          <span>Capingo AI</span>
        </div>

        <div className="chat-try-asking">
          <h3>Try Asking</h3>
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              className="chat-suggestion-btn"
              disabled={isLoading}
              onClick={() => sendMessage(s)}
            >
              <span>{s}</span>
              <span className="chat-suggestion-arrow">→</span>
            </button>
          ))}
        </div>
      </aside>
    </div>
  );
}
