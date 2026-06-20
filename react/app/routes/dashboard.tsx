import { useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import BadgeIcon from '../components/BadgeIcon';
import './Dashboard.css';

export default function Dashboard() {
  const [userData, setUserData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [firebaseUser, setFirebaseUser] = useState<any>(null);
  
  //auth state
  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setFirebaseUser(user);
      } else {
        setIsLoading(false);
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
        const response = await fetch(`http://localhost:5000/api/profile/${firebaseUser.uid}?${queryParams.toString()}`);
        if (!response.ok) throw new Error('Failed to fetch user data');
        const data = await response.json();
        setUserData(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchUserData();
  }, [firebaseUser]);

  //quest action handle
const handleQuestAction = async (actionType: string) => {
    if (!firebaseUser) return;
    try {
      const response = await fetch('http://localhost:5000/api/profile/quest-action', {
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
      if (data.leveledUp) {
        alert(`LEVEL UP! You are now Level ${data.profile.level}!\n${data.message}`);
      } else {
        alert(data.message);
      }
    } catch (err) {
      console.error("Error processing quest:", err);
    }
  };

  if (isLoading) return <div className="dashboard-container"><h1 className="welcome-message">Loading your study stats...</h1></div>;
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
        <h3 className="section-title">Achievements</h3>
        <BadgeIcon badges={userData.achievements} showViewAll={true}/>
      </div>

      {/* quest list */}
      <div className="quests-section">
        <h3 className="section-title">Quest List</h3>
        <ul className="quest-list">

          {/* login streak quest */}
          <li className="quest-item">
            <span className="quest-bullet">🔥</span>
            <span className="quest-action">Login Streak ({userData.streakDays} Days)</span>
            <span className="quest-reward">Up to 50 XP/Day</span>
          </li>

          {/* quest 1 */}
          <li 
            className="quest-item clickable-quest"
            onClick={() => handleQuestAction('reviewDeck')}
          >
            <span className="quest-bullet">•</span>
            <span className="quest-action">
              Review a Flashcard Deck ({userData.dailyProgress?.decksReviewed || 0}/2)
            </span>
            <span className="quest-reward">+ 60 XP</span>
          </li>

          {/* quest 2 */}
          <li 
            className="quest-item clickable-quest"
            onClick={() => handleQuestAction('chatMessage')}
          >
            <span className="quest-bullet">•</span>
            <span className="quest-action">
              Chat with Capingo ({userData.dailyProgress?.chatMessages || 0}/5)
            </span>
            <span className="quest-reward">+ 50 XP</span>
          </li>

          {/* quest 3 */}
          <li 
            className="quest-item clickable-quest"
            onClick={() => handleQuestAction('createDeck')}
          >
            <span className="quest-bullet">•</span>
            <span className="quest-action">
              Create a new Flashcard Deck ({userData.dailyProgress?.decksCreated || 0}/1)
            </span>
            <span className="quest-reward">+ 30 XP</span>
          </li>
        </ul>
      </div>

    </div>
  );
}