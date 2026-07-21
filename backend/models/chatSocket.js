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
        const { roomId, text } = payload || {};
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

        const message = await Message.create({
          roomId,
          senderUid: uid,
          text: trimmed.slice(0, 2000),
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
  });
}

module.exports = registerChatSocket;