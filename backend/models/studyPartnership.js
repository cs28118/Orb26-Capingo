const mongoose = require('mongoose');

const StudyPartnershipSchema = new mongoose.Schema({
  userA: { type: String, required: true },
  userB: { type: String, required: true },
  requestedBy: { type: String, required: true },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'declined'],
    default: 'pending',
  },
  sharedSubjects: { type: [String], default: [] },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

StudyPartnershipSchema.index({ userA: 1, userB: 1 }, { unique: true });
StudyPartnershipSchema.index({ userA: 1, status: 1 });
StudyPartnershipSchema.index({ userB: 1, status: 1 });

function canonicalPair(uid1, uid2) {
  return uid1 < uid2 ? [uid1, uid2] : [uid2, uid1];
}

module.exports = mongoose.model('StudyPartnership', StudyPartnershipSchema);
module.exports.canonicalPair = canonicalPair;
