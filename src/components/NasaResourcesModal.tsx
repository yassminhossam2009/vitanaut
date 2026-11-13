import React from 'react';
import { ExternalLink, X } from 'lucide-react';
import {
  CATEGORY_META,
  GARDEN_ELEMENT_META,
  NASA_COUNTERMEASURE_RESOURCES,
} from '../data/nasaResources.ts';

interface NasaResourcesModalProps {
  open: boolean;
  onClose: () => void;
}

export const NasaResourcesModal: React.FC<NasaResourcesModalProps> = ({
  open,
  onClose,
}) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-[#0F2922]/45 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="nasa-modal-title"
    >
      <div className="bg-white border border-[#D5E3DD] rounded-2xl w-full max-w-4xl max-h-[88vh] flex flex-col overflow-hidden shadow-xl">
        <div className="px-6 py-5 border-b border-[#E4EDE9] flex items-center justify-between gap-4 bg-[#F6FAF8]">
          <div>
            <div className="text-xs font-mono text-[#0369A1]">
              NASA Space Apps · Human Research Program Resources
            </div>
            <h2 id="nasa-modal-title" className="text-xl font-bold text-[#0F2922] mt-0.5">
              Spaceflight Health Countermeasures &amp; Garden Science
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close NASA resources"
            className="p-2 rounded-lg text-[#4A685F] hover:text-[#0F2922] hover:bg-[#E4EDE9] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          <div className="p-4 rounded-xl bg-[#FEFCE8] border border-[#FDE047] text-sm text-[#4B4429] leading-relaxed">
            Every habit in Vitanaut maps directly to NASA spaceflight physiological and behavioral protocols—turning daily compliance on ARED, T2, CEVIS, circadian lighting, and mental resilience into visible growth in your living mission garden.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {NASA_COUNTERMEASURE_RESOURCES.map((item) => {
              const cat = CATEGORY_META[item.category];
              const element = GARDEN_ELEMENT_META[item.gardenElement];
              return (
                <article
                  key={item.id}
                  className="p-5 rounded-xl border border-[#D5E3DD] bg-[#FBFDFC] flex flex-col justify-between gap-4"
                >
                  <div>
                    <div className="text-xs text-[#4A685F] flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold" style={{ color: cat.accentColor }}>
                        {cat.label}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>Garden: {element.pluralName}</span>
                    </div>
                    <h3 className="text-base font-bold text-[#0F2922] mt-1.5">
                      {item.title}
                    </h3>
                    <p className="text-xs text-[#5C7A70] mt-0.5">{item.program}</p>
                    <p className="text-sm text-[#2D473E] mt-2.5 leading-relaxed">
                      {item.summary}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-[#E4EDE9] space-y-1.5 text-xs">
                    <div>
                      <span className="font-semibold text-[#0F2922]">Daily Target: </span>
                      <span className="text-[#3B5950] font-mono">{item.dailyTarget}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-[#0F2922]">Risk Mitigated: </span>
                      <span className="text-[#3B5950]">{item.spaceflightRisk}</span>
                    </div>
                    <div className="pt-1">
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 font-semibold text-[#0369A1] hover:underline"
                      >
                        <span>NASA Source Reference</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
