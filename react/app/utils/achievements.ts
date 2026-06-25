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
    icon: '/assets/welcome-badge.png',
    lockedIcon: '/assets/locked-welcome.png',
    condition: () => true
  },
  { id: 2,
    title: '3 Days Streak',
    message: 'You logged in 3 days in a row!',
    icon: '/assets/streak-badge.png',
    lockedIcon: '/assets/locked-streak.png',
    condition: (user) => user.streakDays >= 3
  },
  { id: 3,
    title: 'Capy Chatter',
    message: 'You chatted with the chatbot for the first time!',
    icon: '/assets/chatbot-badge.png',
    lockedIcon: '/assets/locked-chatbot.png',
    condition: () => false
  },
  { id: 4,
    title: 'Master Scheduler',
    message: 'You explored the timetable feature!',
    icon: '/assets/schedule-badge.png',
    lockedIcon: '/assets/locked-schedule.png',
    condition: () => false
  },
  { id: 5,
    title: 'Flashcard master',
    message: 'You explored the flashcard feature!',
    icon: '/assets/flashcard-badge.png',
    lockedIcon: '/assets/locked-flashcard.png',
    condition: () => false
  },
  { id: 6,
    title: 'DIY master',
    message: 'You updated your profile card!',
    icon: '/assets/diy-badge.png',
    lockedIcon: '/assets/locked-diy.png',
    condition: () => false
  },
  { id: 7,
    title: '5 Days Streak',
    message: 'You logged in 5 days in a row!',
    icon: '/assets/streak-badge.png',
    lockedIcon: '/assets/locked-streak.png',
    condition: (user) => user.streakDays >= 5
  },
  { id: 8,
    title: '10 Days Streak',
    message: 'You logged in 10 days in a row!',
    icon: '/assets/streak-badge.png',
    lockedIcon: '/assets/locked-streak.png',
    condition: (user) => user.streakDays >= 10
  }
];