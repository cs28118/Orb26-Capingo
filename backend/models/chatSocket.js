const Room = require('./room');
const Message = require('./message');

function registerChatSocket(io) {
  io.on('connection', (socket) => {
    const uid = socket.handshake.auth?.uid;
    if (!uid) {
      socket.disconnect(true);
      return;
    }
    socket.data.uid = uid;

    socket.on('join_room', async (roomId, callback) => {
      try {
        const room = await Room.findById(roomId);
        if (!room || !room.members.includes(uid)) {
          if (callback) callback({ error: 'Not a member of this room' });
          return;
        }
        socket.join(String(roomId));
        if (callback) callback({ success: true });
      } catch {
        if (callback) callback({ error: 'Could not join room' });
      }
    });

    socket.on('leave_room', (roomId) => {
      socket.leave(String(roomId));
    });

    socket.on('send_message', async (payload, callback) => {
      try {
        const { roomId, text, replyToId } = payload || {};
        const trimmed = String(text || '').trim();
        if (!roomId || !trimmed) {
          if (callback) callback({ error: 'roomId and non-empty text are required' });
          return;
        }

        const room = await Room.findById(roomId);
        if (!room || !room.members.includes(uid)) {
          if (callback) callback({ error: 'You are not a member of this room' });
          return;
        }

        let replyTo;
        if (replyToId) {
          const original = await Message.findOne({ _id: replyToId, roomId, deleted: { $ne: true } });
          if (original) {
            replyTo = {
              messageId: original._id,
              senderUid: original.senderUid,
              text: original.text.slice(0, 200),
            };
          }
        }

        const message = await Message.create({
          roomId,
          senderUid: uid,
          text: trimmed.slice(0, 2000),
          ...(replyTo ? { replyTo } : {}),
        });

        room.updatedAt = new Date();
        await room.save();

        io.to(String(roomId)).emit('new_message', message);
        if (callback) callback({ success: true, message });
      } catch (err) {
        console.error('Socket send_message error:', err);
        if (callback) callback({ error: 'Could not send message' });
      }
    });

    socket.on('delete_message', async (payload, callback) => {
      try {
        const { roomId, messageId } = payload || {};
        if (!roomId || !messageId) {
          if (callback) callback({ error: 'roomId and messageId are required' });
          return;
        }

        const room = await Room.findById(roomId);
        if (!room || !room.members.includes(uid)) {
          if (callback) callback({ error: 'You are not a member of this room' });
          return;
        }

        const message = await Message.findOne({ _id: messageId, roomId });
        if (!message) {
          if (callback) callback({ error: 'Message not found' });
          return;
        }

        const isSender = message.senderUid === uid;
        const isAdmin = (room.admins || []).includes(uid);
        if (!isSender && !isAdmin) {
          if (callback) callback({ error: 'Only the sender or a room admin can delete this message' });
          return;
        }

        message.deleted = true;
        message.text = '[deleted]';
        await message.save();

        io.to(String(roomId)).emit('message_deleted', { roomId, messageId: String(message._id) });
        if (callback) callback({ success: true });
      } catch (err) {
        console.error('Socket delete_message error:', err);
        if (callback) callback({ error: `Could not delete message: ${err.message}` });
      }
    });
  });
}

module.exports = registerChatSocket;