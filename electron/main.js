const {
  app, BrowserWindow, ipcMain, screen, globalShortcut, Tray, Menu, nativeImage,
} = require("electron");
const path = require("path");
const fs = require("fs");

const POPOVER = { width: 380, height: 320, minHeight: 180, maxHeight: 620 };
const FULL = { width: 900, height: 760 };
const QUICK_SHORTCUT = "CommandOrControl+Shift+Space";
const isMac = process.platform === "darwin";

let tray = null;
let popover = null;
let fullWin = null;

function dataFilePath() {
  return path.join(app.getPath("userData"), "data.json");
}
function indexPath() {
  return path.join(__dirname, "..", "index.html");
}
function preloadPath() {
  return path.join(__dirname, "preload.js");
}

// ---------- 弹出面板（菜单栏 popover 风格） ----------
function createPopover() {
  popover = new BrowserWindow({
    width: POPOVER.width,
    height: POPOVER.height,
    show: false,
    frame: false,
    resizable: false,
    movable: false,
    transparent: true,
    hasShadow: false, // 用 CSS 画圆角阴影
    skipTaskbar: true,
    fullscreenable: false,
    webPreferences: {
      preload: preloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  popover.loadFile(indexPath(), { hash: "popover" });

  // 失焦即收起，模拟原生 popover
  popover.on("blur", () => {
    if (popover && !popover.webContents.isDevToolsFocused()) popover.hide();
  });
}

function positionPopover() {
  if (!popover) return;
  const { width } = popover.getBounds();
  if (tray && isMac) {
    const b = tray.getBounds();
    const disp = screen.getDisplayNearestPoint({ x: b.x, y: b.y });
    let x = Math.round(b.x + b.width / 2 - width / 2);
    x = Math.min(
      Math.max(x, disp.workArea.x + 6),
      disp.workArea.x + disp.workArea.width - width - 6
    );
    const y = Math.round(b.y + b.height + 4);
    popover.setPosition(x, y, false);
  } else {
    const disp = screen.getPrimaryDisplay();
    const x = Math.round(disp.workArea.x + disp.workArea.width - width - 16);
    const y = Math.round(disp.workArea.y + 40);
    popover.setPosition(x, y, false);
  }
}

function showPopover() {
  if (!popover || popover.isDestroyed()) createPopover();
  positionPopover();
  popover.show();
  popover.focus();
  popover.webContents.send("quick-record");
}

function togglePopover() {
  if (popover && !popover.isDestroyed() && popover.isVisible()) popover.hide();
  else showPopover();
}

// ---------- 完整窗口（时间线 / 统计 / 设置） ----------
function openFull() {
  if (fullWin && !fullWin.isDestroyed()) {
    fullWin.show();
    fullWin.focus();
    return;
  }
  fullWin = new BrowserWindow({
    width: FULL.width,
    height: FULL.height,
    title: "打工状态记录器",
    backgroundColor: "#f5f3ee",
    webPreferences: {
      preload: preloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  fullWin.loadFile(indexPath(), { hash: "full" });
  if (isMac && app.dock) app.dock.show();
  fullWin.on("closed", () => {
    fullWin = null;
    if (isMac && app.dock) app.dock.hide();
  });
}

// ---------- 菜单栏图标 ----------
function buildTray() {
  try {
    tray = new Tray(nativeImage.createEmpty());
    if (isMac) tray.setTitle("🐱"); // macOS 菜单栏直接用 emoji 当图标
    tray.setToolTip("打工状态记录器 · 点我记录此刻");

    const menu = Menu.buildFromTemplate([
      { label: "快速记录", accelerator: QUICK_SHORTCUT, click: showPopover },
      { label: "打开完整视图…", click: openFull },
      { type: "separator" },
      { label: "退出", role: "quit" },
    ]);

    // 左键弹面板，右键出菜单
    tray.on("click", togglePopover);
    tray.on("right-click", () => tray.popUpContextMenu(menu));
  } catch (err) {
    console.warn("菜单栏图标创建失败（Linux 可能需要 libappindicator）:", err.message);
  }
}

// ---------- 本地 JSON 文件存储 ----------
ipcMain.on("store:load-sync", (e) => {
  try {
    e.returnValue = fs.readFileSync(dataFilePath(), "utf8");
  } catch {
    e.returnValue = null;
  }
});
ipcMain.on("store:save", (_e, json) => {
  try {
    fs.writeFileSync(dataFilePath(), json, "utf8");
  } catch (err) {
    console.error("保存数据失败:", err);
  }
});

// ---------- 渲染进程的窗口控制 ----------
ipcMain.on("hide-window", () => {
  if (popover && !popover.isDestroyed()) popover.hide();
});
ipcMain.on("resize-popover", (_e, height) => {
  if (!popover || popover.isDestroyed()) return;
  const disp = tray && isMac
    ? screen.getDisplayNearestPoint(tray.getBounds())
    : screen.getPrimaryDisplay();
  const cap = Math.min(POPOVER.maxHeight, disp.workArea.height - 80);
  const h = Math.max(POPOVER.minHeight, Math.min(Math.round(height) || POPOVER.height, cap));
  const { width } = popover.getBounds();
  popover.setBounds({ ...popover.getBounds(), width, height: h });
  positionPopover();
});
ipcMain.on("open-full", openFull);

app.whenReady().then(() => {
  if (isMac && app.dock) app.dock.hide(); // 纯菜单栏应用，不占 Dock

  // macOS 留一份最简菜单，保证输入框可复制粘贴、Cmd+Q 可用
  if (isMac) {
    Menu.setApplicationMenu(
      Menu.buildFromTemplate([
        { label: app.name, submenu: [{ role: "quit" }] },
        {
          label: "Edit",
          submenu: [
            { role: "undo" }, { role: "redo" }, { type: "separator" },
            { role: "cut" }, { role: "copy" }, { role: "paste" }, { role: "selectAll" },
          ],
        },
        // Window 菜单：提供 Cmd+W 关闭当前窗口、Cmd+M 最小化等标准快捷键
        {
          label: "Window",
          submenu: [
            { role: "minimize" },
            { role: "close", accelerator: "CommandOrControl+W" },
          ],
        },
      ])
    );
  }

  buildTray();
  createPopover();
  if (!isMac) openFull(); // 非 mac 先给个可见窗口（托盘图标在 Win/Linux 需图标资源，后续再补）

  const ok = globalShortcut.register(QUICK_SHORTCUT, togglePopover);
  if (!ok) console.warn("全局快捷键注册失败:", QUICK_SHORTCUT);

  app.on("activate", () => {
    if (isMac) showPopover();
  });
});

app.on("will-quit", () => globalShortcut.unregisterAll());

// 菜单栏应用：关掉完整窗口不退出整个 App
app.on("window-all-closed", () => {});
