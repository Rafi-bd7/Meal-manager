// js/api.js — Modern PHP & MySQL API client for MealManager
// Supports real-time sync with XAMPP MySQL database
// Every input (meal, expense, chat) is saved directly to DB

const API_BASE = 'api';

// ── API Error Handler ─────────────────────────────────────────────────────────
function _apiErrorToast(msg) {
  if (window.showToast) window.showToast(msg, 'error');
  else console.error('[API Error]', msg);
}

// ── Connection Status Indicator ───────────────────────────────────────────────
function _setConnectionStatus(online) {
  let bar = document.getElementById('_apiStatusBar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = '_apiStatusBar';
    bar.style.cssText = `
      position:fixed; top:0; left:0; right:0; z-index:999999;
      padding:5px 16px; font-size:0.78rem; font-weight:600;
      text-align:center; transition:transform .3s ease, opacity .3s ease;
      transform:translateY(-100%); opacity:0; pointer-events:none;
    `;
    document.body.appendChild(bar);
  }
  if (!online) {
    bar.style.background = '#ef4444';
    bar.style.color = '#fff';
    bar.textContent = '⚠️ সার্ভারের সাথে সংযোগ নেই — XAMPP-এ Apache ও MySQL চালু করুন অথবা ইন্টারনেট চেক করুন';
    bar.style.transform = 'translateY(0)';
    bar.style.opacity = '1';
  } else {
    bar.style.transform = 'translateY(-100%)';
    bar.style.opacity = '0';
  }
}

window._serverOnline = true;

const API = {
  async get(endpoint, params = {}) {
    const url = new URL(`${API_BASE}/${endpoint}`, window.location.href);
    Object.keys(params).forEach(k => {
      if (params[k] !== undefined && params[k] !== null) {
        url.searchParams.append(k, params[k]);
      }
    });
    url.searchParams.append('_t', Date.now());
    try {
      const res = await fetch(url.toString(), {
        cache: 'no-store',
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Server error ${res.status}`);
      window._serverOnline = true;
      _setConnectionStatus(true);
      return data;
    } catch (e) {
      if (e.message && (e.message.includes('Failed to fetch') || e.message.includes('NetworkError') || e.message.includes('Load failed'))) {
        window._serverOnline = false;
        _setConnectionStatus(false);
      }
      throw e;
    }
  },

  async post(endpoint, params = {}, body = {}) {
    const url = new URL(`${API_BASE}/${endpoint}`, window.location.href);
    Object.keys(params).forEach(k => {
      if (params[k] !== undefined && params[k] !== null) {
        url.searchParams.append(k, params[k]);
      }
    });
    try {
      const res = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(body)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Server error ${res.status}`);
      window._serverOnline = true;
      _setConnectionStatus(true);
      return data;
    } catch (e) {
      if (e.message && (e.message.includes('Failed to fetch') || e.message.includes('NetworkError') || e.message.includes('Load failed'))) {
        window._serverOnline = false;
        _setConnectionStatus(false);
      }
      throw e;
    }
  },

  // Full state sync into localStorage for fast and reactive UI
  async syncState() {
    try {
      const data = await this.get('sync.php', { action: 'state' });
      let changed = false;
      const setIfChanged = (key, val) => {
        if (val === undefined || val === null) return;
        const next = JSON.stringify(val);
        const prev = localStorage.getItem(key);
        if (prev !== next) {
          localStorage.setItem(key, next);
          changed = true;
        }
      };

      setIfChanged('meal_users',         data.meal_users);
      setIfChanged('meal_projects',      data.meal_projects);
      setIfChanged('meal_enrollments',   data.meal_enrollments);
      setIfChanged('meal_records',       data.meal_records);
      setIfChanged('meal_comments',      data.meal_comments);
      setIfChanged('meal_chats',         data.meal_chats);
      setIfChanged('meal_notifications', data.meal_notifications);
      setIfChanged('meal_expenses',      data.meal_expenses);
      setIfChanged('meal_bills',         data.meal_bills);

      if (changed) {
        window.dispatchEvent(new Event('storage'));
        window.dispatchEvent(new Event('appDataSynced'));
      }
      return data;
    } catch (e) {
      console.warn('Sync failed (offline or network error):', e.message);
      return null;
    }
  }
};

window.API = API;

// ── Smart Adaptive Polling ────────────────────────────────────────────────────
// Active tab: polls every 4 seconds
// Hidden tab: polls every 30 seconds
// Offline: stops polling, resumes instantly when back online
(async function initAppSync() {
  await API.syncState();

  // Backward compatibility flags
  window.firebaseDataLoaded = true;
  window.apiDataLoaded = true;
  window.dispatchEvent(new Event('firebaseDataLoaded'));
  window.dispatchEvent(new Event('apiDataLoaded'));

  let pollTimer = null;

  function startPolling(ms) {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(() => {
      if (navigator.onLine) API.syncState();
    }, ms);
  }

  // Normal polling when tab is active (3 seconds for real-time feel)
  startPolling(3000);

  // Background polling (6 seconds - responsive for phone notifications)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      startPolling(6000);
    } else {
      API.syncState();
      startPolling(3000);
    }
  });

  // Sync immediately when user focuses back
  window.addEventListener('focus', () => {
    if (navigator.onLine) API.syncState();
  });

  // Instantly sync when network comes back online
  window.addEventListener('online', () => {
    API.syncState();
    startPolling(4000);
    _setConnectionStatus(true);
  });

  // Stop polling when offline
  window.addEventListener('offline', () => {
    if (pollTimer) clearInterval(pollTimer);
    _setConnectionStatus(false);
  });
})();
