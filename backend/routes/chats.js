const express = require('express');
const router = express.Router();
const Chat = require('../models/chat');
const {
  createToolCatalog,
  findTool,
  normalizeMessagesWithExpiry,
  isActionExpired,
} = require('../utils/toolCatalog');

// generateFlashcards is injected from indexGemini after boot — confirm uses the same catalog.
let toolCatalog = createToolCatalog({});

function setChatToolCatalog(catalog) {
  toolCatalog = catalog;
}

function toFullChat(doc) {
  const messages = normalizeMessagesWithExpiry(doc.messages || []);
  return {
    id: doc.chatId,
    title: doc.title,
    pinned: doc.pinned,
    messages,
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

    const messages = normalizeMessagesWithExpiry(doc.messages || []);
    const changed = JSON.stringify(messages) !== JSON.stringify(doc.messages || []);
    if (changed) {
      doc.messages = messages;
      await doc.save();
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
          messages: normalizeMessagesWithExpiry(messages, now),
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

/**
 * Confirm a pending tool action (write tools).
 * NOTE: uid is trusted from request params — see auth fix, not in scope here
 */
router.post('/:uid/:chatId/actions/:messageId/confirm', async (req, res) => {
  try {
    const { uid, chatId, messageId } = req.params;
    const doc = await Chat.findOne({ firebaseUid: uid, chatId });
    if (!doc) return res.status(404).json({ error: 'Chat not found' });

    const messages = normalizeMessagesWithExpiry(doc.messages || []);
    const idx = messages.findIndex((m) => m.id === messageId && m.role === 'action');
    if (idx < 0) return res.status(404).json({ error: 'Action message not found' });

    const message = messages[idx];
    if (message.action?.status === 'expired' || isActionExpired(message)) {
      message.action = {
        ...(message.action || {}),
        status: 'expired',
        result: { error: 'This proposed action expired. Ask Capingo to propose it again.' },
      };
      messages[idx] = message;
      doc.messages = messages;
      await doc.save();
      return res.status(410).json({ error: 'Action expired', message });
    }
    if (message.action?.status !== 'pending') {
      return res.status(400).json({ error: `Action is already ${message.action?.status}` });
    }

    const tool = findTool(toolCatalog, message.action.tool);
    if (!tool || !tool.isWrite) {
      return res.status(400).json({ error: 'Unknown or non-writable tool' });
    }

    // NOTE: uid is trusted from request params — see auth fix, not in scope here
    const proposal = await tool.handler(uid, message.action.args || {});
    let result;
    try {
      result = await proposal.execute();
    } catch (err) {
      if (err.code === 'STALE' || err.code === 'CAP') {
        message.action.status = 'expired';
        message.action.result = { error: err.message };
        messages[idx] = message;
        doc.messages = messages;
        doc.updatedAt = Date.now();
        await doc.save();
        return res.status(409).json({ error: err.message, message });
      }
      throw err;
    }

    message.action.status = 'confirmed';
    message.action.result = result;
    messages[idx] = message;
    doc.messages = messages;
    doc.updatedAt = Date.now();
    await doc.save();

    res.json({ success: true, message });
  } catch (err) {
    console.error('Error confirming action:', err);
    res.status(500).json({ error: err.message || 'Server error while confirming action' });
  }
});

router.post('/:uid/:chatId/actions/:messageId/cancel', async (req, res) => {
  try {
    const { uid, chatId, messageId } = req.params;
    const doc = await Chat.findOne({ firebaseUid: uid, chatId });
    if (!doc) return res.status(404).json({ error: 'Chat not found' });

    const messages = normalizeMessagesWithExpiry(doc.messages || []);
    const idx = messages.findIndex((m) => m.id === messageId && m.role === 'action');
    if (idx < 0) return res.status(404).json({ error: 'Action message not found' });

    const message = messages[idx];
    if (message.action?.status !== 'pending' && message.action?.status !== 'expired') {
      return res.status(400).json({ error: `Action is already ${message.action?.status}` });
    }

    message.action = { ...(message.action || {}), status: 'cancelled' };
    messages[idx] = message;
    doc.messages = messages;
    doc.updatedAt = Date.now();
    await doc.save();

    res.json({ success: true, message });
  } catch (err) {
    console.error('Error cancelling action:', err);
    res.status(500).json({ error: 'Server error while cancelling action' });
  }
});

module.exports = router;
module.exports.setChatToolCatalog = setChatToolCatalog;
