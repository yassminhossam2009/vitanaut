export enum HabitCategory {
  MUSCLE_BONE = 'muscle_bone',
  CARDIO = 'cardio',
  MENTAL_HEALTH = 'mental_health',
  SLEEP_CIRCADIAN = 'sleep_circadian',
  NUTRITION = 'nutrition',
}

export enum GardenElement {
  STONE = 'stone',
  BIRD = 'bird',
  FLOWER = 'flower',
  SUNBEAM = 'sunbeam',
  TREE = 'tree',
}

export enum MissionId {
  ISS = 'iss',
  LUNAR = 'lunar',
  MARS = 'mars',
  DEEP_SPACE = 'deep_space',
}

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


export interface ParameterBands {
  greenMin: number;
  greenMax: number;
  yellowMin: number;
  yellowMax: number;
  redBelow: number;
  redAbove: number;
}

export type ParameterStatus = 'monitored' | 'standard' | 'trend' | 'report';

export interface GuidelineParameter {
  parameterId: string;
  domain: string;
  domainLabel: string;
  name: string;
  whatToTrack: string;
  targetText: string;
  thresholdBasis: string;
  monitoringSource: string;
  cadence: string;
  relatedRisks: string;
  countermeasures: string;
  consequence: string;
  operationalImpact: string;
  notes: string;
  dateRetrieved: string;
  status: ParameterStatus;
  metricKey: string | null;
  aggregation: string | null;
  bandLabel: string | null;
  unit: string | null;
  bands: ParameterBands | null;
}

export interface HealthAlert {
  parameterId: string;
  name: string;
  domain: string;
  domainLabel: string;
  severity: 'red' | 'yellow';
  value: number;
  unit: string | null;
  greenMin: number;
  greenMax: number;
  bandLabel: string | null;
  targetText: string;
  consequence: string;
  operationalImpact: string;
  countermeasures: string;
  relatedRisks: string;
  monitoringSource: string;
  cadence: string;
  aggregation: string;
  sampleSize: number;
}

export interface WarningReport {
  generatedAt: string;
  checked: Array<{ parameterId: string; name: string; value: number; unit: string | null }>;
  alerts: HealthAlert[];
}
