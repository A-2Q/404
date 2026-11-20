import React from 'react';
import { getDesktopBridge } from '../game/desktopBridge';

interface TitleScreenProps {
  muted: boolean;
  onStart: () => void;
  onToggleMute: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({ muted, onStart, onToggleMute }) => {
  const desktop = getDesktopBridge();
  return (
    <div
      className="fixed inset-0 z-20 flex flex-col justify-between p-6 sm:p-10 pointer-events-none"
      style={{
        background:
          'linear-gradient(270deg, rgba(5,7,11,0.92) 0%, rgba(5,7,11,0.72) 34%, rgba(5,7,11,0.14) 68%, rgba(5,7,11,0.36) 100%)',
      }}
    >
      {/* Top bar: case code + subtle mute button */}
      <div className="flex items-center justify-between">
        <div className="font-mono-code text-xs tracking-[0.22em] text-[#b39869]/85 uppercase">
          CASE FILE // 404
        </div>
        <div className="flex items-center gap-2">
          {desktop && (
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                void desktop.toggleFullscreen();
              }}
              aria-label="تبديل ملء الشاشة (F11)"
              title="ملء الشاشة (F11)"
              className="pointer-events-auto iron-btn flex h-10 w-10 items-center justify-center rounded-sm cursor-pointer"
            >
              <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
              </svg>
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleMute();
            }}
            aria-label={muted ? 'تشغيل الصوت' : 'كتم الصوت'}
            className="pointer-events-auto iron-btn flex h-10 w-10 items-center justify-center rounded-sm cursor-pointer"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M11 5L6 9H3v6h3l5 4V5z" />
              {muted ? (
                <path d="M22 9l-6 6M16 9l6 6" stroke="#c95449" />
              ) : (
                <>
                  <path d="M15.5 8.5a5 5 0 0 1 0 7" />
                  <path d="M18.5 5.5a9 9 0 0 1 0 13" />
                </>
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Asymmetric Right-Third Title Lockup over Calm Negative Space */}
      <div className="my-auto max-w-md self-start pointer-events-auto">
        <div className="relative py-5 px-4 mb-5">
          {/* Bespoke Inline SVG Brass Dossier Frame & Corner Ticks */}
          <svg
            viewBox="0 0 420 146"
            preserveAspectRatio="none"
            className="pointer-events-none absolute inset-0 h-full w-full"
            aria-hidden="true"
          >
            <path d="M2 22 V2 H26" stroke="#b99353" strokeWidth="2.2" fill="none" opacity="0.85" />
            <path d="M418 22 V2 H394" stroke="#b99353" strokeWidth="2.2" fill="none" opacity="0.85" />
            <path d="M2 124 V144 H26" stroke="#b99353" strokeWidth="2.2" fill="none" opacity="0.85" />
            <path d="M418 124 V144 H394" stroke="#b99353" strokeWidth="2.2" fill="none" opacity="0.85" />
            <line x1="18" y1="14" x2="402" y2="14" stroke="#8f6b32" strokeWidth="1" opacity="0.45" />
            <line x1="18" y1="132" x2="402" y2="132" stroke="#8f6b32" strokeWidth="1" opacity="0.45" />
          </svg>

          <div className="relative flex items-center justify-between gap-4 py-1">
            <div>
              <h1
                className="font-serif-ar text-4xl sm:text-5xl font-bold text-[#f3e7d2] leading-tight"
                style={{ textShadow: '0 4px 18px rgba(0, 0, 0, 0.9)' }}
              >
                غرفة التحقيق
              </h1>
              <p className="text-xs sm:text-sm font-bold text-[#cfa55b] mt-1.5 tracking-wide">
                تحقيق جنائي ورعب نفسي من منظور الشخص الأول
              </p>
            </div>

            {/* Bespoke Inline SVG Stamp Crest Emblem "404" */}
            <svg
              viewBox="0 0 80 80"
              className="h-[74px] w-[74px] shrink-0"
              role="img"
              aria-label="ملف سري 404"
            >
              <rect
                x="2"
                y="2"
                width="76"
                height="76"
                rx="4"
                fill="rgba(139, 32, 26, 0.2)"
                stroke="#b03a31"
                strokeWidth="2"
              />
              <rect
                x="8"
                y="8"
                width="64"
                height="64"
                fill="none"
                stroke="#b03a31"
                strokeWidth="1"
                strokeDasharray="3 2"
              />
              <text
                x="40"
                y="46"
                textAnchor="middle"
                direction="ltr"
                fill="#e2c082"
                fontFamily="JetBrains Mono, monospace"
                fontWeight="700"
                fontSize="26"
              >
                404
              </text>
              <text
                x="40"
                y="63"
                textAnchor="middle"
                direction="ltr"
                fill="#c9564c"
                fontFamily="JetBrains Mono, monospace"
                fontWeight="700"
                fontSize="9"
                letterSpacing="1.2"
              >
                CLASSIFIED
              </text>
            </svg>
          </div>
        </div>

        <p className="text-sm sm:text-base leading-relaxed text-[#d4cbb9] mb-7 max-w-sm">
          استيقظت محبوساً داخل غرفة التحقيق ٤٠٤. افحص الأدلة الخمسة المبعثرة بعناية لاكتشاف رمز الخروج وكشف الحقيقة.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            data-start="true"
            onClick={(e) => {
              e.currentTarget.blur();
              onStart();
            }}
            className="brass-btn px-8 py-3.5 rounded-sm text-base font-bold tracking-wide cursor-pointer flex items-center gap-3"
          >
            <span>ابدأ التحقيق</span>
            <svg viewBox="0 0 24 24" className="h-5 w-5 rotate-180" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M5 12h14M13 5l7 7-7 7" />
            </svg>
          </button>
          {desktop && (
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                void desktop.quitApp();
              }}
              className="iron-btn px-5 py-3.5 rounded-sm text-sm font-bold tracking-wide cursor-pointer"
            >
              خروج إلى سطح المكتب
            </button>
          )}
        </div>
      </div>

      {/* Single Flat Borderless Control Hint Line */}
      <div className="text-center text-xs sm:text-sm text-[#c4b9a6]/90 tracking-wide">
        WASD الحركة · الماوس النظر · نقر / E الفحص والتفاعل · F الكشاف · L سجل الأدلة · Esc إيقاف
      </div>
    </div>
  );
};
