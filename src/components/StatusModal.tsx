import React from 'react';
import { getDesktopBridge } from '../game/desktopBridge';
import type { RunStats } from '../game/types';

interface StatusModalProps {
  variant: 'paused' | 'victory';
  stats?: RunStats | null;
  onResume?: () => void;
  onRestart: () => void;
  onTitle: () => void;
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const StatusModal: React.FC<StatusModalProps> = ({
  variant,
  stats,
  onResume,
  onRestart,
  onTitle,
}) => {
  const isVictory = variant === 'victory';
  const desktop = getDesktopBridge();

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(4, 5, 8, 0.86)' }}
      role="dialog"
      aria-modal="true"
      aria-label={isVictory ? 'اكتشاف الحقيقة والخروج من الغرفة 404' : 'إيقاف مؤقت'}
    >
      <div className="dossier-surface w-full max-w-md rounded-sm p-6 sm:p-7 text-center">
        <div className="font-mono-code text-xs tracking-[0.22em] text-[#c49c56] mb-1">
          {isVictory ? 'CASE 404 // RESOLVED' : 'INVESTIGATION PAUSED'}
        </div>

        <h2 className="text-2xl sm:text-3xl font-bold font-serif-ar text-[#f4ead6]">
          {isVictory ? 'فُتح باب الغرفة ٤٠٤' : 'إيقاف التحقيق مؤقتاً'}
        </h2>

        <p className="text-sm text-[#cfc5b4] leading-relaxed mt-3 mb-6">
          {isVictory
            ? 'الرمز 7419 حرر القفل الثقيل... لكن خلف الباب لم يكن الممر فارغاً. كل دليل جمعناه كان يروي قصتك أنت يا محقق طارق.'
            : 'توقفت مجريات التحقيق مؤقتاً. يمكنك العودة لفحص الغرفة أو بدء جولة جديدة.'}
        </p>

        {isVictory && stats && (
          <div className="grid grid-cols-3 gap-2.5 mb-6">
            <div className="p-3 rounded-sm bg-[#0c0d10] border border-[#a88854]/30">
              <div className="text-[11px] text-[#a99e8d]">زمن الهروب</div>
              <div className="font-mono-code text-lg font-bold text-[#f2e6cf] mt-1">
                {formatDuration(stats.elapsedSeconds)}
              </div>
            </div>
            <div className="p-3 rounded-sm bg-[#0c0d10] border border-[#a88854]/30">
              <div className="text-[11px] text-[#a99e8d]">الأدلة المدوّنة</div>
              <div className="font-mono-code text-lg font-bold text-[#f2e6cf] mt-1">
                {stats.evidenceLogged}/{stats.totalEvidence}
              </div>
            </div>
            <div className="p-3 rounded-sm bg-[#0c0d10] border border-[#a88854]/30">
              <div className="text-[11px] text-[#a99e8d]">محاولات القفل</div>
              <div className="font-mono-code text-lg font-bold text-[#f2e6cf] mt-1">
                {stats.keypadAttempts}
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2.5">
          {!isVictory && onResume && (
            <button
              type="button"
              onClick={onResume}
              className="brass-btn w-full py-3 rounded-sm text-sm font-bold cursor-pointer"
            >
              متابعة التحقيق
            </button>
          )}

          <button
            type="button"
            data-start={isVictory ? 'true' : undefined}
            onClick={onRestart}
            className={
              isVictory
                ? 'brass-btn w-full py-3 rounded-sm text-sm font-bold cursor-pointer'
                : 'iron-btn w-full py-2.5 rounded-sm text-sm font-bold cursor-pointer'
            }
          >
            {isVictory ? 'إعادة التحقيق من جديد' : 'إعادة تشغيل الغرفة'}
          </button>

          <button
            type="button"
            onClick={onTitle}
            className="iron-btn w-full py-2.5 rounded-sm text-sm font-bold cursor-pointer"
          >
            العودة إلى القائمة الرئيسية
          </button>

          {desktop && (
            <button
              type="button"
              onClick={() => void desktop.quitApp()}
              className="iron-btn w-full py-2.5 rounded-sm text-sm font-bold cursor-pointer text-[#e2857b]"
            >
              خروج إلى سطح المكتب
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
