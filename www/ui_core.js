// Synth Wave Defense — ui_core.js (Core theme, sprites, camera, tutorial, input gestures, HUD, inspector)

//  Presentation layer and rendering pipeline initialization.

// [UI.A]
function getTheme() {
  if (typeof window !== 'undefined' && window.activeThemeColors) {
    return window.activeThemeColors;
  }
  return {
    id: 'default',
    c1: '#00e5ff', c2: '#d946ef', c3: '#f05f9f', c4: '#ff9100', c5: '#38bdf8', bg: '#03050d',
    c1Light: '#8ef3ff', c2Light: '#f0abfc', c3Light: '#ff8fb0', c4Light: '#ffc166', c5Light: '#93c5fd',
    rgb1: { r: 0, g: 229, b: 255, cssRgb: '0, 229, 255', norm: [0, 0.898, 1] },
    rgb2: { r: 217, g: 70, b: 239, cssRgb: '217, 70, 239', norm: [0.851, 0.275, 0.937] },
    rgb3: { r: 240, g: 95, b: 159, cssRgb: '240, 95, 159', norm: [0.941, 0.373, 0.624] },
    rgb4: { r: 255, g: 145, b: 0, cssRgb: '255, 145, 0', norm: [1, 0.569, 0] },
    rgb5: { r: 56, g: 189, b: 248, cssRgb: '56, 189, 248', norm: [0.22, 0.741, 0.973] }
  };
}

//  Thread Lag & Memory Monitor: High-frequency sampler tracking WebView thread freezes (>20ms).
window._maxThreadLag = 0;
window._lastThreadLag = 0;

// [UI.B]
let threadLagMonitorId = null;

function startThreadLagMonitor() {
  if (threadLagMonitorId !== null) return;
  let lastTick = performance.now();
  const lagSamples = [];

  // [UI.C]
  threadLagMonitorId = setInterval(() => {
    const now = performance.now();
    const delta = now - lastTick;
    lastTick = now;

    const lag = Math.max(0, Math.round(delta - 20));

    if (lag > 5) {
      lagSamples.push({ time: now, lag: lag });
      if (lag > window._maxThreadLag) {
        window._maxThreadLag = lag;
      }
    }

    const cutoff = now - 2000;
    while (lagSamples.length > 0 && lagSamples[0].time < cutoff) {
      lagSamples.shift();
    }

    let peakLast = 0;
    for (let i = 0; i < lagSamples.length; i++) {
      if (lagSamples[i].lag > peakLast) {
        peakLast = lagSamples[i].lag;
      }
    }
    window._lastThreadLag = peakLast;
  }, 20);
}

// [UI.CM_STOP]
function stopThreadLagMonitor() {
  if (threadLagMonitorId !== null) {
    clearInterval(threadLagMonitorId);
    threadLagMonitorId = null;
  }
}

// [UI.D]
function getJSHeapSizeMB() {
  if (typeof performance !== 'undefined' && performance.memory && typeof performance.memory.usedJSHeapSize === 'number') {
    return performance.memory.usedJSHeapSize / (1024 * 1024);
  }
  return null;
}

window.perfProfiler = {
  times: { sim: 0, towers: 0, drawMobs: 0, drawFx: 0, total: 0 },
  accum: { sim: 0, towers: 0, drawMobs: 0, drawFx: 0, frames: 0 },
  lastFlush: performance.now(),
  report: ''
};

//  Glow sprites cache for high-performance additive blending.
const GLOW_SPRITES = Object.create(null);
// [UI.E]
function createGlowSprite(color) {
  const size = 64;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const gCtx = c.getContext('2d');
  const half = size / 2;
  const grad = gCtx.createRadialGradient(half, half, 0, half, half, half);
  grad.addColorStop(0, color);
  grad.addColorStop(0.35, color);
  grad.addColorStop(1, 'transparent');
  gCtx.fillStyle = grad;
  gCtx.beginPath();
  gCtx.arc(half, half, half, 0, Math.PI * 2);
  gCtx.fill();
  return c;
}

//  Offscreen canvas cache for static grid and track rendering.
let offscreenGridCanvas = null;
let offscreenGridDirty = true;

// [UI.F]
function invalidateGridCache() {
  offscreenGridDirty = true;
  if (typeof clearFxSpriteCaches === 'function') clearFxSpriteCaches();
}

// [UI.FM_CHEV] Shared neon portal chevron renderer (used by map grid & battle previews).
function drawNeonChevron(targetCtx, cx, cy, ang, size, col) {
  targetCtx.save();
  targetCtx.translate(cx, cy);
  targetCtx.rotate(ang);
  targetCtx.lineCap = 'round';
  targetCtx.lineJoin = 'round';

  targetCtx.beginPath();
  targetCtx.moveTo(-size * 0.8, -size);
  targetCtx.lineTo(size * 0.9, 0);
  targetCtx.lineTo(-size * 0.8, size);

  targetCtx.strokeStyle = col;
  targetCtx.globalAlpha = 0.30;
  targetCtx.lineWidth = 7.5;
  targetCtx.stroke();

  targetCtx.globalAlpha = 1.0;
  targetCtx.lineWidth = 3.0;
  targetCtx.stroke();

  targetCtx.strokeStyle = '#ffffff';
  targetCtx.globalAlpha = 0.55;
  targetCtx.lineWidth = 1.2;
  targetCtx.stroke();
  targetCtx.restore();
}

//  Offscreen neon disc sprite cache for particle rendering optimization.
const NEON_DISC_SPRITES = Object.create(null);
// [UI.H]
function getNeonDiscSprite(color) {
  if (NEON_DISC_SPRITES[color]) return NEON_DISC_SPRITES[color];
  const size = 32;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const gCtx = c.getContext('2d');
  const half = size / 2;
  const grad = gCtx.createRadialGradient(half, half, 1, half, half, half);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.35, color);
  grad.addColorStop(0.85, color + '55');
  grad.addColorStop(1, 'transparent');
  gCtx.fillStyle = grad;
  gCtx.beginPath();
  gCtx.arc(half, half, half, 0, Math.PI * 2);
  gCtx.fill();
  NEON_DISC_SPRITES[color] = c;
  return c;
}

//  Offscreen concentric smoke sprite cache.
let SMOKE_SPRITE = null;
// [UI.J]
function getSmokeSprite() {
  if (SMOKE_SPRITE) return SMOKE_SPRITE;
  const size = 64;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const sCtx = c.getContext('2d');
  const half = size / 2;
  const grad = sCtx.createRadialGradient(half, half, 4, half, half, half);
  grad.addColorStop(0, 'rgba(48, 54, 76, 0.9)');
  grad.addColorStop(0.5, 'rgba(28, 32, 48, 0.6)');
  grad.addColorStop(0.85, 'rgba(15, 18, 28, 0.2)');
  grad.addColorStop(1, 'transparent');
  sCtx.fillStyle = grad;
  sCtx.beginPath();
  sCtx.arc(half, half, half, 0, Math.PI * 2);
  sCtx.fill();
  SMOKE_SPRITE = c;
  return c;
}

// [UI.K]
function getGlowSprite(color) {
  if (!GLOW_SPRITES[color]) {
    GLOW_SPRITES[color] = createGlowSprite(color);
  }
  return GLOW_SPRITES[color];
}

// [UI.KK]
(function initGlobalReliableTouch() {
  const INTERACTIVE_SELECTOR = [
    'button',
    '[role="button"]',
    '.mode-3way-tab',
    '.level-btn',
    '.synth-pass-widget',
    '.loadout-widget-header',
    '.settings-collapsible-header',
    '.tactical-tips-widget',
    '.custom-palette-trigger',
    '.custom-palette-option',
    '.badge-half.interactive'
  ].join(',');

  const MOVE_THRESHOLD_PX = 24;
  let activeTarget = null;
  let startX = 0;
  let startY = 0;
  let movedTooFar = false;
  let lastNativeClickTime = 0;
  let syntheticClickInFlight = false;

  // Отслеживаем, сработал ли обычный нативный click сам по себе
  document.addEventListener('click', (e) => {
    if (syntheticClickInFlight) return;
    lastNativeClickTime = performance.now();
  }, true);

  document.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const target = e.target && e.target.closest ? e.target.closest(INTERACTIVE_SELECTOR) : null;
    if (!target || target.disabled || target.classList.contains('is-disabled')) {
      activeTarget = null;
      return;
    }
    activeTarget = target;
    startX = e.clientX;
    startY = e.clientY;
    movedTooFar = false;
  }, { capture: true, passive: true });

  document.addEventListener('pointermove', (e) => {
    if (!activeTarget || movedTooFar) return;
    const dx = Math.abs(e.clientX - startX);
    const dy = Math.abs(e.clientY - startY);
    if (dx > MOVE_THRESHOLD_PX || dy > MOVE_THRESHOLD_PX) {
      movedTooFar = true;
    }
  }, { capture: true, passive: true });

  document.addEventListener('pointerup', (e) => {
    if (!activeTarget) return;
    const target = activeTarget;
    const wasMoved = movedTooFar;
    activeTarget = null;
    movedTooFar = false;

    if (wasMoved || target.disabled) return;

    // Проверяем, что палец при отпускании всё ещё находится в пределах кнопки (или рядом с ней)
    const rect = target.getBoundingClientRect();
    const pad = 12;
    const inside = (
      e.clientX >= rect.left - pad &&
      e.clientX <= rect.right + pad &&
      e.clientY >= rect.top - pad &&
      e.clientY <= rect.bottom + pad
    );
    if (!inside) return;

    const upTime = performance.now();
    // Даем браузеру 35мс на генерацию штатного click.
    // Если WebView проглотил click (после свайпа или из-за микро-сдвига пальца) — вызываем его принудительно!
    setTimeout(() => {
      if (lastNativeClickTime >= upTime - 15) return;
      if (target.disabled || !document.body.contains(target)) return;
      syntheticClickInFlight = true;
      try {
        target.click();
      } finally {
        syntheticClickInFlight = false;
      }
    }, 35);
  }, { capture: true, passive: true });

  document.addEventListener('pointercancel', () => {
    activeTarget = null;
    movedTooFar = false;
  }, { capture: true, passive: true });
})();

//  Banner and incoming threat alert visual indicators.
// [UI.L]
function showNewTowerBanner(type) {
  const banner = document.getElementById('newTowerBanner');
  if (!banner) return;
  const iconBox = document.getElementById('newTowerBannerIcon');
  const nameEl = document.getElementById('newTowerBannerName');
  if (iconBox) iconBox.innerHTML = TOWER_ICONS[type] || '';
  if (nameEl) nameEl.textContent = TOWER_NAMES[type] || type;
  banner.classList.add('visible');
  newTowerBannerHideTimer = 4.5;
}

// [UI.M]
function hideNewTowerBanner() {
  const banner = document.getElementById('newTowerBanner');
  if (banner) banner.classList.remove('visible');
  newTowerBannerHideTimer = 0;
}

// [UI.N]
function showIncomingAlert(type) {
  const banner = document.getElementById('incomingAlertBanner');
  const textEl = document.getElementById('incomingAlertText');
  if (!banner || !textEl) return;

  banner.className = 'incoming-alert-banner';
  banner.style.backdropFilter = 'none';
  banner.style.webkitBackdropFilter = 'none';
  banner.style.background = 'rgba(10, 12, 24, 0.92)';
  banner.style.willChange = 'transform, opacity';

  if (type === 'boss') {
    banner.classList.add('boss');
    textEl.textContent = t('boss_incoming');
  } else if (type === 'miniboss') {
    banner.classList.add('miniboss');
    textEl.textContent = t('miniboss_incoming');
  } else {
    return;
  }

  banner.classList.add('visible');
  activeBossAlertType = type;
  bossAlertShown = true;
  bossAlertHideTimer = 3.0;
}

// [UI.O]
function hideIncomingAlert() {
  const banner = document.getElementById('incomingAlertBanner');
  if (banner) banner.classList.remove('visible');
  activeBossAlertType = null;
}

//  Viewport canvas resize and camera coordinate transform system.
// [UI.P]
let _lastCanvasResizeW = 0;
let _lastCanvasResizeH = 0;

function isMobileInputFocused() {
  if (typeof devInputOpen !== 'undefined' && devInputOpen) return true;
  const active = document.activeElement;
  if (!active) return false;
  const tag = active.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || active.isContentEditable;
}

function resizeCanvasAndCamera(forceEv) {
  // Не пересчитываем холст и фон, когда на мобилке открыта клавиатура или поле ввода дев-меню
  if (isMobileInputFocused() && _lastCanvasResizeW > 0) {
    return;
  }

  const vpWidth = window.innerWidth || (window.visualViewport ? window.visualViewport.width : 360);
  const vpHeight = window.innerHeight || (window.visualViewport ? window.visualViewport.height : 640);

  // Если ширина не изменилась, а высота сжалась из-за выезда мобильной клавиатуры — игнорируем ресайз
  if (
    forceEv !== true &&
    _lastCanvasResizeW > 0 &&
    Math.abs(vpWidth - _lastCanvasResizeW) < 4 &&
    vpHeight < _lastCanvasResizeH * 0.85
  ) {
    return;
  }

  _lastCanvasResizeW = vpWidth;
  _lastCanvasResizeH = vpHeight;

  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

  canvas.width = vpWidth * dpr;
  canvas.height = vpHeight * dpr;
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  FIELD_WIDTH = COLS * TILE_SIZE;
  FIELD_HEIGHT = ROWS * TILE_SIZE;

  const topHudEl = document.getElementById('topHud');
  const bottomEl = document.getElementById('controlsWrapper');
  const topH = (topHudEl && !topHudEl.classList.contains('hidden'))
    ? topHudEl.getBoundingClientRect().height
    : 76;
  const bottomH = (bottomEl && !bottomEl.classList.contains('hidden'))
    ? bottomEl.getBoundingClientRect().height
    : 110;

  const hudRect = (topHudEl && !topHudEl.classList.contains('hidden'))
    ? topHudEl.getBoundingClientRect()
    : null;
  const topSafeLimit = hudRect ? (hudRect.bottom + 10) : (topH + 10);

  const BOTTOM_RESERVE = Math.max(bottomH, 115);
  const usableHeight = Math.max(160, vpHeight - topSafeLimit - BOTTOM_RESERVE);

  const paddedWidth = FIELD_WIDTH;
  const paddedHeight = FIELD_HEIGHT;

  const oldBaseZoom = baseZoom || 1.0;
  const zoomRatio = (camZoom && oldBaseZoom) ? (camZoom / oldBaseZoom) : 1.0;

  baseZoom = Math.min(vpWidth / paddedWidth, usableHeight / paddedHeight);
  minZoom = baseZoom * 0.95;
  maxZoom = Math.max(2.2, baseZoom * 2.5);

  camZoom = Math.min(maxZoom, Math.max(minZoom, baseZoom * zoomRatio));

  const viewFieldH = FIELD_HEIGHT * camZoom;

  camX = (vpWidth / 2) - (FIELD_WIDTH * camZoom / 2);

  if (viewFieldH <= usableHeight) {
    const desiredCenterY = topSafeLimit + (usableHeight * 0.38);
    camY = Math.max(topSafeLimit, desiredCenterY - (viewFieldH / 2));
  } else {
    camY = topSafeLimit;
  }

  clampCamera();
  if (typeof invalidateGridCache === 'function') {
    invalidateGridCache();
  }
}

// [UI.Q]
function clampCamera() {
  const screenW = _lastCanvasResizeW || window.innerWidth;
  const screenH = _lastCanvasResizeH || window.innerHeight;
  const viewFieldW = FIELD_WIDTH * camZoom;
  const viewFieldH = FIELD_HEIGHT * camZoom;

  const topHudEl = document.getElementById('topHud');
  const bottomEl = document.getElementById('controlsWrapper');

  const topH = (topHudEl && !topHudEl.classList.contains('hidden'))
    ? topHudEl.getBoundingClientRect().height
    : 76;
  const bottomH = (bottomEl && !bottomEl.classList.contains('hidden'))
    ? bottomEl.getBoundingClientRect().height
    : 110;

  const hudRect = (topHudEl && !topHudEl.classList.contains('hidden'))
    ? topHudEl.getBoundingClientRect()
    : null;
  const topSafeLimit = hudRect ? (hudRect.bottom + 10) : (topH + 10);

  const BOTTOM_RESERVE = Math.max(bottomH, 115);
  const usableHeight = Math.max(100, screenH - topSafeLimit - BOTTOM_RESERVE);

  if (viewFieldW <= screenW) {
    camX = (screenW - viewFieldW) / 2;
  } else {
    camX = Math.max(screenW - viewFieldW, Math.min(0, camX));
  }

  const EXTRA_PAN_UP = (TILE_SIZE * 2) * camZoom;

  if (viewFieldH <= usableHeight) {
    const defaultY = Math.max(topSafeLimit, (topSafeLimit + (usableHeight * 0.38)) - (viewFieldH / 2));
    const minY = defaultY - EXTRA_PAN_UP;
    const maxY = defaultY;
    camY = Math.max(minY, Math.min(maxY, camY));
  } else {
    const minY = (screenH - BOTTOM_RESERVE) - viewFieldH - EXTRA_PAN_UP;
    const maxY = topSafeLimit;
    camY = Math.max(minY, Math.min(maxY, camY));
  }
}

// [UI.R]
function screenToWorld(sx, sy) {
  const rect = canvas.getBoundingClientRect();
  const relX = sx - rect.left;
  const relY = sy - rect.top;
  return {
    x: (relX - camX) / camZoom,
    y: (relY - camY) / camZoom
  };
}

// [UI.S]
function worldToScreen(wx, wy) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: wx * camZoom + camX + rect.left,
    y: wy * camZoom + camY + rect.top
  };
}

window.addEventListener('resize', resizeCanvasAndCamera);
// [UI.T]
window.addEventListener('orientationchange', () => {
  setTimeout(() => resizeCanvasAndCamera(true), 150);
});
window.addEventListener('load', () => resizeCanvasAndCamera(true));

//  Lock default touch behaviors on active canvas and UI overlays.
// [UI.U]
document.addEventListener('touchmove', (e) => {
  const isScrollableOverlay = e.target.closest && e.target.closest(
    '.result-stack, .upgrades-row-list, .settings-box, .settings-collapsible-body, .settings-collapsible-widget, .loadout-widget, .loadout-widget-expanded, .loadout-grid, .levels-bg, .bp-tier-list, .shop-list-body'
  );
  if (isScrollableOverlay) {
    return;
  }
  if (gameState === 'PLAYING' && e.cancelable) {
    e.preventDefault();
  }
}, { passive: false });

//  Interactive level tutorial overlay and sequence step controller.
// [UI.V]
function initTutorialForLevel(lvl) {
  tutorialActive = false;
  tutorialLevel = null;
  tutorialStep = -1;
  tutorialTargetTower = null;
  tutorialDestCell = null;
  hideTutorialUI();

  // Гарантируем актуальный язык элементов перед запуском обучения
  if (typeof applyStaticTranslations === 'function') {
    applyStaticTranslations();
  }

  const showSkipButton = () => {
    const skipBtn = document.getElementById('tutorialSkipBtn');
    if (skipBtn) {
      skipBtn.textContent = (typeof t === 'function') ? t('skip_tutorial') : 'Skip Tutorial';
      skipBtn.classList.remove('hidden');
    }
  };

  if (lvl === 1 && !tutorialSeen.l1 && !hasClearedLevelBefore(1)) {
    tutorialActive = true;
    tutorialLevel = 1;
    tutorialStep = 0;
    tutorialDestCell = findTutorialBuildCell();
    showSkipButton();
  } else if (lvl === 2 && !tutorialSeen.l2 && !hasClearedLevelBefore(2)) {
    tutorialActive = true;
    tutorialLevel = 2;
    tutorialStep = -1;
    showSkipButton();
  }
}

// [UI.W]
function hideTutorialUI() {
  const layer = document.getElementById('tutorialLayer');
  if (layer) layer.classList.add('hidden');
  const skipBtn = document.getElementById('tutorialSkipBtn');
  if (skipBtn) skipBtn.classList.add('hidden');
  const closeHighlight = document.getElementById('tutorialCloseBtnHighlight');
  if (closeHighlight) closeHighlight.classList.add('hidden');
}

// [UI.X]
function completeTutorial(lvl) {
  tutorialActive = false;
  tutorialLevel = null;
  tutorialStep = -1;
  tutorialTargetTower = null;
  if (lvl === 1) tutorialSeen.l1 = true;
  if (lvl === 2) tutorialSeen.l2 = true;
  hideTutorialUI();
  saveGameSoon();
  safeTrack('tutorial_step_complete', { level: lvl });
}

// [UI.Y]
function skipTutorial() {
  if (!tutorialActive || !tutorialLevel) return;
  completeTutorial(tutorialLevel);
}

// [UI.Z]
function buildDiagnostics() {
  // [UI.AA]
  const probe = (label, fn) => {
    try { return { label, ok: true, value: fn() }; }
    catch (e) { return { label, ok: false, value: 'ERROR: ' + (e && e.message ? e.message : e) }; }
  };

  // [UI.AB]
  function audioReport() {
    const rows = [];
    rows.push(probe('audio.js loaded', () => typeof SFX !== 'undefined' && !!SFX));
    rows.push(probe('music.js loaded', () => typeof MusicManager !== 'undefined' && !!MusicManager));
    rows.push(probe('settings.sfxVolume', () => settings.sfxVolume));
    rows.push(probe('settings.musicVolume', () => settings.musicVolume));
    rows.push(probe('SFX.isEnabled()', () => SFX.isEnabled()));
    rows.push(probe('MUSIC.isEnabled()', () => MusicManager.isEnabled()));
    rows.push(probe('MUSIC.current()', () => MusicManager.current()));
    // [UI.AC]
    rows.push(probe('AudioContext state', () => {
      const c = SFX._ctx && SFX._ctx();
      return c ? c.state : 'no context yet (needs a tap)';
    }));
    // [UI.AD]
    rows.push(probe('sample pack loaded', () => {
      const n = SFX.sampleNames ? SFX.sampleNames() : [];
      return n.length ? n.length + ' samples' : 'none (using synth ticks)';
    }));
    return rows;
  }

  // [UI.AE]
  function generalReport() {
    return [
      probe('game booted', () => !!window.__gameBooted),
      probe('gameState', () => gameState),
      // [UI.AF]
      probe('currentLevel / maxUnlocked', () => `${currentLevel} / ${maxUnlockedLevel}`),
      probe('devMode', () => devMode),
      probe('perfMode', () => perfMode),
      // [UI.AG]
      probe('towers / enemies / projectiles', () => `${towers.length} / ${enemies.length} / ${projectiles.length}`),
      probe('data.js levels', () => Object.keys(LEVELS_DATA).length),
      probe('save present', () => !!localStorage.getItem('sectorDefenseTD_save_v1')),
      probe('selectedLoadout', () => selectedLoadout.join(', '))
    ];
  }

  // [UI.AH]
  function print(title, rows) {
    console.group('%c' + title, 'color:#00e5ff;font-weight:bold');
    rows.forEach(r => {
      const bad = !r.ok || r.value === false;
      console.log('%c' + (bad ? '✗' : '✓') + ' ' + r.label + ':',
        'color:' + (bad ? '#ff2a85' : '#8ef3ff'), r.value);
    });
    console.groupEnd();
  }

  const diag = function () {
    print('Synth Wave Defense — diagnostics', generalReport());
    print('Audio', audioReport());
    console.log('%cTip: diag.audio() for audio only, diag.fix() to force-restart audio, diag.silent() to check why nothing is audible.', 'color:#6f7c96');
    return undefined;
  };

  diag.audio = function () { print('Audio', audioReport()); };
  diag.game = function () { print('Game', generalReport()); };

  diag.silent = function () {
    const reasons = [];
    try {
      if (typeof SFX === 'undefined' || !SFX) reasons.push('audio.js did not load');
      else {
        if (!SFX.isEnabled()) reasons.push('SFX disabled — sound volume is at 0 in Settings');
        const c = SFX._ctx && SFX._ctx();
        if (!c) reasons.push('AudioContext not created yet — browser requires a gesture');
        else if (c.state === 'suspended') reasons.push('AudioContext suspended — tap page once or call diag.fix()');
      }
      if (typeof MusicManager === 'undefined' || !MusicManager) reasons.push('music.js did not load');
      else {
        if (!MusicManager.isEnabled()) reasons.push('music disabled — music volume is at 0 in Settings');
        if (!MusicManager.current()) reasons.push('no music category active right now');
      }
    } catch (e) { reasons.push('probe threw: ' + e.message); }

    if (!reasons.length) console.log('%c✓ Nothing is muting audio — it should be audible.', 'color:#8ef3ff');
    else reasons.forEach(r => console.log('%c✗ ' + r, 'color:#ff2a85'));
  };

  diag.fix = function () {
    try { SFX.unlock(); } catch (e) { console.log('SFX.unlock failed:', e.message); }
    try { musicUnlock(); } catch (e) { console.log('musicUnlock failed:', e.message); }
    try {
      applySfxVolume(settings.sfxVolume != null ? settings.sfxVolume : 100, false);
      applyMusicVolume(settings.musicVolume != null ? settings.musicVolume : 70, false);
    } catch (e) { console.log('volume reapply failed:', e.message); }
    try {
      const want = (gameState === 'PLAYING' || gameState === 'PAUSED') ? 'battle' : 'menu';
      MusicManager.play(want);
      console.log('%c✓ audio re-armed, music category: ' + want, 'color:#8ef3ff');
    } catch (e) { console.log('music restart failed:', e.message); }
  };

  diag.testSound = function () {
    try {
      SFX.unlock();
      ['tap', 'gun', 'explosion'].forEach((n, i) => setTimeout(() => SFX.play(n), i * 260));
      console.log('%cPlaying test audio ticks…', 'color:#8ef3ff');
    } catch (e) { console.log('test failed:', e.message); }
  };

  return diag;
}
window.diag = buildDiagnostics();

window.resetTutorial = function () {
  tutorialSeen.l1 = false;
  tutorialSeen.l2 = false;
  tutorialSeen.l3 = false;
  Object.keys(tutorialSeen).forEach(k => {
    if (k.startsWith('towerUnlock_l')) tutorialSeen[k] = false;
  });
  saveGameSoon();
  console.log('Tutorial flags reset.');
};

// [UI.AI]
function findTutorialBuildCell() {
  const centerC = (COLS - 1) / 2;
  const centerR = (ROWS - 1) / 2;
  let best = null;
  let bestDist = Infinity;
  for (let r = 0; r < ROWS; r++) {
    if (!grid[r]) continue;
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c] !== 0) continue;
      const d = Math.hypot(c - centerC, r - centerR);
      if (d < bestDist) {
        bestDist = d;
        best = { c, r };
      }
    }
  }
  return best;
}

// [UI.AJ]
function applyTutorialHighlight(rect, text, mode) {
  const pad = 10;
  const spotlight = document.getElementById('tutorialSpotlight');
  spotlight.style.left = (rect.x - pad) + 'px';
  spotlight.style.top = (rect.y - pad) + 'px';
  spotlight.style.width = (rect.w + pad * 2) + 'px';
  spotlight.style.height = (rect.h + pad * 2) + 'px';
  spotlight.classList.remove('hidden');

  const cx = rect.x + rect.w / 2;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const placeAbove = rect.y > vh * 0.5;

  const bubble = document.getElementById('tutorialBubble');
  document.getElementById('tutorialBubbleText').textContent = text;
  bubble.style.left = Math.min(Math.max(cx, 116), vw - 116) + 'px';
  bubble.style.top = placeAbove ? (rect.y - pad - 54) + 'px' : (rect.y + rect.h + pad + 16) + 'px';
  bubble.classList.remove('hidden');

  if (mode === 'tap') {
    const cy = rect.y + rect.h / 2;
    const tapPulse = document.getElementById('tutorialTapPulse');
    if (tapPulse) {
      tapPulse.style.left = cx + 'px';
      tapPulse.style.top = cy + 'px';
      tapPulse.classList.remove('hidden');
    }
    const dropRing = document.getElementById('tutorialDropRing');
    if (dropRing) dropRing.classList.add('hidden');

    const pointer = document.getElementById('tutorialPointer');
    if (pointer) {
      pointer.style.left = cx + 'px';
      pointer.style.top = cy + 'px';
      pointer.style.opacity = '1';
      pointer.classList.remove('hidden');
    }
  }
}

// [UI.AK]
function positionTutorialTapOnElement(el, text) {
  if (!el) return;
  const r = el.getBoundingClientRect();
  applyTutorialHighlight({ x: r.left, y: r.top, w: r.width, h: r.height }, text, 'tap');
}

// [UI.AL]
function positionTutorialTapAtWorld(wx, wy, text) {
  const screen = worldToScreen(wx, wy);
  const radius = 26 * camZoom;
  applyTutorialHighlight({ x: screen.x - radius, y: screen.y - radius, w: radius * 2, h: radius * 2 }, text, 'tap');
}

// [UI.AM]
function positionTutorialCloseStep() {
  const topLeft = worldToScreen(0, 0);
  const bottomRight = worldToScreen(FIELD_WIDTH, FIELD_HEIGHT);
  const pad = 6;
  const fieldWidth = Math.max(0, (bottomRight.x - topLeft.x) - pad * 2);
  const fieldHeight = Math.max(0, (bottomRight.y - topLeft.y) - pad * 2);

  const fieldEl = document.getElementById('tutorialFieldHighlight');
  if (fieldEl) {
    fieldEl.style.left = (topLeft.x + pad) + 'px';
    fieldEl.style.top = (topLeft.y + pad) + 'px';
    fieldEl.style.width = fieldWidth + 'px';
    fieldEl.style.height = fieldHeight + 'px';
    fieldEl.classList.remove('hidden');
  }

  const spotlight = document.getElementById('tutorialSpotlight');
  if (spotlight) {
    spotlight.style.left = (topLeft.x + pad) + 'px';
    spotlight.style.top = (topLeft.y + pad) + 'px';
    spotlight.style.width = fieldWidth + 'px';
    spotlight.style.height = fieldHeight + 'px';
    spotlight.classList.remove('hidden');
  }

  const towerBlock = document.getElementById('tutorialTowerBlock');
  if (towerBlock && selectedTower) {
    const tScreen = worldToScreen(selectedTower.c * TILE_SIZE, selectedTower.r * TILE_SIZE);
    const tileSizeScreen = TILE_SIZE * camZoom;
    towerBlock.style.left = tScreen.x + 'px';
    towerBlock.style.top = tScreen.y + 'px';
    towerBlock.style.width = tileSizeScreen + 'px';
    towerBlock.style.height = tileSizeScreen + 'px';
    towerBlock.classList.remove('hidden');
    // [UI.AN]
    towerBlock.onclick = (e) => {
      e.stopPropagation();
      if (typeof showHintToast === 'function') {
        showHintToast(typeof t === 'function' ? t('tut_close_hint') : 'Tap the empty field or ✕ to close');
      }
    };
  }

  const closeBtn = document.getElementById('inspectCloseBtn');
  const closeHighlight = document.getElementById('tutorialCloseBtnHighlight');
  if (closeBtn && closeHighlight) {
    const r = closeBtn.getBoundingClientRect();
    closeHighlight.style.left = r.left + 'px';
    closeHighlight.style.top = r.top + 'px';
    closeHighlight.style.width = r.width + 'px';
    closeHighlight.style.height = r.height + 'px';
    closeHighlight.innerHTML = closeBtn.innerHTML;
    closeHighlight.classList.remove('hidden');
  }

  let targetX, targetY;
  if (selectedTower) {
    const targetCellScreen = worldToScreen((selectedTower.c + 1.1) * TILE_SIZE, (selectedTower.r + 1.85) * TILE_SIZE);
    targetX = targetCellScreen.x;
    targetY = targetCellScreen.y;
  } else {
    targetX = topLeft.x + fieldWidth * 0.60;
    targetY = topLeft.y + fieldHeight * 0.76;
  }

  const maxSafeX = (bottomRight.x - pad) - 80;
  const maxSafeY = (bottomRight.y - pad) - 35;
  targetX = Math.min(targetX, maxSafeX);
  targetY = Math.min(targetY, maxSafeY);

  const bubble = document.getElementById('tutorialBubble');
  const bubbleText = document.getElementById('tutorialBubbleText');
  if (bubbleText) bubbleText.textContent = typeof t === 'function' ? t('tut_close') : 'Tap here or ✕ to close';
  if (bubble) {
    bubble.style.left = targetX + 'px';
    bubble.style.top = (targetY - 52) + 'px';
    bubble.classList.remove('hidden');
  }

  const tapPulse = document.getElementById('tutorialTapPulse');
  if (tapPulse) {
    tapPulse.style.left = targetX + 'px';
    tapPulse.style.top = targetY + 'px';
    tapPulse.classList.remove('hidden');
  }

  const pointer = document.getElementById('tutorialPointer');
  if (pointer) {
    pointer.style.left = targetX + 'px';
    pointer.style.top = targetY + 'px';
    pointer.style.opacity = '1';
    pointer.classList.remove('hidden');
  }

  const dropRing = document.getElementById('tutorialDropRing');
  if (dropRing) dropRing.classList.add('hidden');
}

// [UI.AO]
function animateTutorialTapGesture(now) {
  const pointer = document.getElementById('tutorialPointer');
  if (!pointer || pointer.classList.contains('hidden')) return;
  const cycle = (now % 1000) / 1000;
  const tap = Math.sin(cycle * Math.PI * 2);
  const offset = tap > 0 ? tap * 6 : 0;
  pointer.style.transform = `translate(${offset * 0.7}px, ${offset * 0.7}px) scale(${1 - offset * 0.015})`;
}

// [UI.AP]
function updateTutorialOverlay(now) {
  const layer = document.getElementById('tutorialLayer');
  const skipBtn = document.getElementById('tutorialSkipBtn');
  if (!layer) return;
  
  if (!tutorialActive || gameState !== 'PLAYING' || tutorialStep < 0) {
    layer.classList.add('hidden');
    if (skipBtn && tutorialActive) skipBtn.classList.add('hidden');
    return;
  }
  
  layer.classList.remove('hidden');
  if (skipBtn && tutorialActive) skipBtn.classList.remove('hidden');

  const fieldEl = document.getElementById('tutorialFieldHighlight');
  const closeHighlight = document.getElementById('tutorialCloseBtnHighlight');
  if (!(tutorialLevel === 2 && tutorialStep === 2)) {
    if (fieldEl) fieldEl.classList.add('hidden');
    if (closeHighlight) closeHighlight.classList.add('hidden');
  }

  if (tutorialLevel === 1 && tutorialStep === 0) {
    positionTutorialDrag(now);
  } else if (tutorialLevel === 1 && tutorialStep === 1) {
    positionTutorialTapOnElement(document.getElementById('waveBtn'), typeof t === 'function' ? t('tut_tap_go') : 'Tap GO to start the wave');
    animateTutorialTapGesture(now);
  } else if (tutorialLevel === 2 && tutorialStep === 0 && tutorialTargetTower) {
    positionTutorialTapAtWorld(tutorialTargetTower.x, tutorialTargetTower.y, typeof t === 'function' ? t('tut_tap_tower') : 'Tap your tower');
    animateTutorialTapGesture(now);
  } else if (tutorialLevel === 2 && tutorialStep === 1) {
    positionTutorialTapOnElement(document.getElementById('inspectUpgradeBtn'), typeof t === 'function' ? t('tut_upgrade') : 'Upgrade it here');
    animateTutorialTapGesture(now);
  } else if (tutorialLevel === 2 && tutorialStep === 2) {
    positionTutorialCloseStep();
    animateTutorialTapGesture(now);
  }
}

// [UI.AQ]
function positionTutorialDrag(now) {
  const srcEl = document.getElementById('btn-gun');
  if (!srcEl || !tutorialDestCell) return;
  const srcRect = srcEl.getBoundingClientRect();
  const hintText = (typeof window.t === 'function') ? window.t('tut_drag_tower') : 'Drag a tower onto the field';
  applyTutorialHighlight({ x: srcRect.left, y: srcRect.top, w: srcRect.width, h: srcRect.height }, hintText, 'drag');

  const destWorld = {
    x: tutorialDestCell.c * TILE_SIZE + TILE_SIZE / 2,
    y: tutorialDestCell.r * TILE_SIZE + TILE_SIZE / 2
  };
  const destScreen = worldToScreen(destWorld.x, destWorld.y);
  const tileScreenSize = TILE_SIZE * camZoom;

  const dropRing = document.getElementById('tutorialDropRing');
  if (dropRing) {
    dropRing.style.left = (destScreen.x - tileScreenSize * 0.36) + 'px';
    dropRing.style.top = (destScreen.y - tileScreenSize * 0.36) + 'px';
    dropRing.style.width = (tileScreenSize * 0.72) + 'px';
    dropRing.style.height = (tileScreenSize * 0.72) + 'px';
    dropRing.classList.remove('hidden');
  }

  const srcCx = srcRect.left + srcRect.width / 2;
  const srcCy = srcRect.top + srcRect.height / 2;

  const period = 2000;
  const animT = (now % period) / period;
  let px, py, opacity, scale;

  if (animT < 0.20) {
    px = srcCx;
    py = srcCy;
    const appearProg = Math.min(1, animT / 0.12);
    opacity = appearProg;
    scale = 1.0 - Math.sin(appearProg * Math.PI * 0.5) * 0.08;
  } else if (animT < 0.70) {
    const moveT = (animT - 0.20) / 0.50;
    const eased = moveT < 0.5 
      ? 2 * moveT * moveT 
      : 1 - Math.pow(-2 * moveT + 2, 2) / 2;
    px = srcCx + (destScreen.x - srcCx) * eased;
    py = srcCy + (destScreen.y - srcCy) * eased;
    opacity = 1.0;
    scale = 0.92;
  } else if (animT < 0.85) {
    px = destScreen.x;
    py = destScreen.y;
    opacity = 1.0;
    scale = 1.0;
  } else {
    px = destScreen.x;
    py = destScreen.y;
    opacity = Math.max(0, 1.0 - (animT - 0.85) / 0.15);
    scale = 1.0;
  }

  const pointer = document.getElementById('tutorialPointer');
  if (pointer) {
    pointer.style.left = px + 'px';
    pointer.style.top = py + 'px';
    pointer.style.opacity = opacity.toFixed(3);
    pointer.style.transform = `scale(${scale.toFixed(3)})`;
    pointer.classList.remove('hidden');
  }

  const tapPulse = document.getElementById('tutorialTapPulse');
  if (tapPulse) tapPulse.classList.add('hidden');
}

// [UI.AR]
function setGlow(color, blur) {
  if (perfMode === 'low') {
    ctx.shadowBlur = 0;
    return;
  }
  ctx.shadowColor = color;
  ctx.shadowBlur = Math.min(blur, 8);
}

// [UI.AS]
function pushParticle(p) {
  const cap = perfMode === 'low' ? 85 : 150;
  if (particles.length > cap) {
    if (!p.isSmoke && !p.isBossFx && !p.isCrossFlash && Math.random() < 0.45) return;
    particles[0].life *= 0.45;
  }
  particles.push(p);
}

// [UI.AT]
function formatResourceVal(val) {
  const n = Math.floor(Number(val) || 0);
  if (n < 1000) return String(n);
  if (n < 10000) {
    const k = Math.floor(n / 100) / 10;
    return (k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)) + 'K';
  }
  if (n < 1000000) {
    return Math.floor(n / 1000) + 'K';
  }
  const m = Math.floor(n / 100000) / 10;
  return (m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)) + 'M';
}

// Единый контроллер видимости элементов верхней панели
// [UI.AU]
function syncTopHudVisibility() {
  const isActiveBattle = (typeof gameState !== 'undefined' && gameState === 'PLAYING');

  const diamondBadge = document.getElementById('hudDiamondBadge');
  const prismBadge = document.getElementById('hudPrismBadge');
  const econHpBadge = document.getElementById('econHpSplitBadge');
  const levelWaveBadge = document.getElementById('levelWaveSplitBadge');
  const hudRightGroup = document.getElementById('hudRightGroup');

  if (diamondBadge) diamondBadge.classList.toggle('hidden', isActiveBattle);
  if (prismBadge) prismBadge.classList.toggle('hidden', isActiveBattle);

  if (econHpBadge) econHpBadge.classList.toggle('hidden', !isActiveBattle);
  if (levelWaveBadge) levelWaveBadge.classList.toggle('hidden', !isActiveBattle);

  if (hudRightGroup) hudRightGroup.classList.remove('hidden');

  if (typeof updateHudSpeedWidget === 'function') updateHudSpeedWidget();
}
window.syncTopHudVisibility = syncTopHudVisibility;

// [UI.AV]
function updateDiamondUI() {
  const formatted = formatResourceVal(diamonds);
  const el = document.getElementById('globalDiamondsVal');
  if (el) el.textContent = formatted;
  const elLevels = document.getElementById('levelsDiamondVal');
  if (elLevels) elLevels.textContent = formatted;
  const elUpgrades = document.getElementById('upgradesDiamondVal');
  if (elUpgrades) elUpgrades.textContent = formatted;
  const elShop = document.getElementById('shopDiamondVal');
  if (elShop) elShop.textContent = formatted;
  const elBp = document.getElementById('bpDiamondVal');
  if (elBp) elBp.textContent = formatted;
  const badge = document.getElementById('hudDiamondBadge');
  if (badge) {
    if (devMode) {
      badge.classList.add('interactive');
      badge.title = "Click: +50 / Hold: set amount (Dev Mode)";
    } else {
      badge.classList.remove('interactive');
      badge.removeAttribute('title');
    }
  }
  syncTopHudVisibility();
}

// [UI.AW]
function updatePrismUI() {
  const formatted = formatResourceVal(prisms);
  const el = document.getElementById('globalPrismsVal');
  if (el) el.textContent = formatted;
  const elLevels = document.getElementById('levelsPrismVal');
  if (elLevels) elLevels.textContent = formatted;
  const elUpgrades = document.getElementById('upgradesPrismVal');
  if (elUpgrades) elUpgrades.textContent = formatted;
  const elShop = document.getElementById('shopPrismVal');
  if (elShop) elShop.textContent = formatted;
  const elBp = document.getElementById('bpPrismVal');
  if (elBp) elBp.textContent = formatted;
  const badge = document.getElementById('hudPrismBadge');
  if (badge) {
    if (devMode) {
      badge.classList.add('interactive');
      badge.title = "Click: +10 / Hold: set amount (Dev Mode)";
    } else {
      badge.classList.remove('interactive');
      badge.removeAttribute('title');
    }
  }
  syncTopHudVisibility();
}

// [UI.AX] Заглушки до динамической инициализации системного модуля
function initDevResourceHold() {}
function handleDevDiamondClick() {}
function handleDevPrismClick() {}
function handleDevGoldClick() {}
function handleDevHpClick() {}

const BASE_BRANCH_ICONS = {
  base_hp: `<svg width="34" height="34" viewBox="-20 -20 40 40"><g transform="scale(1.35)"><path d="M 0 8 L -7.5 0.5 A 4.8 4.8 0 0 1 0 -6 A 4.8 4.8 0 0 1 7.5 0.5 Z" fill="#f05f9f"/></g></svg>`,
  base_gold: `<svg width="34" height="34" viewBox="-20 -20 40 40"><g transform="translate(-12, -12)"><circle cx="12" cy="12" r="11" fill="#ff9100"/><text x="12" y="17.5" font-size="16" font-weight="900" fill="#000000" text-anchor="middle" font-family="Montserrat, sans-serif">$</text></g></svg>`
};
const BASE_BRANCH_COLORS = { base_hp: '#f05f9f', base_gold: '#ff9100' };

const CUSTOM_LOCK_SVG = `<svg width="12" height="12" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="flex:none;"><path d="M 7,10 V 6 C 7,3.5 9,2 12,2 C 15,2 17,3.5 17,6 V 10"/><rect x="4" y="10" width="16" height="12" rx="3" fill="currentColor" fill-opacity="0.2"/></svg>`;

// [UI.BN]
function enablePointerScroll(el) {
  if (!el || el.dataset.pointerScrollBound) return;
  el.dataset.pointerScrollBound = '1';

  let isDown = false;
  let startY = 0;
  let scrollTop = 0;
  let isDragging = false;

  // [UI.BO]
  el.addEventListener('pointerdown', (e) => {
    isDown = true;
    isDragging = false;
    startY = e.clientY;
    scrollTop = el.scrollTop;
  });

  // [UI.BP]
  el.addEventListener('pointermove', (e) => {
    if (!isDown) return;
    const dy = e.clientY - startY;
    if (Math.abs(dy) > 4) {
      isDragging = true;
      el.scrollTop = scrollTop - dy;
    }
  });

  // [UI.BQ]
  const endDrag = (e) => {
    if (isDragging && e) {
      // [UI.BR]
      const preventClick = (clickEv) => {
        clickEv.stopPropagation();
        clickEv.preventDefault();
      };
      el.addEventListener('click', preventClick, { capture: true, once: true });
      // [UI.BS]
      setTimeout(() => el.removeEventListener('click', preventClick, { capture: true }), 50);
    }
    isDown = false;
    isDragging = false;
  };

  el.addEventListener('pointerup', endDrag);
  el.addEventListener('pointercancel', endDrag);
  el.addEventListener('pointerleave', endDrag);
}

let isDevModeActive = false;
let isDevExpanded = false;

// Developer mode panel interface and visibility control.
// [UI.CM]
function devJumpToWave(targetWave) {
  const lvlConfig = LEVELS_DATA[currentLevel];
  const maxW = lvlConfig ? lvlConfig.totalWaves : 10;
  if (!isEndlessMode && (targetWave < 1 || targetWave > maxW)) return;
  if (isEndlessMode && targetWave < 1) return;

  enemies = [];
  projectiles = [];
  spawnQueue = [];
  waveInProgress = false;
  waveTimerActive = false;
  autoWaveTimeRemaining = 0;
  wave = targetWave;
  startWave();
}

const DEV_SPEED_STEPS = [0.5, 0.75, 0.9, 1, 1.25, 1.5, 2, 4, 8];

//  Time modulation speed levels and HUD controls.
// [UI.DA]
function getHudAllowedSpeeds() {
  const tier = typeof timeModTier !== 'undefined' ? timeModTier : 0;
  if (tier >= 2) {
    return [0.5, 0.75, 0.9, 1.0, 1.25, 1.5, 2.0];
  } else if (tier >= 1) {
    return [0.9, 1.0, 1.25];
  }
  return [1.0];
}

// [UI.DB]
function updateHudSpeedWidget() {
  const widget = document.getElementById('hudSpeedWidget');
  if (!widget) return;

  const isCombatPause = (gameState === 'PAUSED' && (typeof settingsPreviousSource === 'undefined' || settingsPreviousSource === 'combat' || settingsPreviousSource === 'pause'));
  const isBattle = (gameState === 'PLAYING' || isCombatPause);

  const showWidget = isBattle && ((typeof timeModTier !== 'undefined' && timeModTier > 0) || devMode);
  widget.classList.toggle('hidden', !showWidget);

  if (!showWidget) return;

  const curSpeed = typeof gameTimeScale !== 'undefined' ? gameTimeScale : 1.0;
  const valEl = document.getElementById('hudSpeedVal');
  if (valEl) {
    valEl.textContent = `${curSpeed}x`;
  }

  const allowed = devMode ? DEV_SPEED_STEPS : getHudAllowedSpeeds();
  let curIdx = allowed.indexOf(curSpeed);
  if (curIdx === -1) {
    curIdx = allowed.reduce((closest, val, idx) =>
      Math.abs(val - curSpeed) < Math.abs(allowed[closest] - curSpeed) ? idx : closest, 0);
  }

  const fasterBtn = document.getElementById('hudSpeedFasterBtn');
  const slowerBtn = document.getElementById('hudSpeedSlowerBtn');

  if (fasterBtn) {
    fasterBtn.disabled = curIdx >= allowed.length - 1;
    fasterBtn.classList.toggle('disabled', curIdx >= allowed.length - 1);
  }
  if (slowerBtn) {
    slowerBtn.disabled = curIdx <= 0;
    slowerBtn.classList.toggle('disabled', curIdx <= 0);
  }
}

// [UI.DC]
function setGameSpeed(speed) {
  if (typeof gameTimeScale !== 'undefined') {
    gameTimeScale = speed;
  }
  const selects = document.querySelectorAll('.dev-speed-floating, .dev-speed-select, #speedContainer, .dev-bar select');
  selects.forEach(s => {
    s.value = String(speed);
  });
  updateHudSpeedWidget();
}

// [UI.DD]
function stepHudSpeed(direction) {
  const allowed = devMode ? DEV_SPEED_STEPS : getHudAllowedSpeeds();
  if (allowed.length <= 1) return;

  const curSpeed = typeof gameTimeScale !== 'undefined' ? gameTimeScale : 1.0;
  let curIdx = allowed.indexOf(curSpeed);
  if (curIdx === -1) {
    curIdx = allowed.reduce((closest, val, idx) =>
      Math.abs(val - curSpeed) < Math.abs(allowed[closest] - curSpeed) ? idx : closest, 0);
  }

  const nextIdx = Math.max(0, Math.min(allowed.length - 1, curIdx + direction));
  const newSpeed = allowed[nextIdx];
  if (newSpeed !== curSpeed) {
    setGameSpeed(newSpeed);
    try { sfx('tap'); } catch (err) {}
  }
}

// [UI.DE]
function stepDevSpeed(direction) {
  const selects = document.querySelectorAll('.dev-speed-floating, .dev-speed-select, #speedContainer, .dev-bar select');
  if (!selects || selects.length === 0) return;

  const sel = selects[0];
  let curIndex = sel.selectedIndex;

  if (curIndex === -1 || isNaN(curIndex)) {
    const currentVal = parseFloat(sel.value) || (typeof gameTimeScale !== 'undefined' ? gameTimeScale : 1);
    curIndex = DEV_SPEED_STEPS.indexOf(currentVal);
    if (curIndex === -1) {
      curIndex = DEV_SPEED_STEPS.reduce((closest, val, idx) =>
        Math.abs(val - currentVal) < Math.abs(DEV_SPEED_STEPS[closest] - currentVal) ? idx : closest, 0);
    }
  }

  const nextIndex = Math.max(0, Math.min(DEV_SPEED_STEPS.length - 1, curIndex + direction));
  const newSpeed = DEV_SPEED_STEPS[nextIndex];

  selects.forEach(s => {
    s.selectedIndex = nextIndex;
    s.value = String(newSpeed);

    if (s.options && s.options[nextIndex]) {
      s.options[nextIndex].selected = true;
    }
  });

  setGameSpeed(newSpeed);
}

//  Interactive speed drum drag and scroll gesture controller.
// [UI.DF]
(function initHudSpeedDrumGesture() {
  let isDragging = false;
  let startY = 0;
  let startSpeedIndex = 0;
  let allowedSpeeds = [1.0];
  let tipShown = false;

  // [UI.DG]
  function dismissTip() {
    tipShown = true;
    const dragTip = document.getElementById('hudDragTip');
    if (dragTip) dragTip.classList.remove('show');
  }

  // [UI.DH]
  function showTipIfNeeded() {
    if (tipShown) return;
    const widget = document.getElementById('hudSpeedWidget');
    const dragTip = document.getElementById('hudDragTip');
    if (widget && !widget.classList.contains('hidden') && dragTip) {
      dragTip.classList.add('show');
    }
  }

  setTimeout(showTipIfNeeded, 1500);

  // [UI.DI]
  function onPointerDown(e) {
    dismissTip();
    const drumEl = document.getElementById('hudSpeedDrum');
    if (!drumEl || !drumEl.contains(e.target)) return;

    allowedSpeeds = devMode ? DEV_SPEED_STEPS : getHudAllowedSpeeds();
    if (allowedSpeeds.length <= 1) return;

    isDragging = true;
    startY = e.touches ? e.touches[0].clientY : e.clientY;
    const currentSpeed = typeof gameTimeScale !== 'undefined' ? gameTimeScale : 1.0;

    let idx = allowedSpeeds.indexOf(currentSpeed);
    if (idx === -1) {
      idx = allowedSpeeds.reduce((closest, val, i) =>
        Math.abs(val - currentSpeed) < Math.abs(allowedSpeeds[closest] - currentSpeed) ? i : closest, 0);
    }
    startSpeedIndex = idx;

    drumEl.classList.add('dragging');

    window.addEventListener('mousemove', onPointerMove, { passive: false });
    window.addEventListener('mouseup', onPointerUp);
    window.addEventListener('touchmove', onPointerMove, { passive: false });
    window.addEventListener('touchend', onPointerUp);
  }

  // [UI.DJ]
  function onPointerMove(e) {
    if (!isDragging) return;
    if (e.cancelable) e.preventDefault();

    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const dy = startY - clientY;

    const stepPx = 30;
    const stepDelta = Math.round(dy / stepPx);

    const targetIdx = Math.max(0, Math.min(allowedSpeeds.length - 1, startSpeedIndex + stepDelta));
    const newSpeed = allowedSpeeds[targetIdx];

    if (newSpeed !== gameTimeScale) {
      setGameSpeed(newSpeed);
      if (typeof vibrate === 'function') vibrate('light');
      else if (navigator.vibrate) { try { navigator.vibrate(15); } catch(err){} }
    }
  }

  // [UI.DK]
  function onPointerUp() {
    if (!isDragging) return;
    isDragging = false;

    const drumEl = document.getElementById('hudSpeedDrum');
    if (drumEl) drumEl.classList.remove('dragging');

    window.removeEventListener('mousemove', onPointerMove);
    window.removeEventListener('mouseup', onPointerUp);
    window.removeEventListener('touchmove', onPointerMove);
    window.removeEventListener('touchend', onPointerUp);
  }

  // [UI.DL]
  function onWheel(e) {
    dismissTip();
    const drumEl = document.getElementById('hudSpeedDrum');
    if (!drumEl || !drumEl.contains(e.target)) return;
    e.preventDefault();
    stepHudSpeed(e.deltaY < 0 ? 1 : -1);
  }

  // [UI.DM]
  function setupListeners() {
    const drumEl = document.getElementById('hudSpeedDrum');
    if (drumEl) {
      drumEl.addEventListener('mousedown', onPointerDown);
      drumEl.addEventListener('touchstart', onPointerDown, { passive: true });
      drumEl.addEventListener('wheel', onWheel, { passive: false });
    }
    const fasterBtn = document.getElementById('hudSpeedFasterBtn');
    const slowerBtn = document.getElementById('hudSpeedSlowerBtn');
    if (fasterBtn) fasterBtn.addEventListener('click', dismissTip);
    if (slowerBtn) slowerBtn.addEventListener('click', dismissTip);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupListeners);
  } else {
    setupListeners();
  }
})();

// [UI.DN]
function toggleLivePause() {
  isLivePaused = !isLivePaused;
  const btn = document.getElementById('livePauseBtn');
  if (btn) {
    if (isLivePaused) {
      btn.textContent = typeof t === 'function' ? t('resume') : 'RESUME GAME';
      btn.classList.add('paused');
    } else {
      btn.textContent = typeof t === 'function' ? t('paused_title') : 'PAUSE GAME';
      btn.classList.remove('paused');
    }
  }

  updateDailyBonusBtnVisibility();
}

// [UI.DO]
function updateStartChapterLabel(show, text) {
  const el = document.getElementById('startChapterLabel');
  if (el) el.classList.add('hidden');
}

// [UI.GR]
function isOverCancelZone(clientX, clientY) {
  if (clientX === undefined || clientY === undefined) return false;
  const wrapper = document.getElementById('controlsWrapper');
  if (!wrapper || wrapper.classList.contains('hidden')) return false;
  const rect = wrapper.getBoundingClientRect();
  return (
    clientX >= rect.left &&
    clientX <= rect.right &&
    clientY >= rect.top &&
    clientY <= rect.bottom
  );
}

// [UI.GS]
function showCancelZoneVisual(show) {
  const overlay = document.getElementById('cancelZoneOverlay');
  const buildPanel = document.getElementById('buildPanel');
  if (show) {
    if (overlay) overlay.classList.remove('hidden');
    if (buildPanel) buildPanel.classList.add('drag-hidden');
  } else {
    if (overlay) {
      overlay.classList.add('hidden');
      overlay.classList.remove('hovered');
    }
    if (buildPanel) buildPanel.classList.remove('drag-hidden');
  }
}

// [UI.GT]
function updateCancelZoneHover(clientX, clientY) {
  const overlay = document.getElementById('cancelZoneOverlay');
  if (!overlay || overlay.classList.contains('hidden')) return;
  if (isOverCancelZone(clientX, clientY)) {
    overlay.classList.add('hovered');
  } else {
    overlay.classList.remove('hovered');
  }
}

// [UI.GU]
canvas.addEventListener('touchstart', (e) => {
  if (gameState !== 'PLAYING') return;
  if (e.touches.length === 1 && !draggingTower) {
    isPanning = true;
    panStartTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    panStartCam = { x: camX, y: camY };
  } else if (e.touches.length === 2) {
    isPanning = false;
    const t1 = e.touches[0];
    const t2 = e.touches[1];
    initialPinchDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
    initialPinchZoom = camZoom;
    pinchCenterWorld = screenToWorld((t1.clientX + t2.clientX) / 2, (t1.clientY + t2.clientY) / 2);
  }
}, { passive: false });

// [UI.GV]
canvas.addEventListener('touchmove', (e) => {
  if (e.touches.length === 1 && isPanning) {
    const dx = e.touches[0].clientX - panStartTouch.x;
    const dy = e.touches[0].clientY - panStartTouch.y;
    if (camZoom > baseZoom * 1.01) {
      camX = panStartCam.x + dx;
      camY = panStartCam.y + dy;
      clampCamera();
    }
  } else if (e.touches.length === 2 && initialPinchDist) {
    const t1 = e.touches[0];
    const t2 = e.touches[1];
    const curDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
    camZoom = Math.min(maxZoom, Math.max(minZoom, initialPinchZoom * (curDist / initialPinchDist)));
    const centerScreen = { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 };
    camX = centerScreen.x - pinchCenterWorld.x * camZoom;
    camY = centerScreen.y - pinchCenterWorld.y * camZoom;
    clampCamera();
  }
}, { passive: false });

// [UI.GW]
canvas.addEventListener('touchend', (e) => {
  if (e.touches.length < 2) initialPinchDist = null;
  if (e.touches.length === 0) isPanning = false;
});

// [UI.GX]
window.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && (e.code === 'KeyR' || e.key === 'r' || e.key === 'R')) {
    if (gameState === 'PLAYING' || gameState === 'PAUSED' || gameState === 'VICTORY' || gameState === 'DEFEAT') {
      e.preventDefault();
      retryLevel();
      return;
    }
  }

  if (e.code === 'Space' && gameState === 'PLAYING') {
    mouseSpacePressed = true;
    e.preventDefault();
  }
});

// [UI.GY]
window.addEventListener('keyup', (e) => {
  if (e.code === 'Space') {
    mouseSpacePressed = false;
    isMousePanning = false;
  }
});

// [UI.GZ]
canvas.addEventListener('mousedown', (e) => {
  if (gameState !== 'PLAYING') return;
  if (e.button === 1 || (e.button === 0 && mouseSpacePressed)) {
    isMousePanning = true;
    panStartMouse = { x: e.clientX, y: e.clientY };
    panStartCam = { x: camX, y: camY };
    e.preventDefault();
  }
});

// [UI.HA]
canvas.addEventListener('mousemove', (e) => {
  if (!isMousePanning) return;
  const dx = e.clientX - panStartMouse.x;
  const dy = e.clientY - panStartMouse.y;
  camX = panStartCam.x + dx;
  camY = panStartCam.y + dy;
  clampCamera();
});

// [UI.HB]
canvas.addEventListener('mouseup', () => {
  isMousePanning = false;
});

// [UI.HC]
canvas.addEventListener('wheel', (e) => {
  if (gameState !== 'PLAYING') return;
  e.preventDefault();
  const mouseWorld = screenToWorld(e.clientX, e.clientY);
  const zoomSpeed = 0.15;
  camZoom = Math.min(maxZoom, Math.max(minZoom, camZoom * (1 - (e.deltaY > 0 ? zoomSpeed : -zoomSpeed))));
  camX = e.clientX - mouseWorld.x * camZoom;
  camY = e.clientY - mouseWorld.y * camZoom;
  clampCamera();
}, { passive: false });

let hintToastTimer = null;
// [UI.HD]
function showHintToast(message) {
  const el = document.getElementById('hintToast');
  if (!el) return;
  el.textContent = message;
  el.classList.add('visible');
  if (hintToastTimer) clearTimeout(hintToastTimer);
  // [UI.HE]
  hintToastTimer = setTimeout(() => { el.classList.remove('visible'); }, 2000);
}

//  Tower selection, build panel UI and inspection state controller.
// [UI.HF]
function initBuildPanel() {
    const panel = document.getElementById('buildPanel');
    if (!panel || typeof TOWER_CONFIGS === 'undefined') return;
    panel.querySelectorAll('.tower-btn').forEach(b => b.remove());

    // Очищаем кэш DOM и кэш классов кнопок, чтобы новые элементы гарантированно получили актуальные стили
    if (typeof _elCache !== 'undefined' && _elCache) {
        for (const k in TOWER_CONFIGS) {
            delete _elCache[`btn-${k}`];
        }
    }
    if (typeof _hudStateCache !== 'undefined' && _hudStateCache && _hudStateCache.towerClasses) {
        _hudStateCache.towerClasses = Object.create(null);
    }

    const canonicalOrder = Object.keys(TOWER_CONFIGS);
    const pool = getBuildPanelPool(currentLevel);
    const towerTypes = canonicalOrder.filter(t => pool.includes(t));

    towerTypes.forEach(type => {
        const conf = TOWER_CONFIGS[type];
        const isUnlocked = isTowerActiveThisLevel(type);
        const affordable = gold >= conf.cost;
        const initialCls = !isUnlocked
            ? 'tower-btn locked disabled'
            : (!affordable ? 'tower-btn disabled' : 'tower-btn ready');

        const btn = document.createElement('div');
        btn.className = initialCls;
        btn.id = `btn-${type}`;
        btn.setAttribute('data-type', type);

        if (typeof _hudStateCache !== 'undefined' && _hudStateCache && _hudStateCache.towerClasses) {
            _hudStateCache.towerClasses[type] = initialCls;
        }

        const reqLvl = getTowerUnlockLevel(type);
        const costRowHtml = isUnlocked
            ? `<span class="cost">
                <span class="cost-icon">
                    <svg width="12" height="12" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#ff9100" /><text x="12" y="17.5" font-size="16" font-weight="900" fill="#000000" text-anchor="middle" font-family="Montserrat, sans-serif">$</text></svg>
                </span>
                ${conf.cost}
               </span>`
            : `<span class="cost" style="color:#8ea3c4; gap:3px;">
                ${typeof CUSTOM_LOCK_SVG !== 'undefined' ? CUSTOM_LOCK_SVG : ''}
                <span>L${reqLvl}</span>
               </span>`;

        btn.innerHTML = `
            <span class="tower-btn-title">${TOWER_NAMES[type] || type}</span>
            <div class="tower-btn-icon">
                ${TOWER_ICONS[type] || ''}
            </div>
            ${costRowHtml}
        `;

        // [UI.HG]
        btn.addEventListener('mousedown', (e) => {
            if (gameState !== 'PLAYING') return;
            if (!isTowerActiveThisLevel(type)) {
                if (typeof sfx === 'function') sfx('denied');
                const unlockLvl = getTowerUnlockLevel(type);
                showHintToast(typeof t === 'function' ? (t('unlocks_on_level_n', { n: unlockLvl }) || t('available_on_level_n', { n: unlockLvl })) : `Unlocks on Level ${unlockLvl}`);
                return;
            }
            if (gold < TOWER_CONFIGS[type].cost || btn.classList.contains('disabled')) {
                if (typeof sfx === 'function') sfx('denied');
                if (typeof vibrate === 'function') vibrate('warning');
                showHintToast(typeof t === 'function' ? (t('not_enough_gold') || 'Not enough Gold!') : 'Not enough Gold!');
                return;
            }
            const worldPos = screenToWorld(e.clientX, e.clientY);
            draggingTower = { type: type, worldX: worldPos.x, worldY: worldPos.y, isTouch: false };
            showCancelZoneVisual(true);
        });

        // [UI.HH]
        btn.addEventListener('touchstart', (e) => {
            if (gameState !== 'PLAYING') return;
            if (!isTowerActiveThisLevel(type)) {
                if (typeof sfx === 'function') sfx('denied');
                const unlockLvl = getTowerUnlockLevel(type);
                showHintToast(typeof t === 'function' ? (t('unlocks_on_level_n', { n: unlockLvl }) || t('available_on_level_n', { n: unlockLvl })) : `Unlocks on Level ${unlockLvl}`);
                return;
            }
            if (gold < TOWER_CONFIGS[type].cost || btn.classList.contains('disabled')) {
                if (typeof sfx === 'function') sfx('denied');
                if (typeof vibrate === 'function') vibrate('warning');
                showHintToast(typeof t === 'function' ? (t('not_enough_gold') || 'Not enough Gold!') : 'Not enough Gold!');
                return;
            }
            const touch = e.touches[0];
            const worldPos = screenToWorld(touch.clientX, touch.clientY - TOUCH_OFFSET_Y);
            draggingTower = { type: type, worldX: worldPos.x, worldY: worldPos.y, isTouch: true };
            showCancelZoneVisual(true);
            e.preventDefault();
        }, { passive: false });

        panel.appendChild(btn);
    });
}

// [UI.HI]
window.addEventListener('mousemove', (e) => {
  if (!draggingTower) return;
  const worldPos = screenToWorld(e.clientX, e.clientY);
  draggingTower.worldX = worldPos.x;
  draggingTower.worldY = worldPos.y;
  updateCancelZoneHover(e.clientX, e.clientY);
});

// [UI.HJ]
window.addEventListener('touchmove', (e) => {
  if (!draggingTower || e.touches.length > 1) return;
  const touch = e.touches[0];
  const worldPos = screenToWorld(touch.clientX, touch.clientY - TOUCH_OFFSET_Y);
  draggingTower.worldX = worldPos.x;
  draggingTower.worldY = worldPos.y;
  updateCancelZoneHover(touch.clientX, touch.clientY);
}, { passive: false });

// [UI.HK]
window.addEventListener('mouseup', (e) => {
  if (draggingTower) handleDrop(draggingTower.worldX, draggingTower.worldY, e.clientX, e.clientY);
});

// [UI.HL]
window.addEventListener('touchend', (e) => {
  if (draggingTower) {
    let cx, cy;
    if (e.changedTouches && e.changedTouches.length > 0) {
      cx = e.changedTouches[0].clientX;
      cy = e.changedTouches[0].clientY;
    }
    handleDrop(draggingTower.worldX, draggingTower.worldY, cx, cy);
  }
});

// [UI.HM]
canvas.addEventListener('click', (e) => {
  if (gameState !== 'PLAYING' || isPanning) return;
  const worldPos = screenToWorld(e.clientX, e.clientY);
  const c = Math.floor(worldPos.x / TILE_SIZE);
  const r = Math.floor(worldPos.y / TILE_SIZE);
  const clickedTower = towers.find(t => t.c === c && t.r === r);

  if (tutorialActive && tutorialLevel === 2 && tutorialStep === 2 && selectedTower) {
    if (clickedTower && clickedTower === selectedTower) {
      if (typeof showHintToast === 'function') {
        showHintToast(typeof t === 'function' ? t('tut_close_hint') : 'Tap the empty field or ✕ to close');
      }
      return;
    }
  }

  if (clickedTower) {
    selectTower(clickedTower);
  } else {
    deselectTower();
  }
});

// [UI.HN]
function armSellConfirm() {
  sellConfirmArmed = true;
  if (sellConfirmTimer) clearTimeout(sellConfirmTimer);
  // [UI.HO]
  sellConfirmTimer = setTimeout(() => {
    sellConfirmArmed = false;
    sellConfirmTimer = null;
    updateInspectUI();
  }, 3000);
  updateInspectUI();
}

// [UI.HP]
function resetSellConfirm() {
  sellConfirmArmed = false;
  if (sellConfirmTimer) { clearTimeout(sellConfirmTimer); sellConfirmTimer = null; }
}

// [UI.HQ]
function selectTower(tower) {
  selectedTower = tower;
  resetSellConfirm();
  document.getElementById('buildPanel').classList.add('hidden');
  document.getElementById('inspectPanel').classList.remove('hidden');
  updateInspectUI();

  if (tutorialActive && tutorialLevel === 2 && tutorialStep === 0) {
    tutorialStep = 1;
  }
}

// [UI.HR]
function deselectTower() {
  selectedTower = null;
  resetSellConfirm();
  document.getElementById('inspectPanel').classList.add('hidden');
  document.getElementById('buildPanel').classList.remove('hidden');

  if (tutorialActive && tutorialLevel === 2 && tutorialStep === 1) {
    tutorialStep = 0;
  } else if (tutorialActive && tutorialLevel === 2 && tutorialStep === 2) {
    completeTutorial(2);
  }
}

// [UI.HS]
function updateInspectUI() {
  if (!selectedTower) return;
  const t = selectedTower;
  const lvlConfig = LEVELS_DATA[currentLevel];
  const isL1FirstTime = (currentLevel === 1 && !isEndlessMode && !isOverdriveMode && !hasClearedLevelBefore(1) && !devMode);
  const canUpgradeLevel = !(lvlConfig && lvlConfig.canUpgrade === false && isL1FirstTime);

  const _tr = (typeof window.t === 'function') ? window.t : ((k) => k.toUpperCase());
  const slowLabel = _tr('stat_slow') || 'SLOW:';
  const durLabel = _tr('stat_dur') || 'DUR:';
  const rngLabel = _tr('stat_rng') || 'RNG:';
  const dmgLabel = _tr('stat_dmg') || 'DMG:';
  const spdLabel = _tr('stat_spd') || 'SPD:';
  const dpsLabel = _tr('stat_dps') || 'DPS:';

  const maxTowerLvl = (typeof MAX_TOWER_LEVEL !== 'undefined') ? MAX_TOWER_LEVEL : 4;
  const curLvl = Math.max(1, Math.min(maxTowerLvl, t.level || 1));
  const iconBox = document.getElementById('inspectIconBox');
  if (iconBox) {
    iconBox.innerHTML = buildTowerIconSvg(t.type, curLvl, 38) || '';
  }

  const nameEl = document.getElementById('inspectName');
  if (nameEl) nameEl.textContent = TOWER_NAMES[t.type] || t.type;

  const lvlTextEl = document.getElementById('inspectLvlText');
  if (lvlTextEl) {
    const lvlPrefix = (typeof window.t === 'function' && window.t('lvl_short')) ? window.t('lvl_short') : 'LVL';
    lvlTextEl.textContent = (typeof window.t === 'function' && window.t('level_n_short', { n: curLvl }))
      ? window.t('level_n_short', { n: curLvl })
      : `${lvlPrefix} ${curLvl}`;
  }

  // 3 upgrade segments: 0/3 on Lv.1 (base), 1/3 on Lv.2, 2/3 on Lv.3, 3/3 on Lv.4 (MAX)
  const upgradesCount = Math.max(0, curLvl - 1);
  for (let barIdx = 1; barIdx <= 3; barIdx++) {
    const seg = document.getElementById(`lvlBar${barIdx}`);
    if (seg) {
      if (barIdx <= upgradesCount) {
        seg.classList.add('active');
        seg.style.background = t.color || '#00e5ff';
        seg.style.boxShadow = `0 0 5px ${t.color || '#00e5ff'}99`;
      } else {
        seg.classList.remove('active');
        seg.style.background = 'rgba(140, 200, 255, 0.2)';
        seg.style.boxShadow = 'none';
      }
    }
  }

  const statsBox = document.getElementById('inspectStatsBox');
  if (statsBox) {
    const curRng = Math.round(t.range);
    if (t.type === 'stasis') {
      const slowPct = Math.round((t.slowFactor !== undefined ? t.slowFactor : 0.3) * 100);
      const dur = ((t.slowDuration !== undefined ? t.slowDuration : 1.4)).toFixed(1);
      statsBox.innerHTML = `
        <div class="inspect-stat-item"><span class="inspect-stat-lbl">${slowLabel}</span><span class="inspect-stat-val">${slowPct}%</span></div>
        <div class="inspect-stat-item"><span class="inspect-stat-lbl">${durLabel}</span><span class="inspect-stat-val">${dur}s</span></div>
        <div class="inspect-stat-item"><span class="inspect-stat-lbl">${rngLabel}</span><span class="inspect-stat-val">${curRng}</span></div>
      `;
    } else if (t.fireRate) {
      const curDmg = +(t.damage || 0).toFixed(1);
      const curSpd = +(t.fireRate || 0).toFixed(2);
      statsBox.innerHTML = `
        <div class="inspect-stat-item"><span class="inspect-stat-lbl">${dmgLabel}</span><span class="inspect-stat-val">${curDmg}</span></div>
        <div class="inspect-stat-item"><span class="inspect-stat-lbl">${spdLabel}</span><span class="inspect-stat-val">${curSpd}s</span></div>
        <div class="inspect-stat-item"><span class="inspect-stat-lbl">${rngLabel}</span><span class="inspect-stat-val">${curRng}</span></div>
      `;
    } else {
      const curDmg = +(t.damage || 0).toFixed(1);
      statsBox.innerHTML = `
        <div class="inspect-stat-item"><span class="inspect-stat-lbl">${dpsLabel}</span><span class="inspect-stat-val">${curDmg}</span></div>
        <div class="inspect-stat-item"><span class="inspect-stat-lbl">${rngLabel}</span><span class="inspect-stat-val">${curRng}</span></div>
      `;
    }
  }

  const upgCost = (typeof getTowerUpgradeCost === 'function') ? getTowerUpgradeCost(t) : getUpgradeCost(t.type, curLvl);
  const upgBtn = document.getElementById('inspectUpgradeBtn');
  const upgCostWrapEl = document.getElementById('inspectUpgradeCost');
  const upgValEl = document.getElementById('inspectUpgradeCostVal');
  const upgIconEl = document.getElementById('inspectUpgradeCostIcon');
  const upgStatusEl = document.getElementById('inspectUpgradeStatus');
  const sellValTextEl = document.getElementById('inspectSellValText');
  const sellTitleEl = document.getElementById('inspectSellTitle');

  if (!canUpgradeLevel) {
    upgBtn.disabled = true;
    if (upgCostWrapEl) upgCostWrapEl.style.display = 'none';
    if (upgValEl) upgValEl.textContent = '';
    if (upgIconEl) upgIconEl.style.display = 'none';
    if (upgStatusEl) upgStatusEl.textContent = _tr('locked');
  } else if (curLvl >= maxTowerLvl) {
    upgBtn.disabled = true;
    if (upgCostWrapEl) upgCostWrapEl.style.display = 'none';
    if (upgValEl) upgValEl.textContent = '';
    if (upgIconEl) upgIconEl.style.display = 'none';
    if (upgStatusEl) upgStatusEl.textContent = _tr('max');
  } else {
    const canAfford = gold >= upgCost;
    upgBtn.disabled = !canAfford;
    if (upgCostWrapEl) upgCostWrapEl.style.display = 'flex';
    if (upgValEl) {
      upgValEl.textContent = `${upgCost}`;
      upgValEl.style.color = canAfford ? '#ffffff' : '#f05f9f';
    }
    if (upgIconEl) upgIconEl.style.display = 'inline-flex';
    if (upgStatusEl) upgStatusEl.textContent = _tr('upgrade');
  }

  const refund = Math.floor(t.totalInvested * 0.7);
  const sellBtn = document.getElementById('inspectSellBtn');
  const sellIconEl = sellBtn ? sellBtn.querySelector('.cost-icon') : null;
  if (sellConfirmArmed) {
    if (sellBtn) sellBtn.classList.add('confirm-armed');
    if (sellTitleEl) sellTitleEl.textContent = _tr('confirm_q');
    if (sellValTextEl) sellValTextEl.textContent = `+${refund}`;
    if (sellIconEl) sellIconEl.style.display = 'none';
  } else {
    if (sellBtn) sellBtn.classList.remove('confirm-armed');
    if (sellTitleEl) sellTitleEl.textContent = _tr('sell');
    if (sellValTextEl) sellValTextEl.textContent = `${refund}`;
    if (sellIconEl) sellIconEl.style.display = '';
  }
}
// [UI.HT]
function updateWaveCircle(dt) {
  const progEl = el('waveCircleProg');
  if (!progEl) return;
  const circumference = 207.35;
  let p = 0;
  let isCountdown = false;

  const lvlConfig = LEVELS_DATA[currentLevel];
  let totalDelay = 5.0;
  let baseBonus = 15;

  if (lvlConfig && lvlConfig.waves) {
    const currentWaveObj = lvlConfig.waves.find(w => w.wave === wave);
    if (currentWaveObj) {
      if (currentWaveObj.delayAfter !== undefined) {
        totalDelay = currentWaveObj.delayAfter;
      }
      if (currentWaveObj.earlyBonus !== undefined) {
        baseBonus = currentWaveObj.earlyBonus;
      }
    }
  }

  if (waveTimerActive && autoWaveTimeRemaining > 0) {
    p = totalDelay > 0 ? Math.max(0, Math.min(1, autoWaveTimeRemaining / totalDelay)) : 0;
    isCountdown = true;
  } else if (waveInProgress) {
    p = (spawnQueue.length === 0) ? 1.0 : Math.max(0, Math.min(1, waveSpawnElapsedTime / waveTotalSpawnTime));
  }

  if (p > 0.005) {
    progEl.style.opacity = '1';
    progEl.style.strokeDashoffset = (circumference * (1 - p)).toFixed(2);
  } else {
    progEl.style.opacity = '0';
    progEl.style.strokeDashoffset = circumference.toFixed(2);
  }
  progEl.classList.toggle('counting-down', isCountdown);
  // [UI.HTM]
  const isAccelerated = isCountdown && (typeof isWaveTimerAccelerated !== 'undefined' && isWaveTimerAccelerated);
  progEl.classList.toggle('accelerated', isAccelerated);
  const bonusElForAcc = el('waveGoBonus');
  if (bonusElForAcc) {
    bonusElForAcc.classList.toggle('accelerated', isAccelerated);
  }

  const bonusEl = el('waveGoBonus');
  const bonusValEl = el('waveGoBonusVal');
  if (!bonusEl || !bonusValEl) return;

  if (typeof isEndlessMode !== 'undefined' && isEndlessMode) {
    baseBonus = 15 + Math.floor(wave * 1.5);
  }

  const maxW = (lvlConfig && lvlConfig.totalWaves) || 10;
  let bonus = 0;
  if (isCountdown && ((typeof isEndlessMode !== 'undefined' && isEndlessMode) || wave < maxW)) {
    const moneyMultiplier = 1 + getBattleUpgradeEffectiveLevel('base_gold')* 0.05;
    const fractionSaved = totalDelay > 0 ? Math.min(1, Math.max(0, autoWaveTimeRemaining / totalDelay)) : 0;
    bonus = Math.round(fractionSaved * baseBonus * moneyMultiplier);
  }

  bonusValEl.textContent = bonus > 0 ? bonus : '0';
  bonusEl.classList.toggle('visible', bonus > 0);
}

//  Main UI frame update and HUD sync loop.
// Main UI frame update and HUD sync loop.
const _hudStateCache = {
  goldStr: '',
  hpStr: '',
  lvlStr: '',
  waveStr: '',
  waveBtnDisabled: null,
  towerClasses: Object.create(null)
};

// [UI.HU]
function updateUI() {
  const lvlConfig = LEVELS_DATA[currentLevel];
  const maxW = lvlConfig ? lvlConfig.totalWaves : 10;

  const goldStr = formatResourceVal(gold);
  if (_hudStateCache.goldStr !== goldStr) {
    _hudStateCache.goldStr = goldStr;
    const goldEl = el('goldVal');
    if (goldEl) goldEl.textContent = goldStr;
  }

  const hpStr = formatResourceVal(baseHp);
  if (_hudStateCache.hpStr !== hpStr) {
    _hudStateCache.hpStr = hpStr;
    const hpEl = el('hpVal');
    if (hpEl) hpEl.textContent = hpStr;
  }

  let lvlStr, waveStr;
  if (typeof isEndlessMode !== 'undefined' && isEndlessMode) {
    lvlStr = `${currentLevelSection || 1}`;
    waveStr = `${wave}/∞`;
  } else {
    lvlStr = `${currentLevel}`;
    waveStr = `${Math.min(wave, maxW)}/${maxW}`;
  }

  if (_hudStateCache.lvlStr !== lvlStr) {
    _hudStateCache.lvlStr = lvlStr;
    const lvlEl = el('levelText');
    if (lvlEl) lvlEl.textContent = lvlStr;
  }

  if (_hudStateCache.waveStr !== waveStr) {
    _hudStateCache.waveStr = waveStr;
    const waveEl = el('waveText');
    if (waveEl) waveEl.textContent = waveStr;
  }

  syncTopHudVisibility();

  for (let key in TOWER_CONFIGS) {
    const btn = el(`btn-${key}`);
    if (btn) {
      const isUnlocked = isTowerActiveThisLevel(key);
      const affordable = gold >= TOWER_CONFIGS[key].cost;
      const nextCls = !isUnlocked
        ? 'tower-btn locked disabled'
        : (!affordable ? 'tower-btn disabled' : 'tower-btn ready');
      if (_hudStateCache.towerClasses[key] !== nextCls) {
        _hudStateCache.towerClasses[key] = nextCls;
        btn.className = nextCls;
      }
    }
  }

  const waveBtn = el('waveBtn');
  if (waveBtn) {
    const isEndMode = (typeof isEndlessMode !== 'undefined' && isEndlessMode);
    const isFinalDone = !isEndMode && ((typeof finalWaveSpawned !== 'undefined' && finalWaveSpawned) || (wave >= maxW && !waveTimerActive));
    const shouldDisable = (waveInProgress || spawnQueue.length > 0 || isFinalDone);
    if (_hudStateCache.waveBtnDisabled !== shouldDisable) {
      _hudStateCache.waveBtnDisabled = shouldDisable;
      waveBtn.disabled = shouldDisable;
    }
  }

  updateHudSpeedWidget();

  if (selectedTower) updateInspectUI();
}

if (typeof window !== 'undefined') {
  initDevResourceHold();
}

// [UI.JT]
function toggleTacticalTips() {
  const body = document.getElementById('tacticalTipsBody');
  const arrow = document.getElementById('tacticalTipsArrow');
  const preview = document.getElementById('tacticalTipsPreview');
  if (!body) return;
  if (body.classList.contains('hidden')) {
    body.classList.remove('hidden');
    if (arrow) arrow.textContent = '▴';
    if (preview) preview.classList.add('hidden');
  } else {
    body.classList.add('hidden');
    if (arrow) arrow.textContent = '▾';
    if (preview) preview.classList.remove('hidden');
  }
}
window.toggleTacticalTips = toggleTacticalTips;

// Listener to intercept Back button on Android.
// [UI.JU]
document.addEventListener('DOMContentLoaded', () => {
  if (window.Capacitor && window.Capacitor.Plugins) {
    if (window.Capacitor.Plugins.StatusBar) {
      window.Capacitor.Plugins.StatusBar.hide().catch(err => console.warn('StatusBar error:', err));
    }

    const App = window.Capacitor.Plugins.App;
    if (App && typeof App.addListener === 'function') {
      // [UI.JV]
      App.addListener('backButton', () => {
        if (typeof handleHardwareBack === 'function') {
          handleHardwareBack();
        }
      });
    }
  }
});
