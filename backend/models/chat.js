const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  id: { type: String, required: true },
  role: { type: String, enum: ['user', 'assistant', 'action'], required: true },
  content: { type: String, default: '' },
  createdAt: { type: Number, required: true },
  action: {
    tool: { type: String },
    args: { type: mongoose.Schema.Types.Mixed },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'cancelled', 'expired'],
      default: 'pending',
    },
    summary: { type: String },
    result: { type: mongoose.Schema.Types.Mixed },
  },
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

module.exports = mongoose.models.Chat || mongoose.model('Chat', ChatSchema);
