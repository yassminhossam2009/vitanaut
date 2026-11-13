import React, { useMemo, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Plus,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { CATEGORY_META, GARDEN_ELEMENT_META } from '../data/nasaResources.ts';
import { MISSION_LANDSCAPES } from '../data/missionLandscapes.ts';
import {
  CrewState,
  HabitCategory,
  HabitTask,
  MissionId,
} from '../types.ts';

interface TasksPageProps {
  crewState: CrewState;
  onCompleteHabit: (
    habit: HabitTask,
    moodBefore: number,
    moodAfter: number,
    notes: string
  ) => void;
  onUncompleteHabit: (habit: HabitTask) => void;
  onAddCustomHabit: (habit: HabitTask) => void;
  onNavigateToGarden: () => void;
}

type FocusGoal =
  | 'balanced'
  | 'bone_strength'
  | 'mental_calm'
  | 'cardio_stamina'
  | 'sleep_recovery';

interface AstronautPersonalData {
  weightKg: number;
  sleepTargetHrs: number;
  focusGoal: FocusGoal;
  personalCondition: string;
  dailyWaterLiters: number;
}

const FOCUS_LABELS: Record<FocusGoal, string> = {
  balanced: 'Balanced Mission Readiness',
  bone_strength: 'Bone Density & Muscle Mass',
  mental_calm: 'Mental Health & Stress Relief',
  cardio_stamina: 'Cardiovascular Endurance',
  sleep_recovery: 'Circadian & Sleep Recovery',
};

function getPersonalStorageKey(crewId: string): string {
  return `verdant_orbit_personal_${crewId}`;
}

function loadPersonalData(crewId: string): AstronautPersonalData {
  try {
    const raw = window.localStorage.getItem(getPersonalStorageKey(crewId));
    if (raw) {
      return JSON.parse(raw) as AstronautPersonalData;
    }
  } catch {
    // Use defaults
  }
  return {
    weightKg: 68,
    sleepTargetHrs: 8.5,
    focusGoal: 'balanced',
    personalCondition: '',
    dailyWaterLiters: 2.5,
  };
}

function getPersonalizedCalibration(
  task: HabitTask,
  personal: AstronautPersonalData,
  crewState: CrewState
): string {
  const mission = MISSION_LANDSCAPES[crewState.missionId];
  const latestWatch = crewState.watchReadings[crewState.watchReadings.length - 1];

  switch (task.category) {
    case HabitCategory.MUSCLE_BONE: {
      const targetLoadKg = Math.round(
        personal.weightKg *
          (crewState.missionId === MissionId.ISS ||
          crewState.missionId === MissionId.DEEP_SPACE
            ? 0.75
            : 0.65)
      );
      return `Target load ${targetLoadKg} kg for ${personal.weightKg} kg body mass · ${mission.gravity}`;
    }
    case HabitCategory.CARDIO: {
      const targetBpm =
        latestWatch && latestWatch.heartRateBpm > 74 ? '132–145 bpm' : '138–155 bpm';
      return `Calibrated zone ${targetBpm}${latestWatch ? ` (resting ${latestWatch.heartRateBpm} bpm)` : ''}`;
    }
    case HabitCategory.MENTAL_HEALTH: {
      if (latestWatch && latestWatch.stressIndex >= 50) {
        return `Priority calm break · watch stress at ${latestWatch.stressIndex}/100`;
      }
      return `Daily emotional resilience · Sol ${crewState.missionSol}`;
    }
    case HabitCategory.SLEEP_CIRCADIAN: {
      const lastSleep = latestWatch ? `last night ${latestWatch.sleepHours}h` : 'orbital sync';
      return `Goal ${personal.sleepTargetHrs}h window · ${lastSleep}`;
    }
    case HabitCategory.NUTRITION: {
      const fluidTarget = (personal.weightKg * 0.036).toFixed(1);
      return `Hydration target ${fluidTarget} L/day for ${personal.weightKg} kg`;
    }
  }
}

export const TasksPage: React.FC<TasksPageProps> = ({
  crewState,
  onCompleteHabit,
  onUncompleteHabit,
  onAddCustomHabit,
  onNavigateToGarden,
}) => {
  const [filter, setFilter] = useState<'all' | HabitCategory>('all');
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [personalData, setPersonalData] = useState<AstronautPersonalData>(() =>
    loadPersonalData(crewState.crewId)
  );
  const [showPersonalEditor, setShowPersonalEditor] = useState(false);
  const [personalNotice, setPersonalNotice] = useState<string | null>(null);
  const [completedBanner, setCompletedBanner] = useState<HabitTask | null>(null);

  const [showNewModal, setShowNewModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<HabitCategory>(
    HabitCategory.MENTAL_HEALTH
  );
  const [newProtocol, setNewProtocol] = useState('');
  const [newTime, setNewTime] = useState('16:00 UTC');
  const [newDuration, setNewDuration] = useState(15);
  const [newDesc, setNewDesc] = useState('');

  const mission = MISSION_LANDSCAPES[crewState.missionId];
  const latestWatch = crewState.watchReadings[crewState.watchReadings.length - 1];

  const completedCount = crewState.habits.filter((h) => h.completedToday).length;
  const totalCount = crewState.habits.length;
  const progressPct =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const groupedHabits = useMemo(() => {
    const categories =
      filter === 'all' ? Object.values(HabitCategory) : [filter];

    return categories
      .map((cat) => {
        const items = crewState.habits
          .filter((h) => h.category === cat)
          .sort((a, b) => Number(a.completedToday) - Number(b.completedToday));
        return { category: cat, items };
      })
      .filter((group) => group.items.length > 0);
  }, [crewState.habits, filter]);

  const toggleDetails = (id: string) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleToggleTask = (task: HabitTask) => {
    if (task.completedToday) {
      onUncompleteHabit(task);
      if (completedBanner?.id === task.id) {
        setCompletedBanner(null);
      }
      return;
    }
    onCompleteHabit(task, 3, 4, `Completed (${FOCUS_LABELS[personalData.focusGoal]})`);
    setCompletedBanner(task);
  };

  const handleSavePersonalData = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned: AstronautPersonalData = {
      weightKg: Math.max(40, Math.min(140, Number(personalData.weightKg) || 68)),
      sleepTargetHrs: Math.max(
        5,
        Math.min(11, Number(personalData.sleepTargetHrs) || 8.5)
      ),
      focusGoal: personalData.focusGoal,
      personalCondition: personalData.personalCondition.trim(),
      dailyWaterLiters: Number((personalData.weightKg * 0.036).toFixed(1)),
    };

    setPersonalData(cleaned);
    window.localStorage.setItem(
      getPersonalStorageKey(crewState.crewId),
      JSON.stringify(cleaned)
    );

    const existingTitles = new Set(
      crewState.habits.map((h) => h.title.toLowerCase())
    );
    let addedTitle: string | null = null;

    if (cleaned.personalCondition) {
      const cond = cleaned.personalCondition;
      const lower = cond.toLowerCase();
      let cat: HabitCategory = HabitCategory.MENTAL_HEALTH;
      let protocol = 'NASA BHP Personal Recovery Protocol';
      let duration = 15;

      if (lower.includes('sleep') || lower.includes('insomnia') || lower.includes('tired')) {
        cat = HabitCategory.SLEEP_CIRCADIAN;
        protocol = 'SSLA Amber Wind-Down & Sleep Hygiene';
        duration = 25;
      } else if (
        lower.includes('back') ||
        lower.includes('muscle') ||
        lower.includes('bone') ||
        lower.includes('knee') ||
        lower.includes('sore')
      ) {
        cat = HabitCategory.MUSCLE_BONE;
        protocol = `ARED Calibrated Mobility (${Math.round(cleaned.weightKg * 0.55)} kg)`;
        duration = 20;
      } else if (lower.includes('heart') || lower.includes('cardio') || lower.includes('breath')) {
        cat = HabitCategory.CARDIO;
        protocol = 'CEVIS Low-Impact Steady Cadence';
        duration = 25;
      } else if (lower.includes('water') || lower.includes('hydrat') || lower.includes('diet')) {
        cat = HabitCategory.NUTRITION;
        protocol = `Electrolyte Mix (${cleaned.dailyWaterLiters} L daily target)`;
        duration = 10;
      }

      const tailoredTitle = `Personal Plan: ${cond.slice(0, 46)}`;
      if (!existingTitles.has(tailoredTitle.toLowerCase())) {
        onAddCustomHabit({
          id: `hab-personal-${Date.now()}`,
          title: tailoredTitle,
          category: cat,
          gardenElement: CATEGORY_META[cat].gardenElement,
          equipmentOrProtocol: protocol,
          scheduledTime: 'Today · Personal Window',
          durationMinutes: duration,
          description: `Tailored for ${crewState.crewName} (${cleaned.weightKg} kg, ${mission.shortName}) addressing: ${cond}.`,
          mentalBenefit:
            'Aligns daily routine directly with your entered physical and mental state.',
          nasaReference: 'Personalized Crew Protocol',
          completedToday: false,
        });
        addedTitle = tailoredTitle;
      }
    } else if (cleaned.focusGoal !== 'balanced') {
      const focusHabitMap: Record<
        Exclude<FocusGoal, 'balanced'>,
        { title: string; cat: HabitCategory; protocol: string; mins: number; desc: string }
      > = {
        bone_strength: {
          title: `ARED Bone Load Set (${Math.round(cleaned.weightKg * 0.8)} kg)`,
          cat: HabitCategory.MUSCLE_BONE,
          protocol: 'ARED Resistive Bar',
          mins: 35,
          desc: `Extra lower-body axial loading calibrated for ${cleaned.weightKg} kg crew body mass in ${mission.gravity}.`,
        },
        mental_calm: {
          title: 'Guided Box Breathing & Nature Acoustics',
          cat: HabitCategory.MENTAL_HEALTH,
          protocol: 'NASA BHP Audio Sanctuary',
          mins: 15,
          desc: 'Decompression session tailored to lower daily orbital cortisol and steady focus.',
        },
        cardio_stamina: {
          title: 'CEVIS Aerobic Endurance Ride',
          cat: HabitCategory.CARDIO,
          protocol: 'CEVIS Cycle Ergometer',
          mins: 30,
          desc: 'Zone-2 cardiovascular endurance session protecting VO2max and plasma volume.',
        },
        sleep_recovery: {
          title: `${cleaned.sleepTargetHrs}h Sleep Pre-Rest & Cabin Dimming`,
          cat: HabitCategory.SLEEP_CIRCADIAN,
          protocol: 'SSLA Warm 2700K Lighting',
          mins: 30,
          desc: `Pre-sleep routine calibrated to hit your ${cleaned.sleepTargetHrs}h target sleep window.`,
        },
      };

      const spec = focusHabitMap[cleaned.focusGoal];
      if (!existingTitles.has(spec.title.toLowerCase())) {
        onAddCustomHabit({
          id: `hab-focus-${Date.now()}`,
          title: spec.title,
          category: spec.cat,
          gardenElement: CATEGORY_META[spec.cat].gardenElement,
          equipmentOrProtocol: spec.protocol,
          scheduledTime: 'Daily · Priority',
          durationMinutes: spec.mins,
          description: spec.desc,
          mentalBenefit: 'Supports your selected mission health priority.',
          nasaReference: 'Personalized Crew Protocol',
          completedToday: false,
        });
        addedTitle = spec.title;
      }
    }

    setShowPersonalEditor(false);
    setPersonalNotice(
      addedTitle
        ? `Personal profile saved and added "${addedTitle}" to your tasks.`
        : 'All task targets recalibrated to your personal astronaut profile.'
    );
  };

  const handleCreateCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const catMeta = CATEGORY_META[newCategory];
    onAddCustomHabit({
      id: `hab-custom-${Date.now()}`,
      title: newTitle.trim(),
      category: newCategory,
      gardenElement: catMeta.gardenElement,
      equipmentOrProtocol: newProtocol.trim() || 'Personal Protocol',
      scheduledTime: newTime.trim() || 'Today',
      durationMinutes: Math.max(5, Number(newDuration) || 15),
      description:
        newDesc.trim() ||
        `Personalized routine for ${crewState.crewName} (${personalData.weightKg} kg).`,
      mentalBenefit: 'Supports consistent daily wellbeing.',
      nasaReference: 'Crew Custom Habit',
      completedToday: false,
    });
    setShowNewModal(false);
    setNewTitle('');
    setNewProtocol('');
    setNewDesc('');
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-5">
      {/* Clean Header & Actions */}
      <div className="bg-white border border-[#D5E3DD] rounded-2xl p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="text-xs font-mono text-[#0369A1]">
            {crewState.crewName} · {crewState.crewId} · {mission.shortName} ({mission.gravity})
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#0F2922] tracking-tight mt-0.5">
            Personal Mission Tasks
          </h1>
          <p className="text-sm text-[#3B5950] mt-1">
            {completedCount} of {totalCount} daily habits completed ({progressPct}%) · calibrated to your body metrics and watch readings.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setShowPersonalEditor((prev) => !prev)}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg border inline-flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
              showPersonalEditor
                ? 'bg-[#0369A1] text-white border-[#0369A1]'
                : 'bg-[#EBF3FA] text-[#0369A1] border-[#BAE6FD] hover:bg-[#DBEAFE]'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Personal Data</span>
          </button>

          <button
            type="button"
            onClick={() => setShowNewModal(true)}
            className="px-3.5 py-2 text-xs font-semibold text-[#0F2922] bg-[#FEFCE8] hover:bg-[#FEF08A] border border-[#EAB308]/60 rounded-lg inline-flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-[#A16207]" />
            <span>Add Task</span>
          </button>
        </div>
      </div>

      {/* Compact Personal Data Strip */}
      <div className="bg-white border border-[#D5E3DD] rounded-2xl px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[#3B5950]">
          <span>
            <strong className="text-[#0F2922]">Weight:</strong>{' '}
            <span className="font-mono">{personalData.weightKg} kg</span>
          </span>
          <span aria-hidden="true">·</span>
          <span>
            <strong className="text-[#0F2922]">Sleep Target:</strong>{' '}
            <span className="font-mono">{personalData.sleepTargetHrs} hrs</span>
          </span>
          <span aria-hidden="true">·</span>
          <span>
            <strong className="text-[#0F2922]">Focus:</strong>{' '}
            {FOCUS_LABELS[personalData.focusGoal]}
          </span>
          {latestWatch && (
            <>
              <span aria-hidden="true">·</span>
              <span>
                <strong className="text-[#0F2922]">Watch:</strong>{' '}
                <span className="font-mono">
                  {latestWatch.heartRateBpm} bpm · Stress {latestWatch.stressIndex}/100
                </span>
              </span>
            </>
          )}
          {personalData.personalCondition && (
            <>
              <span aria-hidden="true">·</span>
              <span className="text-[#0369A1] font-medium">
                Condition: {personalData.personalCondition}
              </span>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowPersonalEditor((prev) => !prev)}
          className="text-xs font-semibold text-[#0369A1] hover:underline whitespace-nowrap cursor-pointer"
        >
          {showPersonalEditor ? 'Hide Editor' : 'Edit Personal Data'}
        </button>
      </div>

      {/* Expandable Personal Data Input Form */}
      {showPersonalEditor && (
        <form
          onSubmit={handleSavePersonalData}
          className="bg-[#F8FBFA] border border-[#BAE6FD] rounded-2xl p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-[#0F2922]">
                Personalize Tasks from Your Data
              </h2>
              <p className="text-xs text-[#4A685F]">
                Enter your weight, sleep goal, priority focus, or any current physical/mental condition to tailor daily loads and add targeted habits.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div>
              <label
                htmlFor="pers-weight"
                className="block text-xs font-medium text-[#3B5950] mb-1"
              >
                Body Weight (kg)
              </label>
              <input
                id="pers-weight"
                type="number"
                min={40}
                max={140}
                value={personalData.weightKg}
                onChange={(e) =>
                  setPersonalData((p) => ({
                    ...p,
                    weightKg: Number(e.target.value),
                  }))
                }
                className="w-full px-3 py-2 text-sm font-mono bg-white border border-[#C9DBD4] rounded-lg"
              />
            </div>

            <div>
              <label
                htmlFor="pers-sleep"
                className="block text-xs font-medium text-[#3B5950] mb-1"
              >
                Sleep Goal (hours)
              </label>
              <input
                id="pers-sleep"
                type="number"
                step="0.5"
                min={5}
                max={11}
                value={personalData.sleepTargetHrs}
                onChange={(e) =>
                  setPersonalData((p) => ({
                    ...p,
                    sleepTargetHrs: Number(e.target.value),
                  }))
                }
                className="w-full px-3 py-2 text-sm font-mono bg-white border border-[#C9DBD4] rounded-lg"
              />
            </div>

            <div>
              <label
                htmlFor="pers-focus"
                className="block text-xs font-medium text-[#3B5950] mb-1"
              >
                Primary Health Focus
              </label>
              <select
                id="pers-focus"
                value={personalData.focusGoal}
                onChange={(e) =>
                  setPersonalData((p) => ({
                    ...p,
                    focusGoal: e.target.value as FocusGoal,
                  }))
                }
                className="w-full px-3 py-2 text-sm bg-white border border-[#C9DBD4] rounded-lg"
              >
                {Object.entries(FOCUS_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="pers-cond"
                className="block text-xs font-medium text-[#3B5950] mb-1"
              >
                Current Condition / Need (Optional)
              </label>
              <input
                id="pers-cond"
                type="text"
                value={personalData.personalCondition}
                onChange={(e) =>
                  setPersonalData((p) => ({
                    ...p,
                    personalCondition: e.target.value,
                  }))
                }
                placeholder="e.g. Knee soreness, high stress"
                className="w-full px-3 py-2 text-sm bg-white border border-[#C9DBD4] rounded-lg"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowPersonalEditor(false)}
              className="px-4 py-2 text-xs font-semibold text-[#3B5950] bg-white border border-[#D5E3DD] rounded-lg cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-[#15803D] hover:bg-[#166534] rounded-lg cursor-pointer"
            >
              Save &amp; Personalize Tasks
            </button>
          </div>
        </form>
      )}

      {personalNotice && (
        <div className="p-3.5 rounded-xl bg-[#EBF3FA] border border-[#BAE6FD] text-xs font-medium text-[#075985] flex items-center justify-between gap-3">
          <span>{personalNotice}</span>
          <button
            type="button"
            onClick={() => setPersonalNotice(null)}
            className="text-[#0369A1] hover:underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {completedBanner && (
        <div className="p-3.5 rounded-xl bg-[#EFF6F2] border border-[#86EFAC] text-xs text-[#14532D] flex flex-wrap items-center justify-between gap-3">
          <span>
            Completed <strong>{completedBanner.title}</strong> — added{' '}
            <strong>
              +1 {GARDEN_ELEMENT_META[completedBanner.gardenElement].name}
            </strong>{' '}
            to your {mission.shortName} garden.
          </span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onNavigateToGarden}
              className="px-3 py-1 font-semibold text-white bg-[#15803D] hover:bg-[#166534] rounded-md cursor-pointer"
            >
              View Garden
            </button>
            <button
              type="button"
              onClick={() => setCompletedBanner(null)}
              className="text-[#3B5950] hover:text-[#0F2922] cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Progress Bar + Clean Filter Tabs */}
      <div className="space-y-3">
        <div className="w-full h-2 rounded-full bg-[#E4EDE9] overflow-hidden">
          <div
            className="h-full bg-[#15803D] transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
              filter === 'all'
                ? 'bg-[#0F2922] text-white'
                : 'bg-white border border-[#D5E3DD] text-[#3B5950] hover:text-[#0F2922]'
            }`}
          >
            All ({crewState.habits.length})
          </button>
          {Object.values(HabitCategory).map((cat) => {
            const count = crewState.habits.filter((h) => h.category === cat).length;
            if (count === 0) return null;
            const active = filter === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setFilter(cat)}
                className={`px-3.5 py-2 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#0369A1] text-white'
                    : 'bg-white border border-[#D5E3DD] text-[#3B5950] hover:text-[#0F2922]'
                }`}
              >
                {CATEGORY_META[cat].shortLabel} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Neat, Organized Grouped Task List */}
      <div className="space-y-4">
        {groupedHabits.map(({ category, items }) => {
          const cat = CATEGORY_META[category];
          const garden = GARDEN_ELEMENT_META[cat.gardenElement];
          const doneInGroup = items.filter((i) => i.completedToday).length;

          return (
            <section
              key={category}
              className="bg-white border border-[#D5E3DD] rounded-2xl overflow-hidden"
            >
              <div className="px-5 py-3.5 bg-[#F6FAF8] border-b border-[#E4EDE9] flex items-center justify-between gap-4">
                <div className="flex items-center gap-2.5">
                  <h2
                    className="text-sm font-bold"
                    style={{ color: cat.accentColor }}
                  >
                    {cat.label}
                  </h2>
                  <span className="text-xs text-[#5C7A70]">·</span>
                  <span className="text-xs text-[#4A685F]">
                    Grows {garden.pluralName}
                  </span>
                </div>
                <span className="text-xs font-mono text-[#3B5950] tabular-nums">
                  {doneInGroup}/{items.length} done
                </span>
              </div>

              <ul className="divide-y divide-[#E4EDE9]">
                {items.map((task) => {
                  const isExpanded = Boolean(expandedIds[task.id]);
                  const calibrationText = getPersonalizedCalibration(
                    task,
                    personalData,
                    crewState
                  );

                  return (
                    <li
                      key={task.id}
                      className={`px-5 py-4 transition-colors ${
                        task.completedToday ? 'bg-[#FAFDFB]' : 'bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3.5 min-w-0 flex-1">
                          <button
                            type="button"
                            onClick={() => handleToggleTask(task)}
                            aria-label={
                              task.completedToday
                                ? `Uncheck ${task.title}`
                                : `Mark ${task.title} complete`
                            }
                            className={`w-6 h-6 rounded-md border flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                              task.completedToday
                                ? 'bg-[#15803D] hover:bg-[#166534] border-[#15803D] text-white'
                                : 'bg-white border-[#94B5A9] hover:border-[#15803D] text-transparent hover:text-[#15803D]'
                            }`}
                          >
                            <Check className="w-4 h-4" />
                          </button>

                          <span
                            className={`text-sm font-semibold truncate ${
                              task.completedToday
                                ? 'line-through text-[#6A857C]'
                                : 'text-[#0F2922]'
                            }`}
                          >
                            {task.title}
                          </span>
                        </div>

                        <div className="flex items-center gap-2.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => toggleDetails(task.id)}
                            className="px-2.5 py-1.5 text-xs font-medium text-[#4A685F] hover:text-[#0F2922] hover:bg-[#F6FAF8] rounded-lg inline-flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
                          >
                            <span>{isExpanded ? 'Hide' : 'Details'}</span>
                            {isExpanded ? (
                              <ChevronUp className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )}
                          </button>

                          {task.completedToday ? (
                            <button
                              type="button"
                              onClick={() => handleToggleTask(task)}
                              className="px-3.5 py-1.5 text-xs font-semibold text-[#15803D] bg-[#EFF6F2] hover:bg-[#DCFCE7] border border-[#86EFAC] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                            >
                              Undo
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleToggleTask(task)}
                              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-[#0369A1] hover:bg-[#075985] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                            >
                              Complete
                            </button>
                          )}
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="mt-3 ml-9 p-3.5 rounded-xl bg-[#F6FAF8] border border-[#E4EDE9] text-xs text-[#2D473E] space-y-1.5 leading-relaxed">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[#0F2922] font-medium">
                            <span>{task.equipmentOrProtocol}</span>
                            <span aria-hidden="true">·</span>
                            <span>{calibrationText}</span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono text-[#5C7A70] tabular-nums">
                              {task.scheduledTime} · {task.durationMinutes} min
                            </span>
                          </div>
                          <p>{task.description}</p>
                          <p className="text-[#4A685F]">
                            <strong className="text-[#0F2922]">Garden Reward:</strong>{' '}
                            +1 {GARDEN_ELEMENT_META[task.gardenElement].name} ·{' '}
                            {task.nasaReference}
                          </p>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      {/* Add Custom Personal Habit Modal */}
      {showNewModal && (
        <div
          className="fixed inset-0 z-40 bg-[#0F2922]/30 backdrop-blur-[2px] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-habit-title"
        >
          <form
            onSubmit={handleCreateCustom}
            className="bg-white border border-[#D5E3DD] rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h2 id="new-habit-title" className="text-lg font-bold text-[#0F2922]">
                Add Personal Habit
              </h2>
              <button
                type="button"
                onClick={() => setShowNewModal(false)}
                className="p-1.5 rounded-lg text-[#4A685F] hover:bg-[#EFF6F2] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#3B5950] mb-1">
                Task Title
              </label>
              <input
                type="text"
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. CEVIS Recovery Spin or Evening Journaling"
                className="w-full px-3.5 py-2 text-sm bg-[#F8FBFA] border border-[#C9DBD4] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0369A1]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#3B5950] mb-1">
                  Category
                </label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as HabitCategory)}
                  className="w-full px-3 py-2 text-sm bg-[#F8FBFA] border border-[#C9DBD4] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0369A1]"
                >
                  {Object.values(HabitCategory).map((cat) => (
                    <option key={cat} value={cat}>
                      {CATEGORY_META[cat].label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#3B5950] mb-1">
                  Duration (min)
                </label>
                <input
                  type="number"
                  min={5}
                  max={120}
                  value={newDuration}
                  onChange={(e) => setNewDuration(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm font-mono bg-[#F8FBFA] border border-[#C9DBD4] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0369A1]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#3B5950] mb-1">
                  Equipment / Protocol
                </label>
                <input
                  type="text"
                  value={newProtocol}
                  onChange={(e) => setNewProtocol(e.target.value)}
                  placeholder="e.g. ARED / Mindfulness"
                  className="w-full px-3 py-2 text-sm bg-[#F8FBFA] border border-[#C9DBD4] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0369A1]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#3B5950] mb-1">
                  Scheduled Time
                </label>
                <input
                  type="text"
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  placeholder="e.g. 16:00 UTC"
                  className="w-full px-3 py-2 text-sm font-mono bg-[#F8FBFA] border border-[#C9DBD4] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0369A1]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#3B5950] mb-1">
                Instructions (Optional)
              </label>
              <textarea
                rows={2}
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Describe steps or personal goal..."
                className="w-full px-3.5 py-2 text-sm bg-[#F8FBFA] border border-[#C9DBD4] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0369A1]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowNewModal(false)}
                className="px-4 py-2 text-xs font-semibold text-[#3B5950] bg-white border border-[#D5E3DD] rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-white bg-[#15803D] hover:bg-[#166534] rounded-lg cursor-pointer"
              >
                Save Task
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
