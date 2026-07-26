const mongoose = require('mongoose');

const UserProfileSchema = new mongoose.Schema(
  {
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
      decksCreated: { type: Number, default: 0 },
    },

    achievements: [
      {
        id: Number,
      },
    ],

    quests: [
      {
        id: Number,
        action: String,
        reward: Number,
      },
    ],

    subjects: { type: [String], default: [] },
    manualSubjects: { type: [String], default: [] },
    partnerCode: { type: String, unique: true, sparse: true },
    openToPartners: { type: Boolean, default: true },

    // achievements (except streaks)
    helloCapy: { type: Boolean, default: false },
    deckBuilder: { type: Boolean, default: false },
    masterScheduler: { type: Boolean, default: false },
    autoAllocating: { type: Boolean, default: false },
    instantiatedIndentity: { type: Boolean, default: false },
    connectedComponent: { type: Boolean, default: false },
    decksCreated: { type: Number, default: 0 },
    draggedTask: { type: Boolean, default: false },
    multitask: { type: Boolean, default: false },
    questsCompleted: { type: Number, default: 0 },
    questsToday: { type: Number, default: 0 },
    questsCompleteStreak: { type: Number, default: 0 },

    /** Lifetime quest completions — used for neglected-action XP weighting. */
    questActionCounts: {
      reviewDeck: { type: Number, default: 0 },
      chatMessage: { type: Number, default: 0 },
      createDeck: { type: Number, default: 0 },
      loginStreak: { type: Number, default: 0 },
    },

    /** YYYY-MM-DD — at most one proactive chatbot opening per day. */
    lastProactiveChatNudgeDate: { type: String, default: '' },

    /** Same-day dismissals for Smart Recommendations (YYYY-MM-DD). */
    dismissedRecommendations: [
      {
        id: { type: String },
        date: { type: String },
        _id: false,
      },
    ],
  },
  { timestamps: true }
);

UserProfileSchema.index({ subjects: 1 });

module.exports = mongoose.models.UserProfile || mongoose.model('UserProfile', UserProfileSchema);
