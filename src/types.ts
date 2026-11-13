export const HabitCategory = {
  MUSCLE_BONE: 'muscle_bone',
  CARDIO: 'cardio',
  MENTAL_HEALTH: 'mental_health',
  SLEEP_CIRCADIAN: 'sleep_circadian',
  NUTRITION: 'nutrition',
} as const;
export type HabitCategory = (typeof HabitCategory)[keyof typeof HabitCategory];

export const GardenElement = {
  STONE: 'stone',
  BIRD: 'bird',
  FLOWER: 'flower',
  SUNBEAM: 'sunbeam',
  TREE: 'tree',
} as const;
export type GardenElement = (typeof GardenElement)[keyof typeof GardenElement];

export const MissionId = {
  ISS: 'iss',
  LUNAR: 'lunar',
  MARS: 'mars',
  DEEP_SPACE: 'deep_space',
} as const;
export type MissionId = (typeof MissionId)[keyof typeof MissionId];

export type PageId = 'tasks' | 'assistant' | 'landscape' | 'watch' | 'history';

export interface HabitTask {
  id: string;
  title: string;
  category: HabitCategory;
  gardenElement: GardenElement;
  equipmentOrProtocol: string;
  scheduledTime: string;
  durationMinutes: number;
  description: string;
  mentalBenefit: string;
  nasaReference: string;
  completedToday: boolean;
  isUrgent?: boolean;
  addedByAssistant?: boolean;
  conditionNote?: string;
}

export interface CompletedLog {
  id: string;
  habitId: string;
  title: string;
  category: HabitCategory;
  gardenElement: GardenElement;
  completedAt: string;
  missionId: MissionId;
  durationMinutes: number;
  moodBefore: number;
  moodAfter: number;
  notes?: string;
}

export interface WatchReading {
  id: string;
  timestamp: string;
  heartRateBpm: number;
  hrvMs: number;
  spo2Percent: number;
  stressIndex: number;
  sleepHours: number;
  deepSleepPercent: number;
  boneLoadKn: number;
  activeMinutes: number;
  source: 'wearable_sync' | 'manual_entry';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  addedHabit?: HabitTask;
  error?: boolean;
}

export interface CrewAccountSummary {
  crewId: string;
  crewName: string;
  roleTitle: string;
  missionId: MissionId;
  missionSol: number;
  avatarUrl?: string;
}

export interface CrewState {
  crewId: string;
  crewName: string;
  roleTitle: string;
  missionId: MissionId;
  missionSol: number;
  lastHabitResetDate?: string;
  avatarUrl?: string;
  habits: HabitTask[];
  history: CompletedLog[];
  watchReadings: WatchReading[];
  chatMessages: ChatMessage[];
}

export interface NasaCountermeasureResource {
  id: string;
  title: string;
  program: string;
  category: HabitCategory;
  gardenElement: GardenElement;
  summary: string;
  dailyTarget: string;
  spaceflightRisk: string;
  url: string;
}
