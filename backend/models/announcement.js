const mongoose = require('mongoose');

const AnnouncementSchema = new mongoose.Schema({
  roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
  authorUid: { type: String, required: true },
  text: { type: String, required: true, maxlength: 2000 },
  createdAt: { type: Date, default: Date.now },
});

AnnouncementSchema.index({ roomId: 1, createdAt: -1 });

module.exports = mongoose.model('Announcement', AnnouncementSchema);