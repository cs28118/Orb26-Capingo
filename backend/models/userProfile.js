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

  //achievements (except streaks)
  helloCapy: { type: Boolean, default: false },
  deckBuilder: { type: Boolean, default: false },
  masterScheduler: { type: Boolean, default: false },
  autoAllocating: { type: Boolean, default: false },
  instantiatedIndentity: { type: Boolean, default: false },
  connectedComponent: { type: Boolean, default: false },
  decksCreated: { type: Number, default: 0 },
  questsCompleted: { type: Number, default: 0 }, //overall quests completed
  questsToday: { type: Number, default: 0 }, //quests completed today
  questsCompleteStreak: { type: Number, default: 0 }, //consecutive days of completing quests
});

UserProfileSchema.index({ subjects: 1 });

module.exports = mongoose.model('UserProfile', UserProfileSchema);