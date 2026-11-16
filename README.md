# 🎓 我的學習紀錄 ＆ 高級版班級即時求援投票系統（W11 實作專案）

這是一個結合 **W10「班級求援投票板」** 與 **W11「Supabase 實名登入＋資料庫門禁（RLS）＋GitHub＋Cloudflare 自動部署」** 的升級版全端網頁應用程式。

---

## ✨ 為什麼這是「更高級的學生投票＋學習紀錄網頁」？

1. **🔐 實名登入防灌票（一人一票＋可改投／撤回）**
   - 改良上週 W10 不用登入會被重複灌票的問題：每位同學用 Email＋密碼登入後，在單一場次限投 1 票，且可隨時改投其他關卡或撤回選票。
2. **📊 視覺化動態長條圖 ＆ 最高票「🔥 目前最需要老師重講」自動標章**
   - 自動計算各關卡得票率（%）並繪製動態漸層進度條，最高票選項自動亮起醒目皇冠提示。
3. **🔄 多場次切換 ＆ 自訂求援選項＋匿名求援小紙條**
   - 內建 `W11-1`、`W11-2`、`W10-1` 三個場次，同學也能自己新增卡關選項與求援留言。
4. **🔒 資料庫 RLS（Row Level Security）門禁保護個人學習紀錄**
   - 投票時可一鍵同步寫入右側「我的私密學習紀錄（`learning_logs`）」，所有個人紀錄在資料庫層級皆由 `auth.uid() = user_id` 嚴格把關，**每個人只看得到自己的紀錄**。

---

## 📁 專案六個檔案說明

| 檔案名稱 | 負責的工作 |
| :--- | :--- |
| `index.html` | 網站的畫面骨架（登入／註冊區、班級求援投票看板、我的私密學習紀錄區）。 |
| `style.css` | 網站的視覺外觀、動態得票長條圖與手機／電腦響應式排版（RWD）。 |
| `config.js` | 存放 Supabase 的兩個公開連線設定（`Project URL` 與 `publishable key`）。 |
| `app.js` | 網站的互動邏輯（Supabase 註冊登入、即時投票計算、學習紀錄新增與刪除，全程使用 `textContent` 防止 XSS 攻擊）。 |
| `schema.sql` | 在 Supabase SQL Editor 執行的建表與 RLS 門禁規則腳本（建立 `learning_logs` 與 `student_votes` 並開啟 RLS）。 |
| `README.md` | 本專案的架構與操作說明書。 |

---

## 🚀 快速上線步驟

1. **Supabase 建表與開門禁**：
   - 到 Supabase 專案左側 **SQL Editor**，把 `schema.sql` 整份貼上並按 **Run**。
2. **填入公開金鑰**：
   - 到 Supabase 專案首頁複製 `Project URL` 與 `sb_publishable_` 開頭的 `Publishable key`，填入 `config.js`。
3. **關閉練習用確認信**：
   - 到 Supabase 左側 **Authentication → Sign In / Providers**，將 **Confirm email** 關掉並按 **Save changes**。
4. **推上 GitHub 並連上 Cloudflare**：
   - 將這 6 個檔案推上 GitHub 公開倉庫 `learning-log`，再到 Cloudflare **Workers & Pages** 連結該倉庫完成自動部署。
