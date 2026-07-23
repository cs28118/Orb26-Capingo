const express = require('express');
const router = express.Router();
const UserProfile = require('../models/userProfile');
const StudyPartnership = require('../models/studyPartnership');
const { canonicalPair } = require('../models/studyPartnership');
const {
  normalizeSubject,
  getEffectiveSubjects,
  intersectSubjects,
  jaccardScore,
} = require('../utils/subjectSync');

function toPublicProfile(profile) {
  return {
    uid: profile.firebaseUid,
    username: profile.username,
    profilePic: profile.profilePic,
    partnerCode: profile.partnerCode,
    subjects: profile.subjects || [],
    manualSubjects: profile.manualSubjects || [],
  };
}

async function findPartnership(uid1, uid2) {
  const [userA, userB] = canonicalPair(uid1, uid2);
  return StudyPartnership.findOne({ userA, userB });
}

router.get('/suggestions/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    const myProfile = await UserProfile.findOne({ firebaseUid: uid });
    if (!myProfile) {
      return res.status(404).json({ error: 'User not found' });
    }

    const mySubjects = getEffectiveSubjects(myProfile);
    if (mySubjects.length === 0) {
      return res.json({ suggestions: [] });
    }

    const myPartnerships = await StudyPartnership.find({
      $or: [{ userA: uid }, { userB: uid }],
      status: { $in: ['pending', 'accepted'] },
    });

    const excludedUids = new Set([uid]);
    for (const p of myPartnerships) {
      excludedUids.add(p.userA === uid ? p.userB : p.userA);
    }

    const candidates = await UserProfile.find({
      firebaseUid: { $nin: [...excludedUids] },
      openToPartners: { $ne: false },
    });

    const suggestions = [];

    for (const candidate of candidates) {
      const theirSubjects = getEffectiveSubjects(candidate);
      const shared = intersectSubjects(mySubjects, theirSubjects);
      if (shared.length === 0) continue;

      const unionKeys = new Set([
        ...mySubjects.map((s) => s.toLowerCase()),
        ...theirSubjects.map((s) => s.toLowerCase()),
      ]);

      suggestions.push({
        uid: candidate.firebaseUid,
        username: candidate.username,
        profilePic: candidate.profilePic,
        partnerCode: candidate.partnerCode,
        sharedSubjects: shared,
        matchScore: Math.round(jaccardScore(shared, unionKeys.size) * 100),
      });
    }

    suggestions.sort((a, b) => {
      if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
      return b.sharedSubjects.length - a.sharedSubjects.length;
    });

    res.json({ suggestions: suggestions.slice(0, 20) });
  } catch (err) {
    console.error('Error fetching suggestions:', err);
    res.status(500).json({ error: 'Server error while fetching suggestions' });
  }
});

router.get('/code/:partnerCode', async (req, res) => {
  try {
    const code = req.params.partnerCode.trim().toUpperCase();
    const profile = await UserProfile.findOne({ partnerCode: code });
    if (!profile) {
      return res.status(404).json({ error: 'Partner code not found' });
    }
    res.json(toPublicProfile(profile));
  } catch (err) {
    console.error('Error resolving partner code:', err);
    res.status(500).json({ error: 'Server error while looking up partner code' });
  }
});

router.put('/subjects/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    const { manualSubjects, openToPartners } = req.body ?? {};

    const profile = await UserProfile.findOne({ firebaseUid: uid });
    if (!profile) return res.status(404).json({ error: 'User not found' });

    if (Array.isArray(manualSubjects)) {
      const seen = new Map();
      for (const s of manualSubjects) {
        const norm = normalizeSubject(s);
        if (!norm) continue;
        seen.set(norm.toLowerCase(), norm);
      }
      profile.manualSubjects = [...seen.values()].sort((a, b) => a.localeCompare(b));
    }

    if (typeof openToPartners === 'boolean') {
      profile.openToPartners = openToPartners;
    }

    await profile.save();
    res.json({
      subjects: profile.subjects,
      manualSubjects: profile.manualSubjects,
      openToPartners: profile.openToPartners,
    });
  } catch (err) {
    console.error('Error updating subjects:', err);
    res.status(500).json({ error: 'Server error while updating subjects' });
  }
});

router.post('/request', async (req, res) => {
  try {
    const { requesterUid, targetUid, partnerCode } = req.body ?? {};

    if (!requesterUid) {
      return res.status(400).json({ error: 'requesterUid is required' });
    }

    let targetProfile;
    if (targetUid) {
      targetProfile = await UserProfile.findOne({ firebaseUid: targetUid });
    } else if (partnerCode) {
      targetProfile = await UserProfile.findOne({
        partnerCode: String(partnerCode).trim().toUpperCase(),
      });
    } else {
      return res.status(400).json({ error: 'targetUid or partnerCode is required' });
    }

    if (!targetProfile) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (requesterUid === targetProfile.firebaseUid) {
      return res.status(400).json({ error: 'Cannot send a partner request to yourself' });
    }

    const [userA, userB] = canonicalPair(requesterUid, targetProfile.firebaseUid);
    const existing = await StudyPartnership.findOne({ userA, userB });

    if (existing?.status === 'accepted') {
      return res.status(409).json({ error: 'You are already partners with this user' });
    }
    if (existing?.status === 'pending') {
      return res.status(409).json({ error: 'A partner request already exists' });
    }

    const now = new Date();
    let partnership;

    if (existing) {
      existing.status = 'pending';
      existing.requestedBy = requesterUid;
      existing.updatedAt = now;
      await existing.save();
      partnership = existing;
    } else {
      try {
        partnership = await StudyPartnership.create({
          userA,
          userB,
          requestedBy: requesterUid,
          status: 'pending',
          createdAt: now,
          updatedAt: now,
        });
      } catch (createErr) {
        if (createErr.code === 11000) {
          return res.status(409).json({ error: 'A partner request already exists' });
        }
        throw createErr;
      }
    }

    res.status(201).json({
      partnership,
      target: toPublicProfile(targetProfile),
    });
  } catch (err) {
    console.error('Error creating partner request:', err);
    res.status(500).json({ error: 'Server error while creating partner request' });
  }
});

router.post('/accept', async (req, res) => {
  try {
    const { uid, partnerUid } = req.body ?? {};
    if (!uid || !partnerUid) {
      return res.status(400).json({ error: 'uid and partnerUid are required' });
    }

    const partnership = await findPartnership(uid, partnerUid);
    if (!partnership) {
      return res.status(404).json({ error: 'Partner request not found' });
    }
    if (partnership.status !== 'pending') {
      return res.status(400).json({ error: 'Request is not pending' });
    }
    if (partnership.requestedBy === uid) {
      return res.status(400).json({ error: 'You cannot accept your own request' });
    }

    const otherUid = partnership.userA === uid ? partnership.userB : partnership.userA;
    if (otherUid !== partnerUid) {
      return res.status(400).json({ error: 'Invalid partner request' });
    }

    const [myProfile, partnerProfile] = await Promise.all([
      UserProfile.findOne({ firebaseUid: uid }),
      UserProfile.findOne({ firebaseUid: partnerUid }),
    ]);

    if (!myProfile || !partnerProfile) {
      return res.status(404).json({ error: 'User not found' });
    }

    const sharedSubjects = intersectSubjects(
      getEffectiveSubjects(myProfile),
      getEffectiveSubjects(partnerProfile)
    );

    partnership.status = 'accepted';
    partnership.sharedSubjects = sharedSubjects;
    partnership.updatedAt = new Date();
    await partnership.save();

    let achievementChanged = false;
    if (!myProfile.connectedComponent) {
      myProfile.connectedComponent = true;
      achievementChanged = true;
    }
    if (!partnerProfile.connectedComponent) {
      partnerProfile.connectedComponent = true;
      achievementChanged = true;
    }
    if (achievementChanged) {
      await Promise.all([myProfile.save(), partnerProfile.save()]);
    }

    res.json({
      partnership,
      partner: toPublicProfile(partnerProfile),
      profile: myProfile,
    });
  } catch (err) {
    console.error('Error accepting partner request:', err);
    res.status(500).json({ error: 'Server error while accepting request' });
  }
});

router.post('/decline', async (req, res) => {
  try {
    const { uid, partnerUid } = req.body ?? {};
    if (!uid || !partnerUid) {
      return res.status(400).json({ error: 'uid and partnerUid are required' });
    }

    const partnership = await findPartnership(uid, partnerUid);
    if (!partnership) {
      return res.status(404).json({ error: 'Partner request not found' });
    }

    partnership.status = 'declined';
    partnership.updatedAt = new Date();
    await partnership.save();

    res.json({ success: true, partnership });
  } catch (err) {
    console.error('Error declining partner request:', err);
    res.status(500).json({ error: 'Server error while declining request' });
  }
});

router.get('/:uid', async (req, res) => {
  try {
    const { uid } = req.params;

    const partnerships = await StudyPartnership.find({
      $or: [{ userA: uid }, { userB: uid }],
      status: { $in: ['pending', 'accepted'] },
    }).sort({ updatedAt: -1 });

    const partnerUids = partnerships.map((p) => (p.userA === uid ? p.userB : p.userA));
    const profiles = await UserProfile.find({ firebaseUid: { $in: partnerUids } });
    const profileMap = new Map(profiles.map((p) => [p.firebaseUid, p]));

    const accepted = [];
    const incoming = [];
    const outgoing = [];

    for (const p of partnerships) {
      const partnerUid = p.userA === uid ? p.userB : p.userA;
      const profile = profileMap.get(partnerUid);
      const entry = {
        partnershipId: p._id,
        uid: partnerUid,
        username: profile?.username || 'Student',
        profilePic: profile?.profilePic || '/assets/profile-placeholder.png',
        partnerCode: profile?.partnerCode,
        sharedSubjects: p.sharedSubjects || [],
        status: p.status,
        requestedBy: p.requestedBy,
        updatedAt: p.updatedAt,
      };

      if (p.status === 'accepted') {
        accepted.push(entry);
      } else if (p.requestedBy === uid) {
        outgoing.push(entry);
      } else {
        incoming.push(entry);
      }
    }

    res.json({ accepted, incoming, outgoing });
  } catch (err) {
    console.error('Error listing partners:', err);
    res.status(500).json({ error: 'Server error while listing partners' });
  }
});

router.delete('/:uid/:partnerUid', async (req, res) => {
  try {
    const { uid, partnerUid } = req.params;
    const partnership = await findPartnership(uid, partnerUid);

    if (!partnership || partnership.status !== 'accepted') {
      return res.status(404).json({ error: 'Partnership not found' });
    }

    await StudyPartnership.deleteOne({ _id: partnership._id });
    res.json({ success: true });
  } catch (err) {
    console.error('Error removing partner:', err);
    res.status(500).json({ error: 'Server error while removing partner' });
  }
});

module.exports = router;
