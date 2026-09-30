// =============================================================================
// 24_7 Minecraft Bot — Dashboard Frontend
// Communicates with the bot backend API via authenticated HTTP requests.
// No secrets are hardcoded — token is entered at runtime via login modal.
// =============================================================================

(function () {
  'use strict';

  // -------------------------------------------------------------------------
  // DOM References
  // -------------------------------------------------------------------------
  const loginModal     = document.getElementById('loginModal');
  const dashboard      = document.getElementById('dashboard');
  const apiUrlInput    = document.getElementById('apiUrlInput');
  const tokenInput     = document.getElementById('tokenInput');
  const loginBtn       = document.getElementById('loginBtn');
  const loginError     = document.getElementById('loginError');
  const logoutBtn      = document.getElementById('logoutBtn');

  const statusIndicator = document.getElementById('statusIndicator');
  const statusEmoji     = document.getElementById('statusEmoji');
  const statusText      = document.getElementById('statusText');

  const cardServer     = document.getElementById('cardServer');
  const cardBot        = document.getElementById('cardBot');
  const cardUptime     = document.getElementById('cardUptime');
  const cardConnection = document.getElementById('cardConnection');

  const btnStart       = document.getElementById('btnStart');
  const btnStop        = document.getElementById('btnStop');
  const btnRestart     = document.getElementById('btnRestart');

  const logContainer   = document.getElementById('logContainer');

  const sysReconnect      = document.getElementById('sysReconnect');
  const sysLastConnected  = document.getElementById('sysLastConnected');
  const sysLastDisconnect = document.getElementById('sysLastDisconnect');
  const sysState          = document.getElementById('sysState');

  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------
  let apiBaseUrl = '';
  let apiToken   = '';
  let statusInterval = null;
  let logsInterval   = null;

  // -------------------------------------------------------------------------
  // Initialization — check for saved session
  // -------------------------------------------------------------------------
  function init() {
    const savedUrl   = sessionStorage.getItem('api_url');
    const savedToken = sessionStorage.getItem('api_token');

    if (savedUrl && savedToken) {
      apiBaseUrl = savedUrl;
      apiToken   = savedToken;
      showDashboard();
    } else {
      showLogin();
    }
  }

  // -------------------------------------------------------------------------
  // Login
  // -------------------------------------------------------------------------
  function showLogin() {
    loginModal.classList.remove('hidden');
    dashboard.classList.add('hidden');
    stopPolling();

    // Pre-fill last URL if available
    const lastUrl = localStorage.getItem('last_api_url');
    if (lastUrl) apiUrlInput.value = lastUrl;
  }

  function showDashboard() {
    loginModal.classList.add('hidden');
    dashboard.classList.remove('hidden');
    startPolling();
    fetchStatus();
    fetchLogs();
  }

  loginBtn.addEventListener('click', async () => {
    const url   = apiUrlInput.value.trim().replace(/\/+$/, '');
    const token = tokenInput.value.trim();

    if (!url) { loginError.textContent = 'Enter the backend URL.'; return; }
    if (!token) { loginError.textContent = 'Enter your API token.'; return; }

    loginError.textContent = '';
    loginBtn.disabled = true;
    loginBtn.textContent = 'Connecting...';

    try {
      const res = await fetch(`${url}/api/status`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (res.status === 401 || res.status === 403) {
        loginError.textContent = 'Invalid API token.';
        return;
      }
      if (!res.ok) {
        loginError.textContent = `Server error: ${res.status}`;
        return;
      }

      // Success — save session
      apiBaseUrl = url;
      apiToken   = token;
      sessionStorage.setItem('api_url', url);
      sessionStorage.setItem('api_token', token);
      localStorage.setItem('last_api_url', url);
      showDashboard();
    } catch (err) {
      loginError.textContent = `Cannot reach server: ${err.message}`;
    } finally {
      loginBtn.disabled = false;
      loginBtn.textContent = 'Connect';
    }
  });

  // Enter key triggers login
  tokenInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') loginBtn.click();
  });
  apiUrlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') tokenInput.focus();
  });

  // Logout
  logoutBtn.addEventListener('click', () => {
    sessionStorage.removeItem('api_url');
    sessionStorage.removeItem('api_token');
    apiBaseUrl = '';
    apiToken   = '';
    showLogin();
  });

  // -------------------------------------------------------------------------
  // API Helpers
  // -------------------------------------------------------------------------
  async function apiGet(endpoint) {
    const res = await fetch(`${apiBaseUrl}${endpoint}`, {
      headers: { 'Authorization': `Bearer ${apiToken}` },
    });
    if (res.status === 401 || res.status === 403) {
      showLogin();
      throw new Error('Authentication failed');
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  async function apiPost(endpoint) {
    const res = await fetch(`${apiBaseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
    });
    if (res.status === 401 || res.status === 403) {
      showLogin();
      throw new Error('Authentication failed');
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  // -------------------------------------------------------------------------
  // Polling
  // -------------------------------------------------------------------------
  function startPolling() {
    stopPolling();
    statusInterval = setInterval(fetchStatus, 5000);
    logsInterval   = setInterval(fetchLogs, 10000);
  }

  function stopPolling() {
    if (statusInterval) { clearInterval(statusInterval); statusInterval = null; }
    if (logsInterval)   { clearInterval(logsInterval); logsInterval = null; }
  }

  // -------------------------------------------------------------------------
  // Fetch & Render Status
  // -------------------------------------------------------------------------
  async function fetchStatus() {
    try {
      const data = await apiGet('/api/status');
      renderStatus(data);
    } catch {
      renderOffline();
    }
  }

  function renderStatus(data) {
    // Status hero
    const state = data.state || 'stopped';
    statusIndicator.className = 'status-indicator ' + (state === 'online' ? 'online' : state === 'stopped' ? 'offline' : 'connecting');

    if (state === 'online') {
      statusEmoji.textContent = '🟢';
      statusText.textContent  = 'ONLINE';
    } else if (state === 'connecting' || state === 'reconnecting') {
      statusEmoji.textContent = '🟡';
      statusText.textContent  = state.toUpperCase();
    } else {
      statusEmoji.textContent = '🔴';
      statusText.textContent  = 'OFFLINE';
    }

    // Info cards
    cardServer.textContent     = data.server || '—';
    cardBot.textContent        = data.bot || '—';
    cardUptime.textContent     = formatUptime(data.uptime || 0);
    cardConnection.textContent = data.online ? 'Connected' : 'Disconnected';

    // System info
    sysReconnect.textContent      = data.reconnectAttempts ?? 0;
    sysLastConnected.textContent  = formatTimestamp(data.lastConnected);
    sysLastDisconnect.textContent = formatTimestamp(data.lastDisconnected);
    sysState.textContent          = state;
  }

  function renderOffline() {
    statusIndicator.className = 'status-indicator offline';
    statusEmoji.textContent = '🔴';
    statusText.textContent  = 'UNREACHABLE';
    cardConnection.textContent = 'Backend offline';
    sysState.textContent = 'unreachable';
  }

  // -------------------------------------------------------------------------
  // Fetch & Render Logs
  // -------------------------------------------------------------------------
  async function fetchLogs() {
    try {
      const data = await apiGet('/api/logs?count=50');
      renderLogs(data.logs || []);
    } catch {
      // Silently fail — status will show unreachable
    }
  }

  function renderLogs(logs) {
    if (logs.length === 0) {
      logContainer.innerHTML = '<p class="log-placeholder">No logs yet.</p>';
      return;
    }

    const wasAtBottom = logContainer.scrollTop + logContainer.clientHeight >= logContainer.scrollHeight - 20;

    logContainer.innerHTML = logs.map(l =>
      `<div class="log-entry"><span class="log-time">${escapeHtml(l.time)}</span>${escapeHtml(l.message)}</div>`
    ).join('');

    // Auto-scroll to bottom if user was near bottom
    if (wasAtBottom) {
      logContainer.scrollTop = logContainer.scrollHeight;
    }
  }

  // -------------------------------------------------------------------------
  // Bot Controls
  // -------------------------------------------------------------------------
  btnStart.addEventListener('click', () => controlAction('/api/start', btnStart));
  btnStop.addEventListener('click', () => controlAction('/api/stop', btnStop));
  btnRestart.addEventListener('click', () => controlAction('/api/restart', btnRestart));

  async function controlAction(endpoint, btn) {
    btn.disabled = true;
    try {
      await apiPost(endpoint);
      // Refresh status immediately
      setTimeout(fetchStatus, 500);
      setTimeout(fetchLogs, 800);
    } catch (err) {
      console.error('Control action failed:', err);
    } finally {
      setTimeout(() => { btn.disabled = false; }, 2000);
    }
  }

  // -------------------------------------------------------------------------
  // Utility
  // -------------------------------------------------------------------------
  function formatUptime(seconds) {
    if (!seconds || seconds <= 0) return '0s';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    const parts = [];
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    parts.push(`${s}s`);
    return parts.join(' ');
  }

  function formatTimestamp(iso) {
    if (!iso) return 'Never';
    try {
      const d = new Date(iso);
      return d.toLocaleString();
    } catch {
      return iso;
    }
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // -------------------------------------------------------------------------
  // Boot
  // -------------------------------------------------------------------------
  init();
})();
