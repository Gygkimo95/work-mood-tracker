# 打工状态记录器 🐱

一个轻量的自我觉察小工具：上班时点一下当前状态，自动记录时间。一天结束后回看时间线，周末看看统计，**对自己多一点了解**。

> 同一套代码两种用法：① 浏览器直接打开的 **Web 版**；② 基于 Electron 的**桌面悬浮小窗**（Windows / macOS / Linux 通用），常驻屏幕角落，工作时一秒记录。纯前端、零后端，数据全部存在本地。

## 核心理念

记录最大的敌人是「懒得记」，所以这里只有一个动作：**点一下状态按钮，立刻记录，零输入**。

每个状态在底层被归入四大类，统计时才能看出你的时间真正流向了哪里：

| 大类 | 含义 | 颜色 |
|------|------|------|
| 🟢 心流产出 | 真正在创造价值（猛猛干活、激情学习） | 绿 |
| 🔴 内耗痛苦 | 消耗但没产出（痛苦面具、被AI气死、痛苦扯皮） | 红 |
| 🔵 恢复摸鱼 | 主动/被动充电（看猫发呆、rua猫） | 蓝 |
| 🟡 调节求助 | 想把状态扳回来（冷静、找ai开导） | 黄 |

## 功能

- **记录**：一排大按钮，点一下即记一条（自动时间戳），并展示今天刚记的几条
- **时间线**：把某一天的状态画成彩色条带 + 时间轴列表，可前后翻天
- **统计**：本周 / 本月 / 全部；总记录数、心流占比、内耗占比、四大类占比图、**星期 × 时段热力图**、各状态排行
- **设置**：自定义增删状态词（emoji 下拉选择），给每个词选所属大类；导入 / 导出 / 清空数据
- **桌面悬浮小窗**：迷你模式只显示一排状态按钮、无边框、置顶、可拖动；一键展开成完整视图看时间线/统计

## 运行

### Web 版（零依赖）

```bash
# 方式一：直接用浏览器打开 index.html

# 方式二：起一个本地静态服务器（推荐，避免某些浏览器的本地文件限制）
python3 -m http.server 8000
# 然后访问 http://localhost:8000
```

### 桌面悬浮小窗（Electron）

```bash
npm install      # 首次安装依赖
npm start        # 启动悬浮小窗
```

- 顶部小条可**拖动**窗口；`⤢` 展开为完整视图、`⤡` 收起为迷你窗；`—` 最小化、`✕` 关闭。
- 窗口默认浮在屏幕右上角、始终置顶。
- **全局快捷键** `Ctrl/Cmd + Shift + Space`：任何时候按一下，窗口弹到最前并切到迷你记录模式，秒记。

### 打包成安装包

```bash
npm run dist     # 为当前系统出安装包（Win→.exe / mac→.dmg / Linux→AppImage）
```

> 注意：`.dmg` 一般需在 macOS 上构建，`.exe` 在 Windows 上构建。

### 三平台自动出包（GitHub Actions）

仓库已内置工作流 `.github/workflows/build.yml`，在 Mac / Windows / Linux 三平台并行构建：

- **手动触发**：GitHub 仓库 → Actions → “Build Desktop Apps” → Run workflow，构建产物在该次运行的 Artifacts 里下载。
- **打标签发版**：推送 `v*` 标签会自动构建并把安装包附到对应 Release：

```bash
git tag v0.1.0 && git push origin v0.1.0
```

这样在新 Mac 上**连构建都不用**，直接下载 `.dmg` 安装即可。

### macOS 打开时提示「已损坏，无法打开」？

这不是真的损坏，而是 macOS Gatekeeper 对“未付费签名 + 从网上下载”的 App 的隔离机制（Apple 芯片上会显示“已损坏”）。把 App 拖进「应用程序」后，终端执行一次即可：

```bash
xattr -cr "/Applications/打工状态记录器.app"
```

之后正常双击打开。（本项目对 macOS 做了 ad-hoc 签名，去掉隔离标记后即可运行；要彻底免这一步，需要 Apple 开发者账号做正式签名 + 公证。）

## 数据与隐私

- **不上传任何服务器**，全部存在本地。
- **Web 版**：存在浏览器 `localStorage`（键名 `work-mood-tracker:v1`）。
- **桌面版**：存成系统用户目录下的 `data.json`，方便备份 / 跨设备：
  - macOS：`~/Library/Application Support/work-mood-tracker/data.json`
  - Windows：`%APPDATA%\work-mood-tracker\data.json`
  - Linux：`~/.config/work-mood-tracker/data.json`
- 首次启动桌面版时，会自动把旧的 `localStorage` 数据迁移到 `data.json`。
- 也可用「设置 → 导出 / 导入数据」手动搬运。

## 文件结构

```
.
├── index.html          # 页面结构
├── css/style.css       # 样式（含桌面端 / 迷你模式）
├── js/app.js           # 全部逻辑（数据、渲染、交互、迷你模式）
├── electron/
│   ├── main.js         # Electron 主进程：悬浮窗、置顶、尺寸切换
│   └── preload.js      # 安全桥接 window.desktop.*
├── package.json        # 依赖与打包配置
└── README.md
```

## 后续可做（路线图）

- [x] 桌面悬浮小窗（Electron，跨平台）
- [x] 黄金时段分析：星期 × 时段热力图，看几点最容易进入「猛猛干活」
- [x] 全局快捷键唤起快速记录（Ctrl/Cmd+Shift+Space）
- [x] 数据从 localStorage 升级到用户目录 JSON 文件（更好备份 / 跨设备）
- [ ] 给单条记录加一句备注（长按 / 右键）
- [ ] 可选的定时轻提醒
