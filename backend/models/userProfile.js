const mongoose = require('mongoose');

const UserProfileSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true }, //for current progress, use firebase id for future update
  level: { type: Number, default: 1 },
  currentXp: { type: Number, default: 0 },
  xpToNextLevel: { type: Number, default: 100 },
  profilePic: { type: String, default: '/assets/profile-placeholder.png' },
  lastLoginDate: { type: Date, default: Date.now },
  streakDays: { type: Number, default: 1 },
  dailyProgress: {
    decksReviewed: { type: Number, default: 0 },
    chatMessages: { type: Number, default: 0 },
    decksCreated: { type: Number, default: 0 }
  },
  
  achievements: [{
    id: Number,
    title: String,
    icon: String
  }],
  
  quests: [{
    id: Number,
    action: String,
    reward: Number
  }]
});

module.exports = mongoose.model('UserProfile', UserProfileSchema);