'use strict';

/**
 * Pure Chromium GPU switch configuration for Investigation Room 404 (Electron).
 * Forces hardware-accelerated WebGL2 via ANGLE DirectX 11/12 on the discrete GPU
 * and bypasses browser GPU blocklists and software rasterizer fallbacks.
 */

/**
 * @param {{ dx12?: boolean; unlockFps?: boolean }} [options]
 * @returns {Array<[string, string | undefined]>}
 */
function getChromiumGpuSwitches(options = {}) {
  const dx12 = Boolean(options.dx12);
  const unlockFps = Boolean(options.unlockFps);

  /** @type {Array<[string, string | undefined]>} */
  const switches = [
    // Bypass Chromium GPU driver blocklist (forces hardware WebGL even on older/flagged drivers)
    ['ignore-gpu-blocklist', undefined],
    // Force ANGLE + native Windows DirectX backend (DirectX 11 default, or D3D11on12 for DX12 path)
    ['use-gl', 'angle'],
    ['use-angle', dx12 ? 'd3d11on12' : 'd3d11'],
    // Force Windows hybrid systems (NVIDIA Optimus / AMD Switchable) onto the discrete dedicated GPU
    ['force_high_performance_gpu', undefined],
    // Enable GPU rasterization & zero-copy VRAM texture uploads
    ['enable-gpu-rasterization', undefined],
    ['enable-zero-copy', undefined],
    // Ensure hardware WebGL & WebGPU remain enabled and prevent silent SwiftShader CPU fallback
    ['enable-webgl', undefined],
    ['enable-unsafe-webgpu', undefined],
    ['disable-software-rasterizer', undefined],
    // Allow procedural Web Audio ambient drone to initialize cleanly on launch
    ['autoplay-policy', 'no-user-gesture-required'],
  ];

  if (unlockFps) {
    switches.push(['disable-gpu-vsync', undefined]);
    switches.push(['disable-frame-rate-limit', undefined]);
  }

  return switches;
}

/**
 * Injects all Chromium GPU switches into Electron's app.commandLine before app.whenReady().
 * @param {{ appendSwitch: (name: string, value?: string) => void }} commandLine
 * @param {{ dx12?: boolean; unlockFps?: boolean }} [options]
 */
function applyGpuSwitches(commandLine, options = {}) {
  const switches = getChromiumGpuSwitches(options);
  for (const [flag, value] of switches) {
    if (value !== undefined) {
      commandLine.appendSwitch(flag, value);
    } else {
      commandLine.appendSwitch(flag);
    }
  }
  return switches;
}

module.exports = {
  getChromiumGpuSwitches,
  applyGpuSwitches,
};
