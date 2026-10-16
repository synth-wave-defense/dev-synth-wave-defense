// Synth Wave Defense -- updater.js
// OTA Live Updates Manager & Multi-Stage Triage Pipeline

(function () {
  'use strict';

  const REMOTE_MANIFEST_URL = 'https://raw.githubusercontent.com/synth-wave-defense/dev-synth-wave-defense/main/www/update_manifest.json';
  const LOCAL_MANIFEST_PATH = 'update_manifest.json';
  const REQUEST_TIMEOUT_MS = 8000;

  const OtaDiagnostics = {
    step: 'IDLE',
    pluginAvailable: false,
    notifyReadyStatus: 'PENDING',
    activeBundleInfo: 'unknown',
    downloadedBundlesList: 'none',
    networkConnected: 'unknown',
    localVersion: '—',
    remoteFetchStatus: 'NOT_STARTED',
    remoteVersion: '—',
    bundleUrl: '—',
    updateNeeded: '—',
    downloadStatus: 'IDLE',
    downloadProgress: 0,
    downloadedBundleId: '—',
    nextQueueStatus: 'IDLE',
    lastError: 'none',
    // Результаты 4-ступенчатого триажа
    triageT1Fetch: '—',
    triageT2FsDl: '—',
    triageT3LocalUpd: '—',
    triageT4DirectUpd: '—',
    logs: []
  };

  function logOta(msg) {
    const timeStr = new Date().toLocaleTimeString();
    const line = `[${timeStr}] ${msg}`;
    console.log('[Updater]', msg);
    OtaDiagnostics.logs.push(line);
    if (OtaDiagnostics.logs.length > 16) OtaDiagnostics.logs.shift();
  }

  window.OtaDiagnostics = OtaDiagnostics;

  function getPlugin(name) {
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins[name]) {
      return window.Capacitor.Plugins[name];
    }
    return null;
  }

  function formatErr(err) {
    if (!err) return 'unknown';
    if (typeof err === 'string') return err;
    const parts = [];
    if (err.code) parts.push(`code:${err.code}`);
    if (err.message) parts.push(err.message);
    if (err.error) parts.push(`err:${err.error}`);
    if (!parts.length) {
      try { return JSON.stringify(err); } catch (e) { return String(err); }
    }
    return parts.join(' | ');
  }

  async function refreshPluginInternalState(UpdaterPlugin) {
    if (!UpdaterPlugin) return;
    try {
      if (typeof UpdaterPlugin.current === 'function') {
        const cur = await UpdaterPlugin.current();
        if (cur && cur.bundle) {
          OtaDiagnostics.activeBundleInfo = `${cur.bundle.version || 'builtin'} (id:${cur.bundle.id || 'builtin'}, st:${cur.bundle.status || 'ok'})`;
        } else {
          OtaDiagnostics.activeBundleInfo = JSON.stringify(cur);
        }
      }
    } catch (e) {
      OtaDiagnostics.activeBundleInfo = 'err: ' + formatErr(e);
    }

    try {
      if (typeof UpdaterPlugin.list === 'function') {
        const listRes = await UpdaterPlugin.list();
        const bundles = (listRes && listRes.bundles) ? listRes.bundles : [];
        if (bundles.length === 0) {
          OtaDiagnostics.downloadedBundlesList = '0 bundles';
        } else {
          OtaDiagnostics.downloadedBundlesList = bundles
            .map(b => `${b.version}[${b.id}:${b.status}]`)
            .join(', ');
        }
      }
    } catch (e) {
      OtaDiagnostics.downloadedBundlesList = 'err: ' + formatErr(e);
    }
  }

  async function fetchWithTimeout(url, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const cacheBusterUrl = `${url}?t=${Date.now()}`;
      const response = await fetch(cacheBusterUrl, {
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

  let progressListenerBound = false;

  const AppUpdater = {
    lastDownloadedBundle: null,

    init: async function () {
      OtaDiagnostics.step = 'INIT_START';
      OtaDiagnostics.lastError = 'none';
      OtaDiagnostics.triageT1Fetch = '—';
      OtaDiagnostics.triageT2FsDl = '—';
      OtaDiagnostics.triageT3LocalUpd = '—';
      OtaDiagnostics.triageT4DirectUpd = '—';
      logOta('Starting OTA check...');

      const UpdaterPlugin = getPlugin('CapacitorUpdater');
      OtaDiagnostics.pluginAvailable = !!UpdaterPlugin;

      if (UpdaterPlugin) {
        if (!progressListenerBound && typeof UpdaterPlugin.addListener === 'function') {
          progressListenerBound = true;
          try {
            UpdaterPlugin.addListener('download', (info) => {
              if (info && info.percent != null) {
                OtaDiagnostics.downloadProgress = Math.round(info.percent);
                OtaDiagnostics.downloadStatus = `DL (${OtaDiagnostics.downloadProgress}%)`;
              }
            });
            UpdaterPlugin.addListener('downloadFailed', (info) => {
              logOta('Event downloadFailed: ' + JSON.stringify(info));
            });
            UpdaterPlugin.addListener('updateFailed', (info) => {
              logOta('Event updateFailed: ' + JSON.stringify(info));
            });
          } catch (e) {}
        }

        try {
          await UpdaterPlugin.notifyAppReady();
          OtaDiagnostics.notifyReadyStatus = 'OK';
        } catch (e) {
          OtaDiagnostics.notifyReadyStatus = 'ERR: ' + formatErr(e);
        }

        await refreshPluginInternalState(UpdaterPlugin);
      } else {
        OtaDiagnostics.notifyReadyStatus = 'NO_PLUGIN';
      }

      // 1. Локальный манифест
      OtaDiagnostics.step = 'LOAD_LOCAL_MANIFEST';
      let localManifest = null;
      try {
        const localRes = await fetch(LOCAL_MANIFEST_PATH, { cache: 'no-store' });
        localManifest = await localRes.json();
        OtaDiagnostics.localVersion = (localManifest && localManifest.version) ? String(localManifest.version) : 'MISSING';
      } catch (e) {
        OtaDiagnostics.localVersion = 'ERROR';
        OtaDiagnostics.lastError = 'Local manifest: ' + formatErr(e);
      }

      if (window.MusicDownloader && localManifest) {
        window.MusicDownloader.setManifest(localManifest);
      }

      // 2. Сеть
      OtaDiagnostics.step = 'CHECK_NETWORK';
      const Network = getPlugin('Network');
      if (Network) {
        try {
          const status = await Network.getStatus();
          OtaDiagnostics.networkConnected = status.connected ? `YES (${status.connectionType || 'net'})` : 'NO';
          if (!status.connected) {
            OtaDiagnostics.step = 'STOPPED_OFFLINE';
            return;
          }
        } catch (e) {
          OtaDiagnostics.networkConnected = 'ERR';
        }
      }

      // 3. Удаленный манифест
      OtaDiagnostics.step = 'FETCH_REMOTE_MANIFEST';
      OtaDiagnostics.remoteFetchStatus = 'FETCHING...';
      let remoteManifest = null;
      try {
        remoteManifest = await fetchWithTimeout(REMOTE_MANIFEST_URL, REQUEST_TIMEOUT_MS);
        OtaDiagnostics.remoteFetchStatus = '200 OK';
        OtaDiagnostics.remoteVersion = (remoteManifest && remoteManifest.version) ? String(remoteManifest.version) : 'NONE';
        OtaDiagnostics.bundleUrl = (remoteManifest && remoteManifest.bundleUrl) ? String(remoteManifest.bundleUrl) : 'NONE';
        logOta(`Remote v${OtaDiagnostics.remoteVersion}`);
      } catch (e) {
        OtaDiagnostics.remoteFetchStatus = 'FAIL: ' + formatErr(e);
        OtaDiagnostics.lastError = 'Remote fetch: ' + formatErr(e);
        OtaDiagnostics.step = 'REMOTE_FETCH_ERROR';
      }

      const activeManifest = remoteManifest || localManifest;

      // 4. Музыка
      if (window.MusicDownloader && activeManifest) {
        window.MusicDownloader.startBackgroundDownload(activeManifest);
      }

      // 5. Сравнение версий и запуск триажа
      if (remoteManifest && remoteManifest.version && localManifest && localManifest.version) {
        const currentVersion = String(localManifest.version).trim();
        const targetVersion = String(remoteManifest.version).trim();

        if (targetVersion && targetVersion !== currentVersion) {
          OtaDiagnostics.updateNeeded = `YES (${currentVersion}->${targetVersion})`;
          await this.processBundleUpdate(remoteManifest);
        } else {
          OtaDiagnostics.updateNeeded = `NO (${currentVersion})`;
          OtaDiagnostics.step = 'UP_TO_DATE';
        }
      }
    },

    processBundleUpdate: async function (manifest) {
      const UpdaterPlugin = getPlugin('CapacitorUpdater');
      const Filesystem = getPlugin('Filesystem');
      const downloadUrl = manifest.bundleUrl;
      const version = String(manifest.version).trim();

      if (!UpdaterPlugin) {
        OtaDiagnostics.step = 'NO_PLUGIN';
        return;
      }

      // --- ТЕСТ T1: Проверяем доступность ZIP через браузерный fetch (HEAD/GET) ---
      OtaDiagnostics.step = 'TRIAGE_T1_FETCH';
      OtaDiagnostics.triageT1Fetch = 'RUNNING...';
      try {
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), 7000);
        const res = await fetch(downloadUrl, { method: 'GET', signal: ctrl.signal, cache: 'no-store' });
        clearTimeout(tid);
        const len = res.headers.get('content-length') || '?';
        // Читаем только статус, закрываем поток
        if (res.body && res.body.cancel) { try { await res.body.cancel(); } catch (e) {} }
        if (res.ok) {
          OtaDiagnostics.triageT1Fetch = `PASS (${res.status}, ${Math.round(Number(len)/1024 || 0)}KB)`;
          logOta('T1 Fetch PASS: ' + OtaDiagnostics.triageT1Fetch);
        } else {
          OtaDiagnostics.triageT1Fetch = `FAIL (HTTP ${res.status})`;
          logOta('T1 Fetch FAIL: HTTP ' + res.status);
        }
      } catch (e1) {
        OtaDiagnostics.triageT1Fetch = `FAIL (${formatErr(e1)})`;
        logOta('T1 Fetch ERR: ' + formatErr(e1));
      }

      // --- ТЕСТ T4: Пробуем штатный прямой CapacitorUpdater.download(remoteUrl) ---
      OtaDiagnostics.step = 'TRIAGE_T4_DIRECT';
      OtaDiagnostics.triageT4DirectUpd = 'RUNNING...';
      OtaDiagnostics.downloadStatus = 'DIRECT_DL...';
      try {
        const bundle = await UpdaterPlugin.download({
          url: downloadUrl,
          version: version
        });
        this.lastDownloadedBundle = bundle;
        OtaDiagnostics.downloadedBundleId = bundle && bundle.id ? bundle.id : 'ok';
        OtaDiagnostics.downloadProgress = 100;
        OtaDiagnostics.downloadStatus = 'DOWNLOADED (100%)';
        OtaDiagnostics.triageT4DirectUpd = `PASS (id:${OtaDiagnostics.downloadedBundleId})`;
        logOta('T4 Direct Updater PASS!');

        await this.activateBundle(UpdaterPlugin, bundle);
        return;
      } catch (e4) {
        OtaDiagnostics.triageT4DirectUpd = `FAIL (${formatErr(e4)})`;
        OtaDiagnostics.lastError = 'T4: ' + formatErr(e4);
        logOta('T4 Direct FAIL: ' + formatErr(e4));
      }

      // --- ТЕСТ T2: Если T4 упал, качаем ZIP через Filesystem (ТОЧНО КАК МУЗЫКУ!) ---
      OtaDiagnostics.step = 'TRIAGE_T2_FS_DL';
      if (!Filesystem) {
        OtaDiagnostics.triageT2FsDl = 'NO_FS_PLUGIN';
        return;
      }

      OtaDiagnostics.triageT2FsDl = 'DOWNLOADING...';
      OtaDiagnostics.downloadStatus = 'FS_BRIDGE_DL...';
      let localWebViewUrl = null;
      try {
        const dlRes = await Filesystem.downloadFile({
          url: downloadUrl,
          path: 'ota_probe_bundle.zip',
          directory: 'DATA'
        });
        const statRes = await Filesystem.stat({
          path: 'ota_probe_bundle.zip',
          directory: 'DATA'
        });
        const sizeKb = statRes && statRes.size ? Math.round(statRes.size / 1024) : '?';
        OtaDiagnostics.triageT2FsDl = `PASS (${sizeKb}KB on disk!)`;
        logOta(`T2 Filesystem PASS: ${sizeKb}KB saved!`);

        const uriObj = await Filesystem.getUri({
          path: 'ota_probe_bundle.zip',
          directory: 'DATA'
        });
        if (uriObj && uriObj.uri && window.Capacitor && typeof window.Capacitor.convertFileSrc === 'function') {
          localWebViewUrl = window.Capacitor.convertFileSrc(uriObj.uri);
        }
      } catch (e2) {
        OtaDiagnostics.triageT2FsDl = `FAIL (${formatErr(e2)})`;
        OtaDiagnostics.lastError = 'T2 FS: ' + formatErr(e2);
        OtaDiagnostics.step = 'T2_FS_FAILED';
        logOta('T2 Filesystem FAIL: ' + formatErr(e2));
        return;
      }

      // --- ТЕСТ T3: Скармливаем скачанный локальный файл в CapacitorUpdater ---
      if (localWebViewUrl) {
        OtaDiagnostics.step = 'TRIAGE_T3_LOCAL_UPD';
        OtaDiagnostics.triageT3LocalUpd = 'RUNNING...';
        try {
          logOta('T3 trying local URL: ' + localWebViewUrl);
          const bundle = await UpdaterPlugin.download({
            url: localWebViewUrl,
            version: version
          });
          this.lastDownloadedBundle = bundle;
          OtaDiagnostics.downloadedBundleId = bundle && bundle.id ? bundle.id : 'ok';
          OtaDiagnostics.downloadProgress = 100;
          OtaDiagnostics.downloadStatus = 'DOWNLOADED_VIA_FS (100%)';
          OtaDiagnostics.triageT3LocalUpd = `PASS (id:${OtaDiagnostics.downloadedBundleId})`;
          logOta('T3 Local Bridge PASS!');

          await this.activateBundle(UpdaterPlugin, bundle);
          return;
        } catch (e3) {
          OtaDiagnostics.triageT3LocalUpd = `FAIL (${formatErr(e3)})`;
          OtaDiagnostics.lastError = 'T3 Local: ' + formatErr(e3);
          OtaDiagnostics.step = 'ALL_UPDATER_DL_FAILED';
          logOta('T3 Local FAIL: ' + formatErr(e3));
        }
      }
    },

    activateBundle: async function (UpdaterPlugin, bundle) {
      OtaDiagnostics.step = 'SETTING_NEXT_BUNDLE';
      try {
        if (typeof UpdaterPlugin.next === 'function') {
          await UpdaterPlugin.next({ id: bundle.id });
          OtaDiagnostics.nextQueueStatus = 'QUEUED (next OK)';
        } else {
          await UpdaterPlugin.set({ id: bundle.id });
          OtaDiagnostics.nextQueueStatus = 'SET_OK';
        }
        OtaDiagnostics.step = 'WAITING_RESTART';
        logOta('Bundle queued! Restart app or tap APPLY NOW.');
      } catch (e) {
        OtaDiagnostics.nextQueueStatus = 'ERR: ' + formatErr(e);
        OtaDiagnostics.lastError = 'next/set: ' + formatErr(e);
      }
      await refreshPluginInternalState(UpdaterPlugin);
    },

    forceApplyNow: async function () {
      const UpdaterPlugin = getPlugin('CapacitorUpdater');
      if (!UpdaterPlugin) return;
      try {
        let targetId = this.lastDownloadedBundle && this.lastDownloadedBundle.id;
        if (!targetId && typeof UpdaterPlugin.list === 'function') {
          const listRes = await UpdaterPlugin.list();
          const bundles = (listRes && listRes.bundles) || [];
          if (bundles.length > 0) targetId = bundles[bundles.length - 1].id;
        }
        if (!targetId) {
          OtaDiagnostics.lastError = 'No bundle ID to apply';
          return;
        }
        await UpdaterPlugin.set({ id: targetId });
      } catch (e) {
        OtaDiagnostics.lastError = 'Apply err: ' + formatErr(e);
      }
    }
  };

  window.AppUpdater = AppUpdater;
})();