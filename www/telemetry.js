// Telemetry & Analytics Module: Best-effort crash reporting and event logging.

// Единая версия сборки (используется как фоллбэк в UI и в телеметрии)
window.APP_VERSION = '1.38.31';

// Флаг среды выполнения ('development' | 'production')
window.__APP_STAGE__ = window.__APP_STAGE__ || 'development';

// Эндпоинт для сбора краш-логов (укажите URL вашего Cloudflare Worker или оставьте '' для отключения)
const ERROR_WEBHOOK_URL = '';

// Эндпоинт для игровой аналитики GA4 / Cloudflare Worker (оставьте '' для отключения)
const ANALYTICS_ENDPOINT_URL = '';
const ANALYTICS_CLIENT_ID_KEY = 'sectorDefenseTD_analytics_cid';

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
  if (!ERROR_WEBHOOK_URL || !info) return;
  const ver = (window.SyncTelemetry && window.SyncTelemetry.localVersion && window.SyncTelemetry.localVersion !== '—')
    ? window.SyncTelemetry.localVersion
    : (window.APP_VERSION || '1.38.31');

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
    crash: info,
    content: lines.join('\n')
  });
};

// [TEL.B]
function trackEvent(name, params) {
  if (!ANALYTICS_ENDPOINT_URL) return;
  const ver = (window.SyncTelemetry && window.SyncTelemetry.localVersion && window.SyncTelemetry.localVersion !== '—')
    ? window.SyncTelemetry.localVersion
    : (window.APP_VERSION || '1.38.31');

  const enrichedParams = Object.assign({ app_version: ver }, params || {});
  sendJSON(ANALYTICS_ENDPOINT_URL, {
    client_id: getAnalyticsClientId(),
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