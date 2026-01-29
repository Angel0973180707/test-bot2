// === 你的智多星 API（只連這支） ===
const API_URL =
  "https://script.google.com/macros/s/AKfycbw-UtoT79Q1FWlndVHxS0zM2TgVjUqdQQN1VHgxObZOOXuwPAaViY1XBU1Ac1rlpxc/exec";

// === 停用詞（不影響意義） ===
const STOP_WORDS = [
  "我的","我們","你","我","孩子","小孩","最近","常常","一直",
  "覺得","好像","真的","現在","我家","他","她"
];

// === 進階切詞 ===
function tokenizeSmart(text) {
  return text
    .toLowerCase()
    .replace(/[^\u4e00-\u9fa5a-z0-9]/gi, " ")
    .split(/\s+/)
    .filter(w => w.length >= 2 && !STOP_WORDS.includes(w));
}

// === 拆 A 欄關鍵字 ===
function parseKeywords(cell) {
  if (!cell) return [];
  return cell
    .toLowerCase()
    .split(/[、,，\n；;\/]+/)
    .map(k => k.trim())
    .filter(Boolean);
}

// === 核心理解＋加權匹配 ===
function matchSmart(data, userInput) {
  const tokens = tokenizeSmart(userInput);

  return data
    .map(item => {
      let score = 0;
      const keys = parseKeywords(item.keywords);

      tokens.forEach(t => {
        keys.forEach(k => {
          if (t === k) score += 3;
          else if (t.includes(k)) score += 2;
          else if (k.includes(t)) score += 1;
        });
      });

      return { ...item, score };
    })
    .filter(i => i.score > 0)
    .sort((a, b) => b.score - a.score);
}

/* =========================================================
   情緒主題分流（陪伴版）
   - warm  : 累/委屈/想哭/心酸
   - steady: 焦/氣/吼/衝突/失控
   - night : 深夜/孤單/低落/睡不著
========================================================= */

const MOOD_WORDS = {
  warm: ["很累","累","撐不下去","委屈","想哭","心酸","難過","無力","崩潰","疲憊","壓力好大"],
  steady: ["生氣","暴怒","發火","吼","失控","忍不住","氣炸","煩躁","焦慮","吵架","衝突","頂嘴"],
  night: ["深夜","晚上","睡不著","失眠","孤單","低落","想太多","胸悶","心慌","害怕","夜裡"]
};

function detectMood(text){
  const t = (text || "").trim();
  if (!t) return "steady";

  let scoreWarm = 0, scoreSteady = 0, scoreNight = 0;

  MOOD_WORDS.warm.forEach(w => { if (t.includes(w)) scoreWarm += 2; });
  MOOD_WORDS.steady.forEach(w => { if (t.includes(w)) scoreSteady += 2; });
  MOOD_WORDS.night.forEach(w => { if (t.includes(w)) scoreNight += 2; });

  // 小加權：如果含有「我真的很累」類型，暖加分
  if (t.includes("我真的") && (t.includes("累") || t.includes("撐"))) scoreWarm += 1;

  const max = Math.max(scoreWarm, scoreSteady, scoreNight);

  if (max === 0) return "steady";
  if (max === scoreNight) return "night";
  if (max === scoreWarm) return "warm";
  return "steady";
}

function applyTheme(mood){
  const body = document.body;
  body.classList.remove("theme-warm","theme-steady","theme-night");
  body.classList.add(`theme-${mood}`);
}

// === 結果渲染（維持原本三段輸出） ===
function renderResult(matches, userInput) {
  const box = document.getElementById("result");
  box.innerHTML = "";

  // 🌧 找不到 → 溫柔陪伴（依情緒調整一句話）
  if (matches.length === 0) {
    const mood = detectMood(userInput);
    const firstLine =
      mood === "night" ? "你沒有吵到誰，夜裡更需要被接住。" :
      mood === "warm"  ? "你已經很努力了，累不是你的錯。" :
                         "先停一下也可以，我們先把心站穩。";

    box.innerHTML = `
      <div class="card">
        <h3>🌧 先坐一下也沒關係</h3>
        <p>${firstLine}</p>
        <p>你說的不像是一個問題，<br>而是一種撐很久的感覺。</p>
        <p>👉 你可以先試試：<br>🧘 安住 30 秒的陪伴練習</p>
      </div>
    `;
    return;
  }

  const best = matches[0];

  // 🧠 依 score 調整語氣
  let intro = "";
  if (best.score >= 3) intro = "你已經很清楚自己在困擾什麼，我們可以慢慢往前走。";
  else if (best.score === 2) intro = "我聽見你的擔心，先一起釐清發生了什麼。";
  else intro = "先不用急著解決，照顧你現在的感受比較重要。";

  box.innerHTML = `
    <div class="card">
      <h3>🌱 溫暖安撫</h3>
      <p>${intro}</p>
    </div>

    <div class="card">
      <h3>🧠 腦科學理解</h3>
      <p>${best.guidance || "孩子的大腦仍在發展，這不是故意，而是學習中的過程。"}</p>
    </div>

    <div class="card">
      <h3>🛠 你可以試試</h3>
      ${best.toolUrl ? `<p><a href="${best.toolUrl}" target="_blank">🚀 ${best.toolName || "取用實踐工具"}</a></p>` : ""}
      ${best.video1 ? `<p><a href="${best.video1}" target="_blank">🎥 相關影片</a></p>` : ""}
    </div>
  `;
}

// === 初始化：只抓一次 API ===
async function init() {
  const res = await fetch(API_URL);
  const data = await res.json();

  // chips 點一下就填字（在 index.html 裡有 data-q）
  document.querySelectorAll(".chip").forEach(btn => {
    btn.addEventListener("click", () => {
      const input = document.getElementById("userInput");
      input.value = btn.dataset.q || "";
      input.focus();
      applyTheme(detectMood(input.value));
    });
  });

  // 輸入時就先換氣色（陪伴感更強）
  const inputEl = document.getElementById("userInput");
  inputEl.addEventListener("input", () => {
    applyTheme(detectMood(inputEl.value));
  });

  document.getElementById("searchBtn").onclick = () => {
    const input = inputEl.value.trim();
    if (!input) return;

    applyTheme(detectMood(input));
    const matches = matchSmart(data, input);
    renderResult(matches, input);
  };

  // 初始主題
  applyTheme("steady");
}

init();