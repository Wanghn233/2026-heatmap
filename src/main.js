import { Solar } from "lunar-javascript";
import Sortable from "sortablejs";
import { calculateYunmaiMetrics } from "../lib/yunmai-metrics.js";
import "./style.css";
const app = document.querySelector("#app");

// Helper to format date (Local Time to avoid UTC shift bug)
const formatDate = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

// Lunar Helper
const getLunarStr = (dateStr) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  const solar = Solar.fromYmd(y, m, d);
  const lunar = solar.getLunar();
  const jieqi = lunar.getJieQi();
  return `${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}${jieqi ? " " + jieqi : ""}`;
};

// --- Data & State ---
// ... (rest of imports/state)

// Generate 2026 dates
const startDate = new Date("2026-01-01T00:00:00");
const endDate = new Date("2026-12-31T00:00:00");
const days = [];

let currentDate = new Date(startDate);
while (currentDate <= endDate) {
  days.push(new Date(currentDate));
  currentDate.setDate(currentDate.getDate() + 1);
}

// Group into chunks of 10
const CHUNK_SIZE = 10;
const chunks = [];
for (let i = 0; i < days.length; i += CHUNK_SIZE) {
  chunks.push(days.slice(i, i + CHUNK_SIZE));
}

const weekdayMap = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

const VIEWS = {
  memo: "memo",
  weight: "weight",
};

const WEIGHT_API_URL = "/api/weight";
const WEIGHT_USER_PROFILES = {
  user1: { birthDate: "2000-08-18", heightCm: 175, sex: "male" },
  user2: { birthDate: "2000-02-22", heightCm: 164, sex: "female" },
};
const WEIGHT_SERIES = [
  { id: "user1_morning", label: "大宝贝 · 早上", color: "#22d3ee" },
  { id: "user1_evening", label: "大宝贝 · 晚上", color: "#14b8a6" },
  { id: "user2_morning", label: "小宝贝 · 早上", color: "#f59e0b" },
  { id: "user2_evening", label: "小宝贝 · 晚上", color: "#ef4444" },
];
const savedView = localStorage.getItem("year_active_view");
let currentView = Object.values(VIEWS).includes(savedView)
  ? savedView
  : VIEWS.memo;
let weightRecords = [];
let weightActiveSeries = new Set(WEIGHT_SERIES.map((series) => series.id));
let expandedWeightRecordIds = new Set();
let weightLoading = false;
let weightError = "";

const renderMemoHeader = () => `
  <header>
    <img src="/logo.svg" alt="App Logo" class="app-logo" />
    <h1><span class="year-title" data-year="2026">2026</span> Heatmap</h1>
    <div class="subtitle">一年只是36个10天而已</div>
    <div id="offline-indicator" class="offline-badge hidden">📡 网络已断开 - 离线模式</div>
  </header>
`;

const renderWeightView = () => `
  <section id="weight-view" class="page-view ${currentView === VIEWS.weight ? "active" : ""}">
    <div class="weight-shell">
      <header class="feature-header">
        <h1>Weight🐷</h1>
        <p class="feature-copy">吃饱了才有力气减肥。</p>
      </header>
      <section class="weight-summary" id="weight-summary"></section>
      <section class="weight-card">
        <div class="section-head">
          <h2>折线图结构</h2>
          <span id="weight-sync-status" class="section-meta">等待同步</span>
        </div>
        <div id="weight-series-filters" class="weight-series-filters"></div>
        <div class="weight-chart-card">
          <div class="weight-chart-stage">
            <div class="weight-chart-axis">
              <span>晨起</span>
              <span>晚间</span>
            </div>
            <div id="weight-chart-empty" class="weight-chart-empty">暂无可绘制的数据</div>
            <div id="weight-chart-grid" class="weight-chart-grid"></div>
          </div>
        </div>
      </section>
      <section class="weight-card">
        <div class="section-head">
          <h2>最近记录</h2>
          <div class="section-head-actions">
            <span id="weight-count" class="section-meta"></span>
            <button type="button" id="weight-add-btn" class="section-action-btn">添加</button>
          </div>
        </div>
        <div id="weight-empty" class="empty-state hidden">还没有体重记录。</div>
        <div id="weight-list" class="weight-list"></div>
      </section>
    </div>
  </section>
`;

// Offline/Online Logic
const updateOnlineStatus = () => {
  const badge = document.getElementById("offline-indicator");
  if (badge) {
    if (navigator.onLine) {
      badge.classList.add("hidden");
    } else {
      badge.classList.remove("hidden");
    }
  }
};

// Listen globally
window.addEventListener("online", updateOnlineStatus);
window.addEventListener("offline", updateOnlineStatus);

// Also run once DOM is ready (triggered via timeout to ensure header is injected)
setTimeout(updateOnlineStatus, 100);

// Easter Egg: Logo Logic
setTimeout(() => {
  const logo = document.querySelector(".app-logo");
  let clickCount = 0;
  let resetTimer = null;

  if (logo) {
    logo.addEventListener("click", () => {
      clickCount++;

      // Clear existing reset timer
      if (resetTimer) clearTimeout(resetTimer);

      // Set new reset timer (reset count if no click within 500ms)
      resetTimer = setTimeout(() => {
        clickCount = 0;
      }, 500);

      if (clickCount >= 5) {
        // Spin!
        logo.classList.remove("logo-sway");
        logo.classList.add("logo-spin");
        clickCount = 0; // Reset immediately after trigger

        // Remove class after animation
        setTimeout(() => {
          logo.classList.remove("logo-spin");
        }, 800);
      } else {
        // Sway
        // Remove class strictly to re-trigger reflow if needed (though simple toggle works for single anims usually)
        logo.classList.remove("logo-sway");
        void logo.offsetWidth; // Trigger reflow
        logo.classList.add("logo-sway");

        setTimeout(() => {
          logo.classList.remove("logo-sway");
        }, 400);
      }
    });
  }
}, 0); // Run after innerHTML set

// Holidays Map (2026) - Comprehensive
const holidays = {
  // 元旦 (Jan 1-3)
  "2026-01-01": "元旦",
  "2026-01-02": "元旦",
  "2026-01-03": "元旦",
  // 春节 (Feb 15-23)
  "2026-02-15": "春节",
  "2026-02-16": "春节",
  "2026-02-17": "春节",
  "2026-02-18": "春节",
  "2026-02-19": "春节",
  "2026-02-20": "春节",
  "2026-02-21": "春节",
  "2026-02-22": "春节",
  "2026-02-23": "春节",
  // 清明 (Apr 4-6)
  "2026-04-04": "清明节",
  "2026-04-05": "清明节",
  "2026-04-06": "清明节",
  // 劳动节 (May 1-5)
  "2026-05-01": "劳动节",
  "2026-05-02": "劳动节",
  "2026-05-03": "劳动节",
  "2026-05-04": "劳动节",
  "2026-05-05": "劳动节",
  // 端午 (Jun 19-21)
  "2026-06-19": "端午节",
  "2026-06-20": "端午节",
  "2026-06-21": "端午节",
  // 中秋 (Sep 25-27)
  "2026-09-25": "中秋节",
  "2026-09-26": "中秋节",
  "2026-09-27": "中秋节",
  // 国庆 (Oct 1-7)
  "2026-10-01": "国庆节",
  "2026-10-02": "国庆节",
  "2026-10-03": "国庆节",
  "2026-10-04": "国庆节",
  "2026-10-05": "国庆节",
  "2026-10-06": "国庆节",
  "2026-10-07": "国庆节",
};

// Make-up Workdays (Shift days)
// These are weekends that are worked
const makeupWorkdays = [
  "2026-01-04", // Sun
  "2026-02-14", // Sat
  "2026-02-28", // Sat
  "2026-05-09", // Sat
  "2026-09-20", // Sun
  "2026-10-10", // Sat
];

// Render Grid
const renderRow = (chunk, index) => {
  const cells = chunk
    .map((date) => {
      // Default level is 0. Data will be filled by loadAllEvents() later.
      let level = 0;

      const dateStr = formatDate(date);
      const holidayName = holidays[dateStr];
      const isMakeup = makeupWorkdays.includes(dateStr);

      // Check for weekend (0 is Sunday, 6 is Saturday)
      const dayOfWeek = date.getDay();
      const weekdayStr = weekdayMap[dayOfWeek];
      // It is a display weekend ONLY if it is Sat/Sun AND NOT a makeup workday
      const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6) && !isMakeup;

      // Check for Today
      const now = new Date();
      const todayStr = formatDate(now);
      const isToday = dateStr === todayStr;

      // If it's a holiday, add data attribute
      const holidayAttr = holidayName ? `data-holiday="${holidayName}"` : "";
      // Weekend attribute
      const weekendAttr = isWeekend ? 'data-weekend="true"' : "";
      // Makeup attribute (for tooltip)
      const makeupAttr = isMakeup ? 'data-makeup="true"' : "";
      // Today attribute
      const todayAttr = isToday ? 'data-today="true"' : "";

      return `
      <div
        class="day-cell"
        data-date="${dateStr}"
        data-weekday="${weekdayStr}"
        data-level="${level}"
        ${holidayAttr}
        ${weekendAttr}
        ${makeupAttr}
        ${todayAttr}
      ></div>
    `;
    })
    .join("");

  // Pad the last row if needed to keep alignment (optional, but CSS flex handles it fine)
  // Let's just render what we have.

  return `
    <div class="decade-row">
      <div class="row-label">#${index + 1}</div>
      ${cells}
      <div class="row-spacer"></div>
    </div>
  `;
};

// Render Header Row (1-10)
const numbers = Array.from({ length: 10 }, (_, i) => i + 1);
const headerRow = `
  <div class="header-row">
    <div class="header-label"></div> <!-- Spacer for row labels -->
    ${numbers.map((n) => `<div class="col-num">${n}</div>`).join("")}
    <div class="row-spacer"></div>
  </div>
`;

const gridContent = chunks
  .map((chunk, index) => renderRow(chunk, index))
  .join("");

const heatmap = `
  <div class="heatmap-container">
    ${headerRow}
    ${gridContent}
  </div>
`;

// Render Legend
const legend = `
  <div class="legend">
    <span>Less</span>
    <div class="legend-item" style="background: var(--level-0)"></div>
    <div class="legend-item" style="background: var(--level-1)"></div>
    <div class="legend-item" style="background: var(--level-2)"></div>
    <div class="legend-item" style="background: var(--level-3)"></div>
    <div class="legend-item" style="background: var(--level-4)"></div>
    <span>More</span>
    <span style="margin-left: 12px; font-size: 10px; color: var(--holiday-color);">■ Holiday</span>
    <span style="margin-left: 8px; font-size: 10px; color: var(--weekend-color);">■ Weekend</span>
  </div>
`;

const renderAppShell = () => {
  const heatmapSection = document.querySelector("#heatmap-section");
  heatmapSection.innerHTML = `
    <div class="app-shell">
      <button id="menu-toggle" class="menu-toggle" type="button" aria-label="打开菜单" aria-expanded="false">
        <span></span>
        <span></span>
        <span></span>
      </button>
      <div id="app-drawer-overlay" class="app-drawer-overlay hidden"></div>
      <aside id="app-drawer" class="app-drawer" aria-hidden="true">
        <div class="drawer-header">
          <div>
            <div class="drawer-title">功能菜单</div>
            <div class="drawer-subtitle">当前主页是Heatmap</div>
          </div>
          <button id="drawer-close" class="drawer-close" type="button" aria-label="关闭菜单">&times;</button>
        </div>
        <nav class="drawer-nav">
          <button type="button" class="drawer-link ${currentView === VIEWS.memo ? "active" : ""}" data-view="${VIEWS.memo}">Heatmap</button>
          <button type="button" class="drawer-link ${currentView === VIEWS.weight ? "active" : ""}" data-view="${VIEWS.weight}">Weight</button>
        </nav>
      </aside>
      <section id="memo-view" class="page-view ${currentView === VIEWS.memo ? "active" : ""}">
        ${renderMemoHeader()}
        <div id="content-area">
          ${heatmap}
          ${legend}
        </div>
      </section>
      ${renderWeightView()}
    </div>
  `;
};

renderAppShell();

const menuToggleBtn = document.getElementById("menu-toggle");
const drawerCloseBtn = document.getElementById("drawer-close");
const drawerEl = document.getElementById("app-drawer");
const drawerOverlayEl = document.getElementById("app-drawer-overlay");
const pageViews = document.querySelectorAll(".page-view");
const drawerLinks = document.querySelectorAll(".drawer-link");

const setDrawerOpen = (isOpen) => {
  drawerEl.classList.toggle("open", isOpen);
  drawerOverlayEl.classList.toggle("hidden", !isOpen);
  menuToggleBtn.setAttribute("aria-expanded", String(isOpen));
  drawerEl.setAttribute("aria-hidden", String(!isOpen));
};

const switchView = (view) => {
  currentView = view;
  localStorage.setItem("year_active_view", view);
  pageViews.forEach((page) => {
    page.classList.toggle("active", page.id === `${view}-view`);
  });
  drawerLinks.forEach((link) => {
    link.classList.toggle("active", link.getAttribute("data-view") === view);
  });

  if (view !== VIEWS.memo) {
    hidePanelUI();
  }

  if (view === VIEWS.weight && authToken) {
    loadWeightRecords();
  }

  setDrawerOpen(false);
};

menuToggleBtn.addEventListener("click", () => {
  const isOpen = drawerEl.classList.contains("open");
  setDrawerOpen(!isOpen);
});

drawerCloseBtn.addEventListener("click", () => setDrawerOpen(false));
drawerOverlayEl.addEventListener("click", () => setDrawerOpen(false));
drawerLinks.forEach((link) => {
  link.addEventListener("click", () => {
    switchView(link.getAttribute("data-view"));
  });
});

const formatWeightDate = (dateStr) => {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-");
  return `${year}.${month}.${day}`;
};

const inferWeightUserId = (record) => {
  if (record.userId === "user1" || record.userId === "user2") {
    return record.userId;
  }

  return Number(record.weightKg) >= 65 ? "user1" : "user2";
};

const getWeightUserLabel = (record) =>
  inferWeightUserId(record) === "user1" ? "大宝贝" : "小宝贝";

const getWeightSourceMeta = (record) => {
  if (record.source === "manual_add") {
    return { label: "手动添加", className: "manual" };
  }

  if (record.source === "manual_edit") {
    return { label: "手动修改", className: "manual" };
  }

  return { label: "自动上报", className: "auto" };
};

const getWeightProfile = (record) =>
  inferWeightUserId(record) === "user1"
    ? WEIGHT_USER_PROFILES.user1
    : WEIGHT_USER_PROFILES.user2;

const getAgeFromBirthDate = (birthDate, measuredDate) => {
  const [birthYear, birthMonth, birthDay] = birthDate.split("-").map(Number);
  const [year, month, day] = measuredDate.split("-").map(Number);
  let age = year - birthYear;
  if (month < birthMonth || (month === birthMonth && day < birthDay)) {
    age -= 1;
  }
  return age;
};

const getWeightMetrics = (record) => {
  try {
    const profile = getWeightProfile(record);
    const age = getAgeFromBirthDate(profile.birthDate, record.measuredDate);
    return calculateYunmaiMetrics({
      weightKg: record.weightKg,
      impedance: record.impedance,
      age,
      heightCm: profile.heightCm,
      sex: profile.sex,
    });
  } catch (error) {
    return null;
  }
};

const inferWeightSeries = (record) => {
  const user = inferWeightUserId(record);
  const slot = record.timeSlot === "evening" ? "evening" : "morning";
  return `${user}_${slot}`;
};

const sortWeightRecords = (records) =>
  [...records].sort((a, b) => b.receivedAtMs - a.receivedAtMs);

const dedupeWeightSeriesRecords = (records) => {
  const sorted = sortWeightRecords(records);
  const seen = new Set();

  return sorted.filter((record) => {
    const key = `${record.seriesId}:${record.measuredDate}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const formatWeightTimestamp = (record) => {
  return `${formatWeightDate(record.receivedDate)} ${record.receivedTime}`;
};

const formatMeasuredTimestamp = (record) =>
  `${formatWeightDate(record.measuredDate)} ${record.measuredTime}`;

const setWeightStatus = (text) => {
  const statusEl = document.getElementById("weight-sync-status");
  if (statusEl) statusEl.textContent = text;
};

const normalizeWeightRecord = (record) => ({
  ...record,
  weightKg: Number(record.weightKg),
  impedance: record.impedance == null ? null : Number(record.impedance),
  receivedAtMs: Number(record.receivedAtMs),
  measuredAtMs: Number(record.measuredAtMs),
  userId: inferWeightUserId(record),
  seriesId: inferWeightSeries(record),
});

const upsertWeightRecord = (record) => {
  const normalized = normalizeWeightRecord(record);
  const next = weightRecords.filter((item) => item.id !== normalized.id);
  weightRecords = [normalized, ...next];
};

const removeWeightRecord = (recordId) => {
  weightRecords = weightRecords.filter((record) => record.id !== recordId);
};

const patchWeightRecord = async (recordId, payload) => {
  const res = await fetch(
    `${WEIGHT_API_URL}?id=${encodeURIComponent(recordId)}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(payload),
    },
  );

  if (!res.ok) {
    throw new Error(`Weight patch failed: ${res.status}`);
  }

  const data = await res.json();
  return normalizeWeightRecord(data.record);
};

const createWeightRecord = async (payload) => {
  const res = await fetch(WEIGHT_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`Weight create failed: ${res.status}`);
  }

  const data = await res.json();
  return normalizeWeightRecord(data.record);
};

const deleteWeightRecordRequest = async (recordId) => {
  const res = await fetch(
    `${WEIGHT_API_URL}?id=${encodeURIComponent(recordId)}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    },
  );

  if (!res.ok) {
    throw new Error(`Weight delete failed: ${res.status}`);
  }
};

const promptEditWeightRecord = async (recordId) => {
  const record = weightRecords.find((item) => item.id === recordId);
  if (!record) return;

  const weightValue = window.prompt("体重（kg）", String(record.weightKg));
  if (weightValue === null) return;

  const impedanceValue = window.prompt("阻抗（可留空）", record.impedance == null ? "" : String(record.impedance));
  if (impedanceValue === null) return;

  const measuredDateValue = window.prompt(
    "数据日期（YYYY-MM-DD）",
    record.measuredDate || "",
  );
  if (measuredDateValue === null) return;

  const measuredTimeValue = window.prompt(
    "数据时间（HH:mm 或 HH:mm:ss）",
    record.measuredTime || "08:00:00",
  );
  if (measuredTimeValue === null) return;

  try {
    setWeightStatus("保存中...");
    const updated = await patchWeightRecord(recordId, {
      id: recordId,
      weightKg: Number(weightValue),
      impedance: impedanceValue.trim() === "" ? null : Number(impedanceValue),
      measuredDate: measuredDateValue.trim(),
      measuredTime: measuredTimeValue.trim(),
    });
    upsertWeightRecord(updated);
    setWeightStatus("已保存");
    refreshWeightView();
  } catch (error) {
    console.warn("Failed to update weight record:", error);
    setWeightStatus("保存失败");
    window.alert("保存失败，请检查输入格式。");
  }
};

const promptCreateWeightRecord = async () => {
  const weightValue = window.prompt("体重（kg）", "");
  if (weightValue === null) return;

  const impedanceValue = window.prompt("阻抗（可留空）", "");
  if (impedanceValue === null) return;

  const now = new Date();
  const defaultDate = formatDate(now);
  const defaultTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:00`;

  const measuredDateValue = window.prompt("数据日期（YYYY-MM-DD）", defaultDate);
  if (measuredDateValue === null) return;

  const measuredTimeValue = window.prompt("数据时间（HH:mm 或 HH:mm:ss）", defaultTime);
  if (measuredTimeValue === null) return;

  try {
    setWeightStatus("添加中...");
    const created = await createWeightRecord({
      weightKg: Number(weightValue),
      impedance: impedanceValue.trim() === "" ? null : Number(impedanceValue),
      measuredDate: measuredDateValue.trim(),
      measuredTime: measuredTimeValue.trim(),
      source: "manual_add",
    });
    upsertWeightRecord(created);
    setWeightStatus("已添加");
    refreshWeightView();
  } catch (error) {
    console.warn("Failed to create weight record:", error);
    setWeightStatus("添加失败");
    window.alert("添加失败，请检查输入格式。");
  }
};

const handleDeleteWeightRecord = async (recordId) => {
  const record = weightRecords.find((item) => item.id === recordId);
  if (!record) return;
  const confirmed = window.confirm(
    `删除这条记录？\n${record.weightKg.toFixed(1)} kg\n数据时间：${formatMeasuredTimestamp(
      record,
    )}`,
  );
  if (!confirmed) return;

  try {
    setWeightStatus("删除中...");
    await deleteWeightRecordRequest(recordId);
    removeWeightRecord(recordId);
    setWeightStatus("已删除");
    refreshWeightView();
  } catch (error) {
    console.warn("Failed to delete weight record:", error);
    setWeightStatus("删除失败");
    window.alert("删除失败，请稍后再试。");
  }
};

const loadWeightRecords = async () => {
  if (!authToken) {
    weightRecords = [];
    weightError = "未登录";
    refreshWeightView();
    return;
  }

  weightLoading = true;
  weightError = "";
  setWeightStatus("同步中...");

  try {
    const res = await fetch(`${WEIGHT_API_URL}?limit=200`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    if (res.status === 401 || res.status === 403) {
      weightRecords = [];
      weightError = "鉴权失效";
      setWeightStatus("需要重新登录");
      return;
    }

    if (!res.ok) {
      throw new Error(`Weight fetch failed: ${res.status}`);
    }

    const data = await res.json();
    weightRecords = Array.isArray(data.records)
      ? data.records.map(normalizeWeightRecord)
      : [];
    setWeightStatus(`已同步 ${weightRecords.length} 条`);
  } catch (error) {
    console.warn("Failed to load weight records:", error);
    weightRecords = [];
    weightError = "同步失败";
    setWeightStatus("同步失败");
  } finally {
    weightLoading = false;
    refreshWeightView();
  }
};

const renderWeightSummary = () => {
  const summaryEl = document.getElementById("weight-summary");
  if (!summaryEl) return;

  const renderUserSummaryRow = (label, content, meta = "") => `
    <div class="summary-user-row">
      <div class="summary-user-label">${label}</div>
      <div class="summary-user-main">
        <div class="summary-user-value">${content}</div>
        ${meta ? `<div class="summary-user-meta">${meta}</div>` : ""}
      </div>
    </div>
  `;

  if (weightRecords.length === 0) {
    summaryEl.innerHTML = `
      <div class="summary-card">
        <div class="summary-label">最新体重</div>
        ${renderUserSummaryRow("大宝贝", "--")}
        ${renderUserSummaryRow("小宝贝", "--")}
      </div>
      <div class="summary-card">
        <div class="summary-label">变化</div>
        ${renderUserSummaryRow("大宝贝", "--")}
        ${renderUserSummaryRow("小宝贝", "--")}
      </div>
      <div class="summary-card">
        <div class="summary-label">累计记录</div>
        <div class="summary-value">0</div>
        <div class="summary-meta">${weightError || "等待服务端数据"}</div>
      </div>
    `;
    return;
  }

  const sorted = sortWeightRecords(weightRecords);
  const buildUserSummary = (userId) => {
    const userRecords = sorted.filter(
      (record) => inferWeightUserId(record) === userId,
    );
    const latest = userRecords[0];
    const previous = userRecords[1];
    const delta = previous
      ? (latest.weightKg - previous.weightKg).toFixed(1)
      : null;
    return {
      latest,
      previous,
      delta,
    };
  };

  const user1Summary = buildUserSummary("user1");
  const user2Summary = buildUserSummary("user2");

  summaryEl.innerHTML = `
    <div class="summary-card">
      <div class="summary-label">最新体重</div>
      ${renderUserSummaryRow(
        "大宝贝",
        user1Summary.latest
          ? `${user1Summary.latest.weightKg.toFixed(1)} <span>kg</span>`
          : "--",
        user1Summary.latest
          ? formatMeasuredTimestamp(user1Summary.latest)
          : "暂无记录",
      )}
      ${renderUserSummaryRow(
        "小宝贝",
        user2Summary.latest
          ? `${user2Summary.latest.weightKg.toFixed(1)} <span>kg</span>`
          : "--",
        user2Summary.latest
          ? formatMeasuredTimestamp(user2Summary.latest)
          : "暂无记录",
      )}
    </div>
    <div class="summary-card">
      <div class="summary-label">变化</div>
      ${renderUserSummaryRow(
        "大宝贝",
        user1Summary.previous
          ? `${user1Summary.delta > 0 ? "+" : ""}${user1Summary.delta} <span>kg</span>`
          : "--",
        user1Summary.previous
          ? `对比 ${formatMeasuredTimestamp(user1Summary.previous)}`
          : "暂无对比",
      )}
      ${renderUserSummaryRow(
        "小宝贝",
        user2Summary.previous
          ? `${user2Summary.delta > 0 ? "+" : ""}${user2Summary.delta} <span>kg</span>`
          : "--",
        user2Summary.previous
          ? `对比 ${formatMeasuredTimestamp(user2Summary.previous)}`
          : "暂无对比",
      )}
    </div>
    <div class="summary-card">
      <div class="summary-label">累计记录</div>
      <div class="summary-value">${weightRecords.length}</div>
      <div class="summary-meta">来自服务端接口</div>
    </div>
  `;
};

const renderWeightSeriesFilters = () => {
  const filtersEl = document.getElementById("weight-series-filters");
  if (!filtersEl) return;

  filtersEl.innerHTML = WEIGHT_SERIES.map(
    (series) => `
      <button
        type="button"
        class="series-filter ${weightActiveSeries.has(series.id) ? "active" : ""}"
        data-series-id="${series.id}"
        style="--series-color: ${series.color}"
      >
        <span class="series-dot"></span>
        ${series.label}
      </button>
    `,
  ).join("");
};

const renderWeightChartStructure = () => {
  const gridEl = document.getElementById("weight-chart-grid");
  const emptyEl = document.getElementById("weight-chart-empty");
  if (!gridEl || !emptyEl) return;

  const visibleSeries = WEIGHT_SERIES.filter((series) =>
    weightActiveSeries.has(series.id),
  ).map((series) => ({
    ...series,
    records: dedupeWeightSeriesRecords(
      weightRecords.filter((record) => record.seriesId === series.id),
    ).slice(0, 5),
  }));

  const hasAnyRecord = visibleSeries.some(
    (series) => series.records.length > 0,
  );
  emptyEl.classList.toggle("hidden", hasAnyRecord);

  gridEl.innerHTML = visibleSeries
    .map(
      (series) => `
        <div class="weight-grid-column">
          <div class="weight-grid-title">
            <span class="series-dot" style="background:${series.color}"></span>
            ${series.label}
          </div>
          <div class="weight-grid-values">
            ${
              series.records.length
                ? series.records
                    .map(
                      (record) => `
                        <div class="weight-grid-value">
                          <strong>${record.weightKg.toFixed(1)} kg</strong>
                          <span>${record.measuredDate || "--"} ${record.measuredTime || ""}</span>
                        </div>
                      `,
                    )
                    .join("")
                : `<div class="weight-grid-placeholder">暂无记录</div>`
            }
          </div>
        </div>
      `,
    )
    .join("");
};

const renderWeightList = () => {
  const listEl = document.getElementById("weight-list");
  const emptyEl = document.getElementById("weight-empty");
  const countEl = document.getElementById("weight-count");
  if (!listEl || !emptyEl || !countEl) return;

  const sorted = sortWeightRecords(weightRecords);
  countEl.textContent = `${sorted.length} 条`;
  emptyEl.classList.toggle("hidden", sorted.length > 0);

  listEl.innerHTML = sorted
    .map((record) => {
      const sourceMeta = getWeightSourceMeta(record);
      const userClass = inferWeightUserId(record);
      const expanded = expandedWeightRecordIds.has(record.id);
      const metrics = expanded ? getWeightMetrics(record) : null;
      const richMetricsHtml =
        metrics && metrics.fatPercent != null
          ? `
            <div class="weight-metric-item"><span>体脂</span><strong>${metrics.fatPercent}%</strong></div>
            <div class="weight-metric-item"><span>肌肉</span><strong>${metrics.musclePercent}%</strong></div>
            <div class="weight-metric-item"><span>水分</span><strong>${metrics.waterPercent}%</strong></div>
            <div class="weight-metric-item"><span>基础代谢</span><strong>${Math.trunc(metrics.bmr)}</strong></div>
            <div class="weight-metric-item"><span>脂肪</span><strong>${metrics.fatMassJin} 斤</strong></div>
          `
          : "";
      const detailsHtml =
        expanded && metrics
          ? `
            <div class="weight-record-details">
              <div class="weight-record-meta">接收时间 ${formatWeightTimestamp(record)} · ${
                record.timeSlot || "other"
              }</div>
              <div class="weight-metrics-grid">
                <div class="weight-metric-item"><span>BMI</span><strong>${metrics.bmi}</strong></div>
                <div class="weight-metric-item"><span>蛋白质</span><strong>${metrics.proteinPercent}%</strong></div>
                <div class="weight-metric-item"><span>身体年龄</span><strong>${metrics.somaAge}</strong></div>
                ${richMetricsHtml}
              </div>
              <div class="weight-record-actions">
                <button type="button" class="weight-action" data-action="edit" data-record-id="${record.id}">修改</button>
                <button type="button" class="weight-action weight-action-danger" data-action="delete" data-record-id="${record.id}">删除</button>
              </div>
            </div>
          `
          : "";
      return `
        <article class="weight-record ${userClass} ${expanded ? "expanded" : ""}">
          <button type="button" class="weight-record-trigger" data-action="toggle" data-record-id="${record.id}">
            <div class="weight-record-main">
              <span class="weight-source-tag ${sourceMeta.className}">${sourceMeta.label}</span>
              <div>
                <div class="weight-record-date">${formatMeasuredTimestamp(record)}</div>
                <div class="weight-record-note">${getWeightUserLabel(record)}</div>
              </div>
            </div>
            <div class="weight-record-side">
              <div class="weight-record-value">${record.weightKg.toFixed(1)} kg</div>
              <div class="weight-record-meta">${expanded ? "收起详情" : "展开详情"}</div>
            </div>
          </button>
          ${detailsHtml}
        </article>
      `;
    })
    .join("");
};

const refreshWeightView = () => {
  renderWeightSummary();
  renderWeightSeriesFilters();
  renderWeightChartStructure();
  renderWeightList();
};

const bindWeightView = () => {
  refreshWeightView();

  document.getElementById("weight-add-btn")?.addEventListener("click", async () => {
    await promptCreateWeightRecord();
  });

  document
    .getElementById("weight-series-filters")
    ?.addEventListener("click", (event) => {
      const button = event.target.closest(".series-filter");
      if (!button) return;

      const seriesId = button.getAttribute("data-series-id");
      if (!seriesId) return;

      if (weightActiveSeries.has(seriesId)) {
        if (weightActiveSeries.size === 1) return;
        weightActiveSeries.delete(seriesId);
      } else {
        weightActiveSeries.add(seriesId);
      }

      refreshWeightView();
    });

  document
    .getElementById("weight-list")
    ?.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-action]");
      if (!button) return;

      const recordId = button.getAttribute("data-record-id");
      const action = button.getAttribute("data-action");
      if (!recordId || !action) return;

      if (action === "toggle") {
        if (expandedWeightRecordIds.has(recordId)) {
          expandedWeightRecordIds.delete(recordId);
        } else {
          expandedWeightRecordIds.add(recordId);
        }
        renderWeightList();
        return;
      }

      if (action === "edit") {
        await promptEditWeightRecord(recordId);
        return;
      }

      if (action === "delete") {
        await handleDeleteWeightRecord(recordId);
      }
    });
};

bindWeightView();

const yearTitle = document.querySelector(".year-title");
if (yearTitle) {
  yearTitle.addEventListener("click", () => {
    const yearStr = yearTitle.getAttribute("data-year") || "2026";
    openYearPanel(yearStr);
  });
}

// --- Tooltip Logic ---
const tooltip = document.createElement("div");
// (Keep tooltip logic as is)
tooltip.id = "tooltip";
document.body.appendChild(tooltip);

const heatmapEl = document.querySelector(".heatmap-container");

// Use event delegation for better performance
heatmapEl.addEventListener("mouseover", (e) => {
  if (e.target.classList.contains("day-cell")) {
    const date = e.target.getAttribute("data-date");
    const weekday = e.target.getAttribute("data-weekday"); // Read weekday
    const level = e.target.getAttribute("data-level");
    const holiday = e.target.getAttribute("data-holiday");
    const makeup = e.target.getAttribute("data-makeup");

    // Build Tooltip Content
    let text = `<span style="font-weight:600">${date} ${weekday}</span>`;
    const lunar = getLunarStr(date);

    // Line 2: Lunar + Holiday
    text += `<br><span style="font-size:0.8em; opacity:0.7; color: var(--text-muted)">${lunar}`;
    if (holiday) {
      text += ` <strong style="color: #fbbf24; margin-left:4px">🎉 ${holiday}</strong>`;
    }
    text += `</span>`;

    if (makeup) {
      // Put makeup on first line or end? Let's keep separate or append to line 1.
      // Previous code appended to text, likely line 1. Let's append to line 1 for consistency or line 2?
      // Re-reading previous logic: makeup was appended before lunar.
      // Let's modify:
    }

    // Refined logic:
    // Line 1: Date Weekday [Makeup]
    // Line 2: Lunar [Holiday]

    let line1 = `<span style="font-weight:600">${date} ${weekday}</span>`;
    if (makeup)
      line1 += ` <span style="color: #ef4444; font-weight:bold;">(班)</span>`;

    let line2 = `<span style="font-size:0.8em; opacity:0.7; color: var(--text-muted)">${lunar}`;
    if (holiday)
      line2 += ` <strong style="color: #fbbf24; margin-left:4px; opacity:1">🎉 ${holiday}</strong>`;
    line2 += `</span>`;

    tooltip.innerHTML = line1 + "<br>" + line2;
    tooltip.style.opacity = "1";

    // Position slightly above the element
    const rect = e.target.getBoundingClientRect();
    // Center horizontally on the cell, sit above it
    tooltip.style.left = `${rect.left + rect.width / 2}px`;
    tooltip.style.top = `${rect.top}px`;
  }
});

heatmapEl.addEventListener("mouseout", (e) => {
  if (e.target.classList.contains("day-cell")) {
    tooltip.style.opacity = "0";
  }
});

// Data Store
let eventsData = {};
const GLOBAL_KEY = "year-2026";

// API Functions
const API_URL = "/api/events";
// (Functions moved to after Auth logic)

// --- Auth Logic ---
const authModal = document.getElementById("auth-modal");
const authInput = document.getElementById("auth-input");
const authBtn = document.getElementById("auth-btn");

let authToken = localStorage.getItem("year_app_token") || "";

const initApp = () => {
  if (authToken) {
    // We have a token, try to load data
    loadAllEvents();
    loadWeightRecords();
  } else {
    // No token, show lock screen
    authModal.classList.remove("hidden");
    setWeightStatus("等待登录");
  }
};

const handleLogin = () => {
  const pwd = authInput.value.trim();
  if (!pwd) return;

  // Save as token (Simple logic for now, in real app, maybe exchange for JWT)
  authToken = pwd;
  localStorage.setItem("year_app_token", authToken);

  // Unlock UI
  authModal.classList.add("hidden");

  // Load Data
  loadAllEvents();
  loadWeightRecords();
};

// Updated API Functions with Auth
const loadAllEvents = async (isSilent = false) => {
  // Creative Loading: Hide Heatmap, Animate Logo & Title
  const headerEl = document.querySelector("header");
  const dashboard = document.querySelector("#content-area");

  if (!isSilent) {
    if (headerEl) headerEl.classList.add("loading");
    if (dashboard) dashboard.classList.add("hidden-loading");
  }

  try {
    if (!isSilent) console.log("Fetching data...");
    const res = await fetch(API_URL, {
      headers: {
        Authorization: `Bearer ${authToken}`, // Send token
      },
    });

    if (res.status === 401 || res.status === 403) {
      // Token invalid
      console.warn("Auth failed");
      localStorage.removeItem("year_app_token");
      authToken = "";
      authModal.classList.remove("hidden");
      authInput.value = "";
      authInput.placeholder = "Wrong password, try again";
      return;
    }

    if (res.ok) {
      const cloudData = await res.json();
      eventsData = cloudData;
      Object.keys(eventsData).forEach((date) => {
        updateCellHeatmap(date);
      });

      // If panel is open, refresh the list safely
      if (getCurrentKey() && !document.querySelector(".edit-input:focus")) {
        // Only re-render if we are NOT currently editing a specific item (active element check)
        // But since we use innerHTML replacement, any focus would be lost anyway.
        // So the check `!document.querySelector('.edit-input:focus')` is crucial.
        // If user is editing, we skip list refresh to avoid interrupting them.
        // They will see updates next time they open panel or finish editing.
        if (
          document.activeElement.tagName !== "INPUT" &&
          document.activeElement.tagName !== "TEXTAREA"
        ) {
          renderEventsList();
        }
      }

      if (!isSilent) console.log("Data loaded");
    }
  } catch (err) {
    console.warn("Failed to fetch events:", err);
  } finally {
    // Stop Loading
    if (!isSilent) {
      if (headerEl) headerEl.classList.remove("loading");
      if (dashboard) dashboard.classList.remove("hidden-loading");
    }
  }
};

const saveEvents = async (dateStr) => {
  const events = eventsData[dateStr] || [];
  try {
    await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ date: dateStr, events }),
    });
    // Silent Sync after save to catch up with other devices
    loadAllEvents(true);
  } catch (err) {
    console.error("Save failed:", err);
  }
};

// Auto-Sync on Visibility Change (Tab Switch / App Switch)
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && authToken) {
    console.log("App resumed, syncing...");
    loadAllEvents(true);
  }
});

// DOM Elements (Panel)
const panelOverlay = document.getElementById("panel-overlay");
const eventPanel = document.getElementById("event-panel");
const panelDateTitle = document.getElementById("panel-date");

const todoListEl = document.getElementById("todo-list");
const doneListEl = document.getElementById("done-list");
const giveupListEl = document.getElementById("giveup-list");

const eventInput = document.getElementById("event-input");
const addTodoBtn = document.getElementById("add-todo-btn");
const addDoneBtn = document.getElementById("add-done-btn");
const closeBtn = document.getElementById("close-btn");
const eventListContainer = document.getElementById("event-list-container");

// --- SortableJS Init ---
const handleSort = (evt) => {
  const key = getCurrentKey();
  if (!key || !eventsData[key]) return;

  // Helper to extract IDs from a list container
  const getIds = (container) => {
    return Array.from(container.children).map((el) =>
      el.getAttribute("data-id"),
    );
  };

  // Get current state of all lists
  const todoIds = getIds(todoListEl);
  const doneIds = getIds(doneListEl);
  const giveupIds = getIds(giveupListEl);

  // Get existing Meta events (we don't render them but need to keep them)
  const currentEvents = eventsData[key];
  const metaEvents = currentEvents.filter((e) => e.status === "meta");

  // Reconstruct the master list
  // We need to map IDs back to full objects.
  // Optimization: Create a map for O(1) lookup
  const eventMap = new Map(currentEvents.map((e) => [String(e.id), e]));

  const newEvents = [];

  // Add Todos in new order
  todoIds.forEach((id) => {
    const evt = eventMap.get(id);
    if (evt) newEvents.push(evt);
  });

  // Add Dones in new order
  doneIds.forEach((id) => {
    const evt = eventMap.get(id);
    if (evt) newEvents.push(evt);
  });

  // Add Giveups in new order
  giveupIds.forEach((id) => {
    const evt = eventMap.get(id);
    if (evt) newEvents.push(evt);
  });

  // Add Meta back
  newEvents.push(...metaEvents);

  // Update Data
  eventsData[key] = newEvents;

  // Save
  saveEvents(key);
};

const sortableOptions = {
  animation: 150,
  delay: 200, // 200ms delay for "long press"
  delayOnTouchOnly: true, // Allow instant on desktop if preferred, but keeping delay to avoid conflict with edit
  // Actually, for "Click to Edit", we MUST have a delay or a handle.
  // If delayOnTouchOnly is true, desktop drag is instant.
  // Instant drag on desktop WILL conflict with "Click to Edit" (mousedown starts drag).
  // So we MUST force delay on desktop too, or use a handle.
  // User asked for "Long press", so delay is the way.
  delayOnTouchOnly: false,
  onEnd: handleSort,
};

Sortable.create(todoListEl, sortableOptions);
Sortable.create(doneListEl, sortableOptions);
Sortable.create(giveupListEl, sortableOptions);

// Listeners
authBtn.addEventListener("click", handleLogin);
authInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") handleLogin();
});

// Start
initApp();

let currentSelectedDate = null;
let currentMode = "date"; // "date" | "year"

const getCurrentKey = () => {
  if (currentMode === "year") return GLOBAL_KEY;
  return currentSelectedDate;
};

const isDateKey = (key) => /^\d{4}-\d{2}-\d{2}$/.test(key);

// Functions
const openPanel = (dateStr) => {
  currentMode = "date";
  currentSelectedDate = dateStr;
  renderEventsList();

  // Calculate meta info
  const dateObj = new Date(dateStr + "T00:00:00");
  const dayIndex = dateObj.getDay();
  const weekday = weekdayMap[dayIndex];
  const holiday = holidays[dateStr];
  const isMakeup = makeupWorkdays.includes(dateStr);
  const currentEmoji = getEmoji(dateStr);
  const lunar = getLunarStr(dateStr);

  let line1 = `<span style="margin-right:8px">${dateStr}</span><span style="font-size:0.85em; opacity:0.8">${weekday}</span>`;

  let line2 = `<span>${lunar}</span>`;

  if (holiday) {
    line2 += `<span style="font-size:0.9em; color:var(--holiday-color); margin-left:6px">🎉 ${holiday}</span>`;
  } else if (isMakeup) {
    line2 += `<span style="font-size:0.9em; color:#ef4444; margin-left:6px">班</span>`;
  }

  const headerHtml = `
    <div style="display:flex; align-items:center">
      <form action="javascript:void(0);" autocomplete="off" style="margin:0;">
        <input type="search" id="panel-emoji-input" maxlength="10" value="${currentEmoji}" placeholder="🫥" autocomplete="off" name="search_emoji" spellcheck="false">
      </form>
      <div style="display:flex; flex-direction:column; justify-content:center; align-items:flex-start; margin-left: 12px;">
        <div>${line1}</div>
        <div style="font-size:0.75em; color:var(--text-muted); line-height:1.2; margin-top:4px; display:flex; align-items:center">
          ${line2}
        </div>
      </div>
    </div>
  `;

  panelDateTitle.innerHTML = headerHtml;

  // Bind Emoji Input
  const emojiInput = document.getElementById("panel-emoji-input");

  // Real-time update
  emojiInput.addEventListener("input", (e) => {
    const val = e.target.value;
    setEmoji(dateStr, val);
    updateCellHeatmap(dateStr);
  });

  // Save on blur/enter
  emojiInput.addEventListener("change", () => {
    saveEvents(dateStr);
  });

  // Mobile Fix: Hide tooltip immediately when panel opens
  const tooltip = document.getElementById("tooltip");
  if (tooltip) tooltip.style.opacity = "0";

  panelOverlay.classList.remove("hidden");
  eventPanel.classList.remove("hidden");

  // Lock Body Scroll only on Mobile
  if (window.innerWidth < 800) {
    document.body.style.overflow = "hidden";
  }

  // Focus input on desktop
  if (window.innerWidth > 640) {
    setTimeout(() => eventInput.focus(), 100);
  }

  // Push history state so Back button closes panel
  window.history.pushState({ panel: "open" }, "");
};

const openYearPanel = (yearStr) => {
  currentMode = "year";
  currentSelectedDate = null;
  renderEventsList();

  const headerHtml = `
    <div style="display:flex; align-items:center">
      <div style="display:flex; flex-direction:column; justify-content:center; align-items:flex-start;">
        <div><span style="margin-right:8px">${yearStr}</span><span style="font-size:0.85em; opacity:0.8">年度计划</span></div>
        <div style="font-size:0.75em; color:var(--text-muted); line-height:1.2; margin-top:4px; display:flex; align-items:center">
        今年要做些什么事呢？
        </div>
      </div>
    </div>
  `;

  panelDateTitle.innerHTML = headerHtml;

  // Mobile Fix: Hide tooltip immediately when panel opens
  const tooltip = document.getElementById("tooltip");
  if (tooltip) tooltip.style.opacity = "0";

  panelOverlay.classList.remove("hidden");
  eventPanel.classList.remove("hidden");

  // Lock Body Scroll only on Mobile
  if (window.innerWidth < 800) {
    document.body.style.overflow = "hidden";
  }

  // Focus input on desktop
  if (window.innerWidth > 640) {
    setTimeout(() => eventInput.focus(), 100);
  }

  // Push history state so Back button closes panel
  window.history.pushState({ panel: "open" }, "");
};

const hidePanelUI = () => {
  panelOverlay.classList.add("hidden");
  eventPanel.classList.add("hidden");
  document.body.style.overflow = ""; // Always unlock on close
  // Don't clear currentSelectedDate immediately to avoid render glitches during transition
};

const closePanel = () => {
  if (eventPanel.classList.contains("hidden")) return;
  // Go back in history -> triggers popstate -> calls hidePanelUI
  window.history.back();
};

// Handle Back Button
window.addEventListener("popstate", () => {
  if (!eventPanel.classList.contains("hidden")) {
    hidePanelUI();
  }
});

// Emoji Helpers
const getEmoji = (date) => {
  const events = eventsData[date] || [];
  const meta = events.find((e) => e.status === "meta");
  return meta ? meta.text : "";
};

const setEmoji = (date, char) => {
  if (!eventsData[date]) eventsData[date] = [];

  // Remove existing meta
  const idx = eventsData[date].findIndex((e) => e.status === "meta");
  if (idx !== -1) eventsData[date].splice(idx, 1);

  // Add new if char exists
  if (char) {
    eventsData[date].push({
      id: "meta-emoji", // Fixed ID so we don't spam
      text: char,
      status: "meta",
    });
  }
};

const renderEventsList = () => {
  const key = getCurrentKey();
  if (!key) return;

  const events = eventsData[key] || [];

  // Clear lists
  todoListEl.innerHTML = "";
  doneListEl.innerHTML = "";
  giveupListEl.innerHTML = "";

  let todoCount = 0;
  let doneCount = 0;
  let giveupCount = 0;

  events.forEach((evt, idx) => {
    // idx for hard delete if needed, but we rely on ID for logic mainly
    // Skip Meta events (Emoji)
    if (evt.status === "meta") return;

    const item = document.createElement("div");
    item.className = `event-item ${evt.status}`;
    item.setAttribute("data-id", evt.id);
    // Show 'Recover' icon or empty checkbox for Giveup? Let's use same checkbox but styled differently in CSS
    item.innerHTML = `
      <div class="event-checkbox" data-id="${evt.id}" title="${evt.status === "giveup" ? "Restore to Todo" : "Toggle Done"}"></div>
      <span class="event-text" data-id="${evt.id}">${evt.text}</span>
      <span class="delete-event" data-idx="${idx}" title="${evt.status === "giveup" ? "Permanently Delete" : "Give Up"}">✕</span>
    `;

    if (evt.status === "done") {
      doneListEl.appendChild(item);
      doneCount++;
    } else if (evt.status === "giveup") {
      giveupListEl.appendChild(item);
      giveupCount++;
    } else {
      todoListEl.appendChild(item);
      todoCount++;
    }
  });

  // Toggle Section Visibility
  todoListEl.parentElement.style.display = todoCount > 0 ? "block" : "none";
  doneListEl.parentElement.style.display = doneCount > 0 ? "block" : "none";
  giveupListEl.parentElement.style.display = giveupCount > 0 ? "block" : "none";

  // Manage Empty State
  const existingMsg = eventListContainer.querySelector(".empty-state");
  if (existingMsg) existingMsg.remove();

  if (todoCount === 0 && doneCount === 0 && giveupCount === 0) {
    const msg = document.createElement("div");
    msg.className = "empty-state";
    msg.textContent = currentMode === "year" ? "全年无事." : "今日无事.";
    eventListContainer.appendChild(msg);
  }
};

const updateCellHeatmap = (dateStr) => {
  if (!isDateKey(dateStr)) return;
  const events = eventsData[dateStr] || [];
  // Only count DONE tasks for heat level
  const doneCount = events.filter((e) => e.status === "done").length;
  const todoCount = events.filter((e) => e.status === "todo").length;

  let level = 0;
  if (doneCount > 0) level = 1;
  if (doneCount >= 2) level = 2;
  if (doneCount >= 5) level = 3;
  if (doneCount >= 7) level = 4;

  const cell = document.querySelector(`.day-cell[data-date="${dateStr}"]`);
  if (cell) {
    cell.setAttribute("data-level", level);
    cell.setAttribute("data-has-todo", todoCount > 0 ? "true" : "false");

    // Render Emoji
    const emoji = getEmoji(dateStr);
    cell.innerHTML = emoji ? `<div class="cell-emoji">${emoji}</div>` : "";
  }
};

const addEvent = (status = "todo") => {
  // Accept status
  const text = eventInput.value.trim();
  const key = getCurrentKey();
  if (!text || !key) return;

  if (!eventsData[key]) {
    eventsData[key] = [];
  }

  eventsData[key].push({
    text,
    id: Date.now(),
    status: status, // Use passed status
  });

  eventInput.value = "";
  renderEventsList();
  updateCellHeatmap(key);
  saveEvents(key); // Cloud Save
};

const updateEventText = (id, newText) => {
  const key = getCurrentKey();
  if (!key || !eventsData[key]) return;

  const event = eventsData[key].find((e) => e.id == id);
  if (event) {
    event.text = newText;
    renderEventsList();
    saveEvents(key);
  }
};

const deleteEvent = (idx) => {
  const key = getCurrentKey();
  if (!key || !eventsData[key]) return;

  const evt = eventsData[key][idx];

  if (evt.status === "giveup") {
    // Hard Delete
    eventsData[key].splice(idx, 1);
  } else {
    // Soft Delete -> Give Up
    evt.status = "giveup";
  }

  renderEventsList();
  updateCellHeatmap(key);
  saveEvents(key); // Cloud Save
};

// Toggle: Todo <-> Done.
// Giveup -> Todo (Restore)
const toggleEventStatus = (id) => {
  const key = getCurrentKey();
  if (!key || !eventsData[key]) return;

  const event = eventsData[key].find((e) => e.id == id);
  if (event) {
    if (event.status === "giveup") {
      event.status = "todo"; // Restore
    } else {
      event.status = event.status === "done" ? "todo" : "done";
    }
    renderEventsList();
    updateCellHeatmap(key);
    saveEvents(key); // Cloud Save
  }
};

// Listeners
heatmapEl.addEventListener("click", (e) => {
  const cell = e.target.closest(".day-cell");
  if (cell) {
    const date = cell.getAttribute("data-date");
    openPanel(date);
  }
});

closeBtn.addEventListener("click", closePanel);
panelOverlay.addEventListener("click", closePanel);

// Bind Dual Buttons
addTodoBtn.addEventListener("click", () => addEvent("todo"));
addDoneBtn.addEventListener("click", () => addEvent("done"));

eventInput.addEventListener("keydown", (e) => {
  // Enter = Todo, Ctrl+Enter = Done
  if (e.key === "Enter") {
    if (e.metaKey || e.ctrlKey) {
      addEvent("done");
    } else {
      addEvent("todo");
    }
  }
});

// Delegation for Delete and Toggle
const handleListClick = (e) => {
  // Handle Delete / Give Up Button
  if (e.target.classList.contains("delete-event")) {
    const idx = parseInt(e.target.getAttribute("data-idx"));
    deleteEvent(idx);
    return;
  }

  // Handle Checkbox Toggle
  if (e.target.classList.contains("event-checkbox")) {
    const id = e.target.getAttribute("data-id");
    toggleEventStatus(id);
    return;
  }

  // Handle Text Edit
  if (e.target.classList.contains("event-text")) {
    const id = e.target.getAttribute("data-id");
    const currentText = e.target.textContent;

    // Create Input
    const input = document.createElement("input");
    input.type = "search";
    input.setAttribute("autocomplete", "off");
    input.setAttribute("spellcheck", "false");
    input.value = currentText;
    input.className = "edit-input";

    // Replace span with input
    e.target.replaceWith(input);
    input.focus();

    // Handler for saving
    const save = () => {
      const val = input.value.trim();
      if (val && val !== currentText) {
        updateEventText(id, val);
      } else {
        // Revert if empty or same
        renderEventsList();
      }
    };

    input.addEventListener("blur", save);
    input.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        input.blur(); // Trigger save
      }
    });

    return;
  }

  // Optional: Click text to toggle too?
  /*
  const item = e.target.closest('.event-item')
  if (item && !e.target.classList.contains('delete-event')) {
      const checkbox = item.querySelector('.event-checkbox')
      toggleEventStatus(checkbox.getAttribute('data-id'))
  }
  */
};

todoListEl.addEventListener("click", handleListClick);
doneListEl.addEventListener("click", handleListClick);
giveupListEl.addEventListener("click", handleListClick);

// Close on Esc
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (drawerEl.classList.contains("open")) {
    setDrawerOpen(false);
    return;
  }
  closePanel();
});

// --- Global UX Enhancements ---
// Disable Context Menu (Right-Click) except on inputs
document.addEventListener(
  "contextmenu",
  (e) => {
    // Allow if target is input or textarea, or contenteditable
    if (
      e.target.tagName === "INPUT" ||
      e.target.tagName === "TEXTAREA" ||
      e.target.isContentEditable
    ) {
      return true;
    }
    e.preventDefault();
    return false;
  },
  { passive: false },
);

// Disable Pinch Zoom (iOS Safari)
document.addEventListener("gesturestart", (e) => {
  e.preventDefault();
});

// --- Fix: Prevent Browser Scroll Restoration ---
// Browsers often restore scroll position on reload (even pull-to-refresh).
// This forces the page to start at the top every time.
if ("scrollRestoration" in history) {
  history.scrollRestoration = "manual";
}
// Ensure we are at top
window.scrollTo(0, 0);
