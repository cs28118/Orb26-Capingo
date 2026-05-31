import { useState } from 'react';
import './timetable.css';
type PriorityLevel = 'High' | 'Medium' | 'Low';

interface Todo {
  id: string;
  index: number;
  title: string;
  remarks?: string;
  hoursNeeded: number;
  priority: 'High' | 'Medium' | 'Low';
  allowSplit: boolean;
  deadline: string;
}

interface Event {
  id: string;
  title: string;
  remarks?: string;
  day: string;
  startHour: string;
  duration: number;
}

export default function Timetable() {
  // Available days and timeslots for timetable grid
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const timeslots = ['8am', '9am', '10am', '11am', '12pm', '1pm', '2pm', '3pm', '4pm', '5pm', '6pm', '7pm', '8pm', '9pm'];

  const [todoList, setTodoList] = useState<Todo[]>([]);
  const [eventsList, setEventsList] = useState<Event[]>([]);

  const [activeModal, setActiveModal] = useState<'NONE' | 'ADDTASK' | 'GENERATE' | 'MANUAL' | 'EDIT_TASK' | 'EDIT_EVENT'>('NONE');
  const [selectedTask, setSelectedTask] = useState<Todo | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  // For add task Interface
  const [taskTitle, setTaskTitle] = useState('');
  const [remarks, setRemarks] = useState('');
  const [timeNeeded, setTimeNeeded] = useState<number | ''>('');
  const [priority, setPriority] = useState<'High' | 'Medium' | 'Low'>('Low');
  const [allowSplit, setAllowSplit] = useState(false);
  const [deadline, setDeadline] = useState('');

  // For Auto-Generation Interface
  const [selectedDay, setSelectedDay] = useState('');
  const [selectedStart, setSelectedStart] = useState('8am');
  const [selectedEnd, setSelectedEnd] = useState('9pm');
  const [breakStart, setBreakStart] = useState('');
  const [breakEnd, setBreakEnd] = useState('');
  const [enabledDays, setEnabledDays] = useState<string[]>([]);

  // --- Reset Forms & Close Interfaces ---
  const closeModal = () => {
    setActiveModal('NONE');
    setSelectedTask(null);
    setSelectedEvent(null);
    setTaskTitle('');
    setRemarks('');
    setTimeNeeded('');
    setDeadline('');
    setSelectedDay('');
    setSelectedStart('');
    setSelectedEnd('');
    setBreakStart('');
    setBreakEnd('');
    setEnabledDays([]);
  };

  // -Feautre 1: Add to-do task
  const handleAddTaskSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newTask: Todo = {
      id: `task_${Date.now()}`,
      index: todoList.length + 1,
      title: taskTitle,
      remarks,
      hoursNeeded: timeNeeded === '' ? 1 : Number(timeNeeded),
      priority,
      allowSplit,
      deadline: deadline || '2026-06-08'
    };
    setTodoList([...todoList, newTask]);
    closeModal();
  };

  // Feature 2: Manually add event to timetable grid
const handleManualAddSubmit = (e: React.FormEvent) => {
  e.preventDefault();

  if (!selectedDay || !selectedStart || !timeNeeded) {
    alert("Please fill in all fields before adding to the timetable!");
    return;
  }

  const newEvent: Event = {
    id: `event_${Date.now()}`,
    title: taskTitle,
    remarks,
    day: selectedDay,
    startHour: selectedStart,
    duration: !timeNeeded ? 1 : Number(timeNeeded)
  };

  setEventsList([...eventsList, newEvent]);
  closeModal();
};

  // Feature 3: Auto-generate timetable
const handleAutoGenerateSubmit = (e: React.FormEvent) => {
  e.preventDefault();

  const startStr = selectedStart || '8am';
  const endStr = selectedEnd || '9pm';

  if (enabledDays.length === 0 || !breakStart || !breakEnd) {
    alert("Please configure all settings (Days, Study Window, and Break Window) before generating!");
    return;
  }

  const generatedEvents: Event[] = [];
  const startHourIdx = timeslots.indexOf(startStr);
  const endHourIdx = timeslots.indexOf(endStr);
  const breakStartIdx = timeslots.indexOf(breakStart);
  const breakEndIdx = timeslots.indexOf(breakEnd);

  // total hours
  const totalHoursRequested = todoList.reduce((sum, task) => sum + task.hoursNeeded, 0);
  let totalHoursScheduled = 0;

  // sort by priority
  const sortedTasks = [...todoList].sort((a, b) => {
    const rank = { High: 3, Medium: 2, Low: 1 };
    return rank[b.priority] - rank[a.priority];
  });

  const availableSlots: Record<string, Record<number, boolean>> = {};
  
  enabledDays.forEach((dayStr) => {
    availableSlots[dayStr] = {};
    for (let h = startHourIdx; h < endHourIdx; h++) {
      if (h < breakStartIdx || h >= breakEndIdx) {
        availableSlots[dayStr][h] = true;
      }
    }
  });

  sortedTasks.forEach((task) => {
    let hoursRemaining = task.hoursNeeded;

    for (let d = 0; d < enabledDays.length; d++) {
      const dayStr = enabledDays[d];
      let h = startHourIdx;

      while (h < endHourIdx && hoursRemaining > 0) {
        // check available continuous slots
        if (availableSlots[dayStr][h]) {
          let continuousLength = 0;
          while (h + continuousLength < endHourIdx && availableSlots[dayStr][h + continuousLength] && continuousLength < hoursRemaining) {
            continuousLength++;
            // split
            if (task.allowSplit && continuousLength === 2) break;
          }

          // fittable
          if (continuousLength > 0 && (task.allowSplit || continuousLength === hoursRemaining)) {
            generatedEvents.push({
              id: `auto_${task.id}_${Date.now()}_${d}_${h}`,
              title: task.title,
              day: dayStr,
              startHour: timeslots[h],
              duration: continuousLength
            });

            // Mark these slots as occupied
            for (let i = 0; i < continuousLength; i++) {
              availableSlots[dayStr][h + i] = false;
            }

            hoursRemaining -= continuousLength;
            totalHoursScheduled += continuousLength;
            h += continuousLength;
          } else {
            h++; // large task
          }
        } else {
          h++; // slot not available
        }
      }
      if (hoursRemaining === 0) break; // task fully scheduled
    }
  });

  setEventsList(generatedEvents);
  closeModal();

  if (totalHoursScheduled < totalHoursRequested) {
    const missingHours = totalHoursRequested - totalHoursScheduled;
    alert(`⚠️ Schedule full! Could not fit ${missingHours} hour(s) of your tasks into the configured study windows.`);
  }
};

  const toggleDayPill = (day: string) => {
    setEnabledDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  };

  const openEditTaskModal = (task: Todo) => {
  setSelectedTask(task);
  setTaskTitle(task.title);
  setRemarks(task.remarks || '');
  setTimeNeeded(task.hoursNeeded);
  setPriority(task.priority);
  setAllowSplit(task.allowSplit);
  setDeadline(task.deadline);
  setActiveModal('EDIT_TASK');
};

// Update task
const handleUpdateTaskSubmit = (e: React.FormEvent) => {
  e.preventDefault();
  if (!selectedTask) return;
  setTodoList(prev => prev.map(t => t.id === selectedTask.id ? {
    ...t, title: taskTitle, remarks, hoursNeeded: timeNeeded === '' ? 1 : Number(timeNeeded), priority, allowSplit, deadline
  } : t));
  closeModal();
};

const handleRemoveTask = (taskId: string) => {
  setTodoList(prev => prev.filter(t => t.id !== taskId).map((t, idx) => ({ ...t, index: idx + 1 })));
  closeModal();
};

// Update event
const openEditEventModal = (event: Event) => {
  setSelectedEvent(event);
  setTaskTitle(event.title);
  setRemarks(event.remarks || '');
  setSelectedDay(event.day);
  setSelectedStart(event.startHour);
  setTimeNeeded(event.duration);
  setActiveModal('EDIT_EVENT');
};

const handleUpdateEventSubmit = (e: React.FormEvent) => {
  e.preventDefault();
  if (!selectedEvent) return;
  setEventsList(prev => prev.map(evt => evt.id === selectedEvent.id ? {
    ...evt, title: taskTitle, remarks, day: selectedDay, startHour: selectedStart, duration: Number(timeNeeded)
  } : evt));
  closeModal();
};

const handleRemoveEvent = (eventId: string) => {
  setEventsList(prev => prev.filter(e => e.id !== eventId));
  closeModal();
};

  return (
    <div className="timetable-wrapper">
      
      {/* to-do list */}
      <section className="timetable-control-deck">
        <div className="sidebar-todo">
        <div className="todo-list">
          <h3>To do:</h3>
          <div className="todo-list-content">
            {todoList.length === 0 ? (
              <div className="empty-todo-list">No tasks left! Type below to create one.</div>
            ) : (
              todoList.map((task) => (
                <div key={task.id} className="todo-item">
                  <div className="todo-title-row-container">
                  <div className="todo-title">
                    <strong>📌 {task.index}. {task.title}</strong>
                  </div>
                  <button type="button" className="todo-card-edit-btn" onClick={() => openEditTaskModal(task)} title="Edit Task">
                    ✏️
                  </button>
                  </div>
                  <div className="todo-detail">
                    <span>📅 {task.deadline}</span>
                    <span>⏳ {task.hoursNeeded}h</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="timetable-buttons">
          <button className="action-btn" onClick={() => setActiveModal('ADDTASK')}>Add task</button>
          <button className="action-btn variant-accent" onClick={() => setActiveModal('GENERATE')}>Generate timetable</button>
          <button className="action-btn" onClick={() => setActiveModal('MANUAL')}>Add to timetable</button>
        </div>
        </div>
      </section>

      {/* timetable */}
      <section className="timetable-grid-canvas">
        <table className="timetable-matrix-table">
          <thead>
            <tr>
              <th className="column-label-all-day">All day</th>
              {timeslots.map(time => <th key={time} className="column-time-header">{time}</th>)}
            </tr>
          </thead>
          <tbody>
            {days.map(day => (
              <tr key={day} className="matrix-row-container">
                <td className="matrix-day-label"><strong>{day}</strong></td>
                {timeslots.map((time, index) => {
                  const activeEvent = eventsList.find(e => e.day === day && e.startHour === time);
                  
                  if (activeEvent) {
                    const startIdx = timeslots.indexOf(activeEvent.startHour);
                    const maxPossibleDuration = timeslots.length - startIdx;
                    const dynamicColSpan = Math.min(activeEvent.duration, maxPossibleDuration);
                    return (
                      <td key={time} colSpan={dynamicColSpan} className="matrix-slotted-block-cell">
                        <div className="slotted-event-card">
                          <p className="event-txt">{activeEvent.title}</p>
                          <span className="event-details-trigger" onClick={() => openEditEventModal(activeEvent)}>Details</span>
                        </div>
                      </td>
                    );
                  }

                  const isCellHidden = eventsList.some(e => {
                    if (e.day !== day) return false;
                    const matchStartIdx = timeslots.indexOf(e.startHour);
                    const maxPossibleDuration = timeslots.length - matchStartIdx;
                    const safeDuration = Math.min(e.duration, maxPossibleDuration);
                    return index > matchStartIdx && index < matchStartIdx + safeDuration;
                  });

                  if (isCellHidden) return null;

                  return <td key={time} className="matrix-unallocated-empty-cell" />;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {activeModal !== 'NONE' && (
        <div className="timetable-modal-dimmer-layer">
          <div className="timetable-modal-window">
            <button className="close-modal-btn" onClick={closeModal}>×</button>
            
            {/* add task button */}
            {activeModal === 'ADDTASK' && (
              <form onSubmit={handleAddTaskSubmit} className="modal-panel">
                <div className="form-fields">
                  <label>Task:</label>
                  <input type="text" value={taskTitle} onChange={e => setTaskTitle(e.target.value)} required placeholder="Revise for History test" />
                </div>
                <div className="form-fields">
                  <label>Remarks:</label>
                  <input type="text" value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Add structural specifications..." />
                </div>
                <div className="form-fields">
                  <label>Time needed (hours):</label>
                  <input type="number" min={1} max={12} value={timeNeeded} onChange={e => setTimeNeeded(e.target.value === '' ? '' : Number(e.target.value))} 
                          placeholder="e.g., 2" required/>
                </div>
                <div className="form-fields">
                  <label>Priority:</label>
                  <select value={priority} onChange={e => setPriority(e.target.value as PriorityLevel)}>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
                <div className="form-fields dual-row-checkbox">
                  <input type="checkbox" id="allowSplit" checked={allowSplit} onChange={e => setAllowSplit(e.target.checked)} />
                  <label htmlFor="allowSplit">Allow split?</label>
                </div>
                <div className="form-fields">
                  <label>Deadline:</label>
                  <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} />
                </div>
                <button type="submit" className="modal-submit-btn">Save task</button>
              </form>
            )}

            {/* generate timetable button */}
            {activeModal === 'GENERATE' && (
              <form onSubmit={handleAutoGenerateSubmit} className="modal-panel">
                <div className="form-fields">
                  <label>Available days:</label>
                  <div className="pill-selection-flex-row">
                    {days.map(d => (
                      <button type="button" key={d} className={`selection-pill-btn ${enabledDays.includes(d) ? 'active' : ''}`} onClick={() => toggleDayPill(d)}>
                        {d}
                      </button>
                   ))}
                  </div>
                </div>
                <div className="form-split-row-box">
                  <div className="form-fields flex-fill">
                    <label>Start:</label>
                    <select value={selectedStart} onChange={e => setSelectedStart(e.target.value)}>
                      {timeslots.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="form-fields flex-fill">
                    <label>End:</label>
                    <select value={selectedEnd} onChange={e => setSelectedEnd(e.target.value)}>
                      {timeslots.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-split-row-box">
                  <div className="form-fields flex-fill">
                    <label>Break Start:</label>
                    <select value={breakStart} onChange={e => setBreakStart(e.target.value)} required>
                      <option value="" disabled>Select break start...</option>
                      {timeslots.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="form-fields flex-fill">
                    <label>Break End:</label>
                    <select value={breakEnd} onChange={e => setBreakEnd(e.target.value)} required>
                      <option value="" disabled>Select break end...</option>
                      {timeslots.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
                <button type="submit" className="modal-submit-btn variant-accent-btn">Generate timetable</button>
              </form>
            )}

            {/* add to timetable button */}
            {activeModal === 'MANUAL' && (
              <form onSubmit={handleManualAddSubmit} className="modal-panel">
                <div className="form-fields">
                  <label>Task:</label>
                  <input type="text" value={taskTitle} onChange={e => setTaskTitle(e.target.value)} required placeholder="Revise for History test" />
                </div>
                <div className="form-fields">
                  <label>Remarks:</label>
                  <input type="text" value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="e.g. Chapter 4 focus" />
                </div>
                <div className="form-split-row-box">
                  <div className="form-fields flex-fill">
                    <label>Day:</label>
                    <select value={selectedDay} onChange={e => setSelectedDay(e.target.value)} required>
                      <option value="" disabled>Select day...</option>
                      {days.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div className="form-fields flex-fill">
                    <label>Start Hour:</label>
                    <select value={selectedStart} onChange={e => setSelectedStart(e.target.value)} required>
                      <option value="" disabled>Select time...</option>
                      {timeslots.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-fields">
                  <label>Duration Length (Hours):</label>
                  <input type="number" min={1} max={6} value={timeNeeded} onChange={e => setTimeNeeded(e.target.value === '' ? '' : Number(e.target.value))} 
                          placeholder="e.g., 2" required/>
                </div>
                <button type="submit" className="modal-submit-btn">Add task</button>
              </form>
            )}

            {/* edit task button */}
            {activeModal === 'EDIT_TASK' && selectedTask && (
              <form onSubmit={handleUpdateTaskSubmit} className="modal-panel">
                <h2>Edit Task Details</h2>
                
                <div className="form-fields">
                  <label>Task Title:</label>
                  <input type="text" value={taskTitle} onChange={e => setTaskTitle(e.target.value)} required />
                </div>
                
                <div className="form-fields">
                  <label>Remarks:</label>
                  <input type="text" value={remarks} onChange={e => setRemarks(e.target.value)} />
                </div>
                
                <div className="form-fields">
                  <label>Hours Needed:</label>
                  <input type="number" value={timeNeeded} onChange={e => setTimeNeeded(e.target.value === '' ? '' : Number(e.target.value))} required />
                </div>
                
                <div className="form-fields">
                  <label>Priority:</label>
                  <select value={priority} onChange={e => setPriority(e.target.value as PriorityLevel)}>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
                
                <div className="form-fields dual-row-checkbox">
                  <input type="checkbox" id="allowSplit" checked={allowSplit} onChange={e => setAllowSplit(e.target.checked)} />
                  <label htmlFor="allowSplit">Allow split?</label>
                </div>
                
                <div className="form-fields">
                  <label>Deadline:</label>
                  <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} />
                </div>
                
                <div className="modal-actions-wrapper">
                  <button type="submit" className="modal-submit-btn flex-fill">Save Changes</button>
                  <button type="button" className="modal-danger-delete-btn" onClick={() => handleRemoveTask(selectedTask.id)}>
                    Remove Task
                  </button>
                </div>
              </form>
            )}

            {/* add event button */}
            {activeModal === 'EDIT_EVENT' && selectedEvent && (
              <form onSubmit={handleUpdateEventSubmit} className="modal-panel">
                <h2>Edit Scheduled Event</h2>
                
                <div className="form-fields">
                  <label>Event Name:</label>
                  <input type="text" value={taskTitle} onChange={e => setTaskTitle(e.target.value)} required />
                </div>
                
                <div className="form-fields">
                  <label>Remarks:</label>
                  <input type="text" value={remarks} onChange={e => setRemarks(e.target.value)} />
                </div>
                
                <div className="form-split-row-box">
                  <div className="form-fields flex-fill">
                    <label>Day:</label>
                    <select value={selectedDay} onChange={e => setSelectedDay(e.target.value)} required>
                      {days.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div className="form-fields flex-fill">
                    <label>Start Hour:</label>
                    <select value={selectedStart} onChange={e => setSelectedStart(e.target.value)} required>
                      {timeslots.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
                
                <div className="form-fields">
                  <label>Duration Length (Hours):</label>
                  <input type="number" min={1} max={6} value={timeNeeded} onChange={e => setTimeNeeded(Number(e.target.value))} required />
                </div>

                <div className="modal-actions-wrapper">
                  <button type="submit" className="modal-submit-btn flex-fill">Update Schedule</button>
                  <button type="button" className="modal-danger-delete-btn" onClick={() => handleRemoveEvent(selectedEvent.id)}>
                    Delete Event
                  </button>
                </div>
              </form>
            )}

          </div>
        </div>
      )}
    </div>
  );
}