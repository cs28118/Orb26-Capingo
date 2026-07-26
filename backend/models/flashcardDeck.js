const mongoose = require('mongoose');

const CardSchema = new mongoose.Schema({
  id: { type: String, required: true },
  front: { type: String, default: '' },
  back: { type: String, default: '' },
  createdAt: { type: Number, required: true },
  updatedAt: { type: Number },
  // Spaced repetition (SM-2) — missing fields treated as new/due on the client
  ease: { type: Number, default: 2.5 },
  interval: { type: Number, default: 0 },
  repetitions: { type: Number, default: 0 },
  dueAt: { type: Number, default: 0 },
  lastReviewedAt: { type: Number },
  lapses: { type: Number, default: 0 },
}, { _id: false });

const DeckSchema = new mongoose.Schema({
  id: { type: String, required: true },
  title: { type: String, required: true },
  sourceFileName: { type: String },
  pageCount: { type: Number },
  pinned: { type: Boolean, default: false },
  cards: { type: [CardSchema], default: [] },
  createdAt: { type: Number, required: true },
  updatedAt: { type: Number, required: true },
}, { _id: false });

const FlashcardCollectionSchema = new mongoose.Schema({
  firebaseUid: { type: String, required: true, unique: true },
  decks: { type: [DeckSchema], default: [] },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.models.FlashcardCollection || mongoose.model('FlashcardCollection', FlashcardCollectionSchema);
