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

app.post('/api/chat', async (req, res) => {
  const { messages } = req.body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Request body must include a non-empty messages array.' });
  }

  const ollamaMessages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role, content: String(m.content) })),
  ];

  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: ollamaMessages,
        stream: false,
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      return res.status(502).json({
        error: `Ollama returned ${response.status}. Check OLLAMA_MODEL (${OLLAMA_MODEL}) matches "ollama list".`,
        detail,
      });
    }

    const data = await response.json();
    const reply = data.message?.content ?? '';
    res.json({ reply });
  } catch (err) {
    const refused =
      err.cause?.code === 'ECONNREFUSED' ||
      err.message?.includes('fetch failed') ||
      err.code === 'ECONNREFUSED';
    if (refused) {
      return res.status(503).json({
        error: 'Cannot reach Ollama. Start the Ollama app and ensure a model is pulled (e.g. ollama pull mistral).',
      });
    }
    res.status(500).json({ error: err.message || 'Unexpected server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server is on port ${PORT}`);
  console.log(`Ollama proxy: ${OLLAMA_BASE_URL} (model: ${OLLAMA_MODEL})`);
});
