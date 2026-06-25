const mongoose = require('mongoose');

const TodoSchema = new mongoose.Schema({
  id: { type: String, required: true },
  index: { type: Number, required: true },
  title: { type: String, required: true },
  remarks: { type: String, default: '' },
  hoursNeeded: { type: Number, required: true },
  priority: { type: String, enum: ['High', 'Medium', 'Low'], default: 'Low' },
  allowSplit: { type: Boolean, default: false },
  deadline: { type: String, default: '' },
  subject: { type: String, default: '' },
}, { _id: false });

const EventSchema = new mongoose.Schema({
  id: { type: String, required: true },
  title: { type: String, required: true },
  remarks: { type: String, default: '' },
  day: { type: String, required: true },
  startHour: { type: String, required: true },
  duration: { type: Number, required: true },
  subject: { type: String, default: '' },
}, { _id: false });

const TimetableSchema = new mongoose.Schema({
  firebaseUid: { type: String, required: true, unique: true },
  todos: { type: [TodoSchema], default: [] },
  events: { type: [EventSchema], default: [] },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Timetable', TimetableSchema);
