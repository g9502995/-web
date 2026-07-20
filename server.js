import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import line from '@line/bot-sdk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// LINE Bot configuration
let lineBotClient = null;
let lineBotConfig = { channelAccessToken: '', channelSecret: '' };

// Data file paths
const usersDataFile = path.join(__dirname, 'users.json');
const adminConfigFile = path.join(__dirname, 'admin-config.json');

// Load users data
function loadUsersData() {
  try {
    if (fs.existsSync(usersDataFile)) {
      const data = fs.readFileSync(usersDataFile, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading users data:', error);
  }
  return {};
}

// Save users data
function saveUsersData(users) {
  try {
    fs.writeFileSync(usersDataFile, JSON.stringify(users, null, 2), 'utf8');
  } catch (error) {
    console.error('Error saving users data:', error);
  }
}

// Load admin config
function loadAdminConfig() {
  try {
    if (fs.existsSync(adminConfigFile)) {
      const data = fs.readFileSync(adminConfigFile, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading admin config:', error);
  }
  return { channelAccessToken: '', channelSecret: '' };
}

// Save admin config
function saveAdminConfig(config) {
  try {
    fs.writeFileSync(adminConfigFile, JSON.stringify(config, null, 2), 'utf8');
  } catch (error) {
    console.error('Error saving admin config:', error);
  }
}

// Initialize LINE Bot
function initializeLineBot(channelAccessToken, channelSecret) {
  console.log(`\n[INIT] Initializing LINE Bot...`);
  console.log(`[INIT] Token length: ${channelAccessToken ? channelAccessToken.length : 0}`);
  console.log(`[INIT] Secret length: ${channelSecret ? channelSecret.length : 0}`);

  if (channelAccessToken && channelSecret) {
    try {
      lineBotClient = new line.Client({
        channelAccessToken: channelAccessToken,
        channelSecret: channelSecret
      });
      lineBotConfig.channelAccessToken = channelAccessToken;
      lineBotConfig.channelSecret = channelSecret;
      console.log(`✅ [INIT] LINE Bot initialized successfully`);
      console.log(`[INIT] lineBotClient type: ${typeof lineBotClient}`);
    } catch (error) {
      console.error(`❌ [INIT] Error initializing LINE Bot:`, error);
    }
  } else {
    console.log(`[INIT] Missing credentials`);
  }
}

// API: Admin config
app.post('/api/admin-config', (req, res) => {
  const { channelAccessToken, channelSecret } = req.body;

  if (!channelAccessToken || !channelSecret) {
    return res.status(400).json({ error: 'Missing credentials' });
  }

  try {
    initializeLineBot(channelAccessToken, channelSecret);
    // Save to file for persistence
    saveAdminConfig({ channelAccessToken, channelSecret });
    res.json({ success: true, message: 'Admin config saved' });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to save config', details: error.message });
  }
});

// API: Bind user to LINE
app.post('/api/bind-user', (req, res) => {
  const { userId, config } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'Missing userId' });
  }

  if (!lineBotClient) {
    return res.status(400).json({ error: 'LINE Bot not configured' });
  }

  try {
    const users = loadUsersData();
    users[userId] = {
      userId,
      ...config,
      boundAt: new Date().toISOString()
    };
    saveUsersData(users);

    console.log(`✓ User ${userId} bound successfully`);
    res.json({ success: true, message: 'User bound successfully' });
  } catch (error) {
    console.error('Error binding user:', error);
    res.status(500).json({ error: 'Failed to bind user', details: error.message });
  }
});

// API: Send alert to user
app.post('/api/send-alert', async (req, res) => {
  const { userId, message } = req.body;

  console.log(`\n[SEND ALERT] User: ${userId}, Message: ${message}`);
  console.log(`[SEND ALERT] lineBotClient exists: ${!!lineBotClient}`);

  if (!userId || !message) {
    console.log(`[SEND ALERT] Missing userId or message`);
    return res.status(400).json({ error: 'Missing userId or message' });
  }

  if (!lineBotClient) {
    console.log(`[SEND ALERT] LINE Bot not configured`);
    return res.status(400).json({ error: 'LINE Bot not configured' });
  }

  try {
    console.log(`[SEND ALERT] Pushing message...`);
    await lineBotClient.pushMessage(userId, {
      type: 'text',
      text: message
    });
    console.log(`✅ [SEND ALERT] Success! Message sent to ${userId}`);
    res.json({ success: true });
  } catch (error) {
    console.error(`❌ [SEND ALERT] Error:`, error);
    res.status(500).json({ error: 'Failed to send alert', details: error.message });
  }
});

// API: Garbage truck data (original)
app.get('/api/garbage-trucks', async (req, res) => {
  try {
    const url = "https://customer-tw.eupfin.com/Eup_Servlet_Nuser_SOAP/Eup_Servlet_Nuser_SOAP";
    const param = {
      "Cust_ID": 5034553,
      "Team_ID": 5033122,
      "MethodName": "GetCarStatusGarbage"
    };

    const formData = new URLSearchParams();
    formData.append('Param', JSON.stringify(param));

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formData.toString()
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error fetching garbage truck data:', error);
    res.status(500).json({ error: 'Failed to fetch truck data', details: error.message });
  }
});

// API: Receive truck data from external source
app.post('/api/receive-truck-data', async (req, res) => {
  const { trucks } = req.body;

  if (!trucks || !Array.isArray(trucks)) {
    return res.status(400).json({ error: 'Invalid format' });
  }

  try {
    // Check alerts for each user
    const users = loadUsersData();

    for (const userId in users) {
      const userConfig = users[userId];
      if (!userConfig || !userConfig.alertLat || !userConfig.alertLng) continue;

      for (const truck of trucks) {
        const plate = truck.Car_Number;
        const style = truck.Car_Style || '垃圾車';
        const lat = parseFloat(truck.Log_GISY);
        const lng = parseFloat(truck.Log_GISX);

        if (isNaN(lat) || isNaN(lng)) continue;

        // Calculate distance
        const distance = getDistance(
          userConfig.alertLat, userConfig.alertLng,
          lat, lng
        );

        // Check if in range
        if (distance <= userConfig.alertRadius) {
          // Check time
          if (userConfig.alertAfterTime) {
            const now = new Date();
            const [h, m] = userConfig.alertAfterTime.split(':').map(Number);
            const target = new Date();
            target.setHours(h, m, 0, 0);
            if (now < target) continue;
          }

          // Send alert
          if (lineBotClient) {
            const message = `🚛 ${style} (${plate}) 距離您只有 ${distance}公尺，請準備出門倒垃圾！`;
            try {
              await lineBotClient.pushMessage(userId, {
                type: 'text',
                text: message
              });
              console.log(`📱 Alert sent to ${userId}`);
            } catch (error) {
              console.error(`Failed to send alert to ${userId}:`, error);
            }
          }
        }
      }
    }

    res.json({ success: true, message: `Processed ${trucks.length} trucks` });
  } catch (error) {
    console.error('Error processing truck data:', error);
    res.status(500).json({ error: 'Failed to process', details: error.message });
  }
});

// Helper: Calculate distance (Haversine)
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const phi1 = lat1 * Math.PI / 180;
  const phi2 = lat2 * Math.PI / 180;
  const deltaPhi = (lat2 - lat1) * Math.PI / 180;
  const deltaLambda = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

// LINE Bot Webhook
app.post('/api/line-webhook', (req, res) => {
  res.status(200).json({ ok: true });

  // Re-initialize LINE Bot on each request (for Vercel serverless)
  if (!lineBotClient && lineBotConfig.channelAccessToken && lineBotConfig.channelSecret) {
    initializeLineBot(lineBotConfig.channelAccessToken, lineBotConfig.channelSecret);
  }

  if (!lineBotClient || !req.body || !req.body.events) return;

  Promise.all(req.body.events.map(event => {
    if (event.type === 'message' && event.message.type === 'text') {
      const text = event.message.text.toLowerCase();
      const userId = event.source.userId;

      console.log(`📱 Message from ${userId}: ${text}`);

      if (text.includes('我的id') || text.includes('my id') || text === 'id') {
        return lineBotClient.replyMessage(event.replyToken, {
          type: 'text',
          text: `你的 LINE User ID:\n\n${userId}\n\n複製此 ID 到網頁版的「我的 LINE User ID」欄位`
        });
      } else if (text.includes('幫助') || text.includes('help')) {
        return lineBotClient.replyMessage(event.replyToken, {
          type: 'text',
          text: '垃圾車警報系統\n\n📝 指令:\n- 我的id: 顯示你的 User ID\n- 幫助: 顯示此訊息\n\n👉 在網頁版設置你的警報，點「綁定到 LINE」即可接收警報。'
        });
      }
    }
    return Promise.resolve();
  })).catch(err => console.error('Webhook error:', err));
});

// Load admin config on startup
const savedConfig = loadAdminConfig();
if (savedConfig.channelAccessToken && savedConfig.channelSecret) {
  initializeLineBot(savedConfig.channelAccessToken, savedConfig.channelSecret);
  console.log('✓ Loaded saved admin config');
}

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Webhook: http://localhost:${PORT}/api/line-webhook`);
});
