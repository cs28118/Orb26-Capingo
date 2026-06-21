import { useCallback, useEffect, useRef, useState } from 'react';
import './chatbot.css';
import { triggerToast } from '../components/Noti';
import { getAuth, onAuthStateChanged } from 'firebase/auth';

const STORAGE_KEY = 'capingo-chats';
const RESET_MARKER = 'capingo-memory-reset-v2';

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

function loadChats(): Chat[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Chat[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveChats(chats: Chat[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
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

//function to give xp
const awardChatbotXP = async (uid: string) => {
    try {
      const response = await fetch('http://localhost:5000/api/profile/quest-action', {
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
    } catch (err) {
      console.error("Failed to award Chat XP", err);
    }
};

export default function Chatbot() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [firebaseUser, setFirebaseUser] = useState<any>(null);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setFirebaseUser(user);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!localStorage.getItem(RESET_MARKER)) {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.setItem(RESET_MARKER, '1');
      setChats([]);
      setActiveChatId(null);
      return;
    }
    const stored = loadChats();
    setChats(stored);
    if (stored.length > 0) {
      const sorted = [...stored].sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return b.updatedAt - a.updatedAt;
      });
      setActiveChatId(sorted[0].id);
    }
  }, []);

  useEffect(() => {
    if (chats.length > 0) saveChats(chats);
  }, [chats]);

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

  const handleNewChat = () => {
    const chat = createChat();
    setChats((prev) => [chat, ...prev]);
    setActiveChatId(chat.id);
    setInput('');
    setError(null);
  };

  const togglePin = (chatId: string) => {
    updateChat(chatId, (c) => ({ ...c, pinned: !c.pinned }));
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

      updateChat(chatId, (c) => ({
        ...c,
        memorySummary,
        memoryUpToIndex,
        messages: [...c.messages, assistantMessage],
        updatedAt: Date.now(),
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get a response');
    } finally {
      setIsLoading(false);
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
                  onClick={() => {
                    setActiveChatId(chat.id);
                    setError(null);
                  }}
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
          {!hasMessages ? (
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
