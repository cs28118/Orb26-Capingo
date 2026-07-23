import { useCallback, useEffect, useRef, useState } from 'react';
import './chatbot.css';
import { triggerToast } from '../components/NotiHelper';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { checkAndUnlockAchievements } from '../utils/achievementCheck';

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

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
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

type ApiMessage = { role: 'user' | 'assistant'; content: string };

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
  return messages.map((m) => ({ role: m.role, content: m.content }));
}

function getRecentMessages(messages: Message[]): ApiMessage[] {
  if (messages.length <= RECENT_WINDOW) return toApiMessages(messages);
  return toApiMessages(messages.slice(-RECENT_WINDOW));
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
    const batchEnd = Math.min(memoryUpToIndex + SUMMARIZE_BATCH, summarizeEnd);
    const batch = toApiMessages(chat.messages.slice(memoryUpToIndex, batchEnd));

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
        const newlyUnlockedIds = checkAndUnlockAchievements(data.profile);
        if (newlyUnlockedIds.length > 0) {
          await fetch(`${import.meta.env.VITE_API_URL}/api/profile/unlock-achievements`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uid, newAchievementIds: newlyUnlockedIds })
          });
        }
      }
    } catch (err) {
      console.error("Failed to award Chat XP", err);
    }
};

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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      if (!user) setIsLoadingChats(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!firebaseUser) return;

    setIsLoadingChats(true);

    const loadChats = async () => {
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
      id: `msg_${Date.now()}`,
      role: 'user',
      content: trimmed,
      createdAt: Date.now(),
    };

    const chatBefore = currentChats.find((c) => c.id === chatId)!;
    const title =
      chatBefore.messages.length === 0 ? truncateTitle(trimmed) : chatBefore.title;

    const withUser: Chat = {
      ...chatBefore,
      title,
      messages: [...chatBefore.messages, userMessage],
      updatedAt: Date.now(),
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
        withUser.memorySummary = memorySummary;
        withUser.memoryUpToIndex = memoryUpToIndex;
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
          memorySummary,
          messages: getRecentMessages(withUser.messages),
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || `Request failed (${res.status})`);
      }

      const assistantMessage: Message = {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: data.reply || '(No response)',
        createdAt: Date.now(),
      };

      chatToPersist = {
        ...withUser,
        memorySummary,
        memoryUpToIndex,
        messages: [...withUser.messages, assistantMessage],
        updatedAt: Date.now(),
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
        <div className="chatbot-loading">Loading your conversations...</div>
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
          <button type="button" className="chat-subheader-new" onClick={handleNewChat}>
            New chat
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
              <button type="button" className="chat-recent-item active" onClick={handleNewChat}>
                <span className="chat-recent-item-icon">💬</span>
                <div className="chat-recent-item-body">
                  <span className="chat-recent-item-title">New chat</span>
                  <span className="chat-recent-item-time">Today</span>
                </div>
              </button>
            ) : (
              sortedChats.map((chat) => (
                <button
                  key={chat.id}
                  type="button"
                  className={`chat-recent-item ${chat.id === activeChatId ? 'active' : ''}`}
                  onClick={() => handleSelectChat(chat.id)}
                >
                  <span className="chat-recent-item-icon">{chat.pinned ? '📌' : '💬'}</span>
                  <div className="chat-recent-item-body">
                    <span className="chat-recent-item-title">{chat.title}</span>
                    <span className="chat-recent-item-time">{formatRelativeTime(chat.updatedAt)}</span>
                  </div>
                </button>
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
