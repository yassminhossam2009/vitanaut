import { MissionId } from '../types.ts';
import issBackdrop from '../assets/images/iss_orbital_garden_1794579663403.jpg';
import lunarBackdrop from '../assets/images/lunar_artemis_garden_1794579663910.jpg';
import marsBackdrop from '../assets/images/mars_jezero_garden_1794579665306.jpg';
import deepSpaceBackdrop from '../assets/images/deep_space_garden_1794579665660.jpg';

export interface MissionLandscapeConfig {
  id: MissionId;
  name: string;
  shortName: string;
  location: string;
  gravity: string;
  daylightCycle: string;
  backdropImage: string;
  fallbackGradient: string;
  skyTop: string;
  skyBottom: string;
  horizonColor: string;
  groundColor: string;
  accentTint: string;
  environmentalBrief: string;
  mentalFocus: string;
}

export const MISSION_LANDSCAPES: Record<MissionId, MissionLandscapeConfig> = {
  [MissionId.ISS]: {
    id: MissionId.ISS,
    name: 'ISS Orbital Cupola Sanctuary',
    shortName: 'ISS Orbit',
    location: 'Low Earth Orbit · 408 km Altitude',
    gravity: '0.00 g Microgravity',
    daylightCycle: '16 Sunrises / 24h',
    backdropImage: issBackdrop,
    fallbackGradient: 'linear-gradient(135deg, #EBF3FA 0%, #EFF6F2 55%, #FEFCE8 100%)',
    skyTop: '#BAE6FD',
    skyBottom: '#E0F2FE',
    horizonColor: '#0284C7',
    groundColor: '#D1FAE5',
    accentTint: '#0369A1',
    environmentalBrief:
      'Orbital observation terrace framed by Earth’s blue limb. High risk of microgravity bone unloading and rapid circadian shifts.',
    mentalFocus: 'Earth-gazing awe & circadian grounding',
  },
  [MissionId.LUNAR]: {
    id: MissionId.LUNAR,
    name: 'Artemis Shackleton Bio-Dome',
    shortName: 'Lunar Base',
    location: 'Lunar South Pole · Shackleton Rim',
    gravity: '0.165 g Partial Gravity',
    daylightCycle: 'Continuous Rim Sunlight',
    backdropImage: lunarBackdrop,
    fallbackGradient: 'linear-gradient(135deg, #E2E8F0 0%, #EBF3FA 50%, #FEF9C3 100%)',
    skyTop: '#CBD5E1',
    skyBottom: '#F1F5F9',
    horizonColor: '#64748B',
    groundColor: '#DCFCE7',
    accentTint: '#15803D',
    environmentalBrief:
      'Pressurized lunar south pole greenhouse bathed in pale solar reflectors. Protects crew from regolith isolation and dust confinement.',
    mentalFocus: 'Sensory warmth & low-gravity gait stability',
  },
  [MissionId.MARS]: {
    id: MissionId.MARS,
    name: 'Jezero Crater Conservatory',
    shortName: 'Mars Outpost',
    location: 'Mars · Jezero Delta Habitat',
    gravity: '0.38 g Martian Gravity',
    daylightCycle: '24h 39m Sol Cycle',
    backdropImage: marsBackdrop,
    fallbackGradient: 'linear-gradient(135deg, #FEFCE8 0%, #EBF3FA 50%, #ECFDF5 100%)',
    skyTop: '#FDE68A',
    skyBottom: '#E0F2FE',
    horizonColor: '#B45309',
    groundColor: '#BBF7D0',
    accentTint: '#A16207',
    environmentalBrief:
      'Arched pressurized conservatory overlooking Jezero ridge lines. Essential buffer against 20-minute Earth comm latency and long confinement.',
    mentalFocus: 'Autonomous resilience & Earth-delay coping',
  },
  [MissionId.DEEP_SPACE]: {
    id: MissionId.DEEP_SPACE,
    name: 'Gateway Deep-Space Atrium',
    shortName: 'Deep Space',
    location: 'Cislunar / Deep Transit Corridor',
    gravity: '0.00 g Transit Microgravity',
    daylightCycle: 'Synthetic 24h Solar Array',
    backdropImage: deepSpaceBackdrop,
    fallbackGradient: 'linear-gradient(135deg, #DBEAFE 0%, #ECFDF5 55%, #FEFCE8 100%)',
    skyTop: '#1E3A8A',
    skyBottom: '#0369A1',
    horizonColor: '#0F172A',
    groundColor: '#A7F3D0',
    accentTint: '#0284C7',
    environmentalBrief:
      'Tranquil starfield atrium with acoustic water pools and circadian sky panels designed for Earth-out-of-view transit.',
    mentalFocus: 'Deep-isolation calm & acoustic bird sanctuary',
  },
};
