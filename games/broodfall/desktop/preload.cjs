/** What the page may ask of the desktop window: quit, and full screen (desktop/main.cjs). */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('broodfallDesktop', {
  quit: () => ipcRenderer.send('bf-quit'),
  toggleFullscreen: () => ipcRenderer.send('bf-fullscreen'),
});
