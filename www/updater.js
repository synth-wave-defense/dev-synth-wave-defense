// Synth Wave Defense -- updater.js
// OTA Live Updates Manager & Asset Synchronization Pipeline

(function () {
  'use strict';

  const REMOTE_MANIFEST_URL = 'https://raw.githubusercontent.com/synth-wave-defense/dev-synth-wave-defense/main/www/update_manifest.json';
  const LOCAL_MANIFEST_PATH = 'update_manifest.json';
  const REQUEST_TIMEOUT_MS = 8000;

  // Глобальный объект диагностики для вкладки VERSION в Dev Mode
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
    logs: []
  };

  function logOta(msg) {
    const timeStr = new Date().toLocaleTimeString();
    const line = `[${timeStr}] ${msg}`;
    console.log('[Updater]', msg);
    OtaDiagnostics.logs.push(line);
    if (OtaDiagnostics.logs.length > 12) OtaDiagnostics.logs.shift();
  }

  window.OtaDiagnostics = OtaDiagnostics;

  function getPlugin(name) {
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins[name]) {
      return window.Capacitor.Plugins[name];
    }
    return null;
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
      OtaDiagnostics.activeBundleInfo = 'err: ' + (e.message || e);
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
      OtaDiagnostics.downloadedBundlesList = 'err: ' + (e.message || e);
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

  function createCriticalOverlay() {
    let overlay = document.getElementById('critical-update-overlay');
    if (overlay) return overlay;

    overlay = document.createElement('div');
    overlay.id = 'critical-update-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.backgroundColor = '#0b001a';
    overlay.style.color = '#00f3ff';
    overlay.style.display = 'flex';
    overlay.style.flexDirection = 'column';
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';
    overlay.style.zIndex = '999999';
    overlay.style.fontFamily = 'monospace, sans-serif';

    overlay.innerHTML = `
      <div style="font-size: 20px; font-weight: bold; margin-bottom: 16px; text-shadow: 0 0 10px #00f3ff;">
        CRITICAL HOTFIX DETECTED
      </div>
      <div id="critical-update-status" style="font-size: 14px; margin-bottom: 12px; color: #ff007f;">
        Downloading critical assets...
      </div>
      <div style="width: 240px; height: 8px; background: #220044; border-radius: 4px; overflow: hidden; border: 1px solid #00f3ff;">
        <div id="critical-update-bar" style="width: 0%; height: 100%; background: #00f3ff; transition: width 0.2s;"></div>
      </div>
    `;

    document.body.appendChild(overlay);
    return overlay;
  }

  function updateCriticalProgress(percent, text) {
    const bar = document.getElementById('critical-update-bar');
    const status = document.getElementById('critical-update-status');
    if (bar && percent != null) bar.style.width = `${percent}%`;
    if (status && text) status.innerText = text;
  }

  let progressListenerBound = false;

  const AppUpdater = {
    lastDownloadedBundle: null,

    init: async function () {
      OtaDiagnostics.step = 'INIT_START';
      OtaDiagnostics.lastError = 'none';
      logOta('Starting OTA check...');

      const UpdaterPlugin = getPlugin('CapacitorUpdater');
      OtaDiagnostics.pluginAvailable = !!UpdaterPlugin;

      if (UpdaterPlugin) {
        // Слушатель процентов скачивания
        if (!progressListenerBound && typeof UpdaterPlugin.addListener === 'function') {
          progressListenerBound = true;
          try {
            UpdaterPlugin.addListener('download', (info) => {
              if (info && info.percent != null) {
                OtaDiagnostics.downloadProgress = Math.round(info.percent);
                OtaDiagnostics.downloadStatus = `DOWNLOADING (${OtaDiagnostics.downloadProgress}%)`;
              }
            });
            UpdaterPlugin.addListener('downloadFailed', (info) => {
              OtaDiagnostics.downloadStatus = 'FAILED_EVENT';
              OtaDiagnostics.lastError = 'downloadFailed event: ' + JSON.stringify(info);
              logOta('Event downloadFailed: ' + JSON.stringify(info));
            });
          } catch (e) {}
        }

        // Подтверждаем успешный запуск текущей сборки
        try {
          await UpdaterPlugin.notifyAppReady();
          OtaDiagnostics.notifyReadyStatus = 'OK';
          logOta('notifyAppReady() OK');
        } catch (e) {
          OtaDiagnostics.notifyReadyStatus = 'ERR: ' + (e.message || e);
          logOta('notifyAppReady() failed: ' + (e.message || e));
        }

        await refreshPluginInternalState(UpdaterPlugin);
      } else {
        OtaDiagnostics.notifyReadyStatus = 'NO_PLUGIN (Browser)';
      }

      // 1. Читаем локальный манифест
      OtaDiagnostics.step = 'LOAD_LOCAL_MANIFEST';
      let localManifest = null;
      try {
        const localRes = await fetch(LOCAL_MANIFEST_PATH, { cache: 'no-store' });
        localManifest = await localRes.json();
        OtaDiagnostics.localVersion = (localManifest && localManifest.version) ? String(localManifest.version) : 'MISSING';
        logOta('Local version: ' + OtaDiagnostics.localVersion);
      } catch (e) {
        OtaDiagnostics.localVersion = 'ERROR';
        OtaDiagnostics.lastError = 'Local manifest: ' + (e.message || e);
        logOta('Failed local manifest: ' + (e.message || e));
      }

      if (window.MusicDownloader && localManifest) {
        window.MusicDownloader.setManifest(localManifest);
      }

      // 2. Проверяем сеть
      OtaDiagnostics.step = 'CHECK_NETWORK';
      const Network = getPlugin('Network');
      if (Network) {
        try {
          const status = await Network.getStatus();
          OtaDiagnostics.networkConnected = status.connected ? `YES (${status.connectionType || 'net'})` : 'NO (Offline)';
          if (!status.connected) {
            OtaDiagnostics.step = 'STOPPED_OFFLINE';
            logOta('Device offline, aborting.');
            return;
          }
        } catch (e) {
          OtaDiagnostics.networkConnected = 'ERR: ' + (e.message || e);
        }
      } else {
        OtaDiagnostics.networkConnected = navigator.onLine ? 'YES (Browser)' : 'NO';
      }

      // 3. Запрашиваем удаленный манифест с GitHub
      OtaDiagnostics.step = 'FETCH_REMOTE_MANIFEST';
      OtaDiagnostics.remoteFetchStatus = 'FETCHING...';
      let remoteManifest = null;
      try {
        remoteManifest = await fetchWithTimeout(REMOTE_MANIFEST_URL, REQUEST_TIMEOUT_MS);
        OtaDiagnostics.remoteFetchStatus = '200 OK';
        OtaDiagnostics.remoteVersion = (remoteManifest && remoteManifest.version) ? String(remoteManifest.version) : 'NO_VER_FIELD';
        OtaDiagnostics.bundleUrl = (remoteManifest && remoteManifest.bundleUrl) ? String(remoteManifest.bundleUrl) : 'NONE';
        logOta(`Remote manifest OK: v${OtaDiagnostics.remoteVersion}`);
      } catch (e) {
        OtaDiagnostics.remoteFetchStatus = 'FAILED: ' + (e.name === 'AbortError' ? 'TIMEOUT (8s)' : (e.message || e));
        OtaDiagnostics.lastError = 'Remote fetch: ' + (e.message || e);
        OtaDiagnostics.step = 'REMOTE_FETCH_ERROR';
        logOta('Remote manifest failed: ' + (e.message || e));
      }

      const activeManifest = remoteManifest || localManifest;

      // 4. Запускаем докачку музыки
      if (window.MusicDownloader && activeManifest) {
        window.MusicDownloader.startBackgroundDownload(activeManifest);
      }

      // 5. Сравниваем версии
      if (remoteManifest && remoteManifest.version && localManifest && localManifest.version) {
        const currentVersion = String(localManifest.version).trim();
        const targetVersion = String(remoteManifest.version).trim();

        if (targetVersion && targetVersion !== currentVersion) {
          OtaDiagnostics.updateNeeded = `YES (${currentVersion} -> ${targetVersion})`;
          logOta(`Update needed: ${currentVersion} -> ${targetVersion}`);
          await this.processBundleUpdate(remoteManifest);
        } else {
          OtaDiagnostics.updateNeeded = `NO (Up to date: ${currentVersion})`;
          OtaDiagnostics.step = 'UP_TO_DATE';
          logOta(`Up to date (${currentVersion})`);
        }
      } else {
        OtaDiagnostics.step = 'SKIPPED_COMPARISON';
      }
    },

    processBundleUpdate: async function (manifest) {
      const UpdaterPlugin = getPlugin('CapacitorUpdater');
      if (!UpdaterPlugin) {
        OtaDiagnostics.step = 'NO_PLUGIN_ABORT';
        OtaDiagnostics.downloadStatus = 'NO_PLUGIN';
        logOta('CapacitorUpdater plugin missing.');
        return;
      }

      const isCritical = !!manifest.critical;
      const downloadUrl = manifest.bundleUrl;
      const version = String(manifest.version).trim();

      if (!downloadUrl) {
        OtaDiagnostics.step = 'MISSING_BUNDLE_URL';
        OtaDiagnostics.lastError = 'bundleUrl is empty in remote manifest';
        logOta('No bundleUrl in manifest!');
        return;
      }

      // Проверяем, не скачан ли уже этот бандл ранее
      try {
        if (typeof UpdaterPlugin.list === 'function') {
          const listRes = await UpdaterPlugin.list();
          const existing = (listRes && listRes.bundles || []).find(b => b.version === version && (b.status === 'success' || b.status === 'pending'));
          if (existing && existing.id) {
            logOta(`Bundle v${version} already on disk (id:${existing.id}), queueing...`);
            this.lastDownloadedBundle = existing;
            OtaDiagnostics.downloadedBundleId = existing.id;
            OtaDiagnostics.downloadProgress = 100;
            OtaDiagnostics.downloadStatus = 'ALREADY_DOWNLOADED (100%)';
            if (typeof UpdaterPlugin.next === 'function') {
              await UpdaterPlugin.next({ id: existing.id });
              OtaDiagnostics.nextQueueStatus = 'QUEUED_FOR_NEXT_START (existing)';
              OtaDiagnostics.step = 'WAITING_RESTART';
            }
            await refreshPluginInternalState(UpdaterPlugin);
            return;
          }
        }
      } catch (e) {}

      OtaDiagnostics.step = 'DOWNLOADING_BUNDLE';
      OtaDiagnostics.downloadStatus = 'STARTING (0%)';
      OtaDiagnostics.downloadProgress = 0;
      logOta(`Downloading zip v${version}...`);

      if (isCritical) {
        createCriticalOverlay();
        updateCriticalProgress(10, 'Initiating hotfix...');

        try {
          updateCriticalProgress(40, 'Downloading hotfix bundle...');
          const bundle = await UpdaterPlugin.download({
            url: downloadUrl,
            version: version
          });

          this.lastDownloadedBundle = bundle;
          OtaDiagnostics.downloadedBundleId = bundle && bundle.id ? bundle.id : 'unknown';
          OtaDiagnostics.downloadProgress = 100;
          OtaDiagnostics.downloadStatus = 'DOWNLOADED (100%)';

          updateCriticalProgress(85, 'Applying changes...');
          await UpdaterPlugin.set({ id: bundle.id });
          OtaDiagnostics.nextQueueStatus = 'APPLIED_IMMEDIATELY';
          OtaDiagnostics.step = 'RELOADING';
        } catch (err) {
          OtaDiagnostics.downloadStatus = 'ERROR';
          OtaDiagnostics.lastError = 'Critical DL/Set: ' + (err && err.message ? err.message : JSON.stringify(err));
          OtaDiagnostics.step = 'CRITICAL_FAILED';
          logOta('Critical error: ' + OtaDiagnostics.lastError);
          const overlay = document.getElementById('critical-update-overlay');
          if (overlay) overlay.remove();
        }
      } else {
        try {
          const bundle = await UpdaterPlugin.download({
            url: downloadUrl,
            version: version
          });

          this.lastDownloadedBundle = bundle;
          OtaDiagnostics.downloadedBundleId = bundle && bundle.id ? bundle.id : 'unknown';
          OtaDiagnostics.downloadProgress = 100;
          OtaDiagnostics.downloadStatus = 'DOWNLOADED (100%)';
          logOta(`Download complete! ID: ${OtaDiagnostics.downloadedBundleId}`);

          OtaDiagnostics.step = 'SETTING_NEXT_BUNDLE';
          if (typeof UpdaterPlugin.next === 'function') {
            await UpdaterPlugin.next({ id: bundle.id });
            OtaDiagnostics.nextQueueStatus = 'QUEUED_FOR_NEXT_START (next OK)';
            logOta('next({id}) succeeded! Ready for cold restart.');
          } else {
            await UpdaterPlugin.set({ id: bundle.id });
            OtaDiagnostics.nextQueueStatus = 'SET_CALLED_FALLBACK';
            logOta('set({id}) fallback called.');
          }
          OtaDiagnostics.step = 'WAITING_RESTART';
          await refreshPluginInternalState(UpdaterPlugin);
        } catch (err) {
          OtaDiagnostics.downloadStatus = 'FAILED';
          OtaDiagnostics.lastError = (err && err.message) ? err.message : JSON.stringify(err);
          OtaDiagnostics.step = 'DOWNLOAD_OR_NEXT_ERROR';
          logOta('BG Update Error: ' + OtaDiagnostics.lastError);
          await refreshPluginInternalState(UpdaterPlugin);
        }
      }
    },

    // Принудительное применение скачанного бандла по кнопке APPLY NOW в девтулах
    forceApplyNow: async function () {
      const UpdaterPlugin = getPlugin('CapacitorUpdater');
      if (!UpdaterPlugin) {
        logOta('No plugin to apply.');
        return;
      }
      try {
        let targetId = this.lastDownloadedBundle && this.lastDownloadedBundle.id;
        if (!targetId && typeof UpdaterPlugin.list === 'function') {
          const listRes = await UpdaterPlugin.list();
          const bundles = (listRes && listRes.bundles) || [];
          if (bundles.length > 0) targetId = bundles[bundles.length - 1].id;
        }
        if (!targetId) {
          logOta('No downloaded bundle found to apply!');
          OtaDiagnostics.lastError = 'No bundle ID available for APPLY NOW';
          return;
        }
        logOta('Force calling set({id: ' + targetId + '})...');
        await UpdaterPlugin.set({ id: targetId });
      } catch (e) {
        OtaDiagnostics.lastError = 'Force apply err: ' + (e.message || e);
        logOta('Force apply failed: ' + (e.message || e));
      }
    }
  };

  window.AppUpdater = AppUpdater;
})();