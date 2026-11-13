import React, { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { CATEGORY_META, GARDEN_ELEMENT_META } from '../data/nasaResources.ts';
import { MISSION_LANDSCAPES } from '../data/missionLandscapes.ts';
import { CompletedLog, CrewState, HabitCategory, MissionId } from '../types.ts';

interface HistoryPageProps {
  crewState: CrewState;
}

type ChartViewMode = 'progression' | 'timeline' | 'daily';

const CATEGORY_CHART_COLORS: Record<
  HabitCategory,
  { hex: string; softHex: string; borderHex: string; label: string }
> = {
  [HabitCategory.MUSCLE_BONE]: {
    hex: '#0369A1',
    softHex: '#E0F2FE',
    borderHex: '#7DD3FC',
    label: 'Muscle & Bone',
  },
  [HabitCategory.CARDIO]: {
    hex: '#16A34A',
    softHex: '#DCFCE7',
    borderHex: '#86EFAC',
    label: 'Cardio',
  },
  [HabitCategory.MENTAL_HEALTH]: {
    hex: '#7C3AED',
    softHex: '#EDE9FE',
    borderHex: '#C4B5FD',
    label: 'Mental Health',
  },
  [HabitCategory.SLEEP_CIRCADIAN]: {
    hex: '#EAB308',
    softHex: '#FEF9C3',
    borderHex: '#FDE047',
    label: 'Sleep & Circadian',
  },
  [HabitCategory.NUTRITION]: {
    hex: '#0D9488',
    softHex: '#CCFBF1',
    borderHex: '#5EEAD4',
    label: 'Nutrition',
  },
};

const ALL_CATEGORIES = Object.values(HabitCategory);

export const HistoryPage: React.FC<HistoryPageProps> = ({ crewState }) => {
  const [categoryFilter, setCategoryFilter] = useState<'all' | HabitCategory>('all');
  const [missionFilter, setMissionFilter] = useState<'all' | MissionId>('all');
  const [chartMode, setChartMode] = useState<ChartViewMode>('progression');
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [hoveredSlice, setHoveredSlice] = useState<HabitCategory | null>(null);

  const chronologicalLogs = useMemo(() => {
    return [...crewState.history]
      .filter((item) => {
        if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
        if (missionFilter !== 'all' && item.missionId !== missionFilter) return false;
        return true;
      })
      .sort(
        (a, b) =>
          new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime()
      );
  }, [crewState.history, categoryFilter, missionFilter]);

  const categoryStats = useMemo(() => {
    const counts: Record<HabitCategory, { count: number; minutes: number }> = {
      [HabitCategory.MUSCLE_BONE]: { count: 0, minutes: 0 },
      [HabitCategory.CARDIO]: { count: 0, minutes: 0 },
      [HabitCategory.MENTAL_HEALTH]: { count: 0, minutes: 0 },
      [HabitCategory.SLEEP_CIRCADIAN]: { count: 0, minutes: 0 },
      [HabitCategory.NUTRITION]: { count: 0, minutes: 0 },
    };

    for (const log of chronologicalLogs) {
      counts[log.category].count += 1;
      counts[log.category].minutes += log.durationMinutes;
    }

    return ALL_CATEGORIES.map((cat) => ({
      category: cat,
      count: counts[cat].count,
      minutes: counts[cat].minutes,
      color: CATEGORY_CHART_COLORS[cat],
      meta: CATEGORY_META[cat],
    }));
  }, [chronologicalLogs]);

  const totalCompleted = chronologicalLogs.length;
  const totalMinutes = useMemo(
    () => chronologicalLogs.reduce((acc, log) => acc + log.durationMinutes, 0),
    [chronologicalLogs]
  );

  const avgMoodDelta = useMemo(() => {
    if (chronologicalLogs.length === 0) return '+0.0';
    const sum = chronologicalLogs.reduce(
      (acc, log) => acc + (log.moodAfter - log.moodBefore),
      0
    );
    const avg = sum / chronologicalLogs.length;
    return `${avg >= 0 ? '+' : ''}${avg.toFixed(1)}`;
  }, [chronologicalLogs]);

  // Cumulative progression series (updates every time a task is completed or undone)
  const progressionData = useMemo(() => {
    const running: Record<HabitCategory, number> = {
      [HabitCategory.MUSCLE_BONE]: 0,
      [HabitCategory.CARDIO]: 0,
      [HabitCategory.MENTAL_HEALTH]: 0,
      [HabitCategory.SLEEP_CIRCADIAN]: 0,
      [HabitCategory.NUTRITION]: 0,
    };

    return chronologicalLogs.map((log, index) => {
      running[log.category] += 1;
      return {
        index,
        log,
        totalSoFar: index + 1,
        byCategory: { ...running },
      };
    });
  }, [chronologicalLogs]);

  // Daily stacked bar series
  const dailyData = useMemo(() => {
    const map = new Map<
      string,
      {
        dayKey: string;
        label: string;
        total: number;
        counts: Record<HabitCategory, number>;
        logs: CompletedLog[];
      }
    >();

    for (const log of chronologicalLogs) {
      const d = new Date(log.completedAt);
      const dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
        2,
        '0'
      )}-${String(d.getDate()).padStart(2, '0')}`;
      const label = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
      let bucket = map.get(dayKey);
      if (!bucket) {
        bucket = {
          dayKey,
          label,
          total: 0,
          counts: {
            [HabitCategory.MUSCLE_BONE]: 0,
            [HabitCategory.CARDIO]: 0,
            [HabitCategory.MENTAL_HEALTH]: 0,
            [HabitCategory.SLEEP_CIRCADIAN]: 0,
            [HabitCategory.NUTRITION]: 0,
          },
          logs: [],
        };
        map.set(dayKey, bucket);
      }
      bucket.counts[log.category] += 1;
      bucket.total += 1;
      bucket.logs.push(log);
    }

    return Array.from(map.values());
  }, [chronologicalLogs]);

  const exportCsv = () => {
    const header = [
      'Completed At',
      'Task Title',
      'Category',
      'Mission',
      'Duration (min)',
      'Mood Before',
      'Mood After',
      'Garden Element',
      'Notes',
    ].join(',');
    const rows = chronologicalLogs.map((log) =>
      [
        `"${log.completedAt}"`,
        `"${log.title.replace(/"/g, '""')}"`,
        `"${CATEGORY_META[log.category].label}"`,
        `"${MISSION_LANDSCAPES[log.missionId].shortName}"`,
        log.durationMinutes,
        log.moodBefore,
        log.moodAfter,
        `"${GARDEN_ELEMENT_META[log.gardenElement].name}"`,
        `"${(log.notes ?? '').replace(/"/g, '""')}"`,
      ].join(',')
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vitanaut-history-${crewState.crewId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Chart geometry constants
  const chartW = 820;
  const chartH = 300;
  const padL = 48;
  const padR = 24;
  const padT = 26;
  const padB = 42;
  const innerW = chartW - padL - padR;
  const innerH = chartH - padT - padB;

  const maxCategoryCum = Math.max(
    1,
    ...progressionData.flatMap((d) => ALL_CATEGORIES.map((c) => d.byCategory[c]))
  );
  const maxDuration = Math.max(
    15,
    ...chronologicalLogs.map((l) => l.durationMinutes)
  );
  const maxDailyTotal = Math.max(1, ...dailyData.map((d) => d.total));

  const visibleCategories =
    categoryFilter === 'all' ? ALL_CATEGORIES : [categoryFilter];

  const getStepX = (idx: number, count: number) => {
    if (count <= 1) return padL + innerW / 2;
    return padL + (idx / (count - 1)) * innerW;
  };

  const getValY = (val: number, maxVal: number) => {
    return padT + innerH - (val / Math.max(1, maxVal)) * innerH;
  };

  // Donut chart geometry
  const donutSize = 210;
  const donutCenter = donutSize / 2;
  const donutRadius = 76;
  const donutCircumference = 2 * Math.PI * donutRadius;

  const donutSegments = useMemo(() => {
    if (totalCompleted === 0) return [];
    let accumulated = 0;
    return categoryStats
      .filter((s) => s.count > 0)
      .map((s) => {
        const fraction = s.count / totalCompleted;
        const dashLength = fraction * donutCircumference;
        const dashOffset = -accumulated * donutCircumference;
        accumulated += fraction;
        return {
          ...s,
          fraction,
          dashLength,
          dashOffset,
        };
      });
  }, [categoryStats, totalCompleted, donutCircumference]);

  const maxCategoryCount = Math.max(1, ...categoryStats.map((s) => s.count));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Header */}
      <div className="bg-white border border-[#D5E3DD] rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="text-xs font-mono text-[#0369A1]">
            Mission History Charts · {crewState.crewId} · Sol {crewState.missionSol}
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#0F2922] tracking-tight mt-1">
            Task Completion &amp; Growth Analytics
          </h1>
          <p className="text-sm text-[#3B5950] mt-1">
            Interactive charts update automatically each time you complete or undo a task, color-coded by health category.
          </p>
        </div>

        <button
          type="button"
          onClick={exportCsv}
          className="px-4 py-2 text-xs font-semibold text-[#0F2922] bg-[#EFF6F2] hover:bg-[#E2EFE8] border border-[#CBE0D6] rounded-lg inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Download className="w-4 h-4 text-[#15803D]" />
          <span>Download CSV</span>
        </button>
      </div>

      {/* Top KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 bg-white border border-[#D5E3DD] rounded-xl">
          <div className="text-xs text-[#4A685F]">Completed Tasks Plotted</div>
          <div className="text-3xl font-mono font-bold tabular-nums text-[#0F2922] mt-1">
            {totalCompleted}
          </div>
        </div>
        <div className="p-5 bg-[#EBF3FA] border border-[#CBE0EE] rounded-xl">
          <div className="text-xs text-[#075985]">Average Mood Shift</div>
          <div className="text-3xl font-mono font-bold tabular-nums text-[#0369A1] mt-1">
            {avgMoodDelta}
            <span className="text-xs text-[#4A685F] ml-1.5">pts / task</span>
          </div>
        </div>
        <div className="p-5 bg-[#FEFCE8] border border-[#FDE047] rounded-xl">
          <div className="text-xs text-[#713F12]">Total Active Time</div>
          <div className="text-3xl font-mono font-bold tabular-nums text-[#0F2922] mt-1">
            {totalMinutes}
            <span className="text-xs text-[#A16207] ml-1.5">min</span>
          </div>
        </div>
      </div>

      {/* Category Color Legend + Filters */}
      <div className="bg-white border border-[#D5E3DD] rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Interactive Category Color Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setCategoryFilter('all');
                setHoveredIdx(null);
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap cursor-pointer ${
                categoryFilter === 'all'
                  ? 'bg-[#0F2922] text-white border-[#0F2922]'
                  : 'bg-[#F8FBFA] text-[#3B5950] border-[#D5E3DD] hover:text-[#0F2922]'
              }`}
            >
              All Categories ({crewState.history.length})
            </button>

            {ALL_CATEGORIES.map((cat) => {
              const color = CATEGORY_CHART_COLORS[cat];
              const active = categoryFilter === cat;
              const catCount = crewState.history.filter(
                (h) => h.category === cat
              ).length;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    setCategoryFilter(active ? 'all' : cat);
                    setHoveredIdx(null);
                  }}
                  style={
                    active
                      ? {
                          backgroundColor: color.hex,
                          borderColor: color.hex,
                          color: '#FFFFFF',
                        }
                      : {
                          backgroundColor: color.softHex,
                          borderColor: color.borderHex,
                          color: '#0F2922',
                        }
                  }
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg border inline-flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-xs shrink-0"
                    style={{
                      backgroundColor: active ? '#FFFFFF' : color.hex,
                    }}
                  />
                  <span>{color.label}</span>
                  <span className="font-mono opacity-80">({catCount})</span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <select
              value={missionFilter}
              onChange={(e) => {
                setMissionFilter(e.target.value as 'all' | MissionId);
                setHoveredIdx(null);
              }}
              aria-label="Filter by mission"
              className="px-3 py-1.5 text-xs font-medium bg-[#F8FBFA] border border-[#C9DBD4] rounded-lg text-[#0F2922]"
            >
              <option value="all">All Landscapes</option>
              {Object.values(MISSION_LANDSCAPES).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.shortName}
                </option>
              ))}
            </select>

            <div className="inline-flex rounded-lg border border-[#D5E3DD] bg-[#F8FBFA] p-0.5">
              {(
                [
                  { id: 'progression', label: 'Growth Curve' },
                  { id: 'timeline', label: 'Task Bars' },
                  { id: 'daily', label: 'Daily Stack' },
                ] as { id: ChartViewMode; label: string }[]
              ).map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => {
                    setChartMode(mode.id);
                    setHoveredIdx(null);
                  }}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                    chartMode === mode.id
                      ? 'bg-[#0369A1] text-white'
                      : 'text-[#4A685F] hover:text-[#0F2922]'
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {chronologicalLogs.length === 0 ? (
        <div className="bg-white border border-[#D5E3DD] rounded-2xl p-12 text-center space-y-3">
          <div className="text-base font-semibold text-[#0F2922]">
            No completed tasks to chart yet
          </div>
          <p className="text-sm text-[#4A685F] max-w-md mx-auto">
            Complete any habit on the Tasks page—or reset your active filters—to see your live color-coded charts update immediately.
          </p>
          {(categoryFilter !== 'all' || missionFilter !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setCategoryFilter('all');
                setMissionFilter('all');
              }}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#0369A1] hover:bg-[#075985] rounded-lg cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Primary Dynamic Chart */}
          <section className="bg-white border border-[#D5E3DD] rounded-2xl p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-[#0F2922]">
                  {chartMode === 'progression' &&
                    'Cumulative Category Growth (Updates Per Completed Task)'}
                  {chartMode === 'timeline' &&
                    'Completed Task Timeline (Duration & Category Color)'}
                  {chartMode === 'daily' &&
                    'Daily Completed Tasks Stacked by Category'}
                </h2>
                <p className="text-xs text-[#4A685F]">
                  Hover over any point or bar to inspect the exact completed task.
                </p>
              </div>
              <div className="text-xs font-mono text-[#4A685F]">
                {chronologicalLogs.length} event
                {chronologicalLogs.length === 1 ? '' : 's'} shown
              </div>
            </div>

            <div className="relative w-full overflow-x-auto">
              <svg
                viewBox={`0 0 ${chartW} ${chartH}`}
                className="w-full min-w-[560px] h-auto select-none"
                role="img"
                aria-label="Interactive history completion chart"
              >
                {/* Horizontal grid lines */}
                {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                  const y = padT + innerH * (1 - ratio);
                  const maxForAxis =
                    chartMode === 'progression'
                      ? maxCategoryCum
                      : chartMode === 'timeline'
                        ? maxDuration
                        : maxDailyTotal;
                  const labelVal = Math.round(maxForAxis * ratio);
                  return (
                    <g key={ratio}>
                      <line
                        x1={padL}
                        y1={y}
                        x2={chartW - padR}
                        y2={y}
                        stroke="#E4EDE9"
                        strokeDasharray={ratio === 0 ? undefined : '4 4'}
                      />
                      <text
                        x={padL - 8}
                        y={y + 4}
                        textAnchor="end"
                        className="fill-[#5C7A70] text-[10px] font-mono"
                      >
                        {chartMode === 'timeline' ? `${labelVal}m` : labelVal}
                      </text>
                    </g>
                  );
                })}

                {/* MODE 1: CUMULATIVE PROGRESSION LINES */}
                {chartMode === 'progression' && (
                  <>
                    {visibleCategories.map((cat) => {
                      const color = CATEGORY_CHART_COLORS[cat].hex;
                      const points = progressionData.map((d, i) => ({
                        x: getStepX(i, progressionData.length),
                        y: getValY(d.byCategory[cat], maxCategoryCum),
                      }));

                      const pathD = points
                        .map(
                          (pt, i) =>
                            `${i === 0 ? 'M' : 'L'}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`
                        )
                        .join(' ');

                      const areaD =
                        points.length > 0
                          ? `${pathD} L${points[points.length - 1].x.toFixed(1)},${(
                              padT + innerH
                            ).toFixed(1)} L${points[0].x.toFixed(1)},${(
                              padT + innerH
                            ).toFixed(1)} Z`
                          : '';

                      return (
                        <g key={cat}>
                          {points.length > 1 && (
                            <path d={areaD} fill={color} fillOpacity={0.07} />
                          )}
                          {points.length > 1 && (
                            <path
                              d={pathD}
                              fill="none"
                              stroke={color}
                              strokeWidth={2.75}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          )}
                        </g>
                      );
                    })}

                    {progressionData.map((d, idx) => {
                      const x = getStepX(idx, progressionData.length);
                      const activeCat = d.log.category;
                      const y = getValY(d.byCategory[activeCat], maxCategoryCum);
                      const color = CATEGORY_CHART_COLORS[activeCat].hex;
                      const isHovered = hoveredIdx === idx;
                      const timeLabel = new Date(
                        d.log.completedAt
                      ).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      });

                      return (
                        <g
                          key={d.log.id}
                          className="cursor-pointer"
                          onMouseEnter={() => setHoveredIdx(idx)}
                          onMouseLeave={() => setHoveredIdx(null)}
                        >
                          {isHovered && (
                            <line
                              x1={x}
                              y1={padT}
                              x2={x}
                              y2={padT + innerH}
                              stroke="#94B5A9"
                              strokeDasharray="3 3"
                            />
                          )}
                          <circle
                            cx={x}
                            cy={y}
                            r={isHovered ? 7.5 : 5.5}
                            fill={color}
                            stroke="#FFFFFF"
                            strokeWidth={2}
                          />
                          {(progressionData.length <= 10 ||
                            idx === 0 ||
                            idx === progressionData.length - 1 ||
                            idx % Math.ceil(progressionData.length / 7) === 0) && (
                            <text
                              x={x}
                              y={chartH - 14}
                              textAnchor="middle"
                              className="fill-[#5C7A70] text-[10px] font-mono"
                            >
                              #{idx + 1} · {timeLabel}
                            </text>
                          )}
                          <rect
                            x={x - 16}
                            y={padT}
                            width={32}
                            height={innerH}
                            fill="transparent"
                          />
                        </g>
                      );
                    })}
                  </>
                )}

                {/* MODE 2: TASK DURATION TIMELINE BARS */}
                {chartMode === 'timeline' &&
                  chronologicalLogs.map((log, idx) => {
                    const count = chronologicalLogs.length;
                    const slotW = innerW / Math.max(1, count);
                    const barW = Math.min(48, Math.max(12, slotW * 0.62));
                    const x =
                      count === 1
                        ? padL + innerW / 2 - barW / 2
                        : padL + idx * slotW + (slotW - barW) / 2;
                    const barH = Math.max(
                      6,
                      (log.durationMinutes / maxDuration) * innerH
                    );
                    const y = padT + innerH - barH;
                    const color = CATEGORY_CHART_COLORS[log.category].hex;
                    const isHovered = hoveredIdx === idx;
                    const shortTime = new Date(
                      log.completedAt
                    ).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    });

                    return (
                      <g
                        key={log.id}
                        className="cursor-pointer"
                        onMouseEnter={() => setHoveredIdx(idx)}
                        onMouseLeave={() => setHoveredIdx(null)}
                      >
                        <rect
                          x={x}
                          y={y}
                          width={barW}
                          height={barH}
                          rx={5}
                          fill={color}
                          fillOpacity={isHovered ? 1 : 0.86}
                          stroke={isHovered ? '#0F2922' : 'none'}
                          strokeWidth={1.5}
                        />
                        <text
                          x={x + barW / 2}
                          y={y - 6}
                          textAnchor="middle"
                          className="fill-[#0F2922] text-[10px] font-mono font-semibold"
                        >
                          {log.durationMinutes}m
                        </text>
                        {(count <= 10 ||
                          idx % Math.ceil(count / 7) === 0 ||
                          idx === count - 1) && (
                          <text
                            x={x + barW / 2}
                            y={chartH - 14}
                            textAnchor="middle"
                            className="fill-[#5C7A70] text-[10px] font-mono"
                          >
                            {shortTime}
                          </text>
                        )}
                      </g>
                    );
                  })}

                {/* MODE 3: DAILY STACKED BARS BY CATEGORY */}
                {chartMode === 'daily' &&
                  dailyData.map((day, idx) => {
                    const slotW = innerW / Math.max(1, dailyData.length);
                    const barW = Math.min(64, Math.max(20, slotW * 0.55));
                    const x =
                      dailyData.length === 1
                        ? padL + innerW / 2 - barW / 2
                        : padL + idx * slotW + (slotW - barW) / 2;
                    let currentBottom = padT + innerH;
                    const isHovered = hoveredIdx === idx;

                    return (
                      <g
                        key={day.dayKey}
                        className="cursor-pointer"
                        onMouseEnter={() => setHoveredIdx(idx)}
                        onMouseLeave={() => setHoveredIdx(null)}
                      >
                        {ALL_CATEGORIES.map((cat) => {
                          const val = day.counts[cat];
                          if (val === 0) return null;
                          const segH = (val / maxDailyTotal) * innerH;
                          const segY = currentBottom - segH;
                          currentBottom = segY;
                          return (
                            <rect
                              key={cat}
                              x={x}
                              y={segY}
                              width={barW}
                              height={Math.max(2, segH)}
                              fill={CATEGORY_CHART_COLORS[cat].hex}
                              fillOpacity={isHovered ? 1 : 0.9}
                              stroke="#FFFFFF"
                              strokeWidth={1}
                            />
                          );
                        })}
                        <text
                          x={x + barW / 2}
                          y={currentBottom - 6}
                          textAnchor="middle"
                          className="fill-[#0F2922] text-[10px] font-mono font-bold"
                        >
                          {day.total}
                        </text>
                        <text
                          x={x + barW / 2}
                          y={chartH - 14}
                          textAnchor="middle"
                          className="fill-[#5C7A70] text-[10px] font-mono"
                        >
                          {day.label}
                        </text>
                      </g>
                    );
                  })}
              </svg>

              {/* Interactive Hover Inspection Box */}
              {hoveredIdx !== null && (
                <div className="mt-3 p-3.5 rounded-xl bg-[#F6FAF8] border border-[#CBE0D6] flex flex-wrap items-center justify-between gap-3 text-xs">
                  {chartMode === 'daily' && dailyData[hoveredIdx] ? (
                    <>
                      <div className="space-y-0.5">
                        <div className="font-bold text-[#0F2922]">
                          {dailyData[hoveredIdx].label} ·{' '}
                          {dailyData[hoveredIdx].total} task
                          {dailyData[hoveredIdx].total === 1 ? '' : 's'} completed
                        </div>
                        <div className="text-[#4A685F] flex flex-wrap gap-x-3 gap-y-1">
                          {ALL_CATEGORIES.filter(
                            (c) => dailyData[hoveredIdx].counts[c] > 0
                          ).map((c) => (
                            <span
                              key={c}
                              className="inline-flex items-center gap-1.5 font-medium text-[#0F2922]"
                            >
                              <span
                                className="w-2 h-2 rounded-xs"
                                style={{
                                  backgroundColor: CATEGORY_CHART_COLORS[c].hex,
                                }}
                              />
                              {CATEGORY_CHART_COLORS[c].label}:{' '}
                              {dailyData[hoveredIdx].counts[c]}
                            </span>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : chronologicalLogs[hoveredIdx] ? (
                    (() => {
                      const log = chronologicalLogs[hoveredIdx];
                      const cColor = CATEGORY_CHART_COLORS[log.category];
                      return (
                        <>
                          <div className="flex items-center gap-3">
                            <span
                              className="w-3 h-3 rounded-xs shrink-0"
                              style={{ backgroundColor: cColor.hex }}
                            />
                            <div>
                              <div className="font-bold text-[#0F2922]">
                                {log.title}
                              </div>
                              <div className="text-[#4A685F]">
                                {CATEGORY_META[log.category].label} ·{' '}
                                {MISSION_LANDSCAPES[log.missionId].shortName} ·{' '}
                                {new Date(log.completedAt).toLocaleString([], {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 font-mono text-[#0F2922]">
                            <span>{log.durationMinutes} min</span>
                            <span className="text-[#15803D] font-semibold">
                              +1 {GARDEN_ELEMENT_META[log.gardenElement].name}
                            </span>
                          </div>
                        </>
                      );
                    })()
                  ) : null}
                </div>
              )}
            </div>
          </section>

          {/* Bottom 2-Column Color-Coded Breakdown Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Donut Distribution Chart */}
            <section className="bg-white border border-[#D5E3DD] rounded-2xl p-5 sm:p-6 space-y-5">
              <div>
                <h2 className="text-base font-bold text-[#0F2922]">
                  Category Share Ring
                </h2>
                <p className="text-xs text-[#4A685F]">
                  Proportion of completed tasks across every health category.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-6">
                <div className="relative shrink-0">
                  <svg
                    width={donutSize}
                    height={donutSize}
                    viewBox={`0 0 ${donutSize} ${donutSize}`}
                    role="img"
                    aria-label="Completed tasks donut chart by category"
                  >
                    <circle
                      cx={donutCenter}
                      cy={donutCenter}
                      r={donutRadius}
                      fill="none"
                      stroke="#EEF4F1"
                      strokeWidth={24}
                    />
                    <g
                      transform={`rotate(-90 ${donutCenter} ${donutCenter})`}
                    >
                      {donutSegments.map((seg) => {
                        const isHovered = hoveredSlice === seg.category;
                        return (
                          <circle
                            key={seg.category}
                            cx={donutCenter}
                            cy={donutCenter}
                            r={donutRadius}
                            fill="none"
                            stroke={seg.color.hex}
                            strokeWidth={isHovered ? 29 : 24}
                            strokeDasharray={`${seg.dashLength} ${donutCircumference}`}
                            strokeDashoffset={seg.dashOffset}
                            className="transition-all duration-300 cursor-pointer"
                            onMouseEnter={() => setHoveredSlice(seg.category)}
                            onMouseLeave={() => setHoveredSlice(null)}
                          />
                        );
                      })}
                    </g>
                  </svg>

                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-4">
                    <span className="text-3xl font-mono font-bold text-[#0F2922] tabular-nums">
                      {hoveredSlice
                        ? categoryStats.find((s) => s.category === hoveredSlice)
                            ?.count ?? 0
                        : totalCompleted}
                    </span>
                    <span className="text-[11px] font-medium text-[#4A685F] mt-0.5">
                      {hoveredSlice
                        ? CATEGORY_CHART_COLORS[hoveredSlice].label
                        : 'Total Done'}
                    </span>
                  </div>
                </div>

                <div className="flex-1 w-full space-y-2.5">
                  {categoryStats.map((stat) => {
                    const pct =
                      totalCompleted > 0
                        ? Math.round((stat.count / totalCompleted) * 100)
                        : 0;
                    return (
                      <div
                        key={stat.category}
                        onMouseEnter={() => setHoveredSlice(stat.category)}
                        onMouseLeave={() => setHoveredSlice(null)}
                        className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-[#E4EDE9] bg-[#FAFDFB] hover:border-[#B6D0C5] transition-colors cursor-default"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className="w-3 h-3 rounded-xs shrink-0"
                            style={{ backgroundColor: stat.color.hex }}
                          />
                          <span className="text-xs font-semibold text-[#0F2922] truncate">
                            {stat.meta.label}
                          </span>
                        </div>
                        <div className="text-xs font-mono text-[#3B5950] whitespace-nowrap tabular-nums">
                          <strong className="text-[#0F2922]">{stat.count}</strong>{' '}
                          ({pct}%)
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* Category Comparison Bar Chart */}
            <section className="bg-white border border-[#D5E3DD] rounded-2xl p-5 sm:p-6 space-y-5">
              <div>
                <h2 className="text-base font-bold text-[#0F2922]">
                  Completed Count &amp; Minutes by Category
                </h2>
                <p className="text-xs text-[#4A685F]">
                  Bars resize immediately whenever you check or uncheck tasks.
                </p>
              </div>

              <div className="space-y-4">
                {categoryStats.map((stat) => {
                  const widthPct = Math.round(
                    (stat.count / maxCategoryCount) * 100
                  );
                  return (
                    <div key={stat.category} className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2 font-semibold text-[#0F2922]">
                          <span
                            className="w-2.5 h-2.5 rounded-xs shrink-0"
                            style={{ backgroundColor: stat.color.hex }}
                          />
                          <span>{stat.meta.label}</span>
                        </div>
                        <span className="font-mono text-[#3B5950] tabular-nums">
                          {stat.count} task{stat.count === 1 ? '' : 's'} ·{' '}
                          {stat.minutes} min
                        </span>
                      </div>

                      <div className="w-full h-5 rounded-md bg-[#EEF4F1] overflow-hidden">
                        <div
                          className="h-full rounded-md transition-all duration-500 flex items-center justify-end pr-2"
                          style={{
                            width: `${stat.count === 0 ? 0 : Math.max(8, widthPct)}%`,
                            backgroundColor: stat.color.hex,
                          }}
                        >
                          {stat.count > 0 && (
                            <span className="text-[10px] font-mono font-bold text-white">
                              {stat.count}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
};
