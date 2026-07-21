const mongoose = require('mongoose');

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return `ROOM-${code}`;
}

const RoomSchema = new mongoose.Schema({
  roomCode: { type: String, required: true, unique: true },
  type: { type: String, enum: ['direct', 'group'], required: true },
  name: { type: String, default: '' },
  members: { type: [String], required: true },
  admins: { type: [String], default: [] },
  createdBy: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

RoomSchema.index({ members: 1 });
RoomSchema.index({ type: 1, members: 1 });

module.exports = mongoose.model('Room', RoomSchema);
module.exports.generateRoomCode = generateRoomCode;