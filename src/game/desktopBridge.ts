export interface DesktopGpuInfo {
  backend: string;
  webgl2?: string;
  gpuCompositing?: string;
  rasterization?: string;
  appliedFlags?: string[];
  error?: string;
}

export interface Room404DesktopBridge {
  isElectron: true;
  platform: string;
  getGpuInfo: () => Promise<DesktopGpuInfo>;
  toggleFullscreen: () => Promise<boolean>;
  quitApp: () => Promise<void>;
}

declare global {
  interface Window {
    room404Desktop?: Room404DesktopBridge;
  }
}

export function getDesktopBridge(): Room404DesktopBridge | null {
  if (typeof window !== 'undefined' && window.room404Desktop?.isElectron) {
    return window.room404Desktop;
  }
  return null;
}
