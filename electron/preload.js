const { contextBridge, ipcRenderer } = require("electron");

// 暴露给网页的安全桥接：网页通过 window.desktop.* 控制窗口
contextBridge.exposeInMainWorld("desktop", {
  isDesktop: true,
  platform: process.platform,
  setMode: (mode) => ipcRenderer.send("set-mode", mode),
  minimize: () => ipcRenderer.send("minimize-window"),
  close: () => ipcRenderer.send("close-window"),
  // 本地 JSON 文件存储
  store: {
    load: () => ipcRenderer.sendSync("store:load-sync"),
    save: (json) => ipcRenderer.send("store:save", json),
  },
  // 全局快捷键唤起 → 切到快速记录
  onQuickRecord: (cb) => ipcRenderer.on("quick-record", cb),
});
