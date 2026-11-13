// Telemetry, Analytics & Firebase Cloud Backend Adapter: Best-effort crash reporting, event logging, and cloud save foundation.

// Единая версия сборки (используется как фоллбэк в UI и в телеметрии)
window.APP_VERSION = '1.38.32';

// Флаг среды выполнения ('development' | 'production')
window.__APP_STAGE__ = window.__APP_STAGE__ || 'development';

// Эндпоинт для сбора краш-логов (укажите URL вашего Cloudflare Worker / Firebase Function или оставьте '' для отключения)
const ERROR_WEBHOOK_URL = '';

// Эндпоинт для игровой аналитики GA4 / Firebase Measurement Protocol (оставьте '' для отключения)
const ANALYTICS_ENDPOINT_URL = '';
const ANALYTICS_CLIENT_ID_KEY = 'sectorDefenseTD_analytics_cid';

// [TEL.FB_CFG] Конфигурация Firebase (заполняется после публикации в стор; пока projectId пустой — работает в режиме No-Op)
const FIREBASE_CONFIG = {
  enabled: false,       // Переключить на true после создания проекта Firebase
  apiKey: '',           // Web API Key из консоли Firebase
  projectId: '',        // Project ID (например, 'synth-wave-defense')
  appId: '',            // App ID
  measurementId: '',    // G-XXXXXXXXXX (опционально)
  region: 'default'
};
window.FIREBASE_CONFIG = FIREBASE_CONFIG;

const FIREBASE_AUTH_STORAGE_KEY = 'sectorDefenseTD_fb_auth_v1';

// [TEL.A]
function getAnalyticsClientId() {
  try {
    let cid = localStorage.getItem(ANALYTICS_CLIENT_ID_KEY);
    if (!cid) {
      cid = 'cid_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2);
      localStorage.setItem(ANALYTICS_CLIENT_ID_KEY, cid);
    }
    return cid;
  } catch (e) {
    return 'cid_unknown';
  }
}

// [TEL.AA]
window.reportErrorToWebhook = function (info) {
  if (!info) return;
  const ver = (window.SyncTelemetry && window.SyncTelemetry.localVersion && window.SyncTelemetry.localVersion !== '—')
    ? window.SyncTelemetry.localVersion
    : (window.APP_VERSION || '1.38.32');

  // Если подключен нативный мост Firebase Crashlytics — дублируем стек туда
  if (window.NativeFirebaseBridge && typeof window.NativeFirebaseBridge.recordException === 'function') {
    try {
      window.NativeFirebaseBridge.recordException(String(info.message || 'Crash'), String(info.stack || ''));
    } catch (e) {}
  }

  // Если включен облачный бэкенд Firebase — сохраняем краш в коллекцию crashes
  if (window.CloudBackend && window.CloudBackend.isReady()) {
    window.CloudBackend.reportCrash(info, ver);
  }

  if (!ERROR_WEBHOOK_URL) return;

  const lines = [
    '\uD83D\uDEA8 **Synth Wave Defense Crash** (v' + ver + ')',
    `**${info.message}**`,
    `Loc: \`${info.source}:${info.lineno}:${info.colno}\``,
    `Booted: \`${info.booted}\` | Time: \`${info.ts}\``,
    `UA: \`${info.ua}\``
  ];
  if (info.stack) {
    lines.push('```' + String(info.stack).slice(0, 800) + '```');
  }

  sendJSON(ERROR_WEBHOOK_URL, {
    version: ver,
    client_id: getAnalyticsClientId(),
    uid: (window.CloudBackend && window.CloudBackend.uid) ? window.CloudBackend.uid : null,
    crash: info,
    content: lines.join('\n')
  });
};

// [TEL.B]
function trackEvent(name, params) {
  const ver = (window.SyncTelemetry && window.SyncTelemetry.localVersion && window.SyncTelemetry.localVersion !== '—')
    ? window.SyncTelemetry.localVersion
    : (window.APP_VERSION || '1.38.32');

  const enrichedParams = Object.assign({ app_version: ver }, params || {});

  // 1. Нативный мост Firebase Analytics (если добавлен в MainActivity.java)
  if (window.NativeFirebaseBridge && typeof window.NativeFirebaseBridge.logEvent === 'function') {
    try {
      window.NativeFirebaseBridge.logEvent(String(name), JSON.stringify(enrichedParams));
    } catch (e) {}
  }

  // 2. Веб-эндпоинт / Cloudflare Worker / GA4
  if (!ANALYTICS_ENDPOINT_URL) return;
  sendJSON(ANALYTICS_ENDPOINT_URL, {
    client_id: getAnalyticsClientId(),
    uid: (window.CloudBackend && window.CloudBackend.uid) ? window.CloudBackend.uid : null,
    events: [{ name: name, params: enrichedParams }]
  });
}

// Shared Fire-and-Forget POST Request Dispatcher.
// [TEL.C]
function sendJSON(url, body) {
  if (!url) return;
  try {
    const controller = ('AbortController' in window) ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), 5000) : null;
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      keepalive: true,
      signal: controller ? controller.signal : undefined
    // [TEL.D]
    }).catch(() => { /* offline / unreachable -- silently drop, never retry-spam */ })
    // [TEL.E]
      .finally(() => { if (timeoutId) clearTimeout(timeoutId); });
  } catch (e) {
    // fetch not available
  }
}

// ============================================================================
// [TEL.F] CloudBackend — Универсальный адаптер под Firebase (Auth + Firestore + RemoteConfig)
// Работает поверх легкого REST API без необходимости подключать тяжелый npm-бандл.
// Пока FIREBASE_CONFIG.enabled === false, все методы мгновенно возвращают false/null.
// ============================================================================
const CloudBackend = {
  status: 'DISABLED', // 'DISABLED' | 'INIT' | 'READY' | 'ERROR'
  uid: null,
  idToken: null,
  refreshToken: null,
  tokenExpiresAt: 0,
  lastSyncTime: 0,
  remoteConfig: {},

  isConfigured: function () {
    return !!(FIREBASE_CONFIG && FIREBASE_CONFIG.enabled && FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.projectId);
  },

  isReady: function () {
    return this.status === 'READY' && !!this.uid && !!this.idToken;
  },

  // [TEL.G] Инициализация и тихая анонимная авторизация (Firebase Anonymous Auth)
  init: async function () {
    if (!this.isConfigured()) {
      this.status = 'DISABLED';
      return false;
    }
    this.status = 'INIT';

    try {
      const cachedRaw = localStorage.getItem(FIREBASE_AUTH_STORAGE_KEY);
      if (cachedRaw) {
        const cached = JSON.parse(cachedRaw);
        if (cached && cached.uid && cached.refreshToken) {
          this.uid = cached.uid;
          this.idToken = cached.idToken || null;
          this.refreshToken = cached.refreshToken;
          this.tokenExpiresAt = cached.tokenExpiresAt || 0;
        }
      }
    } catch (e) {}

    try {
      const now = Date.now();
      if (this.idToken && this.tokenExpiresAt > now + 60000) {
        this.status = 'READY';
        return true;
      }
      if (this.refreshToken) {
        const refreshed = await this._refreshIdToken();
        if (refreshed) {
          this.status = 'READY';
          return true;
        }
      }
      const signedIn = await this._signInAnonymously();
      this.status = signedIn ? 'READY' : 'ERROR';
      return signedIn;
    } catch (e) {
      this.status = 'ERROR';
      return false;
    }
  },

  // [TEL.H] Внутренние методы обмена токенами с IdentityToolkit REST API
  _signInAnonymously: async function () {
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(FIREBASE_CONFIG.apiKey)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ returnSecureToken: true })
    });
    if (!res.ok) return false;
    const data = await res.json();
    if (!data || !data.localId || !data.idToken) return false;

    this._saveSession(data.localId, data.idToken, data.refreshToken, Number(data.expiresIn) || 3600);
    return true;
  },

  _refreshIdToken: async function () {
    const url = `https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(FIREBASE_CONFIG.apiKey)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(this.refreshToken)}`
    });
    if (!res.ok) return false;
    const data = await res.json();
    if (!data || !data.user_id || !data.id_token) return false;

    this._saveSession(data.user_id, data.id_token, data.refresh_token, Number(data.expires_in) || 3600);
    return true;
  },

  _saveSession: function (uid, idToken, refreshToken, expiresInSec) {
    this.uid = uid;
    this.idToken = idToken;
    this.refreshToken = refreshToken;
    this.tokenExpiresAt = Date.now() + (expiresInSec * 1000);
    try {
      localStorage.setItem(FIREBASE_AUTH_STORAGE_KEY, JSON.stringify({
        uid: this.uid,
        idToken: this.idToken,
        refreshToken: this.refreshToken,
        tokenExpiresAt: this.tokenExpiresAt
      }));
    } catch (e) {}
  },

  // [TEL.I] Сохранение и загрузка игрового сейва из Cloud Firestore (коллекция saves/{uid})
  pushCloudSave: async function (savePayloadObj) {
    if (!this.isConfigured() || !savePayloadObj) return false;
    if (!this.isReady()) {
      const ok = await this.init();
      if (!ok) return false;
    }

    try {
      const docUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(FIREBASE_CONFIG.projectId)}/databases/(default)/documents/saves/${encodeURIComponent(this.uid)}`;
      const body = {
        fields: {
          clientId: { stringValue: getAnalyticsClientId() },
          appVersion: { stringValue: String(window.APP_VERSION || '1.38.32') },
          updatedAt: { integerValue: String(savePayloadObj.updatedAt || Date.now()) },
          maxUnlockedLevel: { integerValue: String(savePayloadObj.maxUnlockedLevel || 1) },
          diamonds: { integerValue: String(savePayloadObj.diamonds || 0) },
          prisms: { integerValue: String(savePayloadObj.prisms || 0) },
          payloadJson: { stringValue: JSON.stringify(savePayloadObj) }
        }
      };

      const res = await fetch(docUrl, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.idToken}`
        },
        body: JSON.stringify(body),
        keepalive: true
      });
      if (res.ok) {
        this.lastSyncTime = Date.now();
        return true;
      }
    } catch (e) {}
    return false;
  },

  pullCloudSave: async function () {
    if (!this.isConfigured()) return null;
    if (!this.isReady()) {
      const ok = await this.init();
      if (!ok) return null;
    }

    try {
      const docUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(FIREBASE_CONFIG.projectId)}/databases/(default)/documents/saves/${encodeURIComponent(this.uid)}`;
      const res = await fetch(docUrl, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${this.idToken}` },
        cache: 'no-store'
      });
      if (!res.ok) return null;
      const doc = await res.json();
      const rawJson = doc && doc.fields && doc.fields.payloadJson && doc.fields.payloadJson.stringValue;
      if (!rawJson) return null;
      return JSON.parse(rawJson);
    } catch (e) {
      return null;
    }
  },

  // [TEL.J] Запись краш-лога напрямую в Firestore (коллекция crashes)
  reportCrash: function (info, ver) {
    if (!this.isReady() || !info) return;
    try {
      const colUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(FIREBASE_CONFIG.projectId)}/databases/(default)/documents/crashes`;
      sendJSON(colUrl, {
        fields: {
          uid: { stringValue: String(this.uid || 'anon') },
          clientId: { stringValue: getAnalyticsClientId() },
          version: { stringValue: String(ver || 'unknown') },
          message: { stringValue: String(info.message || '').slice(0, 500) },
          source: { stringValue: `${info.source}:${info.lineno}:${info.colno}` },
          stack: { stringValue: String(info.stack || '').slice(0, 1500) },
          ua: { stringValue: String(info.ua || '') },
          ts: { stringValue: String(info.ts || new Date().toISOString()) }
        }
      });
    } catch (e) {}
  }
};

window.CloudBackend = CloudBackend;
