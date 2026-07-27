//collab space chat
const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
  senderUid: { type: String, required: true },
  text: { type: String, required: true, maxlength: 2000 },
  deleted: { type: Boolean, default: false },
  replyTo: {
    messageId: { type: mongoose.Schema.Types.ObjectId },
    senderUid: { type: String },
    text: { type: String },
  },
  createdAt: { type: Date, default: Date.now },
});

MessageSchema.index({ roomId: 1, createdAt: 1 });

module.exports = mongoose.models.Message || mongoose.model('Message', MessageSchema);