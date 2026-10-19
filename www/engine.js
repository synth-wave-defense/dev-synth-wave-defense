// [ENG100] Game Engine Module: Primary simulation state, game loop, persistent storage, and entity managers.
// Synth Wave Defense -- engine.js
//
// The simulation layer: everything about *what happens* in a match, with no
// opinion on how it's drawn or which screen is showing. Owns all mutable
// game state (gold, diamonds, towers/enemies/projectiles arrays, wave/level
// progress, save data) and the logic that changes it.

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

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
let cameraShakeIntensity = 0;

// [ENG101] Camera Shake & Audio Integration Wrappers: FX triggers, volume control, and haptic feedback.
function triggerCameraShake(dur = 0.5, intensity = 15) {
  cameraShakeTimer = dur;
  cameraShakeIntensity = intensity;
}

function hasClearedLevelBefore(lvl) {
  return maxUnlockedLevel > lvl;
}

function getBaseDamageFor(e) {
  if (e.isBoss) return 5;
  if (e.isMiniBoss) {
    if (typeof currentLevel !== 'undefined' && currentLevel === 34) return 1;
    return 2;
  }
  return 1;
}

function checkEnemyEnrage(e) {
  if (isOverdriveMode && e && e.hp > 0 && (e.hp / e.maxHp) <= 0.3 && !e.isEnraged) {
    e.isEnraged = true;
    e.baseSpeed *= 1.35;
    e.speed *= 1.35;
  }
}

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
  perfModeOverride: null,
  sfxEnabled: true, musicEnabled: true,
  sfxVolume: 100, musicVolume: 70
};

function sfx(name, arg) {
  if (!settings.sfxEnabled) return;
  try {
    if (typeof SFX !== 'undefined' && SFX) SFX.play(name, arg);
  } catch (e) { }
}
function sfxDeath(enemy) {
  if (!settings.sfxEnabled) return;
  try {
    if (typeof SFX !== 'undefined' && SFX) SFX.death(enemy);
  } catch (e) {}
}
function sfxBeam(kind, active, intensity) {
  if (!settings.sfxEnabled) return;
  try {
    if (typeof SFX !== 'undefined' && SFX) SFX.beam(kind, active, intensity);
  } catch (e) {}
}
function sfxStopBeams() {
  try {
    if (typeof SFX !== 'undefined' && SFX) SFX.stopBeams();
  } catch (e) {}
}
function sfxReap() {
  try {
    if (typeof SFX !== 'undefined' && SFX) SFX.reap();
  } catch (e) {}
}
function sfxSetEnabled(on) {
  try {
    if (typeof SFX !== 'undefined' && SFX) SFX.setEnabled(on);
  } catch (e) {}
}
function sfxSetVolume(v) {
  try {
    if (typeof SFX !== 'undefined' && SFX && SFX.setVolume) SFX.setVolume(v);
  } catch (e) {}
}

function music(category) {
  try {
    if (typeof MusicManager !== 'undefined' && MusicManager) MusicManager.play(category);
  } catch (e) { }
}
function musicSetEnabled(on) {
  try {
    if (typeof MusicManager !== 'undefined' && MusicManager) MusicManager.setEnabled(on);
  } catch (e) {}
}
function musicSetVolume(v) {
  try {
    if (typeof MusicManager !== 'undefined' && MusicManager && MusicManager.setVolume) MusicManager.setVolume(v);
  } catch (e) {}
}
function musicUnlock() {
  try {
    if (typeof MusicManager !== 'undefined' && MusicManager) MusicManager.unlock();
  } catch (e) {}
}
function musicSuspend() {
  try {
    if (typeof MusicManager !== 'undefined' && MusicManager) MusicManager.suspend();
  } catch (e) {}
}
function musicResume() {
  try {
    if (typeof MusicManager !== 'undefined' && MusicManager) MusicManager.resume();
  } catch (e) {}
}
function musicSetDucked(on, dur) {
  try {
    if (typeof MusicManager !== 'undefined' && MusicManager && MusicManager.setDucked) MusicManager.setDucked(on, dur);
  } catch (e) {}
}

// Функция вибрации (должна быть доступна глобально):
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
let endlessBestWave = 0;
let endlessDailyRunsUsed = 0;
let endlessDailyRunsDate = '';
let endlessMilestonesClaimed = {};

function resetEndlessDailyRunsIfNeeded() {
  const todayStr = new Date().toISOString().slice(0, 10);
  if (endlessDailyRunsDate !== todayStr) {
    endlessDailyRunsDate = todayStr;
    endlessDailyRunsUsed = 0;
  }
}

function isEndlessUnlocked() {
  if (typeof devMode !== 'undefined' && devMode) return true;
  if (typeof localStorage !== 'undefined' && localStorage.getItem("dev_auth_token") === "MTMzNw==") return true;
  if (typeof maxUnlockedLevel === 'number' && maxUnlockedLevel >= 16) return true;
  if (Array.isArray(clearedLevels) && clearedLevels.includes(15)) return true;
  return false;
}

function getEndlessEntryStatus() {
  resetEndlessDailyRunsIfNeeded();
  if (endlessDailyRunsUsed === 0) {
    return { type: 'free', text: 'FREE ENTRY (1/1)', label: 'FREE ENTRY (1/1)', cost: 0 };
  } else if (endlessDailyRunsUsed < 3) {
    const remainingAdRuns = 3 - endlessDailyRunsUsed;
    return { type: 'ad', text: `WATCH AD (${remainingAdRuns}/2)`, label: `WATCH AD (${remainingAdRuns}/2)`, cost: 0 };
  } else {
    return { type: 'diamonds', text: '15 💎', label: '15 💎', cost: 15 };
  }
}
window.getEndlessEntryStatus = getEndlessEntryStatus;

function generateEndlessWaveData(w) {
  const hpScalingMult = w >= 30 ? (1 + (w - 1) * 0.22 + Math.pow((w - 1) / 7, 1.3) + Math.pow((w - 29) / 2, 1.5)) : (1 + (w - 1) * 0.22 + Math.pow((w - 1) / 7, 1.3));
  const spdMult = Math.min(1.85, 1 + (w - 1) * 0.018);
  const spawns = [];

  if (w % 10 === 0) {
    const bossHp = Math.round(1000 * hpScalingMult);
    spawns.push({
      type: 'titan_core',
      isBoss: true,
      isMiniBoss: false,
      count: 1,
      hp: bossHp,
      speed: Math.round(28 * spdMult),
      bounty: Math.round(50 + w * 2),
      interval: 1.5,
      shape: 'octagon',
      color: '#ff0055',
      glow: '#ff0055'
    });
    const gruntCount = Math.min(59, 4 + Math.floor(w / 5));
    spawns.push({
      type: 'grunt',
      isBoss: false,
      isMiniBoss: false,
      count: gruntCount,
      hp: Math.round(35 * hpScalingMult),
      speed: Math.round(45 * spdMult),
      bounty: Math.round(8 + w),
      interval: 0.6
    });
  } else {
    const types = ['grunt', 'scout', 'tank', 'swarm', 'emp_bomber'];
    const availableTypes = types.slice(0, Math.min(types.length, 1 + Math.floor(w / 3)));
    const primaryType = availableTypes[Math.floor((w * 3 + 1) % availableTypes.length)] || 'grunt';
    let totalCount = 6 + Math.floor(w * 1.2);
    let secCount = 0;
    let secType = null;

    if (w > 3) {
      secType = availableTypes[Math.floor((w * 5 + 2) % availableTypes.length)];
      if (secType && secType !== primaryType) {
        secCount = 3 + Math.floor(w * 0.5);
      } else {
        secType = null;
      }
    }

    if (totalCount + secCount > 60) {
      const overflow = (totalCount + secCount) - 60;
      totalCount = Math.max(10, totalCount - overflow);
      if (totalCount + secCount > 60) {
        secCount = Math.max(0, 60 - totalCount);
      }
    }

    const proto = (typeof ENEMY_CONFIGS !== 'undefined' && ENEMY_CONFIGS[primaryType]) ? ENEMY_CONFIGS[primaryType] : { baseHp: 30, baseSpeed: 50, baseBounty: 5, shape: 'circle', color: '#00e5ff', glow: '#00e5ff' };

    spawns.push({
      type: primaryType,
      isBoss: false,
      isMiniBoss: false,
      count: totalCount,
      hp: Math.round(proto.baseHp * hpScalingMult),
      speed: Math.min(160, Math.round(proto.baseSpeed * spdMult)),
      bounty: Math.max(1, Math.round(proto.baseBounty * (1 + w * 0.05))),
      interval: Math.max(0.2, 0.8 - w * 0.01)
    });

    if (secType && secCount > 0) {
      const secProto = (typeof ENEMY_CONFIGS !== 'undefined' && ENEMY_CONFIGS[secType]) ? ENEMY_CONFIGS[secType] : proto;
      spawns.push({
        type: secType,
        isBoss: false,
        isMiniBoss: false,
        count: secCount,
        hp: Math.round(secProto.baseHp * hpScalingMult * 0.85),
        speed: Math.min(160, Math.round(secProto.baseSpeed * spdMult)),
        bounty: Math.max(1, Math.round(secProto.baseBounty * (1 + w * 0.05))),
        interval: 0.6
      });
    }
  }

  return { wave: w, delayAfter: 5.0, spawns };
}

function isOverdriveUnlocked() {
  if (typeof devMode !== 'undefined' && devMode) return true;
  if (typeof clearedLevels !== 'undefined' && (clearedLevels.includes(20) || clearedLevels.some(l => l >= 20))) return true;
  if (typeof maxUnlockedLevel === 'number' && maxUnlockedLevel >= 21) return true;
  return false;
}
let upgradesPreviousSource = 'main';
let lastVictoryDiamondsReward = 2;
let hasClaimedX2ThisLevel = false;

// [ENG102] Persistent Save State & LocalStorage Synchronization: Game progress serialization, save, and load pipeline.
// --- Gifts & Shop State ---
let noAdsPurchased = false;
let dailyGiftsClaimedDate = '';
let dailyGiftsClaimedCount = 0; // 0, 1, 2 или 3 в день
let timeModTier = 0; // 0 = locked, 1 = Tier 1 (0.8x, 1.0x, 1.5x), 2 = Tier 2 (0.5x, 0.8x, 1.0x, 1.5x, 2.0x)
let shopPreviousSource = 'start'; // откуда пришли в магазин: 'start', 'victory', 'defeat'

// --- Daily Login Calendar State ---
let lastLoginClaimDate = '';
let loginStreakDay = 1; // 1 до 7
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

function addBpXp(amount) {
  if (!amount || amount <= 0) return;
  bpXp += amount;
  saveGameSoon();
  if (typeof updateBpProgressUI === 'function') {
    updateBpProgressUI();
  }
}

function applyPaletteColors(paletteId) {
  const pId = (NEON_PALETTES && NEON_PALETTES[paletteId]) ? paletteId : 'default';
  activePalette = pId;
  const cfg = NEON_PALETTES[pId] || NEON_PALETTES['default'];

  // Apply root CSS variables for visual skins
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.style.setProperty('--neon-primary', cfg.primary);
    document.documentElement.style.setProperty('--neon-secondary', cfg.secondary);
    document.documentElement.style.setProperty('--neon-glow', cfg.glow);
  }

  // Synchronize tower laser/theme color definitions dynamically
  if (typeof TOWER_CONFIGS !== 'undefined' && TOWER_CONFIGS.gun) {
    if (pId === 'cyber_gold') {
      TOWER_CONFIGS.gun.color = '#ffd700';
      TOWER_CONFIGS.gun.glow = '#ffd700';
      TOWER_CONFIGS.laser.color = '#9d4edd';
      TOWER_CONFIGS.laser.glow = '#9d4edd';
    } else if (pId === 'blood_moon') {
      TOWER_CONFIGS.gun.color = '#ff003c';
      TOWER_CONFIGS.gun.glow = '#ff003c';
      TOWER_CONFIGS.laser.color = '#ff8a00';
      TOWER_CONFIGS.laser.glow = '#ff8a00';
    } else {
      TOWER_CONFIGS.gun.color = '#00e5ff';
      TOWER_CONFIGS.gun.glow = '#00e5ff';
      TOWER_CONFIGS.laser.color = '#f05f9f';
      TOWER_CONFIGS.laser.glow = '#f05f9f';
    }
  }

  if (typeof TOWER_ICONS !== 'undefined' && typeof buildTowerIconSvg === 'function') {
    TOWER_ICONS.gun = buildTowerIconSvg('gun');
    TOWER_ICONS.laser = buildTowerIconSvg('laser');
  }
  if (typeof towers !== 'undefined' && Array.isArray(towers)) {
    towers.forEach(t => {
      if (TOWER_CONFIGS[t.type]) {
        t.color = TOWER_CONFIGS[t.type].color;
        t.glow = TOWER_CONFIGS[t.type].glow;
      }
    });
  }
  if (typeof initBuildPanel === 'function' && typeof window.__gameBooted !== 'undefined' && window.__gameBooted) {
    initBuildPanel();
  }

  // Force cache invalidation on canvas elements when palette is switched
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
}

let consecutiveFails = 0;
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

function serializeSaveData() {
  return {
    version: 1,
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
    noAdsPurchased,
    dailyGiftsClaimedDate,
    dailyGiftsClaimedCount,
    timeModTier,
    consecutiveFails,
    lastLoginClaimDate,
    loginStreakDay,
    bpXp,
    bpPremiumPurchased,
    bpClaimedFree: Object.assign({}, bpClaimedFree),
    bpClaimedPrem: Object.assign({}, bpClaimedPrem),
    unlockedPalettes: unlockedPalettes.slice(),
    activePalette,
    endlessBestWave,
    endlessDailyRunsUsed,
    endlessDailyRunsDate,
    endlessMilestonesClaimed: Object.assign({}, endlessMilestonesClaimed)
  };
}

function saveGame() {
  try {
    const dataStr = JSON.stringify(serializeSaveData());
    localStorage.setItem(SAVE_KEY, dataStr);
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Preferences) {
      window.Capacitor.Plugins.Preferences.set({ key: SAVE_KEY, value: dataStr })
        .catch(err => console.warn('Capacitor save error:', err));
    }
  } catch (e) {
    console.warn('SectorDefenseTD: save failed', e);
  }
}

function saveGameSoon() {
  if (saveGameTimer) clearTimeout(saveGameTimer);
  saveGameTimer = setTimeout(saveGame, 300);
}

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

  if (!data || typeof data !== 'object') return false;

  if (typeof data.noAdsPurchased === 'boolean') noAdsPurchased = data.noAdsPurchased;
  if (typeof data.dailyGiftsClaimedDate === 'string') dailyGiftsClaimedDate = data.dailyGiftsClaimedDate;
  if (typeof data.dailyGiftsClaimedCount === 'number') dailyGiftsClaimedCount = data.dailyGiftsClaimedCount;
  if (typeof data.timeModTier === 'number') timeModTier = data.timeModTier;
  if (typeof data.consecutiveFails === 'number' && data.consecutiveFails >= 0) consecutiveFails = data.consecutiveFails;
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
  if (typeof data.endlessBestWave === 'number' && data.endlessBestWave >= 0) endlessBestWave = data.endlessBestWave;
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
  return true;
}

function safeTrack(name, params) {
  try {
    if (typeof trackEvent === 'function') trackEvent(name, params);
  } catch (e) { }
}

// [ENG103] Map Geometry & Path Grid Construction: Path nodes, cell blocking, and grid topology initialization.
function buildLevelGeometry(pathNodes, colsCount, rowsCount, blockedCells) {
  COLS = colsCount || 10;
  ROWS = rowsCount || 7;
  grid = Array(ROWS).fill(null).map(() => Array(COLS).fill(0));
  activePathTiles = pathNodes;
  pathCells = [];
  obstacleCells = [];

  for (let i = 0; i < pathNodes.length - 1; i++) {
    const p1 = pathNodes[i];
    const p2 = pathNodes[i + 1];
    const cStep = Math.sign(p2.c - p1.c);
    const rStep = Math.sign(p2.r - p1.r);
    let curC = p1.c;
    let curR = p1.r;

    while (curC !== p2.c || curR !== p2.r) {
      if (curR >= 0 && curR < ROWS && curC >= 0 && curC < COLS) grid[curR][curC] = 1;
      pathCells.push({ c: curC, r: curR, dirX: cStep, dirY: rStep });
      curC += cStep;
      curR += rStep;
    }
  }

  const lastNode = pathNodes[pathNodes.length - 1];
  const prevCell = pathCells[pathCells.length - 1];
  const lastDirX = prevCell ? prevCell.dirX : 0;
  const lastDirY = prevCell ? prevCell.dirY : 1;
  if (lastNode.r >= 0 && lastNode.r < ROWS && lastNode.c >= 0 && lastNode.c < COLS) {
    grid[lastNode.r][lastNode.c] = 1;
  }
  pathCells.push({ c: lastNode.c, r: lastNode.r, dirX: lastDirX, dirY: lastDirY });

  const lastVisit = new Map();
  const visitCounts = new Map();
  pathCells.forEach((cell, idx) => {
    const key = `${cell.c},${cell.r}`;
    lastVisit.set(key, idx);
    visitCounts.set(key, (visitCounts.get(key) || 0) + 1);
  });

  const totalCells = pathCells.length;
  const D = 23;
  const half = TILE_SIZE / 2;

  for (let i = 0; i < totalCells; i++) {
    const cell = pathCells[i];
    const key = `${cell.c},${cell.r}`;
    cell.isLowerLayer = (lastVisit.get(key) !== i);
    cell.isIntersection = (visitCounts.get(key) > 1);

    let inDir, outDir;
    if (i === 0) {
      inDir = { x: pathCells[1].c - cell.c, y: pathCells[1].r - cell.r };
      outDir = inDir;
    } else if (i === totalCells - 1) {
      outDir = { x: cell.c - pathCells[i - 1].c, y: cell.r - pathCells[i - 1].r };
      inDir = outDir;
    } else {
      inDir = { x: cell.c - pathCells[i - 1].c, y: cell.r - pathCells[i - 1].r };
      outDir = { x: pathCells[i + 1].c - cell.c, y: pathCells[i + 1].r - cell.r };
    }

    cell.inDir = inDir;
    cell.outDir = outDir;
    cell.isTurn = (inDir.x !== outDir.x || inDir.y !== outDir.y);
    const cx = cell.c * TILE_SIZE + half;
    const cy = cell.r * TILE_SIZE + half;

    if (!cell.isTurn) {
      const nx = -inDir.y;
      const ny = inDir.x;
      cell.rails = [
        { x1: cx - inDir.x * half - nx * D, y1: cy - inDir.y * half - ny * D, x2: cx + inDir.x * half - nx * D, y2: cy + inDir.y * half - ny * D },
        { x1: cx - inDir.x * half + nx * D, y1: cy - inDir.y * half + ny * D, x2: cx + inDir.x * half + nx * D, y2: cy + inDir.y * half + ny * D }
      ];
    } else {
      const pivotX = inDir.x === 0 ? cx + outDir.x * half : cx - inDir.x * half;
      const pivotY = inDir.y === 0 ? cy + outDir.y * half : cy - inDir.y * half;
      const entryX = cx - inDir.x * half;
      const entryY = cy - inDir.y * half;
      const exitX  = cx + outDir.x * half;
      const exitY  = cy + outDir.y * half;
      cell.turnPivot = { x: pivotX, y: pivotY };
      cell.turnAngles = { start: Math.atan2(entryY - pivotY, entryX - pivotX), end: Math.atan2(exitY - pivotY, exitX - pivotX), anticlockwise: (inDir.x * outDir.y - inDir.y * outDir.x) < 0 };
      cell.turnRadii = [half - D, half + D];
    }
  }

  WAYPOINTS = pathNodes.map(p => ({
    x: p.c * TILE_SIZE + TILE_SIZE / 2,
    y: p.r * TILE_SIZE + TILE_SIZE / 2
  }));

  if (Array.isArray(blockedCells)) {
    blockedCells.forEach(bc => {
      if (bc.r >= 0 && bc.r < ROWS && bc.c >= 0 && bc.c < COLS && grid[bc.r][bc.c] === 0) {
        grid[bc.r][bc.c] = 3;
        obstacleCells.push({ c: bc.c, r: bc.r });
      }
    });
  }
}

let towers = [];
let enemies = [];
let projectiles = [];
let particles = [];
let shockwaves = [];
let lightningBolts = [];
let spawnQueue = [];
let spawnTimer = 0;

let perfMode = 'high';
let perfDecided = false;
let perfSampleFrames = 0;
let perfSampleTime = 0;

// [ENG104] Meta-Upgrade Tech Tree & Player Loadout Management: Tower unlocks, loadout slots, and skill tree node handlers.
function getMaxUpgradeStep() {
  const lvl = getLoadoutReferenceLevel();
  if (lvl < 11) return 0;
  if (lvl <= 20) return 3;
  if (lvl <= 30) return 6;
  if (lvl <= 40) return 8;
  return 10;
}

function handleNodeClick(key, stepIndex) {
  const currentVal = upgradeTreeData[key] || 0;
  if (devMode) {
    upgradeTreeData[key] = Math.max(0, stepIndex);
    updateDiamondUI();
    updatePrismUI();
    renderUpgradeTree();
    saveGameSoon();
    return;
  }

  if (stepIndex <= currentVal) return;
  const targetStep = currentVal + 1;
  if (stepIndex !== targetStep) return;

  if (currentVal >= 15 && !isScalingBranch(key)) {
    sfx('denied');
    showHintToast('Branch is ASCENDED MAX (Lvl 15)');
    return;
  }

  const maxStep = getMaxUpgradeStep();
  const isPhase2UnlockedGlobally = getLoadoutReferenceLevel() > 30 || maxUnlockedLevel > 30 || (typeof clearedLevels !== 'undefined' && clearedLevels.includes(30));

  if (targetStep <= 10) {
    if (targetStep > maxStep) {
      let lvlNeeded = 11;
      if (targetStep > 8) lvlNeeded = 41;
      else if (targetStep > 6) lvlNeeded = 31;
      else if (targetStep > 3) lvlNeeded = 21;
      sfx('denied');
      showHintToast(`Unlocks on Level ${lvlNeeded}`);
      return;
    }
  } else if (targetStep <= 15) {
    if (!isPhase2UnlockedGlobally) {
      sfx('denied');
      showHintToast('Unlocks on Level 31');
      return;
    }
  }

  const { diamonds: costD, prisms: costP } = getUpgradeCostForLevel(targetStep);

  if (diamonds >= costD && prisms >= costP) {
    diamonds -= costD;
    prisms -= costP;
    upgradeTreeData[key] = targetStep;
    sfx('confirm');
    updateDiamondUI();
    updatePrismUI();
    renderUpgradeTree();
    saveGameSoon();
    safeTrack('upgrade_purchased', { key, step: targetStep });
  } else {
    sfx('denied');
    if (diamonds < costD && prisms < costP) {
      showHintToast('Not enough Diamonds & Prisms!');
    } else if (diamonds < costD) {
      showHintToast('Not enough Diamonds!');
    } else {
      showHintToast('Not enough Prisms!');
    }
  }
}

function getLoadoutReferenceLevel() {
  return Math.max(maxUnlockedLevel, currentLevel || 1);
}

function getLoadoutStartLevel() {
  for (let l = 1; l <= TOTAL_LEVELS; l++) {
    const pool = LEVELS_DATA[l] && LEVELS_DATA[l].unlockedTowers;
    if (pool && pool.length > LOADOUT_SIZE) return l;
  }
  return TOTAL_LEVELS + 1;
}

function getTowerUnlockLevel(type) {
  for (let l = 1; l <= TOTAL_LEVELS; l++) {
    const pool = LEVELS_DATA[l] && LEVELS_DATA[l].unlockedTowers;
    if (pool && pool.includes(type)) return l;
  }
  return 1;
}

function getPlayerUnlockedTowers() {
  if (devMode) return Object.keys(TOWER_CONFIGS);
  const highestLvl = Math.max(maxUnlockedLevel || 1, currentLevel || 1);
  const canonical = Object.keys(TOWER_CONFIGS);
  return canonical.filter(t => getTowerUnlockLevel(t) <= highestLvl);
}

function getBuildPanelPool(lvl) {
  if (devMode) return Object.keys(TOWER_CONFIGS);
  if (!isEndlessMode && !isOverdriveMode) {
    const highestLvl = Math.max(maxUnlockedLevel || 1, lvl || 1);
    const loadoutStart = getLoadoutStartLevel(); // 11

    // Если игрок в принципе еще не дошел до 11 уровня (ранняя игра) —
    // показываем 3 первыe башни (Gatling, Laser, Mortar), блокируя незаблокированные по уровню
    if (highestLvl < loadoutStart) {
      return ['gun', 'laser', 'mortar'];
    }
  }

  // В Endless, Hardcore или если игрок дошел до 11 уровня —
  // используются башни из его зафиксированного боевого лодаута
  const pool = (activeBattleLoadout && activeBattleLoadout.length > 0)
    ? activeBattleLoadout
    : selectedLoadout;
  return (pool && pool.length > 0) ? pool.slice() : ['gun'];
}

function isTowerActiveThisLevel(type) {
  if (devMode) return true;
  const loadoutStart = getLoadoutStartLevel();

  // В обычной кампании до 11 уровня: активны только те башни, которые разблокированы на ТЕКУЩЕМ уровне
  if (!isEndlessMode && !isOverdriveMode && currentLevel < loadoutStart) {
    const curUnlocked = (LEVELS_DATA[currentLevel] && LEVELS_DATA[currentLevel].unlockedTowers) || ['gun'];
    return curUnlocked.includes(type);
  }

  // В Endless, Hardcore и после 11 уровня: активны ровно те башни, которые выбраны в лодаут
  const pool = (activeBattleLoadout && activeBattleLoadout.length > 0)
    ? activeBattleLoadout
    : selectedLoadout;
  return pool.includes(type);
}

function computeDefaultLoadout(lvl, pool) {
  const prevLvl = lvl - 1;
  const prevPool = (prevLvl >= 1 && LEVELS_DATA[prevLvl] && LEVELS_DATA[prevLvl].unlockedTowers)
    ? LEVELS_DATA[prevLvl].unlockedTowers : [];
  const newlyUnlocked = pool.filter(t => !prevPool.includes(t));

  // Базовый набор из уже выбранных башен (или сохраняем предыдущие разблокированные)
  let picks = (selectedLoadout && selectedLoadout.length > 0)
    ? selectedLoadout.filter(t => pool.includes(t))
    : prevPool.slice(0, LOADOUT_SIZE);

  // Новая башня заменяет только последний свободный слот, либо добавляется в конец
  newlyUnlocked.forEach(t => {
    if (!picks.includes(t)) {
      if (picks.length < LOADOUT_SIZE) {
        picks.push(t);
      } else {
        // Если слоты полные, заменяем последний слот, сохраняя Gatling (gun) на 1-м месте
        picks[LOADOUT_SIZE - 1] = t;
      }
    }
  });

  // Дозаполняем слоты до ровно LOADOUT_SIZE башен
  for (const t of pool) {
    if (picks.length >= LOADOUT_SIZE) break;
    if (!picks.includes(t)) picks.push(t);
  }

  return { picks: picks.slice(0, LOADOUT_SIZE), newlyUnlocked };
}

let loadoutSyncedUpToLevel = 0;

function refreshLoadoutForProgress() {
  const loadoutStart = getLoadoutStartLevel();
  const progressRef = getLoadoutReferenceLevel();
  const availableTowers = (typeof getPlayerUnlockedTowers === 'function')
    ? getPlayerUnlockedTowers()
    : ['gun'];

  if (progressRef < loadoutStart) {
    const priorLvl = loadoutStart - 1;
    const tierPool = (LEVELS_DATA[priorLvl] && LEVELS_DATA[priorLvl].unlockedTowers)
      ? LEVELS_DATA[priorLvl].unlockedTowers.slice() : availableTowers.slice(0, LOADOUT_SIZE);
    selectedLoadout = tierPool;
    return;
  }

  const ref = Math.min(progressRef, TOTAL_LEVELS);
  const pool = (LEVELS_DATA[ref] && LEVELS_DATA[ref].unlockedTowers) ? LEVELS_DATA[ref].unlockedTowers : availableTowers;

  if (ref > loadoutSyncedUpToLevel || !Array.isArray(selectedLoadout) || selectedLoadout.length === 0) {
    const { picks } = computeDefaultLoadout(ref, pool);
    selectedLoadout = picks;
    loadoutSyncedUpToLevel = ref;
  } else {
    let valid = selectedLoadout.filter(t => availableTowers.includes(t) && pool.includes(t));
    for (const t of pool) {
      if (valid.length >= LOADOUT_SIZE) break;
      if (availableTowers.includes(t) && !valid.includes(t)) valid.push(t);
    }
    selectedLoadout = valid.slice(0, LOADOUT_SIZE);
  }
}

// [ENG105] Game Match Lifecycle & State Controller: Level start, pause, hardware back button, and level reset routines.
function startSpecificLevel(lvl) {
  refreshLoadoutForProgress();
  reallyStartLevel(lvl);
}

function startEndlessMatch() {
  isEndlessMode = true;
  isOverdriveMode = false;
  currentLevel = 1;

  if (typeof battleStartedOnce !== 'undefined') battleStartedOnce = false;
  if (typeof battlePathAlpha !== 'undefined') battlePathAlpha = 1.0;

  if (typeof refreshLoadoutForProgress === 'function') refreshLoadoutForProgress();
  activeBattleLoadout = selectedLoadout.slice();

  if (reviveTimerInterval) { clearInterval(reviveTimerInterval); reviveTimerInterval = null; }
  musicSetDucked(false);
  music('battle');

  document.getElementById('levelsScreen').classList.add('hidden');
  document.getElementById('victoryScreen').classList.add('hidden');
  document.getElementById('defeatScreen').classList.add('hidden');
  document.getElementById('pauseScreen')?.classList.add('hidden');
  document.getElementById('startScreen').classList.add('hidden');
  document.getElementById('settingsScreen').classList.add('hidden');
  document.getElementById('upgradesScreen').classList.add('hidden');

  document.getElementById('econHpSplitBadge').classList.remove('hidden');
  document.getElementById('levelWaveSplitBadge').classList.remove('hidden');
  document.getElementById('hudRightGroup').classList.remove('hidden');
  updateStartChapterLabel(false);
  document.getElementById('controlsWrapper').classList.remove('hidden');

  const waveBtn = document.getElementById('waveBtn');
  if (waveBtn) waveBtn.classList.remove('hidden');

  resetLevelState();
  const arenaMapKey = 'L' + (Math.min(5, Math.max(1, currentLevelSection)) * 10);
  const mapCfg = MAP_CATALOG[arenaMapKey] || MAP_CATALOG.L20 || MAP_CATALOG.L1;
  if (mapCfg) {
    buildLevelGeometry(mapCfg.path, mapCfg.cols, mapCfg.rows, mapCfg.blocked);
  }
  let baseGold = 150;
  if (bpClaimedPrem[15] || bpClaimedPrem['15']) {
    baseGold = Math.round(baseGold * 1.15);
  }
  gold = baseGold;
  baseHp = 10 + Math.round(getUpgradeEffectiveLevel('base_hp'));
  matchStartBaseHp = baseHp;
  wave = 1;

  initBuildPanel();
  updateUI();
  resizeCanvasAndCamera();
  gameState = 'PLAYING';
  lastTime = performance.now();
  safeTrack('endless_start', { runsUsed: endlessDailyRunsUsed });

  startWave();
}

function reallyStartLevel(lvl) {
  isEndlessMode = false;
	// Сброс анимации дорожки для нового боя:
  if (typeof battleStartedOnce !== 'undefined') battleStartedOnce = false;
  if (typeof battlePathAlpha !== 'undefined') battlePathAlpha = 1.0;
  
  // Убеждаемся, что лодаут игрока валиден перед новым боем
  if (typeof refreshLoadoutForProgress === 'function') {
    refreshLoadoutForProgress();
  }
  // ФИКСИРУЕМ башни для ЭТОГО боя (снимок не изменится при смене лодаута в паузе)
  activeBattleLoadout = selectedLoadout.slice();
  
  if (reviveTimerInterval) { clearInterval(reviveTimerInterval); reviveTimerInterval = null; }
  musicSetDucked(false);
  music('battle');
  currentLevel = lvl;
  document.getElementById('levelsScreen').classList.add('hidden');
  document.getElementById('victoryScreen').classList.add('hidden');
  document.getElementById('defeatScreen').classList.add('hidden');
  document.getElementById('pauseScreen')?.classList.add('hidden');
  document.getElementById('startScreen').classList.add('hidden');
  document.getElementById('settingsScreen').classList.add('hidden');
  document.getElementById('upgradesScreen').classList.add('hidden');
  const revSc = document.getElementById('reviveScreen');
  if (revSc) revSc.classList.add('hidden');

  document.getElementById('econHpSplitBadge').classList.remove('hidden');
  document.getElementById('levelWaveSplitBadge').classList.remove('hidden');
  document.getElementById('hudRightGroup').classList.remove('hidden');
  updateStartChapterLabel(false);
  document.getElementById('controlsWrapper').classList.remove('hidden');

  const waveBtn = document.getElementById('waveBtn');
  if (waveBtn) waveBtn.classList.remove('hidden');

  if (devMode) {
    const customSpawner = document.getElementById('devCustomSpawner');
    if (customSpawner) customSpawner.classList.remove('hidden');
  }

  resetLevelState();
  if (bpClaimedPrem[15] || bpClaimedPrem['15']) {
    gold = Math.round(gold * 1.15);
  }
  initBuildPanel();
  updateUI();
  resizeCanvasAndCamera();
  gameState = 'PLAYING';
  lastTime = performance.now();
  initTutorialForLevel(lvl);
  safeTrack('level_start', { level: lvl });

  if (lvl < getLoadoutStartLevel() && !hasClearedLevelBefore(lvl)) {
    const seenKey = `towerUnlock_l${lvl}`;
    if (!tutorialSeen[seenKey]) {
      const newTowers = getNewlyUnlockedTowers(lvl);
      if (newTowers.length > 0) {
        showNewTowerBanner(newTowers[0]);
        tutorialSeen[seenKey] = true;
        saveGameSoon();
      }
    }
  }
}

function resetLevelState() {
  if (reviveTimerInterval) { clearInterval(reviveTimerInterval); reviveTimerInterval = null; }
  reviveUsedThisMatch = false;
  sessionMobKillsCount = 0;

  const lvlConfig = LEVELS_DATA[currentLevel];
  gold = lvlConfig ? lvlConfig.startGold : 100;
  const initialBaseHp = (lvlConfig && lvlConfig.startHp !== undefined) ? lvlConfig.startHp : 10;
  baseHp = isOverdriveMode ? 1 : (initialBaseHp + Math.round(getUpgradeEffectiveLevel('base_hp')));
  matchStartBaseHp = baseHp;
  regularSpawnCounter = 0;

  wave = 1;
  waveInProgress = false;
  autoWaveTimeRemaining = 0;
  waveTimerActive = false;
  victoryDelayTimer = 0;
  towers = [];
  enemies = [];
  projectiles = [];
  particles = [];
  shockwaves = [];
  lightningBolts = [];
  spawnQueue = [];
  bossAlertScheduled = false;
  bossAlertShown = false;
  activeBossAlertType = null;
  hideIncomingAlert();
  hideNewTowerBanner();

  if (lvlConfig && lvlConfig.mapId && MAP_CATALOG[lvlConfig.mapId]) {
    const mapCfg = MAP_CATALOG[lvlConfig.mapId];
    buildLevelGeometry(mapCfg.path, mapCfg.cols, mapCfg.rows, mapCfg.blocked);
  }

  camZoom = 0;

  deselectTower();
  const btn = document.getElementById('waveBtn');
  const btnText = document.getElementById('waveBtnText');
  if (btn) btn.disabled = false;
  if (btnText) btnText.textContent = 'Go';
  updateWaveCircle(0);
  updateUI();
  if (devMode) refreshDevDropdowns();
}

function nextLevel() {
  if (currentLevel < TOTAL_LEVELS) {
    startSpecificLevel(currentLevel + 1);
  } else {
    showLevelSelect();
  }
}

function retryLevel() {
  if (isEndlessMode) {
    const status = getEndlessEntryStatus();
    const launch = () => {
      endlessDailyRunsUsed++;
      saveGame();
      startEndlessMatch();
    };

    if (status.type === 'free') {
      launch();
    } else if (status.type === 'ad') {
      if (typeof showAdPlaceholder === 'function') {
        showAdPlaceholder(launch, null);
      } else {
        launch();
      }
    } else if (status.type === 'diamonds') {
      if (diamonds < 15) {
        if (typeof showHintToast === 'function') showHintToast('Need 15 Diamonds for entry!');
        return;
      }
      diamonds -= 15;
      updateDiamondUI();
      launch();
    }
  } else {
    reallyStartLevel(currentLevel);
  }
}

function togglePause() {
  if (typeof handleHudSettingsClick === 'function') {
    handleHudSettingsClick();
  }
}

function forcePauseForBackground() {
  if (devInputOpen || Date.now() < suppressBackgroundPauseUntil) {
    saveGame();
    return;
  }
  sfxStopBeams();
  musicSuspend();
  if (gameState === 'PLAYING') {
    gameState = 'PAUSED';
    if (typeof showSettings === 'function') {
      showSettings('combat');
    }
  }
  saveGame();
}

function handleHardwareBack() {
  const giveUpModal = document.getElementById('giveUpConfirmModal');
  if (giveUpModal && !giveUpModal.classList.contains('hidden')) {
    if (typeof cancelGiveUp === 'function') cancelGiveUp();
    return;
  }

  const dailyModal = document.getElementById('dailyLoginModal');
  if (dailyModal && !dailyModal.classList.contains('hidden')) {
    if (typeof closeDailyLoginModal === 'function') closeDailyLoginModal();
    return;
  }

  const endlessModal = document.getElementById('endlessLoadoutModal');
  if (endlessModal && !endlessModal.classList.contains('hidden')) {
    if (typeof closeEndlessLoadoutModal === 'function') closeEndlessLoadoutModal();
    return;
  }

  const bpScreen = document.getElementById('battlePassScreen');
  if (bpScreen && !bpScreen.classList.contains('hidden')) {
    if (typeof closeBattlePassScreen === 'function') closeBattlePassScreen();
    return;
  }

  const settingsEl = document.getElementById('settingsScreen');
  if (settingsEl && !settingsEl.classList.contains('hidden')) {
    if (typeof closeSettings === 'function') closeSettings();
    return;
  }

  const shopEl = document.getElementById('shopScreen');
  if (shopEl && !shopEl.classList.contains('hidden')) {
    if (typeof closeShopScreen === 'function') closeShopScreen();
    return;
  }

  const upgradesEl = document.getElementById('upgradesScreen');
  if (upgradesEl && !upgradesEl.classList.contains('hidden')) {
    if (typeof closeUpgradesScreen === 'function') closeUpgradesScreen();
    return;
  }

  const levelsEl = document.getElementById('levelsScreen');
  if (levelsEl && !levelsEl.classList.contains('hidden')) {
    showStartScreen();
    return;
  }

  if (gameState === 'PAUSED') {
    if (typeof closeSettings === 'function') closeSettings();
    return;
  }

  if (gameState === 'PLAYING') {
    if (typeof handleHudSettingsClick === 'function') {
      handleHudSettingsClick();
    }
    return;
  }

  if (gameState === 'START' && window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App && typeof window.Capacitor.Plugins.App.exitApp === 'function') {
    window.Capacitor.Plugins.App.exitApp();
  }
}

// [ENG106] Match Result & Victory/Defeat Handlers: Star calculations, rewards, revive prompt, and victory/defeat sequences.
function calculateLevelStarsAndReward(lvl, currentHp, startingHp) {
  let earnedStars = 1;
  if (isOverdriveMode) {
    earnedStars = (currentHp > 0) ? 3 : 1;
  } else {
    const hpRatio = startingHp > 0 ? (currentHp / startingHp) : 1;
    if (hpRatio >= 0.999) {
      earnedStars = 3;
    } else if (hpRatio >= 0.5) {
      earnedStars = 2;
    } else {
      earnedStars = 1;
    }
  }

  const prevBestStars = levelStars[lvl] || 0;
  let rewardDiamonds = 0;
  let rewardLabel = 'FARM REWARD';

  if (!isOverdriveMode && earnedStars > prevBestStars) {
    const deltaStars = earnedStars - prevBestStars;
    rewardDiamonds = deltaStars * 2;
    rewardLabel = (prevBestStars === 0) ? 'FIRST CLEAR BONUS' : 'STAR UPGRADE BONUS';
    levelStars[lvl] = earnedStars;
    if (!clearedLevels.includes(lvl)) {
      clearedLevels.push(lvl);
    }
  } else {
    rewardDiamonds = 1;
    rewardLabel = 'FARM REWARD';
  }

  return { stars: earnedStars, reward: rewardDiamonds, rewardLabel: rewardLabel };
}

function showAdPlaceholder(onRewarded, onNotRewarded) {
  const adOverlay = document.getElementById('adSimOverlay');
  const yesBtn = document.getElementById('adSimYesBtn');
  const noBtn = document.getElementById('adSimNoBtn');

  if (!adOverlay) {
    if (onRewarded) onRewarded();
    return;
  }

  adOverlay.classList.remove('hidden');

  const cleanup = () => {
    adOverlay.classList.add('hidden');
    if (yesBtn) yesBtn.onclick = null;
    if (noBtn) noBtn.onclick = null;
  };

  if (yesBtn) {
    yesBtn.onclick = () => {
      cleanup();
      if (onRewarded) onRewarded();
    };
  }

  if (noBtn) {
    noBtn.onclick = () => {
      cleanup();
      if (onNotRewarded) onNotRewarded();
    };
  }
}

function claimX2Reward() {
  if (hasClaimedX2ThisLevel) return;
  const claimBtn = document.getElementById('claimX2Btn');

  const executeGrant = () => {
    hasClaimedX2ThisLevel = true;
    diamonds += lastVictoryDiamondsReward;
    updateDiamondUI();
    if (claimBtn) {
      claimBtn.disabled = true;
      claimBtn.innerHTML = '<span>CLAIMED</span>';
    }
    sfx('reward');
    saveGame();
  };

  if (!noAdsPurchased) {
    showAdPlaceholder(executeGrant, null);
  } else {
    executeGrant();
  }
}

function claimOverdriveBonusPrism() {
  if (hasClaimedX2ThisLevel) return;
  const claimBtn = document.getElementById('claimX2Btn');

  const executeGrant = () => {
    hasClaimedX2ThisLevel = true;
    prisms += 1;
    if (typeof updatePrismUI === 'function') updatePrismUI();
    if (claimBtn) {
      claimBtn.disabled = true;
      claimBtn.innerHTML = '<span>CLAIMED (+1 🔮)</span>';
    }
    sfx('reward');
    saveGame();
  };

  if (!noAdsPurchased) {
    showAdPlaceholder(executeGrant, null);
  } else {
    executeGrant();
  }
}

function restoreNormalVictoryRewardBox() {
  const rewardBox = document.getElementById('victoryRewardBox');
  if (rewardBox) {
    rewardBox.innerHTML = `
      <span class="reward-amount" id="victoryRewardVal">+2</span>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00e5ff" stroke-width="2.2" stroke-linejoin="round">
        <polygon points="6 3 18 3 22 9 12 22 2 9" fill="rgba(0,229,255,.25)"/>
        <polyline points="2 9 12 13 22 9"/><line x1="12" y1="22" x2="12" y2="13"/>
      </svg>
      <span class="reward-label" id="victoryRewardBadgeType">DIAMONDS</span>
    `;
  }
}

let victoryFanfareTimer = null;

function playVictoryFanfare() {
  const stack = document.querySelector('#victoryScreen .result-stack');
  if (!stack) return;

  if (victoryFanfareTimer) {
    clearTimeout(victoryFanfareTimer);
    victoryFanfareTimer = null;
  }

  const existing = document.getElementById('victoryFanfareRays');
  if (existing && existing.parentNode) {
    existing.parentNode.removeChild(existing);
  }

  const rays = document.createElement('div');
  rays.className = 'victory-fanfare-rays';
  rays.id = 'victoryFanfareRays';
  stack.insertBefore(rays, stack.firstChild);
}

function triggerVictory() {
  gameState = 'VICTORY';
  const defeatScreen = document.getElementById('defeatScreen');
  if (defeatScreen) defeatScreen.classList.add('hidden');
  sfxStopBeams();
  music('win');
  sfx('victory');
  const { stars, reward, rewardLabel } = calculateLevelStarsAndReward(currentLevel, baseHp, matchStartBaseHp);
  lastVictoryDiamondsReward = reward;
  hasClaimedX2ThisLevel = false;

  consecutiveFails = 0;

  if (!isOverdriveMode) {
    restoreNormalVictoryRewardBox();
    diamonds += reward;
    addBpXp(25);
    updateDiamondUI();
    renderVictoryStars(stars);
    playVictoryFanfare();

    const badgeTypeEl = document.getElementById('victoryRewardBadgeType');
    if (badgeTypeEl) {
      badgeTypeEl.textContent = rewardLabel === 'DIAMONDS' ? 'DIAMONDS' : rewardLabel;
      badgeTypeEl.style.color = (rewardLabel === 'FIRST CLEAR BONUS' || rewardLabel === 'STAR UPGRADE BONUS') ? '#f59e0b' : '#8ef3ff';
    }

    const rewardValEl = document.getElementById('victoryRewardVal');
    if (rewardValEl) rewardValEl.textContent = `+${reward}`;

    const claimBtn = document.getElementById('claimX2Btn');
    if (claimBtn) {
      claimBtn.disabled = false;
      claimBtn.classList.remove('hidden');
      claimBtn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="3" fill="none" stroke="#ffffff" stroke-width="2"/><polygon points="10,9 16,12 10,15" fill="#ffffff"/></svg><span>CLAIM x2</span>';
      claimBtn.onclick = claimX2Reward;
    }
  } else {
    const isFirstOverdriveClear = !overdriveClearedLevels[currentLevel];
    let gainedPrisms = 0;
    let gainedDiamonds = 0;
    let odRewardLabel = 'HARDCORE FARM';

    if (isFirstOverdriveClear) {
      const isBossLvl = (currentLevel % LEVELS_PER_SECTION === 0);
      gainedPrisms = isBossLvl ? 5 : 3;
      gainedDiamonds = isBossLvl ? 30 : 15;
      odRewardLabel = 'HARDCORE CLEAR';
      overdriveClearedLevels[currentLevel] = true;
    } else {
      gainedDiamonds = 3;
      gainedPrisms = 0;
      odRewardLabel = 'HARDCORE FARM';
    }

    diamonds += gainedDiamonds;
    prisms += gainedPrisms;
    addBpXp(50);
    updateDiamondUI();
    if (typeof updatePrismUI === 'function') updatePrismUI();
    renderVictoryStars(3);
    playVictoryFanfare();

    const rewardBox = document.getElementById('victoryRewardBox');
    if (rewardBox) {
      if (gainedPrisms > 0) {
        rewardBox.innerHTML = `
          <span class="reward-amount" id="victoryRewardVal">+${gainedDiamonds}</span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00e5ff" stroke-width="2.2" stroke-linejoin="round">
            <polygon points="6 3 18 3 22 9 12 22 2 9" fill="rgba(0,229,255,.25)"/>
            <polyline points="2 9 12 13 22 9"/><line x1="12" y1="22" x2="12" y2="13"/>
          </svg>
          <span class="reward-amount" style="margin-left:6px; color:#d946ef;">+${gainedPrisms}</span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d946ef" stroke-width="2.2" stroke-linejoin="round">
            <polygon points="12 2 21 12 12 22 3 12" fill="rgba(217,70,239,.25)"/>
            <polyline points="3 12 12 15 21 12"/><line x1="12" y1="2" x2="12" y2="22"/>
          </svg>
          <span class="reward-label" style="color:#ff2a6d; margin-left:6px;">${odRewardLabel}</span>
        `;
      } else {
        rewardBox.innerHTML = `
          <span class="reward-amount" id="victoryRewardVal">+${gainedDiamonds}</span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00e5ff" stroke-width="2.2" stroke-linejoin="round">
            <polygon points="6 3 18 3 22 9 12 22 2 9" fill="rgba(0,229,255,.25)"/>
            <polyline points="2 9 12 13 22 9"/><line x1="12" y1="22" x2="12" y2="13"/>
          </svg>
          <span class="reward-label" style="color:#ff2a6d; margin-left:6px;">${odRewardLabel}</span>
        `;
      }
    }

    const claimBtn = document.getElementById('claimX2Btn');
    if (claimBtn) {
      claimBtn.disabled = false;
      claimBtn.classList.remove('hidden');
      const btnText = noAdsPurchased ? 'FREE: +1 BONUS PRISM' : 'WATCH AD: +1 BONUS PRISM';
      claimBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d946ef" stroke-width="2.2" stroke-linejoin="round" style="vertical-align:middle; margin-right:4px;">
          <polygon points="12 2 21 12 12 22 3 12" fill="rgba(217,70,239,.3)"/>
          <polyline points="3 12 12 15 21 12"/><line x1="12" y1="2" x2="12" y2="22"/>
        </svg>
        <span>${btnText}</span>
      `;
      claimBtn.onclick = claimOverdriveBonusPrism;
    }
  }

  setTimeout(() => sfx('reward'), 760);

  const wasUpgradesLocked = !(devMode || getLoadoutReferenceLevel() >= getLoadoutStartLevel());
  const isFirstClear = currentLevel >= maxUnlockedLevel;

  if (currentLevel >= maxUnlockedLevel && maxUnlockedLevel < TOTAL_LEVELS) {
    maxUnlockedLevel = currentLevel + 1;
  }
  refreshLoadoutForProgress();
  renderLevelsGrid();
  updateUpgradeButtonsLock();

  const nowUnlocked = (devMode || getLoadoutReferenceLevel() >= getLoadoutStartLevel());
  pendingUpgradeUnlockFx = wasUpgradesLocked && nowUnlocked;
  pendingLoadoutRevealFx = pendingUpgradeUnlockFx;

  const showVictory = () => {
    document.getElementById('victoryScreen').classList.remove('hidden');
    showLoadoutWidgetIn('loadoutAnchor-victory');
    playVictoryUnlockFx();
    if (currentLevel === 50) {
      showGameCompletionModal();
    }
  };

  saveGame();
  safeTrack('level_complete', { level: currentLevel, stars, reward, isOverdrive: isOverdriveMode });

  if (!isOverdriveMode && isFirstClear && currentLevel % LEVELS_PER_SECTION === 0) {
    showMilestoneSequence(currentLevel, showVictory);
  } else {
    showVictory();
  }
}

function playVictoryUnlockFx() {
  if (pendingUpgradeUnlockFx) {
    const btn = document.getElementById('victoryUpgradesBtn');
    if (btn) {
      const lockSvg = (typeof getLockSvg === 'function') ? getLockSvg(16) : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex:none; margin-right: 4px;"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`;
      const unlockedIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="flex:none; margin-right: 4px;"><line x1="7" y1="21" x2="17" y2="21"/><line x1="12" y1="21" x2="12" y2="18"/><line x1="8" y1="21" x2="6" y2="23"/><line x1="16" y1="21" x2="18" y2="23"/><line x1="12" y1="18" x2="12" y2="11" stroke-width="2.2"/><circle cx="12" cy="18" r="1" fill="currentColor"/><path d="M12 11L7 7V4"/><path d="M12 11L17 7V4"/><path d="M12 11V5"/><path d="M7 7L4 5"/><path d="M17 7L20 5"/><circle cx="12" cy="11" r="1.2" fill="currentColor"/><polygon points="12,2 14,5 12,8 10,5" fill="currentColor" fill-opacity="0.3"/><polygon points="7,2 8.5,4 7,6 5.5,4" fill="currentColor" fill-opacity="0.3"/><polygon points="17,2 18.5,4 17,6 15.5,4" fill="currentColor" fill-opacity="0.3"/><polygon points="4,3 5,4.5 4,6 3,4.5" fill="currentColor" fill-opacity="0.3"/><polygon points="20,3 21,4.5 20,6 19,4.5" fill="currentColor" fill-opacity="0.3"/></svg>`;
      btn.classList.add('btn-locked', 'btn-unlocking');
      btn.innerHTML = lockSvg + '<span>TECH TREE</span>';
      setTimeout(() => {
        btn.classList.remove('btn-locked', 'btn-unlocking', 'no-press-feedback');
        btn.innerHTML = unlockedIcon + '<span>TECH TREE</span>';
      }, 1700);
    }
    pendingUpgradeUnlockFx = false;
  }
  if (pendingLoadoutRevealFx) {
    const widget = document.getElementById('loadoutWidget');
    if (widget) {
      widget.classList.remove('loadout-revealing');
      void widget.offsetWidth;
      widget.classList.add('loadout-revealing');
      setTimeout(() => widget.classList.remove('loadout-revealing'), 2100);
    }
    pendingLoadoutRevealFx = false;
  }
}

function triggerDefeat() {
  musicSetDucked(false);
  sfxStopBeams();
  music('lose');
  sfx('defeat');
  if (reviveTimerInterval) { clearInterval(reviveTimerInterval); reviveTimerInterval = null; }
  gameState = 'DEFEAT';

  const victoryScreen = document.getElementById('victoryScreen');
  if (victoryScreen) victoryScreen.classList.add('hidden');

  const reviveTimerContainer = document.getElementById('reviveTimerContainer');
  if (reviveTimerContainer) reviveTimerContainer.classList.add('hidden');

  const tacticalTipsWidget = document.getElementById('tacticalTipsWidget');
  if (tacticalTipsWidget) tacticalTipsWidget.classList.remove('hidden');

  const reviveBtn = document.getElementById('reviveBtn');
  const skipBtn = document.getElementById('reviveSkipBtn');
  const retryBtn = document.getElementById('defeatRetryBtn');
  const upgBtn = document.getElementById('defeatUpgradesBtn');
  const levelsBtn = document.getElementById('defeatLevelsBtn');
  const shopBtn = document.getElementById('defeatShopBtn');
  const settingsBtn = document.getElementById('defeatSettingsBtn');

  if (reviveBtn) reviveBtn.classList.add('hidden');
  if (skipBtn) skipBtn.classList.add('hidden');
  if (retryBtn) retryBtn.classList.remove('hidden');
  if (upgBtn) upgBtn.classList.remove('hidden');
  if (levelsBtn) levelsBtn.classList.remove('hidden');
  if (shopBtn) shopBtn.classList.remove('hidden');
  if (settingsBtn) settingsBtn.classList.remove('hidden');

  updateUpgradeButtonsLock();
  updateDefeatWaveLine();
  document.getElementById('defeatScreen').classList.remove('hidden');
  replayDefeatFlash();
  showLoadoutWidgetIn('loadoutAnchor-defeat');
  registerDefeatOutcome();
}

function registerDefeatOutcome() {
  safeTrack('level_failed', { level: currentLevel, wave });
  consecutiveFails++;
  if (consecutiveFails >= 3) {
    consecutiveFails = 0;
    showRecommendationsModal();
  }
  saveGameSoon();
}

function showGameCompletionModal() {
  const modal = document.getElementById('gameCompletionModal');
  if (modal) modal.classList.remove('hidden');
}

function closeGameCompletionModal() {
  const modal = document.getElementById('gameCompletionModal');
  if (modal) modal.classList.add('hidden');
}

function showRecommendationsModal() {
  const modal = document.getElementById('recommendationsModal');
  const maxTechItem = document.getElementById('recMaxTechItem');
  if (!modal) return;

  const lvl = (typeof currentLevel !== 'undefined') ? currentLevel : 1;
  const showMaxTech = lvl >= 11;
  if (maxTechItem) {
    maxTechItem.style.display = showMaxTech ? 'list-item' : 'none';
  }

  modal.classList.remove('hidden');
}

function closeRecommendationsModal() {
  const modal = document.getElementById('recommendationsModal');
  if (modal) modal.classList.add('hidden');
}

function setReviveBtnLabel(seconds) {
  const numEl = document.getElementById('reviveTimerNumber');
  if (numEl) numEl.textContent = `${seconds}s`;
  const label = document.getElementById('reviveBtnLabel');
  if (label) label.textContent = 'REVIVE';
  const progressEl = document.getElementById('reviveTimerProgress');
  if (progressEl) {
    const totalDash = 276.46;
    const fraction = Math.max(0, seconds / 3);
    progressEl.style.strokeDashoffset = (totalDash * (1 - fraction)).toFixed(2);
  }
}

let defeatFlashTimeout = null;

function replayDefeatFlash() {
  const defeatScreen = document.getElementById('defeatScreen');
  if (!defeatScreen) return;

  let flash = document.getElementById('defeatFlash');
  if (!flash) {
    flash = document.createElement('div');
    flash.className = 'defeat-flash';
    flash.id = 'defeatFlash';
    defeatScreen.insertBefore(flash, defeatScreen.firstChild);
  } else {
    const fresh = flash.cloneNode(false);
    flash.parentNode.replaceChild(fresh, flash);
    flash = fresh;
  }

  const heading = defeatScreen.querySelector('.result-heading');
  if (heading) {
    heading.classList.remove('fail-shake');
    void heading.offsetWidth;
    heading.classList.add('fail-shake');
  }
}

let lastEndlessEarnedDiamonds = 0;
let lastEndlessEarnedPrisms = 0;
let endlessHasClaimedDouble = false;

function claimEndlessDoubleRewards() {
  if (endlessHasClaimedDouble || (lastEndlessEarnedDiamonds <= 0 && lastEndlessEarnedPrisms <= 0)) return;
  const doubleBtn = document.getElementById('endlessDoubleBtn');

  const executeDouble = () => {
    endlessHasClaimedDouble = true;
    diamonds += lastEndlessEarnedDiamonds;
    prisms += lastEndlessEarnedPrisms;
    updateDiamondUI();
    if (typeof updatePrismUI === 'function') updatePrismUI();
    if (doubleBtn) {
      doubleBtn.disabled = true;
      doubleBtn.innerHTML = '<span>DOUBLED!</span>';
    }
    sfx('reward');
    saveGame();
  };

  if (!noAdsPurchased) {
    showAdPlaceholder(executeDouble, null);
  } else {
    executeDouble();
  }
}

function updateDefeatWaveLine() {
  const el = document.getElementById('defeatWaveLine');
  const defeatScreen = document.getElementById('defeatScreen');
  const kicker = defeatScreen ? defeatScreen.querySelector('.result-kicker') : null;
  const title = defeatScreen ? defeatScreen.querySelector('.result-title') : null;
  const rewardsBox = document.getElementById('endlessRewardsBox');
  const recBadge = document.getElementById('endlessNewRecordBadge');
  const lootLine = document.getElementById('endlessLootLine');
  const doubleBtn = document.getElementById('endlessDoubleBtn');

  if (isEndlessMode) {
    const clearedWaves = Math.max(0, wave - 1);
    const isNewRecord = clearedWaves > endlessBestWave;
    if (isNewRecord) {
      endlessBestWave = clearedWaves;
      saveGameSoon();
    }

    if (kicker) kicker.textContent = 'ENDLESS ARENA';
    if (title) {
      if (clearedWaves >= 5) {
        title.textContent = `RUN COMPLETE — WAVE ${wave}`;
        title.setAttribute('data-text', `RUN COMPLETE — WAVE ${wave}`);
      } else {
        title.textContent = 'DEFEAT';
        title.setAttribute('data-text', 'DEFEAT');
      }
    }
    if (el) el.textContent = `WAVE ${wave} REACHED (${clearedWaves} CLEARED)`;

    lastEndlessEarnedDiamonds = clearedWaves * 2;
    const basePrisms = Math.floor(clearedWaves / 10);
    let milestonePrisms = 0;
    const milestones = [15, 30, 50, 75, 100];
    milestones.forEach(m => {
      if (clearedWaves >= m && !endlessMilestonesClaimed[m]) {
        endlessMilestonesClaimed[m] = true;
        milestonePrisms += 5;
      }
    });

    lastEndlessEarnedPrisms = basePrisms;
    const totalPrismsGranted = basePrisms + milestonePrisms;

    diamonds += lastEndlessEarnedDiamonds;
    prisms += totalPrismsGranted;
    updateDiamondUI();
    if (typeof updatePrismUI === 'function') updatePrismUI();
    saveGame();

    endlessHasClaimedDouble = false;

    if (rewardsBox) rewardsBox.classList.remove('hidden');
    if (recBadge) {
      if (isNewRecord && clearedWaves > 0) recBadge.classList.remove('hidden');
      else recBadge.classList.add('hidden');
    }
    if (lootLine) {
      lootLine.textContent = `REWARDS: +${lastEndlessEarnedDiamonds} 💎 | +${totalPrismsGranted} 🔮`;
    }
    if (doubleBtn) {
      if (lastEndlessEarnedDiamonds > 0 || lastEndlessEarnedPrisms > 0) {
        doubleBtn.classList.remove('hidden');
        doubleBtn.disabled = false;
        const btnText = noAdsPurchased ? 'DOUBLE REWARDS (FREE)' : 'DOUBLE REWARDS (WATCH AD)';
        doubleBtn.innerHTML = `<span>${btnText}</span>`;
      } else {
        doubleBtn.classList.add('hidden');
      }
    }
  } else {
    if (kicker) kicker.textContent = 'Level';
    if (title) {
      title.textContent = 'Failed';
      title.setAttribute('data-text', 'Failed');
    }
    if (rewardsBox) rewardsBox.classList.add('hidden');
    if (el) {
      const maxW = (LEVELS_DATA[currentLevel] && LEVELS_DATA[currentLevel].totalWaves) || 1;
      el.textContent = `WAVE ${Math.min(wave, maxW)} OF ${maxW} REACHED`;
    }
  }
}

function triggerEmergencyRevivePrompt() {
  gameState = 'DEFEAT';
  musicSetDucked(true);
  reviveRemainingSeconds = 3;

  const victoryScreen = document.getElementById('victoryScreen');
  if (victoryScreen) victoryScreen.classList.add('hidden');

  const reviveTimerContainer = document.getElementById('reviveTimerContainer');
  if (reviveTimerContainer) reviveTimerContainer.classList.remove('hidden');

  const tacticalTipsWidget = document.getElementById('tacticalTipsWidget');
  if (tacticalTipsWidget) tacticalTipsWidget.classList.add('hidden');

  const reviveBtn = document.getElementById('reviveBtn');
  const skipBtn = document.getElementById('reviveSkipBtn');
  const retryBtn = document.getElementById('defeatRetryBtn');
  const upgBtn = document.getElementById('defeatUpgradesBtn');
  const levelsBtn = document.getElementById('defeatLevelsBtn');
  const shopBtn = document.getElementById('defeatShopBtn');
  const settingsBtn = document.getElementById('defeatSettingsBtn');

  // Видна ТОЛЬКО кнопка Revive
  if (reviveBtn) {
    reviveBtn.classList.remove('hidden');
    setReviveBtnLabel(reviveRemainingSeconds);
  }
  if (skipBtn) skipBtn.classList.add('hidden');
  if (retryBtn) retryBtn.classList.add('hidden');
  if (upgBtn) upgBtn.classList.add('hidden');
  if (levelsBtn) levelsBtn.classList.add('hidden');
  if (shopBtn) shopBtn.classList.add('hidden');
  if (settingsBtn) settingsBtn.classList.add('hidden');

  updateDefeatWaveLine();
  const loadoutWidget = document.getElementById('loadoutWidget');
  if (loadoutWidget) loadoutWidget.classList.add('hidden');
  document.getElementById('defeatScreen').classList.remove('hidden');
  replayDefeatFlash();

  // Кнопка Skip появляется ровно через 1 секунду
  if (reviveSkipShowTimer) clearTimeout(reviveSkipShowTimer);
  reviveSkipShowTimer = setTimeout(() => {
    reviveSkipShowTimer = null;
    if (skipBtn) skipBtn.classList.remove('hidden');
  }, 1000);

  if (reviveTimerInterval) clearInterval(reviveTimerInterval);
  reviveTimerInterval = setInterval(() => {
    reviveRemainingSeconds--;
    if (reviveBtn && reviveRemainingSeconds > 0) {
      setReviveBtnLabel(reviveRemainingSeconds);
    }
    if (reviveRemainingSeconds <= 0) {
      finishRevivePromptWindow();
    }
  }, 1000);
}

function finishRevivePromptWindow() {
  if (reviveTimerInterval) { clearInterval(reviveTimerInterval); reviveTimerInterval = null; }
  if (reviveSkipShowTimer) { clearTimeout(reviveSkipShowTimer); reviveSkipShowTimer = null; }
  musicSetDucked(false);
  music('lose');

  const reviveTimerContainer = document.getElementById('reviveTimerContainer');
  if (reviveTimerContainer) reviveTimerContainer.classList.add('hidden');

  const tacticalTipsWidget = document.getElementById('tacticalTipsWidget');
  if (tacticalTipsWidget) tacticalTipsWidget.classList.remove('hidden');

  const reviveBtn = document.getElementById('reviveBtn');
  const skipBtn = document.getElementById('reviveSkipBtn');
  const retryBtn = document.getElementById('defeatRetryBtn');
  const upgBtn = document.getElementById('defeatUpgradesBtn');
  const levelsBtn = document.getElementById('defeatLevelsBtn');
  const shopBtn = document.getElementById('defeatShopBtn');
  const settingsBtn = document.getElementById('defeatSettingsBtn');

  if (reviveBtn) reviveBtn.classList.add('hidden');
  if (skipBtn) skipBtn.classList.add('hidden');
  if (retryBtn) retryBtn.classList.remove('hidden');
  if (upgBtn) upgBtn.classList.remove('hidden');
  if (levelsBtn) levelsBtn.classList.remove('hidden');
  if (shopBtn) shopBtn.classList.remove('hidden');
  if (settingsBtn) settingsBtn.classList.remove('hidden');

  updateUpgradeButtonsLock();
  showLoadoutWidgetIn('loadoutAnchor-defeat');
  registerDefeatOutcome();
}

function skipEmergencyRevive() {
  finishRevivePromptWindow();
}

function acceptEmergencyRevive() {
  sfx('revive');
  if (reviveTimerInterval) { clearInterval(reviveTimerInterval); reviveTimerInterval = null; }
  if (reviveSkipShowTimer) { clearTimeout(reviveSkipShowTimer); reviveSkipShowTimer = null; }
  document.getElementById('defeatScreen').classList.add('hidden');

  const executeRevive = () => {
    musicSetDucked(false);
    baseHp = Math.max(3, Math.round(matchStartBaseHp * 0.5));
    reviveUsedThisMatch = true;
    updateUI();

    if (WAYPOINTS && WAYPOINTS.length > 1) {
      const basePt = WAYPOINTS[WAYPOINTS.length - 1];
      const fw = typeof FIELD_WIDTH !== 'undefined' ? FIELD_WIDTH : 700;
      createShockwave(basePt.x, basePt.y, fw * 0.9, '#00e5ff');
      createShockwave(basePt.x, basePt.y, fw * 0.6, '#ffffff');
      createShockwave(basePt.x, basePt.y, fw * 0.3, '#38bdf8');
      if (typeof createExplosion === 'function') createExplosion(basePt.x, basePt.y, 100);
      if (typeof createDamageShards === 'function') createDamageShards(basePt.x, basePt.y, '#00e5ff', 50, false);
      triggerCameraShake(0.5, 16);
      vibrate('heavy');
      sfx('bossIncoming');
      sfx('revive');

      const numWps = WAYPOINTS.length;
      const cumDist = [0];
      for (let k = 1; k < numWps; k++) {
        const d = Math.hypot(WAYPOINTS[k].x - WAYPOINTS[k - 1].x, WAYPOINTS[k].y - WAYPOINTS[k - 1].y);
        cumDist.push(cumDist[k - 1] + d);
      }
      const totalRouteDistance = cumDist[numWps - 1];
      const pushDistance = totalRouteDistance * 0.45;

      enemies.forEach(e => {
        let k = e.wpIndex;
        if (k < 1) k = 1;
        if (k >= numWps) k = numWps - 1;

        const prevWp = WAYPOINTS[k - 1];
        const targetWp = WAYPOINTS[k];
        const segDx = targetWp.x - prevWp.x;
        const segDy = targetWp.y - prevWp.y;
        const segLen = Math.hypot(segDx, segDy);

        let dInSeg = 0;
        if (segLen > 0) {
          const ex = e.x - prevWp.x;
          const ey = e.y - prevWp.y;
          const proj = (ex * segDx + ey * segDy) / segLen;
          dInSeg = Math.max(0, Math.min(segLen, proj));
        }

        const currentDistFromSpawn = cumDist[k - 1] + dInSeg;
        const newDistFromSpawn = Math.max(0, currentDistFromSpawn - pushDistance);

        let newK = 1;
        while (newK < numWps - 1 && cumDist[newK] < newDistFromSpawn) {
          newK++;
        }

        const pSegStart = WAYPOINTS[newK - 1];
        const pSegEnd = WAYPOINTS[newK];
        const pSegLen = cumDist[newK] - cumDist[newK - 1];
        const pSegDist = newDistFromSpawn - cumDist[newK - 1];

        let t = 0;
        if (pSegLen > 0) {
          t = Math.max(0, Math.min(1, pSegDist / pSegLen));
        }

        let newX = pSegStart.x + t * (pSegEnd.x - pSegStart.x);
        let newY = pSegStart.y + t * (pSegEnd.y - pSegStart.y);

        if (e.laneOffset) {
          const sDx = pSegEnd.x - pSegStart.x;
          const sDy = pSegEnd.y - pSegStart.y;
          const sLen = Math.hypot(sDx, sDy) || 1;
          let offX = -sDy / sLen;
          let offY = sDx / sLen;
          const nextWp = WAYPOINTS[newK + 1];
          if (nextWp) {
            const s2Dx = nextWp.x - pSegEnd.x;
            const s2Dy = nextWp.y - pSegEnd.y;
            const s2Len = Math.hypot(s2Dx, s2Dy) || 1;
            offX += -s2Dy / s2Len;
            offY += s2Dx / s2Len;
          }
          newX += offX * e.laneOffset;
          newY += offY * e.laneOffset;
        }

        e.x = newX;
        e.y = newY;
        e.wpIndex = newK;
      });
    }
    gameState = 'PLAYING';
    lastTime = performance.now();
  };

  if (!noAdsPurchased) {
    showAdPlaceholder(executeRevive, null);
  } else {
    executeRevive();
  }
}

// [ENG107] Tower Construction & Inspection Management: Build, upgrade, sell, and drag-and-drop placement logic.
function buildTowerAt(type, c, r) {
  const conf = TOWER_CONFIGS[type];
  if (grid[r][c] === 0 && gold >= conf.cost) {
    gold -= conf.cost;
    grid[r][c] = 2;

    const powerLvl = getUpgradeEffectiveLevel(`${type}_power`);
    const dmgBonus = 1 + powerLvl * (conf.powerDmg || 0);
    const rateBonus = 1 + powerLvl * (conf.powerRate || 0);
    const rangeBonus = 1 + powerLvl * (conf.powerRange || 0);
    const calcDamage = (conf.damage || conf.dps || conf.baseDps || 0) * dmgBonus;
    const calcFireRate = conf.fireRate ? (conf.fireRate / rateBonus) : 0;

    const baseLockOnDelay = (type === 'laser' || type === 'melter')
      ? (typeof LOCK_ON_DELAY_HEAVY === 'number' ? LOCK_ON_DELAY_HEAVY : 0.5)
      : (typeof LOCK_ON_DELAY_LIGHT === 'number' ? LOCK_ON_DELAY_LIGHT : 0.1);
    const calcLockOnDelay = (type === 'mortar') ? baseLockOnDelay : (baseLockOnDelay / rateBonus);
    const calcMortarTravelTime = (type === 'mortar')
      ? ((typeof MORTAR_BASE_TRAVEL_TIME === 'number' ? MORTAR_BASE_TRAVEL_TIME : 1.0) / rateBonus)
      : undefined;
    const calcMelterRampTime = (type === 'melter')
      ? ((conf.rampTime || 4.0) / rateBonus)
      : undefined;

    sfx('build');
    const newTower = {
      c, r,
      x: c * TILE_SIZE + TILE_SIZE / 2,
      y: r * TILE_SIZE + TILE_SIZE / 2,
      type: type,
      level: 1,
      totalInvested: conf.cost,
      damage: calcDamage,
      range: conf.range * rangeBonus,
      fireRate: calcFireRate,
      color: conf.color,
      glow: conf.glow,
      lastFire: 0,
      target: null,
      angle: 0,
      lockOnDelay: calcLockOnDelay,
      lockOnTimer: 0,
      mortarTravelTime: calcMortarTravelTime,
      melterRampTime: calcMelterRampTime,
      melterCooldownTime: (type === 'melter') ? ((conf.cooldownTime || 4.0) / rateBonus) : 0,
      slowFactor: conf.slowFactor || 0.30,
      slowDuration: conf.slowDuration || 1.4,
      disabledTimer: 0,
      melterFireTimer: 0,
      melterCoolingTimer: 0
    };

    towers.push(newTower);
    createShockwave(newTower.x, newTower.y, 40, conf.color);
    updateUI();

    if (tutorialActive && tutorialLevel === 1 && tutorialStep === 0) {
      tutorialStep = 1;
    } else if (tutorialActive && tutorialLevel === 2 && tutorialStep === -1) {
      tutorialStep = 0;
      tutorialTargetTower = newTower;
    }

    safeTrack('tower_built', { type, level: currentLevel });
    return true;
  }
  return false;
}

function handleDrop(worldX, worldY, clientX, clientY) {
  if (!draggingTower || gameState !== 'PLAYING') {
    draggingTower = null;
    showCancelZoneVisual(false);
    return;
  }

  try {
    const isCancelled = isOverCancelZone(clientX, clientY);
    if (!isCancelled) {
      const c = Math.floor(worldX / TILE_SIZE);
      const r = Math.floor(worldY / TILE_SIZE);
      if (c >= 0 && c < COLS && r >= 0 && r < ROWS) {
        buildTowerAt(draggingTower.type, c, r);
      }
    }
  } catch (err) {
    console.error(err);
  } finally {
    draggingTower = null;
    showCancelZoneVisual(false);
  }
}

function getUpgradeCost(towerOrType, level) {
  const type = typeof towerOrType === 'object' ? towerOrType.type : towerOrType;
  const lvl = typeof towerOrType === 'object' ? towerOrType.level : level;
  const conf = TOWER_CONFIGS[type];
  const costMult = (conf && conf.costMultiplier) ? conf.costMultiplier : 1.3;
  return Math.floor(conf.cost * Math.pow(costMult, lvl));
}

function upgradeSelectedTower() {
  const lvlConfig = LEVELS_DATA[currentLevel];
  if (!isEndlessMode && !isOverdriveMode) {
    if (lvlConfig && lvlConfig.canUpgrade === false) return;
    // На L1 апгрейды заблокированы только если игрок проходит его впервые
    if (currentLevel === 1 && !hasClearedLevelBefore(1) && !devMode) return;
  }
  if (!selectedTower || selectedTower.level >= 3) return;
  const cost = getUpgradeCost(selectedTower.type, selectedTower.level);
  if (gold >= cost) {
    const conf = TOWER_CONFIGS[selectedTower.type];
    const dmgMult = (conf && conf.damageMultiplier) ? conf.damageMultiplier : 1.4;
    const rngMult = (conf && conf.rangeMultiplier) ? conf.rangeMultiplier : 1.1;
    const rateMult = (conf && conf.rateMultiplier) ? conf.rateMultiplier : 1.0;

    gold -= cost;
    selectedTower.level++;
    sfx('upgrade');
    selectedTower.totalInvested += cost;
    selectedTower.damage *= dmgMult;
    selectedTower.range *= rngMult;
    if (selectedTower.fireRate && rateMult !== 1.0) {
      selectedTower.fireRate *= rateMult;
    }

    if (selectedTower.type === 'stasis') {
      selectedTower.slowFactor = (selectedTower.level === 2) ? 0.40 : 0.50;
    }

    if (selectedTower.type === 'melter') {
      selectedTower.melterFireTimer = 0;
      selectedTower.melterCoolingTimer = 0;
      const powerLvl = getUpgradeEffectiveLevel('melter_power');
      const rateBonus = 1 + powerLvl * (conf.powerRate || 0);
      if (selectedTower.level === 2) {
        selectedTower.melterRampTime = 4.4 / rateBonus;
        selectedTower.melterCooldownTime = 3.6 / rateBonus;
      } else if (selectedTower.level === 3) {
        selectedTower.melterRampTime = 4.8 / rateBonus;
        selectedTower.melterCooldownTime = 3.2 / rateBonus;
      }
    }

    createShockwave(selectedTower.x, selectedTower.y, 60, selectedTower.color);
    createDamageShards(selectedTower.x, selectedTower.y, selectedTower.color, 40, false);
    updateUI();

    if (tutorialActive && tutorialLevel === 2 && tutorialStep === 1) {
      tutorialStep = 2;
    }
  }
}

function sellSelectedTower() {
  if (!selectedTower) return;
  if (!sellConfirmArmed) {
    armSellConfirm();
    return;
  }
  resetSellConfirm();

  const sc = selectedTower.c;
  const sr = selectedTower.r;
  const sx = selectedTower.x;
  const sy = selectedTower.y;
  const refund = Math.floor(selectedTower.totalInvested * 0.7);
  gold += refund;
  sfx('sell');

  grid[sr][sc] = 0;
  towers = towers.filter(t => t.c !== sc || t.r !== sr);
  particles = particles.filter(p => Math.hypot(p.x - sx, p.y - sy) > 28);
  deselectTower();

  createShockwave(sx, sy, 40, '#f05f9f');
  createDamageShards(sx, sy, '#f05f9f', 30, false);
  updateUI();
}

// [ENG108] Wave Spawning & Enemy Queue Management: Auto/manual wave triggers, miniboss/boss delays, and spawn timers.
function getAutoWaveDelay() {
  if (currentLevel >= 40) return 9.0;
  if (currentLevel >= 30) return 7.0;
  return 5.0;
}

function triggerManualWave() {
  if (tutorialActive && tutorialLevel === 1 && tutorialStep === 1) {
    completeTutorial(1);
  }

  const lvlConfig = LEVELS_DATA[currentLevel];
  const maxW = lvlConfig ? lvlConfig.totalWaves : 10;

  if (waveTimerActive) {
    const secondsSaved = autoWaveTimeRemaining;
    waveTimerActive = false;
    autoWaveTimeRemaining = 0;
    if (isEndlessMode || wave < maxW) {
      let totalDelay = 5.0;
      let currentWaveObj = null;
      let baseBonus = 15;

      if (isEndlessMode) {
        addBpXp(5);
        baseBonus = 15 + Math.floor(wave * 1.5);
      } else if (lvlConfig && lvlConfig.waves) {
        currentWaveObj = lvlConfig.waves.find(w => w.wave === wave);
        if (currentWaveObj && currentWaveObj.delayAfter !== undefined) {
          totalDelay = currentWaveObj.delayAfter;
        }
        if (currentWaveObj && currentWaveObj.earlyBonus !== undefined) {
          baseBonus = currentWaveObj.earlyBonus;
        }
      }

      wave++;
      const moneyMultiplier = 1 + getUpgradeEffectiveLevel('base_gold') * 0.05;
      const fractionSaved = totalDelay > 0 ? Math.min(1, Math.max(0, secondsSaved / totalDelay)) : 0;
      const earlyCallBonus = Math.round(fractionSaved * baseBonus * moneyMultiplier);

      if (earlyCallBonus > 0) {
        gold += earlyCallBonus;
        sfx('confirm');
      }
      startWave();
    }
  } else if (!waveInProgress && spawnQueue.length === 0) {
    if (isEndlessMode || wave <= maxW) startWave();
  }
}

function getMinibossPreDelay() { return 2.0; }
function getBossPreDelay(lvl) {
  const clamped = Math.max(10, Math.min(50, lvl));
  return 2.5 + ((clamped - 10) / 40) * 2.5;
}

function startWave() {
  sfx('waveStart');
  if (isEndlessMode) {
    waveInProgress = true;
    waveTimerActive = false;
    autoWaveTimeRemaining = 0;
    spawnQueue = [];

    const waveData = generateEndlessWaveData(wave);
    let hasBoss = false;
    let hasMiniBoss = false;

    if (waveData && waveData.spawns) {
      waveData.spawns.forEach(grp => {
        if (grp.isBoss) hasBoss = true;
        if (grp.isMiniBoss) hasMiniBoss = true;

        if ((grp.isBoss || grp.isMiniBoss) && spawnQueue.length > 0) {
          const preDelay = grp.isBoss ? getBossPreDelay(10) : getMinibossPreDelay();
          spawnQueue[spawnQueue.length - 1].interval += preDelay;
        }

        const proto = (typeof ENEMY_CONFIGS !== 'undefined' && ENEMY_CONFIGS[grp.type]) || { size: 10, shape: 'circle', color: '#00e5ff', glow: '#00e5ff' };
        const isSwarm = grp.type === 'swarm';
        const spawnCount = grp.count || 1;
        const baseRadius = proto.size * (grp.isBoss ? 1.75 : (grp.isMiniBoss ? 1.35 : 1.0));
        const finalRadius = isSwarm ? baseRadius * 0.5 : baseRadius;
        const spawnInterval = grp.interval || 0.8;

        for (let i = 0; i < spawnCount; i++) {
          const isLeft = (i % 2 === 0);
          const laneOffset = isSwarm ? (isLeft ? -6 : 6) : 0;

          spawnQueue.push({
            type: grp.type,
            isBoss: grp.isBoss,
            isMiniBoss: grp.isMiniBoss,
            hp: grp.hp,
            maxHp: grp.hp,
            speed: grp.speed,
            bounty: grp.bounty,
            radius: finalRadius,
            shape: grp.shape || proto.shape,
            color: grp.color || proto.color,
            glow: grp.glow || proto.glow,
            interval: spawnInterval,
            laneOffset: laneOffset
          });
        }
      });
    }

    bossAlertScheduled = false;
    bossAlertShown = false;
    activeBossAlertType = null;
    hideIncomingAlert();

    let firstUnitIsBoss = false;
    if (spawnQueue.length > 0 && (spawnQueue[0].isBoss || spawnQueue[0].isMiniBoss)) {
      firstUnitIsBoss = true;
    }

    if (hasBoss) {
      activeBossAlertType = 'boss';
      bossAlertScheduled = true;
    } else if (hasMiniBoss) {
      activeBossAlertType = 'miniboss';
      bossAlertScheduled = true;
    }

    spawnTimer = firstUnitIsBoss ? 2.0 : 0.15;

    let totalTime = 0;
    if (spawnQueue.length > 1) {
      for (let i = 0; i < spawnQueue.length - 1; i++) totalTime += (spawnQueue[i].interval || 0.8);
    } else {
      totalTime = 0.5;
    }
    waveTotalSpawnTime = totalTime > 0 ? totalTime : 0.8;
    waveSpawnElapsedTime = 0;

    updateWaveCircle(0);
    updateUI();
    if (devMode) refreshDevDropdowns();
    return;
  }

  const lvlConfig = LEVELS_DATA[currentLevel];
  const maxW = lvlConfig ? lvlConfig.totalWaves : 10;
  if (wave > maxW) return;

  waveInProgress = true;
  waveTimerActive = false;
  autoWaveTimeRemaining = 0;
  spawnQueue = [];

  const waveData = lvlConfig ? lvlConfig.waves.find(w => w.wave === wave) : null;
  let hasBoss = false;
  let hasMiniBoss = false;

  if (waveData && waveData.spawns) {
    waveData.spawns.forEach(grp => {
      if (grp.isBoss) hasBoss = true;
      if (grp.isMiniBoss) hasMiniBoss = true;

      if ((grp.isBoss || grp.isMiniBoss) && spawnQueue.length > 0) {
        const preDelay = grp.isBoss ? getBossPreDelay(currentLevel) : getMinibossPreDelay();
        spawnQueue[spawnQueue.length - 1].interval += preDelay;
      }

      const proto = ENEMY_CONFIGS[grp.type] || ENEMY_CONFIGS.grunt;
      const isSwarm = grp.type === 'swarm';
      const swarmClumps = isSwarm ? Math.max(1, grp.clumps || 3) : 0;
      const clumpSize = typeof swarmClumpSizeFor === 'function' ? swarmClumpSizeFor(currentLevel) : 10;
      const spawnCount = isSwarm ? (swarmClumps * clumpSize) : grp.count;
      const baseRadius = proto.size * (grp.isBoss ? 1.75 : (grp.isMiniBoss ? 1.35 : 1.0));
      const finalRadius = isSwarm ? baseRadius * 0.5 : baseRadius;
      const spawnInterval = isSwarm ? (typeof SWARM_CLUMP_INTERVAL !== 'undefined' ? SWARM_CLUMP_INTERVAL : 0.03) : (grp.interval || 0.8);
      const clumpGap = typeof SWARM_CLUMP_GAP !== 'undefined' ? SWARM_CLUMP_GAP : 3.2;

      for (let i = 0; i < spawnCount; i++) {
        const isLeft = (i % 2 === 0);
        const laneOffset = isSwarm ? (isLeft ? -6 : 6) : 0;
        const startsNewClump = isSwarm && i > 0 && (i % clumpSize === 0);
        const interval = startsNewClump ? clumpGap : spawnInterval;

        spawnQueue.push({
          type: grp.type,
          isBoss: grp.isBoss,
          isMiniBoss: grp.isMiniBoss,
          hp: isSwarm ? Math.max(6, Math.round(grp.hp * 0.65)) : grp.hp,
          maxHp: isSwarm ? Math.max(6, Math.round(grp.hp * 0.65)) : grp.hp,
          speed: grp.speed,
          bounty: isSwarm ? Math.max(1, Math.round(grp.bounty * 0.35 * (typeof SWARM_BOUNTY_SCALE !== 'undefined' ? SWARM_BOUNTY_SCALE : 0.62))) : grp.bounty,
          radius: finalRadius,
          shape: grp.shape || proto.shape,
          color: grp.color || proto.color,
          glow: grp.glow || proto.glow,
          interval: interval,
          laneOffset: laneOffset
        });
      }
    });
  }

  bossAlertScheduled = false;
  bossAlertShown = false;
  activeBossAlertType = null;
  hideIncomingAlert();

  let firstUnitIsBoss = false;
  if (spawnQueue.length > 0 && (spawnQueue[0].isBoss || spawnQueue[0].isMiniBoss)) {
    firstUnitIsBoss = true;
  }

  if (hasBoss) {
    activeBossAlertType = 'boss';
    bossAlertScheduled = true;
  } else if (hasMiniBoss) {
    activeBossAlertType = 'miniboss';
    bossAlertScheduled = true;
  }

  spawnTimer = firstUnitIsBoss ? 2.0 : 0.15;

  let totalTime = 0;
  if (spawnQueue.length > 1) {
    for (let i = 0; i < spawnQueue.length - 1; i++) totalTime += (spawnQueue[i].interval || 0.8);
  } else {
    totalTime = 0.5;
  }
  waveTotalSpawnTime = totalTime > 0 ? totalTime : 0.8;
  waveSpawnElapsedTime = 0;

  updateWaveCircle(0);
  updateUI();
  if (devMode) refreshDevDropdowns();
}

// [ENG109] Developer Tools & Spawner Integration: Custom spawner injections, dev controls, and cheat handlers.
function handleDevSpawnClick() {
  if (!devMode || gameState !== 'PLAYING') return;
  const typeSel = document.getElementById('devSpawnType');
  const countEl = document.getElementById('devSpawnCount');
  const intEl = document.getElementById('devSpawnInterval');
  const hpEl = document.getElementById('devSpawnHpMult');
  const spdEl = document.getElementById('devSpawnSpeedMult');
  const hpAbsEl = document.getElementById('devSpawnHpAbs');
  const spdAbsEl = document.getElementById('devSpawnSpeedAbs');
  
  if (typeSel && countEl && intEl) {
    const type = typeSel.value;
    const count = parseInt(countEl.value, 10) || 1;
    const interval = parseFloat(intEl.value) || 0.5;
    const proto = ENEMY_CONFIGS[type] || ENEMY_CONFIGS.grunt;

    let hpMult = hpEl ? parseFloat(hpEl.value) : 1.0;
    if (hpAbsEl && (!hpEl || isNaN(hpMult))) {
      const absHp = parseFloat(hpAbsEl.value) || proto.baseHp;
      hpMult = absHp / proto.baseHp;
    }
    if (isNaN(hpMult) || hpMult <= 0) hpMult = 1.0;

    let speedMult = spdEl ? parseFloat(spdEl.value) : 1.0;
    if (spdAbsEl && (!spdEl || isNaN(speedMult))) {
      const absSpd = parseFloat(spdAbsEl.value) || proto.baseSpeed;
      speedMult = absSpd / proto.baseSpeed;
    }
    if (isNaN(speedMult) || speedMult <= 0) speedMult = 1.0;
    
    injectCustomSpawn(type, count, interval, hpMult, speedMult);
  }
}

function initDevSpawnerSync() {
  const typeSel = document.getElementById('devSpawnType');
  const hpMultEl = document.getElementById('devSpawnHpMult');
  const hpAbsEl = document.getElementById('devSpawnHpAbs');
  const spdMultEl = document.getElementById('devSpawnSpeedMult');
  const spdAbsEl = document.getElementById('devSpawnSpeedAbs');

  if (!typeSel) return;
  if (typeSel.dataset.syncBound === '1') {
    syncFromMult();
    return;
  }
  typeSel.dataset.syncBound = '1';

  function syncFromMult() {
    const proto = ENEMY_CONFIGS[typeSel.value] || ENEMY_CONFIGS.grunt;
    const hpM = (hpMultEl && parseFloat(hpMultEl.value)) ? parseFloat(hpMultEl.value) : 1.0;
    const spdM = (spdMultEl && parseFloat(spdMultEl.value)) ? parseFloat(spdMultEl.value) : 1.0;
    if (hpAbsEl) hpAbsEl.value = Math.max(1, Math.round(proto.baseHp * hpM));
    if (spdAbsEl) spdAbsEl.value = Math.max(1, Math.round(proto.baseSpeed * spdM));
  }

  function syncFromAbsHp() {
    const proto = ENEMY_CONFIGS[typeSel.value] || ENEMY_CONFIGS.grunt;
    const absHp = (hpAbsEl && parseFloat(hpAbsEl.value)) ? parseFloat(hpAbsEl.value) : proto.baseHp;
    if (hpMultEl) hpMultEl.value = (absHp / proto.baseHp).toFixed(2);
  }

  function syncFromAbsSpeed() {
    const proto = ENEMY_CONFIGS[typeSel.value] || ENEMY_CONFIGS.grunt;
    const absSpd = (spdAbsEl && parseFloat(spdAbsEl.value)) ? parseFloat(spdAbsEl.value) : proto.baseSpeed;
    if (spdMultEl) spdMultEl.value = (absSpd / proto.baseSpeed).toFixed(2);
  }

  typeSel.addEventListener('change', syncFromMult);
  if (hpMultEl) hpMultEl.addEventListener('input', syncFromMult);
  if (spdMultEl) spdMultEl.addEventListener('input', syncFromMult);
  if (hpAbsEl) hpAbsEl.addEventListener('input', syncFromAbsHp);
  if (spdAbsEl) spdAbsEl.addEventListener('input', syncFromAbsSpeed);

  syncFromMult();
}

function onDomReady() {
  initDevSpawnerSync();
  if (window.AppUpdater && typeof window.AppUpdater.init === 'function') {
    window.AppUpdater.init();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', onDomReady);
} else {
  onDomReady();
}

function injectCustomSpawn(type, count, interval, hpMult, speedMult) {
  if (gameState !== 'PLAYING') return;

  const proto = ENEMY_CONFIGS[type] || ENEMY_CONFIGS.grunt;
  const isSwarm = type === 'swarm';
  const isBoss = ['hive_empress', 'chronos_warp', 'titan_core', 'emp_overlord'].includes(type);
  
  const clumpSize = typeof swarmClumpSizeFor === 'function' ? swarmClumpSizeFor(currentLevel) : 10;
  const baseRadius = proto.size * (isBoss ? 1.75 : 1.0);
  const finalRadius = isSwarm ? baseRadius * 0.5 : baseRadius;
  const spawnInterval = isSwarm ? (typeof SWARM_CLUMP_INTERVAL !== 'undefined' ? SWARM_CLUMP_INTERVAL : 0.03) : interval;
  const clumpGap = typeof SWARM_CLUMP_GAP !== 'undefined' ? SWARM_CLUMP_GAP : 3.2;

  for (let i = 0; i < count; i++) {
    const isLeft = (i % 2 === 0);
    const laneOffset = isSwarm ? (isLeft ? -6 : 6) : 0;
    const startsNewClump = isSwarm && i > 0 && (i % clumpSize === 0);
    const currentInterval = startsNewClump ? clumpGap : spawnInterval;

    spawnQueue.push({
      type: type,
      isBoss: isBoss,
      isMiniBoss: false,
      hp: Math.max(1, Math.round(proto.baseHp * hpMult)),
      maxHp: Math.max(1, Math.round(proto.baseHp * hpMult)),
      speed: Math.round(proto.baseSpeed * speedMult),
      bounty: Math.max(1, Math.round(proto.baseBounty * (isSwarm ? (typeof SWARM_BOUNTY_SCALE !== 'undefined' ? SWARM_BOUNTY_SCALE : 0.62) : (isBoss ? 4.5 : 1.0)))),
      radius: finalRadius,
      shape: proto.shape,
      color: proto.color,
      glow: proto.glow,
      interval: currentInterval,
      laneOffset: laneOffset
    });
  }

  if (spawnTimer <= 0) spawnTimer = 0.15;
  updateUI();
}

let lastTime = performance.now();

// [ENG110] Performance Monitor & Main Game Loop: Dynamic performance downgrades and main requestAnimationFrame loop.
function samplePerfAndMaybeDowngrade(rawDt) {
  if (perfDecided) return;
  if (settings.perfModeOverride) { perfDecided = true; return; }
  if (gameState !== 'PLAYING' || isLivePaused) return;

  perfSampleFrames++;
  perfSampleTime += rawDt;
  if (perfSampleFrames < 90) return;

  const avgFps = perfSampleTime > 0 ? perfSampleFrames / perfSampleTime : 60;
  perfDecided = true;
  if (avgFps < 42 && perfMode !== 'low') {
    perfMode = 'low';
  }
}

function gameLoop(now) {
  sfxReap();
  const rawDt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  const dt = isLivePaused ? 0 : rawDt * gameTimeScale;

  samplePerfAndMaybeDowngrade(rawDt);

  if (gameState === 'PLAYING' && dt > 0) {
    update(dt);
  }
  render(now);
  requestAnimationFrame(gameLoop);
}

const _elCache = Object.create(null);
function el(id) {
  let n = _elCache[id];
  if (n && n.isConnected !== false) return n;
  n = document.getElementById(id);
  _elCache[id] = n;
  return n;
}

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

  noAdsPurchased = false;
  dailyGiftsClaimedDate = '';
  dailyGiftsClaimedCount = 0;
  timeModTier = 0;
  consecutiveFails = 0;
  lastLoginClaimDate = '';
  loginStreakDay = 1;

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

  showStartScreen();
  renderLevelsGrid();
  updateDiamondUI();
  if (typeof updatePrismUI === 'function') updatePrismUI();
  updateUpgradeButtonsLock();
  if (typeof showHintToast === 'function') showHintToast('Save cleared');
  console.log('SectorDefenseTD: save cleared, state reset.');
}

function handleDevGoldClick() {
  if (!devMode) return;
  devInputOpen = true;
  const val = prompt("Set Gold:", gold);
  devInputOpen = false;
  suppressBackgroundPause();
  if (val !== null) {
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed) && parsed >= 0) {
      gold = parsed;
      updateUI();
    }
  }
}

function handleDevHpClick() {
  if (!devMode) return;
  devInputOpen = true;
  const val = prompt("Set Lives (HP):", baseHp);
  devInputOpen = false;
  suppressBackgroundPause();
  if (val !== null) {
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed) && parsed > 0) {
      baseHp = parsed;
      updateUI();
    }
  }
}

// [ENG111] Daily Rewards & In-App Purchases (IAP): Daily gifts login packs, shop state, and simulated IAP transactions.
function getTodayDateString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function checkDailyGiftReset() {
  const today = getTodayDateString();
  if (dailyGiftsClaimedDate !== today) {
    dailyGiftsClaimedDate = today;
    dailyGiftsClaimedCount = 0;
    saveGameSoon();
  }
}
window.forcePauseForBackground = forcePauseForBackground;

function claimDailyGiftsPack() {
  checkDailyGiftReset();
  if (dailyGiftsClaimedCount >= 3) {
    showHintToast('Daily limit reached (3/3)');
    return;
  }

  const needsAd = dailyGiftsClaimedCount > 0 && !noAdsPurchased;

  const grantGift = () => {
    let msg = '';
    if (dailyGiftsClaimedCount === 0) {
      diamonds += 10;
      msg = '+10 Diamonds claimed!';
    } else if (dailyGiftsClaimedCount === 1) {
      diamonds += 15;
      msg = '+15 Diamonds claimed!';
    } else {
      diamonds += 20;
      prisms += 1;
      msg = '+20 Diamonds & +1 Prism claimed!';
    }
    dailyGiftsClaimedCount++;
    updateDiamondUI();
    if (typeof updatePrismUI === 'function') updatePrismUI();
    if (typeof updateMenuBadges === 'function') updateMenuBadges();
    saveGame();
    sfx('reward');
    renderShopScreen();
    showHintToast(msg);
  };

  if (needsAd) {
    showAdPlaceholder(grantGift, null);
  } else {
    grantGift();
  }
}

// Заглушка покупок (симуляция Google Play Billing)
function buyShopIAP(productId) {
  sfx('confirm');
  if (productId === 'time_mod_t1') {
    if (timeModTier >= 1) {
      showHintToast('Already unlocked!');
      return;
    }
    if (diamonds < 40) {
      showHintToast('Not enough Diamonds! (40 required)');
      return;
    }
    diamonds -= 40;
    timeModTier = 1;
    updateDiamondUI();
    saveGame();
    sfx('reward');
    renderShopScreen();
    showHintToast('Time Control Tier 1 unlocked!');
  } else if (productId === 'time_mod_t2') {
    if (timeModTier >= 2) {
      showHintToast('Already maxed!');
      return;
    }
    if (timeModTier < 1) {
      showHintToast('Unlock Tier 1 first!');
      return;
    }
    if (diamonds < 50) {
      showHintToast('Not enough Diamonds! (50 required)');
      return;
    }
    diamonds -= 50;
    timeModTier = 2;
    updateDiamondUI();
    saveGame();
    sfx('reward');
    renderShopScreen();
    showHintToast('Time Control Tier 2 unlocked!');
  } else if (productId === 'no_ads') {
    if (noAdsPurchased) {
      showHintToast('Already purchased!');
      return;
    }
    noAdsPurchased = true;
    saveGame();
    renderShopScreen();
    showHintToast('No Voluntary Ads unlocked!');
  } else if (productId === 'diamonds_50') {
    diamonds += 50;
    updateDiamondUI();
    saveGame();
    sfx('reward');
    renderShopScreen();
    showHintToast('+50 Diamonds purchased!');
  } else if (productId === 'diamonds_100') {
    diamonds += 100;
    updateDiamondUI();
    saveGame();
    sfx('reward');
    renderShopScreen();
    showHintToast('+100 Diamonds purchased!');
  } else if (productId === 'diamonds_500') {
    diamonds += 500;
    updateDiamondUI();
    saveGame();
    sfx('reward');
    renderShopScreen();
    showHintToast('+500 Diamonds purchased!');
  }
}

// [ENG112] Navigation & Screen Transition Helpers: Start screen, level selection, and chapter label controllers.
function updateStartChapterLabel(show) {
  const el = document.getElementById('startChapterLabel');
  if (!el) return;
  if (show) {
    const sector = Math.max(1, Math.min(TOTAL_SECTIONS,
      Math.ceil(Math.min(maxUnlockedLevel, TOTAL_LEVELS) / LEVELS_PER_SECTION)));
    el.textContent = `CHAPTER ${sector}`;
    el.classList.remove('hidden');
  } else {
    el.classList.add('hidden');
  }
}


// [ENG113] Simulation Step Update Pipeline: Enemy movement, tower targeting, projectile physics, and status effects.
// javascript-obfuscator: disable
function update(dt) {
  if (cameraShakeTimer > 0) {
    cameraShakeTimer -= dt;
    if (cameraShakeTimer < 0) cameraShakeTimer = 0;
  }
  const lvlConfig = LEVELS_DATA[currentLevel];
  const maxW = lvlConfig ? lvlConfig.totalWaves : 10;
  const btn = el('waveBtn');
  const btnText = el('waveBtnText');

  if (waveInProgress && spawnQueue.length > 0) waveSpawnElapsedTime += dt;
  updateWaveCircle(dt);

  if (bossAlertScheduled && !bossAlertShown && spawnQueue.length > 0) {
    let timeToBoss = spawnTimer;
    let foundBoss = false;
    for (let i = 0; i < spawnQueue.length; i++) {
      const item = spawnQueue[i];
      if (item.isBoss || item.isMiniBoss) {
        foundBoss = true;
        break;
      }
      timeToBoss += (item.interval || 0.8);
    }
    if (foundBoss && timeToBoss <= 2.0) {
      bossAlertShown = true;
      sfx('bossIncoming');
      showIncomingAlert(activeBossAlertType);
      bossAlertHideTimer = Math.max(1.0, timeToBoss + 1.0);
    }
  }

  if (bossAlertShown && bossAlertHideTimer > 0) {
    bossAlertHideTimer -= dt;
    if (bossAlertHideTimer <= 0) {
      hideIncomingAlert();
    }
  }

  if (newTowerBannerHideTimer > 0) {
    newTowerBannerHideTimer -= dt;
    if (newTowerBannerHideTimer <= 0) {
      hideNewTowerBanner();
    }
  }

  if (waveTimerActive && autoWaveTimeRemaining > 0) {
    autoWaveTimeRemaining -= dt;
    if (autoWaveTimeRemaining <= 0) {
      autoWaveTimeRemaining = 0;
      waveTimerActive = false;
      if (isEndlessMode || wave < maxW) {
        if (isEndlessMode) {
          addBpXp(5);
        }
        wave++;
        startWave();
      }
    } else {
      if (btn) btn.disabled = false;
      if (btnText) btnText.textContent = 'Go';
    }
  }

  if (spawnQueue.length > 0) {
    spawnTimer -= dt;
    while (spawnTimer <= 0 && spawnQueue.length > 0) {
      const eData = spawnQueue.shift();
      if (WAYPOINTS && WAYPOINTS.length > 1) {
        let spawnX = WAYPOINTS[0].x;
        let spawnY = WAYPOINTS[0].y;
        if (eData.laneOffset) {
          const segDx = WAYPOINTS[1].x - WAYPOINTS[0].x;
          const segDy = WAYPOINTS[1].y - WAYPOINTS[0].y;
          const segLen = Math.hypot(segDx, segDy) || 1;
          const nx = -segDy / segLen;
          const ny = segDx / segLen;
          spawnX += nx * eData.laneOffset;
          spawnY += ny * eData.laneOffset;
        }

        const spawnedEnemy = {
          x: spawnX, y: spawnY,
          laneOffset: eData.laneOffset || 0,
          angle: 0, wpIndex: 1,
          type: eData.type,
          isBoss: eData.isBoss, isMiniBoss: eData.isMiniBoss,
          shape: eData.shape, color: eData.color, glow: eData.glow,
          hp: eData.hp, maxHp: eData.hp,
          speed: eData.speed, baseSpeed: eData.speed,
          bounty: eData.bounty, radius: eData.radius,
          shieldTimer: 0, isShielded: false, warpTimer: 0,
          dashTimer: 0, empTimer: 0, slowTimer: 0
        };

        if (isOverdriveMode && !eData.isBoss && !eData.isMiniBoss) {
          regularSpawnCounter++;
          if (regularSpawnCounter % 10 === 0) {
            spawnedEnemy.maxHp *= 2.5;
            spawnedEnemy.hp = spawnedEnemy.maxHp;
            spawnedEnemy.radius *= 1.25;
            spawnedEnemy.isElite = true;
          }
        }

        enemies.push(spawnedEnemy);
      }
      spawnTimer += (eData.interval || 0.8);
      
      if (spawnQueue.length === 0 && waveInProgress) {
        waveInProgress = false;
        if (isEndlessMode) {
          endlessBestWave = Math.max(endlessBestWave, wave);
          saveGameSoon();
          waveTimerActive = true;
          autoWaveTimeRemaining = 5.0;
          if (btn) btn.disabled = false;
          if (btnText) btnText.textContent = 'Go';
        } else if (wave < maxW) {
          waveTimerActive = true;
          
          let delay = 5.0;
          if (lvlConfig && lvlConfig.waves) {
            const currentWaveObj = lvlConfig.waves.find(w => w.wave === wave);
            if (currentWaveObj && currentWaveObj.delayAfter !== undefined) {
              delay = currentWaveObj.delayAfter;
            }
          }
          autoWaveTimeRemaining = delay;

          if (btn) btn.disabled = false;
          if (btnText) btnText.textContent = 'Go';
        }
      }
    }
  }

  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];

    if (e.type === 'blinker') {
      e.shieldTimer = (e.shieldTimer || 0) + dt;
      if (e.shieldTimer >= 3.0) e.shieldTimer -= 3.0;
      e.isShielded = e.shieldTimer < 1.0;
    }

if (e.type === 'chronos_warp') {
      e.shieldTimer = (e.shieldTimer || 0) + dt;
      if (e.shieldTimer >= 3.0) e.shieldTimer -= 3.0;
      e.isShielded = e.shieldTimer < 1.2;
    }

    if (e.teleportFlashTimer > 0) {
      e.teleportFlashTimer -= dt;
      if (e.teleportFlashTimer < 0) e.teleportFlashTimer = 0;
    }

    if (e.type === 'titan_core') {
      if (e.dashAnim) {
        e.dashAnim.timer += dt;
        const progress = Math.min(1.0, e.dashAnim.timer / e.dashAnim.duration);

        if (progress <= 0.24) {
          e.x = e.dashAnim.startX;
          e.y = e.dashAnim.startY;
          e.dashLineMoving = false;

          // Before jump: materializes particles around himself
          if (Math.random() < 0.8) {
            if (typeof createDamageShards === 'function') createDamageShards(e.x, e.y, '#f97316', 15, false);
            if (typeof createSparks === 'function') createSparks(e.x, e.y, '#fb923c', 3, '#f97316');
          }
        } else if (progress <= 0.76) {
          const moveT = (progress - 0.24) / (0.76 - 0.24);
          e.x = e.dashAnim.startX + (e.dashAnim.endX - e.dashAnim.startX) * moveT;
          e.y = e.dashAnim.startY + (e.dashAnim.endY - e.dashAnim.startY) * moveT;
          const dx = e.dashAnim.endX - e.dashAnim.startX;
          const dy = e.dashAnim.endY - e.dashAnim.startY;
          if (dx !== 0 || dy !== 0) {
            e.angle = Math.atan2(dy, dx);
          }
          e.dashLineMoving = true;

          // During jump: throws particles around as he moves forward
          if (Math.random() < 0.7) {
            if (typeof createDamageShards === 'function') createDamageShards(e.x, e.y, '#f97316', 20, false);
            if (typeof createSparks === 'function') createSparks(e.x, e.y, '#fb923c', 4, '#f97316');
          }
        } else {
          e.x = e.dashAnim.endX;
          e.y = e.dashAnim.endY;
          e.wpIndex = e.dashAnim.endWp;
          e.dashLineMoving = false;
        }

        if (progress >= 1.0) {
          e.x = e.dashAnim.endX;
          e.y = e.dashAnim.endY;
          e.wpIndex = e.dashAnim.endWp;
          e.dashAnim = null;
          e.dashLineMoving = false;
          e.teleportFlashTimer = 0.25;

          if (typeof createShockwave === 'function') createShockwave(e.x, e.y, 65, '#fb923c');
          if (typeof createDamageShards === 'function') createDamageShards(e.x, e.y, '#f97316', 40, false);
          if (typeof createSparks === 'function') createSparks(e.x, e.y, '#fb923c', 10, '#f97316');
        }

        continue;
      }

      e.dashTimer = (e.dashTimer || 0) + dt;
      if (e.dashTimer >= 6.0) {
        e.dashTimer -= 6.0;
        const startX = e.x;
        const startY = e.y;
        const wasFrozen = (e.slowTimer > 0);

        e.speed = e.baseSpeed;
        e.slowTimer = 0;

        if (wasFrozen) {
          if (typeof createDamageShards === 'function') createDamageShards(startX, startY, '#38bdf8', 25, true);
          if (typeof createSparks === 'function') createSparks(startX, startY, '#38bdf8', 12, '#ffffff');
        }

        if (typeof createShockwave === 'function') createShockwave(startX, startY, 50, '#f97316');

        let simX = e.x;
        let simY = e.y;
        let simWp = e.wpIndex;
        let dashRemaining = 140;

        while (dashRemaining > 0 && simWp < WAYPOINTS.length) {
          const twp = WAYPOINTS[simWp];
          const distToWp = Math.hypot(twp.x - simX, twp.y - simY);
          if (distToWp <= dashRemaining) {
            dashRemaining -= distToWp;
            simX = twp.x; simY = twp.y;
            simWp++;
          } else {
            simX += ((twp.x - simX) / distToWp) * dashRemaining;
            simY += ((twp.y - simY) / distToWp) * dashRemaining;
            dashRemaining = 0;
          }
        }

        e.dashAnim = {
          startX: startX,
          startY: startY,
          endX: simX,
          endY: simY,
          endWp: simWp,
          timer: 0,
          duration: 0.50
        };

        sfx('stasis');
      }
    }

    if (e.type === 'hive_empress') {
      e.summonTimer = (e.summonTimer || 0) + dt;
      if (e.summonTimer >= 3.0) {
        e.summonTimer -= 3.0;
        createShockwave(e.x, e.y, 65, '#00ffcc');
        for (let s = 0; s < 3; s++) {
          enemies.push({
            x: e.x + (Math.random() - 0.5) * 16,
            y: e.y + (Math.random() - 0.5) * 16,
            angle: e.angle, wpIndex: e.wpIndex,
            type: 'swarm', isBoss: false, isMiniBoss: false,
            shape: 'diamond', color: '#00ffcc', glow: '#00ffcc',
            hp: 20, maxHp: 20, speed: 95, baseSpeed: 95,
            bounty: 3, radius: 8, slowTimer: 0
          });
        }
      }
    }

    if (e.type === 'emp_overlord') {
      e.empTimer = (e.empTimer || 0) + dt;
      if (e.empTimer >= 5.0) {
        e.empTimer -= 5.0;
        sfx('stasis');
        createShockwave(e.x, e.y, 180, '#f05f9f');
        towers.forEach(t => {
          if (Math.hypot(t.x - e.x, t.y - e.y) <= 180) {
            t.disabledTimer = Math.max(t.disabledTimer || 0, 2.5);
            sfx('steam');
            createDamageShards(t.x, t.y, '#f05f9f', 16, false);
          }
        });
      }
    }

    if (e.slowTimer > 0) {
      e.slowTimer -= dt;
      if (e.slowTimer <= 0) e.speed = e.baseSpeed;
    }

    const targetWp = WAYPOINTS[e.wpIndex];
    if (!targetWp) continue;

    let targetX = targetWp.x;
    let targetY = targetWp.y;
    if (e.laneOffset) {
      const prevWp = WAYPOINTS[e.wpIndex - 1] || WAYPOINTS[0];
      const nextWp = WAYPOINTS[e.wpIndex + 1];
      const segDx = targetWp.x - prevWp.x;
      const segDy = targetWp.y - prevWp.y;
      const segLen = Math.hypot(segDx, segDy) || 1;
      let offX = -segDy / segLen;
      let offY = segDx / segLen;
      if (nextWp) {
        const seg2Dx = nextWp.x - targetWp.x;
        const seg2Dy = nextWp.y - targetWp.y;
        const seg2Len = Math.hypot(seg2Dx, seg2Dy) || 1;
        offX += -seg2Dy / seg2Len;
        offY += seg2Dx / seg2Len;
      }
      targetX += offX * e.laneOffset;
      targetY += offY * e.laneOffset;
    }

    const dx = targetX - e.x;
    const dy = targetY - e.y;
    const dist = Math.hypot(dx, dy);
    const effectiveSpeed = e.speed * (isOverdriveMode ? 1.2 : 1.0);
    const step = effectiveSpeed * dt;
    e.angle = Math.atan2(dy, dx);

    if (dist <= step) {
      e.x = targetX; e.y = targetY;
      e.wpIndex++;
      if (e.wpIndex >= WAYPOINTS.length) {
        const damageToBasePath = getBaseDamageFor(e);
        baseHp = Math.max(0, baseHp - damageToBasePath);
        sfx('baseHit');
        vibrate('warning');
        createShockwave(e.x, e.y, e.isBoss ? 80 : (e.isMiniBoss ? 50 : 35), '#f05f9f');
        enemies.splice(i, 1);
        updateUI();
        if (baseHp <= 0) {
          baseHp = 0;
          if (!reviveUsedThisMatch) {
            triggerEmergencyRevivePrompt();
            return;
          }
          triggerDefeat();
          return;
        }
        continue;
      }
    } else {
      e.x += (dx / dist) * step;
      e.y += (dy / dist) * step;
    }
  }

  towers.forEach(t => {
    if (t.disabledTimer > 0) {
      t.disabledTimer -= dt;
      if (t.disabledTimer < 0) t.disabledTimer = 0;
      return;
    }

    let target = null;
    const rangeSq = t.range * t.range;
    const isLockingTowerType = (typeof LOCKED_TARGET_TOWERS !== 'undefined' ? LOCKED_TARGET_TOWERS : ['laser', 'melter']).includes(t.type);
    
    if (isLockingTowerType && t.target && enemies.includes(t.target) && t.target.hp > 0) {
      const dxL = t.target.x - t.x;
      const dyL = t.target.y - t.y;
      if (dxL * dxL + dyL * dyL <= rangeSq) target = t.target;
    }

    if (!target) {
      let maxDistProgress = -1;
      for (let e of enemies) {
        const dx = e.x - t.x;
        const dy = e.y - t.y;
        if (dx * dx + dy * dy <= rangeSq && WAYPOINTS[e.wpIndex]) {
          const wp = WAYPOINTS[e.wpIndex];
          const wdx = wp.x - e.x;
          const wdy = wp.y - e.y;
          // Вейпоинт-прогресс с приблизительным быстрым расстоянием Манхэттена/L1
          const progress = e.wpIndex * 1000 - (Math.abs(wdx) + Math.abs(wdy));
          if (progress > maxDistProgress) {
            maxDistProgress = progress;
            target = e;
          }
        }
      }
    }

    const isNewTarget = (t.target !== target);
    if (isNewTarget) {
      t.lockOnTimer = 0;
      t.target = target;
    } else if (target) {
      t.lockOnTimer = (t.lockOnTimer || 0) + dt;
    }
    const isLockedOn = !!target && (t.lockOnTimer || 0) >= (t.lockOnDelay || 0);
    t.isLockedOn = isLockedOn;

    if (target && t.type !== 'stasis') {
      t.angle = Math.atan2(target.y - t.y, target.x - t.x);
    }

    if (t.type === 'gun') {
      t.lastFire += dt;
      if (target && isLockedOn && t.lastFire >= t.fireRate) {
        t.lastFire = 0;
        sfx('gun');
        projectiles.push({
          type: 'bullet',
          x: t.x + Math.cos(t.angle) * 22,
          y: t.y + Math.sin(t.angle) * 22,
          target: target,
          damage: t.damage,
          speed: 460,
          color: t.color
        });
      }
    }

    if (t.type === 'laser' && target && isLockedOn) {
      sfx('laserHit');
      if (!target.isShielded) {
        target.hp -= t.damage * dt;
        checkEnemyEnrage(target);
        if (Math.random() < 0.25) {
          createDamageShards(target.x, target.y, target.color, t.damage * dt * 4, false);
          createImpactSmoke(target.x, target.y, 8);
        }
      }
    }

    if (t.type === 'mortar') {
      t.lastFire += dt;
      if (target && isLockedOn && t.lastFire >= t.fireRate) {
        t.lastFire = 0;
        sfx('mortarFire');
        const mSpec = TOWER_GLYPH_SPECS.mortar;
        const elevRad = (mSpec.elevationDeg || 55) * Math.PI / 180;
        const muzzleDist = (mSpec.muzzle ? mSpec.muzzle.atX : 23) * Math.cos(elevRad);
        const launchX = t.x + Math.cos(t.angle) * muzzleDist;
        const launchY = t.y + Math.sin(t.angle) * muzzleDist;
        const range = Math.hypot(target.x - launchX, target.y - launchY);
        projectiles.push({
          type: 'mortar_shell',
          x: launchX,
          y: launchY,
          targetX: target.x, targetY: target.y,
          targetRef: target,
          damage: t.damage,
          splash: TOWER_CONFIGS.mortar.splash * (1 + (t.level - 1) * 0.15),
          duration: t.mortarTravelTime || MORTAR_BASE_TRAVEL_TIME || 1.0, elapsed: 0,
          startX: launchX, startY: launchY,
          arcApex: Math.max(12, range * Math.tan(elevRad) / 4),
          color: t.color
        });
      }
    }

    if (t.type === 'tesla') {
      t.lastFire += dt;
      if (target && isLockedOn && t.lastFire >= t.fireRate) {
        sfx('tesla');
        t.lastFire = 0;
        const maxChains = (t.level === 1) ? 3 : (t.level === 2 ? 4 : 5);
        const jumpRadius = TOWER_CONFIGS.tesla.jumpRadius;
        const hitTargets = [target];
        let currentChainSource = target;
        let chainDmg = t.damage;

        lightningBolts.push({
          x1: t.x, y1: t.y - 6, x2: target.x, y2: target.y,
          delay: 0, travelTime: 0.05, life: 0.22, maxLife: 0.22,
          targetRef: target, damage: chainDmg, hasDealtDamage: false,
          color: '#00ffcc', towerColor: t.color
        });

        for (let c = 1; c < maxChains; c++) {
          let nextTarget = null;
          let minDist = jumpRadius;
          for (let e of enemies) {
            if (!hitTargets.includes(e)) {
              const d = Math.hypot(e.x - currentChainSource.x, e.y - currentChainSource.y);
              if (d < minDist) {
                minDist = d;
                nextTarget = e;
              }
            }
          }
          if (nextTarget) {
            chainDmg *= 0.65;
            lightningBolts.push({
              x1: currentChainSource.x, y1: currentChainSource.y, x2: nextTarget.x, y2: nextTarget.y,
              delay: c * 0.045, travelTime: 0.05, life: 0.22, maxLife: 0.22,
              targetRef: nextTarget, damage: chainDmg, hasDealtDamage: false,
              color: '#00ffcc', towerColor: t.color
            });
            hitTargets.push(nextTarget);
            currentChainSource = nextTarget;
          } else {
            break;
          }
        }
      }
    }

    if (t.type === 'stasis') {
      t.lastFire += dt;
      if (t.lastFire >= t.fireRate) {
        t.lastFire = 0;
        sfx('stasis');
        createShockwave(t.x, t.y, t.range, t.color);
        enemies.forEach(e => {
          const dxS = e.x - t.x;
          const dyS = e.y - t.y;
          if (dxS * dxS + dyS * dyS <= rangeSq && !e.isShielded) {
            const stasisPowerLvl = getUpgradeEffectiveLevel('stasis_power');
            const baseSlow = (t.slowFactor !== undefined) ? t.slowFactor : (TOWER_CONFIGS.stasis.slowFactor || 0.30);
            const baseDur = (t.slowDuration !== undefined) ? t.slowDuration : (TOWER_CONFIGS.stasis.slowDuration || 1.4);
            const boostedSlow = Math.min(0.9, baseSlow * (1 + stasisPowerLvl * (TOWER_CONFIGS.stasis.powerSlow || 0)));
            const boostedDuration = baseDur * (1 + stasisPowerLvl * (TOWER_CONFIGS.stasis.powerDuration || 0));
            e.slowTimer = boostedDuration;
            e.speed = e.baseSpeed * (1 - boostedSlow);
            createDamageShards(e.x, e.y, t.color, 10, false);
          }
        });
      }
    }

    if (t.type === 'melter') {
      const rampTime = t.melterRampTime || TOWER_CONFIGS.melter.rampTime || 4.0;
      const rampCap = TOWER_CONFIGS.melter.rampCap || 40;
      if (t.melterCoolingTimer > 0) {
        t.melterCoolingTimer -= dt;
        t.steamTimer = (t.steamTimer || 0) - dt;
        if (t.steamTimer <= 0) {
          t.steamTimer = 0.08 + Math.random() * 0.07;
          createSteamPuff(t.x, t.y - 9);
        }
        if (t.melterCoolingTimer <= 0) {
          t.melterCoolingTimer = 0;
          t.melterFireTimer = 0;
        }
      } else if (target && isLockedOn) {
        t.melterFireTimer = (t.melterFireTimer || 0) + dt;
        sfx('melterHit');
        if (!target.isShielded) {
          const rampProgress = Math.min(t.melterFireTimer, rampTime) / rampTime;
          const rampMultiplier = Math.pow(rampCap, rampProgress);
          target.hp -= t.damage * rampMultiplier * dt;
          if (Math.random() < 0.3) {
            createDamageShards(target.x, target.y, target.color, t.damage * rampMultiplier * dt * 3, false);
            createImpactSmoke(target.x, target.y, 9 + rampProgress * 5);
          }
        }
        checkEnemyEnrage(target);
        if (t.melterFireTimer >= rampTime) {
          t.melterCoolingTimer = t.melterCooldownTime || rampTime;
          t.melterFireTimer = 0;
          createDamageShards(t.x, t.y, '#fb923c', 25, false);
          for (let s = 0; s < 7; s++) createSteamPuff(t.x, t.y - 9);
        }
      } else {
        if (t.melterFireTimer > 0) {
          t.melterFireTimer = Math.max(0, t.melterFireTimer - dt);
        }
      }
    }

    if (t.type === 'railgun') {
      t.lastFire += dt;
      if (target && isLockedOn && t.lastFire >= t.fireRate) {
        t.lastFire = 0;
        sfx('railgun');
      
      const beamLength = 3500;
      const beamEndX = t.x + Math.cos(t.angle) * beamLength;
      const beamEndY = t.y + Math.sin(t.angle) * beamLength;
      
      let railShardCount = 0;

      for (let j = 0; j < enemies.length; j++) {
        const e = enemies[j];
        const vx = beamEndX - t.x;
        const vy = beamEndY - t.y;
        const wx = e.x - t.x;
        const wy = e.y - t.y;
        const c1 = wx * vx + wy * vy;
        const c2 = vx * vx + vy * vy;
        const param = c2 !== 0 ? Math.max(0, Math.min(1, c1 / c2)) : 0;
        const projX = t.x + param * vx;
        const projY = t.y + param * vy;
        const distSq = (e.x - projX) * (e.x - projX) + (e.y - projY) * (e.y - projY);
        const hitR = e.radius + 14;

        if (distSq <= hitR * hitR && !e.isShielded) {
          e.hp -= t.damage;
          checkEnemyEnrage(e);
          if (typeof createFloatingDamage === 'function') {
            createFloatingDamage(e.x, e.y, t.damage, '#a275df');
          }
          if (railShardCount < 4) {
            createDamageShards(e.x, e.y, e.color, t.damage, false);
            if (typeof createImpactSmoke === 'function') createImpactSmoke(e.x, e.y, 12);
            railShardCount++;
          }
        }
      }

        if (typeof createRailBeamFx === 'function') {
          createRailBeamFx(t.x, t.y, beamEndX, beamEndY, t.color || '#00e5ff');
        }
      }
    }
  });

  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    if (p.type === 'bullet') {
      if (!enemies.includes(p.target)) { projectiles.splice(i, 1); continue; }
      const dx = p.target.x - p.x;
      const dy = p.target.y - p.y;
      const dist = Math.hypot(dx, dy);
      const step = p.speed * dt;

      if (dist <= step) {
        if (!p.target.isShielded) {
          p.target.hp -= p.damage;
          checkEnemyEnrage(p.target);
          if (typeof createFloatingDamage === 'function') {
            createFloatingDamage(p.target.x, p.target.y, p.damage, p.color || '#00e5ff');
          }
          createShockwave(p.target.x, p.target.y, 14, p.color || '#00e5ff');
          createDamageShards(p.target.x, p.target.y, p.target.color, p.damage, false);
          createImpactSmoke(p.target.x, p.target.y, 11);
        } else {
          createDamageShards(p.target.x, p.target.y, '#60a5fa', 10, false);
        }
        projectiles.splice(i, 1);
      } else {
        p.x += (dx / dist) * step;
        p.y += (dy / dist) * step;
      }
    } else if (p.type === 'mortar_shell') {
      p.elapsed += dt;
      const tProg = p.elapsed / p.duration;
      p.x = p.startX + (p.targetX - p.startX) * tProg;
      p.y = p.startY + (p.targetY - p.startY) * tProg;

      if (tProg >= 1) {
        sfx('explosion');
        let hitEnemyColor = (p.targetRef && enemies.includes(p.targetRef)) ? p.targetRef.color : null;
        const splashSq = p.splash * p.splash;
        let shardSpawnCount = 0;

        for (let j = 0; j < enemies.length; j++) {
          const e = enemies[j];
          const dx = e.x - p.targetX;
          const dy = e.y - p.targetY;
          const distSq = dx * dx + dy * dy;

          if (distSq <= splashSq && !e.isShielded) {
            if (!hitEnemyColor) hitEnemyColor = e.color;
            const d = Math.sqrt(distSq);
            const splashDmg = p.damage * (1 - d / (p.splash * 1.3));
            e.hp -= splashDmg;
            checkEnemyEnrage(e);
            if (typeof createFloatingDamage === 'function') {
              createFloatingDamage(e.x, e.y, splashDmg, p.color || '#ff9100');
            }

            if (shardSpawnCount < 3) {
              createDamageShards(e.x, e.y, e.color, splashDmg, false);
              if (typeof createImpactSmoke === 'function') createImpactSmoke(e.x, e.y, 10);
              shardSpawnCount++;
            }
          }
        }
        createExplosion(p.targetX, p.targetY, p.splash, p.color || '#ff9100', '#f05f9f', 'mortar');
        createShockwave(p.targetX, p.targetY, p.splash * 1.15, p.color || '#ff9100');
        projectiles.splice(i, 1);
      }
    }
  }

  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    if (e.hp <= 0) {
      sessionMobKillsCount++;
      if (sessionMobKillsCount % 5 === 0) {
        addBpXp(1);
      }
      const moneyMultiplier = 1 + getUpgradeEffectiveLevel('base_gold') * 0.05;
      gold += Math.round(e.bounty * moneyMultiplier);
      sfxDeath(e);

      if (e.type === 'emp_bomber') {
        sfx('stasis');
        createShockwave(e.x, e.y, 110, '#f05f9f');
        towers.forEach(t => {
          if (Math.hypot(t.x - e.x, t.y - e.y) <= 110) {
            t.disabledTimer = Math.max(t.disabledTimer || 0, 3.0);
            sfx('steam');
            createDamageShards(t.x, t.y, '#f05f9f', 16, false);
          }
        });
      }

      if (e.isBoss || e.isMiniBoss) {
        createShockwave(e.x, e.y, e.isBoss ? 80 : 50, e.color);
      }

      if (e.isBoss || e.isMiniBoss) {
        createExplosion(e.x, e.y, e.isBoss ? 45 : 22, e.color, e.glow || e.color, 'boss');
      }

      createDamageShards(e.x, e.y, e.color, e.isBoss ? 120 : (e.isMiniBoss ? 60 : 35), true);
      enemies.splice(i, 1);
    }
  }
  updateUI();

  for (let i = particles.length - 1; i >= 0; i--) {
    const pt = particles[i];
    pt.x += pt.vx * dt; pt.y += pt.vy * dt;
    pt.life -= dt;
    if (pt.life <= 0) particles.splice(i, 1);
  }

  for (let i = shockwaves.length - 1; i >= 0; i--) {
    const sw = shockwaves[i];
    sw.elapsed += dt;
    if (sw.elapsed >= sw.duration) shockwaves.splice(i, 1);
  }

for (let i = lightningBolts.length - 1; i >= 0; i--) {
    const lb = lightningBolts[i];
    if (lb.delay && lb.delay > 0) {
      lb.delay -= dt;
      continue;
    }
    lb.elapsed = (lb.elapsed || 0) + dt;
    lb.life -= dt;

    // Урон наносится ровно 1 раз за жизнь молнии
    if (!lb.hasDealtDamage && !lb.targetRef.isShielded && enemies.includes(lb.targetRef)) {
      lb.hasDealtDamage = true; // <-- блокируем повторный урон на следующих кадрах!
      lb.targetRef.hp -= lb.damage;
      checkEnemyEnrage(lb.targetRef);

      if (typeof createFloatingDamage === 'function') {
        createFloatingDamage(lb.targetRef.x, lb.targetRef.y, lb.damage, '#00ffcc');
      }

      if (Math.random() < 0.5) {
        if (typeof createDamageShards === 'function') {
          createDamageShards(lb.x2, lb.y2, lb.targetRef.color, lb.damage, false);
        } else {
          createSparks(lb.x2, lb.y2, lb.towerColor || lb.color || '#00ffcc', 3, lb.targetRef.color);
        }
      }
    }

    if (lb.life <= 0) lightningBolts.splice(i, 1);
  }

  if (!isEndlessMode && wave >= maxW && spawnQueue.length === 0 && enemies.length === 0 && baseHp > 0 && gameState === 'PLAYING') {
    if (victoryDelayTimer <= 0) {
      victoryDelayTimer = 1.0;
    } else {
      victoryDelayTimer -= dt;
      if (victoryDelayTimer <= 0) {
        triggerVictory();
      }
    }
  } else {
    victoryDelayTimer = 0;
  }
}
// javascript-obfuscator: enable
