// Synth Wave Defense -- dev/ota-service.dev.js
// Isolated Development Resource Sync Module (Excluded from Production builds)

const REMOTE_MANIFEST_URL = 'https://raw.githubusercontent.com/synth-wave-defense/dev-synth-wave-defense/main/www/update_manifest.json';
const LOCAL_MANIFEST_PATH = 'update_manifest.json';
const REQUEST_TIMEOUT_MS = 8000;
const PACK_CACHE_FILENAME = 'local_pack_cache.dat';

const SyncTelemetry = {
  step: 'IDLE',
  pluginAvailable: false,
  notifyReadyStatus: 'CHECKING',
  activeBundleInfo: 'builtin',
  downloadedBundlesList: 'none',
  networkConnected: 'unknown',
  localVersion: '—',
  remoteFetchStatus: 'NOT_STARTED',
  remoteVersion: '—',
  bundleUrl: '—',
  syncNeeded: '—',
  downloadStatus: 'IDLE',
  downloadProgress: 0,
  downloadedBundleId: '—',
  nextQueueStatus: 'IDLE',
  lastError: 'none',
  triageT1Fetch: '—',
  triageT2FsDl: '—',
  triageT3LocalSync: '—',
  triageT4DirectSync: '—',
  logs: []
};

window.SyncTelemetry = SyncTelemetry;

// [SYNC.A]
function logSync(msg) {
  const timeStr = new Date().toLocaleTimeString();
  const line = `[${timeStr}] ${msg}`;
  console.log('[AssetCache]', msg);
  SyncTelemetry.logs.push(line);
  if (SyncTelemetry.logs.length > 16) SyncTelemetry.logs.shift();
}

// [SYNC.B]
function getPlugin(name) {
  if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins[name]) {
    return window.Capacitor.Plugins[name];
  }
  return null;
}

// [SYNC.C]
function formatErr(err) {
  if (!err) return 'unknown';
  if (typeof err === 'string') return err;
  if (err.message) return err.message;
  try { return JSON.stringify(err); } catch (e) { return String(err); }
}

let lastBadPackVersion = '';

// [SYNC.D]
function refreshNativeBridgeStatus() {
  const bridge = window.AssetCacheManager;
  if (bridge && typeof bridge.getStatusJson === 'function') {
    try {
      const st = JSON.parse(bridge.getStatusJson());
      lastBadPackVersion = st.badVersion || '';
      SyncTelemetry.pluginAvailable = true;
      SyncTelemetry.notifyReadyStatus = `Cache OK (${st.bootStatus || 'OK'})`;
      SyncTelemetry.activeBundleInfo = `act:${st.activeVersion} (prev:${st.prevVersion || 'builtin'}) | ${st.bootLog}`;
      SyncTelemetry.downloadedBundlesList = `pend:${st.pendingVersion} | bad:${lastBadPackVersion || 'none'}`;
      SyncTelemetry.triageT4DirectSync = `Boot: ${st.bootLog || 'ok'}`;
    } catch (e) {
      SyncTelemetry.notifyReadyStatus = 'Cache JSON Err';
    }
  } else {
    SyncTelemetry.pluginAvailable = false;
    SyncTelemetry.notifyReadyStatus = 'NO_MANAGER';
    SyncTelemetry.triageT4DirectSync = 'Built-in mode';
  }
}

// [SYNC.E]
async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${url}?t=${Date.now()}`, {
      signal: controller.signal,
      cache: 'no-store'
    });
    clearTimeout(timer);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

// [SYNC.F]
const ResourceSync = {
  init: async function () {
    SyncTelemetry.step = 'INIT_START';
    SyncTelemetry.lastError = 'none';
    SyncTelemetry.triageT1Fetch = '—';
    SyncTelemetry.triageT2FsDl = '—';
    SyncTelemetry.triageT3LocalSync = '—';
    logSync('Checking resource manifest...');

    refreshNativeBridgeStatus();

    // 1. Локальный манифест
    let localManifest = null;
    try {
      const localRes = await fetch(`${LOCAL_MANIFEST_PATH}?t=${Date.now()}`, { cache: 'no-store' });
      localManifest = await localRes.json();
      SyncTelemetry.localVersion = (localManifest && localManifest.version) ? String(localManifest.version) : 'MISSING';
    } catch (e) {
      SyncTelemetry.localVersion = 'ERROR';
      SyncTelemetry.lastError = 'Local: ' + formatErr(e);
    }

    const verLabel = document.getElementById('settingsVersionLabel');
    if (verLabel && SyncTelemetry.localVersion && SyncTelemetry.localVersion !== '—') {
      verLabel.textContent = (typeof window.t === 'function')
        ? window.t('version_label', { v: SyncTelemetry.localVersion })
        : `Version: ${SyncTelemetry.localVersion}`;
    }

    if (window.MusicDownloader && localManifest) {
      window.MusicDownloader.setManifest(localManifest);
    }

    // 2. Сеть
    const Network = getPlugin('Network');
    if (Network) {
      try {
        const status = await Network.getStatus();
        SyncTelemetry.networkConnected = status.connected ? `YES (${status.connectionType || 'net'})` : 'NO';
        if (!status.connected) {
          SyncTelemetry.step = 'OFFLINE';
          return;
        }
      } catch (e) {}
    }

    // 3. Удаленный манифест
    SyncTelemetry.step = 'FETCH_MANIFEST';
    let remoteManifest = null;
    try {
      remoteManifest = await fetchWithTimeout(REMOTE_MANIFEST_URL, REQUEST_TIMEOUT_MS);
      SyncTelemetry.remoteFetchStatus = '200 OK';
      SyncTelemetry.remoteVersion = String(remoteManifest.version || 'NONE');
      SyncTelemetry.bundleUrl = String(remoteManifest.bundleUrl || 'NONE');
    } catch (e) {
      SyncTelemetry.remoteFetchStatus = 'FAIL: ' + formatErr(e);
      SyncTelemetry.lastError = 'Manifest: ' + formatErr(e);
      SyncTelemetry.step = 'MANIFEST_ERR';
    }

    const activeManifest = remoteManifest || localManifest;
    if (window.MusicDownloader && activeManifest) {
      window.MusicDownloader.startBackgroundDownload(activeManifest);
    }

    // 4. Сравнение версий
    if (remoteManifest && remoteManifest.version && localManifest && localManifest.version) {
      const currentVersion = String(localManifest.version).trim();
      const targetVersion = String(remoteManifest.version).trim();

      if (targetVersion && targetVersion === lastBadPackVersion) {
        SyncTelemetry.syncNeeded = `SKIPPED_BAD (${targetVersion})`;
        SyncTelemetry.step = 'BAD_VER_BLOCKED';
        logSync(`Skipped incompatible pack ${targetVersion}`);
      } else if (targetVersion && targetVersion !== currentVersion) {
        SyncTelemetry.syncNeeded = `YES (${currentVersion}->${targetVersion})`;
        await this.processBundleSync(remoteManifest);
      } else {
        SyncTelemetry.syncNeeded = `NO (On ${currentVersion})`;
        SyncTelemetry.step = 'UP_TO_DATE';
        logSync(`Resources up to date (${currentVersion})`);
      }
    }
  },

  // [SYNC.G]
  processBundleSync: async function (manifest) {
    const Filesystem = getPlugin('Filesystem');
    const downloadUrl = manifest.bundleUrl;
    const version = String(manifest.version).trim();
    const isCritical = !!manifest.critical;

    // T1: Проверка доступности ресурса
    SyncTelemetry.step = 'T1_FETCH_CHECK';
    try {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 7000);
      const res = await fetch(downloadUrl, { method: 'GET', signal: ctrl.signal, cache: 'no-store' });
      clearTimeout(tid);
      const len = res.headers.get('content-length') || '?';
      if (res.body && res.body.cancel) { try { await res.body.cancel(); } catch (e) {} }
      if (!res.ok) {
        SyncTelemetry.triageT1Fetch = `FAIL (HTTP ${res.status})`;
        SyncTelemetry.lastError = `T1 HTTP ${res.status}`;
        return;
      }
      SyncTelemetry.triageT1Fetch = `PASS (${res.status}, ${Math.round(Number(len) / 1024 || 0)}KB)`;
    } catch (e1) {
      SyncTelemetry.triageT1Fetch = `FAIL (${formatErr(e1)})`;
      SyncTelemetry.lastError = 'T1: ' + formatErr(e1);
      return;
    }

    // T2: Сохранение пакета через Filesystem
    SyncTelemetry.step = 'T2_FS_DOWNLOAD';
    if (!Filesystem) {
      SyncTelemetry.triageT2FsDl = 'NO_FS_PLUGIN';
      return;
    }
    SyncTelemetry.triageT2FsDl = 'CACHING...';
    try {
      await Filesystem.downloadFile({
        url: downloadUrl,
        path: PACK_CACHE_FILENAME,
        directory: 'DATA'
      });
      const statRes = await Filesystem.stat({ path: PACK_CACHE_FILENAME, directory: 'DATA' });
      const sizeKb = statRes && statRes.size ? Math.round(statRes.size / 1024) : '?';
      SyncTelemetry.triageT2FsDl = `PASS (${sizeKb}KB cached)`;
      SyncTelemetry.downloadProgress = 100;
      logSync(`T2 cached ${sizeKb}KB`);
    } catch (e2) {
      SyncTelemetry.triageT2FsDl = `FAIL (${formatErr(e2)})`;
      SyncTelemetry.lastError = 'T2: ' + formatErr(e2);
      return;
    }

    // T3: Синхронизация через AssetCacheManager
    SyncTelemetry.step = 'T3_CACHE_SYNC';
    const bridge = window.AssetCacheManager;
    if (bridge && typeof bridge.syncResourcePack === 'function') {
      SyncTelemetry.triageT3LocalSync = 'SYNCING...';
      try {
        const result = bridge.syncResourcePack(PACK_CACHE_FILENAME, version, isCritical);
        logSync('Sync result: ' + result);
        if (result && result.startsWith('OK_')) {
          SyncTelemetry.triageT3LocalSync = `PASS (${result})`;
          SyncTelemetry.nextQueueStatus = isCritical ? 'APPLIED_NOW' : `READY (v${version} on restart)`;
          SyncTelemetry.step = 'READY_TO_APPLY';
          refreshNativeBridgeStatus();
        } else {
          SyncTelemetry.triageT3LocalSync = `FAIL (${result})`;
          SyncTelemetry.lastError = result;
          SyncTelemetry.step = 'SYNC_ERR';
        }
      } catch (e3) {
        SyncTelemetry.triageT3LocalSync = `FAIL (${formatErr(e3)})`;
        SyncTelemetry.lastError = 'T3: ' + formatErr(e3);
      }
    } else {
      SyncTelemetry.triageT3LocalSync = 'FAIL (No AssetCacheManager)';
      SyncTelemetry.lastError = 'AssetCacheManager not available';
    }
  },

  // [SYNC.H]
  forceApplyNow: async function () {
    const bridge = window.AssetCacheManager;
    if (bridge && typeof bridge.activateStagedPack === 'function') {
      try { sessionStorage.setItem('cache_manual_sync', '1'); } catch (e) {}
      const res = bridge.activateStagedPack();
      logSync('ActivatePack: ' + res);
      if (!res.startsWith('OK_')) {
        try { sessionStorage.removeItem('cache_manual_sync'); } catch (e) {}
        SyncTelemetry.lastError = res;
      } else {
        setTimeout(() => { window.location.reload(); }, 120);
      }
    } else {
      SyncTelemetry.lastError = 'No AssetCacheManager';
    }
  }
};

window.ResourceSync = ResourceSync;

export function runOtaUpdate() {
  return ResourceSync.init();
}