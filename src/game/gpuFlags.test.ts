import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { getChromiumGpuSwitches, applyGpuSwitches } = require('../../electron/gpuFlags.cjs') as {
  getChromiumGpuSwitches: (options?: {
    dx12?: boolean;
    unlockFps?: boolean;
  }) => Array<[string, string | undefined]>;
  applyGpuSwitches: (
    commandLine: { appendSwitch: (name: string, value?: string) => void },
    options?: { dx12?: boolean; unlockFps?: boolean },
  ) => Array<[string, string | undefined]>;
};

test('default GPU switches enforce DirectX 11, discrete GPU, and blocklist override', () => {
  const switches = getChromiumGpuSwitches();
  const map = new Map(switches);

  assert.equal(map.has('ignore-gpu-blocklist'), true);
  assert.equal(map.get('use-gl'), 'angle');
  assert.equal(map.get('use-angle'), 'd3d11');
  assert.equal(map.has('force_high_performance_gpu'), true);
  assert.equal(map.has('enable-gpu-rasterization'), true);
  assert.equal(map.has('enable-zero-copy'), true);
  assert.equal(map.has('disable-software-rasterizer'), true);
  assert.equal(map.get('autoplay-policy'), 'no-user-gesture-required');
  assert.equal(map.has('disable-gpu-vsync'), false);
});

test('DX12 and unlocked FPS options switch ANGLE to d3d11on12 and disable vsync limit', () => {
  const switches = getChromiumGpuSwitches({ dx12: true, unlockFps: true });
  const map = new Map(switches);

  assert.equal(map.get('use-angle'), 'd3d11on12');
  assert.equal(map.has('disable-gpu-vsync'), true);
  assert.equal(map.has('disable-frame-rate-limit'), true);
});

test('applyGpuSwitches forwards every flag cleanly to Electron app.commandLine', () => {
  const calls: Array<[string, string | undefined]> = [];
  const fakeCmd = {
    appendSwitch(name: string, value?: string) {
      calls.push([name, value]);
    },
  };

  applyGpuSwitches(fakeCmd, { dx12: false, unlockFps: false });
  assert.ok(calls.length >= 10);
  assert.deepEqual(
    calls.find(([k]) => k === 'use-angle'),
    ['use-angle', 'd3d11'],
  );
});
