/* 幸福智多星｜智慧搜索（測試版）
   - 先安撫（心靈）
   - 再理解（腦科學）
   - 最後推薦（影片/工具）
   - 資料來源：Google Sheets GAS JSON API（你提供的網址）
*/

const API_URL = "https://script.google.com/macros/s/AKfycbzeuQFds9g_H5_Wa7CIYSQs5k2KHBdDG45zPNNJF74xPfYU9NkSYXLBSKDZzcCWjaF3OA/exec";

const els = {
  queryInput: document.getElementById("queryInput"),
  btnSearch: document.getElementById("btnSearch"),
  btnRefresh: document.getElementById("btnRefresh"),
  libStatus: document.getElementById("libStatus"),
  matchStatus: document.getElementById("matchStatus"),
  resultArea: document.getElementById("resultArea"),
  emptyArea: document.getElementById("emptyArea"),
  soulText: document.getElementById("soulText"),
  brainText: document.getElementById("brainText"),
  thinkText: document.getElementById("thinkText"),
  recoArea: document.getElementById("recoArea"),
  btnTryExamples: document.getElementById("btnTryExamples"),
};

let LIB = {
  rows: [],
  loadedAt: null,
};

init();

function init(){
  els.btnSearch.addEventListener("click", onSearch);
  els.queryInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") onSearch();
  });
  els.btnRefresh.addEventListener("click", async () => {
    await loadLibrary(true);
  });
  els.btnTryExamples.addEventListener("click", () => {
    const examples = [
      "我忍不住對孩子發火",
      "孩子一直尖叫，我快崩潰",
      "每天都在吵，心很累",
      "孩子回嘴，我好生氣",
      "我一直吼，停不下來",
    ];
    els.queryInput.value = examples[Math.floor(Math.random() * examples.length)];
    els.queryInput.focus();
  });

  // 初次載入
  loadLibrary(false);

  // 註冊 SW
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(()=>{});
  }

  // 手機下拉更新（簡化版）
  setupPullToRefresh();
}

async function loadLibrary(force){
  try{
    setLibStatus("館藏：載入中…");
    els.btnRefresh.disabled = true;

    if (!force && LIB.rows.length) {
      setLibStatus(`館藏：已載入 ${LIB.rows.length} 筆`);
      els.btnRefresh.disabled = false;
      return;
    }

    const url = `${API_URL}?t=${Date.now()}`;
    const res = await fetch(url, { cache: "no-store" });
    const json = await res.json();

    const rows = normalizeApiToRows(json);
    LIB.rows = rows;
    LIB.loadedAt = new Date();

    setLibStatus(`館藏：已載入 ${rows.length} 筆`);
  }catch(err){
    console.error(err);
    setLibStatus("館藏：載入失敗（請確認 API 可用）");
  }finally{
    els.btnRefresh.disabled = false;
  }
}

/** 嘗試把任何 GAS JSON 形狀轉成「列陣列」 */
function normalizeApiToRows(json){
  // 1) 直接就是 array
  if (Array.isArray(json)) return json.map(cleanRow);

  // 2) 常見：{ data: [...] } / { rows: [...] } / { records: [...] }
  const candidates = ["data","rows","records","items","library","result"];
  for (const k of candidates){
    if (Array.isArray(json?.[k])) return json[k].map(cleanRow);
  }

  // 3) 多工作表：{ sheetName1:[...], sheetName2:[...] }
  //   → 把所有 array 合併後，再讓 matching 找出具有「關鍵字/智慧引導」的列
  const merged = [];
  if (json && typeof json === "object"){
    for (const [k,v] of Object.entries(json)){
      if (Array.isArray(v)) merged.push(...v);
      if (v && typeof v === "object"){
        for (const vv of Object.values(v)){
          if (Array.isArray(vv)) merged.push(...vv);
        }
      }
    }
  }
  return merged.map(cleanRow);
}

/** 清理欄位：trim key + string 值 */
function cleanRow(row){
  if (!row || typeof row !== "object") return row;
  const out = {};
  for (const [k,v] of Object.entries(row)){
    const kk = String(k).trim();
    out[kk] = (typeof v === "string") ? v.trim() : v;
  }
  return out;
}

function setLibStatus(text){
  els.libStatus.textContent = text;
}

function setMatchStatus(text){
  els.matchStatus.textContent = text;
}

async function onSearch(){
  const q = (els.queryInput.value || "").trim();
  if (!q) {
    els.queryInput.focus();
    setMatchStatus("請先輸入一句描述");
    return;
  }

  if (!LIB.rows.length) await loadLibrary(true);

  setMatchStatus("匹配中…");

  const best = happinessMastermind(q, LIB.rows);

  if (!best.length) {
    showEmpty();
    setMatchStatus("未找到明確匹配");
    return;
  }

  renderResult(q, best);
  setMatchStatus(`找到 ${best.length} 筆匹配`);
}

/** 核心：幸福智多星匹配（依你白皮書：關鍵字比對 + 自動分流） */
function happinessMastermind(userQuery, allRows){
  const q = normalizeText(userQuery);

  // 先找出像「智多星中控臺」的列（具有：關鍵字、智慧引導…）
  const mastermindRows = allRows.filter(r =>
    hasAnyKey(r, ["關鍵字","智慧引導","工具錦囊","影片錦囊1","影片錦囊2","思考引導"])
  );

  const pool = mastermindRows.length ? mastermindRows : allRows;

  // 計分
  const scored = pool.map(r => {
    const keywordsRaw = getAny(r, ["關鍵字","keywords","keyword","KeyWords"]);
    const titleRaw = getAny(r, ["標題","title","主題","相關主題"]);
    const guideRaw = getAny(r, ["智慧引導","核心理念","引導","內容"]);

    const keywords = splitKeywords(keywordsRaw);
    let score = 0;

    // 1) 關鍵字包含
    for (const kw of keywords){
      const nkw = normalizeText(kw);
      if (!nkw) continue;
      if (q.includes(nkw)) score += 3;
      else if (nkw.includes(q) && q.length >= 2) score += 1;
      else score += overlapScore(q, nkw);
    }

    // 2) 標題/內容弱匹配（加一點點）
    const t = normalizeText(String(titleRaw || ""));
    const g = normalizeText(String(guideRaw || ""));
    if (t && q && (t.includes(q) || q.includes(t))) score += 1;
    if (g && q && g.includes(q)) score += 1;

    return { row: r, score };
  });

  scored.sort((a,b) => b.score - a.score);

  // 取前 3 筆且 score>0
  return scored.filter(x => x.score > 0).slice(0, 3).map(x => x.row);
}

function renderResult(query, rows){
  els.emptyArea.hidden = true;
  els.resultArea.hidden = false;

  // 用第一筆做主要輸出（安撫 + 腦科學），其他筆放推薦卡
  const main = rows[0];

  const guide = String(getAny(main, ["智慧引導","核心理念","引導","內容"]) || "");
  const { soul, brain } = splitSoulBrain(guide, query);

  els.soulText.innerHTML = toParagraphs(soul || defaultSoul(query));
  els.brainText.innerHTML = toParagraphs(brain || defaultBrain(query));

  // 思考引導：優先取第一筆；若空就合併其他
  const think = rows.map(r => String(getAny(r, ["思考引導","課題分離提問","提問"]) || ""))
                    .filter(Boolean)
                    .join("\n\n");
  els.thinkText.innerHTML = toParagraphs(think || defaultThink(query));

  // 推薦區
  els.recoArea.innerHTML = "";
  for (const r of rows){
    els.recoArea.appendChild(buildRecoCard(r));
  }
}

function showEmpty(){
  els.resultArea.hidden = true;
  els.emptyArea.hidden = false;
}

function buildRecoCard(r){
  const wrap = document.createElement("div");
  wrap.className = "recoCard";

  const topic = String(getAny(r, ["相關主題","主題","topic","C欄"]) || "");
  const hall = String(getAny(r, ["目標分頁","展示廳","展廳","D欄"]) || "");
  const toolCode = String(getAny(r, ["推薦工具編號","工具編號","E欄"]) || "");
  const toolName = String(getAny(r, ["工具名稱","F欄"]) || "");
  const toolUrl  = String(getAny(r, ["工具錦囊","工具網址","G欄"]) || "");
  const v1 = String(getAny(r, ["影片錦囊1","影片連結1","H欄"]) || "");
  const v2 = String(getAny(r, ["影片錦囊2","影片連結2","I欄"]) || "");

  const head = document.createElement("div");
  head.className = "recoHead";

  const left = document.createElement("div");
  left.innerHTML = `
    <div class="recoTitle">${escapeHtml(topic || "推薦內容")}</div>
    <div class="recoMeta">
      ${hall ? `目標分頁：${escapeHtml(hall)}｜` : ""}
      ${toolCode ? `工具編號：${escapeHtml(toolCode)}` : "工具編號：—"}
    </div>
  `;

  head.appendChild(left);
  wrap.appendChild(head);

  // 影片縮圖（取 v1 優先）
  const videoId = extractYouTubeId(v1) || extractYouTubeId(v2);
  if (videoId){
    const thumb = document.createElement("div");
    thumb.className = "thumb";
    thumb.innerHTML = `<img alt="YouTube thumbnail" src="https://img.youtube.com/vi/${videoId}/hqdefault.jpg">`;
    wrap.appendChild(thumb);
  }

  const btnRow = document.createElement("div");
  btnRow.className = "btnRow";

  if (toolUrl){
    btnRow.appendChild(linkButton("🚀 取用工具", toolUrl, toolName ? `${toolName}` : ""));
  } else {
    btnRow.appendChild(disabledPill("🚀 工具尚未提供連結"));
  }

  if (v1) btnRow.appendChild(linkButton("🎬 影片 1", v1));
  if (v2) btnRow.appendChild(linkButton("🎬 影片 2", v2));

  wrap.appendChild(btnRow);

  return wrap;
}

function linkButton(label, url, title){
  const a = document.createElement("a");
  a.className = "linkBtn";
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.textContent = label;
  if (title) a.title = title;
  return a;
}

function disabledPill(text){
  const s = document.createElement("span");
  s.className = "pill";
  s.textContent = text;
  return s;
}

/* ---------- helpers ---------- */

function normalizeText(s){
  return String(s || "")
    .toLowerCase()
    .replace(/[，。！？；：、,.!?;:\(\)\[\]{}"“”'‘’]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitKeywords(raw){
  if (!raw) return [];
  return String(raw)
    .replace(/\n/g, " ")
    .split(/[\s、，,|｜/]+/g)
    .map(x => x.trim())
    .filter(Boolean);
}

function overlapScore(a, b){
  // 很輕量的相似度：共同字元數（避免過度複雜）
  if (!a || !b) return 0;
  const sa = new Set(a.split(""));
  const sb = new Set(b.split(""));
  let inter = 0;
  for (const ch of sa) if (sb.has(ch)) inter++;
  if (inter >= 3) return 0.6;
  if (inter === 2) return 0.3;
  return 0;
}

function hasAnyKey(obj, keys){
  return keys.some(k => Object.prototype.hasOwnProperty.call(obj, k));
}

function getAny(obj, keys){
  for (const k of keys){
    if (obj && Object.prototype.hasOwnProperty.call(obj, k)) return obj[k];
  }
  return "";
}

function toParagraphs(text){
  const blocks = String(text || "").split(/\n{2,}/g).map(s => s.trim()).filter(Boolean);
  return blocks.map(b => `<p>${escapeHtml(b)}</p>`).join("");
}

function escapeHtml(str){
  return String(str || "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function splitSoulBrain(guideText, query){
  const t = String(guideText || "").trim();
  if (!t) return { soul:"", brain:"" };

  // 常見：用 💡、科學、杏仁核、前額葉 作為切點
  const cutMarks = ["💡","科學","腦","杏仁核","前額葉","PFC"];
  let cutIndex = -1;
  for (const m of cutMarks){
    const idx = t.indexOf(m);
    if (idx !== -1) { cutIndex = idx; break; }
  }

  if (cutIndex <= 0){
    // 如果整段都混在一起：先抽出「帶腦詞」的句子當 brain
    const sentences = t.split(/(?<=[。！？\n])/g).map(s=>s.trim()).filter(Boolean);
    const brainTerms = ["杏仁核","前額葉","PFC","壓力","交感","皮質醇","多巴胺","神經","戰或逃"];
    const brainParts = [];
    const soulParts = [];
    for (const s of sentences){
      if (brainTerms.some(w => s.includes(w))) brainParts.push(s);
      else soulParts.push(s);
    }
    return {
      soul: soulParts.join("\n\n") || defaultSoul(query),
      brain: brainParts.join("\n\n") || defaultBrain(query),
    };
  }

  const soul = t.slice(0, cutIndex).trim();
  const brain = t.slice(cutIndex).trim();
  return { soul, brain };
}

function defaultSoul(query){
  return `你願意停下來問這一句，就已經很不容易了。\n\n先不用急著把自己做得更好，先讓心有一點點空間。\n\n你不是壞，你只是太累、太撐，反應跑得比理性快。`;
}

function defaultBrain(query){
  return `當我們在壓力下，大腦會優先啟動「保命模式」：警報系統（像杏仁核）變得很敏感，理性與剎車（前額葉）就比較慢跟上。\n\n所以你會覺得「我知道不該吼，但就是停不下來」——這不是你沒修養，而是大腦在高壓下的正常現象。\n\n先把警報降下來，前額葉才回得來，溝通才會有效。`;
}

function defaultThink(query){
  return `（課題分離）\n1) 這件事裡，哪一段是「我的課題」？哪一段是「孩子的課題」？\n2) 我此刻最想守住的，是界線？尊重？安全感？\n3) 我能做的「下一小步」是什麼？（小到今天就做得到）`;
}

function extractYouTubeId(url){
  if (!url) return "";
  const s = String(url);

  // youtu.be/VIDEOID
  const m1 = s.match(/youtu\.be\/([a-zA-Z0-9_-]{6,})/);
  if (m1) return m1[1];

  // youtube.com/watch?v=VIDEOID
  const m2 = s.match(/[?&]v=([a-zA-Z0-9_-]{6,})/);
  if (m2) return m2[1];

  // youtube.com/shorts/VIDEOID
  const m3 = s.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{6,})/);
  if (m3) return m3[1];

  // youtube.com/embed/VIDEOID
  const m4 = s.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{6,})/);
  if (m4) return m4[1];

  return "";
}

function setupPullToRefresh(){
  let startY = 0;
  let pulling = false;

  window.addEventListener("touchstart", (e) => {
    if (window.scrollY !== 0) return;
    startY = e.touches[0].clientY;
    pulling = true;
  }, { passive:true });

  window.addEventListener("touchmove", (e) => {
    if (!pulling) return;
    const y = e.touches[0].clientY;
    const dy = y - startY;
    if (dy > 90) {
      pulling = false;
      loadLibrary(true);
      setMatchStatus("已下拉更新館藏");
    }
  }, { passive:true });

  window.addEventListener("touchend", () => {
    pulling = false;
  }, { passive:true });
    }
