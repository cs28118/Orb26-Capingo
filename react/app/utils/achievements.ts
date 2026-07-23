import type { userData } from '../types/types';

export interface AchievementDef {
  id: number;
  title: string;
  message: string;
  icon: string;
  lockedIcon: string;
  condition: (user: userData) => boolean; 
}

export const allAchievements: AchievementDef[] = [
  { id: 1,
    title: 'Welcome!',
    message: 'You visited Capingo!',
    icon: '/assets/achievements/welcome-badge.png',
    lockedIcon: '/assets/achievements/locked-welcome.png',
    condition: () => true
  },
  { id: 2,
    title: '3 Days Streak',
    message: 'You logged in 3 days in a row!',
    icon: '/assets/achievements/streak-3.png',
    lockedIcon: '/assets/achievements/streak-3-locked.png',
    condition: (user) => user.streakDays >= 3
  },
  { id: 3,
    title: 'Hello Capy!',
    message: 'You chatted with the chatbot for the first time!',
    icon: '/assets/achievements/chatbot.png',
    lockedIcon: '/assets/achievements/chatbot-locked.png',
    condition: (user) => !!user.helloCapy
  },
  { id: 4,
    title: 'Master Scheduler',
    message: 'You explored the timetable feature!',
    icon: '/assets/achievements/schedule.png',
    lockedIcon: '/assets/achievements/schedule-locked.png',
    condition: (user) => !!user.masterScheduler
  },
  { id: 5,
    title: 'Deck Builder',
    message: 'You explored the flashcard feature!',
    icon: '/assets/achievements/flashcard.png',
    lockedIcon: '/assets/achievements/flashcard-locked.png',
    condition: (user) => !!user.deckBuilder
  },
  { id: 6,
    title: 'Instantiated Identity',
    message: 'You updated your profile card!',
    icon: '/assets/achievements/diy.png',
    lockedIcon: '/assets/achievements/diy-locked.png',
    condition: (user) => !!user.instantiatedIndentity
  },
  { id: 7,
    title: '5 Days Streak',
    message: 'You logged in 5 days in a row!',
    icon: '/assets/achievements/streak-5.png',
    lockedIcon: '/assets/achievements/streak-5-locked.png',
    condition: (user) => user.streakDays >= 5
  },
  { id: 8,
    title: '10 Days Streak',
    message: 'You logged in 10 days in a row!',
    icon: '/assets/achievements/streak-10.png',
    lockedIcon: '/assets/achievements/streak-10-locked.png',
    condition: (user) => user.streakDays >= 10
  },
  { id: 9,
    title: 'Auto Allocating...',
    message: 'To be determined',
    icon: '/assets/achievements/auto.png',
    lockedIcon: '/assets/achievements/auto-locked.png',
    condition: (user) => !!user.autoAllocating
  },
  { id: 10,
    title: 'Climbing up...',
    message: 'You reached level 5!',
    icon: '/assets/achievements/level-5.png',
    lockedIcon: '/assets/achievements/level-5-locked.png',
    condition: (user) => user.level >= 5
  },
  { id: 11,
    title: 'Reached the peak!',
    message: 'You reached level 10!',
    icon: '/assets/achievements/level-10.png',
    lockedIcon: '/assets/achievements/level-10-locked.png',
    condition: (user) => user.level >= 10
  },
  { id: 12,
    title: 'Killer Quest I',
    message: 'Incredible! You completed all quest 3 days in a row!',
    icon: '/assets/achievements/quest-1.png',
    lockedIcon: '/assets/achievements/quest-1-locked.png',
    condition: (user) => (user.questsCompleteStreak || 0) >= 3
  },
  { id: 13,
    title: 'Killer Quest II',
    message: 'You completed 10 quests in total!',
    icon: '/assets/achievements/quest-2.png',
    lockedIcon: '/assets/achievements/quest-2-locked.png',
    condition: (user) => (user.questsCompleted || 0) >= 10
  },
  { id: 14,
    title: 'Connected component',
    message: 'You added your first study partner!',
    icon: '/assets/achievements/connected.png',
    lockedIcon: '/assets/achievements/connected-locked.png',
    condition: (user) => !!user.connectedComponent
  },
  { id: 15,
    title: 'Data miner',
    message: 'You created 5 flashcard decks!',
    icon: '/assets/achievements/miner.png',
    lockedIcon: '/assets/achievements/miner-locked.png',
    condition: (user) => (user.decksCreated || 0) > 5
  },
  { id: 16,
    title: 'Placeholder',
    message: 'To be determined',
    icon: '/assets/achievements/unlocked-placeholder.png',
    lockedIcon: '/assets/achievements/locked-placeholder.png',
    condition: () => false
  },
  { id: 17,
    title: 'Placeholder',
    message: 'To be determined',
    icon: '/assets/achievements/unlocked-placeholder.png',
    lockedIcon: '/assets/achievements/locked-placeholder.png',
    condition: () => false
  },
  { id: 18,
    title: 'Placeholder',
    message: 'To be determined',
    icon: '/assets/achievements/unlocked-placeholder.png',
    lockedIcon: '/assets/achievements/locked-placeholder.png',
    condition: () => false
  }
];