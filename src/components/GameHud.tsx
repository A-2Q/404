import React from 'react';
import type { HudSnapshot } from '../game/types';
import { EVIDENCE_LIST } from '../game/puzzleLogic';

interface GameHudProps {
  hud: HudSnapshot;
  onOpenLog: () => void;
  onOpenKeypad: () => void;
  onToggleFlashlight: () => void;
  onToggleMute: () => void;
  onPause: () => void;
  onRequestPointerLock: () => void;
}

function formatClock(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const GameHud: React.FC<GameHudProps> = ({
  hud,
  onOpenLog,
  onOpenKeypad,
  onToggleFlashlight,
  onToggleMute,
  onPause,
  onRequestPointerLock,
}) => {
  const tension = hud.truthTension;
  const edgeOpacity = Math.min(0.92, 0.42 + tension * 0.48);
  const dreadRed = Math.round(14 + tension * 46);
  const dreadBlue = Math.round(18 + (1 - tension) * 18);

  const isExploring = hud.mode === 'explore';
  const hasHover = isExploring && hud.hoverTarget !== null;

  return (
    <div className="fixed inset-0 z-10 pointer-events-none select-none">
      {/* Dynamic Psychological Cinematic Vignette (intensifies as truth approaches) */}
      <div
        aria-hidden="true"
        className="fixed inset-0 transition-opacity duration-700"
        style={{
          background: `radial-gradient(circle at 50% 50%, rgba(0,0,0,0) ${Math.round(
            48 - tension * 16,
          )}%, rgba(${dreadRed}, 6, ${dreadBlue}, ${edgeOpacity.toFixed(2)}) 100%)`,
        }}
      />

      {/* Top Perimeter Clusters (>= 85% Viewport Unobstructed; hidden during modal/inspection overlays) */}
      {isExploring && (
      <div className="fixed top-4 inset-x-5 flex items-start justify-between gap-4">
        {/* Top-Right Cluster (RTL start): Evidence Socket Pips + Timer */}
        <div
          className="flex items-center gap-4 px-4 py-2.5 rounded-sm"
          style={{
            backgroundColor: 'rgba(13, 13, 15, 0.86)',
            border: '1px solid rgba(168, 136, 84, 0.3)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.55)',
          }}
        >
          <div className="flex flex-col">
            <span className="text-[10px] font-bold tracking-wider text-[#b39869] uppercase">
              الأدلة المدوّنة
            </span>
            <div className="flex items-center gap-2 mt-1">
              <span
                className="font-mono-code text-xl font-bold leading-none text-[#f2e7d3]"
                data-testid="evidence-count"
              >
                {hud.loggedEvidence.length}/{EVIDENCE_LIST.length}
              </span>
              {/* 5 Discrete Forensic Evidence Socket Pips */}
              <div className="flex items-center gap-1" aria-hidden="true">
                {EVIDENCE_LIST.map((ev) => {
                  const isLogged = hud.loggedEvidence.includes(ev.id);
                  const isSeen = hud.discoveredEvidence.includes(ev.id);
                  return (
                    <svg key={ev.id} viewBox="0 0 14 14" className="h-3.5 w-3.5">
                      <rect
                        x="1.5"
                        y="1.5"
                        width="11"
                        height="11"
                        rx="2"
                        fill={isLogged ? '#c89b4b' : isSeen ? '#5b4b32' : '#18191e'}
                        stroke={isLogged ? '#f3d494' : '#6c5d45'}
                        strokeWidth="1.2"
                      />
                    </svg>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="h-8 w-px bg-[#a88854]/25" />

          <div className="flex flex-col">
            <span className="text-[10px] font-bold tracking-wider text-[#9b9284]">الوقت</span>
            <span className="font-mono-code text-base font-semibold text-[#dfd6c5] mt-0.5">
              {formatClock(hud.elapsedSeconds)}
            </span>
          </div>
        </div>

        {/* Top-Left Utility Square Icon Cluster (RTL end) */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onOpenLog();
            }}
            aria-label="فتح سجل الأدلة [L]"
            title="سجل الأدلة [L]"
            className="iron-btn h-10 px-3 rounded-sm flex items-center gap-2 text-xs font-bold cursor-pointer"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 text-[#d1aa67]" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M4 5a2 2 0 0 1 2-2h9l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5z" />
              <path d="M14 3v5h5M8 13h8M8 17h5" />
            </svg>
            <span className="hidden sm:inline">السجل [L]</span>
          </button>

          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onOpenKeypad();
            }}
            aria-label="فتح القفل الرقمي للباب"
            title="القفل الرقمي"
            className="iron-btn h-10 px-3 rounded-sm flex items-center gap-2 text-xs font-bold cursor-pointer"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 text-[#d1aa67]" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="4" y="3" width="16" height="18" rx="2" />
              <path d="M8 7h8M8 12h2M14 12h2M8 16h2M14 16h2" />
            </svg>
            <span className="hidden sm:inline">القفل</span>
          </button>

          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleFlashlight();
            }}
            aria-label={hud.flashlightOn ? 'إطفاء الكشاف [F]' : 'تشغيل الكشاف [F]'}
            title="الكشاف [F]"
            className="iron-btn h-10 w-10 rounded-sm flex items-center justify-center cursor-pointer"
            style={{
              borderColor: hud.flashlightOn ? 'rgba(209, 170, 103, 0.7)' : undefined,
              color: hud.flashlightOn ? '#f0c878' : '#7b7874',
            }}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M18 6l-6 6v8H8v-8L2 6h16z" transform="translate(2,0)" />
              <path d="M6 3h12" />
            </svg>
          </button>

          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleMute();
            }}
            aria-label={hud.muted ? 'تشغيل الصوت [M]' : 'كتم الصوت [M]'}
            title="الصوت [M]"
            className="iron-btn h-10 w-10 rounded-sm flex items-center justify-center cursor-pointer"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M11 5L6 9H3v6h3l5 4V5z" />
              {hud.muted ? (
                <path d="M22 9l-6 6M16 9l6 6" stroke="#c95449" />
              ) : (
                <path d="M16 8.5a5 5 0 0 1 0 7" />
              )}
            </svg>
          </button>

          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onPause();
            }}
            aria-label="إيقاف مؤقت [P]"
            title="إيقاف مؤقت [P]"
            className="iron-btn h-10 w-10 rounded-sm flex items-center justify-center cursor-pointer"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="6" y="5" width="4" height="14" />
              <rect x="14" y="5" width="4" height="14" />
            </svg>
          </button>
        </div>
      </div>
      )}

      {/* Center Dynamic Reticle & Diegetic Interaction Prompt (explore mode only) */}
      {isExploring && !hud.doorUnlocked && (
        <div
          className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
          style={{ pointerEvents: 'none' }}
        >
          <svg viewBox="0 0 28 28" className="h-7 w-7">
            <circle
              cx="14"
              cy="14"
              r={hasHover ? 7 : 3}
              fill={hasHover ? 'rgba(218, 174, 96, 0.25)' : 'rgba(236, 228, 212, 0.85)'}
              stroke={hasHover ? '#e7bd72' : '#090a0d'}
              strokeWidth={hasHover ? 1.8 : 1.2}
            />
            {hasHover && <circle cx="14" cy="14" r="2" fill="#f7dca3" />}
          </svg>

          {hasHover && hud.hoverTarget && (
            <div
              className="mt-3 px-3.5 py-1.5 rounded-sm text-center whitespace-nowrap"
              style={{
                backgroundColor: 'rgba(12, 12, 14, 0.92)',
                border: '1px solid rgba(209, 170, 103, 0.55)',
                boxShadow: '0 6px 20px rgba(0,0,0,0.75)',
              }}
            >
              <div className="text-xs font-bold text-[#f3e5cb]">{hud.hoverTarget.label}</div>
              <div className="text-[11px] text-[#c8a15d] mt-0.5">
                [نقر / E] {hud.hoverTarget.actionHint}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Subtle PointerLock Hint Banner when unlocked during exploration */}
      {isExploring && !hud.pointerLocked && !hud.doorUnlocked && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
          {hud.toastMessage && (
            <div
              className="px-4 py-2 rounded-sm text-xs sm:text-sm font-semibold text-[#f3e6cc]"
              style={{
                backgroundColor: 'rgba(18, 16, 14, 0.94)',
                border: '1px solid rgba(209, 170, 103, 0.5)',
              }}
            >
              {hud.toastMessage}
            </div>
          )}
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onRequestPointerLock();
            }}
            className="pointer-events-auto text-xs text-[#cfc4b0]/90 px-3.5 py-1.5 rounded-sm cursor-pointer"
            style={{
              backgroundColor: 'rgba(10, 11, 14, 0.82)',
              border: '1px solid rgba(154, 134, 96, 0.32)',
            }}
          >
            انقر داخل الغرفة للتحكم الحر بالماوس · WASD للمشي · اسحب للنظر · L للسجل
          </button>
        </div>
      )}

      {/* Toast when pointer is locked */}
      {isExploring && hud.pointerLocked && hud.toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2">
          <div
            className="px-4 py-2 rounded-sm text-xs sm:text-sm font-semibold text-[#f3e6cc]"
            style={{
              backgroundColor: 'rgba(18, 16, 14, 0.94)',
              border: '1px solid rgba(209, 170, 103, 0.5)',
            }}
          >
            {hud.toastMessage}
          </div>
        </div>
      )}
    </div>
  );
};
