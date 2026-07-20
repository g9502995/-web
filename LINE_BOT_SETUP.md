# LINE Bot 廣播設置指南

## 系統架構

```
外部系統 (合作方)
    ↓ (發送垃圾車位置數據)
垃圾車即時追蹤系統 (你的系統)
    ↓ (廣播警報)
LINE Bot (多個收件人)
    ↓
合作方 (LINE 通知)
```

## 步驟 1: 註冊 LINE Developers Account

1. 訪問 [LINE Developers](https://developers.line.biz/zh-hant/)
2. 點擊「登入」或「新建帳號」
3. 使用 LINE 帳號登入或註冊

## 步驟 2: 創建 Channel

1. 登入 [LINE Developers Console](https://developers.line.biz/console/)
2. 點擊「新建 Channel」
3. 選擇 **「Messaging API」**
4. 填入基本資訊：
   - **Channel name**: 垃圾車警報廣播系統 (或自訂名稱)
   - **Description**: 垃圾車位置廣播系統
   - **Category**: 生活應用
   - **Subcategory**: 個人應用

## 步驟 3: 取得 Channel Access Token

1. Channel 建立後，進入 **Settings** 標籤
2. 找到 **Messaging API settings**
3. 向下滾動找到 **Channel access token**
4. 點擊「Issue」或「Reissue」來生成 Token
5. **複製** Access Token

## 步驟 4: 取得 Channel Secret

1. 在 **Basic settings** 標籤中
2. 找到 **Channel secret**
3. **複製** Channel Secret

## 步驟 5: 取得合作方的 LINE ID

1. 讓各合作方（要接收警報的人/單位）加你剛創建的 LINE Bot 為好友
2. 使用以下方式取得他們的 User ID：
   - 讓他們發送一條訊息給 Bot
   - 檢查伺服器日誌（查看 Webhook 接收的 User ID）
   - 或使用第三方工具查詢（搜尋 "LINE User ID Lookup"）

## 步驟 6: 在網頁應用中設置

1. 打開垃圾車警報系統的網頁應用
2. 滑到頁面下方的 **「LINE Bot 廣播設置」**區域
3. 填入：
   - **Channel Access Token**: 複製步驟 3 的 Token
   - **Channel Secret**: 複製步驟 4 的 Secret

4. **新增收件人**：
   - 在「合作方 LINE ID」欄位輸入每個合作方的 User ID
   - 點擊「新增收件人」按鈕
   - 重複此步驟添加所有收件人

5. 點擊**「保存 LINE Bot 設置」**

## 完成！

現在系統會在偵測到垃圾車時，自動向所有已配置的合作方廣播 LINE 警報。

## 合作方系統如何發送數據

你的合作方可以通過以下 API 端點發送垃圾車數據：

```bash
POST /api/receive-truck-data

Body (JSON):
{
  "trucks": [
    {
      "Car_Number": "車牌號碼",
      "Car_Style": "垃圾車",
      "Log_GISY": "24.659710",  # 緯度
      "Log_GISX": "121.824244", # 經度
      "Log_DTime": "2024-01-01 14:30:00",
      "Log_Direct": "北"
    },
    ...
  ]
}
```

## 測試

1. 觸發一個假的垃圾車警報進行測試
2. 所有收件人應該會同時收到 LINE 訊息
3. 消息格式: `🚛 [垃圾車類型] (車牌) 距離您只有 X 公尺，請準備出門倒垃圾！`

## 常見問題

**Q: 如何添加更多收件人？**
A: 在「合作方 LINE ID」欄位輸入新的 ID，點擊「新增收件人」，重複此步驟。

**Q: 如何移除收件人？**
A: 在收件人列表中點擊該人後的「移除」按鈕。

**Q: 收件人沒有收到訊息？**
A: 
- 確認他們已加 Bot 為好友
- 確認 Channel Access Token 正確
- 確認 User ID 正確
- 檢查伺服器日誌是否有錯誤

**Q: 如何批量添加收件人？**
A: 目前需要逐個添加。如需批量導入，請聯繫開發者。

## 安全提示

⚠️ **重要**: 
- 不要在公開地方洩露你的 Channel Access Token 和 Secret
- 不要將這些敏感資訊提交到 GitHub 或其他公開版本控制系統
- 定期更新你的 Token（在 Messaging API Console 中重新生成）
- 確保 `/api/receive-truck-data` 的訪問是可控的（可考慮添加 API Key 認證）
