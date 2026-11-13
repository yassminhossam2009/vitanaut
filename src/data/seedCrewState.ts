import {
  GardenElement,
  HabitCategory,
  MissionId,
  type CrewState,
  type HabitTask,
} from '../types.ts';
import { getSystemDateKey } from '../utils/dailyReset.ts';

export function categoryToGardenElement(category: HabitCategory): GardenElement {
  switch (category) {
    case HabitCategory.MUSCLE_BONE:
      return GardenElement.STONE;
    case HabitCategory.CARDIO:
      return GardenElement.FLOWER;
    case HabitCategory.MENTAL_HEALTH:
      return GardenElement.BIRD;
    case HabitCategory.SLEEP_CIRCADIAN:
      return GardenElement.SUNBEAM;
    case HabitCategory.NUTRITION:
      return GardenElement.TREE;
  }
}

export function createSeedCrewState(
  crewId: string,
  crewName: string,
  missionId: MissionId = MissionId.ISS,
  avatarUrl?: string,
  initialDateKey?: string
): CrewState {
  const now = new Date();
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600 * 1000).toISOString();

  const habits: HabitTask[] = [
    {
      id: 'hab-ared-1',
      title: 'ARED Axial Squats & Heel Raises',
      category: HabitCategory.MUSCLE_BONE,
      gardenElement: GardenElement.STONE,
      equipmentOrProtocol: 'ARED (Advanced Resistive Exercise Device)',
      scheduledTime: '08:30 UTC',
      durationMinutes: 45,
      description:
        'Complete 4 sets of 8–10 reps on ARED squats (75% body-weight equivalent) followed by 3 sets of single-leg heel raises to load femoral neck and lumbar vertebrae.',
      mentalBenefit:
        'Releases endorphins and counteracts microgravity proprioceptive fatigue, restoring grounded physical confidence.',
      nasaReference: 'NASA HRP Bone Mineral Density Protocol (ARED-04)',
      completedToday: false,
      isUrgent: true,
    },
    {
      id: 'hab-mental-1',
      title: 'Cupola Earth-Gazing & Acoustic Decompression',
      category: HabitCategory.MENTAL_HEALTH,
      gardenElement: GardenElement.BIRD,
      equipmentOrProtocol: 'NASA BHP Mindfulness & Nature Audio',
      scheduledTime: '12:15 UTC',
      durationMinutes: 15,
      description:
        'Step away from station telemetry. Practice 4-7-8 nasal breathing while listening to Earth songbird acoustics and logging one gratitude observation.',
      mentalBenefit:
        'Lowers salivary cortisol, reduces confinement monotony, and strengthens emotional regulation.',
      nasaReference: 'NASA Behavioral Health & Performance (BHP) Resilience Guide',
      completedToday: false,
      isUrgent: false,
    },
    {
      id: 'hab-cardio-1',
      title: 'T2 Treadmill Interval Harness Run',
      category: HabitCategory.CARDIO,
      gardenElement: GardenElement.FLOWER,
      equipmentOrProtocol: 'T2 Treadmill with Bungee Harness',
      scheduledTime: '14:00 UTC',
      durationMinutes: 30,
      description:
        'Run 5 alternating 3-minute aerobic intervals at 75–82% max heart rate with harness load calibrated to 70% Earth body weight.',
      mentalBenefit:
        'Boosts cerebral blood flow and stabilizes mood neurotransmitters during mid-shift slump.',
      nasaReference: 'NASA Exercise Countermeasures Lab · VO2max Retention',
      completedToday: true,
    },
    {
      id: 'hab-nutrition-1',
      title: 'Vitamin D3, Calcium & Electrolyte Hydration',
      category: HabitCategory.NUTRITION,
      gardenElement: GardenElement.TREE,
      equipmentOrProtocol: 'ISS Potable Water & Micronutrient Pack',
      scheduledTime: '15:30 UTC',
      durationMinutes: 10,
      description:
        'Consume 600 mL potassium-citrate enriched water with 800 IU Vitamin D3 and omega-3 salmon ration to protect bone remodeling and ocular health.',
      mentalBenefit:
        'Prevents dehydration headaches and supports omega-3 neuro-inflammatory resilience.',
      nasaReference: 'NASA Nutritional Biochemistry Lab · Bone & Fluid Protocol',
      completedToday: true,
    },
    {
      id: 'hab-sleep-1',
      title: 'Circadian Amber Light & Blue-Screen Wind-Down',
      category: HabitCategory.SLEEP_CIRCADIAN,
      gardenElement: GardenElement.SUNBEAM,
      equipmentOrProtocol: 'SSLA Warm Amber Mode (2700K) + Sleep Mask',
      scheduledTime: '21:00 UTC',
      durationMinutes: 30,
      description:
        'Switch cabin solid-state lighting to warm amber spectrum, mute mission notifications, and perform a 5-minute mental unload before your 8.5h sleep window.',
      mentalBenefit:
        'Protects melatonin onset against 16 orbital sunrises/day and prevents emotional irritability.',
      nasaReference: 'NASA Circadian Entrainment & Fatigue Management',
      completedToday: false,
    },
    {
      id: 'hab-mental-2',
      title: 'Private Family Video Relay & Crew Check-In',
      category: HabitCategory.MENTAL_HEALTH,
      gardenElement: GardenElement.BIRD,
      equipmentOrProtocol: 'Ku-Band Private Crew Audio/Video Link',
      scheduledTime: '18:45 UTC',
      durationMinutes: 20,
      description:
        'Record or hold a synchronous family connection call and share one honest mood reflection with your crewmate.',
      mentalBenefit:
        'Directly counters third-quarter isolation syndrome and reinforces social anchoring.',
      nasaReference: 'NASA HRP Team Cohesion & Psychosocial Support',
      completedToday: true,
    },
  ];

  const history = [
    {
      id: 'log-1',
      habitId: 'hab-cardio-1',
      title: 'T2 Treadmill Interval Harness Run',
      category: HabitCategory.CARDIO,
      gardenElement: GardenElement.FLOWER,
      completedAt: hoursAgo(2),
      missionId,
      durationMinutes: 30,
      moodBefore: 3,
      moodAfter: 4,
      notes: 'Steady cadence at 10.5 km/h; felt energized afterward.',
    },
    {
      id: 'log-2',
      habitId: 'hab-nutrition-1',
      title: 'Vitamin D3, Calcium & Electrolyte Hydration',
      category: HabitCategory.NUTRITION,
      gardenElement: GardenElement.TREE,
      completedAt: hoursAgo(4),
      missionId,
      durationMinutes: 10,
      moodBefore: 3,
      moodAfter: 4,
      notes: '600 mL fluid intake + D3 capsule logged.',
    },
    {
      id: 'log-3',
      habitId: 'hab-mental-2',
      title: 'Private Family Video Relay & Crew Check-In',
      category: HabitCategory.MENTAL_HEALTH,
      gardenElement: GardenElement.BIRD,
      completedAt: hoursAgo(18),
      missionId,
      durationMinutes: 20,
      moodBefore: 2,
      moodAfter: 5,
      notes: 'Long call home lifted spirits noticeably.',
    },
    {
      id: 'log-4',
      habitId: 'hab-ared-1',
      title: 'ARED Axial Squats & Heel Raises',
      category: HabitCategory.MUSCLE_BONE,
      gardenElement: GardenElement.STONE,
      completedAt: hoursAgo(26),
      missionId,
      durationMinutes: 45,
      moodBefore: 3,
      moodAfter: 4,
      notes: 'Full load completed; minimal lumbar tightness.',
    },
    {
      id: 'log-5',
      habitId: 'hab-sleep-1',
      title: 'Circadian Amber Light & Blue-Screen Wind-Down',
      category: HabitCategory.SLEEP_CIRCADIAN,
      gardenElement: GardenElement.SUNBEAM,
      completedAt: hoursAgo(32),
      missionId,
      durationMinutes: 30,
      moodBefore: 3,
      moodAfter: 4,
      notes: 'Fell asleep within 15 minutes after amber light shift.',
    },
    {
      id: 'log-6',
      habitId: 'hab-mental-1',
      title: 'Cupola Earth-Gazing & Acoustic Decompression',
      category: HabitCategory.MENTAL_HEALTH,
      gardenElement: GardenElement.BIRD,
      completedAt: hoursAgo(44),
      missionId,
      durationMinutes: 15,
      moodBefore: 2,
      moodAfter: 4,
      notes: 'Watched Pacific cloud spirals during breathing session.',
    },
  ];

  const watchReadings = [
    {
      id: 'watch-1',
      timestamp: hoursAgo(48),
      heartRateBpm: 68,
      hrvMs: 54,
      spo2Percent: 98,
      stressIndex: 42,
      sleepHours: 7.4,
      deepSleepPercent: 21,
      boneLoadKn: 1.45,
      activeMinutes: 64,
      source: 'wearable_sync' as const,
    },
    {
      id: 'watch-2',
      timestamp: hoursAgo(36),
      heartRateBpm: 72,
      hrvMs: 49,
      spo2Percent: 97,
      stressIndex: 51,
      sleepHours: 6.8,
      deepSleepPercent: 18,
      boneLoadKn: 1.52,
      activeMinutes: 72,
      source: 'wearable_sync' as const,
    },
    {
      id: 'watch-3',
      timestamp: hoursAgo(24),
      heartRateBpm: 75,
      hrvMs: 43,
      spo2Percent: 97,
      stressIndex: 62,
      sleepHours: 6.1,
      deepSleepPercent: 15,
      boneLoadKn: 1.38,
      activeMinutes: 58,
      source: 'wearable_sync' as const,
    },
    {
      id: 'watch-4',
      timestamp: hoursAgo(12),
      heartRateBpm: 66,
      hrvMs: 58,
      spo2Percent: 98,
      stressIndex: 36,
      sleepHours: 7.9,
      deepSleepPercent: 23,
      boneLoadKn: 1.61,
      activeMinutes: 80,
      source: 'wearable_sync' as const,
    },
    {
      id: 'watch-5',
      timestamp: hoursAgo(2),
      heartRateBpm: 64,
      hrvMs: 61,
      spo2Percent: 99,
      stressIndex: 31,
      sleepHours: 8.1,
      deepSleepPercent: 25,
      boneLoadKn: 1.65,
      activeMinutes: 75,
      source: 'wearable_sync' as const,
    },
  ];

  const chatMessages = [
    {
      id: 'msg-welcome',
      role: 'assistant' as const,
      text: `Welcome aboard, ${crewName}. I am your Spaceflight Mental & Physical Health Assistant. Tell me how your body or mind feels today—such as muscle soreness, sleep disruption, anxiety, or post-EVA fatigue—and I will prescribe NASA-aligned countermeasures and add a tailored habit directly into your daily tracker and garden.`,
      timestamp: hoursAgo(1),
    },
  ];

  return {
    crewId,
    crewName,
    roleTitle: 'Mission Specialist · Behavioral & Bio-Health',
    missionId,
    missionSol: 48,
    lastHabitResetDate: initialDateKey || getSystemDateKey(),
    avatarUrl,
    habits,
    history,
    watchReadings,
    chatMessages,
  };
}
