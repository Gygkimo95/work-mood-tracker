const { contextBridge, ipcRenderer } = require("electron");

// 暴露给网页的安全桥接：网页通过 window.desktop.* 与桌面交互
contextBridge.exposeInMainWorld("desktop", {
  isDesktop: true,
  platform: process.platform,
  // 本地 JSON 文件存储
  store: {
    load: () => ipcRenderer.sendSync("store:load-sync"),
    save: (json) => ipcRenderer.send("store:save", json),
  },
  // 弹出面板：记录完隐藏自己
  hide: () => ipcRenderer.send("hide-window"),
  // 弹出面板：按内容自适应高度
  resize: (height) => ipcRenderer.send("resize-popover", height),
  // 打开完整窗口
  openFull: () => ipcRenderer.send("open-full"),
  // 菜单栏/快捷键唤起 → 切到快速记录
  onQuickRecord: (cb) => ipcRenderer.on("quick-record", cb),
});
