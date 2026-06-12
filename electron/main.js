const { app, BrowserWindow, ipcMain, screen, globalShortcut } = require("electron");
const path = require("path");
const fs = require("fs");

// 迷你（悬浮小窗）与完整（看时间线/统计）两种尺寸
const MINI = { width: 340, height: 280 };
const FULL = { width: 900, height: 760 };

// 全局快捷键：一键唤起快速记录
const QUICK_SHORTCUT = "CommandOrControl+Shift+Space";

let win = null;

// 数据文件：存在系统用户目录，方便备份 / 跨设备
function dataFilePath() {
  return path.join(app.getPath("userData"), "data.json");
}

function createWindow() {
  const display = screen.getPrimaryDisplay();
  const { width: sw } = display.workAreaSize;

  win = new BrowserWindow({
    width: MINI.width,
    height: MINI.height,
    // 默认浮在右上角
    x: sw - MINI.width - 24,
    y: 24,
    frame: false,
    resizable: true,
    alwaysOnTop: true,
    skipTaskbar: false,
    minWidth: 300,
    minHeight: 200,
    backgroundColor: "#f5f3ee",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // 悬浮窗：在全屏应用之上也尽量可见
  win.setAlwaysOnTop(true, "floating");
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  win.loadFile(path.join(__dirname, "..", "index.html"), { hash: "mini" });
}

// 迷你 / 完整 尺寸切换（保持右上角锚点不跳动）
ipcMain.on("set-mode", (_e, mode) => {
  if (!win) return;
  const target = mode === "full" ? FULL : MINI;
  const [x, y] = win.getPosition();
  const [w] = win.getSize();
  const right = x + w;
  win.setBounds({
    x: Math.max(0, right - target.width),
    y,
    width: target.width,
    height: target.height,
  });
});

ipcMain.on("close-window", () => {
  if (win) win.close();
});

ipcMain.on("minimize-window", () => {
  if (win) win.minimize();
});

// ---------- 本地 JSON 文件存储 ----------
ipcMain.on("store:load-sync", (e) => {
  try {
    e.returnValue = fs.readFileSync(dataFilePath(), "utf8");
  } catch {
    e.returnValue = null; // 文件还不存在
  }
});

ipcMain.on("store:save", (_e, json) => {
  try {
    fs.writeFileSync(dataFilePath(), json, "utf8");
  } catch (err) {
    console.error("保存数据失败:", err);
  }
});

// ---------- 全局快捷键：唤起快速记录 ----------
function quickRecord() {
  if (!win) {
    createWindow();
    return;
  }
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
  win.webContents.send("quick-record"); // 通知页面切到迷你记录模式
}

app.whenReady().then(() => {
  createWindow();

  const ok = globalShortcut.register(QUICK_SHORTCUT, quickRecord);
  if (!ok) console.warn("全局快捷键注册失败:", QUICK_SHORTCUT);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
