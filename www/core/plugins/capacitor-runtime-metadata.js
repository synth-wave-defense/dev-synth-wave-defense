// Capacitor Runtime Metadata & Diagnostics Bridge
// [CRM.A]

let devHoldTimer = null;
let devHoldTriggered = false;
let devHoldStartPos = { x: 0, y: 0 };

// [CRM.B]
function promptDevDiamonds() {
  if (!devMode) return;
  devInputOpen = true;
  const val = prompt("Set Diamonds:", diamonds);
  devInputOpen = false;
  suppressBackgroundPause();
  if (val !== null) {
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed) && parsed >= 0) {
      diamonds = parsed;
      updateDiamondUI();
      renderUpgradeTree();
      saveGameSoon();
    }
  }
}

// [CRM.C]
function promptDevPrisms() {
  if (!devMode) return;
  devInputOpen = true;
  const val = prompt("Set Prisms:", prisms);
  devInputOpen = false;
  suppressBackgroundPause();
  if (val !== null) {
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed) && parsed >= 0) {
      prisms = parsed;
      updatePrismUI();
      renderUpgradeTree();
      saveGameSoon();
    }
  }
}

// [CRM.D]
function promptDevGold() {
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

// [CRM.E]
function promptDevHp() {
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

// [CRM.F]
function devPromptLevelSelect() {
  if (!devMode) return;
  devInputOpen = true;
  const val = prompt(`Select Level (1 - ${TOTAL_LEVELS}):`, currentLevel);
  devInputOpen = false;
  suppressBackgroundPause();

  if (val !== null) {
    const lvl = parseInt(val, 10);
    if (!isNaN(lvl) && lvl >= 1 && lvl <= TOTAL_LEVELS) {
      startSpecificLevel(lvl);
    }
  }
}

// [CRM.G]
function devPromptWaveSelect() {
  if (!devMode) return;
  const lvlConfig = (typeof LEVELS_DATA !== 'undefined') ? LEVELS_DATA[currentLevel] : null;
  const maxW = isEndlessMode ? 999 : (lvlConfig ? lvlConfig.totalWaves : 10);

  devInputOpen = true;
  const val = prompt(`Select Wave (1 - ${maxW}):`, wave);
  devInputOpen = false;
  suppressBackgroundPause();

  if (val !== null) {
    const targetW = parseInt(val, 10);
    if (!isNaN(targetW) && targetW >= 1 && (isEndlessMode || targetW <= maxW)) {
      devJumpToWave(targetW);
    }
  }
}

// [CRM.H]
function initDevResourceHold() {
  const setupHold = (id, promptFn) => {
    const el = document.getElementById(id);
    if (!el || el.dataset.holdBound) return;
    el.dataset.holdBound = '1';

    el.addEventListener('pointerdown', (e) => {
      if (!devMode) return;
      devHoldTriggered = false;
      devHoldStartPos = { x: e.clientX, y: e.clientY };
      clearTimeout(devHoldTimer);
      devHoldTimer = setTimeout(() => {
        devHoldTriggered = true;
        if (typeof vibrate === 'function') vibrate('light');
        else if (navigator.vibrate) { try { navigator.vibrate(35); } catch (e) {} }
        promptFn();
      }, 500);
    });

    el.addEventListener('pointermove', (e) => {
      if (!devHoldTimer) return;
      if (Math.hypot(e.clientX - devHoldStartPos.x, e.clientY - devHoldStartPos.y) > 10) {
        clearTimeout(devHoldTimer);
        devHoldTimer = null;
      }
    });

    const cancel = () => {
      clearTimeout(devHoldTimer);
      devHoldTimer = null;
    };
    el.addEventListener('pointerup', cancel);
    el.addEventListener('pointercancel', cancel);
  };

  setupHold('hudDiamondBadge', promptDevDiamonds);
  setupHold('hudPrismBadge', promptDevPrisms);
  setupHold('goldHalf', promptDevGold);
  setupHold('hpHalf', promptDevHp);
}

// [CRM.I]
function handleDevDiamondClick() {
  if (!devMode) return;
  if (devHoldTriggered) {
    devHoldTriggered = false;
    return;
  }
  diamonds += 50;
  updateDiamondUI();
  renderUpgradeTree();
  saveGameSoon();
}

// [CRM.J]
function handleDevPrismClick() {
  if (!devMode) return;
  if (devHoldTriggered) {
    devHoldTriggered = false;
    return;
  }
  prisms += 10;
  updatePrismUI();
  renderUpgradeTree();
  saveGameSoon();
}

// [CRM.K]
function handleDevGoldClick() {
  if (!devMode) return;
  if (devHoldTriggered) {
    devHoldTriggered = false;
    return;
  }
  gold += 200;
  updateUI();
}

// [CRM.L]
function handleDevHpClick() {
  if (!devMode) return;
  if (devHoldTriggered) {
    devHoldTriggered = false;
    return;
  }
  baseHp = Math.min(99, baseHp + 5);
  updateUI();
}

// [CRM.M]
function devAddBpXp(amount) {
  if (!devMode) return;
  addBpXp(amount);
  renderBattlePassScreen();
  showHintToast(`+${amount} BP XP`);
}

// [CRM.N]
function devToggleBpPremium() {
  if (!devMode) return;
  bpPremiumPurchased = !bpPremiumPurchased;
  if (bpPremiumPurchased && !unlockedPalettes.includes('cyber_gold')) {
    unlockedPalettes.push('cyber_gold');
  }
  saveGame();
  renderBattlePassScreen();
  showHintToast(`Premium Pass: ${bpPremiumPurchased ? 'ON' : 'OFF'}`);
}

// [CRM.O]
function openRuntimeMetadataPanel() {
  isDevModeActive = true;
  devMode = true;
  window._maxThreadLag = 0;
  window._lastThreadLag = 0;
  if (typeof startThreadLagMonitor === 'function') startThreadLagMonitor();
  const bar = document.getElementById('devBar');
  if (bar) bar.classList.remove('hidden');

  const goldHalf = document.getElementById('goldHalf');
  const hpHalf = document.getElementById('hpHalf');
  if (goldHalf) goldHalf.classList.add('interactive');
  if (hpHalf) hpHalf.classList.add('interactive');
  initDevResourceHold();

  const levelEl = document.getElementById('levelText');
  const waveEl = document.getElementById('waveText');
  if (levelEl) {
    levelEl.style.cursor = 'pointer';
    levelEl.onclick = devPromptLevelSelect;
  }
  if (waveEl) {
    waveEl.style.cursor = 'pointer';
    waveEl.onclick = devPromptWaveSelect;
  }

  updateDiamondUI();
  updatePrismUI();
  updatePaletteSelectDropdown('settingPaletteSelect');
  updatePaletteSelectDropdown('bpPaletteSelect');
}

// [CRM.P]
export function mountRuntimeMetadata() {
  window.promptDevDiamonds = promptDevDiamonds;
  window.promptDevPrisms = promptDevPrisms;
  window.promptDevGold = promptDevGold;
  window.promptDevHp = promptDevHp;
  window.devPromptLevelSelect = devPromptLevelSelect;
  window.devPromptWaveSelect = devPromptWaveSelect;
  window.initDevResourceHold = initDevResourceHold;
  window.handleDevDiamondClick = handleDevDiamondClick;
  window.handleDevPrismClick = handleDevPrismClick;
  window.handleDevGoldClick = handleDevGoldClick;
  window.handleDevHpClick = handleDevHpClick;
  window.devAddBpXp = devAddBpXp;
  window.devToggleBpPremium = devToggleBpPremium;
  window.openDevMode = openRuntimeMetadataPanel;

  openRuntimeMetadataPanel();
}