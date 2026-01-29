// === 你的智多星 API（已寫死，確定只連這支） ===
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

// === 結果渲染 ===
function renderResult(matches) {
  const box = document.getElementById("result");
  box.innerHTML = "";

  // 🌧 找不到 → 溫柔陪伴
  if (matches.length === 0) {
    box.innerHTML = `
      <div class="card">
        <h3>🌧 先坐一下也沒關係</h3>
        <p>你說的不像是一個問題，<br>而是一種撐很久的感覺。</p>
        <p>有些時候，不急著想辦法，<br>先被理解就好。</p>
        <p>👉 你可以先試試：<br>🧘 安住 30 秒的陪伴練習</p>
      </div>
    `;
    return;
  }

  const best = matches[0];

  // 🧠 依 score 調整語氣
  let intro = "";
  if (best.score >= 3) {
    intro = "你已經很清楚自己在困擾什麼，我們可以慢慢往前走。";
  } else if (best.score === 2) {
    intro = "我聽見你的擔心，先一起釐清發生了什麼。";
  } else {
    intro = "先不用急著解決，照顧你現在的感受比較重要。";
  }

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

  document.getElementById("searchBtn").onclick = () => {
    const input = document.getElementById("userInput").value.trim();
    if (!input) return;

    const matches = matchSmart(data, input);
    renderResult(matches);
  };
}

init();