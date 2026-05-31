require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleGenAI } = require('@google/genai');

const app = express();
const PORT = process.env.PORT || 5000;

const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY 
});

const SYSTEM_PROMPT = `You are Capingo AI, a friendly study co-pilot represented by a capybara mascot.
Help students learn clearly and patiently. Use markdown when helpful: **bold**, numbered lists, and short paragraphs.
Keep answers focused and educational. If asked to quiz the student, ask 2-3 questions.`;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Capingo is running');
});

app.get('/api/health', (req, res) => {
  if (!process.env.GEMINI_API_KEY) {
    return res.status(503).json({ ok: false, message: 'GEMINI_API_KEY is missing' });
  }
  res.json({ ok: true, provider: 'gemini', model: 'gemini-2.5-flash' });
});

app.post('/api/chat', async (req, res) => {
  const { messages } = req.body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Request body must include a non-empty messages array.' });
  }

  try {
    // Transform your message history arrays to fit Gemini's structural specifications
    const contents = messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user', // Gemini uses 'model' instead of 'assistant'
        parts: [{ text: String(m.content) }],
      }));

    // Generate high-speed content using the lightweight 1.5-flash engine
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: contents,
      config: {
        systemInstruction: SYSTEM_PROMPT, // Embeds Capingo's capybara coaching rules
      }
    });

    const reply = response.text ?? '';
    res.json({ reply });

  } catch (err) {
    console.error('Gemini API Error Context:', err);
    res.status(500).json({ error: err.message || 'Unexpected cloud server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server is on port ${PORT}`);
  console.log(`Using model engine target: gemini-2.5-flash`);
});
