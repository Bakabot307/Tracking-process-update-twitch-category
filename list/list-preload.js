const { contextBridge, ipcRenderer } = require('electron/renderer')
contextBridge.exposeInMainWorld('listApi', {
  addName: (appName,category) => ipcRenderer.send('btn-addName',appName,category),
  deleteName: (appName) => ipcRenderer.send('btn-deleteName',appName),
  saveList: (data) => ipcRenderer.send('save-list',data),
  onLoadSavedList: (callback) => {
    ipcRenderer.on('load-saved-list', (event, arg) => callback(arg));
  },  
  onLog: (callback) => {
    ipcRenderer.on('log', (event, arg) => callback(arg));
  },
})
