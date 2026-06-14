const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'mistral';

const SYSTEM_PROMPT = `You are Capingo AI, a friendly study co-pilot represented by a capybara mascot.
Help students learn clearly and patiently. Use markdown when helpful: **bold**, numbered lists, and short paragraphs.
Keep answers focused and educational. If asked to quiz the student, ask 2-3 questions.`;

const SUMMARIZE_PROMPT = `You compress study-chat history into a concise memory note for future replies.
Keep: topics covered, key facts taught, quiz progress, student mistakes, and open questions.
Do not invent facts. Max 250 words. Plain text only (no markdown headings).`;

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

app.use(cors());
app.use(express.json());

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

app.listen(PORT, () => {
  console.log(`Server is on port ${PORT}`);
  console.log(`Ollama proxy: ${OLLAMA_BASE_URL} (model: ${OLLAMA_MODEL})`);
});
