export interface achievement {
  id: number;
  title: string;
  icon: string;
  _id?: string; 
}

export interface quest {
  id: number;
  action: string;
  reward: number;
  _id?: string;
}

export interface dailyProgress {
  streakClaimed: number;
  decksReviewed: number;
  chatMessages: number;
  decksCreated: number;
}

export interface userData {
  _id: string;
  firebaseUid: string;      
  email?: string;
  username: string;
  level: number;
  currentXp: number;
  xpToNextLevel: number;
  profilePic: string;
  lastLoginDate: string;
  streakDays: number;
  dailyProgress: dailyProgress;
  achievements: achievement[];
  quests: quest[];
  subjects: string[];
  manualSubjects: string[];
  partnerCode: string;
  openToPartners?: boolean;
  helloCapy?: boolean;
  deckBuilder?: boolean;
  masterScheduler?: boolean;
  autoAllocating?: boolean;
  instantiatedIndentity?: boolean;
}