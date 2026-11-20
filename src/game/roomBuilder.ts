import * as THREE from 'three';
import type { ColliderAABB, EvidenceId, InteractableKind, RoomBounds } from './types';
import type { RoomTextureLibrary } from './textureEngine';
import { EVIDENCE_MAP } from './puzzleLogic';

export interface DrawerHandle {
  id: string;
  label: string;
  group: THREE.Group;
  closedPos: THREE.Vector3;
  openOffset: THREE.Vector3;
  isOpen: boolean;
  progress: number; // 0..1
  isMetal: boolean;
}

export interface EvidenceHandle {
  id: EvidenceId;
  group: THREE.Group;
  homeParent: THREE.Object3D;
  homePosition: THREE.Vector3;
  homeQuaternion: THREE.Quaternion;
  homeScale: THREE.Vector3;
  inspectScale: number;
  inspectBaseEuler: THREE.Euler;
  glowRing: THREE.Mesh;
}

export interface BuiltRoom {
  roomBounds: RoomBounds;
  colliders: ColliderAABB[];
  interactables: THREE.Object3D[];
  drawers: Map<string, DrawerHandle>;
  evidenceHandles: Map<EvidenceId, EvidenceHandle>;
  lampShadePivot: THREE.Group;
  deskLampLight: THREE.PointLight;
  deskLampBulbMat: THREE.MeshStandardMaterial;
  doorPivot: THREE.Group;
  keypadLedMat: THREE.MeshStandardMaterial;
  dustPoints: THREE.Points;
  dustPositions: Float32Array;
  dispose: () => void;
}

interface InteractableMeta {
  id: string;
  kind: InteractableKind;
  label: string;
  actionHint: string;
  evidenceId?: EvidenceId;
  drawerId?: string;
}

function tagInteractable(obj: THREE.Object3D, meta: InteractableMeta): void {
  obj.userData.interactable = meta;
}

function enableShadows(root: THREE.Object3D, cast = true, receive = true): void {
  root.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const m = child as THREE.Mesh;
      if (m.userData.skipShadow) return;
      m.castShadow = cast;
      m.receiveShadow = receive;
    }
  });
}

function makeContactShadow(
  tex: THREE.CanvasTexture,
  width: number,
  depth: number,
  x: number,
  z: number,
  opacity = 0.55,
): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(width, depth);
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    opacity,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, 0.012, z);
  mesh.userData.skipShadow = true;
  return mesh;
}

/**
 * Builds the entire Investigation Room 404 with composite procedural 3D meshes,
 * interactive drawers, swinging flickering lamp, heavy door + keypad, and 5 detailed clues.
 */
export function buildInvestigationRoom(
  scene: THREE.Scene,
  textures: RoomTextureLibrary,
  isSoftwareGl: boolean,
): BuiltRoom {
  const roomW = 7.6;
  const roomH = 3.4;
  const roomD = 7.6;
  const halfW = roomW / 2;
  const halfD = roomD / 2;

  const roomBounds: RoomBounds = {
    minX: -halfW + 0.14,
    maxX: halfW - 0.14,
    minZ: -halfD + 0.14,
    maxZ: halfD - 0.14,
  };

  const colliders: ColliderAABB[] = [];
  const interactables: THREE.Object3D[] = [];
  const drawers = new Map<string, DrawerHandle>();
  const evidenceHandles = new Map<EvidenceId, EvidenceHandle>();
  const disposables: Array<{ dispose: () => void }> = [];

  const track = <T extends { dispose: () => void }>(item: T): T => {
    disposables.push(item);
    return item;
  };

  // --- Shared PBR Materials (all using procedural map + normalMap/bumpMap + roughnessMap) ---
  const floorMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.woodFloor.map,
      normalMap: textures.woodFloor.normalMap,
      normalScale: new THREE.Vector2(0.68, 0.68),
      bumpMap: textures.woodFloor.bumpMap,
      bumpScale: 0.012,
      roughnessMap: textures.woodFloor.roughnessMap,
      roughness: 1.0,
      metalness: 0.03,
    }),
  );

  const wallMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.stoneWall.map,
      normalMap: textures.stoneWall.normalMap,
      normalScale: new THREE.Vector2(0.82, 0.82),
      bumpMap: textures.stoneWall.bumpMap,
      bumpScale: 0.016,
      roughnessMap: textures.stoneWall.roughnessMap,
      roughness: 1.0,
      metalness: 0.01,
    }),
  );

  const ceilingMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x6f6c66,
      map: textures.stoneWall.map,
      normalMap: textures.stoneWall.normalMap,
      normalScale: new THREE.Vector2(0.35, 0.35),
      roughnessMap: textures.stoneWall.roughnessMap,
      roughness: 1.0,
      metalness: 0.0,
    }),
  );

  const darkWoodMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.darkWood.map,
      normalMap: textures.darkWood.normalMap,
      normalScale: new THREE.Vector2(0.45, 0.45),
      roughnessMap: textures.darkWood.roughnessMap,
      roughness: 0.92,
      metalness: 0.04,
    }),
  );

  const brassMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.oxidizedBrass.map,
      normalMap: textures.oxidizedBrass.normalMap,
      normalScale: new THREE.Vector2(0.8, 0.8),
      roughnessMap: textures.oxidizedBrass.roughnessMap,
      roughness: 0.72,
      metalness: 0.86,
    }),
  );

  const steelMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.weatheredSteel.map,
      normalMap: textures.weatheredSteel.normalMap,
      normalScale: new THREE.Vector2(0.9, 0.9),
      roughnessMap: textures.weatheredSteel.roughnessMap,
      roughness: 0.78,
      metalness: 0.74,
    }),
  );

  const darkIronMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x868c90,
      map: textures.weatheredSteel.map,
      normalMap: textures.weatheredSteel.normalMap,
      roughnessMap: textures.weatheredSteel.roughnessMap,
      roughness: 0.65,
      metalness: 0.85,
    }),
  );

  const leatherMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.leather.map,
      normalMap: textures.leather.normalMap,
      roughnessMap: textures.leather.roughnessMap,
      roughness: 0.82,
      metalness: 0.05,
    }),
  );

  const paperMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.agedPaper.map,
      normalMap: textures.agedPaper.normalMap,
      roughnessMap: textures.agedPaper.roughnessMap,
      roughness: 0.94,
      metalness: 0.0,
    }),
  );

  const dustyGlassMat = track(
    new THREE.MeshPhysicalMaterial({
      color: 0xd8e5ee,
      map: textures.dustyGlass.map,
      bumpMap: textures.dustyGlass.bumpMap,
      bumpScale: 0.01,
      roughnessMap: textures.dustyGlass.roughnessMap,
      roughness: 0.42,
      metalness: 0.0,
      transmission: isSoftwareGl ? 0 : 0.72,
      transparent: true,
      opacity: isSoftwareGl ? 0.36 : 0.78,
      ior: 1.5,
      thickness: 0.08,
      depthWrite: false,
    }),
  );

  const amberGlassMat = track(
    new THREE.MeshPhysicalMaterial({
      color: 0xc26c1d,
      map: textures.dustyGlass.map,
      bumpMap: textures.dustyGlass.bumpMap,
      bumpScale: 0.012,
      roughnessMap: textures.dustyGlass.roughnessMap,
      roughness: 0.24,
      metalness: 0.05,
      transmission: isSoftwareGl ? 0 : 0.78,
      transparent: true,
      opacity: isSoftwareGl ? 0.56 : 0.92,
      ior: 1.54,
      thickness: 0.35,
      attenuationColor: new THREE.Color(0x9a4208),
      attenuationDistance: 0.16,
      depthWrite: false,
    }),
  );

  const roomGroup = new THREE.Group();
  scene.add(roomGroup);

  // =========================================================================
  // 1. ARCHITECTURAL SHELL: FLOOR, WALLS, BASEBOARDS, CEILING BEAMS, WINDOW
  // =========================================================================
  const floor = new THREE.Mesh(track(new THREE.PlaneGeometry(roomW, roomD)), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  roomGroup.add(floor);

  const ceiling = new THREE.Mesh(track(new THREE.PlaneGeometry(roomW, roomD)), ceilingMat);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = roomH;
  ceiling.receiveShadow = true;
  roomGroup.add(ceiling);

  // Heavy Ceiling Beams (5 transverse + 2 longitudinal edge ledgers + iron straps)
  const beamGeo = track(new THREE.BoxGeometry(roomW - 0.04, 0.24, 0.22));
  const beamBracketGeo = track(new THREE.BoxGeometry(0.18, 0.27, 0.25));
  for (let i = 0; i < 5; i++) {
    const bz = -halfD + 0.8 + i * 1.5;
    const beam = new THREE.Mesh(beamGeo, darkWoodMat);
    beam.position.set(0, roomH - 0.12, bz);
    beam.castShadow = true;
    beam.receiveShadow = true;
    roomGroup.add(beam);

    // Iron mounting brackets on beam ends
    for (const side of [-1, 1]) {
      const brk = new THREE.Mesh(beamBracketGeo, darkIronMat);
      brk.position.set(side * (halfW - 0.14), roomH - 0.13, bz);
      roomGroup.add(brk);
    }
  }
  const sideBeamGeo = track(new THREE.BoxGeometry(0.18, 0.18, roomD));
  for (const side of [-1, 1]) {
    const sBeam = new THREE.Mesh(sideBeamGeo, darkWoodMat);
    sBeam.position.set(side * (halfW - 0.09), roomH - 0.09, 0);
    roomGroup.add(sBeam);
  }

  // West & East solid walls
  const sideWallGeo = track(new THREE.BoxGeometry(0.16, roomH, roomD));
  const westWall = new THREE.Mesh(sideWallGeo, wallMat);
  westWall.position.set(-halfW - 0.08, roomH / 2, 0);
  westWall.receiveShadow = true;
  roomGroup.add(westWall);

  const eastWall = new THREE.Mesh(sideWallGeo, wallMat);
  eastWall.position.set(halfW + 0.08, roomH / 2, 0);
  eastWall.receiveShadow = true;
  roomGroup.add(eastWall);

  // North Wall (z = -halfD) with real recessed barred window opening:
  // Window opening: x in [-0.95, 0.95], y in [1.05, 2.65]
  const northLeft = new THREE.Mesh(track(new THREE.BoxGeometry(2.85, roomH, 0.28)), wallMat);
  northLeft.position.set(-2.375, roomH / 2, -halfD - 0.14);
  northLeft.receiveShadow = true;
  roomGroup.add(northLeft);

  const northRight = new THREE.Mesh(track(new THREE.BoxGeometry(2.85, roomH, 0.28)), wallMat);
  northRight.position.set(2.375, roomH / 2, -halfD - 0.14);
  northRight.receiveShadow = true;
  roomGroup.add(northRight);

  const northBelow = new THREE.Mesh(track(new THREE.BoxGeometry(1.9, 1.05, 0.28)), wallMat);
  northBelow.position.set(0, 0.525, -halfD - 0.14);
  northBelow.receiveShadow = true;
  roomGroup.add(northBelow);

  const northAbove = new THREE.Mesh(track(new THREE.BoxGeometry(1.9, 0.75, 0.28)), wallMat);
  northAbove.position.set(0, 3.025, -halfD - 0.14);
  northAbove.receiveShadow = true;
  roomGroup.add(northAbove);

  // Composite Recessed Moonlit Window Group
  const windowGroup = new THREE.Group();
  windowGroup.position.set(0, 0, -halfD);
  roomGroup.add(windowGroup);

  // Deep Wooden Sill extending slightly inside room (y = 1.05) — Burned Photo sits here!
  const sillMain = new THREE.Mesh(track(new THREE.BoxGeometry(2.14, 0.06, 0.44)), darkWoodMat);
  sillMain.position.set(0, 1.05, -0.02);
  sillMain.castShadow = true;
  sillMain.receiveShadow = true;
  windowGroup.add(sillMain);

  const sillLip = new THREE.Mesh(track(new THREE.BoxGeometry(2.18, 0.035, 0.06)), darkWoodMat);
  sillLip.position.set(0, 1.03, 0.2);
  windowGroup.add(sillLip);

  // Window Wooden Casing & Jambs
  const jambV = track(new THREE.BoxGeometry(0.11, 1.66, 0.34));
  const jambLeft = new THREE.Mesh(jambV, darkWoodMat);
  jambLeft.position.set(-0.98, 1.85, -0.1);
  windowGroup.add(jambLeft);
  const jambRight = new THREE.Mesh(jambV, darkWoodMat);
  jambRight.position.set(0.98, 1.85, -0.1);
  windowGroup.add(jambRight);
  const jambTop = new THREE.Mesh(track(new THREE.BoxGeometry(2.12, 0.12, 0.34)), darkWoodMat);
  jambTop.position.set(0, 2.66, -0.1);
  windowGroup.add(jambTop);

  // Inner wooden cross mullions
  const mullionV = new THREE.Mesh(track(new THREE.BoxGeometry(0.05, 1.56, 0.05)), darkWoodMat);
  mullionV.position.set(0, 1.85, -0.18);
  windowGroup.add(mullionV);
  const mullionH = new THREE.Mesh(track(new THREE.BoxGeometry(1.86, 0.05, 0.05)), darkWoodMat);
  mullionH.position.set(0, 1.92, -0.18);
  windowGroup.add(mullionH);

  // Dusty Glass Pane
  const windowGlass = new THREE.Mesh(track(new THREE.PlaneGeometry(1.88, 1.56)), dustyGlassMat);
  windowGlass.position.set(0, 1.85, -0.2);
  windowGlass.renderOrder = 2;
  windowGlass.userData.skipShadow = true;
  windowGroup.add(windowGlass);

  // 5 Vertical + 2 Horizontal Iron Security Bars
  const vBarGeo = track(new THREE.CylinderGeometry(0.016, 0.016, 1.58, 10));
  for (let i = -2; i <= 2; i++) {
    const bar = new THREE.Mesh(vBarGeo, darkIronMat);
    bar.position.set(i * 0.36, 1.85, -0.11);
    bar.castShadow = true;
    windowGroup.add(bar);
  }
  const hBarGeo = track(new THREE.CylinderGeometry(0.015, 0.015, 1.9, 10));
  for (const hy of [1.45, 2.25]) {
    const bar = new THREE.Mesh(hBarGeo, darkIronMat);
    bar.rotation.z = Math.PI / 2;
    bar.position.set(0, hy, -0.11);
    bar.castShadow = true;
    windowGroup.add(bar);
  }

  // Exterior Night Backdrop Box & Glowing Moon Disc
  const nightSkyMat = track(
    new THREE.MeshBasicMaterial({
      color: 0x07101f,
      side: THREE.BackSide,
      fog: false,
    }),
  );
  const nightBox = new THREE.Mesh(track(new THREE.BoxGeometry(3.4, 2.8, 1.4)), nightSkyMat);
  nightBox.position.set(0, 1.95, -0.95);
  nightBox.userData.skipShadow = true;
  windowGroup.add(nightBox);

  const moonMat = track(
    new THREE.MeshBasicMaterial({
      color: 0xdbe9ff,
      fog: false,
    }),
  );
  const moonDisc = new THREE.Mesh(track(new THREE.CircleGeometry(0.28, 28)), moonMat);
  moonDisc.position.set(0.32, 2.24, -1.48);
  moonDisc.userData.skipShadow = true;
  windowGroup.add(moonDisc);

  // Subtle volumetric moonlight shaft streaming through barred window into the room
  const moonBeamMat = track(
    new THREE.MeshBasicMaterial({
      color: 0x6c92c8,
      transparent: true,
      opacity: 0.045,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  const moonBeam = new THREE.Mesh(track(new THREE.ConeGeometry(1.65, 4.6, 20, 1, true)), moonBeamMat);
  moonBeam.position.set(0, 1.15, 1.45);
  moonBeam.rotation.x = Math.PI / 2.65;
  moonBeam.userData.skipShadow = true;
  windowGroup.add(moonBeam);

  // South Wall (z = +halfD) with real doorway opening for Exit Door:
  // Doorway opening: x in [-0.58, 0.58], y in [0, 2.26]
  const southLeft = new THREE.Mesh(track(new THREE.BoxGeometry(3.22, roomH, 0.24)), wallMat);
  southLeft.position.set(-2.19, roomH / 2, halfD + 0.12);
  southLeft.receiveShadow = true;
  roomGroup.add(southLeft);

  const southRight = new THREE.Mesh(track(new THREE.BoxGeometry(3.22, roomH, 0.24)), wallMat);
  southRight.position.set(2.19, roomH / 2, halfD + 0.12);
  southRight.receiveShadow = true;
  roomGroup.add(southRight);

  const southTop = new THREE.Mesh(track(new THREE.BoxGeometry(1.16, roomH - 2.26, 0.24)), wallMat);
  southTop.position.set(0, 2.26 + (roomH - 2.26) / 2, halfD + 0.12);
  southTop.receiveShadow = true;
  roomGroup.add(southTop);

  // Bright cold escape corridor behind door (revealed when unlocked!)
  const escapeBackdrop = new THREE.Mesh(
    track(new THREE.BoxGeometry(2.6, 3.0, 2.4)),
    track(new THREE.MeshBasicMaterial({ color: 0x9cb8d6, side: THREE.BackSide, fog: false })),
  );
  escapeBackdrop.position.set(0, 1.5, halfD + 1.42);
  escapeBackdrop.userData.skipShadow = true;
  roomGroup.add(escapeBackdrop);

  // Profiled Wooden Baseboards (2-tier molding around all walls, broken cleanly at door)
  const addBaseboard = (len: number, x: number, z: number, rotY: number) => {
    const g = new THREE.Group();
    const lower = new THREE.Mesh(track(new THREE.BoxGeometry(len, 0.14, 0.04)), darkWoodMat);
    lower.position.y = 0.07;
    const cap = new THREE.Mesh(track(new THREE.BoxGeometry(len, 0.035, 0.055)), darkWoodMat);
    cap.position.y = 0.155;
    g.add(lower, cap);
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    roomGroup.add(g);
  };
  addBaseboard(roomW, 0, -halfD + 0.02, 0); // North
  addBaseboard(roomD, -halfW + 0.02, 0, Math.PI / 2); // West
  addBaseboard(roomD, halfW - 0.02, 0, -Math.PI / 2); // East
  addBaseboard(3.15, -2.22, halfD - 0.02, Math.PI); // South left
  addBaseboard(3.15, 2.22, halfD - 0.02, Math.PI); // South right

  // =========================================================================
  // 2. HEAVY WOODEN EXIT DOOR (COMPOSITE GROUP) + BRASS HANDLE + DIGITAL KEYPAD
  // =========================================================================
  // Solid wooden door jambs framing the exit
  const doorJambL = new THREE.Mesh(track(new THREE.BoxGeometry(0.11, 2.32, 0.28)), darkWoodMat);
  doorJambL.position.set(-0.62, 1.16, halfD + 0.02);
  roomGroup.add(doorJambL);
  const doorJambR = new THREE.Mesh(track(new THREE.BoxGeometry(0.11, 2.32, 0.28)), darkWoodMat);
  doorJambR.position.set(0.62, 1.16, halfD + 0.02);
  roomGroup.add(doorJambR);
  const doorLintel = new THREE.Mesh(track(new THREE.BoxGeometry(1.36, 0.12, 0.28)), darkWoodMat);
  doorLintel.position.set(0, 2.32, halfD + 0.02);
  roomGroup.add(doorLintel);

  // Pivoted heavy wooden door (hinged on left jamb at x = -0.57)
  const doorPivot = new THREE.Group();
  doorPivot.position.set(-0.57, 0, halfD + 0.02);
  roomGroup.add(doorPivot);

  const doorSlab = new THREE.Mesh(track(new THREE.BoxGeometry(1.14, 2.24, 0.085)), darkWoodMat);
  doorSlab.position.set(0.57, 1.12, 0);
  doorPivot.add(doorSlab);

  // 4 Recessed beveled door panels
  const panelGeoTop = track(new THREE.BoxGeometry(0.4, 0.78, 0.024));
  const panelGeoBot = track(new THREE.BoxGeometry(0.4, 0.74, 0.024));
  for (const px of [0.32, 0.82]) {
    const pTop = new THREE.Mesh(panelGeoTop, darkWoodMat);
    pTop.position.set(px, 1.62, -0.045);
    const pBot = new THREE.Mesh(panelGeoBot, darkWoodMat);
    pBot.position.set(px, 0.62, -0.045);
    doorPivot.add(pTop, pBot);
  }

  // Iron reinforcement hinges & horizontal straps
  for (const hy of [0.38, 1.15, 1.92]) {
    const strap = new THREE.Mesh(track(new THREE.BoxGeometry(0.32, 0.055, 0.02)), darkIronMat);
    strap.position.set(0.18, hy, -0.048);
    doorPivot.add(strap);
  }

  // Oxidized Brass Door Plaque "404"
  const plaqueMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.evidenceMaps.doorPlaque,
      normalMap: textures.oxidizedBrass.normalMap,
      roughnessMap: textures.oxidizedBrass.roughnessMap,
      roughness: 0.62,
      metalness: 0.85,
    }),
  );
  const doorPlaque = new THREE.Mesh(track(new THREE.BoxGeometry(0.34, 0.17, 0.016)), plaqueMat);
  doorPlaque.position.set(0.57, 1.72, -0.055);
  doorPivot.add(doorPlaque);

  // Sculpted Oxidized Brass Door Handle Assembly (Escutcheon + Lathe Stem + Lever + Keyhole)
  const handleGroup = new THREE.Group();
  handleGroup.position.set(1.0, 1.04, -0.055);
  doorPivot.add(handleGroup);

  const escutcheon = new THREE.Mesh(track(new THREE.BoxGeometry(0.068, 0.24, 0.014)), brassMat);
  handleGroup.add(escutcheon);

  const handleNeckProfile = [
    new THREE.Vector2(0.024, 0),
    new THREE.Vector2(0.016, 0.02),
    new THREE.Vector2(0.013, 0.055),
    new THREE.Vector2(0.02, 0.072),
  ];
  const handleNeck = new THREE.Mesh(
    track(new THREE.LatheGeometry(handleNeckProfile, 14)),
    brassMat,
  );
  handleNeck.rotation.x = -Math.PI / 2;
  handleNeck.position.set(0, 0.04, -0.005);
  handleGroup.add(handleNeck);

  const leverBar = new THREE.Mesh(track(new THREE.CylinderGeometry(0.012, 0.014, 0.13, 12)), brassMat);
  leverBar.rotation.z = Math.PI / 2;
  leverBar.position.set(-0.058, 0.04, -0.072);
  handleGroup.add(leverBar);

  const leverTip = new THREE.Mesh(track(new THREE.SphereGeometry(0.015, 10, 10)), brassMat);
  leverTip.position.set(-0.125, 0.04, -0.072);
  handleGroup.add(leverTip);

  // Door interaction proxy
  const doorProxy = new THREE.Mesh(
    track(new THREE.BoxGeometry(1.16, 2.24, 0.22)),
    track(new THREE.MeshBasicMaterial({ visible: false })),
  );
  doorProxy.position.set(0.57, 1.12, -0.02);
  doorProxy.userData.skipShadow = true;
  tagInteractable(doorProxy, {
    id: 'exit_door',
    kind: 'door',
    label: 'باب غرفة التحقيق 404',
    actionHint: 'مقفل — استخدم القفل الرقمي المجاور',
  });
  doorPivot.add(doorProxy);
  interactables.push(doorProxy);
  enableShadows(doorPivot, true, true);

  // Digital Keypad Lock mounted beside the door (x = 0.92, y = 1.36, z = halfD - 0.04)
  const keypadGroup = new THREE.Group();
  keypadGroup.position.set(0.92, 1.36, halfD - 0.045);
  roomGroup.add(keypadGroup);

  const keypadChassis = new THREE.Mesh(track(new THREE.BoxGeometry(0.24, 0.36, 0.075)), steelMat);
  keypadGroup.add(keypadChassis);

  const keypadBezel = new THREE.Mesh(track(new THREE.BoxGeometry(0.21, 0.33, 0.018)), darkIronMat);
  keypadBezel.position.z = -0.042;
  keypadGroup.add(keypadBezel);

  const keypadFaceMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.evidenceMaps.keypadFace,
      roughness: 0.45,
      metalness: 0.3,
    }),
  );
  const keypadFacePlane = new THREE.Mesh(track(new THREE.PlaneGeometry(0.19, 0.29)), keypadFaceMat);
  keypadFacePlane.rotation.y = Math.PI;
  keypadFacePlane.position.z = -0.052;
  keypadGroup.add(keypadFacePlane);

  // 12 Protruding 3D tactile buttons
  const keyCapGeo = track(new THREE.BoxGeometry(0.036, 0.032, 0.016));
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 3; col++) {
      const cap = new THREE.Mesh(keyCapGeo, brassMat);
      cap.position.set((col - 1) * 0.048, 0.025 - row * 0.044, -0.055);
      keypadGroup.add(cap);
    }
  }

  // Glowing Status LED on keypad (red when locked, emerald green when unlocked)
  const keypadLedMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xff2a1e,
      emissive: 0xff2a1e,
      emissiveIntensity: 2.2,
      roughness: 0.25,
      metalness: 0.1,
    }),
  );
  const keypadLed = new THREE.Mesh(track(new THREE.SphereGeometry(0.012, 10, 10)), keypadLedMat);
  keypadLed.position.set(0.072, 0.135, -0.054);
  keypadGroup.add(keypadLed);

  // Steel conduit pipe connecting keypad to door lock mechanism
  const conduit = new THREE.Mesh(track(new THREE.CylinderGeometry(0.012, 0.012, 0.34, 8)), darkIronMat);
  conduit.rotation.z = Math.PI / 2;
  conduit.position.set(-0.22, 0, 0);
  keypadGroup.add(conduit);

  const keypadProxy = new THREE.Mesh(
    track(new THREE.BoxGeometry(0.36, 0.46, 0.22)),
    track(new THREE.MeshBasicMaterial({ visible: false })),
  );
  keypadProxy.userData.skipShadow = true;
  tagInteractable(keypadProxy, {
    id: 'digital_keypad',
    kind: 'keypad',
    label: 'القفل الرقمي للباب',
    actionHint: 'إدخال رمز الخروج (٤ أرقام)',
  });
  keypadGroup.add(keypadProxy);
  interactables.push(keypadProxy);
  enableShadows(keypadGroup, true, true);

  // =========================================================================
  // 3. ANTIQUE CARVED WOODEN DESK (CENTER) WITH CLICKABLE DRAWERS & CHAIR
  // =========================================================================
  const deskGroup = new THREE.Group();
  deskGroup.position.set(0, 0, -0.45);
  roomGroup.add(deskGroup);
  roomGroup.add(makeContactShadow(textures.evidenceMaps.contactShadow, 2.35, 1.45, 0, -0.45, 0.62));

  // Beveled Desktop + Molded Rim
  const deskTopMain = new THREE.Mesh(track(new THREE.BoxGeometry(1.88, 0.055, 0.96)), darkWoodMat);
  deskTopMain.position.y = 0.755;
  deskGroup.add(deskTopMain);

  const deskTopTrim = new THREE.Mesh(track(new THREE.BoxGeometry(1.94, 0.028, 1.02)), darkWoodMat);
  deskTopTrim.position.y = 0.775;
  deskGroup.add(deskTopTrim);

  // Leather Desk Blotter Pad (offset +0.02 above tabletop to prevent Z-fighting)
  const blotter = new THREE.Mesh(track(new THREE.BoxGeometry(0.92, 0.012, 0.56)), leatherMat);
  blotter.position.set(0.05, 0.795, 0.06);
  deskGroup.add(blotter);

  // Brass Desk Corner Brackets
  const cornerBrkGeo = track(new THREE.BoxGeometry(0.08, 0.032, 0.08));
  for (const sx of [-0.94, 0.94]) {
    for (const sz of [-0.48, 0.48]) {
      const cb = new THREE.Mesh(cornerBrkGeo, brassMat);
      cb.position.set(sx, 0.775, sz);
      deskGroup.add(cb);
    }
  }

  // Carved Apron Frame
  const apronBack = new THREE.Mesh(track(new THREE.BoxGeometry(1.76, 0.22, 0.04)), darkWoodMat);
  apronBack.position.set(0, 0.62, -0.42);
  deskGroup.add(apronBack);

  const apronSideGeo = track(new THREE.BoxGeometry(0.04, 0.42, 0.84));
  const leftOuterWall = new THREE.Mesh(apronSideGeo, darkWoodMat);
  leftOuterWall.position.set(-0.86, 0.52, 0);
  const rightOuterWall = new THREE.Mesh(apronSideGeo, darkWoodMat);
  rightOuterWall.position.set(0.86, 0.52, 0);
  const leftInnerWall = new THREE.Mesh(apronSideGeo, darkWoodMat);
  leftInnerWall.position.set(-0.34, 0.52, 0);
  const rightInnerWall = new THREE.Mesh(apronSideGeo, darkWoodMat);
  rightInnerWall.position.set(0.34, 0.52, 0);
  deskGroup.add(leftOuterWall, rightOuterWall, leftInnerWall, rightInnerWall);

  // Pedestal Bottom Shelves & Upper Front Rail Sealing Cavity Above Drawers
  const pedBotGeo = track(new THREE.BoxGeometry(0.52, 0.03, 0.84));
  const leftPedBot = new THREE.Mesh(pedBotGeo, darkWoodMat);
  leftPedBot.position.set(-0.6, 0.31, 0);
  const rightPedBot = new THREE.Mesh(pedBotGeo, darkWoodMat);
  rightPedBot.position.set(0.6, 0.31, 0);
  const upperFrontRail = new THREE.Mesh(track(new THREE.BoxGeometry(1.76, 0.085, 0.045)), darkWoodMat);
  upperFrontRail.position.set(0, 0.71, 0.42);
  const lowerLeftApron = new THREE.Mesh(track(new THREE.BoxGeometry(0.5, 0.15, 0.035)), darkWoodMat);
  lowerLeftApron.position.set(-0.6, 0.385, 0.415);
  const lowerRightApron = new THREE.Mesh(track(new THREE.BoxGeometry(0.5, 0.15, 0.035)), darkWoodMat);
  lowerRightApron.position.set(0.6, 0.385, 0.415);
  deskGroup.add(leftPedBot, rightPedBot, upperFrontRail, lowerLeftApron, lowerRightApron);

  // 4 Sculpted LatheGeometry Turned Antique Desk Legs
  const legProfile = [
    new THREE.Vector2(0.022, 0.0),
    new THREE.Vector2(0.036, 0.04),
    new THREE.Vector2(0.025, 0.09),
    new THREE.Vector2(0.042, 0.17),
    new THREE.Vector2(0.028, 0.26),
    new THREE.Vector2(0.046, 0.36),
    new THREE.Vector2(0.038, 0.52),
    new THREE.Vector2(0.048, 0.72),
  ];
  const legGeo = track(new THREE.LatheGeometry(legProfile, 14));
  for (const lx of [-0.84, 0.84]) {
    for (const lz of [-0.41, 0.41]) {
      const leg = new THREE.Mesh(legGeo, darkWoodMat);
      leg.position.set(lx, 0, lz);
      deskGroup.add(leg);
    }
  }

  // Helper to construct a real 5-sided hollow clickable wooden desk drawer
  const createDeskDrawer = (
    id: string,
    label: string,
    x: number,
    y: number,
    width: number,
    height: number,
  ): THREE.Group => {
    const dGroup = new THREE.Group();
    const depth = 0.74;
    dGroup.position.set(x, y, 0.04);
    deskGroup.add(dGroup);

    // Drawer front panel with raised molding
    const front = new THREE.Mesh(track(new THREE.BoxGeometry(width, height, 0.032)), darkWoodMat);
    front.position.set(0, 0, depth / 2);
    const bevel = new THREE.Mesh(
      track(new THREE.BoxGeometry(width - 0.04, height - 0.035, 0.016)),
      darkWoodMat,
    );
    bevel.position.set(0, 0, depth / 2 + 0.018);

    // Oxidized brass curved drawer pull
    const pullBar = new THREE.Mesh(
      track(new THREE.TorusGeometry(0.045, 0.009, 8, 16, Math.PI)),
      brassMat,
    );
    pullBar.rotation.x = Math.PI / 2;
    pullBar.position.set(0, 0, depth / 2 + 0.028);

    // Drawer bottom & sides (true open-top box!)
    const bot = new THREE.Mesh(track(new THREE.BoxGeometry(width - 0.03, 0.018, depth)), darkWoodMat);
    bot.position.set(0, -height / 2 + 0.015, 0);
    const sideL = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.018, height - 0.03, depth)),
      darkWoodMat,
    );
    sideL.position.set(-width / 2 + 0.016, -0.005, 0);
    const sideR = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.018, height - 0.03, depth)),
      darkWoodMat,
    );
    sideR.position.set(width / 2 - 0.016, -0.005, 0);
    const back = new THREE.Mesh(
      track(new THREE.BoxGeometry(width - 0.03, height - 0.03, 0.018)),
      darkWoodMat,
    );
    back.position.set(0, -0.005, -depth / 2 + 0.01);

    dGroup.add(front, bevel, pullBar, bot, sideL, sideR, back);

    // Invisible click target on drawer front (only front so items inside remain clickable when open!)
    const frontProxy = new THREE.Mesh(
      track(new THREE.BoxGeometry(width + 0.04, height + 0.04, 0.14)),
      track(new THREE.MeshBasicMaterial({ visible: false })),
    );
    frontProxy.position.set(0, 0, depth / 2 + 0.02);
    frontProxy.userData.skipShadow = true;
    tagInteractable(frontProxy, {
      id,
      kind: 'drawer',
      label,
      actionHint: 'فتح / إغلاق الدرج',
      drawerId: id,
    });
    dGroup.add(frontProxy);
    interactables.push(frontProxy);

    drawers.set(id, {
      id,
      label,
      group: dGroup,
      closedPos: dGroup.position.clone(),
      openOffset: new THREE.Vector3(0, 0, 0.44),
      isOpen: false,
      progress: 0,
      isMetal: false,
    });

    return dGroup;
  };

  const leftDeskDrawer = createDeskDrawer('desk_drawer_left', 'درج المكتب الأيسر', -0.6, 0.56, 0.48, 0.21);
  createDeskDrawer('desk_drawer_center', 'درج المكتب الأوسط', 0, 0.62, 0.64, 0.12);
  const rightDeskDrawer = createDeskDrawer('desk_drawer_right', 'درج المكتب الأيمن', 0.6, 0.56, 0.48, 0.21);

  // Add aged decoy file folder inside left desk drawer for realism
  const decoyPaper = new THREE.Mesh(track(new THREE.BoxGeometry(0.28, 0.008, 0.36)), paperMat);
  decoyPaper.position.set(0, -0.06, 0.04);
  decoyPaper.rotation.y = 0.14;
  leftDeskDrawer.add(decoyPaper);

  enableShadows(deskGroup, true, true);
  colliders.push({
    id: 'antique_desk',
    minX: -1.02,
    maxX: 1.02,
    minZ: -1.0,
    maxZ: 0.12,
  });

  // =========================================================================
  // 4. SWINGING FLICKERING METAL DESK LAMP (ON LEFT CORNER OF DESK)
  // =========================================================================
  const lampBaseGroup = new THREE.Group();
  lampBaseGroup.position.set(-0.66, 0.785, -0.22);
  lampBaseGroup.rotation.y = 0.52;
  deskGroup.add(lampBaseGroup);

  // Weighted Lathe Brass Base
  const lampFootProfile = [
    new THREE.Vector2(0.11, 0),
    new THREE.Vector2(0.105, 0.022),
    new THREE.Vector2(0.072, 0.048),
    new THREE.Vector2(0.032, 0.068),
    new THREE.Vector2(0.018, 0.09),
  ];
  const lampFoot = new THREE.Mesh(track(new THREE.LatheGeometry(lampFootProfile, 18)), brassMat);
  lampBaseGroup.add(lampFoot);

  // Curved Gooseneck Tubular Arm
  const armCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.08, 0),
    new THREE.Vector3(-0.04, 0.34, -0.03),
    new THREE.Vector3(0.06, 0.58, 0.06),
    new THREE.Vector3(0.22, 0.64, 0.16),
    new THREE.Vector3(0.26, 0.57, 0.19),
  ]);
  const lampArm = new THREE.Mesh(track(new THREE.TubeGeometry(armCurve, 22, 0.012, 10, false)), brassMat);
  lampBaseGroup.add(lampArm);

  // Swinging Hinged Lamp Shade Pivot
  const lampShadePivot = new THREE.Group();
  lampShadePivot.position.set(0.26, 0.56, 0.19);
  lampBaseGroup.add(lampShadePivot);

  const gimbalRing = new THREE.Mesh(track(new THREE.SphereGeometry(0.022, 10, 10)), brassMat);
  lampShadePivot.add(gimbalRing);

  // Flared Metal Bell Shade (LatheGeometry, DoubleSide)
  const shadeProfile = [
    new THREE.Vector2(0.028, 0.0),
    new THREE.Vector2(0.052, -0.04),
    new THREE.Vector2(0.118, -0.11),
    new THREE.Vector2(0.145, -0.155),
  ];
  const shadeMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.weatheredSteel.map,
      normalMap: textures.weatheredSteel.normalMap,
      roughnessMap: textures.weatheredSteel.roughnessMap,
      roughness: 0.55,
      metalness: 0.72,
      side: THREE.DoubleSide,
    }),
  );
  const lampShade = new THREE.Mesh(track(new THREE.LatheGeometry(shadeProfile, 22)), shadeMat);
  lampShadePivot.add(lampShade);

  // Glowing Tungsten Bulb inside shade
  const deskLampBulbMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xffe4b0,
      emissive: 0xffae45,
      emissiveIntensity: 3.4,
      roughness: 0.2,
      metalness: 0.0,
    }),
  );
  const bulb = new THREE.Mesh(track(new THREE.SphereGeometry(0.036, 12, 12)), deskLampBulbMat);
  bulb.position.y = -0.085;
  bulb.userData.skipShadow = true;
  lampShadePivot.add(bulb);

  // Flickering Warm PointLight attached to the swinging shade
  const deskLampLight = new THREE.PointLight(0xffb562, 2.8, 7.2, 1.85);
  deskLampLight.position.set(0, -0.14, 0);
  lampShadePivot.add(deskLampLight);

  enableShadows(lampBaseGroup, true, true);

  // =========================================================================
  // 5. ANTIQUE INTERROGATION CHAIR (BEHIND DESK)
  // =========================================================================
  const chairGroup = new THREE.Group();
  chairGroup.position.set(0.1, 0, -1.42);
  chairGroup.rotation.y = 0.24;
  roomGroup.add(chairGroup);
  roomGroup.add(makeContactShadow(textures.evidenceMaps.contactShadow, 0.85, 0.85, 0.1, -1.42, 0.45));

  const seat = new THREE.Mesh(track(new THREE.BoxGeometry(0.5, 0.045, 0.48)), darkWoodMat);
  seat.position.y = 0.46;
  const seatCushion = new THREE.Mesh(track(new THREE.BoxGeometry(0.44, 0.032, 0.42)), leatherMat);
  seatCushion.position.y = 0.495;
  chairGroup.add(seat, seatCushion);

  const chairLegGeo = track(new THREE.CylinderGeometry(0.022, 0.017, 0.46, 10));
  for (const cx of [-0.21, 0.21]) {
    for (const cz of [-0.2, 0.2]) {
      const cLeg = new THREE.Mesh(chairLegGeo, darkWoodMat);
      cLeg.position.set(cx, 0.23, cz);
      chairGroup.add(cLeg);
    }
  }
  const backStileGeo = track(new THREE.BoxGeometry(0.042, 0.56, 0.042));
  for (const cx of [-0.21, 0.21]) {
    const stile = new THREE.Mesh(backStileGeo, darkWoodMat);
    stile.position.set(cx, 0.75, -0.21);
    stile.rotation.x = -0.09;
    chairGroup.add(stile);
  }
  const backSlatGeo = track(new THREE.BoxGeometry(0.44, 0.06, 0.022));
  for (const sy of [0.68, 0.83, 0.98]) {
    const slat = new THREE.Mesh(backSlatGeo, darkWoodMat);
    slat.position.set(0, sy, -0.225 - (sy - 0.68) * 0.08);
    chairGroup.add(slat);
  }
  enableShadows(chairGroup, true, true);
  colliders.push({
    id: 'chair',
    minX: -0.24,
    maxX: 0.44,
    minZ: -1.75,
    maxZ: -1.1,
  });

  // =========================================================================
  // 6. METAL FILING CABINET (WEST WALL) WITH 2 CLICKABLE SLIDING DRAWERS
  // =========================================================================
  const cabinetGroup = new THREE.Group();
  cabinetGroup.position.set(-3.26, 0, -1.05);
  cabinetGroup.rotation.y = Math.PI / 2; // Faces +X into the room
  roomGroup.add(cabinetGroup);
  roomGroup.add(makeContactShadow(textures.evidenceMaps.contactShadow, 0.95, 1.05, -3.22, -1.05, 0.58));

  const cabW = 0.64;
  const cabH = 1.24;
  const cabD = 0.72;

  // Hollow cabinet frame (left, right, back, top, bottom) so drawers physically open
  const cabSideGeo = track(new THREE.BoxGeometry(0.038, cabH, cabD));
  const cabL = new THREE.Mesh(cabSideGeo, steelMat);
  cabL.position.set(-cabW / 2 + 0.019, cabH / 2, 0);
  const cabR = new THREE.Mesh(cabSideGeo, steelMat);
  cabR.position.set(cabW / 2 - 0.019, cabH / 2, 0);
  const cabBack = new THREE.Mesh(track(new THREE.BoxGeometry(cabW, cabH, 0.038)), steelMat);
  cabBack.position.set(0, cabH / 2, -cabD / 2 + 0.019);
  const cabTop = new THREE.Mesh(track(new THREE.BoxGeometry(cabW + 0.02, 0.042, cabD + 0.02)), steelMat);
  cabTop.position.set(0, cabH, 0);
  const cabBot = new THREE.Mesh(track(new THREE.BoxGeometry(cabW, 0.05, cabD)), steelMat);
  cabBot.position.set(0, 0.025, 0);
  cabinetGroup.add(cabL, cabR, cabBack, cabTop, cabBot);

  const createMetalDrawer = (id: string, label: string, y: number): THREE.Group => {
    const md = new THREE.Group();
    md.position.set(0, y, 0.02);
    cabinetGroup.add(md);

    const w = cabW - 0.09;
    const h = 0.52;
    const d = cabD - 0.08;

    const front = new THREE.Mesh(track(new THREE.BoxGeometry(w, h, 0.03)), steelMat);
    front.position.set(0, 0, d / 2);

    // Brass label frame & curved pull handle
    const lblFrame = new THREE.Mesh(track(new THREE.BoxGeometry(0.16, 0.08, 0.014)), brassMat);
    lblFrame.position.set(0, 0.12, d / 2 + 0.018);
    const lblCard = new THREE.Mesh(track(new THREE.PlaneGeometry(0.13, 0.055)), paperMat);
    lblCard.position.set(0, 0.12, d / 2 + 0.027);
    const handle = new THREE.Mesh(track(new THREE.TorusGeometry(0.055, 0.01, 8, 16, Math.PI)), brassMat);
    handle.rotation.x = Math.PI / 2;
    handle.position.set(0, -0.02, d / 2 + 0.024);

    // Inner metal drawer tray
    const trayBot = new THREE.Mesh(track(new THREE.BoxGeometry(w - 0.02, 0.018, d)), darkIronMat);
    trayBot.position.set(0, -h / 2 + 0.02, 0);
    const trayL = new THREE.Mesh(track(new THREE.BoxGeometry(0.016, h * 0.65, d)), darkIronMat);
    trayL.position.set(-w / 2 + 0.016, -0.06, 0);
    const trayR = new THREE.Mesh(track(new THREE.BoxGeometry(0.016, h * 0.65, d)), darkIronMat);
    trayR.position.set(w / 2 - 0.016, -0.06, 0);
    const trayBack = new THREE.Mesh(track(new THREE.BoxGeometry(w - 0.02, h * 0.65, 0.016)), darkIronMat);
    trayBack.position.set(0, -0.06, -d / 2 + 0.01);

    // Hanging manila file folders inside drawer
    for (let f = 0; f < 5; f++) {
      const folder = new THREE.Mesh(track(new THREE.BoxGeometry(w - 0.07, 0.24, 0.018)), paperMat);
      folder.position.set(0, -0.08, -0.22 + f * 0.075);
      md.add(folder);
    }

    md.add(front, lblFrame, lblCard, handle, trayBot, trayL, trayR, trayBack);

    const proxy = new THREE.Mesh(
      track(new THREE.BoxGeometry(w + 0.04, h + 0.02, 0.14)),
      track(new THREE.MeshBasicMaterial({ visible: false })),
    );
    proxy.position.set(0, 0, d / 2 + 0.02);
    proxy.userData.skipShadow = true;
    tagInteractable(proxy, {
      id,
      kind: 'drawer',
      label,
      actionHint: 'فتح / إغلاق درج الملفات',
      drawerId: id,
    });
    md.add(proxy);
    interactables.push(proxy);

    drawers.set(id, {
      id,
      label,
      group: md,
      closedPos: md.position.clone(),
      openOffset: new THREE.Vector3(0, 0, 0.46),
      isOpen: false,
      progress: 0,
      isMetal: true,
    });

    return md;
  };

  createMetalDrawer('cabinet_drawer_bottom', 'درج خزانة الملفات السفلي', 0.34);
  const topCabinetDrawer = createMetalDrawer('cabinet_drawer_top', 'درج خزانة الملفات العلوي', 0.91);

  enableShadows(cabinetGroup, true, true);
  colliders.push({
    id: 'filing_cabinet',
    minX: -3.72,
    maxX: -2.84,
    minZ: -1.44,
    maxZ: -0.66,
  });

  // Cork Forensic Evidence Board on West Wall
  const boardGroup = new THREE.Group();
  boardGroup.position.set(-halfW + 0.05, 1.72, 1.05);
  boardGroup.rotation.y = Math.PI / 2;
  roomGroup.add(boardGroup);

  const boardFrame = new THREE.Mesh(track(new THREE.BoxGeometry(1.56, 1.06, 0.05)), darkWoodMat);
  const boardSurfaceMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.evidenceMaps.corkBoard,
      bumpMap: textures.woodFloor.bumpMap,
      bumpScale: 0.015,
      roughness: 0.88,
      metalness: 0.0,
    }),
  );
  const boardFace = new THREE.Mesh(track(new THREE.PlaneGeometry(1.44, 0.94)), boardSurfaceMat);
  boardFace.position.z = 0.028;
  boardGroup.add(boardFrame, boardFace);
  enableShadows(boardGroup, true, true);

  // =========================================================================
  // 7. WOODEN BOOKCASE (EAST WALL) WITH 30+ VARIED HARDCOVER BOOKS
  // =========================================================================
  const bookcaseGroup = new THREE.Group();
  bookcaseGroup.position.set(3.34, 0, -0.65);
  bookcaseGroup.rotation.y = -Math.PI / 2; // Faces -X into the room
  roomGroup.add(bookcaseGroup);
  roomGroup.add(makeContactShadow(textures.evidenceMaps.contactShadow, 0.85, 2.0, 3.25, -0.65, 0.58));

  const bcW = 1.66;
  const bcH = 2.32;
  const bcD = 0.44;

  const bcBack = new THREE.Mesh(track(new THREE.BoxGeometry(bcW, bcH, 0.032)), darkWoodMat);
  bcBack.position.set(0, bcH / 2, -bcD / 2 + 0.016);
  const bcSideL = new THREE.Mesh(track(new THREE.BoxGeometry(0.055, bcH, bcD)), darkWoodMat);
  bcSideL.position.set(-bcW / 2 + 0.027, bcH / 2, 0);
  const bcSideR = new THREE.Mesh(track(new THREE.BoxGeometry(0.055, bcH, bcD)), darkWoodMat);
  bcSideR.position.set(bcW / 2 - 0.027, bcH / 2, 0);
  const bcCornice = new THREE.Mesh(track(new THREE.BoxGeometry(bcW + 0.12, 0.095, bcD + 0.08)), darkWoodMat);
  bcCornice.position.set(0, bcH + 0.03, 0.02);
  const bcPlinth = new THREE.Mesh(track(new THREE.BoxGeometry(bcW + 0.06, 0.12, bcD + 0.04)), darkWoodMat);
  bcPlinth.position.set(0, 0.06, 0.01);
  bookcaseGroup.add(bcBack, bcSideL, bcSideR, bcCornice, bcPlinth);

  const shelfHeights = [0.14, 0.62, 1.1, 1.58, 2.04];
  const shelfGeo = track(new THREE.BoxGeometry(bcW - 0.09, 0.036, bcD - 0.03));
  for (const sy of shelfHeights) {
    const shelf = new THREE.Mesh(shelfGeo, darkWoodMat);
    shelf.position.set(0, sy, 0.01);
    bookcaseGroup.add(shelf);
  }

  // Diverse leather-textured hardcover book materials (zero flat untextured colors!)
  const bookTints = [0x6a2822, 0x263c35, 0x2a3248, 0x5d4426, 0x452b3b, 0x3b4430, 0x765a34];
  const bookMats = bookTints.map((tint) =>
    track(
      new THREE.MeshStandardMaterial({
        color: tint,
        map: textures.leather.map,
        normalMap: textures.leather.normalMap,
        roughnessMap: textures.leather.roughnessMap,
        roughness: 0.78,
        metalness: 0.06,
      }),
    ),
  );

  // Populate shelves with varied books (leaving a clear showcase gap on shelf y=1.1 for the Medicine Bottle!)
  let bookSeed = 1337;
  const rand = () => {
    bookSeed = (Math.imul(1664525, bookSeed) + 1013904223) >>> 0;
    return bookSeed / 4294967296;
  };

  for (let sIdx = 0; sIdx < 4; sIdx++) {
    const baseY = shelfHeights[sIdx] + 0.018;
    let cursorX = -bcW / 2 + 0.1;

    while (cursorX < bcW / 2 - 0.16) {
      // Reserve visible center spot on middle shelf (sIdx === 2, y = 1.1) for the Medicine Bottle!
      if (sIdx === 2 && cursorX > -0.22 && cursorX < 0.24) {
        cursorX = 0.26;
        continue;
      }

      const bThick = 0.034 + rand() * 0.032;
      const bHeight = 0.22 + rand() * 0.14;
      const bDepth = 0.2 + rand() * 0.09;
      const mat = bookMats[Math.floor(rand() * bookMats.length)];

      const book = new THREE.Group();
      const cover = new THREE.Mesh(track(new THREE.BoxGeometry(bThick, bHeight, bDepth)), mat);
      // Recessed yellowed paper page block
      const pages = new THREE.Mesh(
        track(new THREE.BoxGeometry(bThick * 0.76, bHeight - 0.018, bDepth - 0.018)),
        paperMat,
      );
      pages.position.z = -0.008;
      // Subtle brass spine accent band
      const band = new THREE.Mesh(
        track(new THREE.BoxGeometry(bThick + 0.003, 0.014, 0.008)),
        brassMat,
      );
      band.position.set(0, bHeight * 0.24, bDepth / 2);

      book.add(cover, pages, band);
      book.position.set(cursorX + bThick / 2, baseY + bHeight / 2, 0.02 + (rand() - 0.5) * 0.04);

      // Slight organic tilt on occasional end books
      if (rand() < 0.12 && cursorX > 0.35) {
        book.rotation.z = -0.14;
        book.position.x += 0.03;
      }

      bookcaseGroup.add(book);
      cursorX += bThick + 0.006 + (rand() < 0.18 ? 0.07 : 0);
    }
  }

  enableShadows(bookcaseGroup, true, true);
  colliders.push({
    id: 'bookcase',
    minX: 3.04,
    maxX: 3.74,
    minZ: -1.55,
    maxZ: 0.25,
  });

  // =========================================================================
  // 8. THE 5 DETAILED COMPOSITE FORENSIC EVIDENCE ARTIFACTS
  // =========================================================================

  const registerEvidence = (
    id: EvidenceId,
    group: THREE.Group,
    parent: THREE.Object3D,
    pos: THREE.Vector3,
    rot: THREE.Euler,
    inspectScale: number,
    inspectBaseEuler: THREE.Euler,
    proxySize: [number, number, number],
  ) => {
    const def = EVIDENCE_MAP[id];
    group.position.copy(pos);
    group.rotation.copy(rot);
    parent.add(group);

    // Subtle thin oxidized brass indicator halo (barely visible diegetic glint, static—no pulsing dot!)
    const ringGeo = track(new THREE.RingGeometry(0.055, 0.064, 24));
    const ringMat = track(
      new THREE.MeshBasicMaterial({
        color: 0xd9a84e,
        transparent: true,
        opacity: 0.22,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    const glowRing = new THREE.Mesh(ringGeo, ringMat);
    glowRing.rotation.x = -Math.PI / 2;
    glowRing.position.y = 0.005;
    glowRing.userData.skipShadow = true;
    group.add(glowRing);

    // Generous invisible raycast hitbox
    const proxy = new THREE.Mesh(
      track(new THREE.BoxGeometry(proxySize[0], proxySize[1], proxySize[2])),
      track(new THREE.MeshBasicMaterial({ visible: false })),
    );
    proxy.userData.skipShadow = true;
    tagInteractable(proxy, {
      id,
      kind: 'evidence',
      label: def.title,
      actionHint: 'فحص الدليل ٣٦٠ درجة',
      evidenceId: id,
    });
    group.add(proxy);
    interactables.push(proxy);
    enableShadows(group, true, true);

    evidenceHandles.set(id, {
      id,
      group,
      homeParent: parent,
      homePosition: group.position.clone(),
      homeQuaternion: group.quaternion.clone(),
      homeScale: group.scale.clone(),
      inspectScale,
      inspectBaseEuler,
      glowRing,
    });
  };

  // --- EVIDENCE 1: Torn Paper Note (on top of antique desk) ---
  {
    const noteGroup = new THREE.Group();
    const noteW = 0.22;
    const noteH = 0.28;

    // Front printed torn-note surface
    const frontMat = track(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: textures.evidenceMaps.noteFront,
        normalMap: textures.agedPaper.normalMap,
        roughnessMap: textures.agedPaper.roughnessMap,
        roughness: 0.92,
        metalness: 0.0,
      }),
    );
    const backMat = track(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: textures.evidenceMaps.noteBack,
        normalMap: textures.agedPaper.normalMap,
        roughnessMap: textures.agedPaper.roughnessMap,
        roughness: 0.92,
        metalness: 0.0,
      }),
    );

    const sheetFront = new THREE.Mesh(track(new THREE.PlaneGeometry(noteW, noteH)), frontMat);
    sheetFront.rotation.x = -Math.PI / 2;
    sheetFront.position.y = 0.004;

    const sheetBack = new THREE.Mesh(track(new THREE.PlaneGeometry(noteW, noteH)), backMat);
    sheetBack.rotation.x = Math.PI / 2;
    sheetBack.rotation.z = Math.PI;
    sheetBack.position.y = 0.002;

    // Curled torn corner flap
    const tornFlap = new THREE.Mesh(track(new THREE.BoxGeometry(0.06, 0.003, 0.055)), paperMat);
    tornFlap.position.set(-0.085, 0.009, 0.11);
    tornFlap.rotation.set(0.24, 0.35, -0.18);

    // Metallic paperclip on top-right corner
    const clipCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.07, 0.009, -0.12),
      new THREE.Vector3(0.07, 0.009, -0.08),
      new THREE.Vector3(0.084, 0.009, -0.076),
      new THREE.Vector3(0.084, 0.009, -0.132),
      new THREE.Vector3(0.064, 0.009, -0.132),
      new THREE.Vector3(0.064, 0.009, -0.095),
    ]);
    const paperClip = new THREE.Mesh(track(new THREE.TubeGeometry(clipCurve, 18, 0.0022, 6, false)), brassMat);

    // Red forensic evidence tab
    const tagMesh = new THREE.Mesh(
      track(
        new THREE.MeshStandardMaterial({
          color: 0x9b221e,
          map: textures.agedPaper.map,
          roughness: 0.85,
        })
          ? new THREE.BoxGeometry(0.042, 0.003, 0.022)
          : new THREE.BoxGeometry(0.042, 0.003, 0.022),
      ),
      track(
        new THREE.MeshStandardMaterial({
          color: 0x9b221e,
          map: textures.agedPaper.map,
          roughness: 0.85,
        }),
      ),
    );
    tagMesh.position.set(0.088, 0.007, -0.125);

    noteGroup.add(sheetFront, sheetBack, tornFlap, paperClip, tagMesh);

    registerEvidence(
      'torn_note',
      noteGroup,
      deskGroup,
      new THREE.Vector3(0.24, 0.802, 0.08),
      new THREE.Euler(0, -0.18, 0),
      1.02,
      new THREE.Euler(Math.PI / 2, 0, 0),
      [0.32, 0.14, 0.36],
    );
  }

  // --- EVIDENCE 2: Stopped Brass Pocket Watch (inside Right Desk Drawer!) ---
  {
    const watchGroup = new THREE.Group();

    // Main circular oxidized brass rim & back case
    const caseRim = new THREE.Mesh(track(new THREE.TorusGeometry(0.048, 0.01, 14, 28)), brassMat);
    caseRim.rotation.x = Math.PI / 2;
    caseRim.position.y = 0.012;

    const caseBack = new THREE.Mesh(track(new THREE.CylinderGeometry(0.048, 0.046, 0.012, 26)), brassMat);
    caseBack.position.y = 0.006;

    // Detailed Enamel Watch Dial showing 07:15
    const dialMat = track(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: textures.evidenceMaps.watchDial,
        roughness: 0.35,
        metalness: 0.05,
      }),
    );
    const dialFace = new THREE.Mesh(track(new THREE.CircleGeometry(0.043, 28)), dialMat);
    dialFace.rotation.x = -Math.PI / 2;
    dialFace.position.y = 0.015;

    // Domed dusty glass crystal over watch face
    const crystal = new THREE.Mesh(
      track(new THREE.SphereGeometry(0.044, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.32)),
      dustyGlassMat,
    );
    crystal.scale.set(1, 0.35, 1);
    crystal.position.y = 0.012;
    crystal.renderOrder = 3;

    // Knurled winding crown + hanging bow loop
    const crown = new THREE.Mesh(track(new THREE.CylinderGeometry(0.008, 0.008, 0.016, 12)), brassMat);
    crown.rotation.x = Math.PI / 2;
    crown.position.set(0, 0.012, -0.058);

    const bowLoop = new THREE.Mesh(track(new THREE.TorusGeometry(0.014, 0.0032, 8, 16)), brassMat);
    bowLoop.rotation.x = Math.PI / 2;
    bowLoop.position.set(0, 0.012, -0.072);

    // Hinged Open Lid angled back at 112 deg with inner engraved brass plate ("07:15 - 7")
    const lidPivot = new THREE.Group();
    lidPivot.position.set(0, 0.018, -0.048);
    lidPivot.rotation.x = -1.78;
    const lidOuter = new THREE.Mesh(track(new THREE.CylinderGeometry(0.048, 0.048, 0.006, 24)), brassMat);
    lidOuter.position.set(0, 0, 0.048);
    const lidInnerMat = track(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: textures.evidenceMaps.watchLidInner,
        normalMap: textures.oxidizedBrass.normalMap,
        roughness: 0.45,
        metalness: 0.78,
      }),
    );
    const lidInner = new THREE.Mesh(track(new THREE.CircleGeometry(0.043, 24)), lidInnerMat);
    lidInner.rotation.x = Math.PI / 2;
    lidInner.position.set(0, -0.004, 0.048);
    lidPivot.add(lidOuter, lidInner);

    // Coiled brass pocket chain (6 interlocking torus links)
    const linkGeo = track(new THREE.TorusGeometry(0.009, 0.0024, 6, 12));
    for (let i = 0; i < 6; i++) {
      const link = new THREE.Mesh(linkGeo, brassMat);
      link.position.set(0.02 + i * 0.014, 0.008, -0.074 + Math.sin(i * 0.9) * 0.014);
      link.rotation.x = i % 2 === 0 ? Math.PI / 2 : 0.25;
      watchGroup.add(link);
    }

    watchGroup.add(caseRim, caseBack, dialFace, crystal, crown, bowLoop, lidPivot);

    registerEvidence(
      'pocket_watch',
      watchGroup,
      rightDeskDrawer,
      new THREE.Vector3(0.02, -0.068, 0.1),
      new THREE.Euler(0, 0.3, 0),
      2.35,
      new THREE.Euler(Math.PI / 2.2, 0, 0),
      [0.24, 0.16, 0.24],
    );
  }

  // --- EVIDENCE 3: Amber Glass Medicine Bottle (Bookcase Middle Shelf) ---
  {
    const bottleGroup = new THREE.Group();

    // LatheGeometry sculpted vintage pharmacy bottle silhouette
    const bottleProfile = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.036, 0.0),
      new THREE.Vector2(0.042, 0.008),
      new THREE.Vector2(0.042, 0.112),
      new THREE.Vector2(0.036, 0.128),
      new THREE.Vector2(0.022, 0.142),
      new THREE.Vector2(0.022, 0.162),
      new THREE.Vector2(0.026, 0.168),
      new THREE.Vector2(0.02, 0.172),
    ];
    const bottleBody = new THREE.Mesh(track(new THREE.LatheGeometry(bottleProfile, 24)), amberGlassMat);
    bottleBody.renderOrder = 3;

    // Wrapped aged prescription paper label (open-ended cylinder around body)
    const labelMat = track(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: textures.evidenceMaps.bottleLabel,
        bumpMap: textures.agedPaper.bumpMap,
        bumpScale: 0.004,
        roughness: 0.88,
        metalness: 0.0,
      }),
    );
    const labelCylinder = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.0432, 0.0432, 0.088, 24, 1, true)),
      labelMat,
    );
    labelCylinder.position.y = 0.062;
    labelCylinder.rotation.y = Math.PI * 0.45;

    // Dark bakelite ribbed screw cap
    const capMat = track(
      new THREE.MeshStandardMaterial({
        color: 0x261f1b,
        map: textures.leather.map,
        roughness: 0.42,
        metalness: 0.12,
      }),
    );
    const cap = new THREE.Mesh(track(new THREE.CylinderGeometry(0.028, 0.028, 0.028, 20)), capMat);
    cap.position.y = 0.178;
    const capRim = new THREE.Mesh(track(new THREE.TorusGeometry(0.027, 0.004, 8, 20)), capMat);
    capRim.rotation.x = Math.PI / 2;
    capRim.position.y = 0.165;

    // 4 visible white medical pills resting inside the translucent amber glass bottom
    const pillGeo = track(new THREE.CapsuleGeometry(0.0055, 0.011, 6, 8));
    const pillMat = track(
      new THREE.MeshStandardMaterial({
        color: 0xf2ece1,
        map: textures.agedPaper.map,
        roughness: 0.35,
        metalness: 0.0,
      }),
    );
    const pillOffsets: Array<[number, number, number, number]> = [
      [-0.012, 0.012, 0.008, 0.4],
      [0.011, 0.012, -0.006, 1.2],
      [0.002, 0.016, 0.012, 2.1],
      [-0.008, 0.018, -0.012, 0.8],
    ];
    for (const [px, py, pz, rot] of pillOffsets) {
      const pill = new THREE.Mesh(pillGeo, pillMat);
      pill.position.set(px, py, pz);
      pill.rotation.set(Math.PI / 2, rot, 0.3);
      bottleGroup.add(pill);
    }

    bottleGroup.add(bottleBody, labelCylinder, cap, capRim);

    registerEvidence(
      'medicine_bottle',
      bottleGroup,
      bookcaseGroup,
      new THREE.Vector3(0.02, shelfHeights[2] + 0.02, 0.06),
      new THREE.Euler(0, 0.2, 0),
      1.75,
      new THREE.Euler(0.15, -0.2, 0),
      [0.2, 0.28, 0.2],
    );
  }

  // --- EVIDENCE 4: Old Oxidized Brass Key (inside Top Filing Cabinet Drawer!) ---
  {
    const keyGroup = new THREE.Group();

    // Central circular medallion with engraved "خزانة رقم 1" on front and "1" on back
    const medallionRim = new THREE.Mesh(track(new THREE.CylinderGeometry(0.032, 0.032, 0.008, 22)), brassMat);
    medallionRim.position.set(0, 0.008, -0.052);

    const keyFrontMat = track(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: textures.evidenceMaps.keyFront,
        normalMap: textures.oxidizedBrass.normalMap,
        roughness: 0.48,
        metalness: 0.82,
      }),
    );
    const keyBackMat = track(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: textures.evidenceMaps.keyBack,
        normalMap: textures.oxidizedBrass.normalMap,
        roughness: 0.48,
        metalness: 0.82,
      }),
    );
    const medFront = new THREE.Mesh(track(new THREE.CircleGeometry(0.03, 22)), keyFrontMat);
    medFront.rotation.x = -Math.PI / 2;
    medFront.position.set(0, 0.0126, -0.052);

    const medBack = new THREE.Mesh(track(new THREE.CircleGeometry(0.03, 22)), keyBackMat);
    medBack.rotation.x = Math.PI / 2;
    medBack.position.set(0, 0.0034, -0.052);

    // Ornate trefoil decorative bow rings around medallion
    const bowRingGeo = track(new THREE.TorusGeometry(0.015, 0.004, 8, 16));
    for (const [bx, bz] of [
      [-0.026, -0.064],
      [0.026, -0.064],
      [0, -0.084],
    ]) {
      const r = new THREE.Mesh(bowRingGeo, brassMat);
      r.rotation.x = Math.PI / 2;
      r.position.set(bx, 0.008, bz);
      keyGroup.add(r);
    }

    // Lathe-turned tapered key shaft with decorative collars
    const shaftProfile = [
      new THREE.Vector2(0.006, 0),
      new THREE.Vector2(0.011, 0.008),
      new THREE.Vector2(0.006, 0.016),
      new THREE.Vector2(0.006, 0.082),
      new THREE.Vector2(0.009, 0.088),
      new THREE.Vector2(0.0055, 0.115),
    ];
    const shaft = new THREE.Mesh(track(new THREE.LatheGeometry(shaftProfile, 12)), brassMat);
    shaft.rotation.x = Math.PI / 2;
    shaft.position.set(0, 0.008, -0.02);

    // Warded key bit plate with carved teeth
    const bitMain = new THREE.Mesh(track(new THREE.BoxGeometry(0.032, 0.007, 0.036)), brassMat);
    bitMain.position.set(0.018, 0.008, 0.072);
    const tooth1 = new THREE.Mesh(track(new THREE.BoxGeometry(0.016, 0.007, 0.009)), brassMat);
    tooth1.position.set(0.035, 0.008, 0.06);
    const tooth2 = new THREE.Mesh(track(new THREE.BoxGeometry(0.02, 0.007, 0.011)), brassMat);
    tooth2.position.set(0.037, 0.008, 0.083);

    keyGroup.add(medallionRim, medFront, medBack, shaft, bitMain, tooth1, tooth2);

    registerEvidence(
      'brass_key',
      keyGroup,
      topCabinetDrawer,
      new THREE.Vector3(0.02, 0.055, 0.16),
      new THREE.Euler(0, 0.45, 0),
      2.2,
      new THREE.Euler(Math.PI / 2, 0, 0),
      [0.24, 0.16, 0.28],
    );
  }

  // --- EVIDENCE 5: Burned-Edge Crime Scene Photograph (on Moonlit Window Sill) ---
  {
    const photoGroup = new THREE.Group();
    const pw = 0.2;
    const ph = 0.22;

    const pFrontMat = track(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: textures.evidenceMaps.photoFront,
        bumpMap: textures.agedPaper.bumpMap,
        bumpScale: 0.004,
        roughness: 0.48,
        metalness: 0.04,
      }),
    );
    const pBackMat = track(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: textures.evidenceMaps.photoBack,
        bumpMap: textures.agedPaper.bumpMap,
        bumpScale: 0.006,
        roughness: 0.88,
        metalness: 0.0,
      }),
    );
    const charMat = track(
      new THREE.MeshStandardMaterial({
        color: 0x16100b,
        map: textures.agedPaper.map,
        roughness: 0.96,
        metalness: 0.0,
      }),
    );

    const pFront = new THREE.Mesh(track(new THREE.PlaneGeometry(pw, ph)), pFrontMat);
    pFront.rotation.x = -Math.PI / 2;
    pFront.position.y = 0.004;

    const pBack = new THREE.Mesh(track(new THREE.PlaneGeometry(pw, ph)), pBackMat);
    pBack.rotation.x = Math.PI / 2;
    pBack.rotation.z = Math.PI;
    pBack.position.y = 0.002;

    // Charred curled corner chips along burned edges
    const charEdge1 = new THREE.Mesh(track(new THREE.BoxGeometry(0.045, 0.004, 0.032)), charMat);
    charEdge1.position.set(0.082, 0.007, 0.095);
    charEdge1.rotation.set(0.26, 0.4, 0.18);

    const charEdge2 = new THREE.Mesh(track(new THREE.BoxGeometry(0.038, 0.004, 0.028)), charMat);
    charEdge2.position.set(-0.084, 0.007, -0.095);
    charEdge2.rotation.set(-0.22, -0.35, -0.2);

    photoGroup.add(pFront, pBack, charEdge1, charEdge2);

    registerEvidence(
      'burned_photo',
      photoGroup,
      windowGroup,
      new THREE.Vector3(-0.34, 1.084, 0.06),
      new THREE.Euler(0, 0.34, 0),
      1.55,
      new THREE.Euler(Math.PI / 2, 0, 0),
      [0.3, 0.16, 0.32],
    );
  }

  // =========================================================================
  // 9. FLOATING ATMOSPHERIC DUST MOTES (SOFT CIRCULAR SPRITE, ZERO-GC BUFFER)
  // =========================================================================
  const dustCount = 110;
  const dustPositions = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i++) {
    dustPositions[i * 3] = (rand() - 0.5) * (roomW - 0.8);
    dustPositions[i * 3 + 1] = 0.25 + rand() * (roomH - 0.5);
    dustPositions[i * 3 + 2] = (rand() - 0.5) * (roomD - 0.8);
  }
  const dustGeo = track(new THREE.BufferGeometry());
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));

  // Soft circular glow sprite so dust motes never render as raw squares
  const dustSpriteCanvas = document.createElement('canvas');
  dustSpriteCanvas.width = 32;
  dustSpriteCanvas.height = 32;
  const dCtx = dustSpriteCanvas.getContext('2d')!;
  const dGrad = dCtx.createRadialGradient(16, 16, 0, 16, 16, 16);
  dGrad.addColorStop(0, 'rgba(255, 248, 232, 1)');
  dGrad.addColorStop(0.45, 'rgba(210, 224, 245, 0.45)');
  dGrad.addColorStop(1, 'rgba(210, 224, 245, 0)');
  dCtx.fillStyle = dGrad;
  dCtx.fillRect(0, 0, 32, 32);
  const dustSpriteTex = track(new THREE.CanvasTexture(dustSpriteCanvas));

  const dustMat = track(
    new THREE.PointsMaterial({
      color: 0xd8e2f2,
      map: dustSpriteTex,
      size: 0.042,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  const dustPoints = new THREE.Points(dustGeo, dustMat);
  dustPoints.frustumCulled = false;
  roomGroup.add(dustPoints);

  return {
    roomBounds,
    colliders,
    interactables,
    drawers,
    evidenceHandles,
    lampShadePivot,
    deskLampLight,
    deskLampBulbMat,
    doorPivot,
    keypadLedMat,
    dustPoints,
    dustPositions,
    dispose: () => {
      for (const d of disposables) {
        d.dispose();
      }
    },
  };
}
