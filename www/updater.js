// Synth Wave Defense -- updater.js
// OTA Live Updates Manager & Asset Synchronization Pipeline

(function () {
  'use strict';

  const REMOTE_MANIFEST_URL = 'https://raw.githubusercontent.com/synth-wave-defense/dev-synth-wave-defense/main/www/update_manifest.json';
  const LOCAL_MANIFEST_PATH = 'update_manifest.json';
  const REQUEST_TIMEOUT_MS = 8000; // Увеличено до 8 сек, чтобы GitHub Raw успевал ответить

  function getPlugin(name) {
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins[name]) {
      return window.Capacitor.Plugins[name];
    }
    return null;
  }

  async function fetchWithTimeout(url, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      // Добавляем анти-кэш параметр, чтобы телефон не читал старый манифест из кэша WebView
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

  const AppUpdater = {
    init: async function () {
      console.log('[Updater] Initializing OTA & Music update check...');

      // Первым делом подтверждаем работоспособность текущей сборки
      const UpdaterPlugin = getPlugin('CapacitorUpdater');
      if (UpdaterPlugin) {
        try {
          await UpdaterPlugin.notifyAppReady();
          console.log('[Updater] notifyAppReady confirmed.');
        } catch (e) {
          console.warn('[Updater] notifyAppReady error:', e);
        }
      }

      // 1. Load local base manifest
      let localManifest = null;
      try {
        const localRes = await fetch(LOCAL_MANIFEST_PATH, { cache: 'no-store' });
        localManifest = await localRes.json();
      } catch (e) {
        console.warn('[Updater] Failed to load local update_manifest.json:', e);
      }

      if (window.MusicDownloader && localManifest) {
        window.MusicDownloader.setManifest(localManifest);
      }

      // 2. Check network connectivity
      const Network = getPlugin('Network');
      if (Network) {
        try {
          const status = await Network.getStatus();
          if (!status.connected) {
            console.log('[Updater] Device is offline. Proceeding with current build.');
            return;
          }
        } catch (e) {
          console.warn('[Updater] Network status check failed:', e);
        }
      }

      // 3. Query remote manifest
      let remoteManifest = null;
      try {
        remoteManifest = await fetchWithTimeout(REMOTE_MANIFEST_URL, REQUEST_TIMEOUT_MS);
      } catch (e) {
        console.log('[Updater] Remote manifest unavailable or timed out. Continuing offline.');
      }

      const activeManifest = remoteManifest || localManifest;

      // 4. Trigger background music downloader queue
      if (window.MusicDownloader && activeManifest) {
        window.MusicDownloader.startBackgroundDownload(activeManifest);
      }

      // 5. Evaluate OTA bundle updates
      if (remoteManifest && remoteManifest.version && localManifest && localManifest.version) {
        const currentVersion = String(localManifest.version).trim();
        const targetVersion = String(remoteManifest.version).trim();

        if (targetVersion && targetVersion !== currentVersion) {
          console.log(`[Updater] Update available: ${currentVersion} -> ${targetVersion}`);
          await this.processBundleUpdate(remoteManifest);
        } else {
          console.log(`[Updater] App is up to date (${currentVersion}).`);
        }
      }
    },

    processBundleUpdate: async function (manifest) {
      const UpdaterPlugin = getPlugin('CapacitorUpdater');
      if (!UpdaterPlugin) {
        console.warn('[Updater] CapacitorUpdater plugin is missing (browser environment)');
        return;
      }

      const isCritical = !!manifest.critical;
      const downloadUrl = manifest.bundleUrl;
      const version = manifest.version;

      if (!downloadUrl) {
        console.warn('[Updater] No bundleUrl found in manifest.');
        return;
      }

      if (isCritical) {
        createCriticalOverlay();
        updateCriticalProgress(10, 'Initiating hotfix...');

        try {
          updateCriticalProgress(40, 'Downloading hotfix bundle...');
          const bundle = await UpdaterPlugin.download({
            url: downloadUrl,
            version: version
          });

          updateCriticalProgress(85, 'Applying changes...');
          await UpdaterPlugin.set({ id: bundle.id });
        } catch (err) {
          console.error('[Updater] Critical update failed:', err);
          const overlay = document.getElementById('critical-update-overlay');
          if (overlay) overlay.remove();
        }
      } else {
        console.log('[Updater] Background OTA update queued silently for next launch.');
        try {
          const bundle = await UpdaterPlugin.download({
            url: downloadUrl,
            version: version
          });
          // Используем .next() для тихой активации при следующем холодном старте
          if (typeof UpdaterPlugin.next === 'function') {
            await UpdaterPlugin.next({ id: bundle.id });
          } else {
            await UpdaterPlugin.set({ id: bundle.id });
          }
          console.log('[Updater] Bundle ready. Will activate upon next cold start.');
        } catch (err) {
          console.warn('[Updater] Background download error:', err);
        }
      }
    }
  };

  window.AppUpdater = AppUpdater;
})();