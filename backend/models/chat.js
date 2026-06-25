const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  id: { type: String, required: true },
  role: { type: String, enum: ['user', 'assistant'], required: true },
  content: { type: String, required: true },
  createdAt: { type: Number, required: true },
}, { _id: false });

const ChatSchema = new mongoose.Schema({
  firebaseUid: { type: String, required: true },
  chatId: { type: String, required: true },
  title: { type: String, default: 'New chat' },
  pinned: { type: Boolean, default: false },
  messages: { type: [MessageSchema], default: [] },
  memorySummary: { type: String, default: '' },
  memoryUpToIndex: { type: Number, default: 0 },
  createdAt: { type: Number, required: true },
  updatedAt: { type: Number, required: true },
});

ChatSchema.index({ firebaseUid: 1, chatId: 1 }, { unique: true });
ChatSchema.index({ firebaseUid: 1, updatedAt: -1 });

module.exports = mongoose.model('Chat', ChatSchema);
