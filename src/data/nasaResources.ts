import { GardenElement, HabitCategory, NasaCountermeasureResource } from '../types.ts';

export const CATEGORY_META: Record<
  HabitCategory,
  {
    label: string;
    shortLabel: string;
    gardenElement: GardenElement;
    gardenSymbolLabel: string;
    accentColor: string;
    softBg: string;
    borderColor: string;
    textColor: string;
  }
> = {
  [HabitCategory.MUSCLE_BONE]: {
    label: 'Muscle & Bone Density',
    shortLabel: 'Strength',
    gardenElement: GardenElement.STONE,
    gardenSymbolLabel: 'River Stones',
    accentColor: '#0369A1',
    softBg: '#EBF3FA',
    borderColor: '#BAE6FD',
    textColor: '#0C4A6E',
  },
  [HabitCategory.CARDIO]: {
    label: 'Cardiovascular Health',
    shortLabel: 'Cardio',
    gardenElement: GardenElement.FLOWER,
    gardenSymbolLabel: 'Wildflowers',
    accentColor: '#15803D',
    softBg: '#EFF6F2',
    borderColor: '#BBF7D0',
    textColor: '#14532D',
  },
  [HabitCategory.MENTAL_HEALTH]: {
    label: 'Mental Health & Resilience',
    shortLabel: 'Mental Health',
    gardenElement: GardenElement.BIRD,
    gardenSymbolLabel: 'Chirping Birds',
    accentColor: '#0284C7',
    softBg: '#E0F2FE',
    borderColor: '#7DD3FC',
    textColor: '#075985',
  },
  [HabitCategory.SLEEP_CIRCADIAN]: {
    label: 'Sleep & Circadian Rhythm',
    shortLabel: 'Sleep',
    gardenElement: GardenElement.SUNBEAM,
    gardenSymbolLabel: 'Sunlit Lanterns',
    accentColor: '#A16207',
    softBg: '#FEFCE8',
    borderColor: '#FDE047',
    textColor: '#713F12',
  },
  [HabitCategory.NUTRITION]: {
    label: 'Space Nutrition & Hydration',
    shortLabel: 'Nutrition',
    gardenElement: GardenElement.TREE,
    gardenSymbolLabel: 'Canopy Trees',
    accentColor: '#16A34A',
    softBg: '#ECFDF5',
    borderColor: '#A7F3D0',
    textColor: '#065F46',
  },
};

export const GARDEN_ELEMENT_META: Record<
  GardenElement,
  {
    name: string;
    pluralName: string;
    represents: string;
    description: string;
  }
> = {
  [GardenElement.STONE]: {
    name: 'River Stone',
    pluralName: 'Balanced Stone Cairns',
    represents: 'Muscle & Bone Density',
    description:
      'Every ARED resistance session places a smooth mineral stone into your sanctuary cairn, symbolizing skeletal load and muscular resilience.',
  },
  [GardenElement.BIRD]: {
    name: 'Songbird',
    pluralName: 'Chirping Songbirds',
    represents: 'Mental Health & Calm',
    description:
      'Completing mindfulness, journaling, and crew connection habits invites songbirds that chirp gentle Earth melodies across your habitat.',
  },
  [GardenElement.FLOWER]: {
    name: 'Wildflower',
    pluralName: 'Blooming Wildflowers',
    represents: 'Cardiovascular Health',
    description:
      'T2 treadmill and CEVIS cycle workouts nourish vascular oxygen delivery, opening vivid blue, emerald, and pale-yellow blossoms.',
  },
  [GardenElement.SUNBEAM]: {
    name: 'Sunbeam Lantern',
    pluralName: 'Circadian Sunbeams',
    represents: 'Sleep & Circadian Health',
    description:
      'Honoring orbital wind-down and 8.5-hour sleep windows stabilizes golden circadian light shafts inside your conservatory.',
  },
  [GardenElement.TREE]: {
    name: 'Canopy Fern',
    pluralName: 'Hydroponic Canopy Trees',
    represents: 'Nutrition & Hydration',
    description:
      'Balanced spaceflight electrolytes, Vitamin D, and nutrient-dense meals grow lush green canopy foliage and clear water basins.',
  },
};

export const NASA_COUNTERMEASURE_RESOURCES: NasaCountermeasureResource[] = [
  {
    id: 'nasa-ared',
    title: 'ARED Resistive Loading & Bone Mineral Density Protocol',
    program: 'NASA Human Research Program · Muscle & Bone',
    category: HabitCategory.MUSCLE_BONE,
    gardenElement: GardenElement.STONE,
    summary:
      'In microgravity, astronauts can lose 1% to 1.5% of bone mineral density per month without axial loading. The Advanced Resistive Exercise Device (ARED) simulates free-weight squats, deadlifts, and heel raises up to 272 kg.',
    dailyTarget: '45–60 min resistive loading, 6 days/week',
    spaceflightRisk: 'Microgravity osteopenia, spinal deconditioning, and lower-back muscle atrophy.',
    url: 'https://www.nasa.gov/missions/station/iss-research/counteracting-bone-and-muscle-loss-in-microgravity/',
  },
  {
    id: 'nasa-t2-cevis',
    title: 'T2 Treadmill & CEVIS Aerobic Countermeasures',
    program: 'NASA Exercise Physiology & Countermeasures Lab',
    category: HabitCategory.CARDIO,
    gardenElement: GardenElement.FLOWER,
    summary:
      'Cardiovascular deconditioning reduces plasma volume and VO2max in orbit. Combining T2 harness running with CEVIS interval cycling preserves orthostatic tolerance and endothelial health.',
    dailyTarget: '30–40 min aerobic intervals, target 70–85% max HR',
    spaceflightRisk: 'Cardiac atrophy, reduced aerobic capacity, and post-flight orthostatic intolerance.',
    url: 'https://www.nasa.gov/missions/station/cardiovascular-health-in-microgravity/',
  },
  {
    id: 'nasa-bhp',
    title: 'Behavioral Health & Performance (BHP) Resilience Toolkit',
    program: 'NASA Behavioral Health & Performance Element',
    category: HabitCategory.MENTAL_HEALTH,
    gardenElement: GardenElement.BIRD,
    summary:
      'Long-duration isolation, confinement, and distance from Earth increase stress and mood fluctuations. NASA recommends structured cognitive decompression, Earth-observation breaks, nature acoustics, and private family comms.',
    dailyTarget: '15–20 min dedicated mental decompression & daily mood check-in',
    spaceflightRisk: 'Isolation stress, third-quarter phenomenon fatigue, and crew interpersonal strain.',
    url: 'https://www.nasa.gov/hrp/human-factors-and-behavioral-performance/',
  },
  {
    id: 'nasa-circadian',
    title: 'ISS Solid-State Lighting & Circadian Sleep Alignment',
    program: 'NASA Fatigue Management & Circadian Lab',
    category: HabitCategory.SLEEP_CIRCADIAN,
    gardenElement: GardenElement.SUNBEAM,
    summary:
      'Astronauts experience 16 sunrises and sunsets every 24 hours on the ISS. Dynamic blue-enriched morning light and warm amber pre-sleep dimming protect melatonin cycles and cognitive alertness.',
    dailyTarget: '8.5 hr scheduled sleep window + 30 min low-blue wind-down',
    spaceflightRisk: 'Circadian desynchronization, fragmented deep sleep, and alertness deficits.',
    url: 'https://homeandcity.nasa.gov/technology/sleep-enhancing-light/',
  },
  {
    id: 'nasa-nutrition',
    title: 'Spaceflight Nutritional Biochemistry & Hydration',
    program: 'NASA Nutritional Biochemistry Laboratory',
    category: HabitCategory.NUTRITION,
    gardenElement: GardenElement.TREE,
    summary:
      'Vitamin D supplementation (compensating for zero UV exposure), controlled sodium, potassium citrate, omega-3 fatty acids, and 2.5L fluid intake safeguard bone metabolism, vision, and mood.',
    dailyTarget: '2.5 L hydration + Vitamin D3 800 IU + balanced micronutrient rations',
    spaceflightRisk: 'Renal stone formation, Vitamin D depletion, and fluid-shift electrolyte imbalance.',
    url: 'https://www.nasa.gov/directorates/esdmd/hhp/nutritional-biochemistry/',
  },
  {
    id: 'nasa-veggie',
    title: 'ISS Veggie & Space Horticulture Psychological Benefit',
    program: 'NASA Space Apps · Pick-and-Eat Plant Growth',
    category: HabitCategory.MENTAL_HEALTH,
    gardenElement: GardenElement.BIRD,
    summary:
      'Tending living plants aboard the ISS provides measurable psychological restoration, sensory variety, and connection to Earth biology—the exact inspiration for Vitanaut.',
    dailyTarget: '5–10 min sensory sanctuary observation & botanical log',
    spaceflightRisk: 'Sensory monotony in closed artificial habitats.',
    url: 'https://www.nasa.gov/exploration-research-and-technology/growing-plants-in-space/',
  },
];
