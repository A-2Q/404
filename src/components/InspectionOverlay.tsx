import React from 'react';
import type { EvidenceId } from '../game/types';
import { EVIDENCE_MAP } from '../game/puzzleLogic';

interface InspectionOverlayProps {
  evidenceId: EvidenceId;
  isLogged: boolean;
  onLog: () => void;
  onFlip: () => void;
  onClose: () => void;
}

export const InspectionOverlay: React.FC<InspectionOverlayProps> = ({
  evidenceId,
  isLogged,
  onLog,
  onFlip,
  onClose,
}) => {
  const def = EVIDENCE_MAP[evidenceId];
  if (!def) return null;

  return (
    <div
      className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between p-5 sm:p-8"
      style={{
        // Darken outer perimeter while leaving the center crystal clear for the 3D inspected artifact
        background:
          'radial-gradient(circle at 50% 47%, rgba(4,5,8,0.12) 0%, rgba(4,5,8,0.52) 44%, rgba(3,4,7,0.88) 100%)',
      }}
    >
      {/* Top Header */}
      <div className="flex items-start justify-between gap-4">
        <div
          className="px-4 py-2.5 rounded-sm"
          style={{
            backgroundColor: 'rgba(14, 13, 12, 0.92)',
            border: '1px solid rgba(186, 149, 88, 0.4)',
          }}
        >
          <div className="text-[11px] font-bold tracking-wider text-[#c8a15d]">
            وضع الفحص الجنائي ٣٦٠°
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-[#f3e7d2] font-serif-ar mt-0.5">
            {def.title}
          </h2>
          <p className="text-xs text-[#b5aa98]">{def.subtitle}</p>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="إغلاق الفحص"
          className="pointer-events-auto iron-btn px-4 py-2 rounded-sm text-xs font-bold cursor-pointer flex items-center gap-2"
        >
          <span>إغلاق [Esc]</span>
        </button>
      </div>

      {/* Bottom Compact Forensic Readout & Actions (Center 3D Object stays 100% draggable) */}
      <div className="max-w-2xl w-full mx-auto pointer-events-auto dossier-surface rounded-sm p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <p className="text-xs sm:text-sm text-[#e7decb] leading-relaxed">{def.frontSummary}</p>
        </div>
        <p className="text-xs text-[#c78b7e] mb-4">{def.backSecret}</p>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#a88854]/25">
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={onLog}
              disabled={isLogged}
              className={
                isLogged
                  ? 'px-4 py-2 rounded-sm text-xs sm:text-sm font-bold bg-[#253629] text-[#9de0ae] border border-[#4a7c58] cursor-default'
                  : 'brass-btn px-5 py-2 rounded-sm text-xs sm:text-sm font-bold cursor-pointer'
              }
            >
              {isLogged ? 'تم التدوين في سجل الأدلة ✓' : 'تدوين في سجل الأدلة [Enter]'}
            </button>

            <button
              type="button"
              onClick={onFlip}
              className="iron-btn px-4 py-2 rounded-sm text-xs font-bold cursor-pointer"
            >
              اقلب المجسم ١٨٠°
            </button>
          </div>

          <span className="text-[11px] text-[#afa391]">{def.inspectHint}</span>
        </div>
      </div>
    </div>
  );
};
