import React, { useEffect } from 'react';
import { AlertTriangle, MessageSquareHeart, ShieldAlert, X } from 'lucide-react';
import { HealthAlert } from '../types.ts';
import { plainAction, plainSummary } from '../lib/healthWarnings.ts';

interface UrgentAlertModalProps {
  alert: HealthAlert;
  onClose: () => void;
  onOpenAssistant: () => void;
}

export const UrgentAlertModal: React.FC<UrgentAlertModalProps> = ({
  alert,
  onClose,
  onOpenAssistant,
}) => {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-[#0F2922]/55 backdrop-blur-sm flex items-center justify-center p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="urgent-alert-title"
    >
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border-2 border-[#FCA5A5] overflow-hidden">
        <div className="bg-[#FEF2F2] border-b border-[#FECACA] px-5 py-4 flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#B91C1C] text-white flex items-center justify-center shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-bold uppercase tracking-wide text-[#B91C1C]">
              Urgent health alert
            </div>
            <h2 id="urgent-alert-title" className="text-lg font-bold text-[#7F1D1D] mt-0.5">
              {alert.name} is out of range
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Dismiss urgent alert"
            className="p-1.5 rounded-lg text-[#991B1B] hover:bg-[#FEE2E2] cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="text-4xl font-mono font-bold text-[#B91C1C]">
                {alert.value}
                <span className="text-sm font-normal ml-1">{alert.unit}</span>
              </div>
              <div className="text-xs text-[#4A685F] mt-1">
                Healthy range: {alert.greenMin}–{alert.greenMax} {alert.unit}
              </div>
            </div>
            <div className="text-right text-[10px] text-[#4A685F] max-w-[180px]">
              {alert.domainLabel} · latest reading
            </div>
          </div>

          <p className="text-sm font-semibold text-[#7F1D1D]">{plainSummary(alert)}</p>

          <div className="rounded-xl bg-[#F0FDF4] border border-[#BBF7D0] p-4">
            <div className="text-[10px] font-bold uppercase tracking-wide text-[#15803D]">
              Do this right now
            </div>
            <p className="text-sm text-[#14532D] mt-1.5 leading-relaxed">{plainAction(alert)}</p>
          </div>

          <div className="flex items-start gap-2 text-[11px] text-[#4A685F]">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              This is an automatic screening alert, not a diagnosis. If you feel chest pain, faint,
              or short of breath, treat it as an emergency and contact the flight surgeon now.
            </span>
          </div>

          <div className="flex flex-col sm:flex-row justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onOpenAssistant}
              className="px-4 py-2.5 text-xs font-semibold text-[#0369A1] bg-[#E0F2FE] hover:bg-[#BAE6FD] border border-[#7DD3FC] rounded-lg inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <MessageSquareHeart className="w-4 h-4" />
              Discuss with Assistant
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-semibold text-white bg-[#B91C1C] hover:bg-[#991B1B] rounded-lg cursor-pointer"
            >
              I understand
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
