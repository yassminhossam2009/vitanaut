/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { AssistantPage } from './components/AssistantPage.tsx';
import { HistoryPage } from './components/HistoryPage.tsx';
import { HomePage } from './components/HomePage.tsx';
import { LandscapePage } from './components/LandscapePage.tsx';
import { NasaResourcesModal } from './components/NasaResourcesModal.tsx';
import { TasksPage } from './components/TasksPage.tsx';
import { NavTabId, TopNav } from './components/TopNav.tsx';
import { WatchPage } from './components/WatchPage.tsx';
import {
  ChatMessage,
  CompletedLog,
  CrewAccountSummary,
  CrewState,
  HabitTask,
  MissionId,
  WatchReading,
} from './types.ts';
import { applyDailyHabitReset, getSystemDateKey } from './utils/dailyReset.ts';
import { api, getToken, setToken } from './lib/api.ts';

const STORAGE_CREW_ID_KEY = 'verdant_orbit_crew_id';

export default function App() {
  const [crewState, setCrewState] = useState<CrewState | null>(null);
  const [accounts, setAccounts] = useState<CrewAccountSummary[]>([]);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [activeTab, setActiveTab] = useState<NavTabId>('home');
  const [nasaModalOpen, setNasaModalOpen] = useState(false);
  const [assistantDraftPrompt, setAssistantDraftPrompt] = useState<string | null>(
    null
  );
  const [homeNotice, setHomeNotice] = useState<string | null>(null);

  useEffect(() => {
    const savedCrewId = window.localStorage.getItem(STORAGE_CREW_ID_KEY);
    const hasToken = Boolean(getToken());

    const loadAccounts = fetch('/api/crew/accounts')
      .then((res) => (res.ok ? res.json() : { accounts: [] }))
      .then((data: { accounts?: CrewAccountSummary[] }) => {
        setAccounts(data.accounts ?? []);
      })
      .catch(() => {
        setAccounts([]);
      });

    const loadSession = savedCrewId && hasToken
      ? api
          .getState(savedCrewId, getSystemDateKey())
          .then((data: { state?: CrewState } | null) => {
            if (data?.state) {
              const { state: syncedState, needsPersist } = applyDailyHabitReset(
                data.state
              );
              setCrewState(syncedState);
              if (needsPersist) {
                void api.saveState(syncedState).catch(() => {});
              }
            } else {
              window.localStorage.removeItem(STORAGE_CREW_ID_KEY);
            }
          })
          .catch(() => {
            window.localStorage.removeItem(STORAGE_CREW_ID_KEY);
            setToken(null);
          })
      : Promise.resolve();

    void Promise.all([loadAccounts, loadSession]).finally(() => {
      setBootstrapping(false);
    });
  }, []);

  const persistState = (nextState: CrewState) => {
    setCrewState(nextState);
    setAccounts((prev) =>
      prev.map((a) =>
        a.crewId === nextState.crewId
          ? {
              ...a,
              crewName: nextState.crewName,
              missionId: nextState.missionId,
              missionSol: nextState.missionSol,
              avatarUrl: nextState.avatarUrl,
            }
          : a
      )
    );
    void api.saveState(nextState).catch(() => {
      // Non-fatal persistence retry handled on next action
    });
  };

  const handleSelectTab = (tab: NavTabId) => {
    setHomeNotice(null);
    if (tab === 'home') {
      setActiveTab('home');
      return;
    }

    if (!crewState) {
      setActiveTab('home');
      setHomeNotice('Please create an astronaut account or sign in on Home first.');
      return;
    }

    setActiveTab(tab);
  };

  useEffect(() => {
    if (!crewState) return;

    const checkSystemDateChange = () => {
      const todayKey = getSystemDateKey();
      const { state: nextState, needsPersist } = applyDailyHabitReset(
        crewState,
        todayKey
      );
      if (needsPersist) {
        persistState(nextState);
      }
    };

    checkSystemDateChange();

    const intervalId = window.setInterval(checkSystemDateChange, 15_000);
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState !== 'hidden') {
        checkSystemDateChange();
      }
    };

    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
    };
  }, [crewState]);

  const handleAuthenticated = (
    state: CrewState,
    updatedAccounts: CrewAccountSummary[]
  ) => {
    const { state: resetState, needsPersist } = applyDailyHabitReset(state);
    window.localStorage.setItem(STORAGE_CREW_ID_KEY, resetState.crewId);
    setAccounts(updatedAccounts);
    setHomeNotice(null);
    setActiveTab('home');
    if (needsPersist) {
      persistState(resetState);
    } else {
      setCrewState(resetState);
    }
  };

  const handleSignOut = () => {
    void api.logout();
    setToken(null);
    window.localStorage.removeItem(STORAGE_CREW_ID_KEY);
    setCrewState(null);
    setActiveTab('home');
  };

  const handleCompleteHabit = (
    habit: HabitTask,
    moodBefore: number,
    moodAfter: number,
    notes: string
  ) => {
    if (!crewState) return;
    const logEntry: CompletedLog = {
      id: `log-${Date.now()}`,
      habitId: habit.id,
      title: habit.title,
      category: habit.category,
      gardenElement: habit.gardenElement,
      completedAt: new Date().toISOString(),
      missionId: crewState.missionId,
      durationMinutes: habit.durationMinutes,
      moodBefore,
      moodAfter,
      notes: notes || undefined,
    };

    const nextHabits = crewState.habits.map((h) =>
      h.id === habit.id ? { ...h, completedToday: true, isUrgent: false } : h
    );

    persistState({
      ...crewState,
      habits: nextHabits,
      history: [logEntry, ...crewState.history],
    });
  };

  const handleUncompleteHabit = (habit: HabitTask) => {
    if (!crewState) return;
    const nextHabits = crewState.habits.map((h) =>
      h.id === habit.id ? { ...h, completedToday: false } : h
    );

    const removeIdx = crewState.history.findIndex(
      (entry) => entry.habitId === habit.id
    );
    const nextHistory =
      removeIdx >= 0
        ? crewState.history.filter((_, idx) => idx !== removeIdx)
        : crewState.history;

    persistState({
      ...crewState,
      habits: nextHabits,
      history: nextHistory,
    });
  };

  const handleAddCustomHabit = (habit: HabitTask) => {
    if (!crewState) return;
    persistState({
      ...crewState,
      habits: [habit, ...crewState.habits],
    });
  };

  const handleAssistantUpdate = (
    messages: ChatMessage[],
    addedHabit?: HabitTask
  ) => {
    if (!crewState) return;
    const nextHabits = addedHabit
      ? [addedHabit, ...crewState.habits.filter((h) => h.id !== addedHabit.id)]
      : crewState.habits;

    persistState({
      ...crewState,
      habits: nextHabits,
      chatMessages: messages,
    });
  };

  const handleChangeMission = (missionId: MissionId) => {
    if (!crewState) return;
    persistState({
      ...crewState,
      missionId,
    });
  };

  const handleAddWatchReading = (reading: WatchReading) => {
    if (!crewState) return;
    // Measurements go to their own table through a dedicated endpoint; the
    // generic state sync deliberately ignores the watchReadings array.
    void api.addWatchReading(reading).catch(() => {});
    persistState({
      ...crewState,
      watchReadings: [...crewState.watchReadings, reading],
    });
  };

  const handleSendWatchAlertToAssistant = (prompt: string) => {
    setAssistantDraftPrompt(prompt);
    setActiveTab('assistant');
  };

  return (
    <div className="min-h-screen bg-[#F6FAF8] text-[#0F2922] flex flex-col">
      <TopNav
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
      />

      <main className="flex-1">
        {homeNotice && activeTab === 'home' && !crewState && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-5">
            <div className="p-3.5 rounded-xl bg-[#FEFCE8] border border-[#EAB308]/60 text-xs font-medium text-[#713F12] flex items-center justify-between gap-3">
              <span>{homeNotice}</span>
              <button
                type="button"
                onClick={() => setHomeNotice(null)}
                className="text-[#A16207] hover:underline cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {bootstrapping ? (
          <div className="py-24 text-center text-sm text-[#3B5950]">
            Loading Vitanaut habitat telemetry...
          </div>
        ) : (
          <>
            {(activeTab === 'home' || !crewState) && (
              <HomePage
                currentCrew={crewState}
                accounts={accounts}
                onAuthenticated={handleAuthenticated}
                onSignOut={handleSignOut}
                onGoToTasks={() => setActiveTab('tasks')}
                onGoToLandscape={() => setActiveTab('landscape')}
                onOpenNasaResources={() => setNasaModalOpen(true)}
              />
            )}

            {crewState && activeTab === 'tasks' && (
              <TasksPage
                crewState={crewState}
                onCompleteHabit={handleCompleteHabit}
                onUncompleteHabit={handleUncompleteHabit}
                onAddCustomHabit={handleAddCustomHabit}
                onNavigateToGarden={() => setActiveTab('landscape')}
              />
            )}

            {crewState && activeTab === 'assistant' && (
              <AssistantPage
                crewState={crewState}
                draftPrompt={assistantDraftPrompt}
                onClearDraftPrompt={() => setAssistantDraftPrompt(null)}
                onAssistantUpdate={handleAssistantUpdate}
                onGoToTasks={() => setActiveTab('tasks')}
                onGoToGarden={() => setActiveTab('landscape')}
              />
            )}

            {crewState && activeTab === 'landscape' && (
              <LandscapePage
                crewState={crewState}
                onChangeMission={handleChangeMission}
                onGoToTasks={() => setActiveTab('tasks')}
              />
            )}

            {crewState && activeTab === 'watch' && (
              <WatchPage
                crewState={crewState}
                onAddWatchReading={handleAddWatchReading}
                onSendAlertToAssistant={handleSendWatchAlertToAssistant}
              />
            )}

            {crewState && activeTab === 'history' && (
              <HistoryPage crewState={crewState} />
            )}
          </>
        )}
      </main>

      <NasaResourcesModal
        open={nasaModalOpen}
        onClose={() => setNasaModalOpen(false)}
      />
    </div>
  );
}
