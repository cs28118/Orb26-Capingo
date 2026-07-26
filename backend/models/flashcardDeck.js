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

/** Completed vs abandoned study — drives adaptive deck-creation defaults. */
const StudySessionSchema = new mongoose.Schema({
  id: { type: String, required: true },
  deckId: { type: String, required: true },
  deckTitle: { type: String, default: '' },
  deckCardCount: { type: Number, default: 0 },
  queueSize: { type: Number, default: 0 },
  reviewedCount: { type: Number, default: 0 },
  completed: { type: Boolean, default: false },
  startedAt: { type: Number },
  endedAt: { type: Number, required: true },
}, { _id: false });

const FlashcardCollectionSchema = new mongoose.Schema({
  firebaseUid: { type: String, required: true, unique: true },
  decks: { type: [DeckSchema], default: [] },
  studySessions: { type: [StudySessionSchema], default: [] },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = (() => {
  if (mongoose.models.FlashcardCollection) {
    delete mongoose.models.FlashcardCollection;
  }
  return mongoose.model('FlashcardCollection', FlashcardCollectionSchema);
})();
