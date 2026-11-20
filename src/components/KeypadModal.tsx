import React, { useEffect, useState } from 'react';

interface KeypadModalProps {
  attempts: number;
  errorMessage: string | null;
  onDigitPress: (digit: number) => void;
  onSubmit: (code: string) => boolean;
  onClose: () => void;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '↵'];

export const KeypadModal: React.FC<KeypadModalProps> = ({
  attempts,
  errorMessage,
  onDigitPress,
  onSubmit,
  onClose,
}) => {
  const [code, setCode] = useState('');
  const codeRef = React.useRef('');
  codeRef.current = code;

  const handleKey = (key: string) => {
    if (key === 'C') {
      setCode('');
      onDigitPress(0);
      return;
    }
    if (key === '↵') {
      if (codeRef.current.length === 4) {
        const ok = onSubmit(codeRef.current);
        if (!ok) setCode('');
      }
      return;
    }
    if (codeRef.current.length < 4) {
      onDigitPress(Number(key));
      setCode(codeRef.current + key);
    }
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        if (codeRef.current.length < 4) {
          onDigitPress(Number(e.key));
          setCode(codeRef.current + e.key);
        }
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        setCode(codeRef.current.slice(0, -1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (codeRef.current.length === 4) {
          const ok = onSubmit(codeRef.current);
          if (!ok) setCode('');
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onDigitPress, onSubmit]);

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(4, 5, 8, 0.84)' }}
      role="dialog"
      aria-modal="true"
      aria-label="القفل الرقمي لباب غرفة التحقيق 404"
    >
      <div className="dossier-surface w-full max-w-sm rounded-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="font-mono-code text-[11px] tracking-[0.2em] text-[#b99353]">
              DOOR LOCK // 404
            </div>
            <h2 className="text-lg font-bold text-[#f2e7d3] font-serif-ar">القفل الرقمي للباب</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق القفل الرقمي"
            className="iron-btn px-3 py-1.5 rounded-sm text-xs font-bold cursor-pointer"
          >
            إغلاق [Esc]
          </button>
        </div>

        {/* Diegetic Recessed LED Screen */}
        <div
          className="rounded-sm px-4 py-4 mb-4 text-center"
          style={{
            backgroundColor: '#07110b',
            border: '2px solid #2e3732',
            boxShadow: 'inset 0 4px 14px rgba(0,0,0,0.85)',
          }}
        >
          <div
            className="font-mono-code text-3xl font-bold tracking-[0.45em]"
            dir="ltr"
            data-testid="keypad-display"
            style={{ color: errorMessage ? '#e05347' : '#8ce3a5' }}
          >
            {code.padEnd(4, '•')}
          </div>
          <div className="text-[11px] text-[#7a8f82] mt-1.5">
            {errorMessage ? (
              <span className="text-[#e06459] font-semibold">{errorMessage}</span>
            ) : (
              <span>أدخل رمز الخروج المكون من ٤ أرقام</span>
            )}
          </div>
        </div>

        {/* 3x4 Tactile Steel Keypad Grid */}
        <div className="grid grid-cols-3 gap-2.5" dir="ltr">
          {KEYS.map((k) => {
            const isConfirm = k === '↵';
            const isClear = k === 'C';
            return (
              <button
                key={k}
                type="button"
                onClick={() => handleKey(k)}
                aria-label={isConfirm ? 'تأكيد الرمز' : isClear ? 'مسح الرمز' : `الرقم ${k}`}
                className={
                  isConfirm
                    ? 'brass-btn h-13 rounded-sm font-mono-code text-lg font-bold cursor-pointer'
                    : 'iron-btn h-13 rounded-sm font-mono-code text-xl font-bold cursor-pointer'
                }
                style={isClear ? { color: '#de766b' } : undefined}
              >
                {k}
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex items-center justify-between text-[11px] text-[#9c9180]">
          <span>المحاولات: {attempts}</span>
          <span>يمكنك الكتابة بلوحة المفاتيح</span>
        </div>
      </div>
    </div>
  );
};
