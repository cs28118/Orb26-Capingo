const express = require('express');
const router = express.Router();
const UserProfile = require('../models/userProfile');
const { assignUniquePartnerCode } = require('../utils/partnerCode');

//helper 1
const isYesterday = (date) => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return date.getDate() === yesterday.getDate() &&
         date.getMonth() === yesterday.getMonth() &&
         date.getFullYear() === yesterday.getFullYear();
};
//helper 2
const isToday = (date) => {
  const today = new Date();
  return date.getDate() === today.getDate() &&
         date.getMonth() === today.getMonth() &&
         date.getFullYear() === today.getFullYear();
};

//get id
router.get('/:uid', async (req, res) => {
  try {
    //fetch uid
    const { uid } = req.params;
    const { username, email } = req.query;
    let profile = await UserProfile.findOne({ firebaseUid: uid });
    // create profile
    if (!profile) {
      profile = new UserProfile({
        firebaseUid: uid,
        username: username,
        email: email,
        profilePic: '/assets/profile-placeholder.png',
        subjects: [],
        manualSubjects: [],
        openToPartners: true,
        achievements: [
          { id: 1, title: 'Welcome!', icon: '/assets/welcome-badge.png' }
        ],
        quests: [
          { id: 1, action: 'Login Streak', reward: 10 },
          { id: 2, action: 'Review Flashcards (0/2)', reward: 60 },
          { id: 3, action: 'Chat with AI (0/5)', reward: 50 },
          { id: 4, action: 'Create a Deck (0/1)', reward: 30 }
        ]
      });
      await profile.save();
      await assignUniquePartnerCode(profile);
      return res.json(profile);
    }
    //login detection (streaks xp and reset quest)
    const lastLogin = new Date(profile.lastLoginDate);
    if (!isToday(lastLogin)) {
      if (isYesterday(lastLogin)) {
        profile.streakDays += 1;
      } else {
        profile.streakDays = 1;
      }
      profile.dailyProgress = {
        streakClaimed: 0,
        decksReviewed: 0,
        chatMessages: 0,
        decksCreated: 0
      };
      profile.lastLoginDate = new Date();
      await profile.save();
    }
    await assignUniquePartnerCode(profile);
    res.json(profile);
  } catch (err) {
    console.error('Error fetching profile:', err);
    res.status(500).json({ error: 'Server error while fetching profile' });
  }
});

const QUEST_DICT = {
  loginStreak: { xp: 50, limit: 1, key: 'streakClaimed', name: 'Daily Login Streak Claimed' },
  reviewDeck:  { xp: 60, limit: 2, key: 'decksReviewed', name: 'Flashcard Deck Reviewed' },
  chatMessage: { xp: 50, limit: 5, key: 'chatMessages', name: 'Chat Message Sent' },
  createDeck:  { xp: 30, limit: 1, key: 'decksCreated', name: 'Flashcard Deck Created' }
};

//do quest
router.post('/quest-action', async (req, res) => {
  try {
    const { uid, actionType } = req.body;
    const profile = await UserProfile.findOne({ firebaseUid: uid });
    if (!profile) return res.status(404).json({ error: 'User not found' });
    //quests
    const quest = QUEST_DICT[actionType];
    if (!quest) return res.status(400).json({ error: 'Invalid action' });
    let xpToAdd = 0;
    let actionName = quest.name;
    if (profile.dailyProgress[quest.key] < quest.limit) {
      profile.dailyProgress[quest.key] += 1;
      if (actionType === 'loginStreak') {
        const currentStreak = profile.streakDays || 1;
        xpToAdd = Math.min(currentStreak * 20, 100); 
        actionName = `Day ${currentStreak} Login Streak`;
      } else {
        xpToAdd = quest.xp;
      }
    }
    //capped
    if (xpToAdd === 0) {
      return res.json({ 
        success: true, 
        leveledUp: false, 
        message: 'Daily cap reached for this quest! Come back tomorrow.', 
        profile 
      });
    }
    //level up logic
    profile.currentXp += xpToAdd;
    let leveledUp = false;
    while (profile.currentXp >= profile.xpToNextLevel) {
      profile.currentXp -= profile.xpToNextLevel;
      profile.level += 1;
      profile.xpToNextLevel = Math.floor(profile.level * 150);
      leveledUp = true;
    }
    await profile.save();
    res.json({
      success: true,
      leveledUp,
      message: `+${xpToAdd} XP for: ${quest.name}`,
      profile
    });
  } catch (err) {
    console.error('Error processing quest action:', err);
    res.status(500).json({ error: 'Server error processing quest' });
  }
});

//update profile
router.post('/update', async (req, res) => {
  try {
    const { uid, newUsername, newProfilePic } = req.body;
    const profile = await UserProfile.findOne({ firebaseUid: uid });
    if (!profile) return res.status(404).json({ error: 'User not found' });
    if (newUsername) profile.username = newUsername;
    if (newProfilePic) profile.profilePic = newProfilePic;
    await profile.save();
    res.json({ success: true, profile });
  } catch (err) {
    console.error('Error updating profile:', err);
    res.status(500).json({ error: 'Server error updating profile' });
  }
});

module.exports = router;
