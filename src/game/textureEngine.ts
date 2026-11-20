import * as THREE from 'three';

export interface PBRTextureSet {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
}

export interface RoomTextureLibrary {
  woodFloor: PBRTextureSet;
  stoneWall: PBRTextureSet;
  oxidizedBrass: PBRTextureSet;
  agedPaper: PBRTextureSet;
  dustyGlass: PBRTextureSet;
  darkWood: PBRTextureSet;
  weatheredSteel: PBRTextureSet;
  leather: PBRTextureSet;
  evidenceMaps: {
    noteFront: THREE.CanvasTexture;
    noteBack: THREE.CanvasTexture;
    watchDial: THREE.CanvasTexture;
    watchLidInner: THREE.CanvasTexture;
    bottleLabel: THREE.CanvasTexture;
    keyFront: THREE.CanvasTexture;
    keyBack: THREE.CanvasTexture;
    photoFront: THREE.CanvasTexture;
    photoBack: THREE.CanvasTexture;
    doorPlaque: THREE.CanvasTexture;
    keypadFace: THREE.CanvasTexture;
    corkBoard: THREE.CanvasTexture;
    contactShadow: THREE.CanvasTexture;
  };
  dispose: () => void;
}

/**
 * Deterministic 2D Perlin Gradient Noise + Fractional Brownian Motion (fBm)
 */
class PerlinNoise2D {
  private perm: Uint8Array;

  constructor(seed = 404) {
    this.perm = new Uint8Array(512);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    let s = seed >>> 0;
    for (let i = 255; i > 0; i--) {
      s = (Math.imul(1664525, s) + 1013904223) >>> 0;
      const j = s % (i + 1);
      const tmp = p[i];
      p[i] = p[j];
      p[j] = tmp;
    }
    for (let i = 0; i < 512; i++) {
      this.perm[i] = p[i & 255];
    }
  }

  private static fade(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  private static lerp(a: number, b: number, t: number): number {
    return a + t * (b - a);
  }

  private static grad(hash: number, x: number, y: number): number {
    const h = hash & 7;
    const u = h < 4 ? x : y;
    const v = h < 4 ? y : x;
    return ((h & 1) ? -u : u) + ((h & 2) ? -2.0 * v : 2.0 * v);
  }

  /** Periodic tileable Perlin noise in [0..1] when period > 0 */
  public noise(x: number, y: number, period = 0): number {
    let xi = Math.floor(x);
    let yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;

    let xi1 = xi + 1;
    let yi1 = yi + 1;

    if (period > 0) {
      xi = ((xi % period) + period) % period;
      yi = ((yi % period) + period) % period;
      xi1 = ((xi1 % period) + period) % period;
      yi1 = ((yi1 % period) + period) % period;
    }

    const X = xi & 255;
    const Y = yi & 255;
    const X1 = xi1 & 255;
    const Y1 = yi1 & 255;

    const u = PerlinNoise2D.fade(xf);
    const v = PerlinNoise2D.fade(yf);

    const aa = this.perm[this.perm[X] + Y];
    const ab = this.perm[this.perm[X] + Y1];
    const ba = this.perm[this.perm[X1] + Y];
    const bb = this.perm[this.perm[X1] + Y1];

    const x1 = PerlinNoise2D.lerp(
      PerlinNoise2D.grad(aa, xf, yf),
      PerlinNoise2D.grad(ba, xf - 1, yf),
      u,
    );
    const x2 = PerlinNoise2D.lerp(
      PerlinNoise2D.grad(ab, xf, yf - 1),
      PerlinNoise2D.grad(bb, xf - 1, yf - 1),
      u,
    );

    const val = PerlinNoise2D.lerp(x1, x2, v);
    return Math.max(0, Math.min(1, val * 0.35 + 0.5));
  }

  /** Multi-octave tileable Fractional Brownian Motion in [0..1] */
  public fbm(x: number, y: number, octaves = 4, basePeriod = 0): number {
    let sum = 0;
    let amp = 0.5;
    let freq = 1;
    let norm = 0;
    for (let o = 0; o < octaves; o++) {
      sum += amp * this.noise(x * freq, y * freq, basePeriod > 0 ? basePeriod * freq : 0);
      norm += amp;
      amp *= 0.5;
      freq *= 2;
    }
    return sum / norm;
  }
}

function clampByte(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v | 0;
}

function configureTexture(
  tex: THREE.CanvasTexture,
  isColor: boolean,
  maxAnisotropy: number,
  repeatX = 1,
  repeatY = 1,
): THREE.CanvasTexture {
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = maxAnisotropy;
  if (isColor) {
    tex.colorSpace = THREE.SRGBColorSpace;
  }
  tex.needsUpdate = true;
  return tex;
}

/**
 * Converts a 512x512 float heightfield [0..1] into:
 * - grayscale bumpMap canvas
 * - tangent-space Sobel normalMap canvas
 */
function buildHeightAndNormalTextures(
  size: number,
  heightField: Float32Array,
  normalStrength: number,
  maxAnisotropy: number,
  repeatX: number,
  repeatY: number,
): { bumpMap: THREE.CanvasTexture; normalMap: THREE.CanvasTexture } {
  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bumpCtx = bumpCanvas.getContext('2d')!;
  const bumpImg = bumpCtx.createImageData(size, size);
  const bumpData = bumpImg.data;

  const normCanvas = document.createElement('canvas');
  normCanvas.width = size;
  normCanvas.height = size;
  const normCtx = normCanvas.getContext('2d')!;
  const normImg = normCtx.createImageData(size, size);
  const normData = normImg.data;

  const mask = size - 1;

  for (let y = 0; y < size; y++) {
    const ym1 = (y - 1) & mask;
    const yp1 = (y + 1) & mask;
    const row = y * size;
    const rowM1 = ym1 * size;
    const rowP1 = yp1 * size;

    for (let x = 0; x < size; x++) {
      const xm1 = (x - 1) & mask;
      const xp1 = (x + 1) & mask;

      const h = heightField[row + x];
      const idx = (row + x) * 4;

      const bVal = clampByte(h * 255);
      bumpData[idx] = bVal;
      bumpData[idx + 1] = bVal;
      bumpData[idx + 2] = bVal;
      bumpData[idx + 3] = 255;

      // 3x3 Sobel filter for crisp tangent-space normals
      const tl = heightField[rowM1 + xm1];
      const t = heightField[rowM1 + x];
      const tr = heightField[rowM1 + xp1];
      const l = heightField[row + xm1];
      const r = heightField[row + xp1];
      const bl = heightField[rowP1 + xm1];
      const b = heightField[rowP1 + x];
      const br = heightField[rowP1 + xp1];

      const dx = (tr + 2 * r + br - (tl + 2 * l + bl)) * normalStrength;
      const dy = (bl + 2 * b + br - (tl + 2 * t + tr)) * normalStrength;
      const dz = 1.0;
      const invLen = 1.0 / Math.sqrt(dx * dx + dy * dy + dz * dz);

      normData[idx] = clampByte((-dx * invLen * 0.5 + 0.5) * 255);
      normData[idx + 1] = clampByte((-dy * invLen * 0.5 + 0.5) * 255);
      normData[idx + 2] = clampByte((dz * invLen * 0.5 + 0.5) * 255);
      normData[idx + 3] = 255;
    }
  }

  bumpCtx.putImageData(bumpImg, 0, 0);
  normCtx.putImageData(normImg, 0, 0);

  return {
    bumpMap: configureTexture(new THREE.CanvasTexture(bumpCanvas), false, maxAnisotropy, repeatX, repeatY),
    normalMap: configureTexture(new THREE.CanvasTexture(normCanvas), false, maxAnisotropy, repeatX, repeatY),
  };
}

function createPBRFromGenerator(
  size: number,
  maxAnisotropy: number,
  repeatX: number,
  repeatY: number,
  normalStrength: number,
  fillPixel: (
    x: number,
    y: number,
    u: number,
    v: number,
    outColor: [number, number, number, number],
  ) => { height: number; roughness: number },
): PBRTextureSet {
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = size;
  colorCanvas.height = size;
  const colorCtx = colorCanvas.getContext('2d')!;
  const colorImg = colorCtx.createImageData(size, size);
  const cData = colorImg.data;

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const roughCtx = roughCanvas.getContext('2d')!;
  const roughImg = roughCtx.createImageData(size, size);
  const rData = roughImg.data;

  const heightField = new Float32Array(size * size);
  const rgba: [number, number, number, number] = [0, 0, 0, 255];

  for (let y = 0; y < size; y++) {
    const v = y / size;
    const row = y * size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const { height, roughness } = fillPixel(x, y, u, v, rgba);
      const idx = (row + x) * 4;
      cData[idx] = clampByte(rgba[0]);
      cData[idx + 1] = clampByte(rgba[1]);
      cData[idx + 2] = clampByte(rgba[2]);
      cData[idx + 3] = clampByte(rgba[3]);

      const rv = clampByte(roughness * 255);
      rData[idx] = rv;
      rData[idx + 1] = rv;
      rData[idx + 2] = rv;
      rData[idx + 3] = 255;

      heightField[row + x] = height;
    }
  }

  colorCtx.putImageData(colorImg, 0, 0);
  roughCtx.putImageData(roughImg, 0, 0);

  const map = configureTexture(new THREE.CanvasTexture(colorCanvas), true, maxAnisotropy, repeatX, repeatY);
  const roughnessMap = configureTexture(
    new THREE.CanvasTexture(roughCanvas),
    false,
    maxAnisotropy,
    repeatX,
    repeatY,
  );
  const { bumpMap, normalMap } = buildHeightAndNormalTextures(
    size,
    heightField,
    normalStrength,
    maxAnisotropy,
    repeatX,
    repeatY,
  );

  return { map, bumpMap, normalMap, roughnessMap };
}

/**
 * Generates all 512x512 Procedural PBR Texture Sets + Diegetic Evidence Canvas Textures
 */
export function createRoomTextureLibrary(maxAnisotropy: number): RoomTextureLibrary {
  const SIZE = 512;
  const noiseFloor = new PerlinNoise2D(4041);
  const noiseWall = new PerlinNoise2D(4042);
  const noiseBrass = new PerlinNoise2D(4043);
  const noisePaper = new PerlinNoise2D(4044);
  const noiseGlass = new PerlinNoise2D(4045);
  const noiseDarkWood = new PerlinNoise2D(4046);
  const noiseSteel = new PerlinNoise2D(4047);

  const smoothstep = (edge0: number, edge1: number, x: number): number => {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
  };

  // 1. Aged Wooden Floorboards with crisp plank seams, nails, realistic elongated wood grain & wear
  const woodFloor = createPBRFromGenerator(SIZE, maxAnisotropy, 3, 3, 1.35, (_x, _y, u, v, out) => {
    const plankCount = 6;
    const plankIndex = Math.floor(u * plankCount);
    const plankU = (u * plankCount) % 1;
    const rowOffset = (plankIndex * 0.37) % 1;
    const plankV = (v * 2 + rowOffset) % 1;

    const seamEdge = Math.min(plankU, 1 - plankU);
    const endSeam = Math.min(plankV, 1 - plankV);
    const seamMask = smoothstep(0.008, 0.024, seamEdge) * smoothstep(0.004, 0.012, endSeam);

    // Recessed iron floor nails near plank ends
    const nailDist1 = Math.hypot((plankU - 0.16) * 0.85, (plankV - 0.045) * 2.4);
    const nailDist2 = Math.hypot((plankU - 0.84) * 0.85, (plankV - 0.045) * 2.4);
    const isNail = nailDist1 < 0.022 || nailDist2 < 0.022;

    // Subtle natural tonal variation per plank
    const plankTone = (((plankIndex * 53 + Math.floor(v * 2 + rowOffset) * 19) % 13) / 13 - 0.5) * 22;

    // Authentic elongated straight wood grain fibers (subtle warp, no swirly zebra lines)
    const warp = noiseFloor.fbm(u * 2.5 + plankIndex * 1.9, v * 1.2, 3, 6);
    const grainRing = Math.sin((plankU * 10 + warp * 1.35) * Math.PI) * 0.5 + 0.5;
    const streak = noiseFloor.fbm(u * 28 + plankIndex * 3.1, v * 3.5, 4, 16);
    const grime = noiseFloor.fbm(u * 4, v * 4, 4, 4);

    let r = 80 + grainRing * 18 + streak * 20 + plankTone - grime * 22;
    let g = 55 + grainRing * 12 + streak * 14 + plankTone * 0.72 - grime * 16;
    let b = 36 + grainRing * 7 + streak * 9 + plankTone * 0.5 - grime * 11;

    let height = 0.52 + grainRing * 0.14 + streak * 0.16;
    let roughness = 0.58 + (1 - grainRing) * 0.14 + grime * 0.22;

    // Smooth dark bevel at plank grooves
    r *= 0.22 + 0.78 * seamMask;
    g *= 0.22 + 0.78 * seamMask;
    b *= 0.22 + 0.78 * seamMask;
    height = 0.08 + (height - 0.08) * seamMask;
    roughness = roughness * seamMask + 0.96 * (1 - seamMask);

    if (isNail) {
      r = 34;
      g = 32;
      b = 30;
      height = 0.26;
      roughness = 0.5;
    }

    out[0] = r;
    out[1] = g;
    out[2] = b;
    out[3] = 255;
    return { height, roughness: Math.min(1, roughness) };
  });

  // 2. Weathered Peeling Plaster & Damp Aged Stone Walls (organic smooth layering, zero harsh cartoon outlines)
  const stoneWall = createPBRFromGenerator(SIZE, maxAnisotropy, 2, 1, 1.45, (_x, _y, u, v, out) => {
    const macroPlaster = noiseWall.fbm(u * 3, v * 3, 4, 3);
    const peelField = noiseWall.fbm(u * 5 + 1.7, v * 5 + 0.9, 4, 5);
    const stoneGrain = noiseWall.fbm(u * 14, v * 14, 4, 14);
    const fineStucco = noiseWall.noise(u * 40, v * 40, 40);

    // Subtle weathered brick/masonry undertone where plaster has flaked off
    const brickRow = Math.floor(v * 14);
    const brickU = (u * 7 + (brickRow % 2) * 0.5) % 1;
    const brickV = (v * 14) % 1;
    const mortar =
      smoothstep(0.02, 0.07, Math.min(brickU, 1 - brickU)) *
      smoothstep(0.04, 0.11, Math.min(brickV, 1 - brickV));

    // Vertical damp moisture seepage stains strongest near floor & ceiling
    const drip = noiseWall.fbm(u * 10, v * 2.2, 4, 10);
    const edgeDamp = Math.pow(v, 1.7) * 0.8 + Math.pow(1 - v, 2.6) * 0.45;
    const dampness = smoothstep(0.24, 0.72, edgeDamp * (0.65 + drip * 0.85));

    // Smooth blend between plaster (1) and exposed damp masonry (0)
    const plasterKeep = smoothstep(0.34, 0.44, peelField);

    // Exposed weathered stone/brick underneath
    const stoneR = (68 + stoneGrain * 24 + fineStucco * 8) * (0.72 + 0.28 * mortar);
    const stoneG = (64 + stoneGrain * 22 + fineStucco * 7) * (0.72 + 0.28 * mortar);
    const stoneB = (58 + stoneGrain * 18 + fineStucco * 6) * (0.72 + 0.28 * mortar);
    const stoneH = 0.24 + stoneGrain * 0.22 * mortar + fineStucco * 0.06;

    // Aged institutional faded plaster
    const plasR = 114 + macroPlaster * 28 + fineStucco * 9 - (1 - stoneGrain) * 10;
    const plasG = 110 + macroPlaster * 25 + fineStucco * 8 - (1 - stoneGrain) * 9;
    const plasB = 98 + macroPlaster * 20 + fineStucco * 7 - (1 - stoneGrain) * 8;
    const plasH = 0.62 + macroPlaster * 0.14 + fineStucco * 0.07;

    let r = stoneR * (1 - plasterKeep) + plasR * plasterKeep;
    let g = stoneG * (1 - plasterKeep) + plasG * plasterKeep;
    let b = stoneB * (1 - plasterKeep) + plasB * plasterKeep;
    let height = stoneH * (1 - plasterKeep) + plasH * plasterKeep;
    let roughness = 0.94 * (1 - plasterKeep) + (0.82 + macroPlaster * 0.12) * plasterKeep;

    // Subtle raised flaking plaster rim along transition
    const flakeRim = plasterKeep * (1 - plasterKeep) * 4;
    height += flakeRim * 0.08;

    // Damp staining darkens plaster and subtly lowers roughness
    if (dampness > 0) {
      r *= 1 - dampness * 0.44;
      g *= 1 - dampness * 0.39;
      b *= 1 - dampness * 0.42;
      roughness = roughness * (1 - dampness * 0.36);
    }

    out[0] = r;
    out[1] = g;
    out[2] = b;
    out[3] = 255;
    return {
      height: Math.max(0, Math.min(1, height)),
      roughness: Math.max(0.38, Math.min(1, roughness)),
    };
  });

  // 3. Oxidized Antique Brass with brushed grain & teal verdigris patina
  const oxidizedBrass = createPBRFromGenerator(SIZE, maxAnisotropy, 1, 1, 1.3, (_x, _y, u, v, out) => {
    const brush = noiseBrass.fbm(u * 4, v * 44, 3, 4);
    const patinaNoise = noiseBrass.fbm(u * 7, v * 7, 4, 7);
    const tarnish = noiseBrass.fbm(u * 14 + 3.1, v * 14, 3, 14);
    const verdigris = smoothstep(0.58, 0.82, patinaNoise);

    let r = 178 + brush * 30 - tarnish * 42;
    let g = 138 + brush * 24 - tarnish * 36;
    let b = 64 + brush * 14 - tarnish * 20;

    let height = 0.56 + brush * 0.14 - tarnish * 0.1;
    let roughness = 0.28 + tarnish * 0.28;

    if (verdigris > 0) {
      const k = verdigris * 0.88;
      r = r * (1 - k) + 64 * k;
      g = g * (1 - k) + 114 * k;
      b = b * (1 - k) + 96 * k;
      height += k * 0.12;
      roughness = roughness * (1 - k) + 0.86 * k;
    }

    out[0] = r;
    out[1] = g;
    out[2] = b;
    out[3] = 255;
    return { height: Math.min(1, height), roughness: Math.min(1, roughness) };
  });

  // 4. Aged Yellowed Letter Paper with fibers, foxing spots & fold crease
  const agedPaper = createPBRFromGenerator(SIZE, maxAnisotropy, 1, 1, 1.1, (_x, _y, u, v, out) => {
    const pulp = noisePaper.fbm(u * 12, v * 12, 4, 12);
    const foxing = noisePaper.fbm(u * 6 + 4.2, v * 6 + 1.5, 4, 6);
    const fineFiber = noisePaper.noise(u * 48, v * 48, 48);

    const edgeDist = Math.min(u, 1 - u, v, 1 - v);
    const edgeBurn = Math.max(0, 1 - edgeDist / 0.16);
    const foldCrease = Math.exp(-Math.pow((v - 0.5) * 42, 2)) * 0.65;

    let r = 216 - (1 - pulp) * 24 - edgeBurn * 48 - foldCrease * 28 + fineFiber * 8;
    let g = 196 - (1 - pulp) * 28 - edgeBurn * 58 - foldCrease * 30 + fineFiber * 6;
    let b = 152 - (1 - pulp) * 32 - edgeBurn * 68 - foldCrease * 28 + fineFiber * 4;

    const foxSpot = smoothstep(0.65, 0.88, foxing);
    if (foxSpot > 0) {
      r -= foxSpot * 38;
      g -= foxSpot * 50;
      b -= foxSpot * 58;
    }

    const height = 0.54 + pulp * 0.16 + fineFiber * 0.08 - foldCrease * 0.28;
    const roughness = 0.86 + pulp * 0.1;

    out[0] = r;
    out[1] = g;
    out[2] = b;
    out[3] = 255;
    return { height: Math.max(0, height), roughness: Math.min(1, roughness) };
  });

  // 5. Dusty Smudged Glass with micro-scratches & grime accumulation
  const dustyGlass = createPBRFromGenerator(SIZE, maxAnisotropy, 1, 1, 1.0, (_x, _y, u, v, out) => {
    const dust = noiseGlass.fbm(u * 5, v * 5, 4, 5);
    const smudge = noiseGlass.fbm(u * 10 + 1.3, v * 10 + 2.7, 3, 10);
    const scratch1 = Math.abs(noiseGlass.noise(u * 24, v * 3, 24) - 0.5) < 0.008 ? 1 : 0;
    const edgeGrime = Math.max(0, 1 - Math.min(u, 1 - u, v, 1 - v) / 0.18);

    const haze = Math.min(1, dust * 0.55 + smudge * 0.25 + edgeGrime * 0.55);

    out[0] = 160 + haze * 45;
    out[1] = 175 + haze * 42;
    out[2] = 186 + haze * 34;
    out[3] = clampByte(75 + haze * 115);

    const height = 0.5 + dust * 0.15 - scratch1 * 0.28;
    const roughness = Math.min(0.95, 0.1 + haze * 0.65 + scratch1 * 0.18);
    return { height: Math.max(0, height), roughness };
  });

  // 6. Dark Carved Antique Walnut/Mahogany Wood (smooth satin finish, authentic fine grain)
  const darkWood = createPBRFromGenerator(SIZE, maxAnisotropy, 2, 2, 0.95, (_x, _y, u, v, out) => {
    const warp = noiseDarkWood.fbm(u * 3, v * 2, 3, 4);
    const rings = Math.sin((u * 9 + warp * 1.4) * Math.PI) * 0.5 + 0.5;
    const pores = noiseDarkWood.fbm(u * 28, v * 5, 3, 16);
    const wear = noiseDarkWood.fbm(u * 4, v * 4, 3, 4);

    out[0] = 74 + rings * 24 + pores * 12 - wear * 14;
    out[1] = 46 + rings * 15 + pores * 8 - wear * 9;
    out[2] = 28 + rings * 9 + pores * 5 - wear * 6;
    out[3] = 255;

    const height = 0.52 + rings * 0.16 + pores * 0.12;
    const roughness = 0.54 + (1 - rings) * 0.16 + wear * 0.2;
    return { height, roughness: Math.min(0.92, roughness) };
  });

  // 7. Weathered Rusted Steel (Filing Cabinet, Lamp Shade, Iron Bars)
  const weatheredSteel = createPBRFromGenerator(SIZE, maxAnisotropy, 1, 1, 2.4, (_x, _y, u, v, out) => {
    const paint = noiseSteel.fbm(u * 8, v * 8, 4, 8);
    const rustMask = noiseSteel.fbm(u * 6 + 5.1, v * 6 + 2.3, 4, 6);
    const scratches = noiseSteel.fbm(u * 26, v * 6, 3, 12);
    const rust = Math.max(0, (rustMask - 0.54) / 0.46);

    // Industrial dark slate-green enamel base
    let r = 46 + paint * 20 + scratches * 10;
    let g = 54 + paint * 22 + scratches * 10;
    let b = 52 + paint * 18 + scratches * 8;

    let height = 0.55 + paint * 0.12;
    let roughness = 0.46 + paint * 0.22;

    if (rust > 0) {
      const k = Math.min(1, rust * 1.5);
      r = r * (1 - k) + 112 * k;
      g = g * (1 - k) + 52 * k;
      b = b * (1 - k) + 28 * k;
      height -= k * 0.18;
      roughness = roughness * (1 - k) + 0.92 * k;
    }

    out[0] = r;
    out[1] = g;
    out[2] = b;
    out[3] = 255;
    return { height: Math.max(0, height), roughness: Math.min(1, roughness) };
  });

  // 8. Antique Grained Leather (Desk Blotter & Book Spines)
  const leather = createPBRFromGenerator(SIZE, maxAnisotropy, 2, 2, 1.8, (_x, _y, u, v, out) => {
    const pebble = noisePaper.fbm(u * 24, v * 24, 3, 24);
    const crease = noiseFloor.fbm(u * 5, v * 5, 3, 5);
    out[0] = 68 + pebble * 20 - crease * 14;
    out[1] = 44 + pebble * 14 - crease * 10;
    out[2] = 34 + pebble * 10 - crease * 8;
    out[3] = 255;
    return {
      height: 0.45 + pebble * 0.35,
      roughness: 0.52 + (1 - pebble) * 0.26,
    };
  });

  // --- High-Resolution Diegetic Forensic Evidence Textures (512x512) ---

  const makeEvidenceCanvas = (
    draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
    w = 512,
    h = 512,
  ): THREE.CanvasTexture => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d')!;
    draw(ctx, w, h);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = maxAnisotropy;
    tex.needsUpdate = true;
    return tex;
  };

  // Helper to paint aged paper base onto any evidence canvas
  const paintPaperBase = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.drawImage(agedPaper.map.image as HTMLCanvasElement, 0, 0, w, h);
    // Subtle dark vignette around sheet border
    const grad = ctx.createRadialGradient(w / 2, h / 2, w * 0.22, w / 2, h / 2, w * 0.72);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(38,24,10,0.42)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  };

  // Evidence 1A: Torn Note Front (Cipher Order)
  const noteFront = makeEvidenceCanvas((ctx, w, h) => {
    paintPaperBase(ctx, w, h);
    // Faint notebook horizontal lines
    ctx.strokeStyle = 'rgba(92, 74, 52, 0.25)';
    ctx.lineWidth = 1.5;
    for (let y = 96; y < h - 40; y += 44) {
      ctx.beginPath();
      ctx.moveTo(36, y);
      ctx.lineTo(w - 36, y);
      ctx.stroke();
    }
    // Red vertical margin line
    ctx.strokeStyle = 'rgba(148, 42, 34, 0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(w - 64, 24);
    ctx.lineTo(w - 64, h - 24);
    ctx.stroke();

    // Dried ink blot
    ctx.fillStyle = 'rgba(26, 20, 18, 0.65)';
    ctx.beginPath();
    ctx.arc(82, 426, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(108, 444, 9, 0, Math.PI * 2);
    ctx.fill();

    // Crisp Arabic forensic text centered safely within paper margins
    ctx.direction = 'rtl';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#5c1814';
    ctx.font = 'bold 24px Cairo, Georgia, serif';
    ctx.fillText('ملف القضية 404 — ترتيب رمز الباب', w / 2, 74);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#1f1914';
    ctx.font = 'bold 22px Cairo, sans-serif';
    ctx.fillText('١- عقرب الساعات في ساعة التوقف', w - 76, 146);
    ctx.fillText('٢- عدد الأقراص في زجاجة الدواء', w - 76, 214);
    ctx.fillText('٣- الرقم المحفور على المفتاح النحاسي', w - 76, 282);
    ctx.fillText('٤- آخر رقم في سنة الصورة المحروقة', w - 76, 350);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#6c1b16';
    ctx.font = 'bold 20px Cairo, sans-serif';
    ctx.fillText('اقلب الورقة ١٨٠° لقراءة التحذير...', w / 2, 430);
  });

  // Evidence 1B: Torn Note Back (Psychological Twist)
  const noteBack = makeEvidenceCanvas((ctx, w, h) => {
    paintPaperBase(ctx, w, h);
    ctx.direction = 'rtl';
    ctx.textAlign = 'center';
    ctx.strokeStyle = 'rgba(128, 22, 18, 0.55)';
    ctx.lineWidth = 4;
    ctx.strokeRect(52, 92, w - 104, 310);

    ctx.fillStyle = '#751512';
    ctx.font = 'bold 34px Amiri, Cairo, serif';
    ctx.fillText('تحذير سري', w / 2, 165);

    ctx.fillStyle = '#241714';
    ctx.font = 'bold 28px Cairo, sans-serif';
    ctx.fillText('لا تثق بذاكرتك يا طارق...', w / 2, 240);
    ctx.fillText('أنت لم تدخل الغرفة للتحقيق', w / 2, 298);
    ctx.fillStyle = '#7a1414';
    ctx.fillText('أنت المشتبه به في ملف 404', w / 2, 358);
  });

  // Evidence 2A: Pocket Watch Dial (Stopped sharply at 07:15 -> Hour = 7)
  const watchDial = makeEvidenceCanvas((ctx, w, h) => {
    const cx = w / 2;
    const cy = h / 2;
    const r = w * 0.46;

    // Aged ivory enamel face
    const grad = ctx.createRadialGradient(cx, cy, r * 0.1, cx, cy, r);
    grad.addColorStop(0, '#efe6cf');
    grad.addColorStop(0.78, '#d8c8a2');
    grad.addColorStop(1, '#9d885e');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    // Outer brass chapter ring
    ctx.strokeStyle = '#382a18';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.92, 0, Math.PI * 2);
    ctx.stroke();

    // 60 minute ticks
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2 - Math.PI / 2;
      const isHour = i % 5 === 0;
      const r0 = r * (isHour ? 0.81 : 0.86);
      const r1 = r * 0.91;
      ctx.strokeStyle = isHour ? '#1f160c' : '#52402b';
      ctx.lineWidth = isHour ? 4 : 1.8;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
      ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      ctx.stroke();
    }

    // Crisp Hour Numerals (highlight 7 subtly with crack & red smudge)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let num = 1; num <= 12; num++) {
      const a = (num / 12) * Math.PI * 2 - Math.PI / 2;
      const nr = r * 0.68;
      const nx = cx + Math.cos(a) * nr;
      const ny = cy + Math.sin(a) * nr;

      if (num === 7) {
        ctx.strokeStyle = 'rgba(155, 28, 22, 0.85)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(nx, ny, 27, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.fillStyle = num === 7 ? '#7d1410' : '#1b140c';
      ctx.font = num === 7 ? 'bold 38px Georgia, serif' : 'bold 30px Georgia, serif';
      ctx.fillText(String(num), nx, ny);
    }

    // Brand inscription
    ctx.fillStyle = '#4a3822';
    ctx.font = 'bold 17px Georgia, serif';
    ctx.fillText('CHRONO · 404', cx, cy - 58);
    ctx.font = '16px Cairo, sans-serif';
    ctx.fillText('متوقفة', cx, cy + 72);

    // Subtle hairline crack across glass dial
    ctx.strokeStyle = 'rgba(40, 32, 24, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - 110, cy - 90);
    ctx.lineTo(cx - 24, cy + 12);
    ctx.lineTo(cx - 72, cy + 130);
    ctx.stroke();

    // Hour Hand frozen at 7 (angle for 7:00)
    const hourAngle = (7 / 12) * Math.PI * 2 - Math.PI / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(hourAngle);
    ctx.fillStyle = '#181410';
    ctx.beginPath();
    ctx.moveTo(-14, -7);
    ctx.lineTo(r * 0.48, -3);
    ctx.lineTo(r * 0.56, 0);
    ctx.lineTo(r * 0.48, 3);
    ctx.lineTo(-14, 7);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Minute Hand frozen at 15 (3 o'clock)
    const minAngle = (3 / 12) * Math.PI * 2 - Math.PI / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(minAngle);
    ctx.fillStyle = '#251e16';
    ctx.beginPath();
    ctx.moveTo(-16, -4);
    ctx.lineTo(r * 0.72, -2);
    ctx.lineTo(r * 0.79, 0);
    ctx.lineTo(r * 0.72, 2);
    ctx.lineTo(-16, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Center brass pin
    ctx.fillStyle = '#b48a42';
    ctx.beginPath();
    ctx.arc(cx, cy, 11, 0, Math.PI * 2);
    ctx.fill();
  });

  // Evidence 2B: Watch Inner Lid Engraving
  const watchLidInner = makeEvidenceCanvas((ctx, w, h) => {
    ctx.drawImage(oxidizedBrass.map.image as HTMLCanvasElement, 0, 0, w, h);
    ctx.strokeStyle = 'rgba(42, 28, 12, 0.75)';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w * 0.42, 0, Math.PI * 2);
    ctx.stroke();

    ctx.direction = 'rtl';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#2b1c0c';
    ctx.font = 'bold 30px Amiri, Cairo, serif';
    ctx.fillText('لحظة انقطاع التيار', w / 2, 195);
    ctx.font = 'bold 64px Georgia, serif';
    ctx.fillText('07:15', w / 2, 280);
    ctx.font = 'bold 28px Cairo, sans-serif';
    ctx.fillText('الساعة السابعة (7)', w / 2, 345);
  });

  // Evidence 3: Amber Medicine Bottle Prescription Label (Digit = 4)
  const bottleLabel = makeEvidenceCanvas((ctx, w, h) => {
    paintPaperBase(ctx, w, h);
    // Top & bottom vintage pharmacy border bands
    ctx.fillStyle = '#6c1f1a';
    ctx.fillRect(0, 18, w, 26);
    ctx.fillRect(0, h - 44, w, 26);

    // Front half (left half of cylinder wrap)
    ctx.direction = 'rtl';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#1b1612';
    ctx.font = 'bold 26px Cairo, sans-serif';
    ctx.fillText('مصحة الأمل للأمراض النفسية', w * 0.27, 88);

    ctx.fillStyle = '#5e1712';
    ctx.font = 'bold 30px Cairo, sans-serif';
    ctx.fillText('هالوبيريدول 50mg', w * 0.27, 138);

    ctx.fillStyle = '#241d17';
    ctx.font = 'bold 22px Cairo, sans-serif';
    ctx.fillText('المريض: المحقق طارق', w * 0.27, 190);
    ctx.fillText('الأقراص المتبقية بالجرعة:', w * 0.27, 236);

    // Big red circled "4"
    ctx.strokeStyle = '#991b1b';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(w * 0.27, 326, 54, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#8b1414';
    ctx.font = 'bold 76px Georgia, serif';
    ctx.fillText('4', w * 0.27, 352);

    ctx.fillStyle = '#33281f';
    ctx.font = 'bold 20px Cairo, sans-serif';
    ctx.fillText('أربعة أقراص ليلاً', w * 0.27, 424);

    // Divider line
    ctx.strokeStyle = 'rgba(72, 52, 34, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(w * 0.54, 52);
    ctx.lineTo(w * 0.54, h - 52);
    ctx.stroke();

    // Back half of bottle label (Warning)
    ctx.fillStyle = '#751814';
    ctx.font = 'bold 28px Cairo, sans-serif';
    ctx.fillText('تحذير طبي هام', w * 0.77, 130);

    ctx.fillStyle = '#261e18';
    ctx.font = 'bold 21px Cairo, sans-serif';
    ctx.fillText('الجرعة الزائدة تسبب:', w * 0.77, 198);
    ctx.fillText('• فقدان ذاكرة مؤقت', w * 0.77, 248);
    ctx.fillText('• تشوش الهوية والوقت', w * 0.77, 296);
    ctx.fillText('• رقم الجناح: 404', w * 0.77, 348);
  }, 768, 512);

  // Evidence 4A & 4B: Oxidized Brass Key Medallion Engraving (Digit = 1)
  const keyFront = makeEvidenceCanvas((ctx, w, h) => {
    ctx.drawImage(oxidizedBrass.map.image as HTMLCanvasElement, 0, 0, w, h);
    ctx.strokeStyle = '#261b0c';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w * 0.42, 0, Math.PI * 2);
    ctx.stroke();

    ctx.direction = 'rtl';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#1d1409';
    ctx.font = 'bold 42px Cairo, sans-serif';
    ctx.fillText('خزانة رقم', w / 2, 200);
    ctx.font = 'bold 148px Georgia, serif';
    ctx.fillText('1', w / 2, 355);
  });

  const keyBack = makeEvidenceCanvas((ctx, w, h) => {
    ctx.drawImage(oxidizedBrass.map.image as HTMLCanvasElement, 0, 0, w, h);
    ctx.strokeStyle = '#261b0c';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w * 0.4, 0, Math.PI * 2);
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = '#24180a';
    ctx.font = 'bold 170px Georgia, serif';
    ctx.fillText('1', w / 2, 315);
    ctx.font = 'bold 30px Georgia, serif';
    ctx.fillText('ROOM 404', w / 2, 395);
  });

  // Evidence 5A: Burned-Edge Crime Scene Photograph (Front)
  const photoFront = makeEvidenceCanvas((ctx, w, h) => {
    // Sepia darkroom gradient
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#14110d');
    bg.addColorStop(0.55, '#3a3022');
    bg.addColorStop(1, '#1a1510');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Cream polaroid/photo border
    ctx.strokeStyle = '#d8cbb0';
    ctx.lineWidth = 28;
    ctx.strokeRect(14, 14, w - 28, h - 28);

    // Overhead interrogation spotlight cone inside photo
    const cone = ctx.createRadialGradient(w / 2, 95, 12, w / 2, 270, 220);
    cone.addColorStop(0, 'rgba(240, 222, 180, 0.85)');
    cone.addColorStop(0.45, 'rgba(182, 152, 108, 0.35)');
    cone.addColorStop(1, 'rgba(16, 12, 8, 0)');
    ctx.fillStyle = cone;
    ctx.beginPath();
    ctx.moveTo(w / 2 - 22, 90);
    ctx.lineTo(w / 2 + 22, 90);
    ctx.lineTo(w - 50, h - 50);
    ctx.lineTo(50, h - 50);
    ctx.closePath();
    ctx.fill();

    // Hanging lamp silhouette
    ctx.strokeStyle = '#0e0b08';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(w / 2, 28);
    ctx.lineTo(w / 2, 86);
    ctx.stroke();
    ctx.fillStyle = '#181410';
    ctx.beginPath();
    ctx.arc(w / 2, 92, 22, Math.PI, 0);
    ctx.fill();

    // Empty interrogation chair silhouette in photo
    ctx.fillStyle = '#17120d';
    ctx.fillRect(w / 2 - 54, 240, 108, 18); // seat
    ctx.fillRect(w / 2 - 48, 150, 12, 95); // back left
    ctx.fillRect(w / 2 + 36, 150, 12, 95); // back right
    ctx.fillRect(w / 2 - 48, 156, 96, 14); // top rail
    ctx.fillRect(w / 2 - 48, 192, 96, 10); // mid rail
    ctx.fillRect(w / 2 - 48, 258, 12, 125); // leg
    ctx.fillRect(w / 2 + 36, 258, 12, 125); // leg

    // Eerie shadowy figure silhouette standing near barred window in background
    ctx.fillStyle = 'rgba(10, 8, 6, 0.72)';
    ctx.beginPath();
    ctx.arc(138, 192, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(100, 355);
    ctx.quadraticCurveTo(106, 220, 138, 218);
    ctx.quadraticCurveTo(170, 220, 176, 355);
    ctx.closePath();
    ctx.fill();

    // Film grain noise speckles
    for (let i = 0; i < 2400; i++) {
      const gx = (Math.sin(i * 12.9898) * 43758.5453) % 1;
      const gy = (Math.sin(i * 78.233) * 24634.6345) % 1;
      const px = Math.abs(gx) * w;
      const py = Math.abs(gy) * h;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255,244,216,0.08)' : 'rgba(10,8,6,0.14)';
      ctx.fillRect(px, py, 2, 2);
    }

    // Charred burned corners & edges
    const burnCorners: Array<[number, number, number]> = [
      [0, 0, 118],
      [w, 0, 92],
      [w, h, 142],
      [0, h, 104],
    ];
    for (const [bx, by, br] of burnCorners) {
      const g = ctx.createRadialGradient(bx, by, br * 0.25, bx, by, br);
      g.addColorStop(0, 'rgba(8, 5, 3, 0.98)');
      g.addColorStop(0.55, 'rgba(58, 26, 8, 0.85)');
      g.addColorStop(0.82, 'rgba(148, 86, 26, 0.35)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }

    ctx.fillStyle = '#d4c4a2';
    ctx.font = 'bold 20px Cairo, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('غرفة 404 — اقلب الصورة لرؤية التاريخ', w / 2, h - 34);
  });

  // Evidence 5B: Burned Photo Back (Red-ink date 14/10/2019 -> Digit 9)
  const photoBack = makeEvidenceCanvas((ctx, w, h) => {
    paintPaperBase(ctx, w, h);

    // Subtle vintage photo paper stamp
    ctx.fillStyle = 'rgba(88, 72, 54, 0.28)';
    ctx.font = 'bold 20px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('KODAK FORENSIC ARCHIVE PAPER', w / 2, 76);

    ctx.direction = 'rtl';
    ctx.fillStyle = '#261814';
    ctx.font = 'bold 34px Cairo, sans-serif';
    ctx.fillText('دليل جنائي — قضية 404', w / 2, 165);

    ctx.fillStyle = '#471512';
    ctx.font = 'bold 28px Cairo, sans-serif';
    ctx.fillText('تاريخ الحادثة:', w / 2, 228);

    // Large date with last digit "9" circled in red
    ctx.direction = 'ltr';
    ctx.fillStyle = '#231612';
    ctx.font = 'bold 54px JetBrains Mono, monospace';
    ctx.fillText('14 / 10 / 2019', w / 2, 305);

    // Red circle tightly around the trailing "9"
    ctx.strokeStyle = '#a31616';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(w / 2 + 196, 289, 34, 0, Math.PI * 2);
    ctx.stroke();

    ctx.direction = 'rtl';
    ctx.fillStyle = '#7c1814';
    ctx.font = 'bold 24px Cairo, sans-serif';
    ctx.fillText('«آخر رقم في السنة هو مفتاحك الأخير»', w / 2, 396);

    // Burned corner soot on back too
    const g = ctx.createRadialGradient(0, h, 20, 0, h, 145);
    g.addColorStop(0, 'rgba(10, 6, 4, 0.96)');
    g.addColorStop(0.58, 'rgba(62, 28, 10, 0.78)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });

  // Room 404 Brass Door Plaque
  const doorPlaque = makeEvidenceCanvas((ctx, w, h) => {
    ctx.drawImage(oxidizedBrass.map.image as HTMLCanvasElement, 0, 0, w, h);
    ctx.strokeStyle = '#2b1e0e';
    ctx.lineWidth = 14;
    ctx.strokeRect(18, 18, w - 36, h - 36);

    // Corner rivets
    for (const [rx, ry] of [
      [44, 44],
      [w - 44, 44],
      [44, h - 44],
      [w - 44, h - 44],
    ]) {
      ctx.fillStyle = '#332411';
      ctx.beginPath();
      ctx.arc(rx, ry, 10, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = '#1b1208';
    ctx.textAlign = 'center';
    ctx.font = 'bold 118px Georgia, serif';
    ctx.fillText('404', w / 2, h / 2 + 34);
    ctx.font = 'bold 28px Cairo, sans-serif';
    ctx.fillText('غرفة التحقيق', w / 2, 86);
  }, 512, 256);

  // Digital Keypad Faceplate
  const keypadFace = makeEvidenceCanvas((ctx, w, h) => {
    ctx.drawImage(weatheredSteel.map.image as HTMLCanvasElement, 0, 0, w, h);
    // Dark recessed LED screen
    ctx.fillStyle = '#07120c';
    ctx.fillRect(36, 32, w - 72, 74);
    ctx.strokeStyle = '#3c4640';
    ctx.lineWidth = 4;
    ctx.strokeRect(36, 32, w - 72, 74);

    ctx.fillStyle = '#c83e32';
    ctx.font = 'bold 34px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('LOCKED', w / 2, 81);

    // Key grid graphic
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];
    const startX = 48;
    const startY = 136;
    const cellW = 72;
    const cellH = 74;
    for (let i = 0; i < 12; i++) {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const kx = startX + col * (cellW + 14);
      const ky = startY + row * (cellH + 12);
      ctx.fillStyle = '#1c2024';
      ctx.fillRect(kx, ky, cellW, cellH);
      ctx.strokeStyle = '#626b6e';
      ctx.lineWidth = 2;
      ctx.strokeRect(kx, ky, cellW, cellH);
      ctx.fillStyle = '#dcd4c4';
      ctx.font = 'bold 32px JetBrains Mono, monospace';
      ctx.fillText(keys[i], kx + cellW / 2, ky + 48);
    }
  }, 340, 512);

  // Cork Evidence Board
  const corkBoard = makeEvidenceCanvas((ctx, w, h) => {
    // Warm noisy cork surface
    ctx.drawImage(woodFloor.map.image as HTMLCanvasElement, 0, 0, w, h);
    ctx.fillStyle = 'rgba(128, 86, 46, 0.55)';
    ctx.fillRect(0, 0, w, h);

    // Pinned forensic papers & redacted reports
    const cards: Array<[number, number, number, number, number]> = [
      [48, 52, 150, 185, -0.05],
      [226, 44, 165, 165, 0.04],
      [390, 90, 96, 130, -0.08],
      [110, 268, 175, 170, 0.03],
      [310, 260, 150, 175, -0.04],
    ];
    for (const [cx, cy, cw, ch, rot] of cards) {
      ctx.save();
      ctx.translate(cx + cw / 2, cy + ch / 2);
      ctx.rotate(rot);
      ctx.fillStyle = '#d8caa9';
      ctx.fillRect(-cw / 2, -ch / 2, cw, ch);
      ctx.fillStyle = '#2c251e';
      for (let ly = -ch / 2 + 28; ly < ch / 2 - 20; ly += 18) {
        ctx.fillRect(-cw / 2 + 16, ly, cw - 36, 5);
      }
      // Redacted black bar
      ctx.fillStyle = '#12100e';
      ctx.fillRect(-cw / 2 + 16, -8, cw * 0.65, 16);
      // Red pushpin
      ctx.fillStyle = '#a31c18';
      ctx.beginPath();
      ctx.arc(0, -ch / 2 + 12, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Red investigative string connecting pins
    ctx.strokeStyle = '#991b1b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(123, 64);
    ctx.lineTo(308, 56);
    ctx.lineTo(385, 272);
    ctx.lineTo(197, 280);
    ctx.closePath();
    ctx.stroke();
  });

  // Soft Radial Contact Shadow Disc
  const contactShadow = makeEvidenceCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const g = ctx.createRadialGradient(w / 2, h / 2, w * 0.05, w / 2, h / 2, w * 0.48);
    g.addColorStop(0, 'rgba(0, 0, 0, 0.72)');
    g.addColorStop(0.55, 'rgba(0, 0, 0, 0.34)');
    g.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }, 256, 256);

  const allPBR = [
    woodFloor,
    stoneWall,
    oxidizedBrass,
    agedPaper,
    dustyGlass,
    darkWood,
    weatheredSteel,
    leather,
  ];
  const evidenceMaps = {
    noteFront,
    noteBack,
    watchDial,
    watchLidInner,
    bottleLabel,
    keyFront,
    keyBack,
    photoFront,
    photoBack,
    doorPlaque,
    keypadFace,
    corkBoard,
    contactShadow,
  };

  return {
    woodFloor,
    stoneWall,
    oxidizedBrass,
    agedPaper,
    dustyGlass,
    darkWood,
    weatheredSteel,
    leather,
    evidenceMaps,
    dispose: () => {
      for (const set of allPBR) {
        set.map.dispose();
        set.bumpMap.dispose();
        set.normalMap.dispose();
        set.roughnessMap.dispose();
      }
      for (const tex of Object.values(evidenceMaps)) {
        tex.dispose();
      }
    },
  };
}
