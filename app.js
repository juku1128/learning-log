// ============================================================================
// W11 我的學習紀錄 ＆ 高級版班級求援投票系統（app.js）
// 安全原則：所有使用者輸入與資料庫文字一律使用 textContent 顯示純文字
// ============================================================================

const ROUND_PRESETS = {
  "W11-1": {
    title: "W11 上半場：哪一關想看老師再示範一次？",
    options: [
      { id: "rls-sql", label: "在 SQL Editor 貼上 schema.sql 並執行" },
      { id: "copy-keys", label: "找不到 Project URL 與 publishable key" },
      { id: "confirm-email", label: "關掉 Authentication 的 Confirm email 開關" },
      { id: "two-accounts", label: "用兩個帳號測試 RLS 門禁有沒有擋住" }
    ]
  },
  "W11-2": {
    title: "W11 下半場：GitHub 與 Cloudflare 部署卡在哪一關？",
    options: [
      { id: "github-push", label: "把六個檔案推上 GitHub 公開倉庫" },
      { id: "cf-connect", label: "Cloudflare 連結 GitHub 找不到 learning-log" },
      { id: "cf-entry", label: "Cloudflare 建置出現 Missing entry-point" },
      { id: "auto-update", label: "改版推上 GitHub 後手機畫面還沒更新" }
    ]
  },
  "W10-1": {
    title: "下一段想看老師重做哪一關？（W10 經典題目）",
    options: [
      { id: "deploy", label: "找不到部署按鈕" },
      { id: "sheet", label: "送出後試算表沒新增一筆" },
      { id: "phone", label: "同學的手機打不開" }
    ]
  }
};

let supabaseClient = null;
let currentUser = null;
let currentRound = "W11-1";
let customOptionsByRound = {
  "W11-1": [],
  "W11-2": [],
  "W10-1": []
};
let myVoteByRound = {};

// 取得畫面元素
const statusBanner = document.getElementById("status-banner");
const footerStatus = document.getElementById("footer-status");
const userBar = document.getElementById("user-bar");
const userEmailDisplay = document.getElementById("user-email-display");
const logoutBtn = document.getElementById("logout-btn");

const authSection = document.getElementById("auth-section");
const authForm = document.getElementById("auth-form");
const authEmailInput = document.getElementById("auth-email");
const authPasswordInput = document.getElementById("auth-password");
const loginBtn = document.getElementById("login-btn");
const signupBtn = document.getElementById("signup-btn");

const appSection = document.getElementById("app-section");

// 投票板元素
const currentRoundBadge = document.getElementById("current-round-badge");
const boardTitleEl = document.getElementById("board-title");
const roundSelect = document.getElementById("round-select");
const voteForm = document.getElementById("vote-form");
const voteOptionsList = document.getElementById("vote-options-list");
const customOptionInput = document.getElementById("custom-option-input");
const addOptionBtn = document.getElementById("add-option-btn");
const voteCommentInput = document.getElementById("vote-comment");
const syncToLogCheckbox = document.getElementById("sync-to-log");
const submitVoteBtn = document.getElementById("submit-vote-btn");
const retractVoteBtn = document.getElementById("retract-vote-btn");
const refreshVoteBtn = document.getElementById("refresh-vote-btn");
const totalVotesBadge = document.getElementById("total-votes-badge");
const voteResultsList = document.getElementById("vote-results-list");

// 學習紀錄元素
const logForm = document.getElementById("log-form");
const logDateInput = document.getElementById("log-date");
const logMinutesInput = document.getElementById("log-minutes");
const logTopicInput = document.getElementById("log-topic");
const logNoteInput = document.getElementById("log-note");
const addLogBtn = document.getElementById("add-log-btn");
const refreshLogsBtn = document.getElementById("refresh-logs-btn");
const logsEmptyHint = document.getElementById("logs-empty-hint");
const logsList = document.getElementById("logs-list");

// 設定狀態訊息（同時更新頂部橫幅與頁尾）
function setStatus(message, type = "info") {
  statusBanner.textContent = message;
  statusBanner.className = "status-banner";
  if (type === "error") {
    statusBanner.classList.add("status-error");
  } else if (type === "ok") {
    statusBanner.classList.add("status-ok");
  } else if (type === "warn") {
    statusBanner.classList.add("status-warn");
  }
  footerStatus.textContent = message;
}

// 將 Supabase 英文錯誤訊息翻譯成新手好懂的中文白話文
function translateError(error) {
  const raw = String((error && (error.message || error.error_description || error.details)) || error || "");
  const lower = raw.toLowerCase();

  if (lower.includes("learning_logs") && (lower.includes("does not exist") || lower.includes("not find") || lower.includes("schema cache"))) {
    return "找不到資料表 learning_logs：請到 Supabase 左側 SQL Editor 把 schema.sql 整份貼上並按 Run。";
  }
  if (lower.includes("permission denied")) {
    return "資料表還沒開放給登入的人用：請確認 schema.sql 最後的 grant 權限語法有執行成功。";
  }
  if (lower.includes("row-level security")) {
    return "門禁（RLS）攔截了這次操作：請確認你已登入，且 schema.sql 的 policy 規則已正確建立。";
  }
  if (lower.includes("email not confirmed")) {
    return "註冊後說要先按確認信：請到 Supabase 的 Authentication → Sign In / Providers 關掉 Confirm email，再回來按「登入網站」。";
  }
  if (lower.includes("invalid login credentials")) {
    return "Email 或密碼不對：如果是第一次使用，請先按右邊的「第一次來：註冊」按鈕！";
  }
  if (lower.includes("user already registered")) {
    return "這個 Email 已經註冊過了！請直接按「登入網站」即可。";
  }
  if (lower.includes("email address") && lower.includes("invalid")) {
    return "Email 被拒絕：請換一個真實格式的 Email（不要用 test@example.com 這類測試假信箱）。";
  }
  if (lower.includes("apikey") || lower.includes("invalid api key") || lower.includes("jwt")) {
    return "金鑰不對：請檢查 config.js 裡的 publishableKey 有沒有貼完整、有沒有多餘空白。";
  }
  if (lower.includes("failed to fetch") || lower.includes("networkerror")) {
    return "連不到 Supabase：請檢查 config.js 的 Project URL 是否長得像 https://一串字.supabase.co，或確認專案沒有被暫停。";
  }
  return "發生錯誤：" + raw;
}

// 取得今天日期字串（YYYY-MM-DD）
function getTodayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// 檢查 config.js 設定並初始化 Supabase
function initSupabase() {
  const cfg = window.SUPABASE_CONFIG || {};
  const url = String(cfg.url || "").trim();
  const key = String(cfg.publishableKey || "").trim();

  if (!url || !key || url.includes("貼上") || key.includes("貼上")) {
    setStatus("設定還沒完成：請打開 config.js，把 Project URL 和 publishable key 貼進去並存檔。", "warn");
    return false;
  }

  // 檢查是否誤貼成萬能金鑰（sb_secret_ 開頭）
  if (key.startsWith("sb_secret_")) {
    setStatus("🚨 紅色警告：你貼成萬能鑰匙（sb_secret_ 開頭）了！已停止連線。請立刻換成 sb_publishable_ 開頭的公開金鑰，並到 Supabase 把舊鑰匙作廢！", "error");
    return false;
  }

  if (!url.startsWith("https://") || !url.includes(".supabase.co")) {
    setStatus("連不到 Supabase：config.js 的 url 格式看起來不太對，應該長得像 https://一串字.supabase.co", "error");
    return false;
  }

  if (!window.supabase || typeof window.supabase.createClient !== "function") {
    setStatus("載入 Supabase 套件失敗，請檢查網路連線後重新整理頁面。", "error");
    return false;
  }

  supabaseClient = window.supabase.createClient(url, key);
  return true;
}

// 取得某場次的所有選項（預設選項＋本場次新增選項）
function getOptionsForRound(roundId) {
  const preset = ROUND_PRESETS[roundId] || ROUND_PRESETS["W11-1"];
  const custom = customOptionsByRound[roundId] || [];
  const merged = [...preset.options];
  for (const item of custom) {
    if (!merged.some((opt) => opt.id === item.id || opt.label === item.label)) {
      merged.push(item);
    }
  }
  return merged;
}

// 渲染投票選項單選按鈕（使用 createElement 與 textContent）
function renderVoteOptions(selectedOptionId = "") {
  const preset = ROUND_PRESETS[currentRound] || ROUND_PRESETS["W11-1"];
  currentRoundBadge.textContent = "場次：" + currentRound;
  boardTitleEl.textContent = preset.title;

  const options = getOptionsForRound(currentRound);
  const myVote = myVoteByRound[currentRound] || null;
  const activeOptionId = selectedOptionId || (myVote ? myVote.option_id : (options[0] ? options[0].id : ""));

  voteOptionsList.replaceChildren();

  for (const option of options) {
    const labelEl = document.createElement("label");
    labelEl.className = "vote-option-item";
    if (option.id === activeOptionId) {
      labelEl.classList.add("selected-option");
    }

    const leftDiv = document.createElement("div");
    leftDiv.className = "vote-option-left";

    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "vote-option";
    radio.value = option.id;
    radio.checked = option.id === activeOptionId;
    radio.addEventListener("change", () => {
      const allLabels = voteOptionsList.querySelectorAll(".vote-option-item");
      allLabels.forEach((el) => el.classList.remove("selected-option"));
      labelEl.classList.add("selected-option");
    });

    const textSpan = document.createElement("span");
    textSpan.textContent = option.label;

    leftDiv.appendChild(radio);
    leftDiv.appendChild(textSpan);
    labelEl.appendChild(leftDiv);

    if (myVote && myVote.option_id === option.id) {
      const myBadge = document.createElement("span");
      myBadge.className = "my-vote-pill";
      myBadge.textContent = "✅ 你目前投這關";
      labelEl.appendChild(myBadge);
    }

    voteOptionsList.appendChild(labelEl);
  }

  if (myVote) {
    retractVoteBtn.classList.remove("hidden");
    if (!voteCommentInput.value && myVote.comment) {
      voteCommentInput.value = myVote.comment;
    }
  } else {
    retractVoteBtn.classList.add("hidden");
  }
}

// 渲染即時投票統計長條圖
function renderVoteResults(summaryRows) {
  const options = getOptionsForRound(currentRound);
  const countMap = new Map();
  const commentMap = new Map();

  for (const opt of options) {
    countMap.set(opt.id, { id: opt.id, label: opt.label, count: 0 });
    commentMap.set(opt.id, []);
  }

  for (const row of summaryRows) {
    const id = String(row.option_id || "");
    const label = String(row.option_label || id);
    const count = Number(row.vote_count || 0);
    if (!countMap.has(id)) {
      countMap.set(id, { id, label, count });
      if (!customOptionsByRound[currentRound].some((o) => o.id === id)) {
        customOptionsByRound[currentRound].push({ id, label });
      }
    } else {
      countMap.get(id).count = count;
    }
    const comments = Array.isArray(row.recent_comments) ? row.recent_comments : [];
    commentMap.set(id, comments.slice(0, 4));
  }

  const items = Array.from(countMap.values());
  let totalVotes = 0;
  let maxCount = 0;
  for (const item of items) {
    totalVotes += item.count;
    if (item.count > maxCount) {
      maxCount = item.count;
    }
  }

  totalVotesBadge.textContent = `總票數：${totalVotes} 票`;
  voteResultsList.replaceChildren();

  // 依票數高到低排序
  items.sort((a, b) => b.count - a.count);

  for (const item of items) {
    const percent = totalVotes > 0 ? Math.round((item.count / totalVotes) * 100) : 0;
    const isWinner = maxCount > 0 && item.count === maxCount;

    const li = document.createElement("li");
    li.className = "result-item";
    if (isWinner) {
      li.classList.add("top-winner");
    }

    const topLine = document.createElement("div");
    topLine.className = "result-top-line";

    const labelWrap = document.createElement("div");
    labelWrap.className = "result-label-wrap";

    const nameSpan = document.createElement("span");
    nameSpan.textContent = item.label;
    labelWrap.appendChild(nameSpan);

    if (isWinner) {
      const crown = document.createElement("span");
      crown.className = "winner-crown";
      crown.textContent = "🔥 目前最需要老師重講";
      labelWrap.appendChild(crown);
    }

    const countSpan = document.createElement("span");
    countSpan.className = "result-count-text";
    countSpan.textContent = `${item.count} 票（${percent}%）`;

    topLine.appendChild(labelWrap);
    topLine.appendChild(countSpan);

    const track = document.createElement("div");
    track.className = "progress-track";

    const fill = document.createElement("div");
    fill.className = "progress-fill";
    fill.style.width = `${percent}%`;
    track.appendChild(fill);

    li.appendChild(topLine);
    li.appendChild(track);

    const notes = commentMap.get(item.id) || [];
    if (notes.length > 0) {
      const chipsWrap = document.createElement("div");
      chipsWrap.className = "comments-chips";
      for (const noteText of notes) {
        const chip = document.createElement("span");
        chip.className = "comment-chip";
        chip.textContent = "💬 " + noteText;
        chipsWrap.appendChild(chip);
      }
      li.appendChild(chipsWrap);
    }

    voteResultsList.appendChild(li);
  }
}

// 從 Supabase 讀取目前場次的選票與全班統計
async function loadVoteBoard() {
  if (!supabaseClient || !currentUser) return;

  try {
    // 1. 讀取本人這一場次的選票（受 RLS 保護，只會拿到自己的那一筆）
    const { data: myRows, error: myErr } = await supabaseClient
      .from("student_votes")
      .select("id, round_id, option_id, option_label, comment")
      .eq("round_id", currentRound)
      .limit(1);

    if (!myErr && Array.isArray(myRows)) {
      myVoteByRound[currentRound] = myRows[0] || null;
      if (myRows[0]) {
        const myOpt = { id: myRows[0].option_id, label: myRows[0].option_label };
        if (!getOptionsForRound(currentRound).some((o) => o.id === myOpt.id)) {
          customOptionsByRound[currentRound].push(myOpt);
        }
      }
    }

    // 2. 呼叫匿名統計函式取得各選項票數
    const { data: summaryData, error: rpcErr } = await supabaseClient
      .rpc("get_round_vote_summary", { p_round_id: currentRound });

    if (!rpcErr && Array.isArray(summaryData)) {
      renderVoteResults(summaryData);
      renderVoteOptions();
    } else {
      // 若使用者只跑了基礎版 schema.sql，仍可顯示自己的票數
      const fallbackRows = myVoteByRound[currentRound]
        ? [{
            option_id: myVoteByRound[currentRound].option_id,
            option_label: myVoteByRound[currentRound].option_label,
            vote_count: 1,
            recent_comments: myVoteByRound[currentRound].comment ? [myVoteByRound[currentRound].comment] : []
          }]
        : [];
      renderVoteResults(fallbackRows);
      renderVoteOptions();
    }
  } catch (err) {
    renderVoteResults([]);
    renderVoteOptions();
  }
}

// 送出或更新選票
async function handleVoteSubmit(event) {
  event.preventDefault();
  if (!supabaseClient || !currentUser) return;

  const selectedRadio = voteOptionsList.querySelector('input[name="vote-option"]:checked');
  if (!selectedRadio) {
    setStatus("請先選擇一個你想看老師示範的關卡選項！", "warn");
    return;
  }

  const optionId = selectedRadio.value;
  const options = getOptionsForRound(currentRound);
  const optionObj = options.find((item) => item.id === optionId);
  if (!optionObj) return;

  const commentText = voteCommentInput.value.trim();

  submitVoteBtn.disabled = true;
  try {
    const existingVote = myVoteByRound[currentRound];
    let voteError = null;

    if (existingVote && existingVote.id) {
      const { error } = await supabaseClient
        .from("student_votes")
        .update({
          option_id: optionObj.id,
          option_label: optionObj.label,
          comment: commentText || null
        })
        .eq("id", existingVote.id);
      voteError = error;
    } else {
      const { error } = await supabaseClient
        .from("student_votes")
        .insert({
          round_id: currentRound,
          option_id: optionObj.id,
          option_label: optionObj.label,
          comment: commentText || null
        });
      voteError = error;
    }

    if (voteError) {
      // 如果還沒建 student_votes 表，提醒或退回寫入 learning_logs
      setStatus(translateError(voteError), "error");
      return;
    }

    // 如果有勾選「順便新增一筆到我的私密學習紀錄」
    if (syncToLogCheckbox.checked) {
      await supabaseClient.from("learning_logs").insert({
        log_date: getTodayDateString(),
        topic: `【班級投票 ${currentRound}】投給：${optionObj.label}`,
        minutes: 15,
        note: commentText ? `卡關求援筆記：${commentText}` : "透過班級即時求援投票板自動記錄"
      });
      await loadLearningLogs();
    }

    await loadVoteBoard();
    setStatus(`🎉 已成功投給「${optionObj.label}」！即時票數已更新。`, "ok");
  } finally {
    submitVoteBtn.disabled = false;
  }
}

// 撤回本場次的選票
async function handleRetractVote() {
  if (!supabaseClient || !currentUser) return;
  const existingVote = myVoteByRound[currentRound];
  if (!existingVote || !existingVote.id) return;

  retractVoteBtn.disabled = true;
  try {
    const { error } = await supabaseClient
      .from("student_votes")
      .delete()
      .eq("id", existingVote.id);

    if (error) {
      setStatus(translateError(error), "error");
      return;
    }

    myVoteByRound[currentRound] = null;
    voteCommentInput.value = "";
    await loadVoteBoard();
    setStatus("已撤回你在本場次的選票。", "ok");
  } finally {
    retractVoteBtn.disabled = false;
  }
}

// 渲染我的私密學習紀錄（使用 textContent 避免 XSS）
function renderLearningLogs(logs) {
  logsList.replaceChildren();

  if (!Array.isArray(logs) || logs.length === 0) {
    logsEmptyHint.classList.remove("hidden");
    return;
  }

  logsEmptyHint.classList.add("hidden");

  for (const row of logs) {
    const li = document.createElement("li");
    li.className = "log-item";

    const headerDiv = document.createElement("div");
    headerDiv.className = "log-item-header";

    const metaDiv = document.createElement("div");
    metaDiv.className = "log-meta";

    const dateSpan = document.createElement("span");
    dateSpan.textContent = "📅 " + String(row.log_date || "");
    metaDiv.appendChild(dateSpan);

    if (row.minutes !== null && row.minutes !== undefined) {
      const minSpan = document.createElement("span");
      minSpan.className = "minutes-tag";
      minSpan.textContent = `⏱️ ${row.minutes} 分鐘`;
      metaDiv.appendChild(minSpan);
    }

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "btn btn-danger-outline btn-sm";
    delBtn.textContent = "刪除";
    delBtn.addEventListener("click", () => handleDeleteLog(row.id));

    headerDiv.appendChild(metaDiv);
    headerDiv.appendChild(delBtn);

    const topicDiv = document.createElement("div");
    topicDiv.className = "log-topic-title";
    topicDiv.textContent = String(row.topic || "");

    li.appendChild(headerDiv);
    li.appendChild(topicDiv);

    if (row.note && String(row.note).trim() !== "") {
      const noteP = document.createElement("p");
      noteP.className = "log-note-text";
      noteP.textContent = "💡 卡關／心得：" + String(row.note);
      li.appendChild(noteP);
    }

    logsList.appendChild(li);
  }
}

// 讀取我的私密學習紀錄（新的在上面）
async function loadLearningLogs() {
  if (!supabaseClient || !currentUser) return;

  const { data, error } = await supabaseClient
    .from("learning_logs")
    .select("id, log_date, topic, minutes, note, created_at")
    .order("log_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    setStatus(translateError(error), "error");
    return;
  }

  renderLearningLogs(data || []);
}

// 新增一筆學習紀錄
async function handleAddLog(event) {
  event.preventDefault();
  if (!supabaseClient || !currentUser) return;

  const logDate = logDateInput.value || getTodayDateString();
  const topic = logTopicInput.value.trim();
  const minutesRaw = logMinutesInput.value.trim();
  const minutes = minutesRaw === "" ? null : Number(minutesRaw);
  const note = logNoteInput.value.trim();

  if (!topic) {
    setStatus("請填寫「今天學了什麼」！", "warn");
    return;
  }

  addLogBtn.disabled = true;
  try {
    const { error } = await supabaseClient.from("learning_logs").insert({
      log_date: logDate,
      topic,
      minutes,
      note: note || null
    });

    if (error) {
      setStatus(translateError(error), "error");
      return;
    }

    logTopicInput.value = "";
    logNoteInput.value = "";
    await loadLearningLogs();
    setStatus("✅ 已新增一筆私密學習紀錄（受 RLS 門禁保護，只有你看得到）！", "ok");
  } finally {
    addLogBtn.disabled = false;
  }
}

// 刪除一筆學習紀錄
async function handleDeleteLog(logId) {
  if (!supabaseClient || !currentUser || !logId) return;

  const { error } = await supabaseClient
    .from("learning_logs")
    .delete()
    .eq("id", logId);

  if (error) {
    setStatus(translateError(error), "error");
    return;
  }

  await loadLearningLogs();
  setStatus("🗑️ 已刪除該筆學習紀錄。", "ok");
}

// 切換登入／未登入畫面
async function updateAuthUI(user) {
  currentUser = user || null;

  if (currentUser) {
    authSection.classList.add("hidden");
    appSection.classList.remove("hidden");
    userBar.classList.remove("hidden");
    userEmailDisplay.textContent = currentUser.email || "已登入使用者";
    setStatus(`歡迎回來，${currentUser.email}！正在載入你的投票看板與私密學習紀錄…`, "ok");

    await Promise.all([loadVoteBoard(), loadLearningLogs()]);
  } else {
    authSection.classList.remove("hidden");
    appSection.classList.add("hidden");
    userBar.classList.add("hidden");
    userEmailDisplay.textContent = "";
    logsList.replaceChildren();
  }
}

// 綁定所有按鈕與表單事件
function bindEvents() {
  logDateInput.value = getTodayDateString();

  // 登入
  authForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!supabaseClient) return;

    const email = authEmailInput.value.trim();
    const password = authPasswordInput.value;

    loginBtn.disabled = true;
    signupBtn.disabled = true;
    try {
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password
      });
      if (error) {
        setStatus(translateError(error), "error");
        return;
      }
      await updateAuthUI(data.user);
    } finally {
      loginBtn.disabled = false;
      signupBtn.disabled = false;
    }
  });

  // 註冊
  signupBtn.addEventListener("click", async () => {
    if (!supabaseClient) return;

    const email = authEmailInput.value.trim();
    const password = authPasswordInput.value;

    if (!email || !password || password.length < 6) {
      setStatus("請輸入有效的 Email，且密碼至少需要 6 個字元。", "warn");
      return;
    }

    loginBtn.disabled = true;
    signupBtn.disabled = true;
    try {
      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password
      });
      if (error) {
        setStatus(translateError(error), "error");
        return;
      }
      if (data.session && data.user) {
        await updateAuthUI(data.user);
        setStatus("🎉 註冊成功並已自動登入！現在可以開始投票與新增學習紀錄。", "ok");
      } else {
        setStatus("註冊成功！如果無法直接登入，請確認已到 Supabase 關掉 Confirm email，再按「登入網站」。", "warn");
      }
    } finally {
      loginBtn.disabled = false;
      signupBtn.disabled = false;
    }
  });

  // 登出
  logoutBtn.addEventListener("click", async () => {
    if (!supabaseClient) return;
    await supabaseClient.auth.signOut();
    await updateAuthUI(null);
    setStatus("你已安全登出帳號。", "info");
  });

  // 切換場次
  roundSelect.addEventListener("change", async () => {
    currentRound = roundSelect.value;
    voteCommentInput.value = "";
    renderVoteOptions();
    await loadVoteBoard();
  });

  // 新增自訂投票選項
  addOptionBtn.addEventListener("click", () => {
    const label = customOptionInput.value.trim();
    if (!label) {
      setStatus("請先輸入你想新增的求援關卡名稱！", "warn");
      return;
    }
    const id = "custom-" + Date.now();
    customOptionsByRound[currentRound].push({ id, label });
    customOptionInput.value = "";
    renderVoteOptions(id);
    setStatus(`已加入選項「${label}」，請按下方「送出／更新我的選票」完成投票！`, "ok");
  });

  // 送出選票
  voteForm.addEventListener("submit", handleVoteSubmit);

  // 撤回選票
  retractVoteBtn.addEventListener("click", handleRetractVote);

  // 更新票數
  refreshVoteBtn.addEventListener("click", async () => {
    await loadVoteBoard();
    setStatus("🔄 已重新整理最新班級得票統計！", "ok");
  });

  // 新增學習紀錄
  logForm.addEventListener("submit", handleAddLog);

  // 重新載入學習紀錄
  refreshLogsBtn.addEventListener("click", async () => {
    await loadLearningLogs();
    setStatus("🔄 已重新載入你的私密學習紀錄！", "ok");
  });
}

// 啟動應用程式
async function startApp() {
  bindEvents();
  renderVoteOptions();
  renderVoteResults([]);

  const ready = initSupabase();
  if (!ready) return;

  setStatus("已載入連線設定，請登入或註冊你的帳號。", "info");

  const { data, error } = await supabaseClient.auth.getSession();
  if (error) {
    setStatus(translateError(error), "error");
    return;
  }

  if (data && data.session && data.session.user) {
    await updateAuthUI(data.session.user);
  }
}

startApp();
