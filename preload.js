const { contextBridge, ipcRenderer } = require('electron/renderer');

contextBridge.exposeInMainWorld('electronAPI', {
  setTitle: (title) => ipcRenderer.send('set-title', title),
  onLoadRunningList: (callback) => {
    ipcRenderer.on('load-running-list', (event, arg) => callback(arg));
  },
  onLog: (callback) => {
    ipcRenderer.on('log', (event, arg) => callback(arg));
  },
  onMessage: (callback) => {
    ipcRenderer.on('message', (event, arg) => callback(arg));
  },
  onAction: (action) => ipcRenderer.send('action', action)
})
