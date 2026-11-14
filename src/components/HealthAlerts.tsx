import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  HeartPulse,
  RefreshCw,
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

const PLAIN_GUIDANCE: Record<
  string,
  { summary: string; action: string }
> = {
  total_sleep_time: {
    summary: 'You are not getting enough sleep.',
    action:
      'Start winding down 30 minutes earlier tonight. Keep the cabin dark and cool, and aim for 8–8.5 hours.',
  },
  exercise_dose: {
    summary: 'You are moving less than the healthy weekly amount.',
    action:
      'Add a 20–30 minute walk or easy cardio session today. Build up toward about 90 minutes of activity per day.',
  },
  stress: {
    summary: 'Your stress level is higher than the healthy range.',
    action:
      'Take a 10-minute slow-breathing break and check in with a crewmate. If it stays high, tell your flight surgeon.',
  },
  mood: {
    summary: 'Your mood has been low this week.',
    action:
      'Try a 15-minute Earth-gazing break or a call home. If the low mood lasts more than a few days, talk to your flight surgeon.',
  },
};

function plainSummary(alert: HealthAlert): string {
  const preset = PLAIN_GUIDANCE[alert.parameterId];
  if (preset) return preset.summary;
  const direction = alert.value < alert.greenMin ? 'below' : 'above';
  return `Your ${alert.name.toLowerCase()} is ${direction} the healthy range.`;
}

function plainAction(alert: HealthAlert): string {
  return PLAIN_GUIDANCE[alert.parameterId]?.action ?? alert.countermeasures;
}

const AlertCard: React.FC<{ alert: HealthAlert }> = ({ alert }) => {
  const isRed = alert.severity === 'red';
  const accent = isRed
    ? {
        wrap: 'bg-[#FEF2F2] border-[#FECACA]',
        badge: 'bg-[#B91C1C] text-white',
        title: 'text-[#7F1D1D]',
        value: 'text-[#B91C1C]',
      }
    : {
        wrap: 'bg-[#FEFCE8] border-[#FDE047]',
        badge: 'bg-[#CA8A04] text-white',
        title: 'text-[#713F12]',
        value: 'text-[#A16207]',
      };

  return (
    <article className={`rounded-xl border p-4 sm:p-5 space-y-3 ${accent.wrap}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${accent.badge}`}
            >
              {isRed ? 'Needs attention' : 'Slightly off target'}
            </span>
            <span className="text-[11px] text-[#4A685F]">{alert.domainLabel}</span>
          </div>
          <h3 className={`text-base font-bold ${accent.title}`}>{alert.name}</h3>
        </div>
        <div className="text-right shrink-0">
          <div className={`text-2xl font-mono font-bold ${accent.value}`}>
            {alert.value}
            <span className="text-xs font-normal ml-1">{alert.unit}</span>
          </div>
          <div className="text-[11px] text-[#4A685F]">
            healthy {alert.greenMin}–{alert.greenMax}
          </div>
        </div>
      </div>

      <p className={`text-sm font-semibold ${accent.title}`}>{plainSummary(alert)}</p>

      <div className="rounded-lg bg-white/80 border border-white p-3">
        <div className="text-[10px] font-bold uppercase tracking-wide text-[#15803D]">
          What to do now
        </div>
        <p className="text-sm text-[#2D473E] mt-1 leading-relaxed">{plainAction(alert)}</p>
      </div>

      <details className="group text-xs text-[#3B5950]">
        <summary className="flex items-center gap-1.5 cursor-pointer select-none font-semibold text-[#4A685F] hover:text-[#0F2922]">
          <ChevronDown className="w-3.5 h-3.5 transition-transform group-open:rotate-180" />
          Why this matters
        </summary>
        <div className="mt-2 space-y-2 rounded-lg bg-white/60 border border-white p-3 leading-relaxed">
          <p>{alert.consequence}</p>
          <p className="text-[#4A685F]">{alert.operationalImpact}</p>
          <div className="text-[10px] text-[#4A685F] border-t border-black/5 pt-2 space-y-0.5">
            <div>
              Target: {alert.targetText} · {AGGREGATION_LABEL[alert.aggregation] ?? alert.aggregation}
            </div>
            {alert.bandLabel && <div>{alert.bandLabel}</div>}
            <div>
              Source: {alert.monitoringSource} · {alert.cadence} · {alert.sampleSize} sample
              {alert.sampleSize === 1 ? '' : 's'}
            </div>
          </div>
        </div>
      </details>
    </article>
  );
};

export const HealthAlerts: React.FC<HealthAlertsProps> = ({ crewState }) => {
  const [report, setReport] = useState<WarningReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

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
  }, [crewState.crewId, readingCount, historyCount, retryKey]);

  const alerts = report?.alerts ?? [];
  const redCount = alerts.filter((a) => a.severity === 'red').length;

  return (
    <section className="bg-white border border-[#D5E3DD] rounded-2xl p-5 sm:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-start gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              alerts.length || error
                ? 'bg-[#FEF2F2] text-[#B91C1C]'
                : 'bg-[#F0FDF4] text-[#15803D]'
            }`}
          >
            {alerts.length || error ? (
              <TriangleAlert className="w-5 h-5" />
            ) : (
              <ShieldCheck className="w-5 h-5" />
            )}
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#0F2922]">Health limit warnings</h2>
            <p className="text-xs text-[#4A685F] mt-0.5">
              Simple checks based on your sleep, stress, activity and mood.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {loading && !report ? (
            <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#F6FAF8] text-[#4A685F] border border-[#D5E3DD]">
              Checking…
            </span>
          ) : error ? (
            <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA]">
              Check unavailable
            </span>
          ) : alerts.length > 0 ? (
            <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA]">
              {alerts.length} thing{alerts.length === 1 ? '' : 's'} to improve
              {redCount > 0 ? ` · ${redCount} urgent` : ''}
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
        <div className="p-3 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#991B1B] flex items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            Health checks are unavailable right now.
          </span>
          <button
            type="button"
            onClick={() => setRetryKey((key) => key + 1)}
            className="inline-flex items-center gap-1 font-semibold text-[#991B1B] hover:underline cursor-pointer shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry
          </button>
        </div>
      )}

      {!loading && !error && alerts.length === 0 && (
        <div className="p-4 rounded-xl bg-[#F0FDF4] border border-[#BBF7D0] space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#166534]">
            <HeartPulse className="w-4 h-4" />
            Everything monitored is inside the healthy range.
          </div>
          {report && report.checked.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {report.checked.map((c) => (
                <span
                  key={c.parameterId}
                  className="px-2 py-1 rounded-md bg-white border border-[#BBF7D0] text-[11px] text-[#166534]"
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
          These are guidance ranges, not a medical diagnosis. Tell your flight surgeon if you feel
          unwell or a warning does not improve.
        </span>
      </div>
    </section>
  );
};
