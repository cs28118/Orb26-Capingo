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
          { id: 1 }
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
      if ((profile.questsToday || 0) >= 3) {
        profile.questStreakDays = isYesterday(lastLogin) ? (profile.questStreakDays || 0) + 1 : 1;
      } else {
        profile.questStreakDays = 0;
      }
      profile.dailyProgress = {
        streakClaimed: 0,
        decksReviewed: 0,
        chatMessages: 0,
        decksCreated: 0
      };
      profile.questsToday = 0;
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

const ACHIEVEMENT_FIELDS = {
  chatMessage: 'helloCapy',
  createDeck: 'deckBuilder',
};

//login streak
router.post('/claim-streak', async (req, res) => {
  try {
    const { uid } = req.body;
    const profile = await UserProfile.findOne({ firebaseUid: uid });
    if (!profile) return res.status(404).json({ error: 'User not found' });
    if (profile.dailyProgress.streakClaimed >= 1) {
      return res.json({ 
        success: true, 
        leveledUp: false, 
        message: 'Login streak already claimed today!', 
        profile 
      });
    }
    const currentStreak = profile.streakDays || 1;
    const xpToAdd = Math.min(currentStreak * 20, 100);
    profile.dailyProgress.streakClaimed += 1;
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
      message: `+${xpToAdd} XP for Day ${currentStreak} Streak!`,
      profile
    });
  } catch (err) {
    console.error('Error claiming streak:', err);
    res.status(500).json({ error: 'Server error claiming streak' });
  }
});

//do quest
router.post('/quest-action', async (req, res) => {
  try {
    const { uid, actionType } = req.body;
    const profile = await UserProfile.findOne({ firebaseUid: uid });
    if (!profile) return res.status(404).json({ error: 'User not found' });

    //quests detection
    const quest = QUEST_DICT[actionType];
    if (!quest) return res.status(400).json({ error: 'Invalid action' });
    
    //achievement detection
    let achievementChanged = false;
    const achievementField = ACHIEVEMENT_FIELDS[actionType];
    if (achievementField && !profile[achievementField]) {
      profile[achievementField] = true;
      achievementChanged = true;
    }
    if (actionType === 'createDeck') {
      profile.totalDecksCreated = (profile.totalDecksCreated || 0) + 1;
      achievementChanged = true;
    }

    let xpToAdd = 0;
    let actionName = quest.name;
    if (profile.dailyProgress[quest.key] < quest.limit) {
      profile.dailyProgress[quest.key] += 1;
      xpToAdd = quest.xp;
      profile.questsCompleted = (profile.questsCompleted || 0) + 1;
      profile.questsToday = (profile.questsToday || 0) + 1;
      achievementChanged = true;
    }
    //action capped
    if (xpToAdd === 0) {
      if (achievementChanged) await profile.save();
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
    if (!profile.instantiatedIndentity) profile.instantiatedIndentity = true;
    await profile.save();
    res.json({ success: true, profile });
  } catch (err) {
    console.error('Error updating profile:', err);
    res.status(500).json({ error: 'Server error updating profile' });
  }
});

const TIMETABLE_ACHIEVEMENT_FIELDS = {
  manual: 'masterScheduler',
  auto: 'autoAllocating',
};

router.post('/timetable-achievement', async (req, res) => {
  try {
    const { uid, type } = req.body ?? {};
    const field = TIMETABLE_ACHIEVEMENT_FIELDS[type];
    if (!uid || !field) {
      return res.status(400).json({ error: 'uid and a valid type ("manual" or "auto") are required' });
    }
    const profile = await UserProfile.findOne({ firebaseUid: uid });
    if (!profile) return res.status(404).json({ error: 'User not found' });
    if (!profile[field]) {
      profile[field] = true;
      await profile.save();
    }
    res.json({ success: true, profile });
  } catch (err) {
    console.error('Error recording timetable achievement:', err);
    res.status(500).json({ error: 'Server error while recording achievement' });
  }
});

//achievement unlock
router.post('/unlock-achievements', async (req, res) => {
  try {
    const { uid, newAchievementIds } = req.body;
    const profile = await UserProfile.findOne({ firebaseUid: uid });
    if (!profile) return res.status(404).json({ error: 'User not found' });
    if (!newAchievementIds || !Array.isArray(newAchievementIds)) {
      return res.status(400).json({ error: 'Invalid achievement data' });
    }
    const ownedIds = profile.achievements.map(a => a.id);
    let addedCount = 0;
    newAchievementIds.forEach(badgeId => {
      if (!ownedIds.includes(badgeId)) {
        profile.achievements.push({ id: badgeId });
        addedCount++;
      }
    });
    if (addedCount > 0) {
      await profile.save();
    }
    res.json({
      success: true,
      message: `Successfully unlocked ${addedCount} achievements.`,
      profile
    });
  } catch (err) {
    console.error('Error unlocking achievements:', err);
    res.status(500).json({ error: 'Server error unlocking achievements' });
  }
});

module.exports = router;
