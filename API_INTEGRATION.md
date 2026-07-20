# 垃圾車警報系統 - API 整合指南

## 概述

本系統提供以下 API 端點，供外部系統（合作方）集成：

### 1. 接收垃圾車數據 API

用於接收來自合作方系統的垃圾車即時位置數據。

**端點:**
```
POST /api/receive-truck-data
```

**請求頭:**
```
Content-Type: application/json
```

**請求體:**
```json
{
  "trucks": [
    {
      "Car_Number": "車牌號碼（必須）",
      "Car_Style": "車輛類型（例：垃圾車、資收車）",
      "Log_GISY": "24.659710",
      "Log_GISX": "121.824244",
      "Log_DTime": "2024-01-01 14:30:00",
      "Log_Direct": "行進方向（例：北、南、東、西）"
    },
    ...
  ]
}
```

**響應:**
```json
{
  "success": true,
  "message": "Received 5 truck records",
  "receivedAt": "2024-01-01T14:30:00.000Z"
}
```

**HTTP 狀態碼:**
- `200` - 成功接收
- `400` - 請求格式錯誤
- `500` - 伺服器錯誤

---

### 2. 發送 LINE 訊息 API（內部使用）

用於手動向收件人發送 LINE 訊息。

**端點:**
```
POST /api/send-line-message
```

**請求體:**
```json
{
  "userId": "U1234567890abcdef1234567890abcdef",
  "message": "你的訊息內容"
}
```

**響應:**
```json
{
  "success": true,
  "message": "Message sent to LINE user"
}
```

---

### 3. LINE Bot 配置 API（內部使用）

用於初始化 LINE Bot 配置。

**端點:**
```
POST /api/line-bot-config
```

**請求體:**
```json
{
  "channelAccessToken": "YOUR_CHANNEL_ACCESS_TOKEN",
  "channelSecret": "YOUR_CHANNEL_SECRET",
  "recipients": [
    "U1234567890abcdef1234567890abcdef",
    "U0987654321fedcba0987654321fedcba"
  ]
}
```

---

## 集成示例

### Python 示例

```python
import requests
import json

# 系統地址
SYSTEM_URL = "http://localhost:3000"

# 垃圾車數據
truck_data = {
    "trucks": [
        {
            "Car_Number": "ABC-1234",
            "Car_Style": "壓縮式垃圾車",
            "Log_GISY": "24.659710",
            "Log_GISX": "121.824244",
            "Log_DTime": "2024-01-01 14:30:00",
            "Log_Direct": "北"
        },
        {
            "Car_Number": "XYZ-5678",
            "Car_Style": "資收車",
            "Log_GISY": "24.660000",
            "Log_GISX": "121.825000",
            "Log_DTime": "2024-01-01 14:31:00",
            "Log_Direct": "東"
        }
    ]
}

# 發送數據
response = requests.post(
    f"{SYSTEM_URL}/api/receive-truck-data",
    json=truck_data,
    headers={"Content-Type": "application/json"}
)

print(response.json())
```

### Node.js/JavaScript 示例

```javascript
const truckData = {
  trucks: [
    {
      Car_Number: "ABC-1234",
      Car_Style: "壓縮式垃圾車",
      Log_GISY: "24.659710",
      Log_GISX: "121.824244",
      Log_DTime: "2024-01-01 14:30:00",
      Log_Direct: "北"
    },
    {
      Car_Number: "XYZ-5678",
      Car_Style: "資收車",
      Log_GISY: "24.660000",
      Log_GISX: "121.825000",
      Log_DTime: "2024-01-01 14:31:00",
      Log_Direct: "東"
    }
  ]
};

fetch("http://localhost:3000/api/receive-truck-data", {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify(truckData)
})
  .then(res => res.json())
  .then(data => console.log(data))
  .catch(err => console.error(err));
```

### cURL 示例

```bash
curl -X POST http://localhost:3000/api/receive-truck-data \
  -H "Content-Type: application/json" \
  -d '{
    "trucks": [
      {
        "Car_Number": "ABC-1234",
        "Car_Style": "壓縮式垃圾車",
        "Log_GISY": "24.659710",
        "Log_GISX": "121.824244",
        "Log_DTime": "2024-01-01 14:30:00",
        "Log_Direct": "北"
      }
    ]
  }'
```

---

## 數據說明

### Car_Number（車牌號碼）
- 類型: 字符串
- 必須: 是
- 示例: "ABC-1234", "台灣-1234"
- 說明: 唯一標識垃圾車

### Car_Style（車輛類型）
- 類型: 字符串
- 必須: 否
- 示例: "壓縮式垃圾車", "資收車", "廚餘車"
- 說明: 車輛類型描述

### Log_GISY（緯度）
- 類型: 字符串或數字
- 必須: 是
- 範圍: -90 ~ 90
- 說明: GPS 緯度座標

### Log_GISX（經度）
- 類型: 字符串或數字
- 必須: 是
- 範圍: -180 ~ 180
- 說明: GPS 經度座標

### Log_DTime（報告時間）
- 類型: 字符串
- 必須: 否
- 格式: "YYYY-MM-DD HH:mm:ss"
- 說明: 數據報告時間

### Log_Direct（行進方向）
- 類型: 字符串
- 必須: 否
- 示例: "北", "南", "東", "西", "東北", "西南"
- 說明: 車輛行進方向

---

## 警報觸發邏輯

系統會根據以下條件觸發警報並廣播 LINE 訊息：

1. **距離檢查**: 垃圾車進入設置的警報半徑內
2. **時間檢查**: 當前時間 >= 設置的「在此時間後提醒」
3. **街道過濾**: (可選) 垃圾車位置在指定街道
4. **冷卻期**: 同一車牌最近 3 分鐘內已警報，則不重複警報

當以上條件都滿足時，系統會：
- 播放警報音效
- 進行語音播報
- 發送瀏覽器通知
- **廣播 LINE 訊息給所有配置的收件人**

---

## 常見問題

**Q: 數據更新頻率應該多少？**
A: 建議每 10-30 秒發送一次，根據你的系統負載調整。

**Q: 如何測試 API？**
A: 使用 Postman、cURL 或上述示例代碼進行測試。

**Q: 能否同時發送多個垃圾車數據？**
A: 可以，在 `trucks` 陣列中添加多個對象即可。

**Q: 座標格式可以是什麼？**
A: 可以是字符串或數字，十進位格式（例：24.659710）。

**Q: 如何確保 API 安全？**
A: 建議添加 API Key 認證。詳見「安全性」章節。

---

## 安全性

### 建議的安全措施

1. **添加 API Key 認證**
   ```javascript
   app.use('/api/receive-truck-data', (req, res, next) => {
     const apiKey = req.headers['x-api-key'];
     if (apiKey !== process.env.API_KEY) {
       return res.status(401).json({ error: 'Unauthorized' });
     }
     next();
   });
   ```

2. **HTTPS 傳輸**
   - 在生產環境使用 HTTPS

3. **IP 白名單**
   - 限制只有特定 IP 可以訪問 API

4. **速率限制**
   - 防止濫用，限制每個 IP 的請求頻率

---

## 故障排除

| 問題 | 原因 | 解決方案 |
|------|------|--------|
| 400 Bad Request | 請求格式錯誤 | 檢查 JSON 格式，確保必須字段存在 |
| 500 Server Error | 伺服器錯誤 | 檢查伺服器日誌 |
| LINE 訊息未收到 | LINE Bot 未配置 | 在網頁版確保 LINE Bot 已設置且收件人已添加 |
| 警報未觸發 | 條件未滿足 | 檢查距離、時間、街道過濾等設置 |

---

## 聯繫與支持

如有任何問題或建議，請聯繫系統管理員。
