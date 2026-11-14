import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  HeartPulse,
  ShieldCheck,
  Stethoscope,
  TriangleAlert,
} from 'lucide-react';
import { CrewState, HealthAlert, WarningReport } from '../types.ts';
import { api } from '../lib/api.ts';

interface HealthAlertsProps {
  crewState: CrewState;
}

const AGGREGATION_LABEL: Record<string, string> = {
  latest: 'latest reading',
  avg_7d: '7-day average',
  avg_7d_mood: '7-day check-in average',
};

const AlertCard: React.FC<{ alert: HealthAlert }> = ({ alert }) => {
  const isRed = alert.severity === 'red';
  const accent = isRed
    ? {
        wrap: 'bg-[#FEF2F2] border-[#FECACA]',
        badge: 'bg-[#B91C1C] text-white',
        title: 'text-[#7F1D1D]',
        value: 'text-[#B91C1C]',
        label: 'text-[#991B1B]',
      }
    : {
        wrap: 'bg-[#FEFCE8] border-[#FDE047]',
        badge: 'bg-[#CA8A04] text-white',
        title: 'text-[#713F12]',
        value: 'text-[#A16207]',
        label: 'text-[#854D0E]',
      };

  return (
    <article className={`rounded-xl border p-4 sm:p-5 space-y-4 ${accent.wrap}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${accent.badge}`}
            >
              {isRed ? 'Limit exceeded' : 'Approaching limit'}
            </span>
            <span className="text-[11px] font-mono text-[#4A685F]">
              {alert.domainLabel} · {AGGREGATION_LABEL[alert.aggregation] ?? alert.aggregation}
            </span>
          </div>
          <h3 className={`text-base font-bold ${accent.title}`}>{alert.name}</h3>
        </div>
        <div className="text-right shrink-0">
          <div className={`text-2xl font-mono font-bold ${accent.value}`}>
            {alert.value}
            <span className="text-xs font-normal ml-1">{alert.unit}</span>
          </div>
          <div className="text-[11px] text-[#4A685F] font-mono">
            green {alert.greenMin}–{alert.greenMax}
          </div>
        </div>
      </div>

      <div className="text-xs text-[#3B5950]">
        <span className="font-semibold">Target: </span>
        {alert.targetText}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg bg-white/70 border border-white p-3">
          <div className={`text-[10px] font-bold uppercase tracking-wide ${accent.label}`}>
            If it persists
          </div>
          <p className="text-xs text-[#3B5950] mt-1 leading-relaxed">{alert.consequence}</p>
        </div>
        <div className="rounded-lg bg-white/70 border border-white p-3">
          <div className="text-[10px] font-bold uppercase tracking-wide text-[#4A685F]">
            Mission impact
          </div>
          <p className="text-xs text-[#3B5950] mt-1 leading-relaxed">{alert.operationalImpact}</p>
        </div>
        <div className="rounded-lg bg-white/70 border border-white p-3">
          <div className="text-[10px] font-bold uppercase tracking-wide text-[#15803D]">
            Countermeasure
          </div>
          <p className="text-xs text-[#3B5950] mt-1 leading-relaxed">{alert.countermeasures}</p>
        </div>
      </div>

      <div className="text-[10px] text-[#4A685F] leading-relaxed border-t border-black/5 pt-2 space-y-0.5">
        {alert.bandLabel && <div>{alert.bandLabel}</div>}
        <div>
          Source: {alert.monitoringSource} · {alert.cadence} · {alert.sampleSize} sample
          {alert.sampleSize === 1 ? '' : 's'} used
        </div>
      </div>
    </article>
  );
};

export const HealthAlerts: React.FC<HealthAlertsProps> = ({ crewState }) => {
  const [report, setReport] = useState<WarningReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const readingCount = crewState.watchReadings.length;
  const historyCount = crewState.history.length;

  useEffect(() => {
    const controller = new AbortController();
    // Wait briefly so a freshly synced packet is committed before we evaluate.
    const timer = window.setTimeout(() => {
      setLoading(true);
      api
        .warnings()
        .then((data) => {
          if (!controller.signal.aborted) {
            setReport(data);
            setError(null);
          }
        })
        .catch((err: Error) => {
          if (!controller.signal.aborted) setError(err.message);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 450);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [crewState.crewId, readingCount, historyCount]);

  const alerts = report?.alerts ?? [];
  const redCount = alerts.filter((a) => a.severity === 'red').length;

  return (
    <section className="bg-white border border-[#D5E3DD] rounded-2xl p-5 sm:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-start gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              alerts.length ? 'bg-[#FEF2F2] text-[#B91C1C]' : 'bg-[#F0FDF4] text-[#15803D]'
            }`}
          >
            {alerts.length ? (
              <TriangleAlert className="w-5 h-5" />
            ) : (
              <ShieldCheck className="w-5 h-5" />
            )}
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#0F2922]">Health limit warnings</h2>
            <p className="text-xs text-[#4A685F] mt-0.5">
              Live checks against the 41-parameter NASA guideline baseline. Sleep, stress,
              exercise and mood are monitored automatically.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {alerts.length > 0 ? (
            <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA]">
              {alerts.length} warning{alerts.length === 1 ? '' : 's'}
              {redCount > 0 ? ` · ${redCount} red` : ''}
            </span>
          ) : (
            <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#F0FDF4] text-[#15803D] border border-[#BBF7D0]">
              All monitored limits in range
            </span>
          )}
        </div>
      </div>

      {loading && !report && (
        <div className="h-20 rounded-xl bg-[#F6FAF8] border border-[#E4EDE9] animate-pulse" />
      )}

      {error && (
        <div className="p-3 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#991B1B] flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          Could not load warnings: {error}
        </div>
      )}

      {!loading && !error && alerts.length === 0 && (
        <div className="p-4 rounded-xl bg-[#F0FDF4] border border-[#BBF7D0] space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#166534]">
            <HeartPulse className="w-4 h-4" />
            All monitored values are inside their green bands.
          </div>
          {report && report.checked.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {report.checked.map((c) => (
                <span
                  key={c.parameterId}
                  className="px-2 py-1 rounded-md bg-white border border-[#BBF7D0] text-[11px] font-mono text-[#166534]"
                >
                  {c.name}: {c.value}
                  {c.unit ? ` ${c.unit}` : ''}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[#3B5950]">
              Sync a watch packet or complete a task check-in to start monitoring.
            </p>
          )}
        </div>
      )}

      {alerts.length > 0 && (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <AlertCard key={alert.parameterId} alert={alert} />
          ))}
        </div>
      )}

      <div className="text-[10px] text-[#4A685F] flex items-start gap-1.5 border-t border-[#E4EDE9] pt-3">
        <Stethoscope className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <span>
          Bands marked “app operational” or “app screening” are defaults, not NASA limits.
          Parameters without a numeric limit stay reference-only and are tracked as trends with
          the flight surgeon.
        </span>
      </div>
    </section>
  );
};
