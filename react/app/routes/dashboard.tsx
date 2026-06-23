import { useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { Link } from 'react-router';
import { allAchievements } from '../utils/achievements';
import BadgeIcon from '../components/BadgeIcon';
import './dashboard.css';
import { triggerToast } from '../components/Noti';
import type { userData } from '../types/types';
import type { User } from 'firebase/auth';
import type { achievement } from '../types/types';

const presetProfilePic = [
  '/assets/profile-placeholder.png',
  '/assets/profile1.png',
  '/assets/profile2.png',
  '/assets/profile3.png'
];

export default function Dashboard() {
  const [userData, setUserData] = useState<userData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editUsername, setEditUsername] = useState('');
  const [selectedProfilePic, setSelectedProfilePic] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  
  //auth state
  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
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

  //quest action handle
const handleQuestAction = async (actionType: string) => {
    if (!firebaseUser) return;
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/profile/quest-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: firebaseUser.uid,
          actionType: actionType
        })
      });
      if (!response.ok) throw new Error('Failed to record quest action');
      const data = await response.json();
      setUserData(data.profile);
      if (data.message && data.message.includes('XP')) {
        triggerToast('quest', 'QUEST', data.message);
      } 
      else if (data.message && data.message.includes('cap')) {
        triggerToast('quest', 'QUEST', 'Login streak already claimed today!');
      }
      if (data.leveledUp) {
        triggerToast('levelup', 'LEVEL UP!', `Level ${data.profile.level} Reached!`);
      }
    } catch (err) {
      console.error("Error processing quest:", err);
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
              <button className="save-btn" style={{ padding: '4px 12px', fontSize: '0.8rem' }} onClick={() => handleQuestAction('loginStreak')}>
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