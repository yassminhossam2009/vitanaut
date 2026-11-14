import React, { useEffect, useRef, useState } from 'react';
import {
  BotMessageSquare,
  ChevronDown,
  ClipboardCheck,
  History,
  Home,
  MapPin,
  Trees,
  Watch,
} from 'lucide-react';
import { MissionId, PageId } from '../types.ts';
import { MISSION_LANDSCAPES } from '../data/missionLandscapes.ts';

export type NavTabId = 'home' | PageId;

interface TopNavProps {
  activeTab: NavTabId;
  onSelectTab: (tab: NavTabId) => void;
  missionId?: MissionId;
  onChangeMission?: (missionId: MissionId) => void;
}

const RIBBON_ITEMS: Array<{
  id: NavTabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'tasks', label: 'Tasks', icon: ClipboardCheck },
  { id: 'assistant', label: 'Assistant', icon: BotMessageSquare },
  { id: 'landscape', label: 'Landscape', icon: Trees },
  { id: 'watch', label: 'Watch', icon: Watch },
  { id: 'history', label: 'History', icon: History },
];

export const TopNav: React.FC<TopNavProps> = ({
  activeTab,
  onSelectTab,
  missionId,
  onChangeMission,
}) => {
  const [missionOpen, setMissionOpen] = useState(false);
  const missionRef = useRef<HTMLDivElement>(null);
  const mission = missionId ? MISSION_LANDSCAPES[missionId] : null;

  useEffect(() => {
    if (!missionOpen) return;
    const closeOnOutside = (event: MouseEvent) => {
      if (!missionRef.current?.contains(event.target as Node)) setMissionOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutside);
    return () => document.removeEventListener('mousedown', closeOnOutside);
  }, [missionOpen]);

  return (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-[#D5E3DD]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 sm:gap-6">
        <button
          type="button"
          onClick={() => onSelectTab('home')}
          className="text-lg font-bold tracking-tight text-[#0F2922] whitespace-nowrap shrink-0 cursor-pointer"
        >
          Vitanaut
        </button>

        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {mission && onChangeMission && (
            <div className="relative shrink-0" ref={missionRef}>
              <button
                type="button"
                onClick={() => setMissionOpen((open) => !open)}
                aria-expanded={missionOpen}
                aria-label={`Change mission location. Current location: ${mission.name}`}
                className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-semibold bg-[#EFF6F2] text-[#2D473E] border border-[#C9DBD4] hover:border-[#0369A1]/60 cursor-pointer select-none"
              >
                <MapPin className="w-3.5 h-3.5 text-[#0369A1]" />
                <span className="hidden sm:inline text-[#4A685F]">Location</span>
                <span className="whitespace-nowrap">{mission.shortName}</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-[#4A685F] transition-transform ${
                    missionOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {missionOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-xl border border-[#D5E3DD] bg-white shadow-lg p-1.5 z-50">
                  <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide text-[#4A685F]">
                    Mission location
                  </div>
                  {Object.values(MISSION_LANDSCAPES).map((item) => {
                    const active = item.id === missionId;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          onChangeMission(item.id);
                          setMissionOpen(false);
                        }}
                        className={`w-full text-left px-2.5 py-2 rounded-lg transition-colors cursor-pointer ${
                          active
                            ? 'bg-[#E0F2FE] text-[#0369A1]'
                            : 'text-[#2D473E] hover:bg-[#F6FAF8]'
                        }`}
                      >
                        <span className="block text-xs font-semibold">{item.shortName}</span>
                        <span className="block text-[10px] text-[#4A685F] mt-0.5">
                          {item.gravity} · {item.daylightCycle}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <nav
            aria-label="Page navigation ribbon"
            className="flex items-center gap-1.5 overflow-x-auto py-1"
          >
            {RIBBON_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectTab(item.id)}
                  title={item.label}
                  aria-current={isActive ? 'page' : undefined}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer border ${
                    isActive
                      ? 'bg-[#0369A1] text-white border-[#0369A1]'
                      : 'bg-[#F6FAF8] text-[#2D473E] border-[#D5E3DD] hover:bg-[#EFF6F2] hover:border-[#0369A1]/50'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
};
