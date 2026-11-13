import React, { useState } from 'react';
import { Activity, MessageSquareHeart, Watch } from 'lucide-react';
import { CrewState, HabitCategory, WatchReading } from '../types.ts';

interface WatchPageProps {
  crewState: CrewState;
  onAddWatchReading: (reading: WatchReading) => void;
  onSendAlertToAssistant: (prompt: string) => void;
}

export const WatchPage: React.FC<WatchPageProps> = ({
  crewState,
  onAddWatchReading,
  onSendAlertToAssistant,
}) => {
  const readings = crewState.watchReadings;
  const latest = readings[readings.length - 1];

  const [hr, setHr] = useState(latest?.heartRateBpm ?? 66);
  const [hrv, setHrv] = useState(latest?.hrvMs ?? 56);
  const [spo2, setSpo2] = useState(latest?.spo2Percent ?? 98);
  const [stress, setStress] = useState(latest?.stressIndex ?? 34);
  const [sleep, setSleep] = useState(latest?.sleepHours ?? 7.8);
  const [boneLoad, setBoneLoad] = useState(latest?.boneLoadKn ?? 1.58);
  const [activeMin, setActiveMin] = useState(latest?.activeMinutes ?? 70);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const entry: WatchReading = {
      id: `watch-${Date.now()}`,
      timestamp: new Date().toISOString(),
      heartRateBpm: Number(hr),
      hrvMs: Number(hrv),
      spo2Percent: Number(spo2),
      stressIndex: Number(stress),
      sleepHours: Number(sleep),
      deepSleepPercent: Math.round(Math.min(35, Math.max(12, Number(sleep) * 3.1))),
      boneLoadKn: Number(boneLoad),
      activeMinutes: Number(activeMin),
      source: 'manual_entry',
    };
    onAddWatchReading(entry);
    setSyncNotice('Watch reading saved to mission telemetry.');
  };

  const handleSimulateSync = () => {
    const nextHr = Math.round(62 + Math.random() * 18);
    const nextHrv = Math.round(40 + Math.random() * 28);
    const nextStress = Math.round(28 + Math.random() * 44);
    const nextSleep = Number((6.0 + Math.random() * 2.4).toFixed(1));
    const nextSpo2 = Math.round(97 + Math.random() * 2);
    const nextBone = Number((1.35 + Math.random() * 0.4).toFixed(2));
    const nextActive = Math.round(50 + Math.random() * 45);

    setHr(nextHr);
    setHrv(nextHrv);
    setStress(nextStress);
    setSleep(nextSleep);
    setSpo2(nextSpo2);
    setBoneLoad(nextBone);
    setActiveMin(nextActive);

    const entry: WatchReading = {
      id: `watch-${Date.now()}`,
      timestamp: new Date().toISOString(),
      heartRateBpm: nextHr,
      hrvMs: nextHrv,
      spo2Percent: nextSpo2,
      stressIndex: nextStress,
      sleepHours: nextSleep,
      deepSleepPercent: Math.round(nextSleep * 3.0),
      boneLoadKn: nextBone,
      activeMinutes: nextActive,
      source: 'wearable_sync',
    };
    onAddWatchReading(entry);
    setSyncNotice('Wearable packet synced from astronaut wrist monitor.');
  };

  const recentSeries = readings.slice(-8);
  const chartW = 640;
  const chartH = 220;
  const padX = 44;
  const padY = 24;
  const innerW = chartW - padX * 2;
  const innerH = chartH - padY * 2;

  const toX = (i: number) =>
    recentSeries.length <= 1
      ? padX + innerW / 2
      : padX + (i / (recentSeries.length - 1)) * innerW;

  const toY = (val: number, min: number, max: number) => {
    const clamped = Math.max(min, Math.min(max, val));
    return padY + innerH - ((clamped - min) / (max - min)) * innerH;
  };

  const buildPath = (vals: number[], min: number, max: number) =>
    vals
      .map((v, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(v, min, max).toFixed(1)}`)
      .join(' ');

  const hrPath = buildPath(
    recentSeries.map((r) => r.heartRateBpm),
    40,
    120
  );
  const hrvPath = buildPath(
    recentSeries.map((r) => r.hrvMs),
    20,
    90
  );
  const stressPath = buildPath(
    recentSeries.map((r) => r.stressIndex),
    0,
    100
  );

  // 5-Axis Radar Calculation from habits + watch vitals
  const completionRatio = (cat: HabitCategory) => {
    const list = crewState.habits.filter((h) => h.category === cat);
    if (list.length === 0) return 0.7;
    return 0.45 + 0.55 * (list.filter((h) => h.completedToday).length / list.length);
  };

  const radarAxes = [
    { label: 'BONE/MUSCLE', val: Math.min(1, (latest?.boneLoadKn ?? 1.5) / 1.8) },
    { label: 'CARDIO', val: completionRatio(HabitCategory.CARDIO) },
    {
      label: 'MENTAL CALM',
      val: Math.max(0.25, 1 - (latest?.stressIndex ?? 40) / 100),
    },
    { label: 'SLEEP', val: Math.min(1, (latest?.sleepHours ?? 7.5) / 8.5) },
    { label: 'NUTRITION', val: completionRatio(HabitCategory.NUTRITION) },
  ];

  const radarCx = 150;
  const radarCy = 140;
  const radarR = 92;
  const radarPoints = radarAxes
    .map((axis, idx) => {
      const angle = -Math.PI / 2 + (idx * 2 * Math.PI) / radarAxes.length;
      const r = axis.val * radarR;
      return `${(radarCx + r * Math.cos(angle)).toFixed(1)},${(
        radarCy +
        r * Math.sin(angle)
      ).toFixed(1)}`;
    })
    .join(' ');

  const needsAttention =
    latest && (latest.stressIndex >= 55 || latest.sleepHours < 6.8 || latest.hrvMs < 45);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      <div className="bg-white border border-[#D5E3DD] rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="text-xs font-mono text-[#0369A1]">
            Astronaut Wrist Telemetry · {readings.length} Synced Packets
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#0F2922] tracking-tight mt-1">
            Biometric Watch Readings
          </h1>
          <p className="text-sm text-[#3B5950] mt-1">
            Insert readings from your crew wearable to monitor cardiovascular, sleep, bone-load, and mental stress trends.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSimulateSync}
          className="px-4 py-2.5 text-xs font-semibold text-white bg-[#0369A1] hover:bg-[#075985] rounded-lg inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Watch className="w-4 h-4" />
          <span>Sync Watch Packet</span>
        </button>
      </div>

      {syncNotice && (
        <div className="p-3.5 rounded-xl bg-[#EFF6F2] border border-[#86EFAC] text-xs font-medium text-[#14532D] flex items-center justify-between">
          <span>{syncNotice}</span>
          <button
            type="button"
            onClick={() => setSyncNotice(null)}
            className="text-[#15803D] hover:underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {needsAttention && latest && (
        <div className="p-4 rounded-xl bg-[#FEFCE8] border border-[#EAB308]/70 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-0.5">
            <div className="text-xs font-semibold text-[#A16207]">
              Watch Biometric Advisory
            </div>
            <p className="text-sm text-[#4B4429]">
              Your latest watch packet shows Stress Index{' '}
              <span className="font-mono font-semibold">{latest.stressIndex}/100</span>, Sleep{' '}
              <span className="font-mono font-semibold">{latest.sleepHours}h</span>, and HRV{' '}
              <span className="font-mono font-semibold">{latest.hrvMs} ms</span>.
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              onSendAlertToAssistant(
                `My watch just recorded a Stress Index of ${latest.stressIndex}/100, HRV of ${latest.hrvMs} ms, and ${latest.sleepHours} hours of sleep. Can you recommend mental and physical recovery habits?`
              )
            }
            className="px-4 py-2 text-xs font-semibold text-white bg-[#15803D] hover:bg-[#166534] rounded-lg inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <MessageSquareHeart className="w-4 h-4" />
            <span>Ask Assistant for Habit</span>
          </button>
        </div>
      )}

      {latest && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
          <div className="p-4 bg-white border border-[#D5E3DD] rounded-xl">
            <div className="text-xs text-[#4A685F]">Heart Rate</div>
            <div className="text-2xl font-mono font-bold tabular-nums text-[#0F2922] mt-1">
              {latest.heartRateBpm}
              <span className="text-xs text-[#5C7A70] ml-1">bpm</span>
            </div>
          </div>
          <div className="p-4 bg-[#EFF6F2] border border-[#CBE0D6] rounded-xl">
            <div className="text-xs text-[#14532D]">HRV Recovery</div>
            <div className="text-2xl font-mono font-bold tabular-nums text-[#0F2922] mt-1">
              {latest.hrvMs}
              <span className="text-xs text-[#3B5950] ml-1">ms</span>
            </div>
          </div>
          <div className="p-4 bg-[#EBF3FA] border border-[#CBE0EE] rounded-xl">
            <div className="text-xs text-[#075985]">Blood Oxygen</div>
            <div className="text-2xl font-mono font-bold tabular-nums text-[#0F2922] mt-1">
              {latest.spo2Percent}
              <span className="text-xs text-[#0369A1] ml-1">%</span>
            </div>
          </div>
          <div className="p-4 bg-[#FEFCE8] border border-[#FDE047] rounded-xl">
            <div className="text-xs text-[#713F12]">Mental Stress</div>
            <div className="text-2xl font-mono font-bold tabular-nums text-[#0F2922] mt-1">
              {latest.stressIndex}
              <span className="text-xs text-[#A16207] ml-1">/100</span>
            </div>
          </div>
          <div className="p-4 bg-white border border-[#D5E3DD] rounded-xl">
            <div className="text-xs text-[#4A685F]">Sleep Window</div>
            <div className="text-2xl font-mono font-bold tabular-nums text-[#0F2922] mt-1">
              {latest.sleepHours}
              <span className="text-xs text-[#5C7A70] ml-1">hrs</span>
            </div>
          </div>
          <div className="p-4 bg-white border border-[#D5E3DD] rounded-xl">
            <div className="text-xs text-[#4A685F]">Bone Load</div>
            <div className="text-2xl font-mono font-bold tabular-nums text-[#0F2922] mt-1">
              {latest.boneLoadKn}
              <span className="text-xs text-[#5C7A70] ml-1">kN</span>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 space-y-6">
          <section className="bg-white border border-[#D5E3DD] rounded-2xl p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-[#0F2922]">
                  Heart Rate, HRV &amp; Mental Stress Trend
                </h2>
                <p className="text-xs text-[#4A685F]">
                  Hover points to inspect exact wearable packet telemetry
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs font-mono">
                <span className="text-[#0369A1]">● HR (bpm)</span>
                <span className="text-[#15803D]">● HRV (ms)</span>
                <span className="text-[#CA8A04]">-- Stress (/100)</span>
              </div>
            </div>

            <div className="relative w-full overflow-x-auto">
              <svg
                viewBox={`0 0 ${chartW} ${chartH}`}
                className="w-full h-56 overflow-visible"
              >
                {[0, 0.25, 0.5, 0.75, 1].map((t) => {
                  const y = padY + t * innerH;
                  return (
                    <line
                      key={t}
                      x1={padX}
                      y1={y}
                      x2={chartW - padX}
                      y2={y}
                      stroke="#E4EDE9"
                      strokeWidth="1"
                    />
                  );
                })}

                <path d={hrPath} fill="none" stroke="#0369A1" strokeWidth="2.5" />
                <path d={hrvPath} fill="none" stroke="#15803D" strokeWidth="2.5" />
                <path
                  d={stressPath}
                  fill="none"
                  stroke="#CA8A04"
                  strokeWidth="2"
                  strokeDasharray="5 4"
                />

                {recentSeries.map((pt, i) => {
                  const x = toX(i);
                  return (
                    <g
                      key={pt.id}
                      onMouseEnter={() => setHoverIdx(i)}
                      onMouseLeave={() => setHoverIdx(null)}
                      className="cursor-crosshair"
                    >
                      <rect
                        x={x - 16}
                        y={padY}
                        width={32}
                        height={innerH}
                        fill="transparent"
                      />
                      <circle cx={x} cy={toY(pt.heartRateBpm, 40, 120)} r="4" fill="#0369A1" />
                      <circle cx={x} cy={toY(pt.hrvMs, 20, 90)} r="4" fill="#15803D" />
                      <circle cx={x} cy={toY(pt.stressIndex, 0, 100)} r="3.5" fill="#CA8A04" />
                      <text
                        x={x}
                        y={chartH - 4}
                        textAnchor="middle"
                        className="text-[10px] font-mono fill-[#5C7A70]"
                      >
                        {new Date(pt.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </text>
                    </g>
                  );
                })}
              </svg>

              {hoverIdx !== null && recentSeries[hoverIdx] && (
                <div className="mt-2 p-3 rounded-xl bg-[#F6FAF8] border border-[#D5E3DD] text-xs font-mono flex flex-wrap items-center gap-4 text-[#0F2922]">
                  <span>
                    {new Date(recentSeries[hoverIdx].timestamp).toLocaleString()}
                  </span>
                  <span className="text-[#0369A1]">
                    HR: {recentSeries[hoverIdx].heartRateBpm} bpm
                  </span>
                  <span className="text-[#15803D]">
                    HRV: {recentSeries[hoverIdx].hrvMs} ms
                  </span>
                  <span className="text-[#A16207]">
                    Stress: {recentSeries[hoverIdx].stressIndex}/100
                  </span>
                  <span>Sleep: {recentSeries[hoverIdx].sleepHours}h</span>
                </div>
              )}
            </div>
          </section>

          <section className="bg-white border border-[#D5E3DD] rounded-2xl p-6 flex flex-col sm:flex-row items-center gap-6">
            <svg viewBox="0 0 300 280" className="w-64 h-60 shrink-0">
              {[0.33, 0.66, 1].map((scale) => {
                const ring = radarAxes
                  .map((_, idx) => {
                    const angle = -Math.PI / 2 + (idx * 2 * Math.PI) / radarAxes.length;
                    const r = scale * radarR;
                    return `${(radarCx + r * Math.cos(angle)).toFixed(1)},${(
                      radarCy +
                      r * Math.sin(angle)
                    ).toFixed(1)}`;
                  })
                  .join(' ');
                return (
                  <polygon
                    key={scale}
                    points={ring}
                    fill="none"
                    stroke="#D5E3DD"
                    strokeWidth="1"
                  />
                );
              })}
              {radarAxes.map((axis, idx) => {
                const angle = -Math.PI / 2 + (idx * 2 * Math.PI) / radarAxes.length;
                const lx = radarCx + (radarR + 22) * Math.cos(angle);
                const ly = radarCy + (radarR + 22) * Math.sin(angle);
                return (
                  <g key={axis.label}>
                    <line
                      x1={radarCx}
                      y1={radarCy}
                      x2={radarCx + radarR * Math.cos(angle)}
                      y2={radarCy + radarR * Math.sin(angle)}
                      stroke="#E4EDE9"
                    />
                    <text
                      x={lx}
                      y={ly}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="text-[9px] font-mono fill-[#3B5950]"
                    >
                      {axis.label}
                    </text>
                  </g>
                );
              })}
              <polygon
                points={radarPoints}
                fill="rgba(21, 128, 61, 0.18)"
                stroke="#15803D"
                strokeWidth="2"
              />
            </svg>

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#15803D]">
                <Activity className="w-4 h-4" />
                <span>5-Pillar Readiness Balance</span>
              </div>
              <h3 className="text-lg font-bold text-[#0F2922]">
                Physiological &amp; Mental Calibration
              </h3>
              <p className="text-sm text-[#3B5950] leading-relaxed">
                Combines real-time wearable sleep, stress, and bone-load packets with your daily habit completions across all five spaceflight health pillars.
              </p>
            </div>
          </section>
        </div>

        <aside className="lg:col-span-4 bg-white border border-[#D5E3DD] rounded-2xl p-6 space-y-4">
          <h2 className="text-lg font-bold text-[#0F2922]">
            Insert Watch Reading
          </h2>
          <p className="text-xs text-[#4A685F] leading-relaxed">
            Manually record or update measurements synced from your EVA / station smartwatch.
          </p>

          <form onSubmit={handleManualSubmit} className="space-y-3.5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#3B5950] mb-1">
                  Heart Rate (bpm)
                </label>
                <input
                  type="number"
                  min={35}
                  max={200}
                  value={hr}
                  onChange={(e) => setHr(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm font-mono bg-[#F8FBFA] border border-[#C9DBD4] rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#3B5950] mb-1">
                  HRV (ms)
                </label>
                <input
                  type="number"
                  min={10}
                  max={140}
                  value={hrv}
                  onChange={(e) => setHrv(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm font-mono bg-[#F8FBFA] border border-[#C9DBD4] rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#3B5950] mb-1">
                  SpO2 (%)
                </label>
                <input
                  type="number"
                  min={85}
                  max={100}
                  value={spo2}
                  onChange={(e) => setSpo2(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm font-mono bg-[#F8FBFA] border border-[#C9DBD4] rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#3B5950] mb-1">
                  Stress Index (0–100)
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={stress}
                  onChange={(e) => setStress(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm font-mono bg-[#F8FBFA] border border-[#C9DBD4] rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#3B5950] mb-1">
                  Sleep (hrs)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min={1}
                  max={14}
                  value={sleep}
                  onChange={(e) => setSleep(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm font-mono bg-[#F8FBFA] border border-[#C9DBD4] rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#3B5950] mb-1">
                  Bone Load (kN)
                </label>
                <input
                  type="number"
                  step="0.05"
                  min={0.2}
                  max={4}
                  value={boneLoad}
                  onChange={(e) => setBoneLoad(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm font-mono bg-[#F8FBFA] border border-[#C9DBD4] rounded-lg"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#3B5950] mb-1">
                Active Exercise Minutes
              </label>
              <input
                type="number"
                min={0}
                max={300}
                value={activeMin}
                onChange={(e) => setActiveMin(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm font-mono bg-[#F8FBFA] border border-[#C9DBD4] rounded-lg"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 bg-[#15803D] hover:bg-[#166534] text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              Insert Watch Reading
            </button>
          </form>
        </aside>
      </div>
    </div>
  );
};
