const express = require('express');
const router = express.Router();
const Chat = require('../models/chat');

function toFullChat(doc) {
  return {
    id: doc.chatId,
    title: doc.title,
    pinned: doc.pinned,
    messages: doc.messages,
    memorySummary: doc.memorySummary || undefined,
    memoryUpToIndex: doc.memoryUpToIndex ?? 0,
    updatedAt: doc.updatedAt,
  };
}

function toSummary(doc) {
  return {
    id: doc.chatId,
    title: doc.title,
    pinned: doc.pinned,
    updatedAt: doc.updatedAt,
    messageCount: doc.messages?.length ?? 0,
  };
}

router.get('/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    const docs = await Chat.find({ firebaseUid: uid })
      .select('chatId title pinned updatedAt messages')
      .sort({ pinned: -1, updatedAt: -1 })
      .lean();

    res.json({ chats: docs.map(toSummary) });
  } catch (err) {
    console.error('Error listing chats:', err);
    res.status(500).json({ error: 'Server error while listing chats' });
  }
});

router.get('/:uid/:chatId', async (req, res) => {
  try {
    const { uid, chatId } = req.params;
    const doc = await Chat.findOne({ firebaseUid: uid, chatId });

    if (!doc) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    res.json(toFullChat(doc));
  } catch (err) {
    console.error('Error fetching chat:', err);
    res.status(500).json({ error: 'Server error while fetching chat' });
  }
});

router.post('/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    const now = Date.now();
    const chatId = req.body?.chatId || `chat_${now}`;

    const existing = await Chat.findOne({ firebaseUid: uid, chatId });
    if (existing) {
      return res.json(toFullChat(existing));
    }

    const doc = new Chat({
      firebaseUid: uid,
      chatId,
      title: req.body?.title || 'New chat',
      pinned: false,
      messages: [],
      memorySummary: '',
      memoryUpToIndex: 0,
      createdAt: now,
      updatedAt: now,
    });
    await doc.save();

    res.status(201).json(toFullChat(doc));
  } catch (err) {
    console.error('Error creating chat:', err);
    res.status(500).json({ error: 'Server error while creating chat' });
  }
});

router.put('/:uid/:chatId', async (req, res) => {
  try {
    const { uid, chatId } = req.params;
    const {
      title,
      pinned,
      messages,
      memorySummary,
      memoryUpToIndex,
      updatedAt,
    } = req.body ?? {};

    if (!Array.isArray(messages)) {
      return res.status(400).json({ error: 'Request body must include a messages array.' });
    }

    const now = Date.now();
    const doc = await Chat.findOneAndUpdate(
      { firebaseUid: uid, chatId },
      {
        $set: {
          firebaseUid: uid,
          chatId,
          title: title ?? 'New chat',
          pinned: pinned ?? false,
          messages,
          memorySummary: memorySummary ?? '',
          memoryUpToIndex: memoryUpToIndex ?? 0,
          updatedAt: updatedAt ?? now,
        },
        $setOnInsert: { createdAt: now },
      },
      { new: true, upsert: true }
    );

    res.json(toFullChat(doc));
  } catch (err) {
    console.error('Error saving chat:', err);
    res.status(500).json({ error: 'Server error while saving chat' });
  }
});

router.delete('/:uid/:chatId', async (req, res) => {
  try {
    const { uid, chatId } = req.params;
    const result = await Chat.deleteOne({ firebaseUid: uid, chatId });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting chat:', err);
    res.status(500).json({ error: 'Server error while deleting chat' });
  }
});

module.exports = router;
