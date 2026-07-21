require('node:dns/promises').setServers(['1.1.1.1', '8.8.8.8']);
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { PDFParse } = require('pdf-parse');
const http = require('node:http');
const { Server } = require('socket.io');
require('dotenv').config();

const connectDB = require('./config/db');
const registerChatSocket = require('./models/chatSocket');
const app = express();
connectDB();
const PORT = process.env.PORT || 5000;
const ALLOWED_ORIGINS = (process.env.CLIENT_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim());
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'mistral';
const MAX_PDF_BYTES = Number(process.env.MAX_PDF_MB || 10) * 1024 * 1024;
const FLASHCARD_CHUNK_SIZE = 8000;

const SYSTEM_PROMPT = `You are Capingo AI, a friendly study co-pilot represented by a capybara mascot.
Help students learn clearly and patiently. Use markdown when helpful: **bold**, numbered lists, and short paragraphs.
Keep answers focused and educational. If asked to quiz the student, ask 2-3 questions.`;

const SUMMARIZE_PROMPT = `You compress study-chat history into a concise memory note for future replies.
Keep: topics covered, key facts taught, quiz progress, student mistakes, and open questions.
Do not invent facts. Max 250 words. Plain text only (no markdown headings).`;

const FLASHCARD_SYSTEM_PROMPT = `You are Capingo AI, a study assistant that creates high-quality flashcards from class notes.
Output ONLY valid JSON. No markdown fences, no commentary before or after the JSON.

Each flashcard must:
- front: a clear question, term, or prompt (short, one idea per card)
- back: a concise answer or definition (1-3 sentences max unless the topic requires more)

Focus on exam-relevant facts, definitions, processes, and cause-effect relationships.
Avoid trivial headers, page numbers, and duplicate cards.`;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PDF_BYTES },
  fileFilter: (_req, file, cb) => {
    const name = (file.originalname || '').toLowerCase();
    const mime = (file.mimetype || '').toLowerCase();
    const pdfMime =
      mime === 'application/pdf' ||
      mime === 'application/x-pdf' ||
      mime === 'application/acrobat' ||
      mime === 'application/octet-stream' ||
      mime === 'binary/octet-stream';
    if (pdfMime || name.endsWith('.pdf')) {
      cb(null, true);
      return;
    }
    cb(new Error('Only PDF files are allowed.'));
  },
});

async function callOllama(messages) {
  const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      messages,
      stream: false,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    const err = new Error(`Ollama returned ${response.status}`);
    err.detail = detail;
    err.status = response.status;
    throw err;
  }

  const data = await response.json();
  return data.message?.content ?? '';
}

function ollamaConnectionError(err) {
  return (
    err.cause?.code === 'ECONNREFUSED' ||
    err.message?.includes('fetch failed') ||
    err.code === 'ECONNREFUSED'
  );
}

function handleOllamaError(err, res) {
  if (ollamaConnectionError(err)) {
    return res.status(503).json({
      error: 'Cannot reach Ollama. Start the Ollama app and ensure a model is pulled (e.g. ollama pull mistral).',
    });
  }
  if (err.status) {
    return res.status(502).json({
      error: `Ollama returned ${err.status}. Check OLLAMA_MODEL (${OLLAMA_MODEL}) matches "ollama list".`,
      detail: err.detail,
    });
  }
  return res.status(500).json({ error: err.message || 'Unexpected server error' });
}

function splitTextIntoChunks(text, maxSize = FLASHCARD_CHUNK_SIZE) {
  if (text.length <= maxSize) return [text];

  const chunks = [];
  const paragraphs = text.split(/\n\s*\n/);
  let current = '';

  for (const para of paragraphs) {
    const piece = para.trim();
    if (!piece) continue;

    if (`${current}\n\n${piece}`.length > maxSize && current) {
      chunks.push(current.trim());
      current = piece;
    } else {
      current = current ? `${current}\n\n${piece}` : piece;
    }

    while (current.length > maxSize) {
      chunks.push(current.slice(0, maxSize));
      current = current.slice(maxSize);
    }
  }

  if (current.trim()) chunks.push(current.trim());
  return chunks.length > 0 ? chunks : [text.slice(0, maxSize)];
}

function parseFlashcardJson(raw) {
  let text = String(raw).trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();

  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end > start) {
    text = text.slice(start, end + 1);
  }

  const parsed = JSON.parse(text);
  const cards = parsed.cards ?? parsed.flashcards ?? parsed;
  if (!Array.isArray(cards)) {
    throw new Error('Response JSON must include a cards array.');
  }

  return cards
    .map((card) => ({
      front: String(card.front ?? card.question ?? '').trim(),
      back: String(card.back ?? card.answer ?? '').trim(),
    }))
    .filter((card) => card.front && card.back);
}

async function requestFlashcardsFromText(text, cardCount, difficulty, retryOnInvalidJson = true) {
  const difficultyGuide = {
    basic: 'basic = key terms and simple definitions only',
    standard: 'standard = concepts plus short examples',
    advanced: 'advanced = application and exam-style questions',
  };

  const userPrompt = `Create exactly ${cardCount} flashcards from the study notes below.
Difficulty: ${difficulty} (${difficultyGuide[difficulty] || difficultyGuide.standard}).

Return JSON in this shape:
{"cards":[{"front":"...","back":"..."}]}

Notes:
---
${text}
---`;

  const raw = await callOllama([
    { role: 'system', content: FLASHCARD_SYSTEM_PROMPT },
    { role: 'user', content: userPrompt },
  ]);

  try {
    return parseFlashcardJson(raw);
  } catch (err) {
    if (!retryOnInvalidJson) throw err;

    const retryRaw = await callOllama([
      { role: 'system', content: FLASHCARD_SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Your previous response was not valid JSON. Reply with JSON only in this shape:
{"cards":[{"front":"...","back":"..."}]}

Create exactly ${cardCount} flashcards from these notes (${difficulty} difficulty):
---
${text}
---`,
      },
    ]);

    return parseFlashcardJson(retryRaw);
  }
}

function dedupeCards(cards) {
  const seen = new Set();
  return cards.filter((card) => {
    const key = card.front.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function generateFlashcards(text, cardCount, difficulty) {
  const chunks = splitTextIntoChunks(text);
  const allCards = [];

  if (chunks.length === 1) {
    const cards = await requestFlashcardsFromText(chunks[0], cardCount, difficulty);
    return dedupeCards(cards).slice(0, cardCount);
  }

  const perChunk = Math.max(3, Math.ceil(cardCount / chunks.length));

  for (const chunk of chunks) {
    if (allCards.length >= cardCount) break;
    const remaining = cardCount - allCards.length;
    const requestCount = Math.min(perChunk, remaining);
    const cards = await requestFlashcardsFromText(chunk, requestCount, difficulty);
    allCards.push(...cards);
  }

  return dedupeCards(allCards).slice(0, cardCount);
}

async function extractPdfText(input) {
  const data = toPdfUint8Array(input);
  const parser = new PDFParse({ data });
  try {
    const info = await parser.getInfo({ parsePageInfo: false });
    const textResult = await parser.getText();
    const text = String(textResult.text ?? '').replace(/\s+/g, ' ').trim();
    return {
      text,
      pageCount: info.total ?? textResult.total ?? 0,
    };
  } finally {
    await parser.destroy();
  }
}

function toPdfUint8Array(input) {
  if (input instanceof Uint8Array) {
    return input;
  }
  if (Buffer.isBuffer(input)) {
    return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  }
  throw new Error('Invalid PDF data.');
}

function isPdfBuffer(buffer) {
  const bytes = toPdfUint8Array(buffer);
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46
  );
}

async function respondWithParsedPdf(buffer, fileName, res) {
  if (!isPdfBuffer(buffer)) {
    return res.status(400).json({ error: 'File does not appear to be a valid PDF.' });
  }

  const { text, pageCount } = await extractPdfText(buffer);

  if (!text || text.length < 40) {
    return res.status(400).json({
      error:
        'This PDF has little or no selectable text. Use a text-based PDF (not a scanned image-only document).',
    });
  }

  return res.json({
    fileName: fileName || 'upload.pdf',
    pageCount,
    charCount: text.length,
    text,
  });
}

app.use(cors());
app.use(express.json({ limit: `${(Number(process.env.MAX_PDF_MB || 10) + 5)}mb` }));
const profileRoutes = require('./routes/profile');
const timetableRoutes = require('./routes/timetable');
const deckRoutes = require('./routes/decks');
const chatRoutes = require('./routes/chats');
const partnerRoutes = require('./routes/partners');
app.use('/api/profile', profileRoutes);
app.use('/api/timetable', timetableRoutes);
app.use('/api/decks', deckRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/partners', partnerRoutes);
app.get('/', (req, res) => {
  res.send('Capingo is running');
});

app.get('/api/health', async (req, res) => {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
    if (!response.ok) {
      return res.status(503).json({ ok: false, ollama: false });
    }
    const data = await response.json();
    res.json({ ok: true, ollama: true, models: data.models?.map((m) => m.name) ?? [] });
  } catch {
    res.status(503).json({ ok: false, ollama: false });
  }
});

app.post('/api/summarize', async (req, res) => {
  const { messages, existingSummary } = req.body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Request body must include a non-empty messages array.' });
  }

  const transcript = messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => `${m.role === 'user' ? 'Student' : 'Assistant'}: ${String(m.content)}`)
    .join('\n\n');

  const userContent = existingSummary
    ? `Existing memory:\n${existingSummary}\n\nNew messages to fold in:\n${transcript}\n\nUpdate the memory note.`
    : `Summarize these messages:\n${transcript}`;

  const ollamaMessages = [
    { role: 'system', content: SUMMARIZE_PROMPT },
    { role: 'user', content: userContent },
  ];

  try {
    const summary = await callOllama(ollamaMessages);
    res.json({ summary: summary.trim() });
  } catch (err) {
    return handleOllamaError(err, res);
  }
});

app.post('/api/chat', async (req, res) => {
  const { messages, memorySummary } = req.body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Request body must include a non-empty messages array.' });
  }

  const ollamaMessages = [{ role: 'system', content: SYSTEM_PROMPT }];

  if (memorySummary && String(memorySummary).trim()) {
    ollamaMessages.push({
      role: 'system',
      content: `Conversation memory (older messages summarized):\n${String(memorySummary).trim()}`,
    });
  }

  ollamaMessages.push(
    ...messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role, content: String(m.content) }))
  );

  try {
    const reply = await callOllama(ollamaMessages);
    res.json({ reply });
  } catch (err) {
    return handleOllamaError(err, res);
  }
});

app.post('/api/flashcards/parse-pdf', (req, res, next) => {
  const contentType = req.headers['content-type'] || '';
  if (contentType.includes('multipart/form-data')) {
    return upload.single('file')(req, res, (err) => {
      if (err) return next(err);
      return next();
    });
  }
  return next();
}, async (req, res) => {
  try {
    if (req.file) {
      return await respondWithParsedPdf(req.file.buffer, req.file.originalname, res);
    }

    const { pdfBase64, fileName } = req.body ?? {};
    if (!pdfBase64 || typeof pdfBase64 !== 'string') {
      return res.status(400).json({
        error: 'Upload a PDF file (multipart) or send pdfBase64 and fileName as JSON.',
      });
    }

    const buffer = Buffer.from(pdfBase64, 'base64');
    if (buffer.length === 0) {
      return res.status(400).json({ error: 'PDF data is empty.' });
    }
    if (buffer.length > MAX_PDF_BYTES) {
      return res.status(400).json({ error: `PDF must be under ${process.env.MAX_PDF_MB || 10} MB.` });
    }

    return await respondWithParsedPdf(buffer, fileName, res);
  } catch (err) {
    return res.status(400).json({ error: err.message || 'Failed to parse PDF.' });
  }
});

app.post('/api/flashcards/generate', async (req, res) => {
  const { text, cardCount = 20, difficulty = 'standard' } = req.body ?? {};
  const notes = String(text ?? '').trim();

  if (!notes) {
    return res.status(400).json({ error: 'Request body must include non-empty text.' });
  }

  const count = Math.min(50, Math.max(5, Number(cardCount) || 20));
  const level = ['basic', 'standard', 'advanced'].includes(difficulty) ? difficulty : 'standard';

  try {
    const cards = await generateFlashcards(notes, count, level);
    if (cards.length === 0) {
      return res.status(502).json({ error: 'Could not generate flashcards from this PDF. Try again.' });
    }
    res.json({ cards });
  } catch (err) {
    if (err.message?.includes('JSON')) {
      return res.status(502).json({ error: 'AI returned invalid flashcard data. Please try again.' });
    }
    return handleOllamaError(err, res);
  }
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: `PDF must be under ${process.env.MAX_PDF_MB || 10} MB.` });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err) {
    return res.status(400).json({ error: err.message || 'Upload failed.' });
  }
  return next();
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ['GET', 'POST'],
  },
});
registerChatSocket(io);

app.listen(PORT, () => {
  console.log(`Server is on port ${PORT}`);
  console.log(`Ollama proxy: ${OLLAMA_BASE_URL} (model: ${OLLAMA_MODEL})`);
  console.log('Socket.IO ready for real-time chat');
});
