import { useCallback, useEffect, useRef, useState } from 'react';
import './chatbot.css';

const STORAGE_KEY = 'capingo-chats';

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
};

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
    updatedAt: Date.now(),
  };
}

function getApiBase(): string {
  const url = import.meta.env.VITE_API_URL;
  if (url) return url.replace(/\/$/, '');
  return '';
}

export default function Chatbot() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
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

    const history = withUser.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    setIsLoading(true);
    try {
      const base = getApiBase();
      const res = await fetch(`${base}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
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
