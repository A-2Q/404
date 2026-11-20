import React from 'react';
import type { EvidenceId } from '../game/types';
import { EVIDENCE_LIST, buildDiscoveredCodeSlots } from '../game/puzzleLogic';

interface EvidenceLogModalProps {
  loggedEvidence: EvidenceId[];
  discoveredEvidence: EvidenceId[];
  onInspect: (id: EvidenceId) => void;
  onOpenKeypad: () => void;
  onClose: () => void;
}

export const EvidenceLogModal: React.FC<EvidenceLogModalProps> = ({
  loggedEvidence,
  discoveredEvidence,
  onInspect,
  onOpenKeypad,
  onClose,
}) => {
  const slots = buildDiscoveredCodeSlots(loggedEvidence);

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-4 sm:p-6"
      style={{ backgroundColor: 'rgba(4, 5, 8, 0.84)' }}
      role="dialog"
      aria-modal="true"
      aria-label="سجل الأدلة الجنائية"
    >
      <div className="dossier-surface w-full max-w-2xl max-h-[88vh] flex flex-col rounded-sm overflow-hidden">
        {/* Dossier Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#a88854]/30">
          <div>
            <div className="font-mono-code text-[11px] tracking-[0.2em] text-[#b99353]">
              EVIDENCE DOSSIER // CASE 404
            </div>
            <h2 className="text-xl sm:text-2xl font-bold font-serif-ar text-[#f2e7d3] mt-0.5">
              سجل الأدلة الجنائية ({loggedEvidence.length}/{EVIDENCE_LIST.length})
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق سجل الأدلة"
            className="iron-btn px-3.5 py-2 rounded-sm text-xs font-bold cursor-pointer"
          >
            إغلاق [Esc]
          </button>
        </div>

        {/* Decoded Exit Code Bar */}
        <div className="px-6 py-3.5 bg-[#0c0c0e] border-b border-[#a88854]/20 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-bold text-[#c9a360]">رمز القفل الرقمي المستنتج (٤ أرقام)</div>
            <div className="text-[11px] text-[#a79c8b] mt-0.5">
              تُرتّب الأرقام من اليسار إلى اليمين وفق المذكرة الممزقة
            </div>
          </div>
          <div className="flex items-center gap-2" dir="ltr">
            {slots.map((digit, idx) => (
              <div
                key={idx}
                className="w-10 h-11 rounded-sm flex items-center justify-center font-mono-code text-xl font-bold"
                style={{
                  backgroundColor: digit ? 'rgba(143, 107, 50, 0.25)' : 'rgba(20, 22, 26, 0.9)',
                  border: digit
                    ? '1px solid rgba(209, 170, 103, 0.85)'
                    : '1px solid rgba(120, 110, 95, 0.35)',
                  color: digit ? '#f5dca4' : '#656058',
                }}
              >
                {digit ?? '?'}
              </div>
            ))}
          </div>
        </div>

        {/* 5 Evidence Entries */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-3">
          {EVIDENCE_LIST.map((ev, index) => {
            const isLogged = loggedEvidence.includes(ev.id);
            const isDiscovered = discoveredEvidence.includes(ev.id);
            return (
              <div
                key={ev.id}
                className="p-3.5 rounded-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                style={{
                  backgroundColor: isLogged ? 'rgba(28, 25, 20, 0.92)' : 'rgba(14, 15, 18, 0.88)',
                  border: isLogged
                    ? '1px solid rgba(196, 154, 84, 0.48)'
                    : '1px solid rgba(100, 94, 86, 0.25)',
                }}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono-code text-xs text-[#b99353]">0{index + 1}</span>
                    <h3 className="text-sm font-bold text-[#f0e5d1]">
                      {isLogged || isDiscovered ? ev.title : 'دليل غير مفحوص بعد'}
                    </h3>
                    {isLogged && (
                      <span className="text-[11px] font-bold text-[#8fd49e]">✓ مدوّن</span>
                    )}
                  </div>
                  <p className="text-xs mt-1 leading-relaxed text-[#c9bfa9]">
                    {isLogged
                      ? ev.logEntry
                      : `الموقع المحتمل: ${ev.locationHint}`}
                  </p>
                </div>

                {(isLogged || isDiscovered) && (
                  <button
                    type="button"
                    onClick={() => onInspect(ev.id)}
                    className="iron-btn px-3 py-1.5 rounded-sm text-xs font-bold shrink-0 cursor-pointer"
                  >
                    إعادة الفحص ٣٦٠°
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-3.5 border-t border-[#a88854]/25 flex items-center justify-between bg-[#0e0e10]">
          <span className="text-xs text-[#9c9180]">
            ابحث في الأدراج المغلقة للعثور على الساعة والمفتاح
          </span>
          <button
            type="button"
            onClick={onOpenKeypad}
            className="brass-btn px-4 py-2 rounded-sm text-xs font-bold cursor-pointer"
          >
            الانتقال للقفل الرقمي
          </button>
        </div>
      </div>
    </div>
  );
};
