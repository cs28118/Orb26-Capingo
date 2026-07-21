const express = require('express');
const router = express.Router();
const Room = require('../models/room');
const { generateRoomCode } = require('../models/room');
const Message = require('../models/message');
const UserProfile = require('../models/userProfile');
const StudyPartnership = require('../models/studyPartnership');
const { canonicalPair } = require('../models/studyPartnership');
const Announcement = require('../models/announcement');
const Resource = require('../models/resource');

async function areAcceptedPartners(uidA, uidB) {
  const [userA, userB] = canonicalPair(uidA, uidB);
  const partnership = await StudyPartnership.findOne({ userA, userB, status: 'accepted' });
  return !!partnership;
}

async function generateUniqueRoomCode() {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateRoomCode();
    const exists = await Room.findOne({ roomCode: code });
    if (!exists) return code;
  }
  throw new Error('Could not generate a unique room code');
}

router.get('/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    const rooms = await Room.find({ members: uid }).sort({ updatedAt: -1 });

    const memberUids = new Set();
    rooms.forEach((r) => r.members.forEach((m) => memberUids.add(m)));
    const profiles = await UserProfile.find({ firebaseUid: { $in: [...memberUids] } });
    const profileMap = new Map(profiles.map((p) => [p.firebaseUid, p]));

    const roomIds = rooms.map((r) => r._id);
    const lastMessages = await Message.aggregate([
      { $match: { roomId: { $in: roomIds } } },
      { $sort: { createdAt: -1 } },
      { $group: { _id: '$roomId', text: { $first: '$text' }, senderUid: { $first: '$senderUid' }, createdAt: { $first: '$createdAt' } } },
    ]);
    const lastMessageMap = new Map(lastMessages.map((m) => [String(m._id), m]));

    const result = rooms.map((r) => {
      const otherUid = r.type === 'direct' ? r.members.find((m) => m !== uid) : null;
      const otherProfile = otherUid ? profileMap.get(otherUid) : null;
      const last = lastMessageMap.get(String(r._id));

      return {
        roomId: r._id,
        roomCode: r.roomCode,
        type: r.type,
        name: r.type === 'direct'
          ? (otherProfile?.username || 'Study partner')
          : (r.name || 'Study room'),
        avatar: r.type === 'direct' ? (otherProfile?.profilePic || '/assets/profile-placeholder.png') : null,
        memberCount: r.members.length,
        isAdmin: r.type === 'group' ? (r.admins || []).includes(uid) : false,
        lastMessage: last ? { text: last.text, senderUid: last.senderUid, createdAt: last.createdAt } : null,
        updatedAt: r.updatedAt,
      };
    });

    res.json({ rooms: result });
  } catch (err) {
    console.error('Error listing rooms:', err);
    res.status(500).json({ error: 'Server error while listing rooms' });
  }
});

router.post('/direct', async (req, res) => {
  try {
    const { uid, partnerUid } = req.body ?? {};
    if (!uid || !partnerUid) {
      return res.status(400).json({ error: 'uid and partnerUid are required' });
    }
    if (uid === partnerUid) {
      return res.status(400).json({ error: 'Cannot open a chat with yourself' });
    }

    const isPartner = await areAcceptedPartners(uid, partnerUid);
    if (!isPartner) {
      return res.status(403).json({ error: 'You can only chat with accepted study partners' });
    }

    let room = await Room.findOne({
      type: 'direct',
      members: { $all: [uid, partnerUid], $size: 2 },
    });

    if (!room) {
      room = await Room.create({
        roomCode: await generateUniqueRoomCode(),
        type: 'direct',
        members: [uid, partnerUid],
        createdBy: uid,
      });
    }

    res.status(200).json({ roomId: room._id, roomCode: room.roomCode });
  } catch (err) {
    console.error('Error opening direct room:', err);
    res.status(500).json({ error: 'Server error while opening chat' });
  }
});

router.post('/group', async (req, res) => {
  try {
    const { uid, name } = req.body ?? {};
    if (!uid) {
      return res.status(400).json({ error: 'uid is required' });
    }

    const room = await Room.create({
      roomCode: await generateUniqueRoomCode(),
      type: 'group',
      name: String(name || '').trim().slice(0, 60) || 'Study room',
      members: [uid],
      admins: [uid],
      createdBy: uid,
    });

    res.status(201).json({ roomId: room._id, roomCode: room.roomCode, name: room.name });
  } catch (err) {
    console.error('Error creating group room:', err);
    res.status(500).json({ error: 'Server error while creating room' });
  }
});

router.post('/join', async (req, res) => {
  try {
    const { uid, roomCode } = req.body ?? {};
    if (!uid || !roomCode) {
      return res.status(400).json({ error: 'uid and roomCode are required' });
    }

    const room = await Room.findOne({ roomCode: String(roomCode).trim().toUpperCase() });
    if (!room) {
      return res.status(404).json({ error: 'Room code not found' });
    }
    if (room.type !== 'group') {
      return res.status(400).json({ error: 'This code does not belong to a group room' });
    }
    if (room.members.includes(uid)) {
      return res.status(200).json({ roomId: room._id, roomCode: room.roomCode, alreadyMember: true });
    }

    room.members.push(uid);
    room.updatedAt = new Date();
    await room.save();

    res.json({ roomId: room._id, roomCode: room.roomCode });
  } catch (err) {
    console.error('Error joining room:', err);
    res.status(500).json({ error: 'Server error while joining room' });
  }
});

router.post('/:roomId/invite', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { uid, targetUid } = req.body ?? {};
    if (!uid || !targetUid) {
      return res.status(400).json({ error: 'uid and targetUid are required' });
    }

    const room = await Room.findById(roomId);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (room.type !== 'group') return res.status(400).json({ error: 'Cannot invite into a direct chat' });
    if (!room.members.includes(uid)) {
      return res.status(403).json({ error: 'Only members can invite others' });
    }

    const isPartner = await areAcceptedPartners(uid, targetUid);
    if (!isPartner) {
      return res.status(403).json({ error: 'You can only invite accepted study partners' });
    }
    if (room.members.includes(targetUid)) {
      return res.status(409).json({ error: 'That partner is already in this room' });
    }

    room.members.push(targetUid);
    room.updatedAt = new Date();
    await room.save();

    res.json({ success: true });
  } catch (err) {
    console.error('Error inviting to room:', err);
    res.status(500).json({ error: 'Server error while inviting to room' });
  }
});

router.post('/:roomId/leave', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { uid } = req.body ?? {};
    if (!uid) return res.status(400).json({ error: 'uid is required' });

    const room = await Room.findById(roomId);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (room.type !== 'group') return res.status(400).json({ error: 'Cannot leave a direct chat' });

    room.members = room.members.filter((m) => m !== uid);
    room.admins = (room.admins || []).filter((a) => a !== uid);

    if (room.admins.length === 0 && room.members.length > 0) {
      room.admins = [room.members[0]];
    }

    room.updatedAt = new Date();
    await room.save();

    res.json({ success: true });
  } catch (err) {
    console.error('Error leaving room:', err);
    res.status(500).json({ error: 'Server error while leaving room' });
  }
});

router.get('/:roomId/messages', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { uid, after } = req.query;
    if (!uid) return res.status(400).json({ error: 'uid is required' });

    const room = await Room.findById(roomId);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (!room.members.includes(uid)) {
      return res.status(403).json({ error: 'You are not a member of this room' });
    }

    const query = { roomId };
    if (after) query.createdAt = { $gt: new Date(after) };

    const messages = await Message.find(query).sort({ createdAt: 1 }).limit(200);
    res.json({ messages });
  } catch (err) {
    console.error('Error fetching messages:', err);
    res.status(500).json({ error: 'Server error while fetching messages' });
  }
});

router.post('/:roomId/messages', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { uid, text } = req.body ?? {};
    if (!uid || !text || !String(text).trim()) {
      return res.status(400).json({ error: 'uid and non-empty text are required' });
    }

    const room = await Room.findById(roomId);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (!room.members.includes(uid)) {
      return res.status(403).json({ error: 'You are not a member of this room' });
    }

    const message = await Message.create({
      roomId,
      senderUid: uid,
      text: String(text).trim().slice(0, 2000),
    });

    room.updatedAt = new Date();
    await room.save();

    res.status(201).json({ message });
  } catch (err) {
    console.error('Error sending message:', err);
    res.status(500).json({ error: 'Server error while sending message' });
  }
});

//member list
router.get('/:roomId/members', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { uid } = req.query;
    if (!uid) return res.status(400).json({ error: 'uid is required' });

    const room = await Room.findById(roomId);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (!room.members.includes(uid)) {
      return res.status(403).json({ error: 'You are not a member of this room' });
    }

    const profiles = await UserProfile.find({ firebaseUid: { $in: room.members } });
    const profileMap = new Map(profiles.map((p) => [p.firebaseUid, p]));
    const admins = new Set(room.admins || []);

    const members = room.members.map((memberUid) => {
      const profile = profileMap.get(memberUid);
      return {
        uid: memberUid,
        username: profile?.username || 'Student',
        profilePic: profile?.profilePic || '/assets/profile-placeholder.png',
        role: admins.has(memberUid) ? 'admin' : 'member',
      };
    });

    res.json({ members, roomCode: room.roomCode });
  } catch (err) {
    console.error('Error fetching members:', err);
    res.status(500).json({ error: 'Server error while fetching members' });
  }
});

// remove member: admin-only
router.post('/:roomId/kick', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { uid, targetUid } = req.body ?? {};
    if (!uid || !targetUid) {
      return res.status(400).json({ error: 'uid and targetUid are required' });
    }
    if (uid === targetUid) {
      return res.status(400).json({ error: 'Use "Leave room" to remove yourself' });
    }

    const room = await Room.findById(roomId);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (room.type !== 'group') return res.status(400).json({ error: 'Cannot remove members from a direct chat' });
    if (!(room.admins || []).includes(uid)) {
      return res.status(403).json({ error: 'Only admins can remove members' });
    }
    if (!room.members.includes(targetUid)) {
      return res.status(404).json({ error: 'That user is not in this room' });
    }

    room.members = room.members.filter((m) => m !== targetUid);
    room.admins = (room.admins || []).filter((a) => a !== targetUid);

    if (room.admins.length === 0 && room.members.length > 0) {
      room.admins = [room.members[0]];
    }

    room.updatedAt = new Date();
    await room.save();

    res.json({ success: true });
  } catch (err) {
    console.error('Error kicking member:', err);
    res.status(500).json({ error: 'Server error while removing member' });
  }
});

// promote a member: admin-only
router.post('/:roomId/promote', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { uid, targetUid } = req.body ?? {};
    if (!uid || !targetUid) {
      return res.status(400).json({ error: 'uid and targetUid are required' });
    }

    const room = await Room.findById(roomId);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (room.type !== 'group') return res.status(400).json({ error: 'Direct chats have no admins' });
    if (!(room.admins || []).includes(uid)) {
      return res.status(403).json({ error: 'Only admins can promote members' });
    }
    if (!room.members.includes(targetUid)) {
      return res.status(404).json({ error: 'That user is not in this room' });
    }
    if ((room.admins || []).includes(targetUid)) {
      return res.status(409).json({ error: 'That member is already an admin' });
    }

    room.admins = [...(room.admins || []), targetUid];
    room.updatedAt = new Date();
    await room.save();

    res.json({ success: true });
  } catch (err) {
    console.error('Error promoting member:', err);
    res.status(500).json({ error: 'Server error while promoting member' });
  }
});

//announcement management ---
router.get('/:roomId/announcements', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { uid } = req.query;
    if (!uid) return res.status(400).json({ error: 'uid is required' });

    const room = await Room.findById(roomId);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (!room.members.includes(uid)) {
      return res.status(403).json({ error: 'You are not a member of this room' });
    }

    const announcements = await Announcement.find({ roomId }).sort({ createdAt: -1 }).limit(100);
    res.json({ announcements });
  } catch (err) {
    console.error('Error fetching announcements:', err);
    res.status(500).json({ error: 'Server error while fetching announcements' });
  }
});

router.post('/:roomId/announcements', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { uid, text } = req.body ?? {};
    if (!uid || !text || !String(text).trim()) {
      return res.status(400).json({ error: 'uid and non-empty text are required' });
    }

    const room = await Room.findById(roomId);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (room.type !== 'group') return res.status(400).json({ error: 'Direct chats cannot have announcements' });
    if (!(room.admins || []).includes(uid)) {
      return res.status(403).json({ error: 'Only admins can post announcements' });
    }

    const announcement = await Announcement.create({
      roomId,
      authorUid: uid,
      text: String(text).trim().slice(0, 2000),
    });

    res.status(201).json({ announcement });
  } catch (err) {
    console.error('Error posting announcement:', err);
    res.status(500).json({ error: 'Server error while posting announcement' });
  }
});

router.delete('/:roomId/announcements/:announcementId', async (req, res) => {
  try {
    const { roomId, announcementId } = req.params;
    const { uid } = req.query;
    if (!uid) return res.status(400).json({ error: 'uid is required' });

    const room = await Room.findById(roomId);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (!(room.admins || []).includes(uid)) {
      return res.status(403).json({ error: 'Only admins can delete announcements' });
    }

    const announcement = await Announcement.findOneAndDelete({ _id: announcementId, roomId });
    if (!announcement) return res.status(404).json({ error: 'Announcement not found' });

    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting announcement:', err);
    res.status(500).json({ error: 'Server error while deleting announcement' });
  }
});

//resource management ---
function isSafeHttpUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

router.get('/:roomId/resources', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { uid } = req.query;
    if (!uid) return res.status(400).json({ error: 'uid is required' });

    const room = await Room.findById(roomId);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (!room.members.includes(uid)) {
      return res.status(403).json({ error: 'You are not a member of this room' });
    }

    const resources = await Resource.find({ roomId }).sort({ createdAt: -1 }).limit(200);
    res.json({ resources });
  } catch (err) {
    console.error('Error fetching resources:', err);
    res.status(500).json({ error: 'Server error while fetching resources' });
  }
});

router.post('/:roomId/resources', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { uid, title, url, description } = req.body ?? {};
    if (!uid || !title || !String(title).trim() || !url) {
      return res.status(400).json({ error: 'uid, title, and url are required' });
    }
    if (!isSafeHttpUrl(url)) {
      return res.status(400).json({ error: 'url must be a valid http(s) link' });
    }

    const room = await Room.findById(roomId);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (!room.members.includes(uid)) {
      return res.status(403).json({ error: 'You are not a member of this room' });
    }

    const resource = await Resource.create({
      roomId,
      addedByUid: uid,
      title: String(title).trim().slice(0, 120),
      url: String(url).trim().slice(0, 2000),
      description: String(description || '').trim().slice(0, 500),
    });

    res.status(201).json({ resource });
  } catch (err) {
    console.error('Error adding resource:', err);
    res.status(500).json({ error: 'Server error while adding resource' });
  }
});

router.delete('/:roomId/resources/:resourceId', async (req, res) => {
  try {
    const { roomId, resourceId } = req.params;
    const { uid } = req.query;
    if (!uid) return res.status(400).json({ error: 'uid is required' });

    const room = await Room.findById(roomId);
    if (!room) return res.status(404).json({ error: 'Room not found' });

    const resource = await Resource.findOne({ _id: resourceId, roomId });
    if (!resource) return res.status(404).json({ error: 'Resource not found' });

    const isOwner = resource.addedByUid === uid;
    const isAdmin = (room.admins || []).includes(uid);
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'Only the person who added this or an admin can remove it' });
    }

    await Resource.deleteOne({ _id: resourceId });
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting resource:', err);
    res.status(500).json({ error: 'Server error while deleting resource' });
  }
});

module.exports = router;