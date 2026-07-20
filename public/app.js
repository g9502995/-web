let map;
let homeMarker;
let alertMarker;
let alertCircle;
let truckMarkers = {};
let pollingIntervalId;
let alertCooldowns = {};
let geocodeCache = {};

// 用戶設置
let userConfig = {
  userId: "",
  homeCoords: [24.659710035666908, 121.82424418663483],
  alertCoords: [24.659710035666908, 121.82424418663483],
  alertRadius: 200,
  alertAfterTime: "00:00",
  streetFilter: "",
  isLinked: false
};

// 管理員設置 (系統級別)
let adminConfig = {
  channelToken: "",
  channelSecret: ""
};

// UI Elements
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const myUserId = document.getElementById('myUserId');
const myUserIdInput = document.getElementById('myUserIdInput');
const alertLatInput = document.getElementById('alertLat');
const alertLngInput = document.getElementById('alertLng');
const alertRadiusInput = document.getElementById('alertRadius');
const alertAfterTimeInput = document.getElementById('alertAfterTime');
const streetFilterInput = document.getElementById('streetFilter');
const bindLineBotBtn = document.getElementById('bindLineBotBtn');
const requestNotificationBtn = document.getElementById('requestNotificationBtn');
const testAlarmBtn = document.getElementById('testAlarmBtn');
const enableVoice = document.getElementById('enableVoice');
const enableSound = document.getElementById('enableSound');
const alertList = document.getElementById('alertList');
const truckCount = document.getElementById('truckCount');
const truckTableBody = document.getElementById('truckTableBody');
const alertSound = document.getElementById('alertSound');
const lineChannelTokenInput = document.getElementById('lineChannelToken');
const lineChannelSecretInput = document.getElementById('lineChannelSecret');
const saveAdminBtn = document.getElementById('saveAdminBtn');

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
  loadSavedSettings();
  initMap();
  setupEventListeners();
  requestNotificationPermission(true);
  startPolling();
});

// Load saved settings from localStorage
function loadSavedSettings() {
  // User settings
  const savedUserId = localStorage.getItem('myUserId');
  const savedAlertLat = localStorage.getItem('alertLat');
  const savedAlertLng = localStorage.getItem('alertLng');
  const savedRadius = localStorage.getItem('alertRadius');
  const savedAfterTime = localStorage.getItem('alertAfterTime');
  const savedStreet = localStorage.getItem('streetFilter');
  const savedLinked = localStorage.getItem('isLinked');

  if (savedUserId) {
    userConfig.userId = savedUserId;
    myUserId.value = savedUserId;
    myUserIdInput.value = savedUserId;
  }
  if (savedAlertLat && savedAlertLng) {
    userConfig.alertCoords = [parseFloat(savedAlertLat), parseFloat(savedAlertLng)];
    alertLatInput.value = savedAlertLat;
    alertLngInput.value = savedAlertLng;
  }
  if (savedRadius) {
    userConfig.alertRadius = parseInt(savedRadius, 10);
    alertRadiusInput.value = savedRadius;
  }
  if (savedAfterTime) {
    userConfig.alertAfterTime = savedAfterTime;
    alertAfterTimeInput.value = savedAfterTime;
  }
  if (savedStreet !== null && savedStreet !== undefined) {
    userConfig.streetFilter = savedStreet;
    streetFilterInput.value = savedStreet;
  }
  if (savedLinked === 'true') {
    userConfig.isLinked = true;
    updateBindStatus();
  }

  // Admin settings
  const savedToken = localStorage.getItem('lineChannelToken');
  const savedSecret = localStorage.getItem('lineChannelSecret');
  if (savedToken) {
    adminConfig.channelToken = savedToken;
    lineChannelTokenInput.value = savedToken;
  }
  if (savedSecret) {
    adminConfig.channelSecret = savedSecret;
    lineChannelSecretInput.value = savedSecret;
  }
}

// Setup Event Listeners
function setupEventListeners() {
  bindLineBotBtn.addEventListener('click', bindToLineBot);
  saveAdminBtn.addEventListener('click', saveAdminSettings);
  requestNotificationBtn.addEventListener('click', () => requestNotificationPermission(false));
  testAlarmBtn.addEventListener('click', triggerTestAlarm);

  // Save settings when input changes
  alertLatInput.addEventListener('change', saveUserSettings);
  alertLngInput.addEventListener('change', saveUserSettings);
  alertRadiusInput.addEventListener('change', saveUserSettings);
  alertAfterTimeInput.addEventListener('change', saveUserSettings);
  streetFilterInput.addEventListener('change', saveUserSettings);
  myUserIdInput.addEventListener('change', saveUserSettings);
}

// Save user settings
function saveUserSettings() {
  const lat = parseFloat(alertLatInput.value);
  const lng = parseFloat(alertLngInput.value);
  const radius = parseInt(alertRadiusInput.value, 10);
  const afterTime = alertAfterTimeInput.value;
  const street = streetFilterInput.value.trim();
  const userId = myUserIdInput.value.trim();

  if (isNaN(lat) || isNaN(lng) || isNaN(radius)) {
    addLog('參數無效，請檢查輸入內容！', 'info');
    return;
  }

  userConfig.alertCoords = [lat, lng];
  userConfig.alertRadius = radius;
  userConfig.alertAfterTime = afterTime;
  userConfig.streetFilter = street;
  if (userId) userConfig.userId = userId;

  localStorage.setItem('alertLat', lat);
  localStorage.setItem('alertLng', lng);
  localStorage.setItem('alertRadius', radius);
  localStorage.setItem('alertAfterTime', afterTime);
  localStorage.setItem('streetFilter', street);
  if (userId) localStorage.setItem('myUserId', userId);

  // Update map
  alertMarker.setLatLng([lat, lng]);
  alertCircle.setLatLng([lat, lng]);
  alertCircle.setRadius(radius);
  map.setView([lat, lng], 14);

  addLog('✓ 設置已自動保存', 'info');
}

// Bind user to LINE Bot
async function bindToLineBot() {
  const userId = myUserIdInput.value.trim();

  if (!userId) {
    addLog('請先輸入你的 LINE User ID！', 'info');
    return;
  }

  if (!adminConfig.channelToken || !adminConfig.channelSecret) {
    addLog('❌ 系統尚未配置 LINE Bot。請先讓管理員設置。', 'near');
    return;
  }

  try {
    // Save user config
    userConfig.userId = userId;
    saveUserSettings();

    // Send binding request to server
    const response = await fetch('/api/bind-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: userId,
        config: {
          alertLat: userConfig.alertCoords[0],
          alertLng: userConfig.alertCoords[1],
          alertRadius: userConfig.alertRadius,
          alertAfterTime: userConfig.alertAfterTime,
          streetFilter: userConfig.streetFilter
        }
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Binding failed');
    }

    userConfig.isLinked = true;
    localStorage.setItem('isLinked', 'true');
    updateBindStatus();
    addLog('✓ 已成功綁定到 LINE！你現在會收到警報通知。', 'info');
  } catch (error) {
    console.error('Error binding to LINE:', error);
    addLog(`❌ 綁定失敗: ${error.message}`, 'near');
  }
}

// Update bind status UI
function updateBindStatus() {
  if (userConfig.isLinked) {
    bindLineBotBtn.textContent = '✓ 已綁定到 LINE';
    bindLineBotBtn.disabled = true;
    bindLineBotBtn.style.opacity = '0.6';
  }
}

// Save admin settings
async function saveAdminSettings() {
  const token = lineChannelTokenInput.value.trim();
  const secret = lineChannelSecretInput.value.trim();

  if (!token || !secret) {
    addLog('請填入 Channel Access Token 和 Channel Secret！', 'info');
    return;
  }

  try {
    const response = await fetch('/api/admin-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channelAccessToken: token,
        channelSecret: secret
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Save failed');
    }

    adminConfig.channelToken = token;
    adminConfig.channelSecret = secret;

    localStorage.setItem('lineChannelToken', token);
    localStorage.setItem('lineChannelSecret', secret);

    addLog('✓ 管理員設置已保存！系統現在可以發送 LINE 警報。', 'info');
  } catch (error) {
    console.error('Error saving admin config:', error);
    addLog(`❌ 保存失敗: ${error.message}`, 'near');
  }
}

// Initialize Leaflet Map
function initMap() {
  map = L.map('map').setView(userConfig.alertCoords, 14);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 20
  }).addTo(map);

  // Alert marker
  const alertIcon = L.divIcon({
    html: `<div style="background-color: #d946ef; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 10px #d946ef;"></div>`,
    className: 'custom-alert-icon',
    iconSize: [14, 14]
  });

  alertMarker = L.marker(userConfig.alertCoords, { icon: alertIcon }).addTo(map);
  alertMarker.bindPopup('<b>我的警報點</b>');

  // Circle indicating alert radius
  alertCircle = L.circle(userConfig.alertCoords, {
    color: '#d946ef',
    fillColor: '#d946ef',
    fillOpacity: 0.1,
    radius: userConfig.alertRadius,
    weight: 1.5
  }).addTo(map);

  // Map click to update coordinates
  map.on('click', (e) => {
    const { lat, lng } = e.latlng;
    const mode = document.querySelector('input[name="clickMode"]:checked').value;

    if (mode === 'alertPoint') {
      alertLatInput.value = lat.toFixed(7);
      alertLngInput.value = lng.toFixed(7);
      saveUserSettings();
      addLog(`警報點已更新：${lat.toFixed(6)}, ${lng.toFixed(6)}`, 'info');
    }
  });
}

// Calculate Haversine Distance (in meters)
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

  return R * c;
}

// Browser notifications
function requestNotificationPermission(quiet = false) {
  if (!('Notification' in window)) {
    if (!quiet) alert('您的瀏覽器不支援通知功能！');
    return;
  }

  if (Notification.permission === 'default') {
    Notification.requestPermission().then(permission => {
      if (permission === 'granted' && !quiet) {
        addLog('已啟用瀏覽器通知權限！', 'info');
      }
    });
  }
}

// Trigger browser notification
function showNotification(title, body) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, {
      body: body,
      icon: 'https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?auto=format&fit=crop&q=80&w=128'
    });
  }
}

// Trigger speech synthesis
function speak(text) {
  if (enableVoice.checked && 'speechSynthesis' in window) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-TW';
    speechSynthesis.speak(utterance);
  }
}

// Trigger play sound
function playSound() {
  if (enableSound.checked) {
    alertSound.currentTime = 0;
    alertSound.play().catch(e => console.log('Audio playback prevented:', e));
  }
}

// Log message
function addLog(message, type = 'info') {
  const emptyLog = alertList.querySelector('.empty-log');
  if (emptyLog) {
    alertList.innerHTML = '';
  }

  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const logItem = document.createElement('div');
  logItem.className = `alert-item ${type}`;
  logItem.innerHTML = `
    <span class="alert-time">${timeStr}</span>
    <span class="alert-msg">${message}</span>
  `;

  alertList.insertBefore(logItem, alertList.firstChild);

  if (alertList.children.length > 50) {
    alertList.removeChild(alertList.lastChild);
  }
}

// Test alarm
function triggerTestAlarm() {
  playSound();
  speak('警報測試成功，本系統隨時為您監控附近的垃圾車。');
  showNotification('警報測試', '垃圾車追蹤系統正常運作！');
  addLog('✓ 觸發警報測試', 'info');

  // Also send test alert to LINE if linked
  if (userConfig.isLinked && userConfig.userId) {
    sendLineAlert(userConfig.userId, '🚛 [測試警報] 垃圾車追蹤系統正常運作！');
  }
}

// Start polling loop
function startPolling() {
  if (pollingIntervalId) {
    clearInterval(pollingIntervalId);
  }

  fetchData();
  pollingIntervalId = setInterval(fetchData, 10000);
}

// Fetch truck data
async function fetchData() {
  updateStatus('active', '資料更新中...');
  try {
    const response = await fetch('/api/garbage-trucks');
    if (!response.ok) {
      let errMsg = `伺服器傳回錯誤 ${response.status}`;
      try {
        const errJson = await response.json();
        if (errJson && errJson.details) {
          errMsg += ` (${errJson.details})`;
        }
      } catch (e) {}
      throw new Error(errMsg);
    }
    const data = await response.json();

    if (data.status && data.result) {
      processTruckData(data.result);
      updateStatus('active', `最後更新: ${new Date().toLocaleTimeString()}`);
    } else {
      throw new Error('無效的資料格式');
    }
  } catch (error) {
    console.error(error);
    updateStatus('error', `更新失敗: ${error.message}`);
    addLog(`連線異常: ${error.message}`, 'near');
  }
}

// Update status bar
function updateStatus(status, text) {
  statusDot.className = `pulse-dot ${status}`;
  statusText.textContent = text;
}

// Process truck data
function processTruckData(trucks) {
  truckCount.textContent = trucks.length;
  truckTableBody.innerHTML = '';

  const activePlates = new Set();

  trucks.forEach(car => {
    const plate = car.Car_Number;
    const style = car.Car_Style || '垃圾車';
    const time = car.Log_DTime;
    const lat = parseFloat(car.Log_GISY);
    const lng = parseFloat(car.Log_GISX);
    const direct = car.Log_Direct || '';

    if (isNaN(lat) || isNaN(lng)) return;

    activePlates.add(plate);

    const distAlertPoint = Math.round(getDistance(userConfig.alertCoords[0], userConfig.alertCoords[1], lat, lng));

    checkAlertRules(plate, style, distAlertPoint, lat, lng);
    updateTruckMarker(plate, style, lat, lng, distAlertPoint, direct, time);

    const row = document.createElement('tr');
    const isNear = distAlertPoint <= userConfig.alertRadius;
    row.innerHTML = `
      <td><b>${plate}</b></td>
      <td>${style}</td>
      <td>${time.split(' ')[1] || time}</td>
      <td>${distAlertPoint}m</td>
      <td>
        <span class="status-badge ${isNear ? 'in-range' : 'far'}">
          ${isNear ? '準備抵達' : '未達範圍'}
        </span>
      </td>
    `;
    truckTableBody.appendChild(row);
  });

  // Remove old markers
  Object.keys(truckMarkers).forEach(plate => {
    if (!activePlates.has(plate)) {
      map.removeLayer(truckMarkers[plate]);
      delete truckMarkers[plate];
    }
  });
}

// Get street name
async function getStreetName(lat, lng) {
  const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  if (geocodeCache[cacheKey]) {
    return geocodeCache[cacheKey];
  }
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
      headers: { 'Accept-Language': 'zh-TW' }
    });
    if (!response.ok) return '';
    const data = await response.json();
    const street = data.address ? (data.address.road || data.address.suburb || data.address.neighbourhood || '') : '';
    geocodeCache[cacheKey] = street;
    return street;
  } catch (error) {
    console.error('Geocoding error:', error);
    return '';
  }
}

// Check alert rules
async function checkAlertRules(plate, style, distance, lat, lng) {
  if (distance <= userConfig.alertRadius) {
    // Time check
    if (userConfig.alertAfterTime) {
      const nowTime = new Date();
      const [afterHour, afterMin] = userConfig.alertAfterTime.split(':').map(Number);
      const targetTime = new Date();
      targetTime.setHours(afterHour, afterMin, 0, 0);

      if (nowTime < targetTime) return;
    }

    // Street filter
    let roadInfo = '';
    if (userConfig.streetFilter) {
      const streetName = await getStreetName(lat, lng);
      if (!streetName || !streetName.includes(userConfig.streetFilter)) return;
      roadInfo = `在 ${streetName} `;
    }

    const now = Date.now();
    const lastAlert = alertCooldowns[plate] || 0;
    const threeMinutes = 3 * 60 * 1000;

    if (now - lastAlert > threeMinutes) {
      alertCooldowns[plate] = now;

      const message = `${style} (${plate}) ${roadInfo}距離您只有 ${distance} 公尺，請準備出門倒垃圾！`;

      playSound();
      speak(`注意，車牌 ${plate} 的 ${style} 已經抵達 ${userConfig.streetFilter || '附近'}，距離您只有 ${distance} 公尺！`);
      showNotification('垃圾車靠近警報！', message);
      addLog(message, 'near');

      // Send to LINE if linked
      if (userConfig.isLinked && userConfig.userId) {
        sendLineAlert(userConfig.userId, `🚛 ${message}`);
      }
    }
  }
}

// Send alert to LINE
async function sendLineAlert(userId, message) {
  console.log(`Sending LINE alert to ${userId}: ${message}`);
  try {
    const response = await fetch('/api/send-alert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, message })
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Alert send failed:', error);
      addLog(`❌ 發送 LINE 警報失敗: ${error.error}`, 'near');
      return;
    }

    console.log('✓ Alert sent successfully');
  } catch (error) {
    console.error('Failed to send LINE alert:', error);
    addLog(`❌ 發送 LINE 警報異常: ${error.message}`, 'near');
  }
}

// Update truck marker
function updateTruckMarker(plate, style, lat, lng, distAlertPoint, direct, time) {
  const isNear = distAlertPoint <= userConfig.alertRadius;
  const iconColor = isNear ? '#ef4444' : '#10b981';
  const truckIcon = L.divIcon({
    html: `
      <div style="
        background-color: ${iconColor};
        width: 16px;
        height: 16px;
        border-radius: 50%;
        border: 2px solid white;
        box-shadow: 0 0 10px ${iconColor};
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 9px;
        font-weight: bold;
      ">🚚</div>`,
    className: 'custom-truck-icon',
    iconSize: [18, 18]
  });

  if (truckMarkers[plate]) {
    truckMarkers[plate].setLatLng([lat, lng]);
    truckMarkers[plate].setIcon(truckIcon);
  } else {
    const marker = L.marker([lat, lng], { icon: truckIcon }).addTo(map);
    marker.bindPopup(`
      <div style="font-family: var(--font-family); color: #000;">
        <h3 style="margin:0 0 5px 0; font-size:14px; border-bottom:1px solid #ccc; padding-bottom:5px;">${style}</h3>
        <b>車牌號碼:</b> ${plate}<br>
        <b>距離:</b> ${distAlertPoint} m<br>
        <b>行進方向:</b> ${direct || '未知'}<br>
        <b>上報時間:</b> ${time}
      </div>
    `);
    truckMarkers[plate] = marker;
  }
}

// Toggle admin panel
function toggleAdminPanel() {
  const panel = document.getElementById('adminPanel');
  const toggle = document.getElementById('adminToggle');
  if (panel.style.display === 'none') {
    panel.style.display = 'block';
    toggle.textContent = '▲';
  } else {
    panel.style.display = 'none';
    toggle.textContent = '▼';
  }
}
