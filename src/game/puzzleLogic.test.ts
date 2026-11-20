import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EXIT_CODE,
  EVIDENCE_LIST,
  validateExitCode,
  computeTruthTension,
  recordEvidenceId,
  buildDiscoveredCodeSlots,
  resolveSlidingCollision,
  advanceHeadBob,
} from './puzzleLogic';
import type { ColliderAABB, RoomBounds } from './types';

test('exit code validation accepts 7419 and rejects wrong codes', () => {
  assert.equal(EXIT_CODE, '7419');
  assert.equal(validateExitCode('7419'), true);
  assert.equal(validateExitCode(' 7419 '), true);
  assert.equal(validateExitCode('0000'), false);
  assert.equal(validateExitCode('741'), false);
  assert.equal(validateExitCode('7491'), false);
});

test('all 5 forensic evidence items assemble the exact 4-digit exit code', () => {
  assert.equal(EVIDENCE_LIST.length, 5);
  const allIds = EVIDENCE_LIST.map((e) => e.id);
  const slots = buildDiscoveredCodeSlots(allIds);
  assert.deepEqual(slots, ['7', '4', '1', '9']);
  assert.equal(slots.join(''), EXIT_CODE);
});

test('recording evidence deduplicates entries and increases truth tension monotonically', () => {
  let logged = recordEvidenceId([], 'torn_note');
  logged = recordEvidenceId(logged, 'torn_note');
  assert.equal(logged.length, 1);

  const t0 = computeTruthTension(0, 5);
  const t2 = computeTruthTension(2, 5);
  const t5 = computeTruthTension(5, 5);
  assert.ok(t0 < t2 && t2 < t5);
  assert.equal(t5, 1);
});

test('sliding collision blocks wall penetration while preserving tangential movement', () => {
  const bounds: RoomBounds = { minX: -3.8, maxX: 3.8, minZ: -3.8, maxZ: 3.8 };
  const desk: ColliderAABB = { id: 'desk', minX: -1.0, maxX: 1.0, minZ: -0.6, maxZ: 0.6 };

  // Approach the West wall diagonally: X should clamp, Z should still slide freely
  const wallRes = resolveSlidingCollision(-3.4, 0, -0.5, 0.4, 0.35, bounds, [desk]);
  assert.equal(wallRes.hitX, true);
  assert.equal(wallRes.hitZ, false);
  assert.ok(Math.abs(wallRes.x - (-3.8 + 0.35)) < 1e-6);
  assert.ok(Math.abs(wallRes.z - 0.4) < 1e-6);

  // Approach the desk front face diagonally: Z blocked, X slides cleanly
  const deskRes = resolveSlidingCollision(0.0, 0.96, 0.35, -0.25, 0.35, bounds, [desk]);
  assert.equal(deskRes.hitZ, true);
  assert.equal(deskRes.hitX, false);
  assert.ok(deskRes.x > 0.3);
  assert.ok(deskRes.z >= 0.95);
});

test('head bob triggers footsteps cleanly at stride intervals', () => {
  let phase = 0;
  let steps = 0;
  for (let i = 0; i < 40; i++) {
    const res = advanceHeadBob(phase, 0.1);
    phase = res.phase;
    if (res.stepTriggered) steps++;
  }
  // 4.0 meters * 3.6 rad/m = 14.4 rad => Math.floor(14.4 / PI) = 4 footsteps
  assert.equal(steps, 4);
});
