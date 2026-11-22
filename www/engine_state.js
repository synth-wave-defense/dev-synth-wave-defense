// ============================================================================
// Synth Wave Defense -- engine_state.js (Part 1 of 3)
// Global state, settings, audio/haptic wrappers, ads bridge, palettes,
// persistent save/load (localStorage + Firebase Cloud), and DOM helpers.
// Load order: engine_state.js -> engine_meta.js -> engine_combat.js
// ============================================================================

// Game Engine Module: Primary simulation state, game loop, persistent storage, and entity managers.
// Synth Wave Defense -- engine.js
//
// The simulation layer: everything about *what happens* in a match, with no
// opinion on how it's drawn or which screen is showing. Owns all mutable
// game state (gold, diamonds, towers/enemies/projectiles arrays, wave/level
// progress, save data) and the logic that changes it.

const canvas = document.getElementById('gameCanvas');
let ctx = canvas.getContext('2d');

const TILE_SIZE = 70;
const TOUCH_OFFSET_Y = 65;
let currentLevelSection = 1;

let COLS = 10;
let ROWS = 7;
let FIELD_WIDTH = COLS * TILE_SIZE;
let FIELD_HEIGHT = ROWS * TILE_SIZE;

let camZoom = 1.0;
let camX = 0;
let camY = 0;
let baseZoom = 1.0;
let minZoom = 1.0;
let maxZoom = 2.0;

let isPanning = false;
let panStartTouch = { x: 0, y: 0 };
let panStartCam = { x: 0, y: 0 };
let isMousePanning = false;
let mouseSpacePressed = false;
let panStartMouse = { x: 0, y: 0 };
let initialPinchDist = null;
let initialPinchZoom = 1.0;
let pinchCenterWorld = { x: 0, y: 0 };

let bossAlertScheduled = false;
let bossAlertShown = false;
let activeBossAlertType = null;
let bossAlertHideTimer = 0;
let newTowerBannerHideTimer = 0;

let cameraShakeTimer = 0;
let cameraShakeMaxDur = 0;
let cameraShakeIntensity = 0;

// [ENG.A]
function triggerCameraShake(dur = 0.5, intensity = 15, force = false) {
  if (!force && typeof settings !== 'undefined' && settings.screenShakeEnabled === false) return;
  if (dur <= 0 || intensity <= 0) return;
  const currentRemaining = (cameraShakeTimer > 0 && cameraShakeMaxDur > 0)
    ? cameraShakeIntensity * (cameraShakeTimer / cameraShakeMaxDur)
    : 0;
  if (intensity < currentRemaining) return;
  cameraShakeTimer = dur;
  cameraShakeMaxDur = dur;
  cameraShakeIntensity = intensity;
}

// [ENG.AM_SHAKE] Единый синхронизированный диспетчер тряски камеры и виброотклика
function triggerImpactFeedback(shakeTier, hapticTier = 'none', options = {}) {
  const opts = options || {};
  let effectiveShakeTier = shakeTier;
  if (opts.isSplash && typeof enemies !== 'undefined' && enemies.length > 18) {
    effectiveShakeTier = 'none';
  }

  let dur = 0;
  let intensity = 0;
  if (effectiveShakeTier === 'light') {
    dur = (typeof opts.dur === 'number') ? opts.dur : (opts.isSplash ? 0.13 : 0.14);
    intensity = (typeof opts.intensity === 'number') ? opts.intensity : 3;
  } else if (effectiveShakeTier === 'medium') {
    dur = (typeof opts.dur === 'number') ? opts.dur : 0.24;
    intensity = (typeof opts.intensity === 'number') ? opts.intensity : 7;
  } else if (effectiveShakeTier === 'heavy') {
    dur = (typeof opts.dur === 'number') ? opts.dur : 0.38;
    intensity = (typeof opts.intensity === 'number') ? opts.intensity : 14;
  }

  if (effectiveShakeTier && effectiveShakeTier !== 'none' && dur > 0 && intensity > 0) {
    triggerCameraShake(dur, intensity, !!opts.forceShake);
  }
  if (hapticTier && hapticTier !== 'none') {
    vibrate(hapticTier);
  }
}

// [ENG.AA_ADS] Диагностический объект рекламы для Dev-панели
window.AdDiagnostics = {
  pluginAvailable: false,
  isNative: false,
  initialized: false,
  videoReady: false,
  lastEvent: 'NONE',
  lastError: 'None',
  logs: []
};

function logAdEvent(msg) {
  const time = new Date().toTimeString().split(' ')[0];
  const line = `[${time}] ${msg}`;
  window.AdDiagnostics.logs.unshift(line);
  if (window.AdDiagnostics.logs.length > 20) window.AdDiagnostics.logs.pop();
  window.AdDiagnostics.lastEvent = msg;
  console.log('[AdsBridge]', line);
}

// Конфигурация рекламного блока (Тестовый ID для РСЯ: 'demo-rewarded-yandex')
const REWARDED_AD_UNIT_ID = 'demo-rewarded-yandex';
let isAdsInitialized = false;
let isRewardAdReady = false;
let activeAdCallbacks = { onRewarded: null, onNotRewarded: null, rewardedFlag: false };

// --- Глобальные обработчики событий нативного моста (вызываются из Java) ---

function handleAdLoaded() {
  isRewardAdReady = true;
  if (window.AdDiagnostics) {
    window.AdDiagnostics.videoReady = true;
  }
  logAdEvent('Reward Video READY');
}

function handleAdFailedToLoad(reason) {
  isRewardAdReady = false;
  const errStr = reason || 'Load failed';
  if (window.AdDiagnostics) {
    window.AdDiagnostics.videoReady = false;
    window.AdDiagnostics.lastError = errStr;
  }
  logAdEvent('Reward Ad Failed: ' + errStr);
}

function handleAdRewarded() {
  activeAdCallbacks.rewardedFlag = true;
  logAdEvent('Reward Granted');
}

function handleAdDismissed() {
  logAdEvent('Reward Ad Dismissed');
  isRewardAdReady = false;
  if (window.AdDiagnostics) {
    window.AdDiagnostics.videoReady = false;
  }

  const wasRewarded = activeAdCallbacks.rewardedFlag;
  const cbReward = activeAdCallbacks.onRewarded;
  const cbFail = activeAdCallbacks.onNotRewarded;

  // Очищаем коллбэки текущего показа
  activeAdCallbacks = { onRewarded: null, onNotRewarded: null, rewardedFlag: false };

  // Автоматическая фоновая предзагрузка следующего ролика
  preloadRewardedAd();

  if (wasRewarded) {
    if (typeof cbReward === 'function') cbReward();
  } else {
    if (typeof cbFail === 'function') cbFail();
  }
}

function handleAdFailedToShow(reason) {
  const errStr = reason || 'Show error';
  if (window.AdDiagnostics) {
    window.AdDiagnostics.videoReady = false;
    window.AdDiagnostics.lastError = errStr;
  }
  logAdEvent('Show Error: ' + errStr);
  isRewardAdReady = false;

  const cbFail = activeAdCallbacks.onNotRewarded;
  activeAdCallbacks = { onRewarded: null, onNotRewarded: null, rewardedFlag: false };

  preloadRewardedAd();
  if (typeof cbFail === 'function') cbFail();
}

// Привязываем оба формата имён (полная совместимость со всеми версиями MainActivity)
window.onNativeAdLoaded = handleAdLoaded;
window.onYandexAdLoaded = handleAdLoaded;

window.onNativeAdFailedToLoad = handleAdFailedToLoad;
window.onYandexAdFailedToLoad = handleAdFailedToLoad;

window.onNativeAdRewarded = handleAdRewarded;
window.onYandexAdRewarded = handleAdRewarded;

window.onNativeAdDismissed = handleAdDismissed;
window.onYandexAdDismissed = handleAdDismissed;

window.onNativeAdFailedToShow = handleAdFailedToShow;
window.onYandexAdFailedToShow = handleAdFailedToShow;

// [ENG.AB_ADS] Универсальная инициализация моста рекламы
async function initAdsBridge() {
  const isNative = typeof window.Capacitor !== 'undefined' && window.Capacitor.isNativePlatform();
  window.AdDiagnostics.isNative = isNative;

  const hasNativeBridge = typeof window.NativeYandexAdsBridge !== 'undefined' || typeof window.NativeAdsBridge !== 'undefined';
  const hasWebSdk = !!(window.Ya && window.Ya.Context && window.Ya.Context.AdvManager);
  window.AdDiagnostics.pluginAvailable = hasNativeBridge || hasWebSdk;

  if (hasNativeBridge) {
    try {
      logAdEvent('Initializing NativeAdsBridge...');
      const bridge = window.NativeYandexAdsBridge || window.NativeAdsBridge;
      bridge.initialize(REWARDED_AD_UNIT_ID);
      isAdsInitialized = true;
      window.AdDiagnostics.initialized = true;
      logAdEvent('Native Ads SDK initialized');
      preloadRewardedAd();
    } catch (err) {
      const errStr = (err && err.message) ? err.message : String(err);
      window.AdDiagnostics.lastError = errStr;
      logAdEvent('Init Error: ' + errStr);
    }
    return;
  }

  if (hasWebSdk) {
    isAdsInitialized = true;
    window.AdDiagnostics.initialized = true;
    isRewardAdReady = true;
    window.AdDiagnostics.videoReady = true;
    logAdEvent('Web Ads SDK ready');
    return;
  }

  logAdEvent('Native Ads Bridge NOT available (using Sim)');
}
window.initAdsBridge = initAdsBridge;

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

window.devShowRewardAd = function() {
  showAdPlaceholder(
    () => { if (typeof showHintToast === 'function') showHintToast('Dev: Ad Rewarded!'); },
    () => { if (typeof showHintToast === 'function') showHintToast('Dev: Ad Dismissed (No Reward)'); }
  );
};

// [ENG.B]
function hasClearedLevelBefore(lvl) {
  return maxUnlockedLevel > lvl;
}

// [ENG.C]
function getBaseDamageFor(e) {
  if (e.isBoss) return 5;
  if (e.isMiniBoss) {
    if (typeof currentLevel !== 'undefined' && currentLevel === 34) return 1;
    return 2;
  }
  return 1;
}

// [ENG.D]
function checkEnemyEnrage(e) {
  if (isOverdriveMode && e && e.hp > 0 && (e.hp / e.maxHp) <= 0.3 && !e.isEnraged) {
    e.isEnraged = true;
    e.baseSpeed *= 1.35;
    e.speed *= 1.35;
  }
}

// [ENG.E]
function getNewlyUnlockedTowers(lvl) {
  const cur = (LEVELS_DATA[lvl] && LEVELS_DATA[lvl].unlockedTowers) || [];
  const prev = (LEVELS_DATA[lvl - 1] && LEVELS_DATA[lvl - 1].unlockedTowers) || [];
  return cur.filter(t => !prev.includes(t));
}

let gameState = 'START';
let currentLevel = 1;
let settings = {
  showEnemyHp: true,
  showDamage: true,
  vibrationEnabled: true,
  screenShakeEnabled: true,
  perfModeOverride: null,
  sfxEnabled: true, musicEnabled: true,
  sfxVolume: 100, musicVolume: 70,
  lang: 'en'
};

// [ENG.F]
function sfx(name, arg) {
  if (!settings.sfxEnabled) return;
  try {
    if (typeof SFX !== 'undefined' && SFX) SFX.play(name, arg);
  } catch (e) { }
}
// [ENG.G]
function sfxDeath(enemy) {
  if (!settings.sfxEnabled) return;
  try {
    if (typeof SFX !== 'undefined' && SFX) SFX.death(enemy);
  } catch (e) {}
}
// [ENG.H]
function sfxBeam(kind, active, intensity) {
  if (!settings.sfxEnabled) return;
  try {
    if (typeof SFX !== 'undefined' && SFX) SFX.beam(kind, active, intensity);
  } catch (e) {}
}
// [ENG.I]
function sfxStopBeams() {
  try {
    if (typeof SFX !== 'undefined' && SFX) SFX.stopBeams();
  } catch (e) {}
}
// [ENG.J]
function sfxReap() {
  try {
    if (typeof SFX !== 'undefined' && SFX) SFX.reap();
  } catch (e) {}
}
// [ENG.K]
function sfxSetEnabled(on) {
  try {
    if (typeof SFX !== 'undefined' && SFX) SFX.setEnabled(on);
  } catch (e) {}
}
// [ENG.L]
function sfxSetVolume(v) {
  try {
    if (typeof SFX !== 'undefined' && SFX && SFX.setVolume) SFX.setVolume(v);
  } catch (e) {}
}

// [ENG.M]
function music(category) {
  try {
    if (typeof MusicManager !== 'undefined' && MusicManager) MusicManager.play(category);
  } catch (e) { }
}
// [ENG.N]
function musicSetEnabled(on) {
  try {
    if (typeof MusicManager !== 'undefined' && MusicManager) MusicManager.setEnabled(on);
  } catch (e) {}
}
// [ENG.O]
function musicSetVolume(v) {
  try {
    if (typeof MusicManager !== 'undefined' && MusicManager && MusicManager.setVolume) MusicManager.setVolume(v);
  } catch (e) {}
}
// [ENG.P]
function musicUnlock() {
  try {
    if (typeof MusicManager !== 'undefined' && MusicManager) MusicManager.unlock();
  } catch (e) {}
}
// [ENG.Q]
function musicSuspend() {
  try {
    if (typeof MusicManager !== 'undefined' && MusicManager) MusicManager.suspend();
  } catch (e) {}
}
// [ENG.R]
function musicResume() {
  try {
    if (typeof MusicManager !== 'undefined' && MusicManager) MusicManager.resume();
  } catch (e) {}
}
// [ENG.S]
function musicSetDucked(on, dur) {
  try {
    if (typeof MusicManager !== 'undefined' && MusicManager && MusicManager.setDucked) MusicManager.setDucked(on, dur);
  } catch (e) {}
}

// Функция вибрации (должна быть доступна глобально):
// [ENG.T]
function vibrate(type = 'light') {
  if (!settings || !settings.vibrationEnabled) return;
  try {
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Haptics) {
      const Haptics = window.Capacitor.Plugins.Haptics;
      if (type === 'light') Haptics.impact({ style: 'LIGHT' });
      else if (type === 'medium') Haptics.impact({ style: 'MEDIUM' });
      else if (type === 'heavy') Haptics.impact({ style: 'HEAVY' });
      else if (type === 'warning') Haptics.notification({ type: 'WARNING' });
      else if (type === 'error') Haptics.notification({ type: 'ERROR' });
      return;
    }
    if (navigator.vibrate) {
      if (type === 'light') navigator.vibrate(15);
      else if (type === 'medium') navigator.vibrate(30);
      else if (type === 'heavy') navigator.vibrate(50);
      else if (type === 'warning') navigator.vibrate([30, 50, 30]);
      else if (type === 'error') navigator.vibrate([60, 80, 60]);
    }
  } catch (e) {}
}

window.vibrate = vibrate;

let devMode = false;
let devInputOpen = false;
let suppressBackgroundPauseUntil = 0;
// [ENG.U]
function suppressBackgroundPause(ms = 900) {
  suppressBackgroundPauseUntil = Date.now() + ms;
}
let gameTimeScale = 1.0;
let isLivePaused = false;

let gold = 100;
let baseHp = 10;
let wave = 1;
let waveInProgress = false;
let autoWaveTimeRemaining = 0;
let waveTimerActive = false;
let fieldClearDelayTimer = 0;
let isWaveTimerAccelerated = false;
let waveTotalSpawnTime = 1.0;
let waveSpawnElapsedTime = 0;
let victoryDelayTimer = 0;

let selectedLoadout = [];
let activeBattleLoadout = [];
const LOADOUT_SIZE = 3;

let draggingTower = null;
let selectedTower = null;
let sellConfirmArmed = false;
let sellConfirmTimer = null;

let diamonds = 0;
let prisms = 0;
let maxUnlockedLevel = 1;
let clearedLevels = [];
let overdriveClearedLevels = {};
let isOverdriveMode = false;
let regularSpawnCounter = 0;
let levelStars = {};
let matchStartBaseHp = 10;

let isEndlessMode = false;
let endlessBestWavesBySection = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
let endlessBestWave = 0; // Оставляем для обратной совместимости
let endlessDailyRunsUsed = 0;
let endlessDailyRunsDate = '';
let endlessMilestonesClaimed = {};

let upgradesPreviousSource = 'main';
let lastVictoryDiamondsReward = 2;
let hasClaimedX2ThisLevel = false;

// Persistent Save State & LocalStorage Synchronization: Game progress serialization, save, and load pipeline.
// --- Gifts & Shop State ---
let dailyGiftsClaimedDate = '';
let dailyGiftsClaimedCount = 0; // 0, 1, 2 или 3 в день
let timeModTier = 0; // 0 = locked, 1 = Tier 1, 2 = Tier 2
let shopPreviousSource = 'start';

// --- Daily Login Calendar State ---
let lastLoginClaimDate = '';
let loginStreakDay = 1;
let hasAutoShownDailyLoginModalThisSession = false;
let dailyLoginDismissedThisSession = false;

// --- Synth Pass / Battle Pass State ---
let bpXp = 0;
let bpPremiumPurchased = false;
let bpClaimedFree = {};
let bpClaimedPrem = {};
let unlockedPalettes = ['default'];
let activePalette = 'default';
let sessionMobKillsCount = 0;

// [ENG.AA]
function addBpXp(amount) {
  if (!amount || amount <= 0) return;
  bpXp += amount;
  saveGameSoon();
  if (typeof updateBpProgressUI === 'function') {
    updateBpProgressUI();
  }
}

// Покупка Premium Synth Pass за 300 💎
function buyBpPremiumWithDiamonds() {
  const COST = 300;
  if (bpPremiumPurchased) {
    if (typeof showHintToast === 'function') showHintToast(typeof t === 'function' ? t('already_unlocked') : 'Already Owned');
    return false;
  }
  if (diamonds < COST) {
    if (typeof showHintToast === 'function') showHintToast(typeof t === 'function' ? t('not_enough_diamonds') : 'Not enough Diamonds!');
    vibrate('warning');
    return false;
  }

  diamonds -= COST;
  bpPremiumPurchased = true;
  if (!unlockedPalettes.includes('cyber_gold')) {
    unlockedPalettes.push('cyber_gold');
  }
  updateDiamondUI();
  saveGame();
  sfx('upgrade');
  vibrate('medium');

  if (typeof renderBattlePassScreen === 'function') renderBattlePassScreen();
  if (typeof updatePaletteSelectDropdown === 'function') {
    updatePaletteSelectDropdown('settingPaletteSelect');
    updatePaletteSelectDropdown('bpPaletteSelect');
  }
  if (typeof showHintToast === 'function') showHintToast(typeof t === 'function' ? t('prem_unlocked') : 'Premium Pass Unlocked!');
  safeTrack('bp_premium_unlocked_diamonds', { cost: COST });
  return true;
}
window.buyBpPremiumWithDiamonds = buyBpPremiumWithDiamonds;

// Покупка тем в магазине за 💎
function buyThemeWithDiamonds(paletteId, cost) {
  if (!paletteId || !cost) return false;
  if (!unlockedPalettes) unlockedPalettes = ['default'];

  if (unlockedPalettes.includes(paletteId)) {
    equipTheme(paletteId);
    return true;
  }

  if (diamonds < cost) {
    if (typeof showHintToast === 'function') showHintToast(typeof t === 'function' ? t('not_enough_diamonds') : 'Not enough Diamonds!');
    vibrate('warning');
    return false;
  }

  diamonds -= cost;
  unlockedPalettes.push(paletteId);
  activePalette = paletteId;
  applyPaletteColors(paletteId);
  updateDiamondUI();
  saveGame();

  sfx('upgrade');
  vibrate('medium');
  if (typeof renderShopScreen === 'function') renderShopScreen();
  if (typeof updatePaletteSelectDropdown === 'function') {
    updatePaletteSelectDropdown('settingPaletteSelect');
    updatePaletteSelectDropdown('bpPaletteSelect');
  }
  safeTrack('theme_purchased', { theme: paletteId, cost: cost });
  return true;
}
window.buyThemeWithDiamonds = buyThemeWithDiamonds;

// Экипировка уже купленной темы
function equipTheme(paletteId) {
  if (!unlockedPalettes || !unlockedPalettes.includes(paletteId)) return false;
  activePalette = paletteId;
  applyPaletteColors(paletteId);
  if (typeof renderShopScreen === 'function') renderShopScreen();
  saveGameSoon();
  return true;
}
window.equipTheme = equipTheme;

// Вспомогательные функции конвертации HEX -> RGB и осветления
// [ENG.AB]
function hexToRgbObj(hex) {
  let h = String(hex || '#00e5ff').replace('#', '').trim();
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const num = parseInt(h, 16) || 0;
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return {
    r, g, b,
    cssRgb: `${r}, ${g}, ${b}`,
    norm: [+(r / 255).toFixed(3), +(g / 255).toFixed(3), +(b / 255).toFixed(3)]
  };
}

// [ENG.AC]
function mixHexWithWhite(hex, whiteRatio = 0.45) {
  const { r, g, b } = hexToRgbObj(hex);
  const mr = Math.round(r + (255 - r) * whiteRatio);
  const mg = Math.round(g + (255 - g) * whiteRatio);
  const mb = Math.round(b + (255 - b) * whiteRatio);
  return '#' + [mr, mg, mb].map(x => x.toString(16).padStart(2, '0')).join('');
}

// [ENG.ACM]
// Смешивание двух HEX-цветов для создания уникальных оттенков башен в кастомных темах
function mixHexColors(hex1, hex2, ratio = 0.5) {
  const cA = hexToRgbObj(hex1);
  const cB = hexToRgbObj(hex2);
  const r = Math.round(cA.r + (cB.r - cA.r) * ratio);
  const g = Math.round(cA.g + (cB.g - cA.g) * ratio);
  const b = Math.round(cA.b + (cB.b - cA.b) * ratio);
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}

// [ENG.AD]
function darkenNormRgb(normArr, factor = 0.42) {
  return [
    +(normArr[0] * factor).toFixed(3),
    +(normArr[1] * factor).toFixed(3),
    +(normArr[2] * factor).toFixed(3)
  ];
}

// [ENG.AE]
function applyPaletteColors(paletteId) {
  const pId = (typeof NEON_PALETTES !== 'undefined' && NEON_PALETTES[paletteId]) ? paletteId : 'default';
  activePalette = pId;
  const def = (typeof NEON_PALETTES !== 'undefined' && NEON_PALETTES['default']) || {};
  const raw = (typeof NEON_PALETTES !== 'undefined' && NEON_PALETTES[pId]) || def;

  // 5 базовых цветовых слотов темы
  const c1 = raw.c1 || raw.primary || def.c1 || '#00e5ff';
  const c2 = raw.c2 || def.c2 || '#d946ef';
  const c3 = raw.c3 || raw.secondary || def.c3 || '#f05f9f';
  const c4 = raw.c4 || def.c4 || '#ff9100';
  const c5 = raw.c5 || def.c5 || '#38bdf8';
  const bg = raw.bg || def.bg || '#03050d';

  const rgb1 = hexToRgbObj(c1);
  const rgb2 = hexToRgbObj(c2);
  const rgb3 = hexToRgbObj(c3);
  const rgb4 = hexToRgbObj(c4);
  const rgb5 = hexToRgbObj(c5);

  const c1Light = mixHexWithWhite(c1, 0.48);
  const c2Light = mixHexWithWhite(c2, 0.48);
  const c3Light = mixHexWithWhite(c3, 0.45);
  const c4Light = mixHexWithWhite(c4, 0.45);
  const c5Light = mixHexWithWhite(c5, 0.45);

  // Для правой части туманности: в Cyber Gold берем теплый оранж/фуксию (c4/c3), в Blood Moon и Sakura — c3 (вместо фиолетового слота призм c2)
  const nebRightRgb = (pId === 'cyber_gold') ? rgb4 : ((pId === 'blood_moon' || pId === 'sakura_wave') ? rgb3 : rgb2);

  // Сохраняем глобальный объект текущей темы для Canvas (ui.js и engine.js)
  window.activeThemeColors = {
    id: pId,
    c1, c2, c3, c4, c5, bg,
    c1Light, c2Light, c3Light, c4Light, c5Light,
    rgb1, rgb2, rgb3, rgb4, rgb5,
    // Кластеры туманности: слева c1, справа nebRightRgb
    nebulaClusters: [
      { cx: 0.22, cy: 0.22, scale: 0.43, angle: 0.38, aspect: 0.65, intensity: 1.08, base: darkenNormRgb(rgb1.norm, 0.45), hot: rgb1.norm },
      { cx: 0.78, cy: 0.20, scale: 0.42, angle: -0.38, aspect: 0.65, intensity: 1.08, base: darkenNormRgb(nebRightRgb.norm, 0.45), hot: nebRightRgb.norm },
      { cx: 0.20, cy: 0.76, scale: 0.45, angle: -0.28, aspect: 0.70, intensity: 0.52, base: darkenNormRgb(rgb1.norm, 0.35), hot: rgb1.norm },
      { cx: 0.80, cy: 0.74, scale: 0.44, angle: 0.32, aspect: 0.70, intensity: 0.52, base: darkenNormRgb(nebRightRgb.norm, 0.35), hot: nebRightRgb.norm }
    ]
  };
  
  // Записываем все переменные в CSS :root
  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    if (root) {
      root.style.setProperty('--c1', c1);
      root.style.setProperty('--c2', c2);
      root.style.setProperty('--c3', c3);
      root.style.setProperty('--c4', c4);
      root.style.setProperty('--c5', c5);
      root.style.setProperty('--bg-dark', bg);

      root.style.setProperty('--c1-rgb', rgb1.cssRgb);
      root.style.setProperty('--c2-rgb', rgb2.cssRgb);
      root.style.setProperty('--c3-rgb', rgb3.cssRgb);
      root.style.setProperty('--c4-rgb', rgb4.cssRgb);
      root.style.setProperty('--c5-rgb', rgb5.cssRgb);

      root.style.setProperty('--c1-light', c1Light);
      root.style.setProperty('--c2-light', c2Light);
      root.style.setProperty('--c3-light', c3Light);
      root.style.setProperty('--c4-light', c4Light);
      root.style.setProperty('--c5-light', c5Light);

      // Обратная совместимость со старыми переменными
      root.style.setProperty('--neon-primary', c1);
      root.style.setProperty('--neon-secondary', c3);
      root.style.setProperty('--neon-glow', `rgba(${rgb1.cssRgb}, 0.8)`);
    }
    if (document.body) {
      document.body.setAttribute('data-theme', pId);
    }
  }

  // Индивидуальные цвета для всех 7 башен (в default — оригинальные цвета, в других темах — сдвиг оттенков в RGB)
  if (typeof TOWER_CONFIGS !== 'undefined' && TOWER_CONFIGS.gun) {
    if (pId === 'default') {
      TOWER_CONFIGS.gun.color = '#00e5ff'; TOWER_CONFIGS.gun.glow = '#00e5ff';
      TOWER_CONFIGS.laser.color = '#f05f9f'; TOWER_CONFIGS.laser.glow = '#f05f9f';
      TOWER_CONFIGS.mortar.color = '#ff9100'; TOWER_CONFIGS.mortar.glow = '#ff9100';
      TOWER_CONFIGS.tesla.color = '#00ffcc'; TOWER_CONFIGS.tesla.glow = '#00ffcc';
      TOWER_CONFIGS.stasis.color = '#38bdf8'; TOWER_CONFIGS.stasis.glow = '#38bdf8';
      TOWER_CONFIGS.melter.color = '#e85268'; TOWER_CONFIGS.melter.glow = '#e477a3';
      TOWER_CONFIGS.railgun.color = '#a275df'; TOWER_CONFIGS.railgun.glow = '#b57fdd';
    } else {
      // В кастомных темах разводим башни по оттенкам, чтобы все 7 отличались друг от друга:
      const teslaCol = mixHexColors(c1, '#00ffcc', 0.45); // сдвиг от основного в мятно-изумрудный
      const stasisCol = mixHexColors(c5, '#38bdf8', 0.35); // холодный ледяной оттенок c5
      const melterCol = mixHexColors(c3, c4, 0.38); // кораллово-алый между Laser (c3) и Splash (c4)
      const railgunCol = mixHexColors(c2, '#a275df', 0.30); // благородный фиолетовый сдвиг от c2

      TOWER_CONFIGS.gun.color = c1; TOWER_CONFIGS.gun.glow = c1Light;
      TOWER_CONFIGS.laser.color = c3; TOWER_CONFIGS.laser.glow = c3Light;
      TOWER_CONFIGS.mortar.color = c4; TOWER_CONFIGS.mortar.glow = c4Light;
      TOWER_CONFIGS.tesla.color = teslaCol; TOWER_CONFIGS.tesla.glow = mixHexWithWhite(teslaCol, 0.35);
      TOWER_CONFIGS.stasis.color = stasisCol;TOWER_CONFIGS.stasis.glow = mixHexWithWhite(stasisCol, 0.40);
      TOWER_CONFIGS.melter.color = melterCol;TOWER_CONFIGS.melter.glow = mixHexWithWhite(melterCol, 0.35);
      TOWER_CONFIGS.railgun.color = railgunCol; TOWER_CONFIGS.railgun.glow = mixHexWithWhite(railgunCol, 0.38);
    }

    // Записываем индивидуальные RGB-переменные каждой башни в CSS :root для кнопок постройки
    if (typeof document !== 'undefined' && document.documentElement) {
      const root = document.documentElement;
      Object.keys(TOWER_CONFIGS).forEach(tKey => {
        const tRgb = hexToRgbObj(TOWER_CONFIGS[tKey].color);
        root.style.setProperty(`--tower-${tKey}`, TOWER_CONFIGS[tKey].color);
        root.style.setProperty(`--tower-${tKey}-rgb`, tRgb.cssRgb);
      });
    }
  }

  // Цвета мобов и боссов: в default — оригинальные цвета из data.js, в других темах — стандартизированные слоты c1..c5
  if (typeof ENEMY_CONFIGS !== 'undefined' && ENEMY_CONFIGS.grunt) {
    if (pId === 'default') {
      ENEMY_CONFIGS.grunt.color = '#f05f9f'; ENEMY_CONFIGS.grunt.glow = '#f05f9f';
      ENEMY_CONFIGS.scout.color = '#ff9100'; ENEMY_CONFIGS.scout.glow = '#ffaa33';
      ENEMY_CONFIGS.tank.color = '#a06fdc'; ENEMY_CONFIGS.tank.glow = '#825cc2';
      ENEMY_CONFIGS.swarm.color = '#00ffcc'; ENEMY_CONFIGS.swarm.glow = '#00ffcc';
      ENEMY_CONFIGS.blinker.color = '#3b82f6'; ENEMY_CONFIGS.blinker.glow = '#60a5fa';
      ENEMY_CONFIGS.goliath.color = '#8964c4'; ENEMY_CONFIGS.goliath.glow = '#7050a4';
      ENEMY_CONFIGS.emp_bomber.color = '#38bdf8'; ENEMY_CONFIGS.emp_bomber.glow = '#f05f9f';
      ENEMY_CONFIGS.hive_empress.color = '#00ffcc'; ENEMY_CONFIGS.hive_empress.glow = '#00ffcc';
      ENEMY_CONFIGS.chronos_warp.color = '#3b82f6'; ENEMY_CONFIGS.chronos_warp.glow = '#60a5fa';
      ENEMY_CONFIGS.titan_core.color = '#f97316'; ENEMY_CONFIGS.titan_core.glow = '#fb923c';
      ENEMY_CONFIGS.emp_overlord.color = '#38bdf8'; ENEMY_CONFIGS.emp_overlord.glow = '#f05f9f';
    } else {
      ENEMY_CONFIGS.grunt.color = c3; ENEMY_CONFIGS.grunt.glow = c3;
      ENEMY_CONFIGS.scout.color = c4; ENEMY_CONFIGS.scout.glow = c4Light;
      ENEMY_CONFIGS.tank.color = c2; ENEMY_CONFIGS.tank.glow = c2;
      ENEMY_CONFIGS.swarm.color = c5; ENEMY_CONFIGS.swarm.glow = c5;
      ENEMY_CONFIGS.blinker.color = c5; ENEMY_CONFIGS.blinker.glow = c5Light;
      ENEMY_CONFIGS.goliath.color = c2; ENEMY_CONFIGS.goliath.glow = c2;
      ENEMY_CONFIGS.emp_bomber.color = c1; ENEMY_CONFIGS.emp_bomber.glow = c3;
      ENEMY_CONFIGS.hive_empress.color = c5; ENEMY_CONFIGS.hive_empress.glow = c5;
      ENEMY_CONFIGS.chronos_warp.color = c1; ENEMY_CONFIGS.chronos_warp.glow = c5Light;
      ENEMY_CONFIGS.titan_core.color = c4; ENEMY_CONFIGS.titan_core.glow = c4Light;
      ENEMY_CONFIGS.emp_overlord.color = c1; ENEMY_CONFIGS.emp_overlord.glow = c3;
    }
  }

  // Перестраиваем SVG-иконки башен и обновляем живые сущности на поле и в очереди спавна
  if (typeof TOWER_ICONS !== 'undefined' && typeof buildTowerIconSvg === 'function') {
    Object.keys(TOWER_CONFIGS).forEach(k => {
      TOWER_ICONS[k] = buildTowerIconSvg(k);
    });
  }
  if (typeof towers !== 'undefined' && Array.isArray(towers)) {
    towers.forEach(t => {
      if (TOWER_CONFIGS[t.type]) {
        t.color = TOWER_CONFIGS[t.type].color;
        t.glow = TOWER_CONFIGS[t.type].glow;
      }
    });
  }
  if (typeof enemies !== 'undefined' && Array.isArray(enemies)) {
    enemies.forEach(e => {
      if (ENEMY_CONFIGS[e.type]) {
        e.color = ENEMY_CONFIGS[e.type].color;
        e.glow = ENEMY_CONFIGS[e.type].glow;
      }
    });
  }
  if (typeof spawnQueue !== 'undefined' && Array.isArray(spawnQueue)) {
    spawnQueue.forEach(sq => {
      if (ENEMY_CONFIGS[sq.type]) {
        sq.color = ENEMY_CONFIGS[sq.type].color;
        sq.glow = ENEMY_CONFIGS[sq.type].glow;
      }
    });
  }
  if (typeof initBuildPanel === 'function' && typeof window.__gameBooted !== 'undefined' && window.__gameBooted) {
    initBuildPanel();
  }
  if (typeof renderLoadoutWidgetBody === 'function' && typeof window.__gameBooted !== 'undefined' && window.__gameBooted) {
    renderLoadoutWidgetBody();
  }

  // Сброс кэшей Canvas для мгновенной перерисовки фона, логотипа, сетки и мобов
  if (typeof nebulaCache !== 'undefined') nebulaCache = null;
  if (typeof nebulaCacheKey !== 'undefined') nebulaCacheKey = '';
  if (typeof triangleLogoCache !== 'undefined') triangleLogoCache = null;
  if (typeof triangleLogoCacheKey !== 'undefined') triangleLogoCacheKey = '';
  if (typeof invalidateGridCache === 'function') invalidateGridCache();
  if (typeof GLOW_SPRITES !== 'undefined' && GLOW_SPRITES) {
    for (const k in GLOW_SPRITES) delete GLOW_SPRITES[k];
  }
  if (typeof NEON_DISC_SPRITES !== 'undefined' && NEON_DISC_SPRITES) {
    for (const k in NEON_DISC_SPRITES) delete NEON_DISC_SPRITES[k];
  }
  if (typeof ENEMY_SPRITE_CACHE !== 'undefined' && ENEMY_SPRITE_CACHE) {
    for (const k in ENEMY_SPRITE_CACHE) delete ENEMY_SPRITE_CACHE[k];
  }
  if (typeof TOWER_BASE_SPRITE_CACHE !== 'undefined' && TOWER_BASE_SPRITE_CACHE) {
    for (const k in TOWER_BASE_SPRITE_CACHE) delete TOWER_BASE_SPRITE_CACHE[k];
  }
  if (typeof clearVariant4HullCache === 'function') {
    clearVariant4HullCache();
  }
}

let reviveUsedThisMatch = false;
let reviveTimerInterval = null;
let reviveRemainingSeconds = 3;
let reviveSkipShowTimer = null;

let tutorialActive = false;
let tutorialLevel = null;
let tutorialStep = -1;
let tutorialTargetTower = null;
let tutorialDestCell = null;
let tutorialSeen = { l1: false, l2: false, l3: false };

let activePathTiles = [];
let WAYPOINTS = [];
let grid = [];
let pathCells = [];
let obstacleCells = [];

const SAVE_KEY = 'sectorDefenseTD_save_v1';
let saveGameTimer = null;

let waveStartGold = 100;

// Настройки разгона времени после паузы/загрузки
const RESUME_RAMP_DURATION = 1.5; // Длительность разгона всей игры в секундах (1.0 - 2.0)
const RESUME_RAMP_START_MULT = 0.5; // Начальный множитель скорости игры (0.5 = 50% от текущей скорости)

let resumeRampTimer = 0; // Таймер разгона игрового времени

// Локальная разморозка мобов (оставляем для микро-задержки мобов, если нужно)
const RESUME_THAW_DURATION = 0.3; 
const RESUME_START_SPEED_MULT = 0.2;

let activeBattleSave = null;
let battleUpgradeSnapshot = null; // Замороженный слепок Tech Tree для текущего боя
let resumeThawTimer = 0; // Таймер текущей разморозки

// [ENG.AF]
function getBattleUpgradeEffectiveLevel(key) {
  if (battleUpgradeSnapshot && typeof battleUpgradeSnapshot[key] === 'number') {
    const lvl = battleUpgradeSnapshot[key];
    if (lvl <= 10) return lvl;
    if (lvl <= 15) return lvl === 15 ? 16.5 : lvl;
    if (key === 'base_hp') return 16.5 + (lvl - 15);
    const k = lvl - 15;
    return 16.5 + 20 * (1 - Math.pow(0.95, k));
  }
  return getUpgradeEffectiveLevel(key);
}

// [ENG.AG]
function getBattleUpgradeRangeBonus(towerType, effLvl) {
  if (typeof getUpgradeRangeBonus === 'function') {
    return getUpgradeRangeBonus(towerType, effLvl);
  }
  const conf = TOWER_CONFIGS[towerType];
  if (!conf) return 0;
  if (effLvl <= 10) return effLvl * (conf.powerRange || 0);
  return 10 * (conf.powerRange || 0) + (effLvl - 10) * 0.01;
}

// [ENG.AH]
function saveActiveBattleSnapshot() {
  if (gameState !== 'PLAYING' && gameState !== 'PAUSED') return;
  if (baseHp <= 0) return;

  if (!battleUpgradeSnapshot) {
    battleUpgradeSnapshot = Object.assign({}, upgradeTreeData);
  }

  activeBattleSave = {
    isEndlessMode: !!isEndlessMode,
    isOverdriveMode: !!isOverdriveMode,
    currentLevel: currentLevel,
    currentLevelSection: currentLevelSection || 1,
    wave: wave,
    waveInProgress: !!waveInProgress,
    waveTimerActive: !!waveTimerActive,
    autoWaveTimeRemaining: autoWaveTimeRemaining || 0,
    waveTotalSpawnTime: waveTotalSpawnTime || 1.0,
    waveSpawnElapsedTime: waveSpawnElapsedTime || 0,
    spawnTimer: spawnTimer || 0,
    regularSpawnCounter: regularSpawnCounter || 0,
    bossAlertScheduled: !!bossAlertScheduled,
    bossAlertShown: !!bossAlertShown,
    activeBossAlertType: activeBossAlertType || null,
    gold: gold,
    baseHp: baseHp,
    matchStartBaseHp: matchStartBaseHp,
    reviveUsedThisMatch: !!reviveUsedThisMatch,
    sessionMobKillsCount: sessionMobKillsCount || 0,
    activeBattleLoadout: activeBattleLoadout ? activeBattleLoadout.slice() : selectedLoadout.slice(),
    upgradeSnapshot: Object.assign({}, battleUpgradeSnapshot),
    towers: towers.map(t => ({
      type: t.type,
      c: t.c,
      r: t.r,
      level: t.level,
      totalInvested: t.totalInvested,
      angle: t.angle || 0,
      disabledTimer: t.disabledTimer || 0
    })),
    enemies: enemies.map(e => ({
      // Если моба сохранили в момент прыжка Титана или отброса Revive — ставим его сразу в конечную точку маневра
      x: e.revivePushAnim ? e.revivePushAnim.endX : (e.dashAnim ? e.dashAnim.endX : e.x),
      y: e.revivePushAnim ? e.revivePushAnim.endY : (e.dashAnim ? e.dashAnim.endY : e.y),
      wpIndex: e.revivePushAnim ? e.revivePushAnim.endWp : (e.dashAnim ? e.dashAnim.endWp : e.wpIndex),
      laneOffset: e.laneOffset || 0,
      angle: e.angle || 0,
      type: e.type,
      isBoss: !!e.isBoss,
      isMiniBoss: !!e.isMiniBoss,
      isElite: !!e.isElite,
      isEnraged: !!e.isEnraged,
      shape: e.shape,
      color: e.color,
      glow: e.glow,
      hp: e.hp,
      maxHp: e.maxHp,
      speed: e.speed,
      baseSpeed: e.baseSpeed,
      bounty: e.bounty,
      radius: e.radius,
      shieldTimer: e.shieldTimer || 0,
      isShielded: !!e.isShielded,
      warpTimer: e.warpTimer || 0,
      dashTimer: e.dashTimer || 0,
      summonTimer: e.summonTimer || 0,
      empTimer: e.empTimer || 0,
      slowTimer: e.slowTimer || 0
    })),
    spawnQueue: spawnQueue.map(sq => Object.assign({}, sq))
  };
}

// [ENG.AI]
function clearActiveBattleSave() {
  battleUpgradeSnapshot = null;
  if (activeBattleSave !== null) {
    activeBattleSave = null;
    saveGameSoon();
  }
}

// [ENG.AJ]
function resumeSavedBattle() {
  if (!activeBattleSave) return;
  const snap = activeBattleSave;

  isEndlessMode = !!snap.isEndlessMode;
  isOverdriveMode = !!snap.isOverdriveMode;
  currentLevel = snap.currentLevel || 1;
  currentLevelSection = snap.currentLevelSection || 1;
  battleUpgradeSnapshot = snap.upgradeSnapshot ? Object.assign({}, snap.upgradeSnapshot) : Object.assign({}, upgradeTreeData);

  if (typeof battleStartedOnce !== 'undefined') battleStartedOnce = (snap.wave > 1 || !!snap.waveInProgress);
  if (typeof battlePathAlpha !== 'undefined') battlePathAlpha = (snap.wave > 1 || !!snap.waveInProgress) ? 0.0 : 1.0;

  activeBattleLoadout = (Array.isArray(snap.activeBattleLoadout) && snap.activeBattleLoadout.length > 0)
    ? snap.activeBattleLoadout.slice()
    : selectedLoadout.slice();

  if (reviveTimerInterval) { clearInterval(reviveTimerInterval); reviveTimerInterval = null; }
  musicSetDucked(false);
  music('battle');

  ['levelsScreen', 'victoryScreen', 'defeatScreen', 'startScreen', 'settingsScreen', 'upgradesScreen'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });

  document.getElementById('econHpSplitBadge').classList.remove('hidden');
  document.getElementById('levelWaveSplitBadge').classList.remove('hidden');
  document.getElementById('hudRightGroup').classList.remove('hidden');
  updateStartChapterLabel(false);
  document.getElementById('controlsWrapper').classList.remove('hidden');

  const waveBtn = document.getElementById('waveBtn');
  if (waveBtn) waveBtn.classList.remove('hidden');

  resetLevelState();

  if (isEndlessMode) {
    const arenaMapKey = 'L' + (Math.min(5, Math.max(1, currentLevelSection)) * 10);
    const mapCfg = MAP_CATALOG[arenaMapKey] || MAP_CATALOG.L20 || MAP_CATALOG.L1;
    if (mapCfg) buildLevelGeometry(mapCfg.path, mapCfg.cols, mapCfg.rows, mapCfg.blocked);
  }

  // Восстанавливаем точное состояние волн, таймеров и ресурсов
  gold = snap.gold;
  baseHp = snap.baseHp;
  matchStartBaseHp = snap.matchStartBaseHp || snap.baseHp;
  wave = snap.wave || 1;
  waveInProgress = !!snap.waveInProgress;
  waveTimerActive = !!snap.waveTimerActive;
  autoWaveTimeRemaining = snap.autoWaveTimeRemaining || 0;
  waveTotalSpawnTime = snap.waveTotalSpawnTime || 1.0;
  waveSpawnElapsedTime = snap.waveSpawnElapsedTime || 0;
  spawnTimer = snap.spawnTimer || 0;
  regularSpawnCounter = snap.regularSpawnCounter || 0;
  bossAlertScheduled = !!snap.bossAlertScheduled;
  bossAlertShown = !!snap.bossAlertShown;
  activeBossAlertType = snap.activeBossAlertType || null;
  reviveUsedThisMatch = !!snap.reviveUsedThisMatch;
  sessionMobKillsCount = snap.sessionMobKillsCount || 0;

  // Восстанавливаем очередь спауна и живых мобов на карте
  spawnQueue = Array.isArray(snap.spawnQueue) ? snap.spawnQueue.map(sq => Object.assign({}, sq)) : [];
  enemies = Array.isArray(snap.enemies) ? snap.enemies.map(e => Object.assign({}, e)) : [];

  // Включаем плавную разморозку мобов, если на поле есть враги
  resumeThawTimer = enemies.length > 0 ? RESUME_THAW_DURATION : 0;
  resumeRampTimer = RESUME_RAMP_DURATION; // <-- Запуск плавного разгона игры

  // Восстанавливаем все башни с использованием замороженного слепка Tech Tree
  if (Array.isArray(snap.towers)) {
    snap.towers.forEach(savedT => {
      const conf = TOWER_CONFIGS[savedT.type];
      if (!conf || !grid[savedT.r] || grid[savedT.r][savedT.c] !== 0) return;

      grid[savedT.r][savedT.c] = 2;
      const powerLvl = getBattleUpgradeEffectiveLevel(`${savedT.type}_power`);
      const dmgBonus = 1 + powerLvl * (conf.powerDmg || 0);
      const rateBonus = 1 + powerLvl * (conf.powerRate || 0);
      const rangeBonus = 1 + getBattleUpgradeRangeBonus(savedT.type, powerLvl);

      const baseLockOnDelay = (savedT.type === 'laser' || savedT.type === 'melter')
        ? (typeof LOCK_ON_DELAY_HEAVY === 'number' ? LOCK_ON_DELAY_HEAVY : 0.5)
        : (typeof LOCK_ON_DELAY_LIGHT === 'number' ? LOCK_ON_DELAY_LIGHT : 0.1);
      const calcLockOnDelay = (savedT.type === 'mortar') ? baseLockOnDelay : (baseLockOnDelay / rateBonus);
      const calcMortarTravelTime = (savedT.type === 'mortar')
        ? ((typeof MORTAR_BASE_TRAVEL_TIME === 'number' ? MORTAR_BASE_TRAVEL_TIME : 1.0) / rateBonus)
        : undefined;

      const maxLvl = (typeof MAX_TOWER_LEVEL === 'number') ? MAX_TOWER_LEVEL : 4;
      const targetLvl = Math.max(1, Math.min(maxLvl, savedT.level || 1));

      let restoredInvested = (typeof savedT.totalInvested === 'number' && savedT.totalInvested > 0)
        ? savedT.totalInvested
        : conf.cost;
      if (!(typeof savedT.totalInvested === 'number' && savedT.totalInvested > 0) && typeof getUpgradeCost === 'function') {
        for (let l = 1; l < targetLvl; l++) {
          restoredInvested += getUpgradeCost(savedT.type, l);
        }
      }

      const restoredTower = {
        c: savedT.c,
        r: savedT.r,
        x: savedT.c * TILE_SIZE + TILE_SIZE / 2,
        y: savedT.r * TILE_SIZE + TILE_SIZE / 2,
        type: savedT.type,
        level: targetLvl,
        totalInvested: restoredInvested,
        damage: (conf.damage || conf.dps || conf.baseDps || 0) * dmgBonus,
        range: conf.range * rangeBonus,
        fireRate: conf.fireRate ? (conf.fireRate / rateBonus) : 0,
        color: conf.color,
        glow: conf.glow,
        lastFire: 0,
        target: null,
        angle: savedT.angle || 0,
        lockOnDelay: calcLockOnDelay,
        lockOnTimer: 0,
        mortarTravelTime: calcMortarTravelTime,
        melterRampTime: (savedT.type === 'melter') ? ((conf.rampTime || 4.0) / rateBonus) : undefined,
        melterCooldownTime: (savedT.type === 'melter') ? ((conf.cooldownTime || 4.0) / rateBonus) : 0,
        slowFactor: conf.slowFactor || 0.30,
        slowDuration: conf.slowDuration || 1.4,
        disabledTimer: savedT.disabledTimer || 0,
        melterFireTimer: 0,
        melterCoolingTimer: 0,
        accumDamage: 0,
        accumTimer: 0,
        accumTarget: null
      };

      if (typeof applyTowerLevelStats === 'function') {
        applyTowerLevelStats(restoredTower);
      }
      restoredTower.upgradeCost = (typeof getUpgradeCost === 'function') ? getUpgradeCost(restoredTower) : 0;
      towers.push(restoredTower);
    });
  }

  initBuildPanel();
  gameState = 'PLAYING';
  updateWaveCircle(0);
  updateUI();
  resizeCanvasAndCamera();
  lastTime = performance.now();
}
window.resumeSavedBattle = resumeSavedBattle;

// [ENG.AK]
let lastSaveTimestamp = 0;
let lastCloudPushTimestamp = 0;
let cloudSyncTimer = null;
const CLOUD_PUSH_THROTTLE_MS = 30000; // Не чаще 1 раза в 30 сек для фоновых автосейвов

function serializeSaveData() {
  lastSaveTimestamp = Date.now();
  return {
    version: 1,
    updatedAt: lastSaveTimestamp,
    clientId: (typeof getAnalyticsClientId === 'function') ? getAnalyticsClientId() : 'local',
    uid: (window.CloudBackend && window.CloudBackend.uid) ? window.CloudBackend.uid : null,
    diamonds,
    prisms,
    maxUnlockedLevel,
    clearedLevels,
    overdriveClearedLevels,
    levelStars,
    upgradeTreeData: Object.assign({}, upgradeTreeData),
    selectedLoadout,
    settings,
    tutorialSeen,
    dailyGiftsClaimedDate,
    dailyGiftsClaimedCount,
    timeModTier,
    lastLoginClaimDate,
    loginStreakDay,
    bpXp,
    bpPremiumPurchased,
    bpClaimedFree: Object.assign({}, bpClaimedFree),
    bpClaimedPrem: Object.assign({}, bpClaimedPrem),
    unlockedPalettes: unlockedPalettes.slice(),
    activePalette,
    endlessBestWavesBySection: Object.assign({}, endlessBestWavesBySection),
    endlessDailyRunsUsed,
    endlessDailyRunsDate,
    endlessMilestonesClaimed: Object.assign({}, endlessMilestonesClaimed),
    activeBattleSave
  };
}

// [ENG.AKM] Фоновая отправка сейва в Firebase (с защитой от частых вызовов)
function scheduleCloudSavePush(forceImmediate = false) {
  if (!window.CloudBackend || !window.CloudBackend.isConfigured()) return;

  if (cloudSyncTimer) {
    clearTimeout(cloudSyncTimer);
    cloudSyncTimer = null;
  }

  const now = Date.now();
  const elapsed = now - lastCloudPushTimestamp;

  if (forceImmediate || elapsed >= CLOUD_PUSH_THROTTLE_MS) {
    lastCloudPushTimestamp = now;
    window.CloudBackend.pushCloudSave(serializeSaveData());
  } else {
    cloudSyncTimer = setTimeout(() => {
      cloudSyncTimer = null;
      lastCloudPushTimestamp = Date.now();
      window.CloudBackend.pushCloudSave(serializeSaveData());
    }, CLOUD_PUSH_THROTTLE_MS - elapsed);
  }
}
window.scheduleCloudSavePush = scheduleCloudSavePush;

// [ENG.AL]
function saveGame(forceCloud = false) {
  try {
    const payload = serializeSaveData();
    const dataStr = JSON.stringify(payload);
    localStorage.setItem(SAVE_KEY, dataStr);
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Preferences) {
      window.Capacitor.Plugins.Preferences.set({ key: SAVE_KEY, value: dataStr })
        .catch(err => console.warn('Capacitor save error:', err));
    }
    scheduleCloudSavePush(!!forceCloud);
  } catch (e) {
    console.warn('SectorDefenseTD: save failed', e);
  }
}

// [ENG.AM]
function saveGameSoon() {
  if (saveGameTimer) clearTimeout(saveGameTimer);
  saveGameTimer = setTimeout(() => saveGame(false), 300);
}

// [ENG.AMM] Применение распакованного объекта сохранения к состоянию движка
function applyParsedSaveData(data) {
  if (!data || typeof data !== 'object') return false;

  if (typeof data.updatedAt === 'number') lastSaveTimestamp = data.updatedAt;
  if (typeof data.dailyGiftsClaimedDate === 'string') dailyGiftsClaimedDate = data.dailyGiftsClaimedDate;
  if (typeof data.dailyGiftsClaimedCount === 'number') dailyGiftsClaimedCount = data.dailyGiftsClaimedCount;
  if (typeof data.timeModTier === 'number') timeModTier = data.timeModTier;
  if (typeof data.lastLoginClaimDate === 'string') lastLoginClaimDate = data.lastLoginClaimDate;
  if (typeof data.loginStreakDay === 'number' && data.loginStreakDay >= 1 && data.loginStreakDay <= 7) loginStreakDay = data.loginStreakDay;

  if (typeof data.bpXp === 'number' && data.bpXp >= 0) bpXp = data.bpXp;
  if (typeof data.bpPremiumPurchased === 'boolean') bpPremiumPurchased = data.bpPremiumPurchased;
  if (data.bpClaimedFree && typeof data.bpClaimedFree === 'object') bpClaimedFree = data.bpClaimedFree;
  if (data.bpClaimedPrem && typeof data.bpClaimedPrem === 'object') bpClaimedPrem = data.bpClaimedPrem;
  if (Array.isArray(data.unlockedPalettes) && data.unlockedPalettes.length > 0) {
    unlockedPalettes = data.unlockedPalettes.filter(p => typeof p === 'string');
  }
  if (typeof data.activePalette === 'string') activePalette = data.activePalette;
  applyPaletteColors(activePalette);

  if (typeof data.diamonds === 'number' && data.diamonds >= 0) diamonds = data.diamonds;
  prisms = typeof data.prisms === 'number' ? Math.max(0, Math.floor(data.prisms)) : 0;
  if (typeof data.maxUnlockedLevel === 'number' && data.maxUnlockedLevel >= 1) {
    maxUnlockedLevel = Math.min(data.maxUnlockedLevel, TOTAL_LEVELS);
  }
  if (Array.isArray(data.clearedLevels)) {
    clearedLevels = data.clearedLevels.filter(n => typeof n === 'number');
  }
  if (data.overdriveClearedLevels && typeof data.overdriveClearedLevels === 'object') {
    overdriveClearedLevels = data.overdriveClearedLevels;
  }
  if (data.levelStars && typeof data.levelStars === 'object') {
    levelStars = data.levelStars;
  }
  if (data.endlessBestWavesBySection && typeof data.endlessBestWavesBySection === 'object') {
    endlessBestWavesBySection = Object.assign({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }, data.endlessBestWavesBySection);
  } else if (typeof data.endlessBestWave === 'number') {
    endlessBestWavesBySection[1] = data.endlessBestWave;
  }
  if (typeof data.endlessDailyRunsUsed === 'number' && data.endlessDailyRunsUsed >= 0) endlessDailyRunsUsed = data.endlessDailyRunsUsed;
  if (typeof data.endlessDailyRunsDate === 'string') endlessDailyRunsDate = data.endlessDailyRunsDate;
  if (data.endlessMilestonesClaimed && typeof data.endlessMilestonesClaimed === 'object') {
    endlessMilestonesClaimed = data.endlessMilestonesClaimed;
  }
  resetEndlessDailyRunsIfNeeded();
  if (data.upgradeTreeData && typeof data.upgradeTreeData === 'object') {
    Object.keys(upgradeTreeData).forEach(key => {
      const v = data.upgradeTreeData[key];
      if (typeof v === 'number' && v >= 0) upgradeTreeData[key] = v;
    });
  }
  if (Array.isArray(data.selectedLoadout) && data.selectedLoadout.length > 0) {
    selectedLoadout = data.selectedLoadout.filter(t => TOWER_CONFIGS[t]);
  }
  if (data.settings && typeof data.settings === 'object') {
    Object.assign(settings, data.settings);
    settings.screenShakeEnabled = settings.screenShakeEnabled !== false;
    if (typeof sfxSetEnabled === 'function') sfxSetEnabled(settings.sfxEnabled !== false);
  }
  if (data.tutorialSeen && typeof data.tutorialSeen === 'object') {
    if (typeof data.tutorialSeen.l1 === 'boolean') tutorialSeen.l1 = data.tutorialSeen.l1;
    if (typeof data.tutorialSeen.l2 === 'boolean') tutorialSeen.l2 = data.tutorialSeen.l2;
    if (typeof data.tutorialSeen.l3 === 'boolean') tutorialSeen.l3 = data.tutorialSeen.l3;
    Object.keys(data.tutorialSeen).forEach(k => {
      if (k.startsWith('towerUnlock_l') && typeof data.tutorialSeen[k] === 'boolean') {
        tutorialSeen[k] = data.tutorialSeen[k];
      }
    });
  }
  if (data.activeBattleSave && typeof data.activeBattleSave === 'object') {
    activeBattleSave = data.activeBattleSave;
  } else {
    activeBattleSave = null;
  }

  return true;
}

// [ENG.AMN] Умная синхронизация с Firebase после старта игры (не блокирует UI)
async function syncWithCloudSaveIfNeeded() {
  if (!window.CloudBackend || !window.CloudBackend.isConfigured()) return false;
  try {
    const cloudData = await window.CloudBackend.pullCloudSave();
    if (!cloudData || typeof cloudData !== 'object') {
      // В облаке ещё пусто — отправляем текущий локальный прогресс
      scheduleCloudSavePush(true);
      return false;
    }

    const cloudLvl = Number(cloudData.maxUnlockedLevel) || 1;
    const localLvl = Number(maxUnlockedLevel) || 1;
    const cloudXp = Number(cloudData.bpXp) || 0;
    const localXp = Number(bpXp) || 0;
    const cloudTs = Number(cloudData.updatedAt) || 0;
    const localTs = Number(lastSaveTimestamp) || 0;

    // Принимаем облачный сейв, если там открыт более высокий уровень, больше опыта BP или он свежее при равном прогрессе
    const isCloudAhead = (cloudLvl > localLvl) ||
      (cloudLvl === localLvl && cloudXp > localXp) ||
      (cloudLvl === localLvl && cloudXp === localXp && cloudTs > localTs + 5000);

    if (isCloudAhead && gameState === 'START') {
      applyParsedSaveData(cloudData);
      saveGame(false);
      if (typeof updateDiamondUI === 'function') updateDiamondUI();
      if (typeof updatePrismUI === 'function') updatePrismUI();
      if (typeof renderLevelsGrid === 'function') renderLevelsGrid();
      if (typeof updateUpgradeButtonsLock === 'function') updateUpgradeButtonsLock();
      if (typeof updateBpProgressUI === 'function') updateBpProgressUI();
      return true;
    } else if (localLvl > cloudLvl || localXp > cloudXp) {
      // Локальный сейв прогрессивнее облачного — обновляем облако
      scheduleCloudSavePush(true);
    }
  } catch (e) {}
  return false;
}
window.syncWithCloudSaveIfNeeded = syncWithCloudSaveIfNeeded;

// [ENG.AN]
async function loadGame() {
  let raw = null;

  if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Preferences) {
    try {
      const { value } = await window.Capacitor.Plugins.Preferences.get({ key: SAVE_KEY });
      if (value) raw = value;
    } catch (e) {
      console.warn('Capacitor load error:', e);
    }
  }

  if (!raw) {
    try {
      raw = localStorage.getItem(SAVE_KEY);
    } catch (e) {
      console.warn('SectorDefenseTD: localStorage unavailable, starting fresh', e);
      return false;
    }
  }

  if (!raw) return false;

  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    console.warn('SectorDefenseTD: save data corrupt, starting fresh', e);
    return false;
  }

  return applyParsedSaveData(data);
}
// [ENG.AO]
function safeTrack(name, params) {
  try {
    if (typeof trackEvent === 'function') trackEvent(name, params);
  } catch (e) { }
}

const _elCache = Object.create(null);
// [ENG.DG]
function el(id) {
  let n = _elCache[id];
  if (n && n.isConnected !== false) return n;
  n = document.getElementById(id);
  _elCache[id] = n;
  return n;
}

// [ENG.DH]
function handleClearSaveClick() {
  if (!devMode) return;
  devInputOpen = true;
  const ok = confirm('Clear all saved progress (diamonds, levels, upgrades, loadout, tutorial) and reset to a fresh install?');
  devInputOpen = false;
  suppressBackgroundPause();
  if (!ok) return;

  try {
    localStorage.removeItem(SAVE_KEY);
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Preferences) {
      window.Capacitor.Plugins.Preferences.remove({ key: SAVE_KEY });
    }
  } catch (e) {
    console.warn('SectorDefenseTD: could not clear localStorage', e);
  }

  diamonds = 0;
  prisms = 0;
  maxUnlockedLevel = 1;
  clearedLevels = [];
  overdriveClearedLevels = {};
  isOverdriveMode = false;
  levelStars = {};
  Object.keys(upgradeTreeData).forEach(key => { upgradeTreeData[key] = 0; });
  selectedLoadout = [];
  loadoutSyncedUpToLevel = 0;
  settings.showEnemyHp = true;
  settings.perfModeOverride = null;
  perfMode = 'high';
  perfDecided = false;
  perfSampleFrames = 0;
  perfSampleTime = 0;
  tutorialSeen.l1 = false;
  tutorialSeen.l2 = false;
  tutorialSeen.l3 = false;
  hasClaimedX2ThisLevel = false;

  dailyGiftsClaimedDate = '';
  dailyGiftsClaimedCount = 0;
  timeModTier = 0;
  lastLoginClaimDate = '';
  loginStreakDay = 1;
  hasAutoShownDailyLoginModalThisSession = false;
  dailyLoginDismissedThisSession = false;

  endlessBestWave = 0;
  endlessDailyRunsUsed = 0;
  endlessDailyRunsDate = '';
  endlessMilestonesClaimed = {};
  isEndlessMode = false;

  bpXp = 0;
  bpPremiumPurchased = false;
  bpClaimedFree = {};
  bpClaimedPrem = {};
  unlockedPalettes = ['default'];
  activePalette = 'default';
  applyPaletteColors('default');

  activeBattleSave = null;
  showStartScreen();
  renderLevelsGrid();
  updateDiamondUI();
  if (typeof updatePrismUI === 'function') updatePrismUI();
  updateUpgradeButtonsLock();
  if (typeof showHintToast === 'function') showHintToast('Save cleared');
  console.log('SectorDefenseTD: save cleared, state reset.');
}

