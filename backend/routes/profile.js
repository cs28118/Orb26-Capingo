const express = require('express');
const router = express.Router();
const UserProfile = require('../models/UserProfile');

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


router.get('/:username', async (req, res) => {
  try {
    const { username } = req.params;
    let profile = await UserProfile.findOne({ username });
    // create profile
    if (!profile) {
      profile = new UserProfile({
        username: username,
        profilePic: '/assets/profile-placeholder.png',
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
        decksReviewed: 0,
        chatMessages: 0,
        decksCreated: 0
      };
      const streakXp = Math.min(profile.streakDays * 10, 50);
      profile.currentXp += streakXp;
      while (profile.currentXp >= profile.xpToNextLevel) {
        profile.currentXp -= profile.xpToNextLevel;
        profile.level += 1;
        profile.xpToNextLevel = Math.floor(profile.level * 150);
      }
      profile.lastLoginDate = new Date();
      await profile.save();
    }
    res.json(profile);
  } catch (err) {
    console.error('Error fetching profile:', err);
    res.status(500).json({ error: 'Server error while fetching profile' });
  }
});


router.post('/quest-action', async (req, res) => {
  try {
    const { username, actionType } = req.body;
    const profile = await UserProfile.findOne({ username });
    if (!profile) return res.status(404).json({ error: 'User not found' });
    let xpToAdd = 0;
    let actionName = '';
    //quests
    if (actionType === 'reviewDeck') {
      if (profile.dailyProgress.decksReviewed < 2) {
        profile.dailyProgress.decksReviewed += 1;
        xpToAdd = 60;
        actionName = 'Flashcard Deck Reviewed';
      }
    } else if (actionType === 'chatMessage') {
      if (profile.dailyProgress.chatMessages < 5) {
        profile.dailyProgress.chatMessages += 1;
        xpToAdd = 50;
        actionName = 'Chat Message Sent';
      }
    } else if (actionType === 'createDeck') {
      if (profile.dailyProgress.decksCreated < 1) {
        profile.dailyProgress.decksCreated += 1;
        xpToAdd = 30;
        actionName = 'Flashcard Deck Created';
      }
    } else {
      return res.status(400).json({ error: 'Invalid action type' });
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
      message: `+${xpToAdd} XP for: ${actionName}`,
      profile
    });
  } catch (err) {
    console.error('Error processing quest action:', err);
    res.status(500).json({ error: 'Server error processing quest' });
  }
});

module.exports = router;