const mongoose = require('mongoose');

const CardSchema = new mongoose.Schema({
  id: { type: String, required: true },
  front: { type: String, default: '' },
  back: { type: String, default: '' },
  createdAt: { type: Number, required: true },
  updatedAt: { type: Number },
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

module.exports = mongoose.model('FlashcardCollection', FlashcardCollectionSchema);
