import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { allAchievements } from '../utils/achievements';
import BadgeIcon from '../components/BadgeIcon';
import './dashboard.css';
import { triggerToast } from '../components/NotiHelper';
import type { userData } from '../types/types';
import { subscribeToAuth, type AuthUser } from '../firebaseAuth/authSubscribe';
import type { achievement } from '../types/types';
import { unlockFromProfile } from '../utils/unlockFromProfile';
import {
  formatRelativeTime,
  pickRecentChats,
  pickRecentRooms,
  pickUpcomingTodos,
  summarizeDueDecks,
  type DueDeckSummary,
  type WidgetChat,
  type WidgetRoom,
  type WidgetTodo,
} from '../utils/dashboardWidgets';

const presetProfilePic = [
  '/assets/profile-placeholder.png',
  '/assets/profile1.png',
  '/assets/profile2.png',
  '/assets/profile3.png'
];

const apiBase = () => import.meta.env.VITE_API_URL || '';

type WidgetLoadState<T> = {
  loading: boolean;
  error: string;
  data: T;
};

export default function Dashboard() {
  const [userData, setUserData] = useState<userData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [firebaseUser, setFirebaseUser] = useState<AuthUser | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editUsername, setEditUsername] = useState('');
  const [selectedProfilePic, setSelectedProfilePic] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const [upcomingTasks, setUpcomingTasks] = useState<WidgetLoadState<WidgetTodo[]>>({
    loading: true,
    error: '',
    data: [],
  });
  const [dueFlashcards, setDueFlashcards] = useState<
    WidgetLoadState<{ totalDue: number; decks: DueDeckSummary[] }>
  >({
    loading: true,
    error: '',
    data: { totalDue: 0, decks: [] },
  });
  const [recentChats, setRecentChats] = useState<WidgetLoadState<WidgetChat[]>>({
    loading: true,
    error: '',
    data: [],
  });
  const [recentRooms, setRecentRooms] = useState<WidgetLoadState<WidgetRoom[]>>({
    loading: true,
    error: '',
    data: [],
  });
  
  //auth state
  useEffect(() => {
    const unsubscribe = subscribeToAuth((user) => {
      if (user) {
        setFirebaseUser(user);
      } else {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  //fetch user data
  useEffect(() => {
    if (!firebaseUser) return;
    const fetchUserData = async () => {
      try {
        const queryParams = new URLSearchParams({
          username: firebaseUser.displayName || 'Student',
          email: firebaseUser.email || '',
          photoURL: firebaseUser.photoURL || ''
        });
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/profile/${firebaseUser.uid}?${queryParams.toString()}`);
        if (!response.ok) throw new Error('Failed to fetch user data');
        const data = await response.json();
        setUserData(data);

        //check achievements when login (*special case for study partner achievement)
        const newlyUnlockedIds = await unlockFromProfile(firebaseUser.uid, data);
        if (newlyUnlockedIds.length > 0) {
          setUserData({
            ...data,
            achievements: [
              ...(data.achievements || []),
              ...newlyUnlockedIds.map((id: number) => ({ id }))
            ]
          });
        }

      } catch (err : unknown) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('An unknown error occurred when fetching data');
        }
      } finally {
        setLoading(false);
      }
    };
    fetchUserData();
  }, [firebaseUser]);

  // Dashboard widgets — soft-fail independently of profile
  useEffect(() => {
    if (!firebaseUser) return;
    const uid = firebaseUser.uid;
    const base = apiBase();
    let cancelled = false;

    const loadWidgets = async () => {
      const [timetableRes, decksRes, chatsRes, roomsRes] = await Promise.allSettled([
        fetch(`${base}/api/timetable/${uid}`),
        fetch(`${base}/api/decks/${uid}`),
        fetch(`${base}/api/chats/${uid}`),
        fetch(`${base}/api/rooms/${uid}`),
      ]);

      if (cancelled) return;

      if (timetableRes.status === 'fulfilled' && timetableRes.value.ok) {
        try {
          const json = await timetableRes.value.json();
          setUpcomingTasks({
            loading: false,
            error: '',
            data: pickUpcomingTodos(json.todos || [], 5),
          });
        } catch {
          setUpcomingTasks({ loading: false, error: 'Could not load tasks', data: [] });
        }
      } else {
        setUpcomingTasks({ loading: false, error: 'Could not load tasks', data: [] });
      }

      if (decksRes.status === 'fulfilled' && decksRes.value.ok) {
        try {
          const json = await decksRes.value.json();
          setDueFlashcards({
            loading: false,
            error: '',
            data: summarizeDueDecks(json.decks || [], 2),
          });
        } catch {
          setDueFlashcards({
            loading: false,
            error: 'Could not load decks',
            data: { totalDue: 0, decks: [] },
          });
        }
      } else {
        setDueFlashcards({
          loading: false,
          error: 'Could not load decks',
          data: { totalDue: 0, decks: [] },
        });
      }

      if (chatsRes.status === 'fulfilled' && chatsRes.value.ok) {
        try {
          const json = await chatsRes.value.json();
          setRecentChats({
            loading: false,
            error: '',
            data: pickRecentChats(json.chats || [], 3),
          });
        } catch {
          setRecentChats({ loading: false, error: 'Could not load chats', data: [] });
        }
      } else {
        setRecentChats({ loading: false, error: 'Could not load chats', data: [] });
      }

      if (roomsRes.status === 'fulfilled' && roomsRes.value.ok) {
        try {
          const json = await roomsRes.value.json();
          setRecentRooms({
            loading: false,
            error: '',
            data: pickRecentRooms(json.rooms || [], 2),
          });
        } catch {
          setRecentRooms({ loading: false, error: 'Could not load rooms', data: [] });
        }
      } else {
        setRecentRooms({ loading: false, error: 'Could not load rooms', data: [] });
      }
    };

    void loadWidgets();
    return () => {
      cancelled = true;
    };
  }, [firebaseUser]);

  //login streak and button handle
  const handleLoginStreak = async () => {
    if (!firebaseUser) return;
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/profile/claim-streak`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: firebaseUser.uid })
      });
      if (!response.ok) throw new Error('Failed to claim streak');
      const data = await response.json();
      const newlyUnlockedIds = await unlockFromProfile(firebaseUser.uid, data.profile);

      if (newlyUnlockedIds.length > 0) {
        data.profile.achievements = [
          ...(data.profile.achievements || []),
          ...newlyUnlockedIds.map((id: number) => ({ id }))
        ];
      }

      //xp manage
      setUserData(data.profile);
      if (data.message) {
        triggerToast('login', 'DAILY STREAK', data.message);
      }
      if (data.leveledUp) {
        triggerToast('levelup', 'LEVEL UP!', `Level ${data.profile.level} Reached!`);
      }
    } catch (err) {
      console.error("Error claiming login streak:", err);
    }
  };

  const handleSaveProfile = async () => {
    if (!firebaseUser || !userData) return;
    setIsUploading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/profile/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: firebaseUser.uid,
          newUsername: editUsername || userData.username,
          newProfilePic: selectedProfilePic || userData.profilePic
        })
      });
      if (!response.ok) throw new Error('Failed to update profile');
      const data = await response.json();
      setUserData(data.profile);
      setIsEditing(false);
      const newlyUnlockedIds = await unlockFromProfile(firebaseUser.uid, data.profile);
      if (newlyUnlockedIds.length > 0) {
        data.profile.achievements = [
          ...(data.profile.achievements || []),
          ...newlyUnlockedIds.map((id: number) => ({ id }))
        ];
        setUserData(data.profile);
      }
    } catch (err) {
      console.error("Error saving profile:", err);
      alert("Failed to update profile. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  if (loading) return <div className="dashboard-container"><h1 className="welcome-message">Loading your study stats...</h1></div>;
  if (error) return <div className="dashboard-container"><h1 className="welcome-message">Error: {error}</h1></div>;
  if (!userData) return null;

  const progressPercentage = Math.min(100, Math.max(0, (userData.currentXp / userData.xpToNextLevel) * 100));

  return (
    <div className="dashboard-container">
      <h1 className="welcome-message">Welcome back, {userData.username}!</h1>

      {/* profile card */}
      <div className="profile-card">
        <div className="profile-picture-container">
          <img src={userData.profilePic} alt={`${userData.username}'s profile`} className="profile-image"/>
        </div>
        
        <div className="profile-info-container">
          <div className="profile-header">
            <span className="level-badge">Lvl {userData.level}</span>
            <h2 className="username">{userData.username}</h2>
            <button className="edit-profile-btn" onClick={() => {
                  setEditUsername(userData.username);
                  setSelectedProfilePic(userData.profilePic);
                  setIsEditing(true);
                }}>
                ✏️
              </button>
          </div>
          
          <div className="progress-bar-container">
            <div 
              className="progress-bar-fill" 
              style={{ width: `${progressPercentage}%` }}
            ></div>
            <span className="progress-text">
              Level {userData.level} ({userData.currentXp}/{userData.xpToNextLevel} XP)
            </span>
          </div>

          {userData.partnerCode && (
            <div className="dashboard-partner-row">
              <span className="dashboard-partner-code">Partner code: <strong>{userData.partnerCode}</strong></span>
              <button
                type="button"
                className="dashboard-partner-copy"
                onClick={() => navigator.clipboard.writeText(userData.partnerCode)}
              >
                Copy
              </button>
              <Link to="/home/collaboration" className="dashboard-partner-link">Find study partners →</Link>
            </div>
          )}
        </div>
      </div>

      {/* achievements */}
      <div className="achievements-section">
        <div className="badges-row"> 
          {[1, 2, 3, 4, 5].map((slotId) => {
            const badgeInfo = allAchievements.find(a => a.id === slotId);
            const isUnlocked = userData.achievements?.some((a: achievement) => a.id === slotId);
            return (
              <BadgeIcon key={slotId} icon={badgeInfo?.icon} lockedIcon={badgeInfo?.lockedIcon} title={badgeInfo?.title} isUnlocked={isUnlocked}/>
            );
          })}
        </div>
        <Link to="/home/achievements" className="view-all-link">
          View all badges &rarr;
        </Link>
      </div>

      {/* quest list */}
      <div className="quests-section">
        <h3 className="section-title">Quest List</h3>
          <ul className="quest-list">

          {/* login streak xp claim */}
          <li className="quest-item">
            <span className="quest-bullet">🔥</span>
            <span className="quest-action">Login Streak ({userData.streakDays || 1} Days)</span>
            {userData.dailyProgress?.streakClaimed >= 1 ? (
              <span className="quest-reward" style={{ background: '#d1fae5', color: '#065f46' }}>
                ✓ Claimed
              </span>
            ) : (
              <button className="save-btn" style={{ padding: '4px 12px', fontSize: '0.8rem' }} onClick={handleLoginStreak}>
                Claim {Math.min((userData.streakDays || 1) * 20, 100)} XP
              </button>
            )}
          </li>

          {/* quest 1 */}
          <li className="quest-item">
            <span className="quest-bullet">•</span>
            <span className="quest-action">
              Review a Flashcard Deck ({userData.dailyProgress?.decksReviewed || 0}/2)
            </span>
            <span className="quest-reward">60 XP</span>
          </li>

          {/* quest 2 */}
          <li className="quest-item">
            <span className="quest-bullet">•</span>
            <span className="quest-action">
              Chat with Capingo ({userData.dailyProgress?.chatMessages || 0}/5)
            </span>
            <span className="quest-reward">50 XP</span>
          </li>

          {/* quest 3 */}
          <li className="quest-item">
            <span className="quest-bullet">•</span>
            <span className="quest-action">
              Create a new Flashcard Deck ({userData.dailyProgress?.decksCreated || 0}/1)
            </span>
            <span className="quest-reward">30 XP</span>
          </li>
        </ul>
      </div>

      {/* study snapshot widgets */}
      <section className="dashboard-widgets" aria-label="Study snapshot">
        <h3 className="section-title">Study snapshot</h3>
        <div className="dashboard-widgets-grid">
          <article className="dashboard-widget">
            <div className="dashboard-widget-header">
              <h4>Upcoming tasks</h4>
              <Link to="/home/timetable" className="dashboard-widget-cta">
                Open Timetable →
              </Link>
            </div>
            {upcomingTasks.loading ? (
              <p className="dashboard-widget-empty">Loading tasks…</p>
            ) : upcomingTasks.error ? (
              <p className="dashboard-widget-empty">{upcomingTasks.error}</p>
            ) : upcomingTasks.data.length === 0 ? (
              <p className="dashboard-widget-empty">No tasks yet — add one on Timetable.</p>
            ) : (
              <ul className="dashboard-widget-list">
                {upcomingTasks.data.map((task) => (
                  <li key={task.id} className="dashboard-widget-item">
                    <span className="dashboard-widget-item-title">{task.title}</span>
                    <span className="dashboard-widget-item-meta">
                      {task.subject ? <span className="dashboard-widget-chip">{task.subject}</span> : null}
                      {task.priority ? <span>{task.priority}</span> : null}
                      {typeof task.hoursNeeded === 'number' ? <span>{task.hoursNeeded}h</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </article>

          <article className="dashboard-widget">
            <div className="dashboard-widget-header">
              <h4>Cards due</h4>
              <Link to="/home/flashcard" className="dashboard-widget-cta">
                Study due →
              </Link>
            </div>
            {dueFlashcards.loading ? (
              <p className="dashboard-widget-empty">Loading decks…</p>
            ) : dueFlashcards.error ? (
              <p className="dashboard-widget-empty">{dueFlashcards.error}</p>
            ) : dueFlashcards.data.totalDue === 0 ? (
              <p className="dashboard-widget-empty">You&apos;re caught up on flashcards.</p>
            ) : (
              <>
                <p className="dashboard-widget-highlight">
                  {dueFlashcards.data.totalDue} card{dueFlashcards.data.totalDue === 1 ? '' : 's'} due
                </p>
                <ul className="dashboard-widget-list">
                  {dueFlashcards.data.decks.map((deck) => (
                    <li key={deck.id} className="dashboard-widget-item">
                      <span className="dashboard-widget-item-title">{deck.title}</span>
                      <span className="dashboard-widget-item-meta">{deck.due} due</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </article>

          <article className="dashboard-widget">
            <div className="dashboard-widget-header">
              <h4>Recent chats</h4>
              <Link to="/home/chatbot" className="dashboard-widget-cta">
                Capingo AI →
              </Link>
            </div>
            {recentChats.loading ? (
              <p className="dashboard-widget-empty">Loading chats…</p>
            ) : recentChats.error ? (
              <p className="dashboard-widget-empty">{recentChats.error}</p>
            ) : recentChats.data.length === 0 ? (
              <p className="dashboard-widget-empty">No chats yet — ask Capingo anything.</p>
            ) : (
              <ul className="dashboard-widget-list">
                {recentChats.data.map((chat) => (
                  <li key={chat.id} className="dashboard-widget-item">
                    <Link to="/home/chatbot" className="dashboard-widget-item-link">
                      <span className="dashboard-widget-item-title">
                        {chat.pinned ? '📌 ' : ''}
                        {chat.title || 'Untitled chat'}
                      </span>
                      <span className="dashboard-widget-item-meta">
                        {chat.updatedAt ? formatRelativeTime(chat.updatedAt) : ''}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </article>

          <article className="dashboard-widget">
            <div className="dashboard-widget-header">
              <h4>Study rooms</h4>
              <Link to="/home/space" className="dashboard-widget-cta">
                Open Study Rooms →
              </Link>
            </div>
            {recentRooms.loading ? (
              <p className="dashboard-widget-empty">Loading rooms…</p>
            ) : recentRooms.error ? (
              <p className="dashboard-widget-empty">{recentRooms.error}</p>
            ) : recentRooms.data.length === 0 ? (
              <p className="dashboard-widget-empty">No rooms yet — create or join one.</p>
            ) : (
              <ul className="dashboard-widget-list">
                {recentRooms.data.map((room) => (
                  <li key={room.roomId} className="dashboard-widget-item">
                    <span className="dashboard-widget-item-title">{room.name}</span>
                    <span className="dashboard-widget-item-meta">
                      {room.type === 'direct' ? 'DM' : 'Group'}
                      {room.lastMessage?.text
                        ? ` · ${String(room.lastMessage.text).slice(0, 40)}`
                        : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </article>
        </div>
      </section>

      {/* edit form */}
      {isEditing && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Edit Profile</h3>
            <div className="form-group">
              <label>Username</label>
              <input type="text" value={editUsername} onChange={(e) => setEditUsername(e.target.value)} maxLength={20}/>
            </div>
            <div className="form-group">
              <label>Choose Profile Picture</label>
              {/* google profile picture */}
              {firebaseUser?.photoURL && (
                <button className={`google-photo-btn ${selectedProfilePic === firebaseUser.photoURL ? 'selected' : ''}`} onClick={() => setSelectedProfilePic(firebaseUser.photoURL || '')}>
                  <img src={firebaseUser.photoURL} alt="Google Auth" className="pfp-thumbnail" />
                  Use My Google Photo
                </button>
              )}

              {/* preset profile pictures */}
              <div className="pfp-grid">
                {presetProfilePic.map((pfpUrl, index) => (
                  <img key={index} src={pfpUrl} alt={`Profile picture option ${index + 1}`} 
                       className={`pfp-thumbnail ${selectedProfilePic === pfpUrl ? 'selected' : ''}`} onClick={() => setSelectedProfilePic(pfpUrl)}/>
                ))}
              </div>
            </div>

            <div className="modal-actions">
              {isUploading && <span className="upload-status">Saving...</span>}
              <button className="cancel-btn" onClick={() => setIsEditing(false)} disabled={isUploading}>
                Cancel
              </button>
              <button className="save-btn" onClick={handleSaveProfile} disabled={isUploading}>
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}