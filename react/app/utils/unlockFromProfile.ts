import { checkAndUnlockAchievements } from './achievementCheck';
import type { userData } from '../types/types';

function apiBase(explicit?: string) {
  return explicit || import.meta.env.VITE_API_URL || '';
}

/**
 * Evaluate badge conditions against a profile, toast new unlocks, and persist ids.
 * Safe to call repeatedly — already-owned badges are skipped.
 */
export async function unlockFromProfile(
  uid: string,
  profile: userData,
  options?: { apiBase?: string }
): Promise<number[]> {
  const newlyUnlockedIds = checkAndUnlockAchievements(profile);
  if (newlyUnlockedIds.length === 0) return [];

  try {
    await fetch(`${apiBase(options?.apiBase)}/api/profile/unlock-achievements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid, newAchievementIds: newlyUnlockedIds }),
    });
  } catch (err) {
    console.error('Failed to persist achievement unlocks', err);
  }

  return newlyUnlockedIds;
}
