import { useState, useEffect, useRef, useMemo } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import './timetable.css';
import { triggerToast } from '../components/NotiHelper';
type PriorityLevel = 'High' | 'Medium' | 'Low';

const PRESET_SUBJECTS = [
  'Maths',
  'Biology',
  'Chemistry',
  'Physics',
  'History',
  'English',
  'Computer Science',
];

interface Todo {
  id: string;
  index: number;
  title: string;
  remarks?: string;
  hoursNeeded: number;
  priority: 'High' | 'Medium' | 'Low';
  allowSplit: boolean;
  deadline: string;
  subject?: string;
}

interface Event {
  id: string;
  title: string;
  remarks?: string;
  day: string;
  startHour: string;
  duration: number;
  subject?: string;
}

//sliding timetable grid
const FULL_TIMESLOTS: string[] = (() => {
  const labels: string[] = [];
  for (let h = 6; h < 24; h++) {
    const period = h < 12 ? 'am' : 'pm';
    const displayHour = h % 12 === 0 ? 12 : h % 12;
    labels.push(`${displayHour}${period}`);
  }
  return labels;
})();
const VISIBLE_SLOTS = 7;

//time system/helper in timetable
const DAY_TO_INDEX: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
function getMondayOfWeek(reference: Date): Date {
  const d = new Date(reference);
  const currentDay = d.getDay(); // 0 = Sun
  const diffToMonday = currentDay === 0 ? -6 : 1 - currentDay;
  d.setDate(d.getDate() + diffToMonday);
  d.setHours(0, 0, 0, 0);
  return d;
}
function getDateForDayThisWeek(dayName: string, reference: Date): Date {
  const monday = getMondayOfWeek(reference);
  const offsetFromMonday = DAY_TO_INDEX[dayName];
  const result = new Date(monday);
  result.setDate(monday.getDate() + offsetFromMonday);
  return result;
}
function parseHourLabel(label: string): number {
  const match = label.match(/^(\d+)(am|pm)$/i);
  if (!match) return 0;
  let hour = parseInt(match[1], 10);
  const period = match[2].toLowerCase();
  if (period === 'pm' && hour !== 12) hour += 12;
  if (period === 'am' && hour === 12) hour = 0;
  return hour;
}
function getSlotDateTime(dayName: string, hourLabel: string, reference: Date): Date {
  const dayDate = getDateForDayThisWeek(dayName, reference);
  dayDate.setHours(parseHourLabel(hourLabel), 0, 0, 0);
  return dayDate;
}
function getDefaultDeadline(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}


export default function Timetable() {
  const timeslots = FULL_TIMESLOTS;
  const [windowStart, setWindowStart] = useState(0);
  const maxWindowStart = timeslots.length - VISIBLE_SLOTS;
  const visibleTimeslots = timeslots.slice(windowStart, windowStart + VISIBLE_SLOTS);

  const [firebaseUser, setFirebaseUser] = useState<{ uid: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [saveError, setSaveError] = useState('');
  const skipSaveRef = useRef(true);

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
  const [subject, setSubject] = useState('');

  const knownSubjects = useMemo(() => {
    const seen = new Map<string, string>();
    for (const s of PRESET_SUBJECTS) seen.set(s.toLowerCase(), s);
    for (const item of [...todoList, ...eventsList]) {
      const trimmed = (item.subject || '').trim();
      if (trimmed) seen.set(trimmed.toLowerCase(), trimmed);
    }
    return [...seen.values()].sort((a, b) => a.localeCompare(b));
  }, [todoList, eventsList]);
  const [selectedDay, setSelectedDay] = useState('');
  const [selectedStart, setSelectedStart] = useState('');
  const [selectedEnd, setSelectedEnd] = useState('');
  const [breakStart, setBreakStart] = useState('');
  const [breakEnd, setBreakEnd] = useState('');
  const [enabledDays, setEnabledDays] = useState<string[]>([]);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const formattedDate = now.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const formattedTime = now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      if (!user) setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const gridPositionRef = useRef<HTMLDivElement>(null);
  const headerCellRefs = useRef<Map<string, HTMLTableCellElement>>(new Map());
  const dayRowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map());
  const [nowLineStyle, setNowLineStyle] = useState<{ left: number; top: number; height: number } | null>(null);
  const todayLabel = DAY_LABELS[(now.getDay() + 6) % 7];

  useEffect(() => {
    const computeNowLine = () => {
      const container = gridPositionRef.current;
      const todayRow = dayRowRefs.current.get(todayLabel);
      const currentHour = now.getHours();
      if (!container || !todayRow || currentHour < 6) {
        setNowLineStyle(null);
        return;
      }
      const hourLabel = FULL_TIMESLOTS[currentHour - 6];
      const absIndex = timeslots.indexOf(hourLabel);
      if (absIndex < windowStart || absIndex >= windowStart + VISIBLE_SLOTS) {
        setNowLineStyle(null);
        return;
      }
      const headerCell = headerCellRefs.current.get(hourLabel);
      if (!headerCell) {
        setNowLineStyle(null);
        return;
      }
      const containerRect = container.getBoundingClientRect();
      const headerRect = headerCell.getBoundingClientRect();
      const rowRect = todayRow.getBoundingClientRect();
      const minutesFraction = now.getMinutes() / 60;
      const left = (headerRect.left - containerRect.left) + headerRect.width * minutesFraction;
      const top = rowRect.top - containerRect.top;
      const height = rowRect.height;
      setNowLineStyle({ left, top, height });
    };
    computeNowLine();
    window.addEventListener('resize', computeNowLine);
    return () => window.removeEventListener('resize', computeNowLine);
  }, [now, windowStart, todayLabel, timeslots]);

  useEffect(() => {
    if (!firebaseUser) return;

    const fetchTimetable = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/api/timetable/${firebaseUser.uid}`
        );
        if (!response.ok) throw new Error('Failed to load timetable');
        const data = await response.json();
        setTodoList(data.todos ?? []);
        setEventsList(data.events ?? []);
        setSaveError('');
      } catch (err) {
        console.error('Error loading timetable:', err);
        setSaveError('Could not load your timetable.');
      } finally {
        skipSaveRef.current = true;
        setIsLoading(false);
      }
    };

    fetchTimetable();
  }, [firebaseUser]);

  useEffect(() => {
    if (!firebaseUser || isLoading) return;

    if (skipSaveRef.current) {
      skipSaveRef.current = false;
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/api/timetable/${firebaseUser.uid}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ todos: todoList, events: eventsList }),
          }
        );
        if (!response.ok) throw new Error('Failed to save timetable');
        setSaveError('');
      } catch (err) {
        console.error('Error saving timetable:', err);
        setSaveError('Could not save changes. They are kept locally until you refresh.');
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [firebaseUser, isLoading, todoList, eventsList]);

  // --- Reset Forms & Close Interfaces ---
  const closeModal = () => {
    setActiveModal('NONE');
    setSelectedTask(null);
    setSelectedEvent(null);
    setTaskTitle('');
    setRemarks('');
    setTimeNeeded('');
    setDeadline('');
    setSubject('');
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
      deadline: deadline || getDefaultDeadline(),
      subject: subject.trim(),
    };
    setTodoList([...todoList, newTask]);
    closeModal();
  };

  // Feature 2: Manually add event to timetable grid
const handleManualAddSubmit = (e: React.FormEvent) => {
  e.preventDefault();

  if (!selectedDay || !selectedStart || !timeNeeded) {
    triggerToast('error', 'Missing fields', 'Please fill in all fields before adding to the timetable!');
    return;
  }

  const newEvent: Event = {
    id: `event_${Date.now()}`,
    title: taskTitle,
    remarks,
    day: selectedDay,
    startHour: selectedStart,
    duration: !timeNeeded ? 1 : Number(timeNeeded),
    subject: subject.trim(),
  };

  setEventsList([...eventsList, newEvent]);
  closeModal();
};

  // Feature 3: Auto-generate timetable
const handleAutoGenerateSubmit = (e: React.FormEvent) => {
  e.preventDefault();

  if (!selectedStart || !selectedEnd || !breakStart || !breakEnd || enabledDays.length === 0) {
    triggerToast('error', 'Missing settings', 'Please configure Days, Study Window and Break Window before generating!');
    return;
  }
  if (todoList.length === 0) {
    triggerToast('error', 'Nothing to schedule', 'Add at least one task to your to-do list first.');
    return;
  }

  const referenceNow = new Date();
  const generatedEvents: Event[] = [];
  const unscheduledTasks: string[] = [];
  let currentDayIdx = 0;
  let currentHourIdx = timeslots.indexOf(selectedStart);
  const endHourIdx = timeslots.indexOf(selectedEnd);
  const hasBreak = breakStart !== 'NONE' && breakEnd !== 'NONE';
  const breakStartIdx = hasBreak ? timeslots.indexOf(breakStart) : -1;
  const breakEndIdx = hasBreak ? timeslots.indexOf(breakEnd) : -1;
  const sortedTasks = [...todoList].sort((a, b) => {
    const rank = { High: 3, Medium: 2, Low: 1 };
    return rank[b.priority] - rank[a.priority];
  });

  sortedTasks.forEach((task) => {
    let hoursRemaining = task.hoursNeeded;
    const deadlineDate = task.deadline ? new Date(`${task.deadline}T23:59:59`) : null;
    while (hoursRemaining > 0 && currentDayIdx < enabledDays.length) {
      const activeDayStr = enabledDays[currentDayIdx];
      if (currentHourIdx >= endHourIdx) {
        currentHourIdx = timeslots.indexOf(selectedStart);
        currentDayIdx++;
        continue;
      }
      if (hasBreak && currentHourIdx >= breakStartIdx && currentHourIdx < breakEndIdx) {
        currentHourIdx = breakEndIdx;
        continue;
      }
      const slotDateTime = getSlotDateTime(activeDayStr, timeslots[currentHourIdx], referenceNow);
      if (slotDateTime < referenceNow) {
        currentHourIdx++;
        continue;
      }
      if (deadlineDate && slotDateTime > deadlineDate) {
        break;
      }
      const blockDuration = task.allowSplit ? Math.min(hoursRemaining, 2) : hoursRemaining;
      const fitsBeforeEnd = currentHourIdx + blockDuration <= endHourIdx;
      const overlapsWithBreak = currentHourIdx < breakStartIdx && (currentHourIdx + blockDuration) > breakStartIdx;
      if (fitsBeforeEnd && !overlapsWithBreak) {
        generatedEvents.push({
          id: `auto_${task.id}_${Date.now()}_${hoursRemaining}`,
          title: task.title,
          day: activeDayStr,
          startHour: timeslots[currentHourIdx],
          duration: blockDuration,
          subject: task.subject || '',
        });
        hoursRemaining -= blockDuration;
        currentHourIdx += blockDuration;
      } else {
        if (hasBreak && currentHourIdx < breakStartIdx) {
          currentHourIdx = breakStartIdx;
        } else {
          currentHourIdx = timeslots.indexOf(selectedStart);
          currentDayIdx++;
        }
      }
    }
    if (hoursRemaining > 0) {
      unscheduledTasks.push(task.title);
    }
  });
  setEventsList(generatedEvents);
  closeModal();

  if (generatedEvents.length === 0) {
    triggerToast('error', "Couldn't generate timetable", 'No available slots were found before your deadlines. Try widening your study window.');
  } else if (unscheduledTasks.length > 0) {
    triggerToast('error', 'Some tasks didn\'t fit', `Couldn't fully schedule: ${unscheduledTasks.join(', ')}.`);
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
  setSubject(task.subject || '');
  setActiveModal('EDIT_TASK');
};

// Update task
const handleUpdateTaskSubmit = (e: React.FormEvent) => {
  e.preventDefault();
  if (!selectedTask) return;
  setTodoList(prev => prev.map(t => t.id === selectedTask.id ? {
    ...t, title: taskTitle, remarks, hoursNeeded: timeNeeded === '' ? 1 : Number(timeNeeded), priority, allowSplit, deadline, subject: subject.trim()
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
  setSubject(event.subject || '');
  setActiveModal('EDIT_EVENT');
};

const handleUpdateEventSubmit = (e: React.FormEvent) => {
  e.preventDefault();
  if (!selectedEvent) return;
  setEventsList(prev => prev.map(evt => evt.id === selectedEvent.id ? {
    ...evt, title: taskTitle, remarks, day: selectedDay, startHour: selectedStart, duration: Number(timeNeeded), subject: subject.trim()
  } : evt));
  closeModal();
};

const handleRemoveEvent = (eventId: string) => {
  setEventsList(prev => prev.filter(e => e.id !== eventId));
  closeModal();
};

  if (isLoading) {
    return (
      <div className="timetable-wrapper">
        <p className="timetable-loading">Loading your timetable...</p>
      </div>
    );
  }

  return (
    <div className="timetable-wrapper">
      {saveError && <p className="timetable-save-error">{saveError}</p>}
      
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
                    {task.subject && <span className="subject-badge">{task.subject}</span>}
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
        <div className="timetable-grid-toolbar">
          <div className="timeline-slider-control">
            <button type="button" className="slider-step-btn" onClick={() => setWindowStart(w => Math.max(0, w - 1))} disabled={windowStart === 0}>‹</button>
            <input
              type="range"
              min={0}
              max={maxWindowStart}
              value={windowStart}
              onChange={e => setWindowStart(Number(e.target.value))}
              className="timeline-slider"
            />
            <button type="button" className="slider-step-btn" onClick={() => setWindowStart(w => Math.min(maxWindowStart, w + 1))} disabled={windowStart === maxWindowStart}>›</button>
            <span className="timeline-range-label">{visibleTimeslots[0]} – {visibleTimeslots[visibleTimeslots.length - 1]}</span>
          </div>
          <div className="timetable-clock">{formattedDate} · {formattedTime}</div>
        </div>
        <div className="timetable-grid-position-wrapper" ref={gridPositionRef}>
        <table className="timetable-matrix-table">
          <thead>
          <tr>
            <th className="column-label-all-day">All day</th>
            {visibleTimeslots.map(time => (
              <th
                key={time}
                className="column-time-header"
                ref={el => {
                  if (el) headerCellRefs.current.set(time, el);
                  else headerCellRefs.current.delete(time);
                }}
              >
                {time}
              </th>
            ))}
          </tr>
          </thead>
          <tbody>
            {DAY_LABELS.map(day => (
              <tr
                key={day}
                className="matrix-row-container"
                ref={el => {
                  if (el) dayRowRefs.current.set(day, el);
                  else dayRowRefs.current.delete(day);
                }}
              >
                <td className="matrix-day-label"><strong>{day}</strong></td>
                {visibleTimeslots.map((time) => {
                  const absIndex = timeslots.indexOf(time);
                  const windowEndIdx = windowStart + VISIBLE_SLOTS;
                  const startingEvent = eventsList.find(e => e.day === day && e.startHour === time);
                  const continuingEvent = !startingEvent && absIndex === windowStart
                    ? eventsList.find(e => {
                        if (e.day !== day) return false;
                        const startIdx = timeslots.indexOf(e.startHour);
                        return startIdx < windowStart && startIdx + e.duration > windowStart;
                      })
                    : undefined;
                  const activeEvent = startingEvent || continuingEvent;
                  if (activeEvent) {
                    const startIdx = timeslots.indexOf(activeEvent.startHour);
                    const naturalEndIdx = startIdx + activeEvent.duration;
                    const renderFromIdx = Math.max(startIdx, windowStart);
                    const visibleEndIdx = Math.min(naturalEndIdx, windowEndIdx);
                    const dynamicColSpan = Math.max(1, visibleEndIdx - renderFromIdx);
                    return (
                      <td key={time} colSpan={dynamicColSpan} className="matrix-slotted-block-cell">
                        <div
                          className="slotted-event-card"
                          onClick={() => openEditEventModal(activeEvent)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={e => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              openEditEventModal(activeEvent);
                            }
                          }}
                        >
                          {activeEvent.subject && (
                            <span className="subject-badge subject-badge-event">{activeEvent.subject}</span>
                          )}
                          <p className="event-txt">{activeEvent.title}</p>
                        </div>
                      </td>
                    );
                  }
                  const isCellHidden = eventsList.some(e => {
                    if (e.day !== day) return false;
                    const startIdx = timeslots.indexOf(e.startHour);
                    return absIndex > startIdx && absIndex < startIdx + e.duration;
                  });
                  if (isCellHidden) return null;
                  return <td key={time} className="matrix-unallocated-empty-cell" />;
                })}
              </tr>
            ))}
          </tbody>
        </table>
            {nowLineStyle && (
            <div
              className="current-time-line"
              style={{ left: nowLineStyle.left, top: nowLineStyle.top, height: nowLineStyle.height }}
            />
          )}
        </div>
      </section>

      {activeModal !== 'NONE' && (
        <div className="timetable-modal-dimmer-layer">
          <div className="timetable-modal-window">
            <button className="close-modal-btn" onClick={closeModal}>×</button>

            <datalist id="subject-suggestions">
              {knownSubjects.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
            
            {/* add task button */}
            {activeModal === 'ADDTASK' && (
              <form onSubmit={handleAddTaskSubmit} className="modal-panel">
                <div className="form-fields">
                  <label>Task:</label>
                  <input type="text" value={taskTitle} onChange={e => setTaskTitle(e.target.value)} required placeholder="Revise for History test" />
                </div>
                <div className="form-fields">
                  <label>Subject:</label>
                  <input
                    type="text"
                    list="subject-suggestions"
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                    placeholder="e.g. Biology"
                  />
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
                    {DAY_LABELS.map(d => (
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
                    <select
                      value={breakStart}
                      onChange={e => {
                        const val = e.target.value;
                        setBreakStart(val);
                        if (val === 'NONE') {
                          setBreakEnd('NONE');
                        } else if (breakEnd === 'NONE') {
                          setBreakEnd('');
                        }
                      }}
                      required
                    >
                      <option value="" disabled>Select break start...</option>
                      <option value="NONE">None (no break)</option>
                      {timeslots.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="form-fields flex-fill">
                    <label>Break End:</label>
                    <select
                      value={breakEnd}
                      onChange={e => {
                        const val = e.target.value;
                        setBreakEnd(val);
                        if (val === 'NONE') {
                          setBreakStart('NONE');
                        } else if (breakStart === 'NONE') {
                          setBreakStart('');
                        }
                      }}
                      required
                    >
                      <option value="" disabled>Select break end...</option>
                      <option value="NONE">None (no break)</option>
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
                  <label>Subject:</label>
                  <input
                    type="text"
                    list="subject-suggestions"
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                    placeholder="e.g. Biology"
                  />
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
                      {DAY_LABELS.map(d => <option key={d} value={d}>{d}</option>)}
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
                  <label>Subject:</label>
                  <input
                    type="text"
                    list="subject-suggestions"
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                    placeholder="e.g. Biology"
                  />
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
                  <label>Subject:</label>
                  <input
                    type="text"
                    list="subject-suggestions"
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                    placeholder="e.g. Biology"
                  />
                </div>
                
                <div className="form-fields">
                  <label>Remarks:</label>
                  <input type="text" value={remarks} onChange={e => setRemarks(e.target.value)} />
                </div>
                
                <div className="form-split-row-box">
                  <div className="form-fields flex-fill">
                    <label>Day:</label>
                    <select value={selectedDay} onChange={e => setSelectedDay(e.target.value)} required>
                      {DAY_LABELS.map(d => <option key={d} value={d}>{d}</option>)}
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