const express = require('express');
const router = express.Router();
const Timetable = require('../models/timetable');
const { syncSubjectsToProfile } = require('../utils/subjectSync');

router.get('/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    let timetable = await Timetable.findOne({ firebaseUid: uid });

    if (!timetable) {
      timetable = new Timetable({ firebaseUid: uid, todos: [], events: [] });
      await timetable.save();
    }

    res.json({
      todos: timetable.todos,
      events: timetable.events,
      updatedAt: timetable.updatedAt,
    });
  } catch (err) {
    console.error('Error fetching timetable:', err);
    res.status(500).json({ error: 'Server error while fetching timetable' });
  }
});

router.put('/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    const { todos, events } = req.body;

    if (!Array.isArray(todos) || !Array.isArray(events)) {
      return res.status(400).json({ error: 'Request body must include todos and events arrays.' });
    }

    const timetable = await Timetable.findOneAndUpdate(
      { firebaseUid: uid },
      { todos, events, updatedAt: new Date() },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    const syncedSubjects = await syncSubjectsToProfile(uid, todos, events);

    res.json({
      todos: timetable.todos,
      events: timetable.events,
      updatedAt: timetable.updatedAt,
      syncedSubjects,
    });
  } catch (err) {
    console.error('Error saving timetable:', err);
    res.status(500).json({ error: 'Server error while saving timetable' });
  }
});

module.exports = router;
