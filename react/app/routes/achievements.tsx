import { useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { allAchievements } from '../utils/achievements';
import BadgeIcon from '../components/BadgeIcon';
import './achievements.css';
import type { achievement } from '../types/types';

export default function Achievements() {
  const [unlockedIds, setUnlockedIds] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const response = await fetch(`${import.meta.env.VITE_API_URL}/api/profile/${user.uid}`);
          if (response.ok) {
            const data = await response.json();
            const ids = data.achievements?.map((a: achievement) => a.id) || [];
            setUnlockedIds(ids);
          }
        } catch (err) {
          console.error("Failed to load achievements", err);
        }
      }
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (isLoading) {
    return (
      <div className="achievements-page-container">
        <h1 className="section-title">Loading badges...</h1>
      </div>
    );
  }

  const totalGridSlots = Array.from({ length: 18 }, (_, i) => i + 1);

  return (
    <div className="achievements-page-container">
      <h3 className="section-title">All Achievements</h3>
      
      <div className="full-achievements-panel">
        <div className="full-badges-grid">
          {totalGridSlots.map((slotId) => {
            const badgeInfo = allAchievements.find(a => a.id === slotId);
            const isUnlocked = unlockedIds.includes(slotId);
            
            return (
              <BadgeIcon key={slotId} icon={badgeInfo?.icon} lockedIcon={badgeInfo?.lockedIcon} title={badgeInfo?.title} isUnlocked={isUnlocked}/>
            );
          })}
        </div>
      </div>
    </div>
  );
}