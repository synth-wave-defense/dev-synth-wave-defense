// Synth Wave Defense -- dev/dev-panel.js
// Isolated External Developer Panel Module (Excluded from Production builds)

(function () {
  'use strict';

  let isDevExpanded = false;
  let telemetryIntervalId = null;
  let devHoldTimer = null;
  let devHoldTriggered = false;
  let devHoldStartPos = { x: 0, y: 0 };

  window.devSubExpanded = { Game: false, Audio: false, Version: false, Ads: false };
  window.devMetricExpanded = {
    AudioHw: false,
    AudioDsp: false,
    AudioMem: false,
    VerManifest: true,
    VerDownload: false,
    VerPlugin: false,
    VerLogs: false,
    AdStatus: true,
    AdLogs: false
  };

  // --- Чит-функции и редактирование ресурсов ---
  async function askDevValue(label, currentVal) {
    if (typeof window.showDevInputModal === 'function') {
      return await window.showDevInputModal(label, currentVal, false);
    }
    return prompt(label, currentVal);
  }

  window.promptDevDiamonds = async function () {
    if (!devMode) return;
    const val = await askDevValue('Set Diamonds:', diamonds);
    if (val !== null) {
      const parsed = parseInt(val, 10);
      if (!isNaN(parsed) && parsed >= 0) {
        diamonds = parsed;
        if (typeof updateDiamondUI === 'function') updateDiamondUI();
        if (typeof renderUpgradeTree === 'function') renderUpgradeTree();
        if (typeof saveGameSoon === 'function') saveGameSoon();
      }
    }
  };

  window.promptDevPrisms = async function () {
    if (!devMode) return;
    const val = await askDevValue('Set Prisms:', prisms);
    if (val !== null) {
      const parsed = parseInt(val, 10);
      if (!isNaN(parsed) && parsed >= 0) {
        prisms = parsed;
        if (typeof updatePrismUI === 'function') updatePrismUI();
        if (typeof renderUpgradeTree === 'function') renderUpgradeTree();
        if (typeof saveGameSoon === 'function') saveGameSoon();
      }
    }
  };

  window.promptDevGold = async function () {
    if (!devMode) return;
    const val = await askDevValue('Set Gold:', gold);
    if (val !== null) {
      const parsed = parseInt(val, 10);
      if (!isNaN(parsed) && parsed >= 0) {
        gold = parsed;
        if (typeof updateUI === 'function') updateUI();
      }
    }
  };

  window.promptDevHp = async function () {
    if (!devMode) return;
    const val = await askDevValue('Set Lives (HP):', baseHp);
    if (val !== null) {
      const parsed = parseInt(val, 10);
      if (!isNaN(parsed) && parsed > 0) {
        baseHp = parsed;
        if (typeof updateUI === 'function') updateUI();
      }
    }
  };

  window.devPromptLevelSelect = async function () {
    if (!devMode) return;
    const val = await askDevValue(`Select Level (1 - ${TOTAL_LEVELS}):`, currentLevel);
    if (val !== null) {
      const lvl = parseInt(val, 10);
      if (!isNaN(lvl) && lvl >= 1 && lvl <= TOTAL_LEVELS && typeof startSpecificLevel === 'function') {
        startSpecificLevel(lvl);
      }
    }
  };

  window.devPromptWaveSelect = async function () {
    if (!devMode) return;
    const lvlConfig = (typeof LEVELS_DATA !== 'undefined') ? LEVELS_DATA[currentLevel] : null;
    const maxW = isEndlessMode ? 999 : (lvlConfig ? lvlConfig.totalWaves : 10);
    const val = await askDevValue(`Select Wave (1 - ${maxW}):`, wave);
    if (val !== null) {
      const targetW = parseInt(val, 10);
      if (!isNaN(targetW) && targetW >= 1 && (isEndlessMode || targetW <= maxW) && typeof devJumpToWave === 'function') {
        devJumpToWave(targetW);
      }
    }
  };

  window.handleDevDiamondClick = function () {
    if (!devMode) return;
    if (devHoldTriggered) { devHoldTriggered = false; return; }
    diamonds += 50;
    if (typeof updateDiamondUI === 'function') updateDiamondUI();
    if (typeof renderUpgradeTree === 'function') renderUpgradeTree();
    if (typeof saveGameSoon === 'function') saveGameSoon();
  };

  window.handleDevPrismClick = function () {
    if (!devMode) return;
    if (devHoldTriggered) { devHoldTriggered = false; return; }
    prisms += 10;
    if (typeof updatePrismUI === 'function') updatePrismUI();
    if (typeof renderUpgradeTree === 'function') renderUpgradeTree();
    if (typeof saveGameSoon === 'function') saveGameSoon();
  };

  window.handleDevGoldClick = function () {
    if (!devMode) return;
    if (devHoldTriggered) { devHoldTriggered = false; return; }
    gold += 200;
    if (typeof updateUI === 'function') updateUI();
  };

  window.handleDevHpClick = function () {
    if (!devMode) return;
    if (devHoldTriggered) { devHoldTriggered = false; return; }
    baseHp = Math.min(99, baseHp + 5);
    if (typeof updateUI === 'function') updateUI();
  };

  window.devAddBpXp = function (amount) {
    if (!devMode) return;
    if (typeof addBpXp === 'function') addBpXp(amount);
    if (typeof renderBattlePassScreen === 'function') renderBattlePassScreen();
    if (typeof showHintToast === 'function') showHintToast(`+${amount} BP XP`);
  };

  window.devToggleBpPremium = function () {
    if (!devMode) return;
    bpPremiumPurchased = !bpPremiumPurchased;
    if (bpPremiumPurchased && Array.isArray(unlockedPalettes) && !unlockedPalettes.includes('cyber_gold')) {
      unlockedPalettes.push('cyber_gold');
    }
    if (typeof saveGame === 'function') saveGame();
    if (typeof renderBattlePassScreen === 'function') renderBattlePassScreen();
    if (typeof showHintToast === 'function') showHintToast(`Premium Pass: ${bpPremiumPurchased ? 'ON' : 'OFF'}`);
  };

  function bindDevResourceHold() {
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

    setupHold('hudDiamondBadge', window.promptDevDiamonds);
    setupHold('hudPrismBadge', window.promptDevPrisms);
    setupHold('goldHalf', window.promptDevGold);
    setupHold('hpHalf', window.promptDevHp);
  }

  // --- DOM дев-бара и перетаскивание ---
  function ensureDevBarDom() {
    if (document.getElementById('devBar')) return;

    const devBarHtml = `
      <div class="dev-bar hidden" id="devBar" style="width: 210px; max-width: 92vw; box-sizing: border-box;">
        <div class="dev-bar-top" style="display:flex; align-items:center; justify-content:space-between; gap:3px;">
          <div class="dev-fps-badge" id="devFpsBadge" style="font-size:11px; min-width:48px;">FPS: 60</div>
          <button type="button" class="dev-icon-btn dev-speed-step-btn" onclick="stepDevSpeed(-1)" title="Decrease speed">−</button>
          <select id="speedContainer" class="dev-speed-select" onchange="setGameSpeed(parseFloat(this.value))">
            <option value="0.5">0.5x</option>
            <option value="0.75">0.75x</option>
            <option value="0.9">0.9x</option>
            <option value="1" selected>1x</option>
            <option value="1.25">1.25x</option>
            <option value="1.5">1.5x</option>
            <option value="2">2x</option>
            <option value="4">4x</option>
            <option value="8">8x</option>
          </select>
          <button type="button" class="dev-icon-btn dev-speed-step-btn" onclick="stepDevSpeed(1)" title="Increase speed">+</button>
          <button type="button" class="dev-icon-btn" id="devExpandBtn" onclick="toggleDevPanelExpand()" title="Details">▾</button>
          <button type="button" class="dev-icon-btn dev-close-btn" onclick="closeDevMode()" title="Close Dev Mode">✕</button>
        </div>

        <div class="dev-details-pane hidden" id="devDetailsPane" style="width:100%; box-sizing:border-box; overflow:hidden;">
          <!-- GAME -->
          <div class="dev-spawner-sub" style="margin-top:4px;">
            <div class="dev-sub-title" onclick="toggleDevSubSection('Game')" style="cursor:pointer; display:flex; justify-content:space-between; align-items:center; user-select:none; padding:3px 2px;">
              <span>▸ GAME</span><span id="devSubArrowGame">▾</span>
            </div>
            <div id="devSubBodyGame" class="hidden" style="margin-top:4px;">
              <div class="dev-actions-row" style="display:flex; flex-direction:column; gap:4px;">
                <button type="button" class="dev-btn" id="livePauseBtn" onclick="toggleLivePause()" style="width:100%; font-size:10px; padding:4px;">PAUSE GAME</button>
                <button type="button" class="dev-btn dev-danger-btn" id="devClearSaveBtn" onclick="handleClearSaveClick()" style="width:100%; font-size:10px; padding:4px;">CLEAR SAVE</button>
              </div>
              <div class="dev-spawner-sub" id="devCustomSpawner" style="margin-top:6px;">
                <div class="dev-sub-title" style="font-size:9px;">SPAWNER</div>
                <div style="display:flex; flex-direction:column; gap:4px; margin-top:3px;">
                  <select id="devSpawnType" style="width:100%; font-size:11px; box-sizing:border-box;">
                    <option value="grunt">Grunt</option>
                    <option value="scout">Scout</option>
                    <option value="tank">Tank</option>
                    <option value="swarm">Swarm</option>
                    <option value="blinker">Blinker</option>
                    <option value="goliath">Goliath</option>
                    <option value="emp_bomber">EMP Bomber</option>
                    <option value="hive_empress">Boss: Hive</option>
                    <option value="chronos_warp">Boss: Chronos</option>
                    <option value="titan_core">Boss: Titan</option>
                    <option value="emp_overlord">Boss: Overlord</option>
                  </select>
                  <div style="display:flex; gap:4px;">
                    <input type="number" id="devSpawnCount" min="1" max="50" value="5" title="Count" style="width:55px; font-size:11px; box-sizing:border-box;">
                    <input type="hidden" id="devSpawnInterval" value="0.5">
                    <button type="button" class="dev-btn" onclick="devSpawnCustomEnemies()" style="flex:1; font-size:10px; padding:4px;">SPAWN</button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- AUDIO -->
          <div class="dev-spawner-sub" style="margin-top:4px;">
            <div class="dev-sub-title" onclick="toggleDevSubSection('Audio')" style="cursor:pointer; display:flex; justify-content:space-between; align-items:center; user-select:none; padding:3px 2px;">
              <span>▸ AUDIO</span><span id="devSubArrowAudio">▾</span>
            </div>
            <div id="devSubBodyAudio" class="hidden" style="margin-top:4px; display:flex; flex-direction:column; gap:3px;">
              <div style="font-size:10px; color:#8ef3ff; word-break:break-all; padding:2px 0;">
                <b>Track:</b> <span id="devTrackTitle" style="color:#fff;">None</span>
              </div>
              <div style="border-top:1px solid rgba(0,229,255,0.15); padding-top:3px;">
                <div onclick="toggleDevMetricGroup('AudioHw')" style="cursor:pointer; display:flex; justify-content:space-between; font-size:10px; color:#94a3b8; user-select:none;">
                  <span>• Hardware</span><span id="devMetricArrowAudioHw">▾</span>
                </div>
                <pre id="devAudioLogHw" class="dev-audio-log hidden" style="font-size:10px; line-height:1.35; margin:3px 0 0 0; white-space:pre-wrap; overflow-wrap:anywhere;"></pre>
              </div>
              <div style="border-top:1px solid rgba(0,229,255,0.15); padding-top:3px;">
                <div onclick="toggleDevMetricGroup('AudioDsp')" style="cursor:pointer; display:flex; justify-content:space-between; font-size:10px; color:#94a3b8; user-select:none;">
                  <span>• DSP & Nodes</span><span id="devMetricArrowAudioDsp">▾</span>
                </div>
                <pre id="devAudioLogDsp" class="dev-audio-log hidden" style="font-size:10px; line-height:1.35; margin:3px 0 0 0; white-space:pre-wrap; overflow-wrap:anywhere;"></pre>
              </div>
              <div style="border-top:1px solid rgba(0,229,255,0.15); padding-top:3px;">
                <div onclick="toggleDevMetricGroup('AudioMem')" style="cursor:pointer; display:flex; justify-content:space-between; font-size:10px; color:#94a3b8; user-select:none;">
                  <span>• Thread & RAM</span><span id="devMetricArrowAudioMem">▾</span>
                </div>
                <pre id="devAudioLogMem" class="dev-audio-log hidden" style="font-size:10px; line-height:1.35; margin:3px 0 0 0; white-space:pre-wrap; overflow-wrap:anywhere;"></pre>
              </div>
            </div>
          </div>

          <!-- VERSION & OTA -->
          <div class="dev-spawner-sub" style="margin-top:4px;">
            <div class="dev-sub-title" onclick="toggleDevSubSection('Version')" style="cursor:pointer; display:flex; justify-content:space-between; align-items:center; user-select:none; padding:3px 2px;">
              <span>▸ VERSION</span><span id="devSubArrowVersion">▾</span>
            </div>
            <div id="devSubBodyVersion" class="hidden" style="margin-top:4px; display:flex; flex-direction:column; gap:3px;">
              <div style="border-top:1px solid rgba(0,229,255,0.15); padding-top:3px;">
                <div onclick="toggleDevMetricGroup('VerManifest')" style="cursor:pointer; display:flex; justify-content:space-between; font-size:10px; color:#8ef3ff; user-select:none;">
                  <span>• Manifest & Ver</span><span id="devMetricArrowVerManifest">▴</span>
                </div>
                <pre id="devVerLogManifest" class="dev-audio-log" style="font-size:10px; line-height:1.35; margin:3px 0 0 0; white-space:pre-wrap; overflow-wrap:anywhere;">Init...</pre>
              </div>
              <div style="border-top:1px solid rgba(0,229,255,0.15); padding-top:3px;">
                <div onclick="toggleDevMetricGroup('VerDownload')" style="cursor:pointer; display:flex; justify-content:space-between; font-size:10px; color:#94a3b8; user-select:none;">
                  <span>• Download & Next</span><span id="devMetricArrowVerDownload">▾</span>
                </div>
                <pre id="devVerLogDownload" class="dev-audio-log hidden" style="font-size:10px; line-height:1.35; margin:3px 0 0 0; white-space:pre-wrap; overflow-wrap:anywhere;"></pre>
              </div>
              <div style="border-top:1px solid rgba(0,229,255,0.15); padding-top:3px;">
                <div onclick="toggleDevMetricGroup('VerPlugin')" style="cursor:pointer; display:flex; justify-content:space-between; font-size:10px; color:#94a3b8; user-select:none;">
                  <span>• Plugin & Storage</span><span id="devMetricArrowVerPlugin">▾</span>
                </div>
                <pre id="devVerLogPlugin" class="dev-audio-log hidden" style="font-size:10px; line-height:1.35; margin:3px 0 0 0; white-space:pre-wrap; overflow-wrap:anywhere;"></pre>
              </div>
              <div style="border-top:1px solid rgba(0,229,255,0.15); padding-top:3px;">
                <div onclick="toggleDevMetricGroup('VerLogs')" style="cursor:pointer; display:flex; justify-content:space-between; font-size:10px; color:#94a3b8; user-select:none;">
                  <span>• Step Logs</span><span id="devMetricArrowVerLogs">▾</span>
                </div>
                <pre id="devVerLogHistory" class="dev-audio-log hidden" style="font-size:9px; line-height:1.3; margin:3px 0 0 0; max-height:95px; overflow-y:auto; white-space:pre-wrap; overflow-wrap:anywhere;"></pre>
              </div>
              <div class="dev-actions-row" style="display:flex; gap:4px; margin-top:4px;">
                <button type="button" class="dev-btn" onclick="window.ResourceSync && window.ResourceSync.init()" style="flex:1; font-size:9px; padding:4px 2px;">CHECK</button>
                <button type="button" class="dev-btn" onclick="window.ResourceSync && window.ResourceSync.forceApplyNow()" style="flex:1; font-size:9px; padding:4px 2px;">APPLY NOW</button>
              </div>
            </div>
          </div>

          <!-- ADS -->
          <div class="dev-spawner-sub" style="margin-top:4px;">
            <div class="dev-sub-title" onclick="toggleDevSubSection('Ads')" style="cursor:pointer; display:flex; justify-content:space-between; align-items:center; user-select:none; padding:3px 2px;">
              <span>▸ ADS</span><span id="devSubArrowAds">▾</span>
            </div>
            <div id="devSubBodyAds" class="hidden" style="margin-top:4px; display:flex; flex-direction:column; gap:3px;">
              <div style="border-top:1px solid rgba(0,229,255,0.15); padding-top:3px;">
                <div onclick="toggleDevMetricGroup('AdStatus')" style="cursor:pointer; display:flex; justify-content:space-between; font-size:10px; color:#8ef3ff; user-select:none;">
                  <span>• Plugin & Status</span><span id="devMetricArrowAdStatus">▴</span>
                </div>
                <pre id="devAdLogStatus" class="dev-audio-log" style="font-size:10px; line-height:1.35; margin:3px 0 0 0; white-space:pre-wrap; overflow-wrap:anywhere;">Init...</pre>
              </div>
              <div style="border-top:1px solid rgba(0,229,255,0.15); padding-top:3px;">
                <div onclick="toggleDevMetricGroup('AdLogs')" style="cursor:pointer; display:flex; justify-content:space-between; font-size:10px; color:#94a3b8; user-select:none;">
                  <span>• Events & Errors</span><span id="devMetricArrowAdLogs">▾</span>
                </div>
                <pre id="devAdLogHistory" class="dev-audio-log hidden" style="font-size:9px; line-height:1.3; margin:3px 0 0 0; max-height:85px; overflow-y:auto; white-space:pre-wrap; overflow-wrap:anywhere;">No events yet</pre>
              </div>
              <div class="dev-actions-row" style="display:flex; gap:4px; margin-top:4px;">
                <button type="button" class="dev-btn" onclick="devPreloadRewardAd()" style="flex:1; font-size:9px; padding:4px 2px;">PRELOAD</button>
                <button type="button" class="dev-btn" onclick="devShowRewardAd()" style="flex:1; font-size:9px; padding:4px 2px;">SHOW AD</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    const wrapper = document.createElement('div');
    wrapper.innerHTML = devBarHtml.trim();
    const barEl = wrapper.firstElementChild;
    document.body.appendChild(barEl);

    // Защита полей ввода от триггера фоновой паузы
    ['devSpawnCount', 'devSpawnType', 'speedContainer'].forEach(id => {
      const inputEl = document.getElementById(id);
      if (inputEl && !inputEl.dataset.devFocusGuard) {
        inputEl.dataset.devFocusGuard = '1';
        inputEl.addEventListener('focus', () => {
          devInputOpen = true;
          if (typeof suppressBackgroundPause === 'function') suppressBackgroundPause(15000);
        });
        inputEl.addEventListener('blur', () => {
          setTimeout(() => {
            devInputOpen = false;
            if (typeof suppressBackgroundPause === 'function') suppressBackgroundPause(1000);
          }, 250);
        });
      }
    });

    // Перетаскивание панели
    let isDragging = false, startX = 0, startY = 0, initialLeft = 0, initialTop = 0;
    const onPointerMove = (e) => {
      if (!isDragging) return;
      if (e.cancelable) e.preventDefault();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const nextX = Math.max(0, Math.min(window.innerWidth - barEl.offsetWidth, initialLeft + (clientX - startX)));
      const nextY = Math.max(0, Math.min(window.innerHeight - barEl.offsetHeight, initialTop + (clientY - startY)));
      barEl.style.left = `${nextX}px`;
      barEl.style.top = `${nextY}px`;
    };
    const onPointerUp = () => {
      isDragging = false;
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('mouseup', onPointerUp);
      window.removeEventListener('touchmove', onPointerMove);
      window.removeEventListener('touchend', onPointerUp);
    };
    const onPointerDown = (e) => {
      if (['BUTTON', 'SELECT', 'INPUT', 'OPTION'].includes(e.target.tagName)) return;
      isDragging = true;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const rect = barEl.getBoundingClientRect();
      barEl.style.transform = 'none';
      barEl.style.left = `${rect.left}px`;
      barEl.style.top = `${rect.top}px`;
      startX = clientX;
      startY = clientY;
      initialLeft = rect.left;
      initialTop = rect.top;
      window.addEventListener('mousemove', onPointerMove, { passive: false });
      window.addEventListener('mouseup', onPointerUp);
      window.addEventListener('touchmove', onPointerMove, { passive: false });
      window.addEventListener('touchend', onPointerUp);
    };
    barEl.addEventListener('mousedown', onPointerDown);
    barEl.addEventListener('touchstart', onPointerDown, { passive: true });
  }

  function startDevTelemetryLoop() {
    if (telemetryIntervalId !== null) return;
    let lastSampleTime = performance.now();
    let frameCounter = 0;
    let rafId = null;

    const countFrame = () => {
      if (!devMode) return;
      frameCounter++;
      rafId = requestAnimationFrame(countFrame);
    };
    rafId = requestAnimationFrame(countFrame);

    telemetryIntervalId = setInterval(() => {
      if (!devMode) {
        clearInterval(telemetryIntervalId);
        telemetryIntervalId = null;
        if (rafId) cancelAnimationFrame(rafId);
        return;
      }
      const now = performance.now();
      const elapsed = now - lastSampleTime;
      const fps = elapsed > 0 ? Math.round((frameCounter * 1000) / elapsed) : 60;
      frameCounter = 0;
      lastSampleTime = now;

      const badge = document.getElementById('devFpsBadge');
      if (badge) {
        badge.textContent = `FPS: ${fps}`;
        badge.style.color = fps >= 50 ? '#39ff14' : (fps >= 30 ? '#ffb703' : '#f05f9f');
      }

      if (!isDevExpanded) return;

      const trackEl = document.getElementById('devTrackTitle');
      if (trackEl && typeof MusicManager !== 'undefined' && MusicManager.currentTrack) {
        trackEl.textContent = MusicManager.currentTrack();
      }

      if (typeof SFX !== 'undefined' && typeof SFX.getAudioMetrics === 'function') {
        const m = SFX.getAudioMetrics();
        const hwEl = document.getElementById('devAudioLogHw');
        if (hwEl) {
          hwEl.textContent =
            `State : ${m.state || window._audioCtxState || 'closed'}\n` +
            `Stalls : ${window._audioCtxStateStalls || 0}\n` +
            `Rate : ${(m.sampleRate || 0)} Hz\n` +
            `Latency : ${(m.baseLatency ? m.baseLatency.toFixed(3) : '0.000')}s`;
        }
        const dspEl = document.getElementById('devAudioLogDsp');
        if (dspEl) {
          dspEl.textContent =
            `Peak Vol: ${m.peakVolume !== undefined ? m.peakVolume.toFixed(3) : '0.000'}\n` +
            `DC Offs : ${m.dcOffset !== undefined ? m.dcOffset.toFixed(4) : '0.0000'}\n` +
            `Nodes : ${window._activeMusicNodeCount || 0}`;
        }
        const memEl = document.getElementById('devAudioLogMem');
        if (memEl) {
          const heapMB = typeof getJSHeapSizeMB === 'function' ? getJSHeapSizeMB() : null;
          memEl.textContent =
            `Max Lag : ${window._maxThreadLag || 0} ms\n` +
            `Last Lag: ${window._lastThreadLag || 0} ms\n` +
            `JS Heap : ${heapMB !== null ? heapMB.toFixed(1) + ' MB' : 'N/A'}`;
        }
      }

      if (window.SyncTelemetry) {
        const d = window.SyncTelemetry;
        const verManifestEl = document.getElementById('devVerLogManifest');
        if (verManifestEl) {
          verManifestEl.textContent =
            `Step : ${d.step}\n` +
            `Our Ver: ${d.localVersion}\n` +
            `Fetch : ${d.remoteFetchStatus}\n` +
            `Rem Ver: ${d.remoteVersion}\n` +
            `Sync? : ${d.syncNeeded}`;
        }
        const verDlEl = document.getElementById('devVerLogDownload');
        if (verDlEl) {
          verDlEl.textContent =
            `T1 Fetch: ${d.triageT1Fetch || '—'}\n` +
            `T2 FS DL: ${d.triageT2FsDl || '—'}\n` +
            `T3 Sync : ${d.triageT3LocalSync || '—'}\n` +
            `T4 Boot : ${d.triageT4DirectSync || '—'}\n` +
            `Next : ${d.nextQueueStatus}\n` +
            `Error : ${d.lastError}`;
        }
        const verPluginEl = document.getElementById('devVerLogPlugin');
        if (verPluginEl) {
          verPluginEl.textContent =
            `Plugin : ${d.pluginAvailable ? 'YES' : 'NO'} (${d.notifyReadyStatus})\n` +
            `Net : ${d.networkConnected}\n` +
            `Active : ${d.activeBundleInfo}\n` +
            `Stored : ${d.downloadedBundlesList}\n` +
            `Zip URL: ${d.bundleUrl}`;
        }
        const verLogsEl = document.getElementById('devVerLogHistory');
        if (verLogsEl) {
          verLogsEl.textContent = d.logs.length ? d.logs.join('\n') : 'No logs yet';
        }
      }

      if (window.AdDiagnostics) {
        const a = window.AdDiagnostics;
        const adStatusEl = document.getElementById('devAdLogStatus');
        if (adStatusEl) {
          adStatusEl.textContent =
            `Native : ${a.isNative ? 'YES' : 'NO'}\n` +
            `Plugin : ${a.pluginAvailable ? 'AVAILABLE' : 'NOT FOUND'}\n` +
            `Init : ${a.initialized ? 'OK' : 'NO'}\n` +
            `Ready : ${a.videoReady ? 'YES' : 'NO'}\n` +
            `LastEv : ${a.lastEvent}\n` +
            `Error : ${a.lastError}`;
        }
        const adLogsEl = document.getElementById('devAdLogHistory');
        if (adLogsEl) {
          adLogsEl.textContent = a.logs.length ? a.logs.join('\n') : 'No events yet';
        }
      }
    }, 500);
  }

  window.openDevMode = function () {
    ensureDevBarDom();
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
    bindDevResourceHold();

    const levelEl = document.getElementById('levelText');
    const waveEl = document.getElementById('waveText');
    if (levelEl) {
      levelEl.style.cursor = 'pointer';
      levelEl.onclick = window.devPromptLevelSelect;
    }
    if (waveEl) {
      waveEl.style.cursor = 'pointer';
      waveEl.onclick = window.devPromptWaveSelect;
    }

    if (typeof updateDiamondUI === 'function') updateDiamondUI();
    if (typeof updatePrismUI === 'function') updatePrismUI();
    if (typeof updatePaletteSelectDropdown === 'function') {
      updatePaletteSelectDropdown('settingPaletteSelect');
      updatePaletteSelectDropdown('bpPaletteSelect');
    }

    startDevTelemetryLoop();
  };

  window.closeDevMode = function () {
    isDevModeActive = false;
    devMode = false;
    isDevExpanded = false;
    if (typeof stopThreadLagMonitor === 'function') stopThreadLagMonitor();

    const bar = document.getElementById('devBar');
    if (bar) {
      bar.classList.add('hidden');
      bar.style.left = '';
      bar.style.top = '';
      bar.style.transform = '';
    }
    const pane = document.getElementById('devDetailsPane');
    if (pane) pane.classList.add('hidden');
    const btn = document.getElementById('devExpandBtn');
    if (btn) btn.textContent = '▾';

    const goldHalf = document.getElementById('goldHalf');
    const hpHalf = document.getElementById('hpHalf');
    if (goldHalf) goldHalf.classList.remove('interactive');
    if (hpHalf) hpHalf.classList.remove('interactive');

    const levelEl = document.getElementById('levelText');
    const waveEl = document.getElementById('waveText');
    if (levelEl) { levelEl.style.cursor = ''; levelEl.onclick = null; }
    if (waveEl) { waveEl.style.cursor = ''; waveEl.onclick = null; }
    if (typeof setGameSpeed === 'function') setGameSpeed(1);

    window.devSubExpanded = { Game: false, Audio: false, Version: false, Ads: false };
    ['Game', 'Audio', 'Version', 'Ads'].forEach(k => {
      const b = document.getElementById('devSubBody' + k);
      const a = document.getElementById('devSubArrow' + k);
      if (b) b.classList.add('hidden');
      if (a) a.textContent = '▾';
    });

    if (typeof updateDiamondUI === 'function') updateDiamondUI();
    if (typeof updatePrismUI === 'function') updatePrismUI();
  };

  window.toggleDevPanelExpand = function () {
    isDevExpanded = !isDevExpanded;
    const pane = document.getElementById('devDetailsPane');
    const btn = document.getElementById('devExpandBtn');
    if (pane) pane.classList.toggle('hidden', !isDevExpanded);
    if (btn) btn.textContent = isDevExpanded ? '▴' : '▾';
  };

  window.toggleDevSubSection = function (name) {
    const willOpen = !window.devSubExpanded[name];
    ['Game', 'Audio', 'Version', 'Ads'].forEach(key => {
      const isNowOpen = (key === name) ? willOpen : false;
      window.devSubExpanded[key] = isNowOpen;
      const body = document.getElementById('devSubBody' + key);
      const arrow = document.getElementById('devSubArrow' + key);
      if (body) body.classList.toggle('hidden', !isNowOpen);
      if (arrow) arrow.textContent = isNowOpen ? '▴' : '▾';
    });
    if (name === 'Game' && willOpen) {
      const customSpawner = document.getElementById('devCustomSpawner');
      if (customSpawner) customSpawner.classList.remove('hidden');
    }
  };

  window.toggleDevMetricGroup = function (groupKey) {
    const willOpen = !window.devMetricExpanded[groupKey];
    let siblingKeys = [];
    if (groupKey.startsWith('Audio')) siblingKeys = ['AudioHw', 'AudioDsp', 'AudioMem'];
    else if (groupKey.startsWith('Ver')) siblingKeys = ['VerManifest', 'VerDownload', 'VerPlugin', 'VerLogs'];
    else if (groupKey.startsWith('Ad')) siblingKeys = ['AdStatus', 'AdLogs'];

    const domMap = {
      AudioHw: 'devAudioLogHw', AudioDsp: 'devAudioLogDsp', AudioMem: 'devAudioLogMem',
      VerManifest: 'devVerLogManifest', VerDownload: 'devVerLogDownload', VerPlugin: 'devVerLogPlugin', VerLogs: 'devVerLogHistory',
      AdStatus: 'devAdLogStatus', AdLogs: 'devAdLogHistory'
    };

    siblingKeys.forEach(k => {
      const openState = (k === groupKey) ? willOpen : false;
      window.devMetricExpanded[k] = openState;
      const contentEl = document.getElementById(domMap[k]);
      const arrowEl = document.getElementById('devMetricArrow' + k);
      if (contentEl) contentEl.classList.toggle('hidden', !openState);
      if (arrowEl) arrowEl.textContent = openState ? '▴' : '▾';
    });
  };

  window.devSpawnCustomEnemies = function () {
    if (gameState !== 'PLAYING') {
      if (typeof showHintToast === 'function') {
        showHintToast(typeof t === 'function' ? (t('start_level_first_to_spawn') || t('start_level_first')) : 'Start level first!');
      }
      return;
    }
    if (typeof handleDevSpawnClick === 'function') handleDevSpawnClick();
  };

  window.toggleDevMode = function (enabled) {
    if (enabled) window.openDevMode();
    else window.closeDevMode();
  };

  window.mountRuntimeMetadata = window.openDevMode;

  // Автоматический запуск при загрузке файла
  window.openDevMode();
})();