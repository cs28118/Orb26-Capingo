const mongoose = require('mongoose');

const UserProfileSchema = new mongoose.Schema({
  firebaseUid: { type: String, required: true, unique: true },
  email: { type: String },
  username: { type: String, default: 'Capy' },
  level: { type: Number, default: 1 },
  currentXp: { type: Number, default: 0 },
  xpToNextLevel: { type: Number, default: 100 },
  profilePic: { type: String, default: '/assets/profile-placeholder.png' },
  lastLoginDate: { type: Date, default: Date.now },
  streakDays: { type: Number, default: 1 },
  dailyProgress: {
    streakClaimed: { type: Number, default: 0 },
    decksReviewed: { type: Number, default: 0 },
    chatMessages: { type: Number, default: 0 },
    decksCreated: { type: Number, default: 0 }
  },
  
  achievements: [{
    id: Number
  }],
  
  quests: [{
    id: Number,
    action: String,
    reward: Number
  }],

  subjects: { type: [String], default: [] },
  manualSubjects: { type: [String], default: [] },
  partnerCode: { type: String, unique: true, sparse: true },
  openToPartners: { type: Boolean, default: true },
});

UserProfileSchema.index({ subjects: 1 });

module.exports = mongoose.model('UserProfile', UserProfileSchema);