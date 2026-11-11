async function preloadRewardedAd() {
  if (!isAdsInitialized) {
    logAdEvent('Cannot preload: not initialized');
    return;
  }
  const bridge = window.NativeYandexAdsBridge || window.NativeAdsBridge;
  if (bridge && typeof bridge.loadRewardedAd === 'function') {
    try {
      // Если ролик уже загружен в нативной памяти — сразу синхронизируем статус без ожидания!
      if (typeof bridge.isRewardedAdReady === 'function' && bridge.isRewardedAdReady()) {
        isRewardAdReady = true;
        if (window.AdDiagnostics) window.AdDiagnostics.videoReady = true;
        logAdEvent('Reward Video READY (Cached)');
        return;
      }
      logAdEvent('Preloading Rewarded Ad...');
      bridge.loadRewardedAd(REWARDED_AD_UNIT_ID);
    } catch (err) {
      isRewardAdReady = false;
      if (window.AdDiagnostics) window.AdDiagnostics.videoReady = false;
      const errStr = (err && err.message) ? err.message : String(err);
      if (window.AdDiagnostics) window.AdDiagnostics.lastError = errStr;
      logAdEvent('Preload Failed: ' + errStr);
    }
  }
}

window.devPreloadRewardAd = function() {
  preloadRewardedAd();
};