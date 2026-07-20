import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

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

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
