import React from 'react';
import {
  BotMessageSquare,
  ClipboardCheck,
  History,
  Home,
  Trees,
  Watch,
} from 'lucide-react';
import { PageId } from '../types.ts';

export type NavTabId = 'home' | PageId;

interface TopNavProps {
  activeTab: NavTabId;
  onSelectTab: (tab: NavTabId) => void;
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
}) => {
  return (
    <header className="sticky top-0 z-30 bg-white border-b border-[#D5E3DD]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-4 sm:gap-8">
        <button
          type="button"
          onClick={() => onSelectTab('home')}
          className="text-lg font-bold tracking-tight text-[#0F2922] whitespace-nowrap shrink-0 cursor-pointer"
        >
          Vitanaut
        </button>

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
    </header>
  );
};
