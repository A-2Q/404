export type GamePhase = 'title' | 'playing' | 'paused' | 'gameover';

export type InteractionMode = 'explore' | 'inspecting' | 'log' | 'keypad';

export type EvidenceId =
  | 'torn_note'
  | 'pocket_watch'
  | 'medicine_bottle'
  | 'brass_key'
  | 'burned_photo';

export type InteractableKind = 'evidence' | 'drawer' | 'keypad' | 'door';

export interface EvidenceDefinition {
  id: EvidenceId;
  title: string;
  subtitle: string;
  locationHint: string;
  materialSound: 'paper' | 'metal' | 'glass';
  digitIndex: number | null; // 0..3 for digits, null for order cipher
  digitValue: string | null;
  inspectHint: string;
  frontSummary: string;
  backSecret: string;
  logEntry: string;
}

export interface ColliderAABB {
  id: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface RoomBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface HoverTargetInfo {
  id: string;
  kind: InteractableKind;
  label: string;
  actionHint: string;
  evidenceId?: EvidenceId;
}

export interface RunStats {
  elapsedSeconds: number;
  evidenceLogged: number;
  totalEvidence: number;
  keypadAttempts: number;
  escaped: boolean;
}

export interface HudSnapshot {
  phase: GamePhase;
  mode: InteractionMode;
  pointerLocked: boolean;
  flashlightOn: boolean;
  muted: boolean;
  loggedEvidence: EvidenceId[];
  discoveredEvidence: EvidenceId[];
  activeEvidenceId: EvidenceId | null;
  hoverTarget: HoverTargetInfo | null;
  truthTension: number; // 0..1
  elapsedSeconds: number;
  keypadAttempts: number;
  keypadError: string | null;
  doorUnlocked: boolean;
  toastMessage: string | null;
  runStats: RunStats | null;
}
