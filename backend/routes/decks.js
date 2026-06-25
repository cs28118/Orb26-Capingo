const express = require('express');
const router = express.Router();
const FlashcardCollection = require('../models/flashcardDeck');

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
      updatedAt: collection.updatedAt,
    });
  } catch (err) {
    console.error('Error saving flashcard decks:', err);
    res.status(500).json({ error: 'Server error while saving decks' });
  }
});

module.exports = router;
