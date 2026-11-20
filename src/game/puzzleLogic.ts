import type { ColliderAABB, EvidenceDefinition, EvidenceId, RoomBounds } from './types';

export const EXIT_CODE = '7419';

export const EVIDENCE_LIST: EvidenceDefinition[] = [
  {
    id: 'torn_note',
    title: 'مذكرة ورقية ممزقة',
    subtitle: 'مفتاح ترتيب الرمز — على سطح المكتب',
    locationHint: 'فوق المكتب الخشبي في منتصف الغرفة',
    materialSound: 'paper',
    digitIndex: null,
    digitValue: null,
    inspectHint: 'اسحب بالماوس لتدوير الورقة ٣٦٠ درجة وقراءة الوجه الخلفي',
    frontSummary:
      '«ترتيب رمز الخروج (٤ أرقام): ١- ساعة التوقف · ٢- عدد الأقراص في الزجاجة · ٣- رقم المفتاح النحاسي · ٤- آخر رقم في سنة الصورة المحروقة»',
    backSecret: 'مكتوب بقلم أحمر على الظهر: «لا تثق بذاكرتك... الملف ٤٠٤ يخصك أنت.»',
    logEntry: 'الترتيب: [ساعة التوقف] ← [الأقراص] ← [رقم المفتاح] ← [آخر رقم بالسنة]',
  },
  {
    id: 'pocket_watch',
    title: 'ساعة جيب متوقفة',
    subtitle: 'نحاس مؤكسد — داخل درج المكتب الأيمن',
    locationHint: 'داخل الدرج الأيمن للمكتب الخشبي',
    materialSound: 'metal',
    digitIndex: 0,
    digitValue: '7',
    inspectHint: 'أدر الساعة لتفحص العقارب المتجمدة والنقش داخل الغطاء',
    frontSummary: 'عقرب الساعات متجمد تماماً عند الرقم ٧ (الساعة 07:15) منذ لحظة انقطاع التيار.',
    backSecret: 'نقش داخلي على الغطاء النحاسي: «لحظة الاعتراف — السابعة مساءً (7)»',
    logEntry: 'الرقم الأول (١): 7 — عقرب الساعات متوقف عند السابعة',
  },
  {
    id: 'medicine_bottle',
    title: 'زجاجة دواء زجاجية',
    subtitle: 'زجاج كهرماني مغبرّ — على رف المكتبة',
    locationHint: 'على الرف الأوسط في المكتبة الخشبية',
    materialSound: 'glass',
    digitIndex: 1,
    digitValue: '4',
    inspectHint: 'لف الزجاجة لقراءة الوصفة الطبية والتحذير الخلفي',
    frontSummary: 'ملصق طبي مصفرّ: «هالوبيريدول — الجرعة المتبقية: 4 أقراص ليلاً — المحقق طارق».',
    backSecret: 'ختم خلفي باهت: «تحذير: يُسبب فجوات في الذاكرة وهلاوس سمعية».',
    logEntry: 'الرقم الثاني (٢): 4 — أربعة أقراص متبقية بالوصفة',
  },
  {
    id: 'brass_key',
    title: 'مفتاح نحاسي قديم',
    subtitle: 'معدن مؤكسد — داخل درج خزانة الملفات',
    locationHint: 'داخل الدرج العلوي لخزانة الملفات المعدنية',
    materialSound: 'metal',
    digitIndex: 2,
    digitValue: '1',
    inspectHint: 'افحص رأس المفتاح المنقوش من الجهتين',
    frontSummary: 'مفتاح خزانة قديم مطلي بالزنجار الأخضر، محفور على مقبضه «خزانة رقم 1».',
    backSecret: 'الرقم «1» مدموغ بعمق على الوجه الخلفي لمقبض النحاس.',
    logEntry: 'الرقم الثالث (٣): 1 — الرقم المحفور على المفتاح النحاسي',
  },
  {
    id: 'burned_photo',
    title: 'صورة فوتوغرافية محروقة',
    subtitle: 'حواف متفحمة — على عتبة النافذة المضاءة بالقمر',
    locationHint: 'على حافة النافذة الحديدية تحت ضوء القمر',
    materialSound: 'paper',
    digitIndex: 3,
    digitValue: '9',
    inspectHint: 'اقلب الصورة لرؤية التاريخ المكتوب بالحبر الأحمر على ظهرها',
    frontSummary: 'صورة قديمة لغرفة التحقيق 404: كرسي فارغ تحت مصباح متأرجح وظل يقف خلف الباب.',
    backSecret: 'على الظهر بالحبر الأحمر: «قضية 404 — التاريخ: 14 / 10 / 2019» ودائرة حول الرقم 9.',
    logEntry: 'الرقم الرابع (٤): 9 — آخر رقم في تاريخ الصورة (2019)',
  },
];

export const EVIDENCE_MAP: Record<EvidenceId, EvidenceDefinition> = EVIDENCE_LIST.reduce(
  (acc, item) => {
    acc[item.id] = item;
    return acc;
  },
  {} as Record<EvidenceId, EvidenceDefinition>,
);

/**
 * Validates the 4-digit keypad exit code.
 */
export function validateExitCode(input: string): boolean {
  return input.trim() === EXIT_CODE;
}

/**
 * Computes normalized psychological tension [0..1] based on logged evidence progress.
 */
export function computeTruthTension(loggedCount: number, totalCount = EVIDENCE_LIST.length): number {
  if (totalCount <= 0) return 0;
  const clamped = Math.max(0, Math.min(loggedCount, totalCount));
  // Smooth ease-out rise so even the first clue builds noticeable unease
  const t = clamped / totalCount;
  return Number((0.12 + 0.88 * Math.pow(t, 0.85)).toFixed(4));
}

/**
 * Adds an evidence ID to the logged list without duplicates.
 */
export function recordEvidenceId(existing: EvidenceId[], id: EvidenceId): EvidenceId[] {
  if (existing.includes(id)) return existing;
  return [...existing, id];
}

/**
 * Reconstructs the partially discovered 4-digit pattern for the Evidence Log UI.
 */
export function buildDiscoveredCodeSlots(logged: EvidenceId[]): Array<string | null> {
  const slots: Array<string | null> = [null, null, null, null];
  for (const id of logged) {
    const def = EVIDENCE_MAP[id];
    if (def && def.digitIndex !== null && def.digitValue !== null) {
      slots[def.digitIndex] = def.digitValue;
    }
  }
  return slots;
}

export interface SlidingCollisionResult {
  x: number;
  z: number;
  hitX: boolean;
  hitZ: boolean;
}

function overlapsCircleAABB(
  cx: number,
  cz: number,
  radius: number,
  box: ColliderAABB,
): boolean {
  const closestX = Math.max(box.minX, Math.min(cx, box.maxX));
  const closestZ = Math.max(box.minZ, Math.min(cz, box.maxZ));
  const dx = cx - closestX;
  const dz = cz - closestZ;
  return dx * dx + dz * dz < radius * radius;
}

function pushOutCircleAABB(
  cx: number,
  cz: number,
  radius: number,
  box: ColliderAABB,
): { x: number; z: number; pushed: boolean } {
  const closestX = Math.max(box.minX, Math.min(cx, box.maxX));
  const closestZ = Math.max(box.minZ, Math.min(cz, box.maxZ));
  const dx = cx - closestX;
  const dz = cz - closestZ;
  const distSq = dx * dx + dz * dz;
  if (distSq >= radius * radius) {
    return { x: cx, z: cz, pushed: false };
  }
  if (distSq > 1e-8) {
    const dist = Math.sqrt(distSq);
    const push = radius - dist + 0.0005;
    return {
      x: cx + (dx / dist) * push,
      z: cz + (dz / dist) * push,
      pushed: true,
    };
  }
  // Center is inside box: push out along shallowest penetration axis
  const penLeft = Math.abs(cx - box.minX);
  const penRight = Math.abs(box.maxX - cx);
  const penTop = Math.abs(cz - box.minZ);
  const penBottom = Math.abs(box.maxZ - cz);
  const minPen = Math.min(penLeft, penRight, penTop, penBottom);
  if (minPen === penLeft) return { x: box.minX - radius, z: cz, pushed: true };
  if (minPen === penRight) return { x: box.maxX + radius, z: cz, pushed: true };
  if (minPen === penTop) return { x: cx, z: box.minZ - radius, pushed: true };
  return { x: cx, z: box.maxZ + radius, pushed: true };
}

/**
 * Axis-separated sliding collision with smooth corner push-out.
 * Allows the player to slide seamlessly along walls and furniture at any angle.
 */
export function resolveSlidingCollision(
  currentX: number,
  currentZ: number,
  deltaX: number,
  deltaZ: number,
  radius: number,
  bounds: RoomBounds,
  colliders: ColliderAABB[],
): SlidingCollisionResult {
  let nextX = currentX + deltaX;
  let nextZ = currentZ;
  let hitX = false;
  let hitZ = false;

  // Clamp X to room bounds
  if (nextX < bounds.minX + radius) {
    nextX = bounds.minX + radius;
    hitX = true;
  } else if (nextX > bounds.maxX - radius) {
    nextX = bounds.maxX - radius;
    hitX = true;
  }

  // Test X against colliders
  for (let i = 0; i < colliders.length; i++) {
    if (overlapsCircleAABB(nextX, nextZ, radius, colliders[i])) {
      nextX = currentX;
      hitX = true;
      break;
    }
  }

  // Now move Z independently (enables sliding when X is blocked!)
  nextZ = currentZ + deltaZ;

  if (nextZ < bounds.minZ + radius) {
    nextZ = bounds.minZ + radius;
    hitZ = true;
  } else if (nextZ > bounds.maxZ - radius) {
    nextZ = bounds.maxZ - radius;
    hitZ = true;
  }

  for (let i = 0; i < colliders.length; i++) {
    if (overlapsCircleAABB(nextX, nextZ, radius, colliders[i])) {
      nextZ = currentZ;
      hitZ = true;
      break;
    }
  }

  // Final corner separation pass so diagonal grazing slides smoothly around corners
  for (let i = 0; i < colliders.length; i++) {
    const res = pushOutCircleAABB(nextX, nextZ, radius, colliders[i]);
    if (res.pushed) {
      nextX = res.x;
      nextZ = res.z;
    }
  }

  nextX = Math.max(bounds.minX + radius, Math.min(bounds.maxX - radius, nextX));
  nextZ = Math.max(bounds.minZ + radius, Math.min(bounds.maxZ - radius, nextZ));

  return { x: nextX, z: nextZ, hitX, hitZ };
}

export interface HeadBobState {
  phase: number;
  offsetY: number;
  offsetX: number;
  stepTriggered: boolean;
}

/**
 * Distance-synced head bobbing that emits a footstep pulse at each stride trough.
 */
export function advanceHeadBob(
  prevPhase: number,
  distanceDelta: number,
  amplitude = 0.042,
): HeadBobState {
  const strideFreq = 3.6; // radians per meter
  const nextPhase = prevPhase + distanceDelta * strideFreq;
  // Detect crossing multiples of PI (each half-cycle = one footfall)
  const prevStepIndex = Math.floor(prevPhase / Math.PI);
  const nextStepIndex = Math.floor(nextPhase / Math.PI);
  const stepTriggered = distanceDelta > 0.0005 && nextStepIndex > prevStepIndex;

  const offsetY = Math.sin(nextPhase * 2) * amplitude;
  const offsetX = Math.cos(nextPhase) * amplitude * 0.65;

  return {
    phase: nextPhase,
    offsetY,
    offsetX,
    stepTriggered,
  };
}
