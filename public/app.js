let map;
let homeMarker;
let alertMarker;
let alertCircle;
let truckMarkers = {};
let pollingIntervalId;
let alertCooldowns = {}; // Store timestamps of last alerts per license plate
let geocodeCache = {}; // Cache for reverse geocoding to avoid rate-limiting

// Settings
let homeCoords = [24.659710035666908, 121.82424418663483];
let alertCoords = [24.659710035666908, 121.82424418663483]; // Coordinates of target alert spot (road/intersection)
let alertRadius = 200; // in meters (default 200m around the alert point)
let pollInterval = 10; // in seconds
let alertAfterTime = "00:00";
let streetFilter = "";

// UI Elements
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const homeLatInput = document.getElementById('homeLat');
const homeLngInput = document.getElementById('homeLng');
const alertLatInput = document.getElementById('alertLat');
const alertLngInput = document.getElementById('alertLng');
const alertRadiusInput = document.getElementById('alertRadius');
const pollIntervalInput = document.getElementById('pollInterval');
const alertAfterTimeInput = document.getElementById('alertAfterTime');
const streetFilterInput = document.getElementById('streetFilter');
const requestNotificationBtn = document.getElementById('requestNotificationBtn');
const testAlarmBtn = document.getElementById('testAlarmBtn');
const enableVoice = document.getElementById('enableVoice');
const enableSound = document.getElementById('enableSound');
const alertList = document.getElementById('alertList');
const truckCount = document.getElementById('truckCount');
const truckTableBody = document.getElementById('truckTableBody');
const alertSound = document.getElementById('alertSound');

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
  loadSavedSettings();
  initMap();
  setupEventListeners();
  requestNotificationPermission(true); // check quietly
  startPolling();
});

// Load settings from localStorage
function loadSavedSettings() {
  const savedLat = localStorage.getItem('homeLat');
  const savedLng = localStorage.getItem('homeLng');
  const savedAlertLat = localStorage.getItem('alertLat');
  const savedAlertLng = localStorage.getItem('alertLng');
  const savedRadius = localStorage.getItem('alertRadius');
  const savedInterval = localStorage.getItem('pollInterval');
  const savedAfterTime = localStorage.getItem('alertAfterTime');
  const savedStreet = localStorage.getItem('streetFilter');

  if (savedLat && savedLng) {
    homeCoords = [parseFloat(savedLat), parseFloat(savedLng)];
    homeLatInput.value = savedLat;
    homeLngInput.value = savedLng;
  }
  if (savedAlertLat && savedAlertLng) {
    alertCoords = [parseFloat(savedAlertLat), parseFloat(savedAlertLng)];
    alertLatInput.value = savedAlertLat;
    alertLngInput.value = savedAlertLng;
  } else {
    // Default to home coordinates if alert point is not set
    alertCoords = [...homeCoords];
    alertLatInput.value = homeCoords[0];
    alertLngInput.value = homeCoords[1];
  }
  if (savedRadius) {
    alertRadius = parseInt(savedRadius, 10);
    alertRadiusInput.value = savedRadius;
  }
  if (savedInterval) {
    pollInterval = parseInt(savedInterval, 10);
    pollIntervalInput.value = savedInterval;
  }
  if (savedAfterTime) {
    alertAfterTime = savedAfterTime;
    alertAfterTimeInput.value = savedAfterTime;
  }
  if (savedStreet !== null && savedStreet !== undefined) {
    streetFilter = savedStreet;
    streetFilterInput.value = savedStreet;
  }
}

// Save Settings
function saveSettings() {
  const lat = parseFloat(homeLatInput.value);
  const lng = parseFloat(homeLngInput.value);
  const alertLat = parseFloat(alertLatInput.value);
  const alertLng = parseFloat(alertLngInput.value);
  const radius = parseInt(alertRadiusInput.value, 10);
  const interval = parseInt(pollIntervalInput.value, 10);
  const afterTime = alertAfterTimeInput.value;
  const street = streetFilterInput.value.trim();

  if (isNaN(lat) || isNaN(lng) || isNaN(alertLat) || isNaN(alertLng) || isNaN(radius) || isNaN(interval)) {
    addLog('設定參數無效，請檢查輸入內容！', 'info');
    return;
  }

  homeCoords = [lat, lng];
  alertCoords = [alertLat, alertLng];
  alertRadius = radius;
  pollInterval = interval;
  alertAfterTime = afterTime;
  streetFilter = street;

  localStorage.setItem('homeLat', lat);
  localStorage.setItem('homeLng', lng);
  localStorage.setItem('alertLat', alertLat);
  localStorage.setItem('alertLng', alertLng);
  localStorage.setItem('alertRadius', radius);
  localStorage.setItem('pollInterval', interval);
  localStorage.setItem('alertAfterTime', afterTime);
  localStorage.setItem('streetFilter', street);

  // Update Map elements
  homeMarker.setLatLng(homeCoords);
  alertMarker.setLatLng(alertCoords);
  alertCircle.setLatLng(alertCoords);
  alertCircle.setRadius(alertRadius);
  map.setView(alertCoords, 14);

  addLog('系統設定已更新！', 'info');

  // Restart Polling with new interval
  startPolling();
}

// Initialize Leaflet Map
function initMap() {
  // Use a modern dark tile set from CartoDB
  map = L.map('map').setView(alertCoords, 14);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 20
  }).addTo(map);

  // Home marker
  const homeIcon = L.divIcon({
    html: `<div style="background-color: #3b82f6; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 10px #3b82f6;"></div>`,
    className: 'custom-home-icon',
    iconSize: [14, 14]
  });

  homeMarker = L.marker(homeCoords, { icon: homeIcon }).addTo(map);
  homeMarker.bindPopup('<b>我的住家位置</b>').openPopup();

  // Alert marker
  const alertIcon = L.divIcon({
    html: `<div style="background-color: #d946ef; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 10px #d946ef;"></div>`,
    className: 'custom-alert-icon',
    iconSize: [14, 14]
  });

  alertMarker = L.marker(alertCoords, { icon: alertIcon }).addTo(map);
  alertMarker.bindPopup('<b>警報偵測點</b>');

  // Circle indicating target radius around the alert point
  alertCircle = L.circle(alertCoords, {
    color: '#d946ef',
    fillColor: '#d946ef',
    fillOpacity: 0.1,
    radius: alertRadius,
    weight: 1.5
  }).addTo(map);

  // Dynamic coordinates update on map click
  map.on('click', (e) => {
    const { lat, lng } = e.latlng;
    const mode = document.querySelector('input[name="clickMode"]:checked').value;

    if (mode === 'home') {
      homeLatInput.value = lat.toFixed(7);
      homeLngInput.value = lng.toFixed(7);
      homeCoords = [lat, lng];
      homeMarker.setLatLng(homeCoords);
      localStorage.setItem('homeLat', lat);
      localStorage.setItem('homeLng', lng);
      addLog(`住家位置已更新：${lat.toFixed(6)}, ${lng.toFixed(6)}`, 'info');
    } else {
      alertLatInput.value = lat.toFixed(7);
      alertLngInput.value = lng.toFixed(7);
      alertCoords = [lat, lng];
      alertMarker.setLatLng(alertCoords);
      alertCircle.setLatLng(alertCoords);
      localStorage.setItem('alertLat', lat);
      localStorage.setItem('alertLng', lng);
      addLog(`警報偵測點已更新：${lat.toFixed(6)}, ${lng.toFixed(6)}`, 'info');
    }
  });
}

// Calculate Haversine Distance (in meters)
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth radius in meters
  const phi1 = lat1 * Math.PI / 180;
  const phi2 = lat2 * Math.PI / 180;
  const deltaPhi = (lat2 - lat1) * Math.PI / 180;
  const deltaLambda = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // in meters
}

// Setup Event Listeners
function setupEventListeners() {
  saveSettingsBtn.addEventListener('click', saveSettings);
  requestNotificationBtn.addEventListener('click', () => requestNotificationPermission(false));
  testAlarmBtn.addEventListener('click', triggerTestAlarm);
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
  } else if (Notification.permission === 'granted' && !quiet) {
    addLog('瀏覽器通知權限已是允許狀態。', 'info');
  }
}

// Trigger browser notification
function showNotification(title, body) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, {
      body: body,
      icon: 'https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?auto=format&fit=crop&q=80&w=128' // generic fallback icon path or truck emoji
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
    alertSound.play().catch(e => console.log('Audio playback prevented by browser autoplay policy:', e));
  }
}

// Log message inside the Log Panel
function addLog(message, type = 'info') {
  // Clear empty state
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

  // Keep logs at max 50 items
  if (alertList.children.length > 50) {
    alertList.removeChild(alertList.lastChild);
  }
}

// Test alarm button
function triggerTestAlarm() {
  playSound();
  speak('警報測試成功，本系統隨時為您監控附近的垃圾車。');
  showNotification('警報測試', '這是來自垃圾車即時追蹤系統的測試通知！');
  addLog('觸發警報測試', 'info');
}

// Start Polling Loop
function startPolling() {
  if (pollingIntervalId) {
    clearInterval(pollingIntervalId);
  }

  // Fetch immediately
  fetchData();

  pollingIntervalId = setInterval(fetchData, pollInterval * 1000);
}

// Fetch details from local node proxy
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
        } else if (errJson && errJson.error) {
          errMsg += ` (${errJson.error})`;
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

// Update the system status bar
function updateStatus(status, text) {
  statusDot.className = `pulse-dot ${status}`;
  statusText.textContent = text;
}

// Process API response data
function processTruckData(trucks) {
  truckCount.textContent = trucks.length;
  truckTableBody.innerHTML = '';

  // Store lists of current trucks to clean up deleted ones
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

    // Calculate distance to Alert Point and Home
    const distAlertPoint = Math.round(getDistance(alertCoords[0], alertCoords[1], lat, lng));
    const distHome = Math.round(getDistance(homeCoords[0], homeCoords[1], lat, lng));

    // Handle warning rules based on alert point distance
    checkAlertRules(plate, style, distAlertPoint, lat, lng);

    // Plot/Update map marker
    updateTruckMarker(plate, style, lat, lng, distAlertPoint, distHome, direct, time);

    // Populate table row
    const row = document.createElement('tr');
    const isNear = distAlertPoint <= alertRadius;
    row.innerHTML = `
      <td><b>${plate}</b></td>
      <td>${style}</td>
      <td>${time.split(' ')[1] || time}</td>
      <td>
        偵測點: ${distAlertPoint}m<br>
        <span style="font-size:0.75rem; color:var(--text-muted)">住家: ${distHome >= 1000 ? (distHome / 1000).toFixed(2) + ' km' : distHome + ' m'}</span>
      </td>
      <td>
        <span class="status-badge ${isNear ? 'in-range' : 'far'}">
          ${isNear ? '準備抵達' : '未達範圍'}
        </span>
      </td>
    `;
    truckTableBody.appendChild(row);
  });

  // Remove markers for trucks no longer reported
  Object.keys(truckMarkers).forEach(plate => {
    if (!activePlates.has(plate)) {
      map.removeLayer(truckMarkers[plate]);
      delete truckMarkers[plate];
    }
  });
}

// Helper to get street name from lat, lng using Nominatim API (with caching)
async function getStreetName(lat, lng) {
  const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  if (geocodeCache[cacheKey]) {
    return geocodeCache[cacheKey];
  }
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
      headers: {
        'Accept-Language': 'zh-TW'
      }
    });
    if (!response.ok) return '';
    const data = await response.json();
    const street = data.address ? (data.address.road || data.address.suburb || data.address.neighbourhood || data.display_name || '') : '';
    geocodeCache[cacheKey] = street;
    return street;
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return '';
  }
}

// Check distance & coordinate alerts with time & street filters
async function checkAlertRules(plate, style, distance, lat, lng) {
  if (distance <= alertRadius) {
    // 1. Time Check
    if (alertAfterTime) {
      const nowTime = new Date();
      const [afterHour, afterMin] = alertAfterTime.split(':').map(Number);
      const targetTime = new Date();
      targetTime.setHours(afterHour, afterMin, 0, 0);
      
      if (nowTime < targetTime) {
        return; // Current time is before the allowed alert start time
      }
    }

    // 2. Street/Road Name Check
    let roadInfo = '';
    if (streetFilter) {
      const streetName = await getStreetName(lat, lng);
      if (!streetName || !streetName.includes(streetFilter)) {
        return; // Doesn't match the designated street filter
      }
      roadInfo = `在 ${streetName} `;
    }

    const now = Date.now();
    const lastAlert = alertCooldowns[plate] || 0;
    const threeMinutes = 3 * 60 * 1000;

    // Alert if not alerted recently (cooldown)
    if (now - lastAlert > threeMinutes) {
      alertCooldowns[plate] = now;
      
      const message = `${style} (${plate}) ${roadInfo}距離您只有 ${distance} 公尺，請準備出門倒垃圾！`;
      
      playSound();
      speak(`注意，車牌 ${plate} 的 ${style} 已經抵達 ${streetFilter || '附近'}，距離您只有 ${distance} 公尺！`);
      showNotification('垃圾車靠近警報！', message);
      addLog(message, 'near');
    }
  }
}

// Update Leaflet marker for a truck
function updateTruckMarker(plate, style, lat, lng, distAlertPoint, distHome, direct, time) {
  const isNear = distAlertPoint <= alertRadius;
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

  const tooltipText = `車牌: ${plate}<br>偵測點: ${distAlertPoint}m | 住家: ${distHome}m`;

  if (truckMarkers[plate]) {
    // Update existing marker
    truckMarkers[plate].setLatLng([lat, lng]);
    truckMarkers[plate].setIcon(truckIcon);
    truckMarkers[plate].setTooltipContent(tooltipText);
  } else {
    // Create new marker
    const marker = L.marker([lat, lng], { icon: truckIcon }).addTo(map);
    marker.bindTooltip(tooltipText, {
      permanent: false,
      direction: 'top'
    });
    
    // Popup info
    marker.bindPopup(`
      <div style="font-family: var(--font-family); color: #000;">
        <h3 style="margin:0 0 5px 0; font-size:14px; border-bottom:1px solid #ccc; padding-bottom:5px;">${style}</h3>
        <b>車牌號碼:</b> ${plate}<br>
        <b>距偵測點:</b> ${distAlertPoint} m<br>
        <b>距離住家:</b> ${distHome >= 1000 ? (distHome / 1000).toFixed(2) + ' km' : distHome + ' m'}<br>
        <b>行進方向:</b> ${direct || '未知'}<br>
        <b>上報時間:</b> ${time}
      </div>
    `);

    truckMarkers[plate] = marker;
  }
}
