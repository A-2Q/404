import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type {
  EvidenceId,
  GamePhase,
  HoverTargetInfo,
  HudSnapshot,
  InteractableKind,
  InteractionMode,
  RunStats,
} from './types';
import {
  EVIDENCE_LIST,
  EVIDENCE_MAP,
  advanceHeadBob,
  computeTruthTension,
  recordEvidenceId,
  resolveSlidingCollision,
  validateExitCode,
} from './puzzleLogic';
import { createRoomTextureLibrary, type RoomTextureLibrary } from './textureEngine';
import { buildInvestigationRoom, type BuiltRoom } from './roomBuilder';
import { ProceduralAudioEngine } from './audioEngine';

const EYE_HEIGHT = 1.66;
const PLAYER_RADIUS = 0.36;
const WALK_SPEED = 2.45;
const RUN_SPEED = 3.35;
const INTERACT_RANGE = 3.6;

function detectSoftwareGl(): boolean {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export class Room404Engine {
  private container: HTMLElement;
  private onHudChange: (snapshot: HudSnapshot) => void;
  private isSoftwareGl: boolean;

  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private textures: RoomTextureLibrary;
  private room: BuiltRoom;
  private audio: ProceduralAudioEngine;

  // Lights
  private flashlight: THREE.SpotLight;
  private flashlightTarget: THREE.Object3D;
  private inspectLight: THREE.PointLight;

  // Inspection rig (positioned directly in front of camera)
  private inspectAnchor: THREE.Group;
  private activeEvidenceId: EvidenceId | null = null;
  private inspectRotX = 0;
  private inspectRotY = 0;
  private inspectTargetRotX = 0;
  private inspectTargetRotY = 0;
  private inspectDragging = false;
  private lastPointerX = 0;
  private lastPointerY = 0;

  // Player state
  private playerPos = new THREE.Vector3(0, EYE_HEIGHT, 2.58);
  private yaw = 0; // 0 looks along -Z (toward desk & moonlit window)
  private pitch = -0.07;
  private bobPhase = 0;
  private bobBlend = 0;
  private cameraTrauma = 0;
  private dragLooking = false;

  // Flashlight inertial sway state
  private flashPos = new THREE.Vector3(0.24, EYE_HEIGHT - 0.16, 2.48);
  private flashAim = new THREE.Vector3(0, 1.4, -1.0);

  // Game State Machine
  private phase: GamePhase = 'title';
  private mode: InteractionMode = 'explore';
  private pointerLocked = false;
  private flashlightOn = true;
  private loggedEvidence: EvidenceId[] = [];
  private discoveredEvidence: EvidenceId[] = [];
  private hoverTarget: HoverTargetInfo | null = null;
  private elapsedSeconds = 0;
  private keypadAttempts = 0;
  private keypadError: string | null = null;
  private doorUnlocked = false;
  private doorOpenProgress = 0;
  private victoryDelayTimer = 0;
  private toastMessage: string | null = null;
  private toastTimer = 0;
  private runStats: RunStats | null = null;

  // Input state
  private keysHeld = new Set<string>();
  private raycaster = new THREE.Raycaster();
  private centerNdc = new THREE.Vector2(0, 0);
  private lastRaycastTime = 0;
  private lastHudPushTime = 0;

  // Loop management
  private frameId = 0;
  private lastTimestamp = 0;
  private totalTime = 0;
  private disposed = false;

  // Flicker state
  private flickerTimer = 0;
  private flickerTargetIntensity = 2.8;
  private flickerCurrentIntensity = 2.8;

  // Pre-allocated scratch objects (Zero GC inside render loop)
  private readonly _forward = new THREE.Vector3();
  private readonly _right = new THREE.Vector3();
  private readonly _move = new THREE.Vector3();
  private readonly _camDir = new THREE.Vector3();
  private readonly _camRight = new THREE.Vector3();
  private readonly _camUp = new THREE.Vector3();
  private readonly _desiredFlashPos = new THREE.Vector3();
  private readonly _desiredFlashAim = new THREE.Vector3();
  private readonly _euler = new THREE.Euler(0, 0, 0, 'YXZ');
  private readonly _quatX = new THREE.Quaternion();
  private readonly _quatY = new THREE.Quaternion();
  private readonly _axisX = new THREE.Vector3(1, 0, 0);
  private readonly _axisY = new THREE.Vector3(0, 1, 0);
  private readonly _resizeObserver: ResizeObserver;

  constructor(container: HTMLElement, onHudChange: (snapshot: HudSnapshot) => void) {
    this.container = container;
    this.onHudChange = onHudChange;
    this.isSoftwareGl = detectSoftwareGl();

    // 1. Renderer setup (Modern PBR + Software-WebGL Guard)
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.18;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const rect = this.container.getBoundingClientRect();
    const initW = Math.max(1, rect.width || window.innerWidth);
    const initH = Math.max(1, rect.height || window.innerHeight);
    this.renderer.setSize(initW, initH);
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.setAttribute('data-testid', 'room404-canvas');
    this.container.appendChild(this.renderer.domElement);

    // 2. Scene, FogExp2 & RoomEnvironment IBL
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x05070c);
    this.scene.fog = new THREE.FogExp2(0x05070c, 0.084);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.26;
    pmrem.dispose();

    // 3. Camera
    this.camera = new THREE.PerspectiveCamera(64, initW / initH, 0.06, 30);
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);

    // 4. Procedural PBR Textures & Composite 3D Room
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.textures = createRoomTextureLibrary(maxAniso);
    this.room = buildInvestigationRoom(this.scene, this.textures, this.isSoftwareGl);
    this.audio = new ProceduralAudioEngine();

    // 5. Atmospheric Lighting Rig (Moonlight + Hemisphere Fill + Inertial Shadow-Casting Flashlight + Inspect Light)
    const hemi = new THREE.HemisphereLight(0x476594, 0x221810, 0.42);
    this.scene.add(hemi);

    const moonDir = new THREE.DirectionalLight(0x7ca6de, 0.85);
    moonDir.position.set(0.5, 3.1, -5.2);
    moonDir.target.position.set(0, 0.6, 0.5);
    this.scene.add(moonDir, moonDir.target);

    // Subtle cold corridor light behind the exit door
    const exitGlow = new THREE.PointLight(0x9ec5f0, 1.4, 5.0, 2);
    exitGlow.position.set(0, 1.8, 4.4);
    this.scene.add(exitGlow);

    // Player Handheld Flashlight (SpotLight with physical inertia & castShadow)
    this.flashlight = new THREE.SpotLight(0xfff1d6, 5.4, 14.5, Math.PI / 5.4, 0.58, 1.45);
    this.flashlight.castShadow = !this.isSoftwareGl;
    this.flashlight.shadow.mapSize.set(1024, 1024);
    this.flashlight.shadow.camera.near = 0.25;
    this.flashlight.shadow.camera.far = 14;
    this.flashlight.shadow.bias = -0.0005;
    this.flashlight.shadow.normalBias = 0.02;

    this.flashlightTarget = new THREE.Object3D();
    this.scene.add(this.flashlight, this.flashlightTarget);
    this.flashlight.target = this.flashlightTarget;

    // Dedicated Inspection Studio Light (illuminates 3D artifacts clearly during inspection)
    this.inspectLight = new THREE.PointLight(0xfff4df, 0, 2.4, 1.2);
    this.inspectLight.position.set(0.18, 0.16, -0.1);
    this.camera.add(this.inspectLight);

    // Anchor for 3D inspected object directly in upper-center of camera viewport
    this.inspectAnchor = new THREE.Group();
    this.inspectAnchor.position.set(0, 0.055, -0.45);
    this.camera.add(this.inspectAnchor);

    // Pre-warm shaders on GPU
    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    // ResizeObserver for live viewport resizing
    this._resizeObserver = new ResizeObserver(() => this.handleResize());
    this._resizeObserver.observe(this.container);

    this.bindEvents();
    this.syncBodyDataset();
    this.emitHud(true);

    // Position live Title Screen camera immediately and render first frame synchronously
    this.updateTitleCamera(0);
    this.updateAtmosphere(0.016);
    this.renderer.render(this.scene, this.camera);

    // Start paced loop
    this.lastTimestamp = performance.now();
    this.scheduleNextFrame();
  }

  private handleResize(): void {
    if (this.disposed) return;
    const rect = this.container.getBoundingClientRect();
    const w = Math.max(1, rect.width);
    const h = Math.max(1, rect.height);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  private bindEvents(): void {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onWindowBlur);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
    document.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mouseup', this.onMouseUp);

    const canvas = this.renderer.domElement;
    canvas.addEventListener('mousedown', this.onCanvasMouseDown);
  }

  private unbindEvents(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onWindowBlur);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    document.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mouseup', this.onMouseUp);

    const canvas = this.renderer.domElement;
    canvas.removeEventListener('mousedown', this.onCanvasMouseDown);
  }

  private onWindowBlur = (): void => {
    this.keysHeld.clear();
    this.inspectDragging = false;
    this.dragLooking = false;
  };

  private onVisibilityChange = (): void => {
    if (document.hidden) {
      this.keysHeld.clear();
      this.inspectDragging = false;
      this.dragLooking = false;
    }
  };

  private onPointerLockChange = (): void => {
    this.pointerLocked = document.pointerLockElement === this.renderer.domElement;
    this.emitHud(true);
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.disposed) return;
    const code = e.code;

    // Title screen start via Enter / Space
    if (this.phase === 'title') {
      if (code === 'Enter' || code === 'Space') {
        e.preventDefault();
        this.startGame();
      }
      return;
    }

    // Global Mute [M]
    if (code === 'KeyM' && !e.repeat) {
      this.toggleMute();
      return;
    }

    if (this.phase === 'paused') {
      if ((code === 'Escape' || code === 'KeyP') && !e.repeat) {
        e.preventDefault();
        this.resumeGame();
      }
      return;
    }

    if (this.phase !== 'playing') return;

    // Escape closes sub-modes first, otherwise pauses game
    if (code === 'Escape' && !e.repeat) {
      e.preventDefault();
      if (this.mode !== 'explore') {
        this.closeModal();
      } else {
        this.pauseGame();
      }
      return;
    }

    // Pause shortcut [P]
    if (code === 'KeyP' && !e.repeat && this.mode === 'explore') {
      e.preventDefault();
      this.pauseGame();
      return;
    }

    // Evidence Log toggle [L] or [Tab]
    if ((code === 'KeyL' || code === 'Tab') && !e.repeat) {
      e.preventDefault();
      if (this.mode === 'log') {
        this.closeModal();
      } else if (this.mode === 'explore') {
        this.openLog();
      }
      return;
    }

    // Flashlight toggle [F]
    if (code === 'KeyF' && !e.repeat && this.mode === 'explore') {
      this.toggleFlashlight();
      return;
    }

    // Interact via [E] or [Space] while exploring
    if ((code === 'KeyE' || code === 'Space') && !e.repeat && this.mode === 'explore') {
      e.preventDefault();
      this.triggerCenterInteraction();
      return;
    }

    // Quick log current evidence with [Enter] in inspection mode
    if (code === 'Enter' && !e.repeat && this.mode === 'inspecting') {
      e.preventDefault();
      this.logCurrentEvidence();
      return;
    }

    this.keysHeld.add(code);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keysHeld.delete(e.code);
  };

  private onCanvasMouseDown = (e: MouseEvent): void => {
    if (this.disposed || this.phase !== 'playing') return;

    if (this.mode === 'inspecting') {
      if (e.button === 0) {
        this.inspectDragging = true;
        this.lastPointerX = e.clientX;
        this.lastPointerY = e.clientY;
      }
      return;
    }

    if (this.mode !== 'explore') return;

    // When pointer-locked, left click directly interacts with centered reticle target
    if (this.pointerLocked) {
      if (e.button === 0) {
        this.triggerCenterInteraction();
      }
      return;
    }

    // When not pointer-locked: if clicking directly on a hovered interactable, trigger it!
    // Otherwise request PointerLock (and allow drag-look fallback if PointerLock fails/rejected)
    if (e.button === 0) {
      this.updateHoverFromPoint(e.clientX, e.clientY);
      if (this.hoverTarget) {
        this.triggerInteraction(this.hoverTarget);
        return;
      }
      this.dragLooking = true;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
      try {
        this.renderer.domElement.requestPointerLock?.();
      } catch {
        // Fallback drag look remains active
      }
    }
  };

  private onMouseMove = (e: MouseEvent): void => {
    if (this.disposed || this.phase !== 'playing') return;

    if (this.mode === 'inspecting' && this.inspectDragging) {
      const dx = e.clientX - this.lastPointerX;
      const dy = e.clientY - this.lastPointerY;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
      this.inspectTargetRotY += dx * 0.011;
      this.inspectTargetRotX += dy * 0.011;
      return;
    }

    if (this.mode === 'explore') {
      if (this.pointerLocked) {
        this.yaw -= e.movementX * 0.0022;
        this.pitch = Math.max(-1.38, Math.min(1.38, this.pitch - e.movementY * 0.0022));
      } else if (this.dragLooking) {
        const dx = e.clientX - this.lastPointerX;
        const dy = e.clientY - this.lastPointerY;
        this.lastPointerX = e.clientX;
        this.lastPointerY = e.clientY;
        this.yaw -= dx * 0.0045;
        this.pitch = Math.max(-1.38, Math.min(1.38, this.pitch - dy * 0.0045));
      }
    }
  };

  private onMouseUp = (): void => {
    this.inspectDragging = false;
    this.dragLooking = false;
  };

  // =========================================================================
  // PUBLIC API FOR REACT SHELL & CONTROLS
  // =========================================================================

  public startGame(): void {
    this.audio.startAmbientDrone();
    this.audio.setPaused(false);
    this.resetWorldState();
    this.phase = 'playing';
    this.mode = 'explore';
    this.keysHeld.clear();
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    this.syncBodyDataset();
    this.emitHud(true);
  }

  public restartGame(): void {
    this.startGame();
  }

  public pauseGame(): void {
    if (this.phase !== 'playing') return;
    if (this.mode === 'inspecting') {
      this.restoreInspectedEvidence();
    }
    this.mode = 'explore';
    this.phase = 'paused';
    this.keysHeld.clear();
    this.audio.setPaused(true);
    document.exitPointerLock?.();
    this.syncBodyDataset();
    this.emitHud(true);
  }

  public resumeGame(): void {
    if (this.phase !== 'paused') return;
    this.phase = 'playing';
    this.mode = 'explore';
    this.keysHeld.clear();
    this.audio.setPaused(false);
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    this.syncBodyDataset();
    this.emitHud(true);
  }

  public returnToTitle(): void {
    if (this.mode === 'inspecting') {
      this.restoreInspectedEvidence();
    }
    this.phase = 'title';
    this.mode = 'explore';
    this.keysHeld.clear();
    this.audio.setPaused(true);
    document.exitPointerLock?.();
    this.syncBodyDataset();
    this.emitHud(true);
  }

  public openLog(): void {
    if (this.phase !== 'playing') return;
    if (this.mode === 'inspecting') {
      this.restoreInspectedEvidence();
    }
    this.mode = 'log';
    this.keysHeld.clear();
    document.exitPointerLock?.();
    this.audio.playPaperPickup();
    this.syncBodyDataset();
    this.emitHud(true);
  }

  public openKeypad(): void {
    if (this.phase !== 'playing' || this.doorUnlocked) return;
    if (this.mode === 'inspecting') {
      this.restoreInspectedEvidence();
    }
    this.mode = 'keypad';
    this.keypadError = null;
    this.keysHeld.clear();
    document.exitPointerLock?.();
    this.syncBodyDataset();
    this.emitHud(true);
  }

  public closeModal(): void {
    if (this.mode === 'inspecting') {
      this.restoreInspectedEvidence();
    }
    this.mode = 'explore';
    this.keypadError = null;
    this.inspectDragging = false;
    this.keysHeld.clear();
    this.syncBodyDataset();
    this.emitHud(true);
  }

  public inspectEvidence(id: EvidenceId): void {
    if (this.phase !== 'playing') return;
    const handle = this.room.evidenceHandles.get(id);
    if (!handle) return;

    if (this.activeEvidenceId && this.activeEvidenceId !== id) {
      this.restoreInspectedEvidence();
    }

    this.activeEvidenceId = id;
    this.mode = 'inspecting';
    this.keysHeld.clear();
    document.exitPointerLock?.();

    if (!this.discoveredEvidence.includes(id)) {
      this.discoveredEvidence = [...this.discoveredEvidence, id];
    }

    // Play authentic material-matched pickup sound
    const def = EVIDENCE_MAP[id];
    if (def.materialSound === 'paper') this.audio.playPaperPickup();
    else if (def.materialSound === 'metal') this.audio.playMetalPickup();
    else this.audio.playGlassPickup();

    // Move 3D composite object into camera's inspection anchor
    handle.glowRing.visible = false;
    this.inspectAnchor.add(handle.group);
    handle.group.position.set(0, 0, 0);
    handle.group.scale.setScalar(handle.inspectScale);
    handle.group.rotation.copy(handle.inspectBaseEuler);

    this.inspectRotX = 0;
    this.inspectRotY = 0;
    this.inspectTargetRotX = 0;
    this.inspectTargetRotY = 0;

    this.syncBodyDataset();
    this.emitHud(true);
  }

  public rotateInspection(deltaY: number, deltaX: number): void {
    if (this.mode !== 'inspecting') return;
    this.inspectTargetRotY += deltaY;
    this.inspectTargetRotX += deltaX;
  }

  public logCurrentEvidence(): void {
    if (!this.activeEvidenceId) return;
    const id = this.activeEvidenceId;
    const prevLen = this.loggedEvidence.length;
    this.loggedEvidence = recordEvidenceId(this.loggedEvidence, id);

    if (this.loggedEvidence.length > prevLen) {
      this.audio.playLogStamp();
      const tension = computeTruthTension(this.loggedEvidence.length, EVIDENCE_LIST.length);
      this.audio.setTension(tension);
      const def = EVIDENCE_MAP[id];
      this.showToast(`تم تدوين الدليل: ${def.title} (${this.loggedEvidence.length}/${EVIDENCE_LIST.length})`);
    } else {
      this.showToast('هذا الدليل مدوّن مسبقاً في سجل التحقيق');
    }
    this.emitHud(true);
  }

  public pressKeypadDigit(digit: number): void {
    this.audio.playKeypadBeep(digit);
  }

  public submitKeypadCode(code: string): boolean {
    if (this.doorUnlocked) return true;
    this.keypadAttempts += 1;

    if (validateExitCode(code)) {
      this.doorUnlocked = true;
      this.keypadError = null;
      this.mode = 'explore';
      this.audio.playDoorUnlock();
      this.room.keypadLedMat.color.setHex(0x22d37a);
      this.room.keypadLedMat.emissive.setHex(0x22d37a);
      this.showToast('تم قبول الرمز 7419 — باب غرفة التحقيق 404 يُفتح الآن!');
      this.victoryDelayTimer = 1.6;
      // Gently turn player toward the South exit door to witness it swinging open
      this.yaw = Math.PI;
      this.pitch = -0.04;
      this.syncBodyDataset();
      this.emitHud(true);
      return true;
    }

    this.audio.playKeypadError();
    this.cameraTrauma = Math.min(1, this.cameraTrauma + 0.55);
    this.keypadError = 'الرمز غير صحيح — راجع الأدلة المدوّنة في السجل';
    this.emitHud(true);
    return false;
  }

  public toggleFlashlight(): void {
    this.flashlightOn = !this.flashlightOn;
    this.audio.playFlashlightClick();
    this.emitHud(true);
  }

  public toggleMute(): void {
    this.audio.setMuted(!this.audio.isMuted());
    this.emitHud(true);
  }

  public requestPointerLock(): void {
    if (this.phase === 'playing' && this.mode === 'explore') {
      try {
        this.renderer.domElement.requestPointerLock?.();
      } catch {
        // Ignore browser rejection
      }
    }
  }

  private resetWorldState(): void {
    if (this.activeEvidenceId) {
      this.restoreInspectedEvidence();
    }
    this.playerPos.set(0, EYE_HEIGHT, 2.58);
    this.yaw = 0;
    this.pitch = -0.07;
    this.bobPhase = 0;
    this.bobBlend = 0;
    this.cameraTrauma = 0;
    this.flashlightOn = true;
    this.loggedEvidence = [];
    this.discoveredEvidence = [];
    this.hoverTarget = null;
    this.elapsedSeconds = 0;
    this.keypadAttempts = 0;
    this.keypadError = null;
    this.doorUnlocked = false;
    this.doorOpenProgress = 0;
    this.victoryDelayTimer = 0;
    this.runStats = null;
    this.toastMessage = null;
    this.toastTimer = 0;

    // Reset drawers & door
    this.room.drawers.forEach((d) => {
      d.isOpen = false;
      d.progress = 0;
      d.group.position.copy(d.closedPos);
    });
    this.room.doorPivot.rotation.y = 0;
    this.room.keypadLedMat.color.setHex(0xff2a1e);
    this.room.keypadLedMat.emissive.setHex(0xff2a1e);
    this.audio.setTension(computeTruthTension(0, EVIDENCE_LIST.length));

    this.camera.position.copy(this.playerPos);
    this.flashPos.set(0.24, EYE_HEIGHT - 0.16, 2.48);
    this.flashAim.set(0, 1.4, -1.0);
  }

  private restoreInspectedEvidence(): void {
    if (!this.activeEvidenceId) return;
    const handle = this.room.evidenceHandles.get(this.activeEvidenceId);
    if (handle) {
      handle.homeParent.add(handle.group);
      handle.group.position.copy(handle.homePosition);
      handle.group.quaternion.copy(handle.homeQuaternion);
      handle.group.scale.copy(handle.homeScale);
      handle.glowRing.visible = true;
    }
    this.activeEvidenceId = null;
  }

  private showToast(msg: string): void {
    this.toastMessage = msg;
    this.toastTimer = 3.4;
  }

  private triggerCenterInteraction(): void {
    this.updateCenterRaycast();
    if (this.hoverTarget) {
      this.triggerInteraction(this.hoverTarget);
    }
  }

  private triggerInteraction(target: HoverTargetInfo): void {
    if (target.kind === 'drawer') {
      const drawer = this.room.drawers.get(target.id);
      if (drawer) {
        drawer.isOpen = !drawer.isOpen;
        this.audio.playDrawerSlide(drawer.isOpen, drawer.isMetal);
        this.showToast(drawer.isOpen ? `تم فتح ${drawer.label}` : `تم إغلاق ${drawer.label}`);
        this.emitHud(true);
      }
      return;
    }

    if (target.kind === 'evidence' && target.evidenceId) {
      this.inspectEvidence(target.evidenceId);
      return;
    }

    if (target.kind === 'keypad' || target.kind === 'door') {
      if (this.doorUnlocked) {
        this.showToast('الباب مفتوح بالفعل!');
      } else {
        this.openKeypad();
      }
    }
  }

  private updateCenterRaycast(): void {
    this.raycaster.setFromCamera(this.centerNdc, this.camera);
    this.raycaster.far = INTERACT_RANGE;
    this.resolveRayHits();
  }

  private updateHoverFromPoint(clientX: number, clientY: number): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const nx = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(new THREE.Vector2(nx, ny), this.camera);
    this.raycaster.far = INTERACT_RANGE;
    this.resolveRayHits();
  }

  private resolveRayHits(): void {
    const hits = this.raycaster.intersectObjects(this.room.interactables, false);
    if (hits.length > 0) {
      const meta = hits[0].object.userData.interactable as
        | {
            id: string;
            kind: InteractableKind;
            label: string;
            actionHint: string;
            evidenceId?: EvidenceId;
          }
        | undefined;
      if (meta) {
        const nextId = meta.id;
        if (!this.hoverTarget || this.hoverTarget.id !== nextId) {
          this.hoverTarget = {
            id: meta.id,
            kind: meta.kind,
            label: meta.label,
            actionHint: meta.actionHint,
            evidenceId: meta.evidenceId,
          };
          this.emitHud(true);
        }
        return;
      }
    }

    if (this.hoverTarget !== null) {
      this.hoverTarget = null;
      this.emitHud(true);
    }
  }

  // =========================================================================
  // MAIN SIMULATION & RENDER LOOP (GPU rAF / Software WebGL afterDraw)
  // =========================================================================

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (gl && typeof gl.fenceSync === 'function') {
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (this.disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          this.frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          this.frameId = window.setTimeout(cb, 80);
        }
      };
      this.frameId = window.setTimeout(poll, 5);
    } else {
      this.frameId = window.setTimeout(cb, 80);
    }
  }

  private scheduleNextFrame(): void {
    if (this.disposed) return;
    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = window.requestAnimationFrame(this.tick);
    }
  }

  private tick = (): void => {
    if (this.disposed) return;
    const now = performance.now();
    const rawDt = (now - this.lastTimestamp) / 1000;
    this.lastTimestamp = now;
    const dt = Math.min(Math.max(rawDt, 0.001), 0.05);

    this.totalTime += dt;

    if (this.phase === 'title') {
      this.updateTitleCamera(dt);
      this.updateAtmosphere(dt);
    } else if (this.phase === 'playing') {
      if (!this.doorUnlocked) {
        this.elapsedSeconds += dt;
      }
      this.updatePlayer(dt);
      this.updateDrawersAndDoor(dt);
      this.updateInspection(dt);
      this.updateAtmosphere(dt);

      // Throttled center raycast while exploring
      if (this.mode === 'explore' && now - this.lastRaycastTime > 60) {
        this.lastRaycastTime = now;
        this.updateCenterRaycast();
      }

      if (this.toastTimer > 0) {
        this.toastTimer -= dt;
        if (this.toastTimer <= 0) {
          this.toastMessage = null;
          this.emitHud(true);
        }
      }

      // Victory sequence beat while door swings open (use real elapsed time so pacing is identical on software WebGL)
      if (this.doorUnlocked && this.victoryDelayTimer > 0) {
        this.victoryDelayTimer -= Math.min(Math.max(rawDt, 0.016), 0.25);
        if (this.victoryDelayTimer <= 0) {
          this.runStats = {
            elapsedSeconds: Math.round(this.elapsedSeconds),
            evidenceLogged: this.loggedEvidence.length,
            totalEvidence: EVIDENCE_LIST.length,
            keypadAttempts: this.keypadAttempts,
            escaped: true,
          };
          this.phase = 'gameover';
          this.mode = 'explore';
          document.exitPointerLock?.();
          this.syncBodyDataset();
          this.emitHud(true);
        }
      }

      // Throttled timer HUD push (~2Hz)
      if (now - this.lastHudPushTime > 500) {
        this.lastHudPushTime = now;
        this.emitHud(false);
      }
    } else {
      // Paused or GameOver: gentle ambient lamp sway only when on gameover
      if (this.phase === 'gameover') {
        this.updateDrawersAndDoor(dt);
        this.updateAtmosphere(dt);
      }
    }

    this.renderer.render(this.scene, this.camera);
    this.scheduleNextFrame();
  };

  private updateTitleCamera(_dt: number): void {
    const t = this.totalTime * 0.22;
    // Dramatic atmospheric drift framing the antique desk, repositioned chair, brass lamp, and moonlit window
    this.camera.position.set(
      1.18 + Math.sin(t) * 0.55,
      1.66 + Math.sin(t * 1.4) * 0.06,
      2.22 + Math.cos(t * 0.7) * 0.25,
    );
    this.camera.lookAt(-0.36, 1.0, -0.45);

    // Warm atmospheric fill flashlight beam pointing gently across the desk & torn note
    this.flashlight.intensity = 3.2;
    this.flashlight.position.copy(this.camera.position);
    this.flashlightTarget.position.set(-0.2, 0.92, -0.45);
  }

  private updatePlayer(dt: number): void {
    const isExploring = this.mode === 'explore' && !this.doorUnlocked;

    if (isExploring) {
      // Optional Q/E smooth turn for accessibility & keyboard-only play
      const turnSpeed = 1.85;
      if (this.keysHeld.has('KeyQ')) this.yaw += turnSpeed * dt;
      if (this.keysHeld.has('KeyE') && !this.hoverTarget) this.yaw -= turnSpeed * dt;

      // Forward & right vectors on XZ ground plane
      this._forward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
      this._right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
      this._move.set(0, 0, 0);

      if (this.keysHeld.has('KeyW') || this.keysHeld.has('ArrowUp')) this._move.add(this._forward);
      if (this.keysHeld.has('KeyS') || this.keysHeld.has('ArrowDown')) this._move.sub(this._forward);
      if (this.keysHeld.has('KeyD') || this.keysHeld.has('ArrowRight')) this._move.add(this._right);
      if (this.keysHeld.has('KeyA') || this.keysHeld.has('ArrowLeft')) this._move.sub(this._right);

      const speed =
        this.keysHeld.has('ShiftLeft') || this.keysHeld.has('ShiftRight') ? RUN_SPEED : WALK_SPEED;

      let movedDist = 0;
      if (this._move.lengthSq() > 0.0001) {
        this._move.normalize().multiplyScalar(speed * dt);
        const col = resolveSlidingCollision(
          this.playerPos.x,
          this.playerPos.z,
          this._move.x,
          this._move.z,
          PLAYER_RADIUS,
          this.room.roomBounds,
          this.room.colliders,
        );
        movedDist = Math.hypot(col.x - this.playerPos.x, col.z - this.playerPos.z);
        this.playerPos.x = col.x;
        this.playerPos.z = col.z;
      }

      // Distance-synced head bobbing & procedural footsteps
      const isMoving = movedDist > 0.001;
      this.bobBlend = THREE.MathUtils.damp(this.bobBlend, isMoving ? 1 : 0, 10, dt);
      const bob = advanceHeadBob(this.bobPhase, movedDist, 0.044);
      this.bobPhase = bob.phase;
      if (bob.stepTriggered) {
        this.audio.playFootstep();
      }

      // Decay camera trauma shake
      this.cameraTrauma = Math.max(0, this.cameraTrauma - dt * 2.2);
      const shake = this.cameraTrauma * this.cameraTrauma;
      const shakeYaw = shake * Math.sin(this.totalTime * 48) * 0.025;
      const shakePitch = shake * Math.cos(this.totalTime * 42) * 0.022;

      this.camera.position.set(
        this.playerPos.x + this._right.x * bob.offsetX * this.bobBlend,
        EYE_HEIGHT + bob.offsetY * this.bobBlend,
        this.playerPos.z + this._right.z * bob.offsetX * this.bobBlend,
      );
      this._euler.set(this.pitch + shakePitch, this.yaw + shakeYaw, 0, 'YXZ');
      this.camera.quaternion.setFromEuler(this._euler);
    } else if (this.doorUnlocked) {
      // Smoothly look at the opening South exit door
      this.camera.position.set(this.playerPos.x, EYE_HEIGHT, this.playerPos.z);
      this._euler.set(this.pitch, this.yaw, 0, 'YXZ');
      this.camera.quaternion.setFromEuler(this._euler);
    }

    // Handheld Flashlight Inertial Sway (lags softly behind camera look & hand bob)
    this.camera.getWorldDirection(this._camDir);
    this._camRight.crossVectors(this._camDir, THREE.Object3D.DEFAULT_UP).normalize();
    this._camUp.crossVectors(this._camRight, this._camDir).normalize();

    const breathSwayX = Math.sin(this.totalTime * 1.6) * 0.015;
    const breathSwayY = Math.cos(this.totalTime * 2.1) * 0.012;

    this._desiredFlashPos
      .copy(this.camera.position)
      .addScaledVector(this._camRight, 0.22 + breathSwayX)
      .addScaledVector(this._camUp, -0.17 + breathSwayY)
      .addScaledVector(this._camDir, 0.14);

    this._desiredFlashAim
      .copy(this.camera.position)
      .addScaledVector(this._camDir, 5.2)
      .addScaledVector(this._camRight, breathSwayX * 2.5)
      .addScaledVector(this._camUp, breathSwayY * 2.5);

    const posAlpha = 1 - Math.exp(-12 * dt);
    const aimAlpha = 1 - Math.exp(-8.5 * dt);
    this.flashPos.lerp(this._desiredFlashPos, posAlpha);
    this.flashAim.lerp(this._desiredFlashAim, aimAlpha);

    this.flashlight.position.copy(this.flashPos);
    this.flashlightTarget.position.copy(this.flashAim);

    const desiredFlashIntensity = this.flashlightOn && this.mode !== 'inspecting' ? 5.6 : 0;
    this.flashlight.intensity = THREE.MathUtils.damp(
      this.flashlight.intensity,
      desiredFlashIntensity,
      16,
      dt,
    );
  }

  private updateDrawersAndDoor(dt: number): void {
    this.room.drawers.forEach((d) => {
      const target = d.isOpen ? 1 : 0;
      if (Math.abs(d.progress - target) > 0.0005) {
        d.progress = THREE.MathUtils.damp(d.progress, target, 8.5, dt);
        d.group.position.set(
          d.closedPos.x + d.openOffset.x * d.progress,
          d.closedPos.y + d.openOffset.y * d.progress,
          d.closedPos.z + d.openOffset.z * d.progress,
        );
      }
    });

    if (this.doorUnlocked && this.doorOpenProgress < 1) {
      this.doorOpenProgress = THREE.MathUtils.damp(this.doorOpenProgress, 1, 2.6, dt);
      // Swing outward smoothly (+Y rotation pushes door outward into bright escape hall)
      this.room.doorPivot.rotation.y = -this.doorOpenProgress * 1.48;
    }
  }

  private updateInspection(dt: number): void {
    const inspecting = this.mode === 'inspecting' && this.activeEvidenceId !== null;
    this.inspectLight.intensity = THREE.MathUtils.damp(
      this.inspectLight.intensity,
      inspecting ? 2.8 : 0,
      10,
      dt,
    );

    if (!inspecting || !this.activeEvidenceId) return;
    const handle = this.room.evidenceHandles.get(this.activeEvidenceId);
    if (!handle) return;

    // Keyboard rotation support while inspecting (Arrow keys / WASD)
    const keyRotSpeed = 2.4;
    if (this.keysHeld.has('ArrowLeft') || this.keysHeld.has('KeyA')) {
      this.inspectTargetRotY -= keyRotSpeed * dt;
    }
    if (this.keysHeld.has('ArrowRight') || this.keysHeld.has('KeyD')) {
      this.inspectTargetRotY += keyRotSpeed * dt;
    }
    if (this.keysHeld.has('ArrowUp') || this.keysHeld.has('KeyW')) {
      this.inspectTargetRotX -= keyRotSpeed * dt;
    }
    if (this.keysHeld.has('ArrowDown') || this.keysHeld.has('KeyS')) {
      this.inspectTargetRotX += keyRotSpeed * dt;
    }

    this.inspectRotY = THREE.MathUtils.damp(this.inspectRotY, this.inspectTargetRotY, 12, dt);
    this.inspectRotX = THREE.MathUtils.damp(this.inspectRotX, this.inspectTargetRotX, 12, dt);

    // Apply clean world-camera relative 360-degree rotation on top of base inspection pose
    this._quatY.setFromAxisAngle(this._axisY, this.inspectRotY);
    this._quatX.setFromAxisAngle(this._axisX, this.inspectRotX);
    handle.group.quaternion.copy(this._quatY).multiply(this._quatX);
    handle.group.quaternion.multiply(
      new THREE.Quaternion().setFromEuler(handle.inspectBaseEuler),
    );
  }

  private updateAtmosphere(dt: number): void {
    const tension = computeTruthTension(this.loggedEvidence.length, EVIDENCE_LIST.length);

    // 1. Pendulum sway of metal desk lamp shade
    const swayAmp = 0.065 + tension * 0.04;
    this.room.lampShadePivot.rotation.z = Math.sin(this.totalTime * 1.45) * swayAmp;
    this.room.lampShadePivot.rotation.x = Math.cos(this.totalTime * 0.92) * swayAmp * 0.45;

    // 2. Stochastic electrical flicker of desk lamp light & glowing tungsten bulb
    this.flickerTimer -= dt;
    if (this.flickerTimer <= 0) {
      const roll = Math.random();
      if (roll < 0.14 + tension * 0.12) {
        // Sudden short electrical dip
        this.flickerTargetIntensity = 0.35 + Math.random() * 0.65;
        this.flickerTimer = 0.04 + Math.random() * 0.08;
      } else if (roll < 0.32) {
        // Subtle filament sag
        this.flickerTargetIntensity = 1.65 + Math.random() * 0.7;
        this.flickerTimer = 0.07 + Math.random() * 0.14;
      } else {
        // Steady warm tungsten burn
        this.flickerTargetIntensity = 2.65 + Math.random() * 0.45;
        this.flickerTimer = 0.25 + Math.random() * 0.85;
      }
    }
    this.flickerCurrentIntensity = THREE.MathUtils.damp(
      this.flickerCurrentIntensity,
      this.flickerTargetIntensity,
      26,
      dt,
    );
    this.room.deskLampLight.intensity = this.flickerCurrentIntensity;
    this.room.deskLampBulbMat.emissiveIntensity = Math.max(0.4, this.flickerCurrentIntensity * 1.25);

    // 3. Subtle drifting dust motes in moonlight (in-place Float32Array mutation, zero GC)
    const posAttr = this.room.dustPoints.geometry.attributes.position as THREE.BufferAttribute;
    const arr = this.room.dustPositions;
    for (let i = 0; i < arr.length; i += 3) {
      arr[i] += Math.sin(this.totalTime * 0.4 + i) * 0.0005;
      arr[i + 1] += 0.00045;
      if (arr[i + 1] > 3.25) arr[i + 1] = 0.22;
    }
    posAttr.needsUpdate = true;
  }

  private syncBodyDataset(): void {
    document.body.dataset.state = this.phase;
    document.body.dataset.mode = this.mode;
  }

  private emitHud(_immediate: boolean): void {
    const tension = computeTruthTension(this.loggedEvidence.length, EVIDENCE_LIST.length);
    this.onHudChange({
      phase: this.phase,
      mode: this.mode,
      pointerLocked: this.pointerLocked,
      flashlightOn: this.flashlightOn,
      muted: this.audio.isMuted(),
      loggedEvidence: [...this.loggedEvidence],
      discoveredEvidence: [...this.discoveredEvidence],
      activeEvidenceId: this.activeEvidenceId,
      hoverTarget: this.hoverTarget,
      truthTension: tension,
      elapsedSeconds: Math.round(this.elapsedSeconds),
      keypadAttempts: this.keypadAttempts,
      keypadError: this.keypadError,
      doorUnlocked: this.doorUnlocked,
      toastMessage: this.toastMessage,
      runStats: this.runStats,
    });
  }

  public dispose(): void {
    this.disposed = true;
    window.cancelAnimationFrame(this.frameId);
    window.clearTimeout(this.frameId);
    this._resizeObserver.disconnect();
    this.unbindEvents();
    document.exitPointerLock?.();
    this.audio.dispose();
    this.room.dispose();
    this.textures.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
