import React, { useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  ImagePlus,
  KeyRound,
  LogOut,
  Plus,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { MISSION_LANDSCAPES } from '../data/missionLandscapes.ts';
import { CrewAccountSummary, CrewState, MissionId } from '../types.ts';
import { getSystemDateKey } from '../utils/dailyReset.ts';

interface HomePageProps {
  currentCrew: CrewState | null;
  accounts: CrewAccountSummary[];
  onAuthenticated: (state: CrewState, updatedAccounts: CrewAccountSummary[]) => void;
  onSignOut: () => void;
  onGoToTasks: () => void;
  onGoToLandscape: () => void;
  onOpenNasaResources: () => void;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'AS';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const AvatarBadge: React.FC<{
  name: string;
  avatarUrl?: string;
  sizeClass?: string;
}> = ({ name, avatarUrl, sizeClass = 'w-12 h-12 text-sm' }) => {
  const [imgFailed, setImgFailed] = useState(false);

  if (avatarUrl && !imgFailed) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        referrerPolicy="no-referrer"
        onError={() => setImgFailed(true)}
        className={`${sizeClass} rounded-full object-cover border border-[#C9DBD4] shrink-0`}
      />
    );
  }

  return (
    <div
      aria-hidden="true"
      className={`${sizeClass} rounded-full bg-[#EBF3FA] border border-[#BAE6FD] text-[#0369A1] font-display font-bold flex items-center justify-center shrink-0`}
    >
      {getInitials(name)}
    </div>
  );
};

function readImageAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 256;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(reader.result));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => reject(new Error('Invalid image file.'));
      img.src = String(reader.result);
    };
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.readAsDataURL(file);
  });
}

export const HomePage: React.FC<HomePageProps> = ({
  currentCrew,
  accounts,
  onAuthenticated,
  onSignOut,
  onGoToTasks,
  onGoToLandscape,
  onOpenNasaResources,
}) => {
  // Create Account Form state (used both on first-time screen and Create Another Account modal)
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newId, setNewId] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newAvatarUrl, setNewAvatarUrl] = useState('');
  const [newMissionId, setNewMissionId] = useState<MissionId>(MissionId.ISS);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Switch / Sign-In Modal state for clicking an existing user account
  const [switchTarget, setSwitchTarget] = useState<CrewAccountSummary | null>(null);
  const [switchPassword, setSwitchPassword] = useState('');
  const [switchLoading, setSwitchLoading] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);

  const handleImageFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCreateError(null);
    try {
      const dataUrl = await readImageAsDataUrl(file);
      setNewAvatarUrl(dataUrl);
    } catch {
      setCreateError('Could not load that image. Try a PNG or JPG file.');
    }
  };

  const resetCreateForm = () => {
    setNewName('');
    setNewId('');
    setNewPassword('');
    setNewAvatarUrl('');
    setNewMissionId(MissionId.ISS);
    setCreateError(null);
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setCreateLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          crewName: newName,
          crewId: newId,
          password: newPassword,
          missionId: newMissionId,
          avatarUrl: newAvatarUrl || undefined,
          clientDate: getSystemDateKey(),
        }),
      });
      const data = (await res.json()) as {
        state?: CrewState;
        accounts?: CrewAccountSummary[];
        error?: string;
      };
      if (!res.ok || !data.state) {
        setCreateError(data.error ?? 'Could not create account.');
        setCreateLoading(false);
        return;
      }
      resetCreateForm();
      setShowCreateModal(false);
      onAuthenticated(data.state, data.accounts ?? accounts);
    } catch {
      setCreateError('Unable to reach server. Please try again.');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleSwitchSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!switchTarget) return;
    setSwitchError(null);
    setSwitchLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          crewId: switchTarget.crewId,
          password: switchPassword,
          clientDate: getSystemDateKey(),
        }),
      });
      const data = (await res.json()) as {
        state?: CrewState;
        accounts?: CrewAccountSummary[];
        error?: string;
      };
      if (!res.ok || !data.state) {
        setSwitchError(data.error ?? 'Incorrect password.');
        setSwitchLoading(false);
        return;
      }
      setSwitchTarget(null);
      setSwitchPassword('');
      onAuthenticated(data.state, data.accounts ?? accounts);
    } catch {
      setSwitchError('Unable to reach server. Please try again.');
    } finally {
      setSwitchLoading(false);
    }
  };

  const renderCreateFormFields = (submitLabel: string) => (
    <form onSubmit={handleCreateAccount} className="space-y-4">
      <div className="flex items-center gap-4 p-3.5 rounded-xl bg-[#F6FAF8] border border-[#D5E3DD]">
        <AvatarBadge
          name={newName || 'New Astronaut'}
          avatarUrl={newAvatarUrl || undefined}
          sizeClass="w-14 h-14 text-base"
        />
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="text-xs font-semibold text-[#0F2922]">
            Profile Image (Optional)
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="px-3 py-1.5 text-xs font-semibold text-[#0369A1] bg-[#EBF3FA] hover:bg-[#DBEAFE] border border-[#BAE6FD] rounded-lg inline-flex items-center gap-1.5 cursor-pointer transition-colors">
              <ImagePlus className="w-3.5 h-3.5" />
              <span>Upload Photo</span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => void handleImageFileChange(e)}
                className="sr-only"
              />
            </label>
            {newAvatarUrl && (
              <button
                type="button"
                onClick={() => setNewAvatarUrl('')}
                className="text-xs text-[#4A685F] hover:text-[#991B1B] cursor-pointer"
              >
                Remove
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <div>
          <label
            htmlFor="create-name"
            className="block text-xs font-medium text-[#3B5950] mb-1.5"
          >
            Full Name
          </label>
          <input
            id="create-name"
            type="text"
            required
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Yassmin Hossam"
            className="w-full px-3.5 py-2.5 text-sm bg-[#F8FBFA] border border-[#C9DBD4] rounded-lg text-[#0F2922] focus:outline-none focus:ring-2 focus:ring-[#0369A1]"
          />
        </div>

        <div>
          <label
            htmlFor="create-id"
            className="block text-xs font-medium text-[#3B5950] mb-1.5"
          >
            Astronaut ID
          </label>
          <div className="relative">
            <UserCheck className="w-4 h-4 text-[#5C7A70] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="create-id"
              type="text"
              required
              value={newId}
              onChange={(e) => setNewId(e.target.value)}
              placeholder="e.g. AST-101"
              className="w-full pl-9 pr-3.5 py-2.5 text-sm font-mono uppercase bg-[#F8FBFA] border border-[#C9DBD4] rounded-lg text-[#0F2922] focus:outline-none focus:ring-2 focus:ring-[#0369A1]"
            />
          </div>
        </div>
      </div>

      <div>
        <label
          htmlFor="create-pass"
          className="block text-xs font-medium text-[#3B5950] mb-1.5"
        >
          Password (min. 4 characters)
        </label>
        <div className="relative">
          <KeyRound className="w-4 h-4 text-[#5C7A70] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            id="create-pass"
            type="password"
            required
            minLength={4}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Create your passkey"
            className="w-full pl-10 pr-4 py-2.5 text-sm bg-[#F8FBFA] border border-[#C9DBD4] rounded-lg text-[#0F2922] focus:outline-none focus:ring-2 focus:ring-[#0369A1]"
          />
        </div>
      </div>

      <div>
        <span className="block text-xs font-medium text-[#3B5950] mb-2">
          Starting Mission Landscape
        </span>
        <div className="grid grid-cols-2 gap-2">
          {Object.values(MISSION_LANDSCAPES).map((m) => {
            const active = newMissionId === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setNewMissionId(m.id)}
                className={`text-left p-2.5 rounded-lg border transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#EBF3FA] border-[#0369A1] text-[#0F2922]'
                    : 'bg-[#F8FBFA] border-[#D5E3DD] text-[#4A685F] hover:border-[#0369A1]/50'
                }`}
              >
                <div className="text-xs font-semibold truncate">{m.shortName}</div>
                <div className="text-[11px] font-mono opacity-80 truncate">
                  {m.gravity}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {createError && (
        <div
          role="alert"
          className="p-3 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#991B1B]"
        >
          {createError}
        </div>
      )}

      <button
        type="submit"
        disabled={createLoading}
        className="w-full py-2.5 px-4 bg-[#15803D] hover:bg-[#166534] disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
      >
        <span>{createLoading ? 'Creating Account...' : submitLabel}</span>
        <ArrowRight className="w-4 h-4" />
      </button>
    </form>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {!currentCrew ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <section className="lg:col-span-6 bg-white border border-[#D5E3DD] rounded-2xl p-6 sm:p-8 space-y-5">
            <div>
              <div className="text-xs font-mono text-[#15803D]">
                First-Time Crew Onboarding
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-[#0F2922] tracking-tight mt-1">
                Create Your Astronaut Account
              </h1>
              <p className="text-sm text-[#3B5950] mt-1.5 leading-relaxed">
                Set up your profile with your Name, Astronaut ID, Password, and an optional photo to start tracking your habits, mental health, and living garden.
              </p>
            </div>

            {renderCreateFormFields('Create Account & Enter Home')}
          </section>

          <section className="lg:col-span-6 bg-white border border-[#D5E3DD] rounded-2xl p-6 sm:p-8 space-y-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-xs font-mono text-[#0369A1]">
                  Shared Habitat Directory
                </div>
                <h2 className="text-xl font-bold text-[#0F2922] mt-0.5">
                  Existing Crew Accounts ({accounts.length})
                </h2>
              </div>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={onOpenNasaResources}
                  className="px-3.5 py-2 text-xs font-semibold text-[#0F2922] bg-[#FEFCE8] hover:bg-[#FEF08A] border border-[#EAB308]/60 rounded-lg inline-flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
                >
                  <BookOpen className="w-3.5 h-3.5 text-[#A16207]" />
                  <span>NASA Resources</span>
                </button>
                <Users className="w-5 h-5 text-[#0369A1] shrink-0" />
              </div>
            </div>
            <p className="text-sm text-[#3B5950]">
              Already have an account on this station? Select your profile below to sign in with your password.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {accounts.map((acc) => {
                const mission = MISSION_LANDSCAPES[acc.missionId];
                return (
                  <div
                    key={acc.crewId}
                    className="p-4 rounded-xl bg-[#F8FBFA] border border-[#D5E3DD] flex flex-col justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <AvatarBadge name={acc.crewName} avatarUrl={acc.avatarUrl} />
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-[#0F2922] truncate">
                          {acc.crewName}
                        </div>
                        <div className="text-xs font-mono text-[#0369A1] truncate">
                          {acc.crewId}
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-[#4A685F] flex items-center justify-between gap-2 pt-2 border-t border-[#E4EDE9]">
                      <span className="truncate">{mission.shortName}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setSwitchTarget(acc);
                          setSwitchPassword('');
                          setSwitchError(null);
                        }}
                        className="px-3 py-1.5 text-xs font-semibold text-white bg-[#0369A1] hover:bg-[#075985] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Sign In
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      ) : (
        <>
          {/* Active Crew Profile Card */}
          <section className="bg-white border border-[#D5E3DD] rounded-2xl p-6 sm:p-7 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="flex items-center gap-4 sm:gap-5">
              <AvatarBadge
                name={currentCrew.crewName}
                avatarUrl={currentCrew.avatarUrl}
                sizeClass="w-16 h-16 sm:w-20 sm:h-20 text-xl"
              />
              <div className="space-y-1">
                <div className="text-xs font-mono text-[#15803D]">
                  Active Signed-In Account · {currentCrew.crewId} · Sol{' '}
                  {currentCrew.missionSol}
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold text-[#0F2922] tracking-tight">
                  {currentCrew.crewName}
                </h1>
                <div className="text-sm text-[#3B5950]">
                  {MISSION_LANDSCAPES[currentCrew.missionId].name} ·{' '}
                  <span className="font-mono">
                    {currentCrew.habits.filter((h) => h.completedToday).length}/
                    {currentCrew.habits.length}
                  </span>{' '}
                  habits complete today
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={onGoToTasks}
                className="px-4 py-2.5 text-xs font-semibold text-white bg-[#0369A1] hover:bg-[#075985] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              >
                Open Daily Tasks
              </button>
              <button
                type="button"
                onClick={onGoToLandscape}
                className="px-4 py-2.5 text-xs font-semibold text-[#14532D] bg-[#EFF6F2] hover:bg-[#DCFCE7] border border-[#86EFAC] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              >
                View Garden
              </button>
              <button
                type="button"
                onClick={onOpenNasaResources}
                className="px-4 py-2.5 text-xs font-semibold text-[#0F2922] bg-[#FEFCE8] hover:bg-[#FEF08A] border border-[#EAB308]/60 rounded-lg inline-flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
              >
                <BookOpen className="w-4 h-4 text-[#A16207]" />
                <span>NASA Resources</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  resetCreateForm();
                  setShowCreateModal(true);
                }}
                className="px-4 py-2.5 text-xs font-semibold text-[#0F2922] bg-[#FEFCE8] hover:bg-[#FEF08A] border border-[#EAB308]/60 rounded-lg inline-flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
              >
                <Plus className="w-4 h-4 text-[#A16207]" />
                <span>Create Another Account</span>
              </button>
              <button
                type="button"
                onClick={onSignOut}
                className="px-3.5 py-2.5 text-xs font-semibold text-[#4A685F] hover:text-[#991B1B] bg-white border border-[#D5E3DD] hover:border-[#FECACA] rounded-lg inline-flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </section>

          {/* All Registered Crew Accounts Directory */}
          <section className="bg-white border border-[#D5E3DD] rounded-2xl p-6 sm:p-7 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-[#E4EDE9]">
              <div>
                <h2 className="text-xl font-bold text-[#0F2922]">
                  All Crew Accounts ({accounts.length})
                </h2>
                <p className="text-sm text-[#3B5950] mt-0.5">
                  Multiple astronauts can keep separate habit logs, watch telemetry, and gardens on this station.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  resetCreateForm();
                  setShowCreateModal(true);
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#15803D] hover:bg-[#166534] rounded-lg inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add New User Account</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {accounts.map((acc) => {
                const isActive = acc.crewId === currentCrew.crewId;
                const mission = MISSION_LANDSCAPES[acc.missionId];
                return (
                  <article
                    key={acc.crewId}
                    className={`p-5 rounded-xl border flex flex-col justify-between gap-4 ${
                      isActive
                        ? 'bg-[#EFF6F2] border-[#15803D]'
                        : 'bg-[#F8FBFA] border-[#D5E3DD]'
                    }`}
                  >
                    <div className="flex items-center gap-3.5">
                      <AvatarBadge
                        name={acc.crewName}
                        avatarUrl={acc.avatarUrl}
                        sizeClass="w-12 h-12 text-sm"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="text-base font-bold text-[#0F2922] truncate">
                            {acc.crewName}
                          </h3>
                        </div>
                        <div className="text-xs font-mono text-[#0369A1] truncate">
                          ID: {acc.crewId} · Sol {acc.missionSol}
                        </div>
                        <div className="text-xs text-[#4A685F] truncate mt-0.5">
                          {mission.name}
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-[#DCE8E3] flex items-center justify-between gap-3">
                      {isActive ? (
                        <span className="text-xs font-semibold text-[#15803D]">
                          Currently Active
                        </span>
                      ) : (
                        <span className="text-xs text-[#4A685F]">
                          Ready to switch
                        </span>
                      )}

                      {isActive ? (
                        <button
                          type="button"
                          onClick={onGoToTasks}
                          className="px-3 py-1.5 text-xs font-semibold text-[#15803D] bg-white border border-[#86EFAC] hover:bg-[#DCFCE7] rounded-lg transition-colors cursor-pointer"
                        >
                          Open Tasks
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setSwitchTarget(acc);
                            setSwitchPassword('');
                            setSwitchError(null);
                          }}
                          className="px-3 py-1.5 text-xs font-semibold text-white bg-[#0369A1] hover:bg-[#075985] rounded-lg transition-colors cursor-pointer"
                        >
                          Switch User
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </>
      )}

      {/* Create Another Account Modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-40 bg-[#0F2922]/35 backdrop-blur-[2px] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-account-modal-title"
        >
          <div className="bg-white border border-[#D5E3DD] rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between gap-4 pb-3 border-b border-[#E4EDE9]">
              <div>
                <h2
                  id="create-account-modal-title"
                  className="text-lg font-bold text-[#0F2922]"
                >
                  Create Another Crew Account
                </h2>
                <p className="text-xs text-[#4A685F]">
                  Enter Name, Astronaut ID, Password, and optional profile image.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                aria-label="Close modal"
                className="p-1.5 rounded-lg text-[#4A685F] hover:bg-[#EFF6F2] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {renderCreateFormFields('Create & Switch to Account')}
          </div>
        </div>
      )}

      {/* Password Modal for Switching / Signing into an Existing Account */}
      {switchTarget && (
        <div
          className="fixed inset-0 z-40 bg-[#0F2922]/35 backdrop-blur-[2px] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="switch-account-title"
        >
          <form
            onSubmit={handleSwitchSignIn}
            className="bg-white border border-[#D5E3DD] rounded-2xl w-full max-w-md p-6 space-y-4 shadow-xl"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <AvatarBadge
                  name={switchTarget.crewName}
                  avatarUrl={switchTarget.avatarUrl}
                />
                <div>
                  <h2
                    id="switch-account-title"
                    className="text-base font-bold text-[#0F2922]"
                  >
                    Sign in as {switchTarget.crewName}
                  </h2>
                  <div className="text-xs font-mono text-[#0369A1]">
                    ID: {switchTarget.crewId}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSwitchTarget(null)}
                aria-label="Close sign in dialog"
                className="p-1.5 rounded-lg text-[#4A685F] hover:bg-[#EFF6F2] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label
                htmlFor="switch-password"
                className="block text-xs font-medium text-[#3B5950] mb-1.5"
              >
                Enter Password
              </label>
              <input
                id="switch-password"
                type="password"
                required
                autoFocus
                value={switchPassword}
                onChange={(e) => setSwitchPassword(e.target.value)}
                placeholder="Account password"
                className="w-full px-3.5 py-2.5 text-sm bg-[#F8FBFA] border border-[#C9DBD4] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0369A1]"
              />
            </div>

            {switchError && (
              <div
                role="alert"
                className="p-3 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#991B1B]"
              >
                {switchError}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setSwitchTarget(null)}
                className="px-4 py-2 text-xs font-semibold text-[#3B5950] bg-white border border-[#D5E3DD] rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={switchLoading}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#0369A1] hover:bg-[#075985] disabled:opacity-60 rounded-lg cursor-pointer"
              >
                {switchLoading ? 'Verifying...' : 'Sign In'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
