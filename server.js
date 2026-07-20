import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import line from '@line/bot-sdk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// LINE Bot configuration (will be initialized from frontend)
let lineBotClient = null;
let lineBotRecipients = [];

function initializeLineBot(channelAccessToken, channelSecret, recipients = []) {
  if (channelAccessToken && channelSecret) {
    lineBotClient = new line.Client({
      channelAccessToken: channelAccessToken,
      channelSecret: channelSecret
    });
    lineBotRecipients = recipients || [];
    console.log(`LINE Bot initialized. Broadcasting to ${lineBotRecipients.length} recipients.`);
  }
}

// API endpoint to receive garbage truck data from external source (your partner system)
app.post('/api/receive-truck-data', async (req, res) => {
  const { trucks } = req.body;

  if (!trucks || !Array.isArray(trucks)) {
    return res.status(400).json({ error: 'Invalid truck data format. Expected: { trucks: [...] }' });
  }

  try {
    // You can process/store the truck data here if needed
    res.json({ success: true, message: `Received ${trucks.length} truck records`, receivedAt: new Date().toISOString() });
  } catch (error) {
    console.error('Error processing truck data:', error);
    res.status(500).json({ error: 'Failed to process truck data', details: error.message });
  }
});

// API endpoint to proxy the garbage truck SOAP/POST requests
app.get('/api/garbage-trucks', async (req, res) => {
  try {
    const url = "https://customer-tw.eupfin.com/Eup_Servlet_Nuser_SOAP/Eup_Servlet_Nuser_SOAP";
    const param = {
      "Cust_ID": 5034553,
      "Team_ID": 5033122,
      "MethodName": "GetCarStatusGarbage"
    };

    // Prepare urlencoded form data
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
    res.status(500).json({ error: 'Failed to fetch garbage truck data', details: error.message });
  }
});

// API endpoint to initialize LINE Bot configuration
app.post('/api/line-bot-config', (req, res) => {
  const { channelAccessToken, channelSecret, recipients } = req.body;

  if (!channelAccessToken || !channelSecret) {
    return res.status(400).json({ error: 'Missing required LINE Bot credentials' });
  }

  if (!recipients || recipients.length === 0) {
    return res.status(400).json({ error: 'At least one recipient is required' });
  }

  try {
    initializeLineBot(channelAccessToken, channelSecret, recipients);
    res.json({ success: true, message: 'LINE Bot initialized successfully', recipientCount: recipients.length });
  } catch (error) {
    console.error('Error initializing LINE Bot:', error);
    res.status(500).json({ error: 'Failed to initialize LINE Bot', details: error.message });
  }
});

// API endpoint to send push message to LINE user
app.post('/api/send-line-message', async (req, res) => {
  if (!lineBotClient) {
    return res.status(400).json({ error: 'LINE Bot not initialized. Please configure it first.' });
  }

  const { userId, message } = req.body;

  if (!userId || !message) {
    return res.status(400).json({ error: 'Missing userId or message' });
  }

  try {
    await lineBotClient.pushMessage(userId, {
      type: 'text',
      text: message
    });
    res.json({ success: true, message: 'Message sent to LINE user' });
  } catch (error) {
    console.error('Error sending LINE message:', error);
    res.status(500).json({ error: 'Failed to send LINE message', details: error.message });
  }
});

// LINE Bot Webhook endpoint
app.post('/api/line-webhook', line.middleware({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
  channelSecret: process.env.LINE_CHANNEL_SECRET || ''
}), (req, res) => {
  Promise.all(req.body.events.map(event => {
    if (event.type === 'message' && event.message.type === 'text') {
      const text = event.message.text.toLowerCase();

      if (text.includes('狀態') || text.includes('status')) {
        return lineBotClient.replyMessage(event.replyToken, {
          type: 'text',
          text: '系統狀態正常，垃圾車追蹤運作中。請在網頁版查看詳細資訊。'
        });
      } else if (text.includes('幫助') || text.includes('help')) {
        return lineBotClient.replyMessage(event.replyToken, {
          type: 'text',
          text: '垃圾車警報系統 LINE Bot\n\n可用指令:\n- 狀態: 查看系統狀態\n- 幫助: 顯示此訊息\n\n詳細設定請訪問網頁版應用。'
        });
      }
    }
    return Promise.resolve();
  }))
  .then(() => res.json({ok: true}))
  .catch((err) => {
    console.error('LINE webhook error:', err);
    res.status(500).end();
  });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`LINE Bot webhook: http://localhost:${PORT}/api/line-webhook`);
});
