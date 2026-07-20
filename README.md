# 垃圾車即時追蹤與警報系統 (Garbage Truck Tracker & Alert)

一個現代化、高質感的垃圾車即時追蹤與雙點定位警報 App。支援地圖自訂住家與警報偵測點、特定時間過濾、路段關鍵字篩選、瀏覽器推播通知及語音廣播功能。

## 🚀 Render 免費託管部署指南

此專案已內建 `render.yaml` 設定檔，您可以非常快速地在 Render.com 上完成免費部署：

### 第一步：將專案上傳至 GitHub
1. 在 GitHub 上建立一個新的儲存庫 (Repository)。
2. 將此專案的所有檔案（包括 `public` 資料夾、`server.js`、`package.json` 及 `render.yaml`）推送到您的 GitHub 儲存庫。

### 第二步：在 Render 部署
1. 註冊並登入 [Render 官網](https://render.com/)。
2. 在 Render 儀表板點選右上角的 **「New +」** -> 選擇 **「Blueprint」**。
3. 連結您的 GitHub 帳戶，並選擇剛才上傳的垃圾車專案。
4. 點選 **「Approve」**。
5. 平台會自動讀取專案中的 `render.yaml` 並開始自動安裝與部署。

部署完成後，您會獲得一個專屬的 `https://xxxx.onrender.com` 網址，即可在手機或電腦瀏覽器上直接開啟使用！

---

## 💻 本地執行方式
如果您想先在自己的電腦測試：
1. 確保電腦已安裝 Node.js。
2. 於專案目錄執行：
   ```bash
   npm install
   npm start
   ```
3. 開啟瀏覽器造訪 `http://localhost:3000`。
