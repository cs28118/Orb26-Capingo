const express = require('express');
const router = express.Router();
const FlashcardCollection = require('../models/flashcardDeck');
const { computeAdaptiveDeckDefaults } = require('../utils/adaptiveDeckDefaults');

const MAX_SESSIONS = 80;

router.get('/:uid/adaptive-defaults', async (req, res) => {
  try {
    const { uid } = req.params;
    const subjectHint = String(req.query.subject || req.query.title || '').trim();
    const collection = await FlashcardCollection.findOne({ firebaseUid: uid });
    const sessions = collection?.studySessions || [];
    const defaults = computeAdaptiveDeckDefaults(sessions, subjectHint);
    res.json(defaults);
  } catch (err) {
    console.error('Error computing adaptive deck defaults:', err);
    res.status(500).json({ error: 'Server error while computing adaptive defaults' });
  }
});

router.post('/:uid/sessions', async (req, res) => {
  try {
    const { uid } = req.params;
    const {
      deckId,
      deckTitle,
      deckCardCount,
      queueSize,
      reviewedCount,
      completed,
      startedAt,
      endedAt,
    } = req.body || {};

    if (!deckId) {
      return res.status(400).json({ error: 'deckId is required' });
    }

    const session = {
      id: `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      deckId: String(deckId),
      deckTitle: String(deckTitle || ''),
      deckCardCount: Number(deckCardCount) || 0,
      queueSize: Number(queueSize) || 0,
      reviewedCount: Number(reviewedCount) || 0,
      completed: Boolean(completed),
      startedAt: typeof startedAt === 'number' ? startedAt : Date.now(),
      endedAt: typeof endedAt === 'number' ? endedAt : Date.now(),
    };

    let collection = await FlashcardCollection.findOne({ firebaseUid: uid });
    if (!collection) {
      collection = new FlashcardCollection({ firebaseUid: uid, decks: [], studySessions: [] });
    }

    const list = [...(collection.studySessions || []), session];
    collection.studySessions = list.slice(-MAX_SESSIONS);
    collection.updatedAt = new Date();
    await collection.save();

    res.json({ success: true, session, studySessions: collection.studySessions });
  } catch (err) {
    console.error('Error saving study session:', err);
    res.status(500).json({ error: 'Server error while saving study session' });
  }
});

router.get('/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    let collection = await FlashcardCollection.findOne({ firebaseUid: uid });

    if (!collection) {
      collection = new FlashcardCollection({ firebaseUid: uid, decks: [] });
      await collection.save();
    }

    res.json({
      decks: collection.decks,
      studySessions: collection.studySessions || [],
      updatedAt: collection.updatedAt,
    });
  } catch (err) {
    console.error('Error fetching flashcard decks:', err);
    res.status(500).json({ error: 'Server error while fetching decks' });
  }
});

router.put('/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    const { decks } = req.body;

    if (!Array.isArray(decks)) {
      return res.status(400).json({ error: 'Request body must include a decks array.' });
    }

    const collection = await FlashcardCollection.findOneAndUpdate(
      { firebaseUid: uid },
      { decks, updatedAt: new Date() },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.json({
      decks: collection.decks,
      studySessions: collection.studySessions || [],
      updatedAt: collection.updatedAt,
    });
  } catch (err) {
    console.error('Error saving flashcard decks:', err);
    res.status(500).json({ error: 'Server error while saving decks' });
  }
});

module.exports = router;
