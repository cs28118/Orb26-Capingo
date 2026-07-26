const express = require('express');
const cors = require('cors');

function createTestApp() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '15mb' }));

  app.use('/api/rooms', require('../../routes/rooms'));
  app.use('/api/partners', require('../../routes/partners'));
  app.use('/api/decks', require('../../routes/decks'));
  app.use('/api/timetable', require('../../routes/timetable'));
  app.use('/api/profile', require('../../routes/profile'));
  app.use('/api/chats', require('../../routes/chats'));
  app.use('/api/dashboard', require('../../routes/dashboard'));

  return app;
}

module.exports = { createTestApp };
