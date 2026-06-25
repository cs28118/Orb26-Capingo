import { allAchievements } from './achievements';
import { triggerToast } from '../components/NotiHelper';
import type { userData } from '../types/types';

export const checkAndUnlockAchievements = (updatedUser: userData) => {
  const newlyUnlockedIds: number[] = [];
  const ownedIds = updatedUser.achievements?.map(a => a.id) || [];
  allAchievements.forEach((badge) => {
    if (ownedIds.includes(badge.id)) return;
    if (badge.condition(updatedUser)) {
      triggerToast('achievement', 'Achievement Unlocked!', badge.title, badge.icon);
      newlyUnlockedIds.push(badge.id);
    }
  });
  return newlyUnlockedIds; 
};