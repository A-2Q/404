import { useCallback, useEffect, useRef, useState } from 'react';
import { Room404Engine } from './game/gameEngine';
import type { EvidenceId, HudSnapshot } from './game/types';
import { TitleScreen } from './components/TitleScreen';
import { GameHud } from './components/GameHud';
import { InspectionOverlay } from './components/InspectionOverlay';
import { EvidenceLogModal } from './components/EvidenceLogModal';
import { KeypadModal } from './components/KeypadModal';
import { StatusModal } from './components/StatusModal';

const INITIAL_HUD: HudSnapshot = {
  phase: 'title',
  mode: 'explore',
  pointerLocked: false,
  flashlightOn: true,
  muted: false,
  loggedEvidence: [],
  discoveredEvidence: [],
  activeEvidenceId: null,
  hoverTarget: null,
  truthTension: 0.12,
  elapsedSeconds: 0,
  keypadAttempts: 0,
  keypadError: null,
  doorUnlocked: false,
  toastMessage: null,
  runStats: null,
};

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<Room404Engine | null>(null);
  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);

  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    const engine = new Room404Engine(mount, (nextSnapshot) => {
      setHud(nextSnapshot);
    });
    engineRef.current = engine;

    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      engine.startGame();
    }

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const handleStart = useCallback(() => engineRef.current?.startGame(), []);
  const handleResume = useCallback(() => engineRef.current?.resumeGame(), []);
  const handlePause = useCallback(() => engineRef.current?.pauseGame(), []);
  const handleRestart = useCallback(() => engineRef.current?.restartGame(), []);
  const handleTitle = useCallback(() => engineRef.current?.returnToTitle(), []);
  const handleOpenLog = useCallback(() => engineRef.current?.openLog(), []);
  const handleOpenKeypad = useCallback(() => engineRef.current?.openKeypad(), []);
  const handleCloseModal = useCallback(() => engineRef.current?.closeModal(), []);
  const handleToggleFlashlight = useCallback(() => engineRef.current?.toggleFlashlight(), []);
  const handleToggleMute = useCallback(() => engineRef.current?.toggleMute(), []);
  const handleRequestPointerLock = useCallback(() => engineRef.current?.requestPointerLock(), []);
  const handleLogCurrent = useCallback(() => engineRef.current?.logCurrentEvidence(), []);
  const handleFlipInspect = useCallback(() => engineRef.current?.rotateInspection(Math.PI, 0), []);
  const handleInspectById = useCallback((id: EvidenceId) => engineRef.current?.inspectEvidence(id), []);
  const handleKeypadDigit = useCallback((d: number) => engineRef.current?.pressKeypadDigit(d), []);
  const handleKeypadSubmit = useCallback(
    (code: string) => engineRef.current?.submitKeypadCode(code) ?? false,
    [],
  );

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#05070a]">
      {/* Isolated WebGL Canvas Container — never unmounted on HUD state updates */}
      <div ref={canvasMountRef} className="fixed inset-0 z-0" />

      {/* Title Screen */}
      {hud.phase === 'title' && (
        <TitleScreen
          muted={hud.muted}
          onStart={handleStart}
          onToggleMute={handleToggleMute}
        />
      )}

      {/* Active Playing HUD */}
      {hud.phase === 'playing' && (
        <GameHud
          hud={hud}
          onOpenLog={handleOpenLog}
          onOpenKeypad={handleOpenKeypad}
          onToggleFlashlight={handleToggleFlashlight}
          onToggleMute={handleToggleMute}
          onPause={handlePause}
          onRequestPointerLock={handleRequestPointerLock}
        />
      )}

      {/* 3D Object Inspection Mode Overlay */}
      {hud.phase === 'playing' && hud.mode === 'inspecting' && hud.activeEvidenceId && (
        <InspectionOverlay
          evidenceId={hud.activeEvidenceId}
          isLogged={hud.loggedEvidence.includes(hud.activeEvidenceId)}
          onLog={handleLogCurrent}
          onFlip={handleFlipInspect}
          onClose={handleCloseModal}
        />
      )}

      {/* Forensic Evidence Log Dossier Modal */}
      {hud.phase === 'playing' && hud.mode === 'log' && (
        <EvidenceLogModal
          loggedEvidence={hud.loggedEvidence}
          discoveredEvidence={hud.discoveredEvidence}
          onInspect={handleInspectById}
          onOpenKeypad={handleOpenKeypad}
          onClose={handleCloseModal}
        />
      )}

      {/* Digital Door Keypad Modal */}
      {hud.phase === 'playing' && hud.mode === 'keypad' && (
        <KeypadModal
          attempts={hud.keypadAttempts}
          errorMessage={hud.keypadError}
          onDigitPress={handleKeypadDigit}
          onSubmit={handleKeypadSubmit}
          onClose={handleCloseModal}
        />
      )}

      {/* Pause Modal */}
      {hud.phase === 'paused' && (
        <StatusModal
          variant="paused"
          onResume={handleResume}
          onRestart={handleRestart}
          onTitle={handleTitle}
        />
      )}

      {/* Victory / Escaped Room 404 Modal */}
      {hud.phase === 'gameover' && (
        <StatusModal
          variant="victory"
          stats={hud.runStats}
          onRestart={handleRestart}
          onTitle={handleTitle}
        />
      )}
    </main>
  );
}
