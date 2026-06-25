import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import './flashcard.css';
import { triggerToast } from '../components/NotiHelper';
import type { User } from 'firebase/auth';

const STORAGE_KEY = 'capingo-flashcard-decks';

type Difficulty = 'basic' | 'standard' | 'advanced';
type ViewMode = 'library' | 'upload' | 'edit' | 'study';

type Flashcard = {
  id: string;
  front: string;
  back: string;
  createdAt: number;
  updatedAt?: number;
};

type FlashcardDeck = {
  id: string;
  title: string;
  sourceFileName?: string;
  pageCount?: number;
  cards: Flashcard[];
  createdAt: number;
  updatedAt: number;
  pinned?: boolean;
};

type ParsedPdf = {
  fileName: string;
  pageCount: number;
  charCount: number;
  text: string;
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

function loadDecksFromStorage(): FlashcardDeck[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as FlashcardDeck[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveDecksToStorage(decks: FlashcardDeck[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(decks));
}

function createCard(front = '', back = ''): Flashcard {
  return {
    id: `card_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    front,
    back,
    createdAt: Date.now(),
  };
}

function createDeck(title: string, cards: Flashcard[], meta?: Partial<FlashcardDeck>): FlashcardDeck {
  const now = Date.now();
  return {
    id: `deck_${now}`,
    title,
    cards,
    createdAt: now,
    updatedAt: now,
    ...meta,
  };
}

function getApiBase(): string {
  const url = import.meta.env.VITE_API_URL;
  if (url) return url.replace(/\/$/, '');
  return '';
}

function isPdfFile(file: File): boolean {
  const name = file.name.toLowerCase();
  const type = (file.type || '').toLowerCase();
  return (
    name.endsWith('.pdf') ||
    type === 'application/pdf' ||
    type === 'application/x-pdf' ||
    type === 'application/octet-stream' ||
    type === ''
  );
}

async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export default function Flashcards() {
  const [decks, setDecks] = useState<FlashcardDeck[]>(() => {
  const stored = loadDecks();
  
  if (stored.length > 0) {
    return [...stored].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return b.updatedAt - a.updatedAt;
    });
  }
  return stored;
  });
  const [activeDeckId, setActiveDeckId] = useState<string | null>(
  decks.length > 0 ? decks[0].id : null
  );
  const [mode, setMode] = useState<ViewMode>('library');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingDecks, setIsLoadingDecks] = useState(true);
  const [saveError, setSaveError] = useState('');
  const skipSaveRef = useRef(true);

  const [parsedPdf, setParsedPdf] = useState<ParsedPdf | null>(null);
  const [cardCount, setCardCount] = useState(20);
  const [difficulty, setDifficulty] = useState<Difficulty>('standard');
  const [deckTitle, setDeckTitle] = useState('');

  const [studyIndex, setStudyIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [shuffledIds, setShuffledIds] = useState<string[] | null>(null);

  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      if (!user) setIsLoadingDecks(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!firebaseUser) return;

    setIsLoadingDecks(true);

    const fetchDecks = async () => {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/api/decks/${firebaseUser.uid}`
        );
        if (!response.ok) throw new Error('Failed to load decks');
        const data = await response.json();
        let loaded: FlashcardDeck[] = data.decks ?? [];

        if (loaded.length === 0) {
          const localDecks = loadDecksFromStorage();
          if (localDecks.length > 0) {
            loaded = localDecks;
            await fetch(`${import.meta.env.VITE_API_URL}/api/decks/${firebaseUser.uid}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ decks: loaded }),
            });
            localStorage.removeItem(STORAGE_KEY);
          }
        }

        setDecks(loaded);
        if (loaded.length > 0) {
          const sorted = [...loaded].sort((a, b) => {
            if (a.pinned && !b.pinned) return -1;
            if (!a.pinned && b.pinned) return 1;
            return b.updatedAt - a.updatedAt;
          });
          setActiveDeckId(sorted[0].id);
        }
        setSaveError('');
      } catch (err) {
        console.error('Error loading decks:', err);
        const localDecks = loadDecksFromStorage();
        setDecks(localDecks);
        if (localDecks.length > 0) {
          const sorted = [...localDecks].sort((a, b) => b.updatedAt - a.updatedAt);
          setActiveDeckId(sorted[0].id);
        }
        setSaveError('Could not load decks from the server. Showing local copies.');
      } finally {
        skipSaveRef.current = true;
        setIsLoadingDecks(false);
      }
    };

    fetchDecks();
  }, [firebaseUser]);

  useEffect(() => {
    if (!firebaseUser || isLoadingDecks) return;

    if (skipSaveRef.current) {
      skipSaveRef.current = false;
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/api/decks/${firebaseUser.uid}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ decks }),
          }
        );
        if (!response.ok) throw new Error('Failed to save decks');
        setSaveError('');
      } catch (err) {
        console.error('Error saving decks:', err);
        saveDecksToStorage(decks);
        setSaveError('Could not save to the server. A local backup was kept.');
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [firebaseUser, isLoadingDecks, decks]);

  const awardFlashcardXP = async (uid: string, actionType: 'reviewDeck' | 'createDeck') => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/profile/quest-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: uid,
          actionType: actionType
        })
      });
      const data = await response.json();
      if (data.message && data.message.includes('XP')) {
        triggerToast('quest', 'QUEST', data.message);
      } else if (data.message && data.message.includes('cap')) {
        const capMessage = actionType === 'reviewDeck' ? 'Flashcard review quest capped!' : 'Deck creation quest capped!';
        triggerToast('quest', 'QUEST', capMessage);
      }
      if (data.leveledUp) {
        triggerToast('levelup', 'LEVEL UP!', `Level ${data.profile.level} Reached!`);
      }
    } catch (err) {
      console.error("Failed to award XP", err);
    }
  };

  const activeDeck = decks.find((d) => d.id === activeDeckId) ?? null;

  const sortedDecks = useMemo(
    () =>
      [...decks].sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return b.updatedAt - a.updatedAt;
      }),
    [decks]
  );

  const studyCards = useMemo(() => {
    if (!activeDeck) return [];
    if (!shuffledIds) return activeDeck.cards;
    const map = new Map(activeDeck.cards.map((c) => [c.id, c]));
    return shuffledIds.map((id) => map.get(id)).filter(Boolean) as Flashcard[];
  }, [activeDeck, shuffledIds]);

  const updateDeck = useCallback((deckId: string, updater: (deck: FlashcardDeck) => FlashcardDeck) => {
    setDecks((prev) => prev.map((d) => (d.id === deckId ? updater(d) : d)));
  }, []);

  const handleNewDeck = () => {
    setMode('upload');
    setParsedPdf(null);
    setDeckTitle('');
    setCardCount(20);
    setDifficulty('standard');
    setError(null);
    setActiveDeckId(null);
  };

  const handleSelectDeck = (deckId: string) => {
    setActiveDeckId(deckId);
    setMode('library');
    setError(null);
    setShuffledIds(null);
    setStudyIndex(0);
    setFlipped(false);
  };

  const handleDeleteDeck = (deckId: string) => {
    setDecks((prev) => prev.filter((d) => d.id !== deckId));
    if (activeDeckId === deckId) {
      setActiveDeckId(null);
      setMode('library');
    }
  };

  const handleTogglePin = (deckId: string) => {
    updateDeck(deckId, (d) => ({ ...d, pinned: !d.pinned, updatedAt: Date.now() }));
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isPdfFile(file)) {
      setError('Please choose a PDF file (.pdf).');
      e.target.value = '';
      return;
    }

    const maxBytes = 10 * 1024 * 1024;
    if (file.size > maxBytes) {
      setError('PDF must be under 10 MB.');
      e.target.value = '';
      return;
    }

    setError(null);
    setIsLoading(true);
    setParsedPdf(null);

    try {
      const pdfBase64 = await fileToBase64(file);

      const res = await fetch(`${getApiBase()}/api/flashcards/parse-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pdfBase64,
          fileName: file.name,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Parse failed (${res.status})`);

      setParsedPdf({
        fileName: data.fileName,
        pageCount: data.pageCount,
        charCount: data.charCount,
        text: data.text,
      });
      setDeckTitle(data.fileName.replace(/\.pdf$/i, ''));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse PDF');
    } finally {
      setIsLoading(false);
      e.target.value = '';
    }
  };

  const handleGenerate = async () => {
    if (!parsedPdf) return;

    setError(null);
    setIsLoading(true);

    try {
      const res = await fetch(`${getApiBase()}/api/flashcards/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: parsedPdf.text,
          cardCount,
          difficulty,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Generate failed (${res.status})`);

      const cards: Flashcard[] = (data.cards ?? []).map(
        (c: { front: string; back: string }) => createCard(c.front, c.back)
      );

      if (cards.length === 0) throw new Error('No flashcards were generated.');

      const deck = createDeck(deckTitle.trim() || parsedPdf.fileName, cards, {
        sourceFileName: parsedPdf.fileName,
        pageCount: parsedPdf.pageCount,
      });

      setDecks((prev) => [deck, ...prev]);
      setActiveDeckId(deck.id);
      setMode('edit');
      setParsedPdf(null);
      if (firebaseUser) {
        awardFlashcardXP(firebaseUser.uid, 'createDeck');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate flashcards');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateCard = (deckId: string, cardId: string, field: 'front' | 'back', value: string) => {
    updateDeck(deckId, (d) => ({
      ...d,
      updatedAt: Date.now(),
      cards: d.cards.map((c) =>
        c.id === cardId ? { ...c, [field]: value, updatedAt: Date.now() } : c
      ),
    }));
  };

  const handleDeleteCard = (deckId: string, cardId: string) => {
    updateDeck(deckId, (d) => ({
      ...d,
      updatedAt: Date.now(),
      cards: d.cards.filter((c) => c.id !== cardId),
    }));
    if (studyIndex >= studyCards.length - 1) {
      setStudyIndex(Math.max(0, studyCards.length - 2));
    }
  };

  const handleAddCard = (deckId: string) => {
    updateDeck(deckId, (d) => ({
      ...d,
      updatedAt: Date.now(),
      cards: [...d.cards, createCard()],
    }));
  };

  const handleRenameDeck = (deckId: string, title: string) => {
    updateDeck(deckId, (d) => ({ ...d, title: title.trim() || d.title, updatedAt: Date.now() }));
  };

  const handleFinishStudy = () => {
    if (firebaseUser) {
      awardFlashcardXP(firebaseUser.uid,'reviewDeck');
    }
    setMode('library'); // Takes them back to the deck screen
  };

  const startStudy = () => {
    if (!activeDeck || activeDeck.cards.length === 0) return;
    setShuffledIds(null);
    setStudyIndex(0);
    setFlipped(false);
    setMode('study');
  };

  const shuffleStudy = () => {
    if (!activeDeck) return;
    const ids = [...activeDeck.cards].sort(() => Math.random() - 0.5).map((c) => c.id);
    setShuffledIds(ids);
    setStudyIndex(0);
    setFlipped(false);
  };

  const goStudyPrev = () => {
    setFlipped(false);
    setStudyIndex((i) => Math.max(0, i - 1));
  };

  const goStudyNext = () => {
    setFlipped(false);
    setStudyIndex((i) => Math.min(studyCards.length - 1, i + 1));
  };

  const renderMain = () => {
    if (mode === 'upload') {
      return (
        <div className="flashcard-upload-panel">
          <h2 style={{ marginTop: 0 }}>Upload PDF notes</h2>
          <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>
            Capingo AI will read your notes and create flashcards using Ollama on your computer.
          </p>

          {error && <div className="flashcard-error">{error}</div>}

          <label htmlFor="pdf-upload">PDF file</label>
          <input
            id="pdf-upload"
            type="file"
            accept=".pdf,application/pdf,application/x-pdf"
            onChange={handleFileChange}
            disabled={isLoading}
          />
          <p style={{ color: '#6b7280', fontSize: '0.8rem', marginTop: '-8px' }}>
            Works with Chrome &quot;Save as PDF&quot;, exported slides, and lecture notes.
          </p>

          {parsedPdf && (
            <>
              <div className="flashcard-preview">
                <strong>{parsedPdf.fileName}</strong> — {parsedPdf.pageCount} pages,{' '}
                {parsedPdf.charCount.toLocaleString()} characters
                <br />
                {parsedPdf.text.slice(0, 280)}
                {parsedPdf.text.length > 280 ? '…' : ''}
              </div>

              <label htmlFor="deck-title">Deck title</label>
              <input
                id="deck-title"
                type="text"
                value={deckTitle}
                onChange={(e) => setDeckTitle(e.target.value)}
                placeholder="e.g. Biology Chapter 3"
              />

              <label htmlFor="card-count">Number of cards</label>
              <input
                id="card-count"
                type="number"
                min={5}
                max={50}
                value={cardCount}
                onChange={(e) => setCardCount(Number(e.target.value))}
              />

              <label htmlFor="difficulty">Difficulty</label>
              <select
                id="difficulty"
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as Difficulty)}
              >
                <option value="basic">Basic — key terms</option>
                <option value="standard">Standard — concepts + examples</option>
                <option value="advanced">Advanced — exam-style questions</option>
              </select>

              <button
                type="button"
                className="flashcard-btn flashcard-btn-primary"
                onClick={handleGenerate}
                disabled={isLoading}
              >
                Generate flashcards
              </button>
            </>
          )}

          {isLoading && (
            <div className="flashcard-loading">
              {parsedPdf ? 'Generating flashcards… this may take a minute.' : 'Reading PDF…'}
            </div>
          )}
        </div>
      );
    }

    if (!activeDeck) {
      return (
        <div className="flashcard-empty">
          <h2>Create your first deck</h2>
          <p>Upload PDF notes and Capingo AI will turn them into flashcards.</p>
          <button type="button" className="flashcard-btn flashcard-btn-primary" onClick={handleNewDeck}>
            Upload PDF
          </button>
        </div>
      );
    }

    if (mode === 'study') {
      const card = studyCards[studyIndex];
      if (!card) {
        return (
          <div className="flashcard-empty">
            <h2>No cards in this deck</h2>
            <button type="button" className="flashcard-btn flashcard-btn-secondary" onClick={() => setMode('edit')}>
              Edit deck
            </button>
          </div>
        );
      }

      return (
        <div className="flashcard-study">
          <div className="flashcard-study-progress">
            Card {studyIndex + 1} of {studyCards.length}
          </div>
          <div
            className="flashcard-flip-card"
            onClick={() => setFlipped((f) => !f)}
            onKeyDown={(e) => e.key === ' ' && (e.preventDefault(), setFlipped((f) => !f))}
            role="button"
            tabIndex={0}
            aria-label="Flip flashcard"
          >
            <div className={`flashcard-flip-inner ${flipped ? 'flipped' : ''}`}>
              <div className="flashcard-flip-face front">{card.front}</div>
              <div className="flashcard-flip-face back">{card.back}</div>
            </div>
          </div>
          <p className="flashcard-study-hint">Click the card or press Space to flip</p>
          <div className="flashcard-study-controls">
            <button type="button" className="flashcard-btn flashcard-btn-secondary" onClick={goStudyPrev} disabled={studyIndex === 0}>
              Previous
            </button>
            <button type="button" className="flashcard-btn flashcard-btn-secondary" onClick={() => setFlipped((f) => !f)}>
              Flip
            </button>
            {studyIndex >= studyCards.length - 1 ? (
              <button 
                type="button" 
                className="flashcard-btn flashcard-btn-primary" 
                onClick={handleFinishStudy}
                style={{ background: '#f6d96a', color: '#3d2914', border: 'none', fontWeight: 'bold' }}
              >
                Finish (Claim daily XP)
              </button>
            ) : (
              <button type="button" className="flashcard-btn flashcard-btn-secondary" onClick={goStudyNext}>
                Next
              </button>
            )}
            <button type="button" className="flashcard-btn flashcard-btn-secondary" onClick={shuffleStudy}>
              Shuffle
            </button>
            <button type="button" className="flashcard-btn flashcard-btn-primary" onClick={() => setMode('library')}>
              Done
            </button>
          </div>
        </div>
      );
    }

    if (mode === 'edit') {
      return (
        <div className="flashcard-card-list">
          {error && <div className="flashcard-error">{error}</div>}
          {activeDeck.cards.map((card, index) => (
            <div key={card.id} className="flashcard-card-editor">
              <div className="flashcard-card-editor-header">
                <span>Card {index + 1}</span>
                <button
                  type="button"
                  className="flashcard-btn flashcard-btn-danger"
                  onClick={() => handleDeleteCard(activeDeck.id, card.id)}
                >
                  Delete
                </button>
              </div>
              <label>Front (question / term)</label>
              <textarea
                value={card.front}
                onChange={(e) => handleUpdateCard(activeDeck.id, card.id, 'front', e.target.value)}
              />
              <label>Back (answer / definition)</label>
              <textarea
                value={card.back}
                onChange={(e) => handleUpdateCard(activeDeck.id, card.id, 'back', e.target.value)}
              />
            </div>
          ))}
          <button type="button" className="flashcard-btn flashcard-btn-secondary" onClick={() => handleAddCard(activeDeck.id)}>
            + Add card
          </button>
        </div>
      );
    }

    return (
      <div className="flashcard-empty">
        <h2>{activeDeck.title}</h2>
        <p>
          {activeDeck.cards.length} cards
          {activeDeck.sourceFileName ? ` · from ${activeDeck.sourceFileName}` : ''}
        </p>
        <div className="flashcard-study-controls">
          <button type="button" className="flashcard-btn flashcard-btn-primary" onClick={startStudy}>
            Study deck
          </button>
          <button type="button" className="flashcard-btn flashcard-btn-secondary" onClick={() => setMode('edit')}>
            Edit cards
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="flashcard-page">
      {isLoadingDecks ? (
        <div className="flashcard-loading-decks">Loading your decks...</div>
      ) : (
      <>
      <aside className="flashcard-sidebar">
        <div className="flashcard-subheader">
          <span className="flashcard-subheader-title">Decks</span>
          <button type="button" className="flashcard-subheader-btn" onClick={handleNewDeck} title="New deck">
            + New
          </button>
        </div>

        <div className="flashcard-deck-list">
          <p className="flashcard-deck-heading">Your decks</p>
          {sortedDecks.length === 0 ? (
            <button type="button" className="flashcard-deck-item active" onClick={handleNewDeck}>
              <span>📄</span>
              <div className="flashcard-deck-item-body">
                <span className="flashcard-deck-item-title">Upload PDF</span>
                <span className="flashcard-deck-item-meta">Create your first deck</span>
              </div>
            </button>
          ) : (
            sortedDecks.map((deck) => (
              <button
                key={deck.id}
                type="button"
                className={`flashcard-deck-item ${deck.id === activeDeckId ? 'active' : ''}`}
                onClick={() => handleSelectDeck(deck.id)}
              >
                <span>{deck.pinned ? '📌' : '📚'}</span>
                <div className="flashcard-deck-item-body">
                  <span className="flashcard-deck-item-title">{deck.title}</span>
                  <span className="flashcard-deck-item-meta">
                    {deck.cards.length} cards · {formatRelativeTime(deck.updatedAt)}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </aside>

      <section className="flashcard-main">
        {saveError && <div className="flashcard-save-error">{saveError}</div>}
        <div className="flashcard-toolbar">
          <h2>
            {mode === 'upload'
              ? 'New deck'
              : activeDeck
                ? activeDeck.title
                : 'Flashcards'}
          </h2>
          <div className="flashcard-toolbar-actions">
            {activeDeck && mode !== 'upload' && (
              <>
                <input
                  type="text"
                  value={activeDeck.title}
                  onChange={(e) => handleRenameDeck(activeDeck.id, e.target.value)}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: '1px solid #d1d5db',
                    fontSize: '0.85rem',
                  }}
                  aria-label="Deck title"
                />
                <button type="button" className="flashcard-btn flashcard-btn-secondary" onClick={() => handleTogglePin(activeDeck.id)}>
                  {activeDeck.pinned ? 'Unpin' : 'Pin'}
                </button>
                <button type="button" className="flashcard-btn flashcard-btn-secondary" onClick={startStudy} disabled={activeDeck.cards.length === 0}>
                  Study
                </button>
                <button type="button" className="flashcard-btn flashcard-btn-secondary" onClick={() => setMode('edit')}>
                  Edit
                </button>
                <button type="button" className="flashcard-btn flashcard-btn-danger" onClick={() => handleDeleteDeck(activeDeck.id)}>
                  Delete deck
                </button>
              </>
            )}
            {mode === 'study' && (
              <button type="button" className="flashcard-btn flashcard-btn-secondary" onClick={() => setMode('library')}>
                Exit study
              </button>
            )}
            {mode === 'edit' && (
              <button type="button" className="flashcard-btn flashcard-btn-primary" onClick={() => setMode('library')}>
                Save & done
              </button>
            )}
          </div>
        </div>

        <div className="flashcard-content">{renderMain()}</div>
      </section>
      </>
      )}
    </div>
  );
}
