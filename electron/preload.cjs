'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('room404Desktop', {
  isElectron: true,
  platform: process.platform,
  getGpuInfo: () => ipcRenderer.invoke('room404:get-gpu-info'),
  toggleFullscreen: () => ipcRenderer.invoke('room404:toggle-fullscreen'),
  quitApp: () => ipcRenderer.invoke('room404:quit'),
});
