/* 打工状态记录器 — 纯前端，数据存 localStorage */
(() => {
  "use strict";

  const STORAGE_KEY = "work-mood-tracker:v1";

  // 默认类型（觉察的核心：把状态归类，才能看出时间流向）。现已可自由增删改。
  const DEFAULT_CATEGORIES = [
    { id: "flow",     name: "心流产出", color: "#4caf7d", desc: "真正在创造价值" },
    { id: "drain",    name: "内耗痛苦", color: "#e26d6d", desc: "消耗但没产出" },
    { id: "recharge", name: "恢复摸鱼", color: "#6aa6e0", desc: "主动/被动充电" },
    { id: "regulate", name: "调节求助", color: "#c79a4b", desc: "想把状态扳回来" },
  ];

  const DEFAULT_STATES = [
    { id: "s1", emoji: "😖", label: "痛苦面具", category: "drain" },
    { id: "s2", emoji: "😌", label: "冷静！",   category: "regulate" },
    { id: "s3", emoji: "🐱", label: "看猫发呆", category: "recharge" },
    { id: "s4", emoji: "🐈", label: "rua猫",    category: "recharge" },
    { id: "s5", emoji: "😩", label: "痛苦扯皮", category: "drain" },
    { id: "s6", emoji: "🤖", label: "找ai开导", category: "regulate" },
    { id: "s7", emoji: "📚", label: "激情学习", category: "flow" },
    { id: "s8", emoji: "💪", label: "猛猛干活", category: "flow" },
    { id: "s9", emoji: "🤬", label: "被AI气死", category: "drain" },
  ];

  // ---------- 数据层 ----------
  // 桌面端（Electron）写本地 JSON 文件，浏览器端用 localStorage
  const fileStore = (typeof window !== "undefined" && window.desktop && window.desktop.store) || null;

  let data = load();
  if (fileStore) save(); // 确保文件存在 / 把旧的 localStorage 数据迁移落盘

  function load() {
    try {
      let raw = null;
      if (fileStore) {
        raw = fileStore.load();
        if (!raw) raw = localStorage.getItem(STORAGE_KEY); // 迁移旧数据
      } else {
        raw = localStorage.getItem(STORAGE_KEY);
      }
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.states) && Array.isArray(parsed.logs)) {
          // 旧数据迁移：补上 categories 字段
          if (!Array.isArray(parsed.categories) || parsed.categories.length === 0) {
            parsed.categories = structuredClone(DEFAULT_CATEGORIES);
          }
          return parsed;
        }
      }
    } catch (e) { /* ignore */ }
    return {
      states: structuredClone(DEFAULT_STATES),
      logs: [],
      categories: structuredClone(DEFAULT_CATEGORIES),
    };
  }

  function save() {
    const json = JSON.stringify(data);
    if (fileStore) fileStore.save(json);
    else localStorage.setItem(STORAGE_KEY, json);
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function stateById(id) {
    return data.states.find((s) => s.id === id);
  }

  function categories() {
    return data.categories || [];
  }
  function catById(id) {
    return categories().find((c) => c.id === id);
  }
  function catColor(id) {
    return catById(id)?.color || "#999";
  }

  // ---------- 工具 ----------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  function startOfDay(d) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  }
  function sameDay(a, b) {
    return startOfDay(a).getTime() === startOfDay(b).getTime();
  }
  function fmtTime(ts) {
    return new Date(ts).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
  }
  function fmtDateTitle(d) {
    const today = startOfDay(new Date()).getTime();
    const that = startOfDay(d).getTime();
    const diff = Math.round((today - that) / 86400000);
    if (diff === 0) return "今天";
    if (diff === 1) return "昨天";
    if (diff === -1) return "明天";
    return new Date(d).toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "short" });
  }

  let toastTimer = null;
  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 1600);
  }

  // ---------- 记录页 ----------
  function renderStateGrid() {
    const grid = $("#stateGrid");
    grid.innerHTML = "";
    if (data.states.length === 0) {
      grid.innerHTML = `<div class="empty">还没有状态词，去「设置」里加几个吧～</div>`;
      return;
    }
    data.states.forEach((s) => {
      const btn = document.createElement("button");
      btn.className = "state-btn";
      btn.style.setProperty("--c", catColor(s.category));
      btn.innerHTML = `<span class="emoji">${s.emoji}</span><span class="label">${escapeHtml(s.label)}</span>`;
      btn.addEventListener("click", () => {
        logState(s.id);
        btn.classList.remove("flash");
        void btn.offsetWidth;
        btn.classList.add("flash");
      });
      grid.appendChild(btn);
    });
    requestPopoverResize();
  }

  function logState(stateId) {
    data.logs.push({ id: uid(), stateId, ts: Date.now() });
    save();
    const s = stateById(stateId);
    toast(`已记录 · ${s.emoji} ${s.label}`);
    renderRecent();
    // 若时间线/统计正展示，保持同步
    if ($("#view-timeline").classList.contains("active")) renderTimeline();
    if ($("#view-stats").classList.contains("active")) renderStats();
    // 弹出面板：记录完短暂展示反馈后自动收起
    if (isPopover && window.desktop) {
      setTimeout(() => window.desktop.hide(), 550);
    }
  }

  function renderRecent() {
    const list = $("#recentList");
    const todays = data.logs
      .filter((l) => sameDay(l.ts, new Date()))
      .sort((a, b) => b.ts - a.ts);
    $("#todayCount").textContent = `${todays.length} 条`;
    list.innerHTML = "";
    if (todays.length === 0) {
      list.innerHTML = `<div class="empty">今天还没有记录，点上面的状态开始吧</div>`;
      return;
    }
    todays.slice(0, 6).forEach((l) => {
      const s = stateById(l.stateId);
      const li = document.createElement("li");
      const emoji = s ? s.emoji : "❔";
      const label = s ? s.label : "已删除的状态";
      li.innerHTML = `
        <span class="r-emoji">${emoji}</span>
        <span class="r-label">${escapeHtml(label)}</span>
        <span class="r-time">${fmtTime(l.ts)}</span>
        <button class="r-del" title="删除">✕</button>`;
      li.querySelector(".r-del").addEventListener("click", () => deleteLog(l.id));
      list.appendChild(li);
    });
  }

  function deleteLog(id) {
    data.logs = data.logs.filter((l) => l.id !== id);
    save();
    renderRecent();
    renderTimeline();
    if ($("#view-stats").classList.contains("active")) renderStats();
    toast("已删除该记录");
  }

  // ---------- 时间线页 ----------
  let timelineDate = startOfDay(new Date());

  function renderTimeline() {
    $("#timelineDate").textContent = fmtDateTitle(timelineDate);
    const dayLogs = data.logs
      .filter((l) => sameDay(l.ts, timelineDate))
      .sort((a, b) => a.ts - b.ts);

    $("#timelineSub").textContent = dayLogs.length
      ? `${new Date(timelineDate).toLocaleDateString("zh-CN")} · 共 ${dayLogs.length} 条`
      : new Date(timelineDate).toLocaleDateString("zh-CN");

    // 禁用「下一天」当已是今天
    $("#nextDay").disabled = sameDay(timelineDate, new Date());

    renderBand(dayLogs);
    renderTimelineList(dayLogs);
  }

  // 彩色条带：按「次数」均分，每条记录占一格等宽（不按时间长短）
  function renderBand(dayLogs) {
    const band = $("#dayBand");
    const axis = $("#bandAxis");
    band.innerHTML = "";
    axis.innerHTML = "";

    if (dayLogs.length === 0) {
      band.innerHTML = `<div class="band-empty">这一天没有记录</div>`;
      return;
    }

    const pct = 100 / dayLogs.length;
    dayLogs.forEach((l) => {
      const s = stateById(l.stateId);
      const color = s ? catColor(s.category) : "#bbb";
      const seg = document.createElement("div");
      seg.className = "band-seg";
      seg.style.width = pct + "%";
      seg.style.background = color || "#bbb";
      seg.title = `${s ? s.emoji + " " + s.label : "已删除"} · ${fmtTime(l.ts)}`;
      band.appendChild(seg);
    });

    const left = document.createElement("span");
    left.textContent = fmtTime(dayLogs[0].ts);
    const right = document.createElement("span");
    right.textContent = fmtTime(dayLogs[dayLogs.length - 1].ts);
    axis.appendChild(left);
    axis.appendChild(right);
  }

  function renderTimelineList(dayLogs) {
    const list = $("#timelineList");
    list.innerHTML = "";
    if (dayLogs.length === 0) {
      list.innerHTML = `<div class="empty">换一天看看，或回「记录」页记一条</div>`;
      return;
    }
    dayLogs.forEach((l) => {
      const s = stateById(l.stateId);
      const color = s ? catColor(s.category) : "#bbb";
      const li = document.createElement("li");
      li.innerHTML = `
        <span class="t-time">${fmtTime(l.ts)}</span>
        <span class="t-dot" style="background:${color}"></span>
        <span class="t-emoji">${s ? s.emoji : "❔"}</span>
        <span class="t-label">${escapeHtml(s ? s.label : "已删除的状态")}</span>
        <button class="t-del" title="删除">✕</button>`;
      li.querySelector(".t-del").addEventListener("click", () => deleteLog(l.id));
      list.appendChild(li);
    });
  }

  // ---------- 统计页 ----------
  let statRange = "week";

  function rangeStart(range) {
    const now = new Date();
    if (range === "week") {
      const d = startOfDay(now);
      const dow = (d.getDay() + 6) % 7; // 周一为一周起点
      d.setDate(d.getDate() - dow);
      return d.getTime();
    }
    if (range === "month") {
      return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    }
    return 0; // all
  }

  function renderStats() {
    const start = rangeStart(statRange);
    const logs = data.logs.filter((l) => l.ts >= start);

    renderStatCards(logs);
    renderCatBar(logs);
    renderHeatmap(logs);
    renderRank(logs);
  }

  function hexToRgba(hex, alpha) {
    const h = hex.replace("#", "");
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  const WEEKDAY_LABELS = ["一", "二", "三", "四", "五", "六", "日"];

  function renderHeatmap(logs) {
    const grid = $("#heatmap");
    const legend = $("#heatLegend");
    grid.innerHTML = "";
    legend.innerHTML = "";

    if (logs.length === 0) {
      grid.style.display = "block";
      grid.innerHTML = `<div class="heat-empty">这个时间段还没有记录，攒点数据再来看热力图～</div>`;
      return;
    }
    grid.style.display = "grid";

    // 聚合：cell[weekday(0=周一)][hour] = { total, cats: {flow,drain,...} }
    let minH = 23, maxH = 0;
    const cells = {};
    logs.forEach((l) => {
      const d = new Date(l.ts);
      const wd = (d.getDay() + 6) % 7;
      const h = d.getHours();
      minH = Math.min(minH, h);
      maxH = Math.max(maxH, h);
      const key = wd + ":" + h;
      if (!cells[key]) cells[key] = { total: 0, cats: {} };
      cells[key].total++;
      const s = stateById(l.stateId);
      if (s) cells[key].cats[s.category] = (cells[key].cats[s.category] || 0) + 1;
    });

    // 适度留白：至少展示一段连续时段
    minH = Math.min(minH, 9);
    maxH = Math.max(maxH, 18);

    let maxCount = 0;
    Object.values(cells).forEach((c) => { maxCount = Math.max(maxCount, c.total); });

    // 表头：左上角空 + 周一..周日
    grid.appendChild(el("div", "heat-corner"));
    WEEKDAY_LABELS.forEach((w) => grid.appendChild(el("div", "heat-colhead", w)));

    for (let h = minH; h <= maxH; h++) {
      grid.appendChild(el("div", "heat-rowhead", h + ":00"));
      for (let wd = 0; wd < 7; wd++) {
        const cell = el("div", "heat-cell");
        const c = cells[wd + ":" + h];
        if (c && c.total > 0) {
          // 主导类别决定色相，次数决定深浅
          let domCat = null, domN = -1;
          for (const [k, n] of Object.entries(c.cats)) {
            if (n > domN) { domN = n; domCat = k; }
          }
          const color = catColor(domCat);
          const alpha = 0.22 + 0.78 * (c.total / maxCount);
          cell.style.background = hexToRgba(color, alpha);
          cell.classList.add("has");
          const breakdown = Object.entries(c.cats)
            .map(([k, n]) => `${catById(k)?.name || k} ${n}`)
            .join("、");
          cell.title = `周${WEEKDAY_LABELS[wd]} ${h}:00 · 共 ${c.total} 条\n${breakdown}`;
        }
        grid.appendChild(cell);
      }
    }

    // 图例：各类色 + 深浅说明
    categories().forEach((cat) => {
      const item = el("div", "item");
      item.innerHTML = `<span class="swatch" style="background:${cat.color}"></span>${escapeHtml(cat.name)}`;
      legend.appendChild(item);
    });
    const scale = el("div", "scale");
    scale.innerHTML = `少 <span class="box" style="background:${hexToRgba("#2a2722", 0.25)}"></span>
      <span class="box" style="background:${hexToRgba("#2a2722", 0.6)}"></span>
      <span class="box" style="background:${hexToRgba("#2a2722", 1)}"></span> 多`;
    legend.appendChild(scale);
  }

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function renderStatCards(logs) {
    const cards = $("#statCards");
    const total = logs.length;
    const days = new Set(logs.map((l) => startOfDay(l.ts).getTime())).size;

    // 内耗占比 & 心流占比
    let drain = 0, flow = 0;
    logs.forEach((l) => {
      const s = stateById(l.stateId);
      if (!s) return;
      if (s.category === "drain") drain++;
      if (s.category === "flow") flow++;
    });
    const pct = (n) => (total ? Math.round((n / total) * 100) : 0);

    const flowName = catById("flow")?.name || "心流产出";
    const drainName = catById("drain")?.name || "内耗痛苦";
    const items = [
      { big: total, lbl: "总记录数" },
      { big: days, lbl: "有记录的天数" },
      { big: pct(flow) + "%", lbl: flowName + "占比" },
      { big: pct(drain) + "%", lbl: drainName + "占比" },
    ];
    cards.innerHTML = items
      .map((it) => `<div class="stat-card"><div class="big">${it.big}</div><div class="lbl">${it.lbl}</div></div>`)
      .join("");
  }

  function renderCatBar(logs) {
    const bar = $("#catBar");
    const legend = $("#catLegend");
    const counts = {};
    categories().forEach((c) => { counts[c.id] = 0; });
    logs.forEach((l) => {
      const s = stateById(l.stateId);
      if (s && counts[s.category] !== undefined) counts[s.category]++;
    });
    const total = logs.length;
    bar.innerHTML = "";
    legend.innerHTML = "";

    if (total === 0) {
      bar.innerHTML = `<div class="band-empty">这个时间段还没有记录</div>`;
      return;
    }

    categories().forEach((cat) => {
      const n = counts[cat.id];
      const pct = (n / total) * 100;
      if (pct > 0) {
        const seg = document.createElement("div");
        seg.className = "cat-bar-seg";
        seg.style.width = pct + "%";
        seg.style.background = cat.color;
        seg.textContent = pct >= 9 ? Math.round(pct) + "%" : "";
        seg.title = `${cat.name} ${Math.round(pct)}%`;
        bar.appendChild(seg);
      }
      const item = document.createElement("div");
      item.className = "item";
      item.innerHTML = `<span class="swatch" style="background:${cat.color}"></span>
        ${escapeHtml(cat.name)} <span class="pct">${n} 次 · ${Math.round(pct)}%</span>`;
      legend.appendChild(item);
    });
  }

  function renderRank(logs) {
    const wrap = $("#rankList");
    const counts = {};
    logs.forEach((l) => { counts[l.stateId] = (counts[l.stateId] || 0) + 1; });
    const rows = Object.entries(counts)
      .map(([id, n]) => ({ s: stateById(id), n }))
      .filter((r) => r.s)
      .sort((a, b) => b.n - a.n);

    wrap.innerHTML = "";
    if (rows.length === 0) {
      wrap.innerHTML = `<div class="empty">暂无数据</div>`;
      return;
    }
    const max = rows[0].n;
    rows.forEach((r) => {
      const color = catColor(r.s.category);
      const row = document.createElement("div");
      row.className = "rank-row";
      row.innerHTML = `
        <span class="r-name">${r.s.emoji} ${escapeHtml(r.s.label)}</span>
        <span class="r-track"><span class="r-fill" style="width:${(r.n / max) * 100}%;background:${color}"></span></span>
        <span class="r-num">${r.n}</span>`;
      wrap.appendChild(row);
    });
  }

  // ---------- 设置页 ----------
  function fillCategorySelect(sel, selected) {
    const cats = categories();
    sel.innerHTML = cats
      .map((c) => `<option value="${c.id}" ${c.id === selected ? "selected" : ""}>${escapeHtml(c.name)}</option>`)
      .join("");
  }

  function renderSettings() {
    renderCategoryManager();
    fillCategorySelect($("#newCategory"), categories()[0]?.id);
    const list = $("#manageList");
    list.innerHTML = "";
    if (data.states.length === 0) {
      list.innerHTML = `<div class="empty">还没有状态词，用上面的表单加一个吧</div>`;
      return;
    }
    data.states.forEach((s) => {
      const cat = catById(s.category);
      const li = document.createElement("li");
      li.innerHTML = `
        <span class="m-emoji">${s.emoji}</span>
        <span class="m-label">${escapeHtml(s.label)}</span>
        <span class="m-cat" style="background:${cat?.color || "#999"}">${escapeHtml(cat?.name || "未分类")}</span>
        <span class="m-actions">
          <button class="m-btn edit" title="切换类型">🏷️</button>
          <button class="m-btn del" title="删除">✕</button>
        </span>`;
      li.querySelector(".edit").addEventListener("click", () => cycleCategory(s.id));
      li.querySelector(".del").addEventListener("click", () => deleteState(s.id));
      list.appendChild(li);
    });
  }

  function cycleCategory(id) {
    const s = stateById(id);
    if (!s) return;
    const keys = categories().map((c) => c.id);
    if (keys.length === 0) return;
    const idx = keys.indexOf(s.category);
    s.category = keys[(idx + 1) % keys.length];
    save();
    renderSettings();
    renderStateGrid();
    toast(`「${s.label}」已归类到 ${catById(s.category)?.name || ""}`);
  }

  // ---------- 类型（大类）管理 ----------
  function renderCategoryManager() {
    const list = $("#catManageList");
    if (!list) return;
    list.innerHTML = "";
    if (categories().length === 0) {
      list.innerHTML = `<div class="empty">还没有类型，先在上面加一个吧</div>`;
      return;
    }
    categories().forEach((c) => {
      const used = data.states.filter((s) => s.category === c.id).length;
      const li = document.createElement("li");
      li.innerHTML = `
        <input type="color" class="m-color" value="${c.color}" title="改颜色" />
        <span class="m-label">${escapeHtml(c.name)}</span>
        <span class="m-cat" style="background:${c.color}">${used} 个状态</span>
        <span class="m-actions">
          <button class="m-btn edit" title="改名">✏️</button>
          <button class="m-btn del" title="删除类型">✕</button>
        </span>`;
      li.querySelector(".m-color").addEventListener("change", (e) => updateCategory(c.id, { color: e.target.value }));
      li.querySelector(".edit").addEventListener("click", () => renameCategory(c.id));
      li.querySelector(".del").addEventListener("click", () => deleteCategory(c.id));
      list.appendChild(li);
    });
  }

  function renameCategory(id) {
    const c = catById(id);
    if (!c) return;
    const name = prompt("给这个类型改个名字", c.name);
    if (name == null) return;
    const trimmed = name.trim();
    if (trimmed) updateCategory(id, { name: trimmed });
  }

  function addCategory(name, color) {
    data.categories.push({ id: uid(), name, color: color || "#888888", desc: "" });
    save();
    renderSettings();
    renderStateGrid();
    if ($("#view-stats").classList.contains("active")) renderStats();
    toast(`已添加类型「${name}」`);
  }

  function updateCategory(id, patch) {
    const c = catById(id);
    if (!c) return;
    Object.assign(c, patch);
    save();
    renderSettings();
    renderStateGrid();
    if ($("#view-stats").classList.contains("active")) renderStats();
    if ($("#view-timeline").classList.contains("active")) renderTimeline();
  }

  function deleteCategory(id) {
    const c = catById(id);
    if (!c) return;
    const used = data.states.filter((s) => s.category === id).length;
    const remain = categories().filter((x) => x.id !== id);
    if (remain.length === 0) {
      toast("至少保留一个类型");
      return;
    }
    const msg = used > 0
      ? `删除类型「${c.name}」？\n有 ${used} 个状态属于它，将被改归到「${remain[0].name}」。`
      : `删除类型「${c.name}」？`;
    if (!confirm(msg)) return;
    data.states.forEach((s) => { if (s.category === id) s.category = remain[0].id; });
    data.categories = remain;
    save();
    renderSettings();
    renderStateGrid();
    if ($("#view-stats").classList.contains("active")) renderStats();
    if ($("#view-timeline").classList.contains("active")) renderTimeline();
    toast("已删除该类型");
  }

  function deleteState(id) {
    const s = stateById(id);
    if (!s) return;
    if (!confirm(`删除状态「${s.label}」？\n（已记录的历史会保留，但会显示为"已删除的状态"）`)) return;
    data.states = data.states.filter((x) => x.id !== id);
    save();
    renderSettings();
    renderStateGrid();
    toast("已删除该状态词");
  }

  function addState(emoji, label, category) {
    data.states.push({ id: uid(), emoji: emoji || "🙂", label, category });
    save();
    renderSettings();
    renderStateGrid();
    toast(`已添加「${label}」`);
  }

  // ---------- 导入 / 导出 / 清空 ----------
  function exportData() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `work-mood-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast("数据已导出");
  }

  function importData(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!parsed || !Array.isArray(parsed.states) || !Array.isArray(parsed.logs)) {
          throw new Error("格式不对");
        }
        if (!Array.isArray(parsed.categories) || parsed.categories.length === 0) {
          parsed.categories = structuredClone(DEFAULT_CATEGORIES);
        }
        data = parsed;
        save();
        renderAll();
        toast("数据已导入");
      } catch (e) {
        toast("导入失败：文件格式不正确");
      }
    };
    reader.readAsText(file);
  }

  function resetAll() {
    if (!confirm("确定清空所有记录吗？此操作不可撤销。\n（状态词会保留）")) return;
    data.logs = [];
    save();
    renderAll();
    toast("已清空所有记录");
  }

  // ---------- 渲染调度 ----------
  function renderAll() {
    renderStateGrid();
    renderRecent();
    renderTimeline();
    renderStats();
    renderSettings();
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  // ---------- emoji 选择器 ----------
  const DEFAULT_EMOJI = "🙂";
  const EMOJI_OPTIONS = [
    "🙂","😀","😄","😍","🤩","😎","😌","😏","🥳","🤗",
    "😴","🥱","😐","😶","🙃","🤔","🧐","🤓","🫠","👀",
    "💪","🔥","✨","🚀","🎯","🏆","🎉","📚","✍️","💻",
    "⌨️","🐛","🧠","💡","☕","🍵","🍔","🍜","🚬","🛌",
    "🐱","🐈","🐶","🌱","🌧️","☀️","🌙","🌈","🪴","🫧",
    "😖","😩","😫","😭","😤","🤬","😡","😞","😔","😣",
    "🥵","🥶","🤯","💀","🆘","🙏","😮‍💨","🫣","📞","🗣️",
  ];
  let selectedEmoji = DEFAULT_EMOJI;

  function buildEmojiPopover() {
    const pop = $("#emojiPopover");
    pop.innerHTML = "";
    EMOJI_OPTIONS.forEach((emo) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "emoji-opt";
      b.textContent = emo;
      b.addEventListener("click", () => {
        selectedEmoji = emo;
        $("#etEmoji").textContent = emo;
        closeEmojiPopover();
      });
      pop.appendChild(b);
    });
  }

  function openEmojiPopover() {
    $("#emojiPopover").hidden = false;
    $("#emojiTrigger").setAttribute("aria-expanded", "true");
  }
  function closeEmojiPopover() {
    $("#emojiPopover").hidden = true;
    $("#emojiTrigger").setAttribute("aria-expanded", "false");
  }

  // ---------- 桌面端（菜单栏 popover / 完整窗口） ----------
  let isPopover = false;

  function setupDesktop() {
    if (!window.desktop) return;
    document.body.classList.add("is-desktop");
    const mode = location.hash.replace("#", "");
    if (mode === "full") {
      document.body.classList.add("full");
    } else {
      isPopover = true;
      document.body.classList.add("popover");
      activateLog();
    }
    if (window.desktop.onQuickRecord) {
      window.desktop.onQuickRecord(() => activateLog());
    }
  }

  function activateLog() {
    $$(".tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === "log"));
    $$(".view").forEach((v) => v.classList.toggle("active", v.id === "view-log"));
    requestPopoverResize();
  }

  // 弹出面板：随状态数量自适应高度（超过上限则内部滚动），避免只能看到固定几个
  function requestPopoverResize() {
    if (!isPopover || !window.desktop || !window.desktop.resize) return;
    requestAnimationFrame(() => {
      const head = $(".popover-head");
      const view = $("#view-log");
      if (!view) return;
      const h = Math.ceil(
        (head ? head.offsetHeight : 0) + view.scrollHeight + 24 /* content padding */ + 18 /* body padding */
      );
      window.desktop.resize(h);
    });
  }

  // ---------- 事件绑定 ----------
  function bind() {
    // tab 切换
    $$(".tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        const name = tab.dataset.tab;
        $$(".tab").forEach((t) => t.classList.toggle("active", t === tab));
        $$(".view").forEach((v) => v.classList.toggle("active", v.id === `view-${name}`));
        if (name === "timeline") renderTimeline();
        if (name === "stats") renderStats();
        if (name === "settings") renderSettings();
        if (name === "log") renderRecent();
      });
    });

    // 时间线翻天
    $("#prevDay").addEventListener("click", () => {
      const d = new Date(timelineDate);
      d.setDate(d.getDate() - 1);
      timelineDate = startOfDay(d);
      renderTimeline();
    });
    $("#nextDay").addEventListener("click", () => {
      if (sameDay(timelineDate, new Date())) return;
      const d = new Date(timelineDate);
      d.setDate(d.getDate() + 1);
      timelineDate = startOfDay(d);
      renderTimeline();
    });

    // 统计区间
    $$(".range-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        statRange = btn.dataset.range;
        $$(".range-btn").forEach((b) => b.classList.toggle("active", b === btn));
        renderStats();
      });
    });

    // emoji 选择器
    buildEmojiPopover();
    $("#emojiTrigger").addEventListener("click", (e) => {
      e.stopPropagation();
      if ($("#emojiPopover").hidden) openEmojiPopover();
      else closeEmojiPopover();
    });
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".emoji-field")) closeEmojiPopover();
    });

    // 添加状态
    $("#addForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const label = $("#newLabel").value.trim();
      if (!label) { toast("先给状态起个名字吧"); return; }
      if (categories().length === 0) { toast("先添加一个类型吧"); return; }
      addState(selectedEmoji, label, $("#newCategory").value);
      $("#newLabel").value = "";
      selectedEmoji = DEFAULT_EMOJI;
      $("#etEmoji").textContent = DEFAULT_EMOJI;
    });

    // 添加类型
    $("#catAddForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const name = $("#newCatName").value.trim();
      if (!name) { toast("先给类型起个名字吧"); return; }
      addCategory(name, $("#newCatColor").value);
      $("#newCatName").value = "";
    });

    // 数据管理
    $("#exportBtn").addEventListener("click", exportData);
    $("#importBtn").addEventListener("click", () => $("#importFile").click());
    $("#importFile").addEventListener("change", (e) => {
      if (e.target.files[0]) importData(e.target.files[0]);
      e.target.value = "";
    });
    $("#resetBtn").addEventListener("click", resetAll);

    // 弹出面板里的「详情」→ 打开完整窗口
    if (window.desktop) {
      $("#phMore").addEventListener("click", () => window.desktop.openFull());
    }
  }

  // ---------- 启动 ----------
  $("#todayLabel").textContent =
    new Date().toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "long" }) + " · 记录此刻";
  setupDesktop();
  bind();
  renderAll();
})();
