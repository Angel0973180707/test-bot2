// === 幸福智多星｜獨立測試版 ===

// 你的智多星 API（純 JSON array）
const API_URL = "https://script.google.com/macros/s/AKfycbw-UtoT79Q1FWlndVHxS0zM2TgVjUqdQQN1VHgxObZOOXuwPAaViY1XBU1Ac1rlpxc/exec";

let LIB = []; // 全部中控資料（陣列）

const $ = (id) => document.getElementById(id);

function setStatus(type, text) {
  const dot = $("statusDot");
  dot.classList.remove("ok", "warn");
  if (type === "ok") dot.classList.add("ok");
  if (type === "warn") dot.classList.add("warn");
  $("statusText").textContent = text;
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// 把 keywords 欄位切成 tokens（耐髒版）
function tokenizeKeywords(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return [];
  // 支援：全形/半形逗號、頓號、分號、斜線、豎線、換行、tab、多空白
  return s
    .replace(/[\u3001，,；;\/|]+/g, " ") // 、 ， , ; / |
    .replace(/\s+/g, " ")
    .split(" ")
    .map(t => t.trim())
    .filter(Boolean);
}

// 基礎 normalize（讓比較穩定）
function norm(s) {
  return String(s ?? "")
    .trim()
    .toLowerCase();
}

// 計分：命中 token 越多分越高；token 越長也加權；也支援「反向包含」
function scoreRow(query, row) {
  const q = norm(query);
  if (!q) return 0;

  const tokens = tokenizeKeywords(row.keywords);
  if (tokens.length === 0) return 0;

  let score = 0;
  for (const t of tokens) {
    const tn = norm(t);
    if (!tn) continue;

    // 例如 q="孩子吼叫" token="吼叫" -> 命中
    if (q.includes(tn)) score += 10 + Math.min(10, tn.length);

    // 例如 q="暴怒" token="亂發脾氣" 不命中；但 q 很短時可用反向包含補救
    if (tn.includes(q) && q.length >= 2) score += 6;
  }

  // 額外：若 topic/targetPage/toolName 有出現 query 也微加分
  const meta = [row.topic, row.targetPage, row.toolName].map(norm).join(" ");
  if (meta.includes(q)) score += 3;

  return score;
}

function bestMatch(query) {
  const scored = LIB
    .map(row => ({ row, score: scoreRow(query, row) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.length ? scored[0].row : null;
}

function buildWarm(query, row) {
  const key = tokenizeKeywords(row?.keywords)[0] || "這個狀況";
  return `我知道你很累了。你能走到這裡、願意把困擾說出來，就已經是在照顧關係了。
此刻先不用急著把自己變得更好，我們只要讓心「慢一點」，就很好。
我們就把「${escapeHtml(key)}」先放在桌上，一起看清楚它。`;
}

function buildBrain(row) {
  // 這段是通用版：符合你想要「理解原因」但不說教
  return `當你快要失控時，多半不是你不夠好，
而是大腦進入了「壓力保護模式」：杏仁核先拉警報，身體準備戰或逃，
前額葉（負責理性、抑制、選擇）就會暫時變得比較難上線。
所以你會覺得「明明知道不該吼，但就是煞不住」——這是生理機制，不是道德失敗。`;
}

function actionLink(url, label, icon) {
  const safeUrl = String(url ?? "").trim();
  if (!safeUrl) return "";
  return `
    <a class="actionLink" href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer">
      <span>${icon}</span><span>${escapeHtml(label)}</span>
    </a>
  `;
}

function renderResult(query, row) {
  const area = $("resultArea");

  if (!row) {
    area.innerHTML = `
      <div class="resultCard">
        <div class="sectionTitle">🌱 先陪你一下</div>
        <p class="p">我有收到你的提問：<b>${escapeHtml(query)}</b></p>
        <p class="p">目前資料庫裡還沒找到最貼近的匹配。</p>
        <p class="p muted">你可以試著換一句更口語的描述（例如「我快氣炸了」「孩子一直尖叫」），或把關鍵字再補進智多星中控臺 A 欄。</p>
      </div>
    `;
    return;
  }

  const pills = tokenizeKeywords(row.keywords)
    .slice(0, 10)
    .map(t => `<span class="pill">${escapeHtml(t)}</span>`)
    .join("");

  const actions = [
    actionLink(row.toolUrl, `取用工具：${row.toolName || "實踐工具"}`, "🚀"),
    actionLink(row.video1, "影片錦囊 1", "🎬"),
    actionLink(row.video2, "影片錦囊 2", "🎥")
  ].join("");

  area.innerHTML = `
    <div class="resultCard">
      <div class="sectionTitle">🫶 溫暖安撫</div>
      <p class="p">${buildWarm(query, row)}</p>

      <div class="sectionTitle">🧠 腦科學理解</div>
      <p class="p">${buildBrain(row)}</p>

      <div class="sectionTitle">🧰 推薦：影音館藏與實踐工具</div>
      <div class="actions">
        ${actions || `<span class="muted">（這筆資料目前沒有填工具/影片連結）</span>`}
      </div>

      <div class="sectionTitle">💡 智多星錦囊</div>
      <p class="p">${escapeHtml(row.guidance || "（尚未填寫智慧引導）")}</p>

      ${row.reflection ? `
        <div class="sectionTitle">🔍 思考引導</div>
        <p class="p">${escapeHtml(row.reflection)}</p>
      ` : ""}

      <div class="pills">
        ${pills}
      </div>

      <div class="muted" style="margin-top:10px;">
        相關主題：${escapeHtml(row.topic || "-")} ｜ 目標分頁：${escapeHtml(row.targetPage || "-")} ｜ 工具ID：${escapeHtml(row.toolId || "-")}
      </div>
    </div>
  `;
}

async function loadLibrary() {
  setStatus("warn", "載入中…");
  try {
    const res = await fetch(`${API_URL}?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const json = await res.json();
    if (!Array.isArray(json)) {
      throw new Error("API 回傳不是 JSON Array（請確認 GAS doGet 只回傳陣列）");
    }

    // 基本清理：去掉空白列
    LIB = json.filter(x => {
      const kw = String(x?.keywords ?? "").trim();
      const gd = String(x?.guidance ?? "").trim();
      return kw || gd;
    });

    setStatus("ok", `已載入 ${LIB.length} 筆智多星資料`);
    return true;
  } catch (err) {
    console.error(err);
    LIB = [];
    setStatus("warn", `載入失敗：${err.message}`);
    return false;
  }
}

function wireUI() {
  $("btnReload").addEventListener("click", async () => {
    await loadLibrary();
  });

  $("btnAsk").addEventListener("click", () => {
    const q = $("queryInput").value.trim();
    if (!q) return;
    const row = bestMatch(q);
    renderResult(q, row);
  });

  $("queryInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      $("btnAsk").click();
    }
  });
}

// init
(async function init() {
  wireUI();
  await loadLibrary();
})();