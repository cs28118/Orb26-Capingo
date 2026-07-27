const express = require('express');
const router = express.Router();
const UserProfile = require('../models/userProfile');
const { getRecommendations, todayKey, getChatNudge } = require('../utils/recommendationEngine');

/**
 * GET /api/dashboard/recommendations/:uid/chat-nudge
 * Chatbot consumer — claim at most one high-priority opening line per day.
 */
router.get('/recommendations/:uid/chat-nudge', async (req, res) => {
  try {
    const { uid } = req.params;
    if (!uid) return res.status(400).json({ error: 'uid is required' });
    const claim = String(req.query.claim || '1') !== '0';
    const result = await getChatNudge(uid, { claim });
    res.json(result);
  } catch (err) {
    console.error('Error fetching chat nudge:', err);
    res.status(500).json({ error: 'Server error while fetching chat nudge' });
  }
});

/**
 * GET /api/dashboard/recommendations/:uid
 * Smart Recommendations for the Dashboard "For You" card.
 */
router.get('/recommendations/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    if (!uid) return res.status(400).json({ error: 'uid is required' });
    const result = await getRecommendations(uid, 3);
    res.json(result);
  } catch (err) {
    console.error('Error fetching recommendations:', err);
    res.status(500).json({ error: 'Server error while fetching recommendations' });
  }
});

/**
 * POST /api/dashboard/recommendations/dismiss
 * Body: { uid, recommendationId }
 */
router.post('/recommendations/dismiss', async (req, res) => {
  try {
    const { uid, recommendationId } = req.body || {};
    if (!uid || !recommendationId) {
      return res.status(400).json({ error: 'uid and recommendationId are required' });
    }

    const profile = await UserProfile.findOne({ firebaseUid: uid });
    if (!profile) return res.status(404).json({ error: 'User not found' });

    const date = todayKey();
    const list = profile.dismissedRecommendations || [];
    const already = list.some((d) => d.id === recommendationId && d.date === date);
    if (!already) {
      list.push({ id: recommendationId, date });
      profile.dismissedRecommendations = list;
      await profile.save();
    }

    res.json({ success: true, profile });
  } catch (err) {
    console.error('Error dismissing recommendation:', err);
    res.status(500).json({ error: 'Server error while dismissing recommendation' });
  }
});

module.exports = router;
