const mongoose = require('mongoose');

const ResourceSchema = new mongoose.Schema({
  roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
  addedByUid: { type: String, required: true },
  title: { type: String, required: true, maxlength: 120 },
  url: { type: String, required: true, maxlength: 2000 },
  description: { type: String, default: '', maxlength: 500 },
  createdAt: { type: Date, default: Date.now },
});

ResourceSchema.index({ roomId: 1, createdAt: -1 });

module.exports = mongoose.model('Resource', ResourceSchema);