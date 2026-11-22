// Synth Wave Defense — ui_screens_meta.js (Synth Pass, Dropdowns, Settings Toggles, Swipes, Loadout, Milestones, Shop, Daily, Victory Stars)

//  Synth Pass & Custom Neon Color Palette UI Handlers.
let bpPreviousSource = 'start';

// [UI.DX]
function updateBpProgressUI() {
    const { tier, xpInTier, isMax } = getBpTierInfo(bpXp);

    const tierText = document.getElementById('startBpTierText');
    if (tierText) {
        tierText.textContent = (typeof t === 'function') ? t('tier_n', { n: tier }) : `TIER ${tier}`;
    }

    const startFill = document.getElementById('startBpProgressFill');
    if (startFill) {
        const pct = isMax ? 100 : xpInTier;
        startFill.style.width = `${pct}%`;
    }

    updateMenuBadges();

    const bpScreen = document.getElementById('battlePassScreen');
    if (bpScreen && !bpScreen.classList.contains('hidden')) {
        renderBattlePassScreen();
    }
}

const VISIBLE_PALETTE_IDS = [
  'default', 'matrix_green', 'cyber_gold', 'blood_moon',
  'bio_venom', 'sakura_wave', 'solar_inferno'
];

// [UI.DY]
function closeCustomPaletteMenus() {
  document.querySelectorAll('.custom-palette-menu').forEach(m => m.classList.add('hidden'));
  document.querySelectorAll('.custom-palette-trigger').forEach(t => t.classList.remove('open'));
}

// [UI.DZ]
document.addEventListener('pointerdown', (e) => {
  if (!e.target.closest('.custom-palette-dropdown')) {
    closeCustomPaletteMenus();
  }
});

// [UI.EA]
function updatePaletteSelectDropdown(selectId) {
  const selectEl = document.getElementById(selectId);
  if (!selectEl || typeof NEON_PALETTES === 'undefined') return;

  selectEl.style.display = 'none';

  let wrapper = selectEl.parentNode.querySelector(`.custom-palette-dropdown[data-for="${selectId}"]`);
  if (!wrapper) {
    wrapper = document.createElement('div');
    wrapper.className = 'custom-palette-dropdown';
    wrapper.dataset.for = selectId;
    selectEl.parentNode.insertBefore(wrapper, selectEl.nextSibling);
  }

  const totalUnlocked = unlockedPalettes.length;
  const isLockedInitial = (totalUnlocked <= 1 && !devMode);
  const currentPal = NEON_PALETTES[activePalette] || NEON_PALETTES.default;

  wrapper.innerHTML = '';

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'custom-palette-trigger' + (isLockedInitial ? ' is-disabled' : '');
  trigger.innerHTML = `
    ${isLockedInitial ? `<span class="pal-lock-icon">${CUSTOM_LOCK_SVG}</span>` : ''}
    <span class="pal-opt-bars is-mini">
      <span style="background:${currentPal.c1};"></span>
      <span style="background:${currentPal.c2};"></span>
      <span style="background:${currentPal.c3};"></span>
    </span>
    <span class="pal-trigger-name">${currentPal.name}</span>
    <span class="pal-trigger-arrow">▾</span>
  `;

  const menu = document.createElement('div');
  menu.className = 'custom-palette-menu hidden';

  VISIBLE_PALETTE_IDS.forEach(pId => {
    const pal = NEON_PALETTES[pId];
    if (!pal) return;
    const isUnlocked = (typeof devMode !== 'undefined' && devMode) || unlockedPalettes.includes(pId);
    const isSelected = (pId === activePalette);

    const item = document.createElement('div');
    item.className = 'custom-palette-option'
      + (isSelected ? ' selected' : '')
      + (!isUnlocked ? ' locked' : '');

    item.innerHTML = `
      <span class="pal-opt-bars" style="border-color:${isUnlocked ? pal.c1 + '66' : 'rgba(140, 200, 255, 0.14)'};">
        <span style="background:${pal.c1};"></span>
        <span style="background:${pal.c2};"></span>
        <span style="background:${pal.c3};"></span>
      </span>
      <span class="pal-opt-name">${pal.name}</span>
      ${!isUnlocked ? `<span class="pal-opt-lock">${CUSTOM_LOCK_SVG}</span>` : ''}
    `;

    // [UI.EB]
    item.onclick = (e) => {
      e.stopPropagation();
      if (!isUnlocked) {
        if (typeof sfx === 'function') sfx('denied');

        let lockMsg = '';
        if (pal.source === 'shop') {
          lockMsg = (typeof t === 'function' && t('pal_unlock_shop'))
            ? t('pal_unlock_shop')
            : 'Available for purchase in Gifts & Shop!';
        } else if (typeof t === 'function' && t(`pal_unlock_${pId}`)) {
          lockMsg = t(`pal_unlock_${pId}`);
        } else if (pId === 'matrix_green') {
          lockMsg = (typeof t === 'function' ? t('pal_unlock_t10_free') : 'Unlocks for free at Synth Pass Tier 10!');
        } else if (pId === 'cyber_gold') {
          lockMsg = (typeof t === 'function' ? t('pal_unlock_prem_t1') : 'Unlocks with Premium Synth Pass at Tier 1!');
        } else {
          lockMsg = (typeof t === 'function' ? t('pal_unlock_prem_t30') : 'Unlocks with Premium Synth Pass at Tier 30!');
        }

        showHintToast(lockMsg);
        return;
      }
      closeCustomPaletteMenus();
      selectPalette(pId);
    };

    menu.appendChild(item);
  });

  // [UI.EC]
  trigger.onclick = (e) => {
    e.stopPropagation();
    if (isLockedInitial) {
      if (typeof sfx === 'function') sfx('denied');
      showHintToast(typeof t === 'function' ? t('free_theme_unlocks_t10') : 'Free Visual theme unlocks at Synth Pass Tier 10');
      return;
    }
    const wasHidden = menu.classList.contains('hidden');
    closeCustomPaletteMenus();
    if (wasHidden) {
      menu.classList.remove('hidden');
      trigger.classList.add('open');
      if (typeof sfx === 'function') sfx('tap');
    }
  };

  wrapper.appendChild(trigger);
  wrapper.appendChild(menu);
}

// [UI.ECM] Кастомный выпадающий список выбора языка в стиле проекта
function updateLanguageSelectDropdown(selectId = 'settingLangSelect') {
  const selectEl = document.getElementById(selectId);
  if (!selectEl || typeof SUPPORTED_LANGUAGES === 'undefined') return;

  selectEl.style.display = 'none';

  let wrapper = selectEl.parentNode.querySelector(`.custom-palette-dropdown[data-for="${selectId}"]`);
  if (!wrapper) {
    wrapper = document.createElement('div');
    wrapper.className = 'custom-palette-dropdown';
    wrapper.dataset.for = selectId;
    selectEl.parentNode.insertBefore(wrapper, selectEl.nextSibling);
  }

  const activeCode = (typeof currentLang !== 'undefined' && SUPPORTED_LANGUAGES[currentLang]) ? currentLang : 'en';
  const activeName = SUPPORTED_LANGUAGES[activeCode] || 'English';

  wrapper.innerHTML = '';

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'custom-palette-trigger';
  trigger.innerHTML = `
    <span class="pal-trigger-name">${activeName}</span>
    <span class="pal-trigger-arrow">▾</span>
  `;

  const menu = document.createElement('div');
  menu.className = 'custom-palette-menu hidden';
  if (typeof enablePointerScroll === 'function') {
    enablePointerScroll(menu);
  }

  Object.keys(SUPPORTED_LANGUAGES).forEach(code => {
    const langLabel = SUPPORTED_LANGUAGES[code];
    const isSelected = (code === activeCode);

    const item = document.createElement('div');
    item.className = 'custom-palette-option' + (isSelected ? ' selected' : '');
    item.innerHTML = `
      <span class="lang-opt-code">${code.toUpperCase()}</span>
      <span class="pal-opt-name">${langLabel}</span>
    `;

    item.onclick = (e) => {
      e.stopPropagation();
      closeCustomPaletteMenus();
      if (typeof sfx === 'function') sfx('confirm');
      if (typeof setLanguage === 'function') {
        setLanguage(code, true);
      }
      const prefix = typeof t === 'function' ? t('language') : 'Language';
      if (typeof showHintToast === 'function') {
        showHintToast(`${prefix}: ${langLabel}`);
      }
    };

    menu.appendChild(item);
  });

  trigger.onclick = (e) => {
    e.stopPropagation();
    const wasHidden = menu.classList.contains('hidden');
    closeCustomPaletteMenus();
    if (wasHidden) {
      menu.classList.remove('hidden');
      trigger.classList.add('open');
      if (typeof sfx === 'function') sfx('tap');
    }
  };

  wrapper.appendChild(trigger);
  wrapper.appendChild(menu);
}
window.updateLanguageSelectDropdown = updateLanguageSelectDropdown;

// [UI.ED]
function handleBpThemeClick(e) {}

// [UI.EE]
function selectPalette(paletteId) {
  if (!unlockedPalettes.includes(paletteId) && !devMode) {
    sfx('denied');
    const pal = (typeof NEON_PALETTES !== 'undefined') ? NEON_PALETTES[paletteId] : null;
    let lockMsg = '';

    if (pal && pal.source === 'shop') {
      lockMsg = (typeof t === 'function' && t('pal_unlock_shop')) ? t('pal_unlock_shop') : 'Available in Shop!';
    } else if (typeof t === 'function' && t(`pal_unlock_${paletteId}`)) {
      lockMsg = t(`pal_unlock_${paletteId}`);
    } else {
      lockMsg = (typeof t === 'function' && t('theme_locked_synth_pass')) ? t('theme_locked_synth_pass') : 'Synth Pass';
    }

    showHintToast(lockMsg);
    return;
  }
  if (!unlockedPalettes.includes(paletteId) && devMode) {
    unlockedPalettes.push(paletteId);
  }
  applyPaletteColors(paletteId);
  sfx('confirm');
  saveGame();
  updatePaletteSelectDropdown('settingPaletteSelect');
  updatePaletteSelectDropdown('bpPaletteSelect');
  const palName = NEON_PALETTES[paletteId] ? NEON_PALETTES[paletteId].name : paletteId;
  const prefix = typeof t === 'function' ? t('visual') : 'Visual';
  showHintToast(`${prefix}: ${palName}`);
}

// [UI.EF]
function showBattlePassScreen(fromSource = 'start') {
  bpPreviousSource = fromSource;
  const bgScreenId = (fromSource === 'victory') ? 'victoryScreen'
    : ((fromSource === 'defeat') ? 'defeatScreen' : 'startScreen');

  ['startScreen', 'victoryScreen', 'defeatScreen', 'levelsScreen', 'pauseScreen', 'settingsScreen', 'upgradesScreen', 'shopScreen']
    .forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.classList.remove('screen-bg-only');
      if (id === bgScreenId) {
        el.classList.remove('hidden');
        el.classList.add('screen-bg-only');
      } else {
        el.classList.add('hidden');
      }
    });

  const topHud = document.getElementById('topHud');
  if (topHud) topHud.classList.add('hidden');

  const bpScreen = document.getElementById('battlePassScreen');
  if (bpScreen) {
    const isResultBg = (bgScreenId === 'victoryScreen' || bgScreenId === 'defeatScreen');
    bpScreen.classList.toggle('from-result', isResultBg);
    bpScreen.classList.toggle('from-main', !isResultBg);
    bpScreen.classList.remove('hidden');
  }
  gameState = 'BATTLE_PASS';

  renderBattlePassScreen();

  updateDailyBonusBtnVisibility();
}

// [UI.EG]
function closeBattlePassScreen() {
  const bpScreen = document.getElementById('battlePassScreen');
  if (bpScreen) bpScreen.classList.add('hidden');

  const topHud = document.getElementById('topHud');
  if (topHud) topHud.classList.remove('hidden');

  ['startScreen', 'victoryScreen', 'defeatScreen'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('screen-bg-only');
  });

  if (bpPreviousSource === 'victory') {
    document.getElementById('victoryScreen').classList.remove('hidden');
    gameState = 'VICTORY';
  } else if (bpPreviousSource === 'defeat') {
    document.getElementById('defeatScreen').classList.remove('hidden');
    gameState = 'DEFEAT';
  } else {
    document.getElementById('startScreen').classList.remove('hidden');
    gameState = 'START';
  }
  updateBpProgressUI();
  
  syncTopHudVisibility();
  updateDailyBonusBtnVisibility();
}

// [UI.EH]
function renderBattlePassScreen() {
    const dVal = document.getElementById('bpDiamondVal');
    if (dVal) dVal.textContent = diamonds;
    const pVal = document.getElementById('bpPrismVal');
    if (pVal) pVal.textContent = prisms;

    const { tier, xpInTier, isMax } = getBpTierInfo(bpXp);

    const badgeText = document.getElementById('bpTierBadgeText');
    if (badgeText) badgeText.textContent = typeof t === 'function' ? t('tier_n_of_m', { n: tier, m: 30 }) : `TIER ${tier} / 30`;

    const barFill = document.getElementById('bpXpBarFill');
    if (barFill) barFill.style.width = isMax ? '100%' : `${xpInTier}%`;

    const barText = document.getElementById('bpXpBarText');
    if (barText) barText.textContent = isMax ? `XP: ${typeof t === 'function' ? t('max') : 'MAX'} (3000/3000)` : `XP: ${xpInTier} / 100`;

    const diamondIconSvg = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#00e5ff" stroke-width="2.2" stroke-linejoin="round" style="flex:none; vertical-align:middle; margin-left:3px;"><polygon points="6 3 18 3 22 9 12 22 2 9" fill="rgba(0,229,255,.28)"/><polyline points="2 9 12 13 22 9"/><line x1="12" y1="22" x2="12" y2="13"/></svg>`;

    const premBtn = document.getElementById('bpActivatePremBtn');
    if (premBtn) {
        if (bpPremiumPurchased) {
            premBtn.className = 'bp-action-btn bp-btn-premium owned';
            premBtn.disabled = true;
            premBtn.innerHTML = `<span>${typeof t === 'function' ? t('prem_unlocked') : 'PREMIUM UNLOCKED'}</span>`;
        } else {
            const canAfford = (diamonds >= 300);
            premBtn.className = 'bp-action-btn bp-btn-premium' + (canAfford ? '' : ' cost-insufficient');
            premBtn.disabled = false;
            premBtn.innerHTML = `<span style="display:inline-flex; align-items:center; justify-content:center; gap:4px;">${typeof t === 'function' ? t('activate_prem', { cost: 300, icon: diamondIconSvg }) : 'ACTIVATE (300 ' + diamondIconSvg + ')'}</span>`;
            premBtn.onclick = buyBpPremiumWithDiamonds;
        }
    }

    const buyTierBtn = document.getElementById('bpBuyTierBtn') || document.querySelector('.bp-btn-buy-tier');
    if (buyTierBtn) {
        const canAffordTier = (diamonds >= 30) && !isMax;
        buyTierBtn.disabled = isMax;
        buyTierBtn.className = 'bp-action-btn bp-btn-buy-tier' + (canAffordTier ? '' : ' cost-insufficient');
    }

    const devBox = document.getElementById('bpDevControls');
    if (devBox) devBox.classList.toggle('hidden', !devMode);

    updatePaletteSelectDropdown('bpPaletteSelect');

    const listBody = document.getElementById('bpTierListBody');
    if (!listBody) return;
    enablePointerScroll(listBody);
    listBody.innerHTML = '';

    const diamondIcon = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#00e5ff" stroke-width="2.2"><polygon points="6 3 18 3 22 9 12 22 2 9" fill="rgba(0,229,255,.25)"/><polyline points="2 9 12 13 22 9"/><line x1="12" y1="22" x2="12" y2="13"/></svg>`;
    const prismIcon = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#d946ef" stroke-width="2.2" stroke-linejoin="round"><polygon points="12 2 21 12 12 22 3 12" fill="rgba(217,70,239,.25)"/><polyline points="3 12 12 15 21 12"/><line x1="12" y1="2" x2="12" y2="22"/></svg>`;

    const _tr = (typeof window.t === 'function') ? window.t : ((k) => k.toUpperCase());
    const nextTargetTier = isMax ? 30 : (tier + 1);

    BATTLE_PASS_TIERS.forEach(item => {
        const tNum = item.tier;
        const isUnlockedTier = tier >= tNum;
        const isCurrentTier = (tNum === nextTargetTier && !isMax) || (isMax && tNum === 30);

        const row = document.createElement('div');
        row.className = `bp-tier-row${isCurrentTier ? ' current-tier' : ''}`;

        const freeCell = document.createElement('div');
        const isFreeClaimed = !!bpClaimedFree[tNum];
        freeCell.className = `bp-cell bp-cell-free${isFreeClaimed ? ' claimed' : ''}`;

        // [UI.EI]
        const formatRewardText = (str) => {
            if (!str) return '';
            let s = str.replace(/\(\s*(\+?\s*\d+\s*[\u{1F52E}🔮\u{1F48E}💎])\s*\)/gu, '$1');
            s = s.replace(/(\+?\s*\d+)\s*[\u{1F52E}🔮]/gu, `<span style="white-space:nowrap; display:inline-flex; align-items:center; gap:2px; color:#ffffff;">$1 ${prismIcon}</span>`);
            s = s.replace(/(\+?\s*\d+)\s*[\u{1F48E}💎]/gu, `<span style="white-space:nowrap; display:inline-flex; align-items:center; gap:2px; color:#ffffff;">$1 ${diamondIcon}</span>`);
            s = s.replace(/[\u{1F52E}🔮]/gu, prismIcon).replace(/[\u{1F48E}💎]/gu, diamondIcon);
            return s;
        };

        let freeTitle = '';
        const fr = item.freeReward;
        if (fr.type === 'diamonds') freeTitle = `<span style="white-space:nowrap; display:inline-flex; align-items:center; gap:3px; color:#ffffff;">+${fr.amount} ${diamondIcon}</span>`;
        else if (fr.type === 'prisms') freeTitle = `<span style="white-space:nowrap; display:inline-flex; align-items:center; gap:3px; color:#ffffff;">+${fr.amount} ${prismIcon}</span>`;
        else if (fr.type === 'ad_capsule') {
            const capTitle = (typeof t === 'function' && t('ad_capsule')) ? t('ad_capsule') : (_tr('ad_capsule') || 'Ad-Capsule');
            freeTitle = `${capTitle} <span style="white-space:nowrap; display:inline-flex; align-items:center; gap:2px; color:#ffffff;">+2 ${prismIcon}</span>`;
        }
        else if (fr.title) freeTitle = formatRewardText(fr.title);

        let freeBtnHtml = '';
        if (isFreeClaimed) {
            freeBtnHtml = `<button class="bp-cell-btn claimed-btn">${_tr('claimed')}</button>`;
        } else if (isUnlockedTier) {
            if (fr.type === 'ad_capsule') {
                freeBtnHtml = `<button class="bp-cell-btn ad-btn" onclick="claimBpFreeReward(${tNum})">${_tr('watch_ad')}</button>`;
            } else {
                freeBtnHtml = `<button class="bp-cell-btn claim-btn" onclick="claimBpFreeReward(${tNum})">${_tr('claim')}</button>`;
            }
        } else {
            freeBtnHtml = `<button class="bp-cell-btn locked-btn" onclick="claimBpFreeReward(${tNum})">${_tr('locked')}</button>`;
        }

        freeCell.innerHTML = `<span class="bp-cell-title">${freeTitle}</span>${freeBtnHtml}`;

        const numBox = document.createElement('div');
        numBox.className = 'bp-tier-num-box';
        numBox.innerHTML = `<span class="bp-tier-num">${tNum}</span><span class="bp-tier-status">${isUnlockedTier ? _tr('unlocked') : _tr('locked')}</span>`;

        const premCell = document.createElement('div');
        const isPremClaimed = !!bpClaimedPrem[tNum];
        premCell.className = `bp-cell bp-cell-prem${isPremClaimed ? ' claimed' : ''}`;

        let premTitle = '';
        const pr = item.premReward;
        if (pr.type === 'diamonds') premTitle = `<span style="white-space:nowrap; display:inline-flex; align-items:center; gap:3px; color:#ffffff;">+${pr.amount} ${diamondIcon}</span>`;
        else if (pr.type === 'prisms') premTitle = `<span style="white-space:nowrap; display:inline-flex; align-items:center; gap:3px; color:#ffffff;">+${pr.amount} ${prismIcon}</span>`;
        else if (pr.type === 'palette' || pr.type === 'perk' || pr.type === 'ultimate') {
            premTitle = formatRewardText(pr.title);
        }

        let premBtnHtml = '';
        if (isPremClaimed) {
            premBtnHtml = `<button class="bp-cell-btn claimed-btn">${_tr('claimed')}</button>`;
        } else if (bpPremiumPurchased && isUnlockedTier) {
            premBtnHtml = `<button class="bp-cell-btn claim-btn" onclick="claimBpPremReward(${tNum})">${_tr('claim')}</button>`;
        } else if (!bpPremiumPurchased) {
            premBtnHtml = `<button class="bp-cell-btn locked-btn" onclick="claimBpPremReward(${tNum})">PREMIUM</button>`;
        } else {
            premBtnHtml = `<button class="bp-cell-btn locked-btn" onclick="claimBpPremReward(${tNum})">${_tr('locked')}</button>`;
        }

        premCell.innerHTML = `<span class="bp-cell-title">${premTitle}</span>${premBtnHtml}`;

        row.appendChild(freeCell);
        row.appendChild(numBox);
        row.appendChild(premCell);

        listBody.appendChild(row);
    });
}

// [UI.EJ]
function claimBpFreeReward(tNum) {
    const { tier } = getBpTierInfo(bpXp);
    if (tier < tNum) {
        if (typeof sfx === 'function') sfx('denied');
        showHintToast(typeof t === 'function' ? t('reach_tier_first', { t: tNum }) : `Reach Tier ${tNum} first!`);
        return;
    }
    if (bpClaimedFree[tNum]) return;

    const item = BATTLE_PASS_TIERS.find(i => i.tier === tNum);
    if (!item) return;
    const fr = item.freeReward;

    // [UI.EK]
    const executeClaim = () => {
        bpClaimedFree[tNum] = true;
        let toast = '';
        if (fr.type === 'diamonds') {
            diamonds += fr.amount;
            toast = typeof t === 'function' ? t('diamonds_claimed', { n: fr.amount }) : `+${fr.amount} Diamonds claimed!`;
        } else if (fr.type === 'prisms') {
            prisms += fr.amount;
            toast = typeof t === 'function' ? t('prisms_claimed', { n: fr.amount }) : `+${fr.amount} Prisms claimed!`;
        } else if (fr.type === 'ad_capsule') {
            prisms += fr.prisms;
            toast = typeof t === 'function' ? t('ad_capsule_claimed', { n: fr.prisms }) : `Ad-Capsule: +${fr.prisms} Prisms claimed!`;
        } else if (fr.type === 'combo' || fr.paletteId || fr.type === 'palette') {
            if (fr.paletteId) {
                if (!unlockedPalettes.includes(fr.paletteId)) {
                    unlockedPalettes.push(fr.paletteId);
                }
                applyPaletteColors(fr.paletteId);
            }
            if (fr.prisms) {
                prisms += fr.prisms;
            }
            if (fr.diamonds) {
                diamonds += fr.diamonds;
            }
            toast = fr.title ? `${fr.title} claimed!` : `Unlocked ${NEON_PALETTES[fr.paletteId] ? NEON_PALETTES[fr.paletteId].name : fr.paletteId}!`;
        }
        updateDiamondUI();
        updatePrismUI();
        saveGame();
        sfx('reward');
        renderBattlePassScreen();
        showHintToast(toast);
    };

    if (fr.type === 'ad_capsule') {
        showAdPlaceholder(executeClaim, null);
    } else {
        executeClaim();
    }
}

// [UI.EL]
function claimBpPremReward(tNum) {
    if (!bpPremiumPurchased) {
        if (typeof sfx === 'function') sfx('denied');
        showHintToast(typeof t === 'function' ? t('activate_premium_first') : 'Activate Premium Pass first!');
        return;
    }
    const { tier } = getBpTierInfo(bpXp);
    if (tier < tNum) {
        if (typeof sfx === 'function') sfx('denied');
        showHintToast(typeof t === 'function' ? t('reach_tier_first', { t: tNum }) : `Reach Tier ${tNum} first!`);
        return;
    }
    if (bpClaimedPrem[tNum]) return;

    const item = BATTLE_PASS_TIERS.find(i => i.tier === tNum);
    if (!item) return;
    const pr = item.premReward;

    bpClaimedPrem[tNum] = true;
    let toast = '';

    if (pr.type === 'diamonds') {
        diamonds += pr.amount;
        toast = typeof t === 'function' ? t('diamonds_claimed', { n: pr.amount }) : `+${pr.amount} Diamonds claimed!`;
    } else if (pr.type === 'prisms') {
        prisms += pr.amount;
        toast = typeof t === 'function' ? t('prisms_claimed', { n: pr.amount }) : `+${pr.amount} Prisms claimed!`;
    } else if (pr.type === 'palette') {
        if (!unlockedPalettes.includes(pr.paletteId)) {
            unlockedPalettes.push(pr.paletteId);
        }
        applyPaletteColors(pr.paletteId);
        toast = typeof t === 'function' ? t('unlocked_palette', { name: NEON_PALETTES[pr.paletteId].name }) : `Unlocked Palette: ${NEON_PALETTES[pr.paletteId].name}!`;
    } else if (pr.type === 'perk') {
        toast = typeof t === 'function' ? t('perk_starting_reserve_unlocked') : 'Unlocked Perk: Starting Reserve (+15% Gold)!';
    } else if (pr.type === 'ultimate') {
        if (!unlockedPalettes.includes(pr.paletteId)) {
            unlockedPalettes.push(pr.paletteId);
        }
        prisms += pr.prisms;
        diamonds += pr.diamonds;
        applyPaletteColors(pr.paletteId);
        toast = typeof t === 'function' ? t('ultimate_bp_reward_claimed') : 'ULTIMATE REWARD CLAIMED! Blood Moon + 25 Prisms + 150 Diamonds';
    }

    updateDiamondUI();
    updatePrismUI();
    saveGame();
    sfx('reward');
    renderBattlePassScreen();
    showHintToast(toast);
}

// [UI.EM]

// [UI.EN]
function handleThemeShopAction(paletteId, cost) { 
    if (typeof buyThemeWithDiamonds === 'function') {
        buyThemeWithDiamonds(paletteId, cost);
    }
} 
window.handleThemeShopAction = handleThemeShopAction;

// [UI.EO]
function buyBpTierWithDiamonds() {
    const { tier, isMax } = getBpTierInfo(bpXp);
    if (isMax || (tier >= 30 && bpXp >= 3000)) {
        if (typeof sfx === 'function') sfx('denied');
        showHintToast(typeof t === 'function' ? t('synth_pass_max_tier') : 'Synth Pass already at Max Tier!');
        return;
    }
    if (diamonds < 30) {
        if (typeof sfx === 'function') sfx('denied');
        if (typeof vibrate === 'function') vibrate('warning');
        showHintToast(typeof t === 'function' ? t('not_enough_diamonds_30', { cost: 30 }) : 'Not enough Diamonds! (30 required)');
        return;
    }
    diamonds -= 30;
    addBpXp(100);
    updateDiamondUI();
    sfx('confirm');
    renderBattlePassScreen();
    showHintToast(typeof t === 'function' ? t('tier_purchased_plus_100_xp') : '+1 Tier purchased (+100 XP)!');
}

// [UI.EP]
function devAddBpXp() {}

// [UI.EQ]
function devToggleBpPremium() {}

// [UI.ER]
function closeSettings() {
  if (settingsPreviousSource !== 'levels') stopNormalModePreview();
  const settingsSc = document.getElementById('settingsScreen');
  if (settingsSc) settingsSc.classList.add('hidden');

  ['startScreen', 'victoryScreen', 'defeatScreen'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('screen-bg-only');
  });

  if (settingsPreviousSource === 'combat' || settingsPreviousSource === 'pause') {
    musicSetDucked(false);
    gameState = 'PLAYING';
    lastTime = performance.now();
    resumeRampTimer = RESUME_RAMP_DURATION;
  } else if (settingsPreviousSource === 'victory') {
    const scr = document.getElementById('victoryScreen');
    if (scr) scr.classList.remove('hidden');
    gameState = 'VICTORY';
  } else if (settingsPreviousSource === 'defeat') {
    const scr = document.getElementById('defeatScreen');
    if (scr) scr.classList.remove('hidden');
    gameState = 'DEFEAT';
  } else if (settingsPreviousSource === 'levels') {
    const scr = document.getElementById('levelsScreen');
    if (scr) scr.classList.remove('hidden');
    gameState = 'LEVELS';
    startModeBattlePreview(currentLevelMode);
  } else if (settingsPreviousSource === 'upgrades') {
    const scr = document.getElementById('upgradesScreen');
    if (scr) scr.classList.remove('hidden');
    gameState = 'UPGRADES';
  } else if (settingsPreviousSource === 'shop') {
    const scr = document.getElementById('shopScreen');
    if (scr) scr.classList.remove('hidden');
    gameState = 'SHOP';
  } else {
    const scr = document.getElementById('startScreen');
    if (scr) scr.classList.remove('hidden');
    gameState = 'START';
    music('menu');
  }
  syncTopHudVisibility();
  updateHudSpeedWidget();
  updateDailyBonusBtnVisibility();
}

// [UI.ES]
function toggleSettingHp(isChecked) { settings.showEnemyHp = isChecked; saveGameSoon(); }

// [UI.ET]
function toggleSettingDamage(isChecked) { settings.showDamage = isChecked; saveGameSoon(); }

// [UI.EU]
function toggleSettingVibration(isChecked) {
  settings.vibrationEnabled = isChecked;
  if (isChecked) {
    if (typeof vibrate === 'function') vibrate('medium');
    else if (navigator.vibrate) { try { navigator.vibrate(30); } catch(e){} }
  }
  saveGameSoon();
}

// [UI.EUM]
function toggleSettingScreenShake(isChecked) {
  settings.screenShakeEnabled = isChecked;
  if (!isChecked && typeof cameraShakeTimer !== 'undefined') {
    cameraShakeTimer = 0;
  }
  saveGameSoon();
}

// [UI.EV]
function applySfxVolume(pct, persist) {
  const v = Math.max(0, Math.min(100, Math.round(Number(pct) || 0)));
  settings.sfxVolume = v;
  settings.sfxEnabled = v > 0;
  sfxSetEnabled(settings.sfxEnabled);
  sfxSetVolume(v / 100);
  if (v === 0) sfxStopBeams();

  const slider = document.getElementById('settingSfxVol');
  if (slider && String(slider.value) !== String(v)) slider.value = v;
  if (slider) slider.classList.toggle('is-muted', v === 0);
  const label = document.getElementById('sfxVolLabel');
  if (label) {
    const offText = (typeof t === 'function') ? t('off') : 'OFF';
    label.textContent = v === 0 ? offText : `${v}%`;
    label.classList.toggle('is-muted', v === 0);
  }
  if (persist) saveGameSoon();
}

// [UI.EW]
function applyMusicVolume(pct, persist) {
  const v = Math.max(0, Math.min(100, Math.round(Number(pct) || 0)));
  settings.musicVolume = v;
  settings.musicEnabled = v > 0;
  musicSetEnabled(settings.musicEnabled);
  musicSetVolume(v / 100);

  const slider = document.getElementById('settingMusicVol');
  if (slider && String(slider.value) !== String(v)) slider.value = v;
  if (slider) slider.classList.toggle('is-muted', v === 0);
  const label = document.getElementById('musicVolLabel');
  if (label) {
    const offText = (typeof t === 'function') ? t('off') : 'OFF';
    label.textContent = v === 0 ? offText : `${v}%`;
    label.classList.toggle('is-muted', v === 0);
  }
  if (persist) saveGameSoon();
}

// [UI.EX]
function setSfxVolume(pct) { applySfxVolume(pct, true); }
// [UI.EY]
function setMusicVolume(pct) { applyMusicVolume(pct, true); }

// [UI.EZ]
function toggleSettingPerf(isChecked) {
  perfMode = isChecked ? 'low' : 'high';
  settings.perfModeOverride = perfMode;
  perfDecided = true;
  saveGameSoon();
}

// [UI.FA]
(function initLevelSelectSwipeGesture() {
  let touchStartX = 0;
  let touchStartY = 0;
  let touchStartTime = 0;
  let isSwiping = false;
  let swipeTriggered = false;
  let isPointerDown = false;
  let swipeResetTimer = null;

  function scheduleSwipeStateReset(delayMs = 120) {
    if (swipeResetTimer) clearTimeout(swipeResetTimer);
    swipeResetTimer = setTimeout(() => {
      isSwiping = false;
      swipeTriggered = false;
      swipeResetTimer = null;
    }, delayMs);
  }

  // [UI.FB]
  function onPointerDown(e) {
    if (gameState !== 'LEVELS') return;
    const levelsScreen = document.getElementById('levelsScreen');
    if (!levelsScreen || levelsScreen.classList.contains('hidden')) return;

    // Любое новое касание экрана — это новый жест; сбрасываем хвост от предыдущего свайпа
    if (swipeResetTimer) {
      clearTimeout(swipeResetTimer);
      swipeResetTimer = null;
    }
    isSwiping = false;
    swipeTriggered = false;

    if (e.target && e.target.closest && e.target.closest('.mode-3way-tab, .levels-main-menu-btn, .hud-gear-btn, .part-nav-btn, .loadout-widget')) {
      isPointerDown = false;
      return;
    }

    isPointerDown = true;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    touchStartX = clientX;
    touchStartY = clientY;
    touchStartTime = performance.now();
  }

  // [UI.FC]
  function onPointerMove(e) {
    if (!isPointerDown || gameState !== 'LEVELS' || swipeTriggered || isNavigatingSection) return;
    if (!e.touches && e.buttons === 0) {
      isPointerDown = false;
      return;
    }

    const levelsScreen = document.getElementById('levelsScreen');
    if (!levelsScreen || levelsScreen.classList.contains('hidden')) return;

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const deltaX = clientX - touchStartX;
    const deltaY = clientY - touchStartY;
    const minDistance = 35;

    if (Math.abs(deltaX) >= minDistance && Math.abs(deltaX) > Math.abs(deltaY) * 1.2) {
      swipeTriggered = true;
      isSwiping = true;
      isPointerDown = false;
      scheduleSwipeStateReset(180);
      if (deltaX < 0) {
        navLevelSection(1);
      } else {
        navLevelSection(-1);
      }
    }
  }

  // [UI.FD]
  function onPointerUp(e) {
    if (swipeTriggered || isSwiping) {
      isPointerDown = false;
      scheduleSwipeStateReset(80);
      return;
    }
    if (!isPointerDown || gameState !== 'LEVELS') {
      isPointerDown = false;
      return;
    }
    isPointerDown = false;

    const levelsScreen = document.getElementById('levelsScreen');
    if (!levelsScreen || levelsScreen.classList.contains('hidden')) return;

    const clientX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
    const clientY = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;

    const deltaX = clientX - touchStartX;
    const deltaY = clientY - touchStartY;
    const duration = performance.now() - touchStartTime;

    const minDistance = 35;
    const maxDuration = 600;

    if (duration <= maxDuration && Math.abs(deltaX) >= minDistance && Math.abs(deltaX) > Math.abs(deltaY) * 1.2) {
      swipeTriggered = true;
      isSwiping = true;
      scheduleSwipeStateReset(80);
      if (deltaX < 0) {
        navLevelSection(1);
      } else {
        navLevelSection(-1);
      }
    }
  }

  // [UI.FE]
  function onClickCapture(e) {
    // Никогда не блокируем нажатия на навигационные кнопки
    if (e.target && e.target.closest && e.target.closest('.levels-main-menu-btn, .mode-3way-tab, .hud-gear-btn, .part-nav-btn')) {
      isSwiping = false;
      swipeTriggered = false;
      return;
    }
    if (isSwiping || swipeTriggered) {
      e.stopPropagation();
      e.preventDefault();
      scheduleSwipeStateReset(30);
    }
  }

  // [UI.FF]
  function setupListeners() {
    const levelsScreen = document.getElementById('levelsScreen');
    if (levelsScreen) {
      levelsScreen.addEventListener('touchstart', onPointerDown, { passive: true });
      levelsScreen.addEventListener('touchmove', onPointerMove, { passive: true });
      levelsScreen.addEventListener('touchend', onPointerUp, { passive: true });
      levelsScreen.addEventListener('touchcancel', () => {
        isPointerDown = false;
        scheduleSwipeStateReset(50);
      }, { passive: true });
      levelsScreen.addEventListener('mousedown', onPointerDown);
      levelsScreen.addEventListener('mousemove', onPointerMove);
      levelsScreen.addEventListener('mouseup', onPointerUp);
      levelsScreen.addEventListener('mouseleave', () => { isPointerDown = false; });
      levelsScreen.addEventListener('click', onClickCapture, true);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupListeners);
  } else {
    setupListeners();
  }
})();

// [UI.FIM] Shared HUD & screen transition helper for entering #levelsScreen.
function _enterLevelSelectView() {
  if (reviveTimerInterval) { clearInterval(reviveTimerInterval); reviveTimerInterval = null; }
  document.getElementById('levelsScreen').classList.remove('hidden');
  document.getElementById('econHpSplitBadge').classList.add('hidden');
  document.getElementById('levelWaveSplitBadge').classList.add('hidden');
  document.getElementById('hudRightGroup').classList.remove('hidden');
  updateStartChapterLabel(false);
  document.getElementById('controlsWrapper').classList.add('hidden');

  const waveBtn = document.getElementById('waveBtn');
  if (waveBtn) waveBtn.classList.add('hidden');

  const customSpawner = document.getElementById('devCustomSpawner');
  if (customSpawner) customSpawner.classList.add('hidden');

  currentLevelSection = Math.min(TOTAL_SECTIONS, Math.max(1, Math.ceil(currentLevel / LEVELS_PER_SECTION)));
  if (typeof modeLevelSections !== 'undefined' && currentLevelMode) {
    modeLevelSections[currentLevelMode] = currentLevelSection;
  }
  gameState = 'LEVELS';
  renderLevelsGrid();
  showLoadoutWidgetIn('loadoutAnchor-levels');
  updateHudSpeedWidget();

  syncTopHudVisibility();
  updateDailyBonusBtnVisibility();
}

// [UI.FI]
function showLevelSelect() {
  stopNormalModePreview();
  music('menu');
  document.getElementById('startScreen').classList.add('hidden');
  _enterLevelSelectView();
}

// [UI.FJ]
function giveUpMatch() {
  const confirmModal = document.getElementById('giveUpConfirmModal');
  if (confirmModal) {
    confirmModal.classList.remove('hidden');
  } else {
    confirmGiveUp();
  }
}

// [UI.FK]
function cancelGiveUp() {
  const confirmModal = document.getElementById('giveUpConfirmModal');
  if (confirmModal) {
    confirmModal.classList.add('hidden');
  }
}

// [UI.FL]
function confirmGiveUp() {
  const confirmModal = document.getElementById('giveUpConfirmModal');
  if (confirmModal) confirmModal.classList.add('hidden');

  if (reviveTimerInterval) { clearInterval(reviveTimerInterval); reviveTimerInterval = null; }
  const settingsSc = document.getElementById('settingsScreen');
  if (settingsSc) settingsSc.classList.add('hidden');
  const pauseSc = document.getElementById('pauseScreen');
  if (pauseSc) pauseSc.classList.add('hidden');

  if (typeof triggerDefeat === 'function') {
    triggerDefeat();
  } else {
    musicSetDucked(false);
    music('lose');
    sfx('defeat');
    gameState = 'DEFEAT';
    document.getElementById('defeatScreen').classList.remove('hidden');
    if (typeof replayDefeatFlash === 'function') replayDefeatFlash();
  }
}

// [UI.FM]
function showLevelSelectFromGame() {
  stopNormalModePreview();
  const curCat = (typeof MusicManager !== 'undefined' && MusicManager.current) ? MusicManager.current() : null;
  if (curCat !== 'win' && curCat !== 'lose') {
    music('menu');
  }

  ['startScreen', 'victoryScreen', 'defeatScreen'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('screen-bg-only');
  });

  ['settingsScreen', 'pauseScreen', 'victoryScreen', 'defeatScreen', 'upgradesScreen', 'reviveScreen'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });

  _enterLevelSelectView();
}

// [UI.FN]
function showLoadoutWidgetIn(anchorId) {
  const widget = document.getElementById('loadoutWidget');
  const anchor = document.getElementById(anchorId);
  if (!widget || !anchor) return;

  refreshLoadoutForProgress();

  if (getLoadoutReferenceLevel() < getLoadoutStartLevel()) {
    widget.classList.add('hidden');
    return;
  }

  anchor.appendChild(widget);
  widget.classList.remove('hidden');
  loadoutWidgetExpanded = false;
  const arrow = document.getElementById('loadoutArrow');
  if (arrow) arrow.textContent = '▾';
  renderLoadoutWidgetBody();
}

// [UI.FO]
function toggleLoadoutWidgetExpanded() {
  loadoutWidgetExpanded = !loadoutWidgetExpanded;
  if (!loadoutWidgetExpanded) {
    refreshLoadoutForProgress();
  }
  const arrow = document.getElementById('loadoutArrow');
  if (arrow) {
    arrow.textContent = loadoutWidgetExpanded ? '▴' : '▾';
  }
  renderLoadoutWidgetBody();
}

// [UI.FP]
function renderLoadoutWidgetBody() {
  const miniIcons = document.getElementById('loadoutWidgetMiniIcons');
  const expandedBox = document.getElementById('loadoutWidgetExpanded');
  const countEl = document.getElementById('loadoutWidgetCount');

  if (countEl) {
    countEl.textContent = `${selectedLoadout.length}/${LOADOUT_SIZE}`;
    countEl.classList.toggle('is-full', selectedLoadout.length >= LOADOUT_SIZE);
    countEl.classList.toggle('hidden', !loadoutWidgetExpanded);
  }

  if (!miniIcons || !expandedBox) return;

  if (loadoutWidgetExpanded) {
    miniIcons.innerHTML = '';
    expandedBox.classList.remove('hidden');
    renderLoadoutWidgetGrid();
  } else {
    const canonicalOrder = Object.keys(TOWER_CONFIGS);
    const orderedLoadout = canonicalOrder.filter(t => selectedLoadout.includes(t));
    miniIcons.innerHTML = orderedLoadout.map(t => {
      return `<span class="loadout-mini-icon">${TOWER_ICONS[t] || ''}</span>`;
    }).join('');
    expandedBox.classList.add('hidden');
  }
}

// [UI.FQ]
function renderLoadoutWidgetGrid() {
  const grid = document.getElementById('loadoutWidgetGrid');
  if (!grid) return;
  const pool = (typeof getPlayerUnlockedTowers === 'function')
    ? getPlayerUnlockedTowers()
    : ['gun'];

  const isFull = selectedLoadout.length >= LOADOUT_SIZE;
  grid.innerHTML = '';
  pool.forEach(type => {
    const conf = TOWER_CONFIGS[type];
    if (!conf) return;
    const isSelected = selectedLoadout.includes(type);
    const btn = document.createElement('div');
    btn.className = 'loadout-tower-btn'
      + (isSelected ? ' selected' : '')
      + (!isSelected && isFull ? ' blocked' : '');
    btn.innerHTML = `
      <div class="tower-btn-icon">${TOWER_ICONS[type] || ''}</div>
      <span class="tower-btn-title">${TOWER_NAMES[type] || type}</span>
    `;
    // [UI.FR]
    btn.onclick = (e) => {
      e.stopPropagation();
      toggleLoadoutWidgetTower(type);
    };
    grid.appendChild(btn);
  });
}

// [UI.FS]
function toggleLoadoutWidgetTower(type) {
  sfx('tap');
  const idx = selectedLoadout.indexOf(type);
  if (idx !== -1) {
    selectedLoadout.splice(idx, 1);
  } else {
    if (selectedLoadout.length >= LOADOUT_SIZE) {
      showHintToast(typeof t === 'function' ? t('deselect_tower_first', { max: LOADOUT_SIZE }) : `Deselect a tower first (${LOADOUT_SIZE} max)`);
      return;
    }
    selectedLoadout.push(type);
  }
  renderLoadoutWidgetBody();
  saveGameSoon();
}

// [UI.FT]
function hasMilestoneForLevel(clearedLevel) {
  return buildMilestoneSteps(clearedLevel).length > 0;
}
window.hasMilestoneForLevel = hasMilestoneForLevel;

// [UI.FV]
function buildFeatureVisualHtml(feature, color) {
  let iconSvg = '';
  if (feature === 'tech_tree') {
    iconSvg = `<svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21 v-5 l-4 -3.5 v-4 m4 7.5 l4 -3.5 v-4 m-4 7.5 v-8"/><circle cx="12" cy="21" r="1.8" fill="${color}"/><circle cx="8" cy="8.5" r="1.8" fill="${color}"/><circle cx="16" cy="8.5" r="1.8" fill="${color}"/><circle cx="12" cy="5" r="1.8" fill="${color}"/></svg>`;
  } else if (feature === 'endless') {
    iconSvg = `<svg width="54" height="36" viewBox="0 0 16 10" fill="none"><path d="M4 2 C1.8 2 1 3.3 1 5 C1 6.7 1.8 8 4 8 C6.8 8 9.2 2 12 2 C14.2 2 15 3.3 15 5 C15 6.7 14.2 8 12 8 C9.2 8 6.8 2 4 2 Z" stroke="${color}" stroke-width="1.6" stroke-linecap="round"/></svg>`;
  } else if (feature === 'hardcore') {
    iconSvg = `<svg width="44" height="44" viewBox="0 0 16 16" fill="${color}"><path d="M8 14.5 L2.8 9.2 C1.2 7.6 1.2 5 3 3.2 C4.5 1.7 6.8 2 7.8 3.6 C8.8 2 11.1 1.7 12.6 3.2 C14.4 5 14.4 7.6 12.8 9.2 Z"/></svg>`;
  } else if (feature === 'ascended') {
    iconSvg = `<svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"><polygon points="12 2 21 12 12 22 3 12" fill="rgba(217,70,239,.3)"/><polyline points="3 12 12 15 21 12"/><line x1="12" y1="2" x2="12" y2="22"/></svg>`;
  } else {
    iconSvg = `<svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="${color}33"/></svg>`;
  }

  return `
    <div class="ms-feature-showcase" style="--feat-col:${color};">
      <div class="ms-feature-orbit"></div>
      <div class="ms-feature-core">${iconSvg}</div>
    </div>`;
}

// [UI.FW]
function buildMilestoneSteps(clearedLevel) {
  const steps = [];
  const nextLvl = clearedLevel + 1;
  const newTowers = getNewlyUnlockedTowers(nextLvl);
  const upgradesUnlockLevel = getLoadoutStartLevel();
  const loadoutJustUnlocked = (nextLvl === upgradesUnlockLevel);
  const _tr = (typeof window.t === 'function') ? window.t : ((k) => k);

  if (clearedLevel === 10) {
    steps.push({
      kicker: _tr('ms_ch1_cleared') || 'CHAPTER 1 CLEARED',
      title: _tr('tech_tree') || 'TECH TREE',
      color: '#00e5ff',
      visual: { kind: 'feature', feature: 'tech_tree' },
      bullets: [
        _tr('ms_tt_bullet_1') || '💎 Spend Diamonds on permanent upgrades',
        _tr('ms_tt_bullet_2') || '⚡ Boost Tower Damage, Speed & Range',
        _tr('ms_tt_bullet_3') || '🛡️ Increase starting Base HP & Gold Bounty'
      ]
    });
  } else if (clearedLevel === 20) {
    steps.push({
      kicker: _tr('ms_new_mode_unlocked') || 'NEW MODE UNLOCKED',
      title: _tr('hardcore') || 'HARDCORE',
      color: '#f05f9f',
      visual: { kind: 'feature', feature: 'hardcore' },
      bullets: [
        _tr('ms_hc_bullet_1') || '💔 1 Base HP — zero margin for error',
        _tr('ms_hc_bullet_2') || '🔥 1.2x faster & Enraged enemies',
        _tr('ms_hc_bullet_3') || '🔮 Earn rare Prisms & massive Diamond loot'
      ]
    });
  } else if (clearedLevel === 30) {
    steps.push({
      kicker: _tr('ms_ch3_cleared') || 'CHAPTER 3 CLEARED',
      title: _tr('ms_ascension') || 'ASCENSION',
      color: '#d946ef',
      visual: { kind: 'feature', feature: 'ascended' },
      bullets: [
        _tr('ms_asc_bullet_1') || '🔮 Ascended Tech Tree (Lv.11–15) unlocked',
        _tr('ms_asc_bullet_2') || '⚡ Unlock infinite SYNTH power scaling',
        _tr('ms_asc_bullet_3') || '🔄 Prism Deconstruction unlocked in Shop'
      ]
    });
  } else if (clearedLevel === 40) {
    steps.push({
      kicker: _tr('ms_ch4_cleared') || 'CHAPTER 4 CLEARED',
      title: _tr('ms_final_chapter') || 'FINAL CHAPTER',
      color: '#00e5ff',
      visual: { kind: 'feature', feature: 'sector' },
      bullets: [
        _tr('ms_ch5_bullet_1') || '⚠️ Chapter 5: Apex Sector unlocked',
        _tr('ms_ch5_bullet_2') || '⚡ EMP Bombers & Overlord Bosses ahead',
        _tr('ms_ch5_bullet_3') || '🏆 Push through to the final Level 50'
      ]
    });
  }

  if (clearedLevel === 15) {
    steps.push({
      kicker: _tr('ms_new_mode_unlocked') || 'NEW MODE UNLOCKED',
      title: _tr('endless') || 'ENDLESS ARENA',
      color: '#d946ef',
      visual: { kind: 'feature', feature: 'endless' },
      bullets: [
        _tr('ms_endless_bullet_1') || '♾️ Survive infinite escalating waves',
        _tr('ms_endless_bullet_2') || '💎 Earn +2 Diamonds for every wave cleared',
        _tr('ms_endless_bullet_3') || '🔮 +1 Prism every 10 waves & record bonuses'
      ]
    });
  }

  newTowers.forEach(type => {
    const conf = TOWER_CONFIGS[type] || {};
    let locBlurbs = [];
    if (typeof I18N_DICT !== 'undefined') {
      const dict = I18N_DICT[currentLang] || I18N_DICT.en || {};
      if (Array.isArray(dict[`tower_blurbs_${type}`])) {
        locBlurbs = dict[`tower_blurbs_${type}`];
      }
    }
    if (!locBlurbs || locBlurbs.length === 0) {
      locBlurbs = Array.isArray(TOWER_UNLOCK_BLURBS[type]) ? TOWER_UNLOCK_BLURBS[type] : [];
    }

    steps.push({
      kicker: _tr('new_tower_unlocked') || 'NEW TOWER UNLOCKED',
      title: (typeof TOWER_NAMES !== 'undefined' && TOWER_NAMES[type]) ? TOWER_NAMES[type] : type,
      color: conf.color || '#00e5ff',
      visual: { kind: 'tower_demo', type },
      bullets: locBlurbs
    });
  });

  if (loadoutJustUnlocked) {
    steps.push({
      kicker: _tr('ms_tactical_deck') || 'TACTICAL DECK',
      title: _tr('ms_loadout_title') || '3-TOWER LOADOUT',
      color: '#f59e0b',
      bullets: [
        (typeof t === 'function') ? t('ms_loadout_bullet_1', { size: LOADOUT_SIZE }) : `🎯 Bring up to ${LOADOUT_SIZE} towers into each battle`,
        _tr('ms_loadout_bullet_2') || '🔄 Swap your active deck before any level'
      ],
      embed: 'loadout'
    });
  }

  return steps;
}

// [UI.FX]
function showMilestoneSequence(clearedLevel, onComplete) {
  milestoneSteps = buildMilestoneSteps(clearedLevel);
  milestoneIndex = 0;
  milestoneOnComplete = onComplete;
  if (milestoneSteps.length === 0) {
    if (onComplete) onComplete();
    return;
  }
  document.getElementById('milestoneScreen').classList.remove('hidden');
  sfx('unlock');
  renderMilestoneStep();
}

// [UI.FY]
function renderMilestoneStep() {
  MilestoneTowerPreview.stop();
  const step = milestoneSteps[milestoneIndex];
  if (!step) return;
  const scr = document.getElementById('milestoneScreen');
  const accentColor = step.color || '#00e5ff';

  const stack = scr.querySelector('.result-stack');
  if (stack) {
    stack.style.setProperty('--ms-accent', accentColor);
  }

  const kickerEl = document.getElementById('milestoneKicker');
  const titleEl = document.getElementById('milestoneTitle');
  if (kickerEl) {
    kickerEl.textContent = step.kicker || ((typeof t === 'function') ? t('unlocked') : 'UNLOCKED');
    kickerEl.style.color = accentColor;
  }
  if (titleEl) {
    titleEl.textContent = step.title || '';
    titleEl.style.textShadow = `0 0 16px ${accentColor}99`;
  }

  const art = document.getElementById('milestoneArt');
  if (art) {
    if (step.visual && step.visual.kind === 'tower_demo') {
      art.innerHTML = buildTowerFiringDemoHtml(step.visual.type);
      art.classList.remove('hidden');
      MilestoneTowerPreview.start(step.visual.type);
    } else if (step.visual && step.visual.kind === 'feature') {
      art.innerHTML = buildFeatureVisualHtml(step.visual.feature, accentColor);
      art.classList.remove('hidden');
    } else {
      art.innerHTML = '';
      art.classList.add('hidden');
    }
  }

  const bodyEl = document.getElementById('milestoneBody');
  if (bodyEl) {
    if (Array.isArray(step.bullets) && step.bullets.length > 0) {
      bodyEl.innerHTML = `<div class="ms-bullet-list">` +
        step.bullets.map((b, i) => `<div class="ms-bullet-chip" style="animation-delay:${(0.12 + i * 0.08).toFixed(2)}s">${b}</div>`).join('') +
        `</div>`;
    } else {
      bodyEl.innerHTML = step.body || '';
    }
  }

  const embed = document.getElementById('milestoneEmbed');
  if (step.embed === 'loadout') {
    embed.classList.remove('hidden');
    renderMilestoneLoadoutGrid();
  } else {
    embed.classList.add('hidden');
  }

  const okBtn = document.getElementById('milestoneOkBtn');
  if (okBtn) {
    const isLast = (milestoneIndex >= milestoneSteps.length - 1);
    const stepIndicator = milestoneSteps.length > 1 ? ` (${milestoneIndex + 1}/${milestoneSteps.length})` : '';
    const btnLabel = isLast 
      ? ((typeof t === 'function') ? t('awesome') : 'AWESOME') 
      : ((typeof t === 'function') ? t('next') : 'NEXT');
    okBtn.innerHTML = `<span>${btnLabel}${stepIndicator}</span>`;
    okBtn.style.borderColor = '';
    okBtn.style.boxShadow = '';
  }

  scr.querySelectorAll('.seq-in, .milestone-art').forEach(el => {
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
  });
}

// [UI.FZ]
function renderMilestoneLoadoutGrid() {
  const grid = document.getElementById('milestoneLoadoutGrid');
  if (!grid) return;
  const ref = Math.min(getLoadoutReferenceLevel(), TOTAL_LEVELS);
  const pool = (LEVELS_DATA[ref] && LEVELS_DATA[ref].unlockedTowers) ? LEVELS_DATA[ref].unlockedTowers : ['gun'];
  const isFull = selectedLoadout.length >= LOADOUT_SIZE;
  grid.innerHTML = '';
  pool.forEach(type => {
    const conf = TOWER_CONFIGS[type];
    if (!conf) return;
    const isSelected = selectedLoadout.includes(type);
    const btn = document.createElement('div');
    btn.className = 'loadout-tower-btn'
      + (isSelected ? ' selected' : '')
      + (!isSelected && isFull ? ' blocked' : '');
    btn.innerHTML = `
      <div class="tower-btn-icon">${TOWER_ICONS[type] || ''}</div>
      <span class="tower-btn-title">${TOWER_NAMES[type] || type}</span>
    `;
    // [UI.GA]
    btn.onclick = (e) => {
      e.stopPropagation();
      toggleLoadoutWidgetTower(type);
      renderMilestoneLoadoutGrid();
    };
    grid.appendChild(btn);
  });
  const hint = document.getElementById('milestoneEmbedHint');
  if (hint) {
    hint.textContent = (typeof t === 'function')
      ? t('loadout_selected_hint', { cur: selectedLoadout.length, max: LOADOUT_SIZE })
      : `${selectedLoadout.length}/${LOADOUT_SIZE} selected — tap a selected tower to free a slot`;
  }
}

// [UI.GB]
function advanceMilestone() {
  MilestoneTowerPreview.stop();
  milestoneIndex++;
  if (milestoneIndex < milestoneSteps.length) {
    renderMilestoneStep();
    return;
  }
  document.getElementById('milestoneScreen').classList.add('hidden');
  const done = milestoneOnComplete;
  milestoneOnComplete = null;
  milestoneSteps = [];
  if (done) done();
}

// [UI.GC]
function showUpgradesScreen(fromSource) {
  const unlockLevel = getLoadoutStartLevel();
  const isUpgradesUnlocked = devMode || getLoadoutReferenceLevel() >= unlockLevel;
  if (!isUpgradesUnlocked) {
    showHintToast(typeof t === 'function' ? t('available_on_level_n', { n: unlockLevel }) : `Will be available on Level ${unlockLevel}`);
    return;
  }

  if (!fromSource) {
    if (gameState === 'VICTORY') fromSource = 'victory';
    else if (gameState === 'DEFEAT') fromSource = 'defeat';
    else if (gameState === 'LEVELS' || !document.getElementById('levelsScreen').classList.contains('hidden')) fromSource = 'levels';
    else fromSource = 'main';
  }
  upgradesPreviousSource = fromSource;
  stopNormalModePreview();

  const bgScreenId = fromSource === 'victory' ? 'victoryScreen'
    : (fromSource === 'defeat' ? 'defeatScreen'
    : (fromSource === 'levels' ? 'levelsScreen' : 'startScreen'));

  ['startScreen', 'victoryScreen', 'pauseScreen', 'levelsScreen', 'settingsScreen', 'defeatScreen', 'reviveScreen']
    .forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.classList.remove('screen-bg-only');
      if (id === bgScreenId) {
        el.classList.remove('hidden');
        el.classList.add('screen-bg-only');
      } else {
        el.classList.add('hidden');
      }
    });

  const controlsWrapper = document.getElementById('controlsWrapper');
  if (controlsWrapper) controlsWrapper.classList.add('hidden');
  const waveBtn = document.getElementById('waveBtn');
  if (waveBtn) waveBtn.classList.add('hidden');
  const devSpawner = document.getElementById('devCustomSpawner');
  if (devSpawner) devSpawner.classList.add('hidden');

  const topHud = document.getElementById('topHud');
  if (topHud) topHud.classList.add('hidden');

  const upg = document.getElementById('upgradesScreen');
  const isResultBg = (bgScreenId === 'victoryScreen' || bgScreenId === 'defeatScreen');
  upg.classList.toggle('from-result', isResultBg);
  upg.classList.toggle('from-main', !isResultBg);
  upg.classList.remove('hidden');
  gameState = 'UPGRADES';
  updateHudSpeedWidget();
  renderUpgradeTree();

  updateDailyBonusBtnVisibility();
}

// [UI.GD]
function closeUpgradesScreen() {
  document.getElementById('upgradesScreen').classList.add('hidden');

  const topHud = document.getElementById('topHud');
  if (topHud) topHud.classList.remove('hidden');

  ['startScreen', 'victoryScreen', 'defeatScreen', 'levelsScreen', 'pauseScreen', 'settingsScreen'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('screen-bg-only');
  });

  if (upgradesPreviousSource === 'victory') {
    document.getElementById('victoryScreen').classList.remove('hidden');
    gameState = 'VICTORY';
  } else if (upgradesPreviousSource === 'defeat') {
    document.getElementById('defeatScreen').classList.remove('hidden');
    gameState = 'DEFEAT';
  } else if (upgradesPreviousSource === 'levels') {
    document.getElementById('levelsScreen').classList.remove('hidden');
    gameState = 'LEVELS';
    startModeBattlePreview(currentLevelMode);
  } else {
    document.getElementById('startScreen').classList.remove('hidden');
    gameState = 'START';
  }

  syncTopHudVisibility();
  updateDailyBonusBtnVisibility();
}

// [UI.GE]
function showShopScreen(fromSource) {
  if (!fromSource) {
    if (gameState === 'VICTORY') fromSource = 'victory';
    else if (gameState === 'DEFEAT') fromSource = 'defeat';
    else fromSource = 'start';
  }
  shopPreviousSource = fromSource;

  const bgScreenId = fromSource === 'victory' ? 'victoryScreen'
    : (fromSource === 'defeat' ? 'defeatScreen' : 'startScreen');

  ['startScreen', 'victoryScreen', 'defeatScreen', 'levelsScreen', 'pauseScreen', 'settingsScreen', 'upgradesScreen']
    .forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.classList.remove('screen-bg-only');
      if (id === bgScreenId) {
        el.classList.remove('hidden');
        el.classList.add('screen-bg-only');
      } else {
        el.classList.add('hidden');
      }
    });

  const controlsWrapper = document.getElementById('controlsWrapper');
  if (controlsWrapper) controlsWrapper.classList.add('hidden');
  const waveBtn = document.getElementById('waveBtn');
  if (waveBtn) waveBtn.classList.add('hidden');
  const topHud = document.getElementById('topHud');
  if (topHud) topHud.classList.add('hidden');

  const shopEl = document.getElementById('shopScreen');
  const isResultBg = (bgScreenId === 'victoryScreen' || bgScreenId === 'defeatScreen');
  shopEl.classList.toggle('from-result', isResultBg);
  shopEl.classList.toggle('from-main', !isResultBg);
  shopEl.classList.remove('hidden');
  gameState = 'SHOP';

  updateHudSpeedWidget();
  renderShopScreen();

  updateDailyBonusBtnVisibility();
}

// [UI.GF]
function closeShopScreen() {
  document.getElementById('shopScreen').classList.add('hidden');

  const topHud = document.getElementById('topHud');
  if (topHud) topHud.classList.remove('hidden');

  ['startScreen', 'victoryScreen', 'defeatScreen'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('screen-bg-only');
  });

  if (shopPreviousSource === 'victory') {
    document.getElementById('victoryScreen').classList.remove('hidden');
    gameState = 'VICTORY';
  } else if (shopPreviousSource === 'defeat') {
    document.getElementById('defeatScreen').classList.remove('hidden');
    gameState = 'DEFEAT';
  } else {
    document.getElementById('startScreen').classList.remove('hidden');
    gameState = 'START';
  }

  syncTopHudVisibility();
  updateDailyBonusBtnVisibility();
}

// [UI.GG]
function renderShopScreen() {
    checkDailyGiftReset();
    updateMenuBadges();
    const shopBody = document.getElementById('shopBodyList');
    if (shopBody) enablePointerScroll(shopBody);
    const diamondLabel = document.getElementById('shopDiamondVal');
    if (diamondLabel) diamondLabel.textContent = diamonds;
    const prismLabel = document.getElementById('shopPrismVal');
    if (prismLabel) prismLabel.textContent = prisms;

    const giftTitle = document.getElementById('dailyGiftTitleText');
    const giftSub = document.getElementById('dailyGiftSubText');
    const giftBtn = document.getElementById('dailyGiftClaimBtn');
    const _tr = (typeof window.t === 'function') ? window.t : ((k) => k);

    if (giftTitle) {
        if (dailyGiftsClaimedCount === 0) {
            giftTitle.innerHTML = `+10 ${getDailyDiamondSvg(14)}`;
        } else if (dailyGiftsClaimedCount === 1) {
            giftTitle.innerHTML = `+15 ${getDailyDiamondSvg(14)}`;
        } else if (dailyGiftsClaimedCount === 2) {
            giftTitle.innerHTML = `+20 ${getDailyDiamondSvg(14)} + 1 ${getDailyPrismSvg(14)}`;
        } else {
            giftTitle.textContent = (typeof t === 'function') ? t('daily_gifts_completed') : 'Daily Gifts Completed';
        }
    }

    if (giftSub) {
        if (dailyGiftsClaimedCount === 0) {
            giftSub.innerHTML = (typeof t === 'function')
                ? t('next_pack_diamonds', { d: 10, icon: getDailyDiamondSvg(12), cur: 1, max: 3 })
                : `Next pack: 10 ${getDailyDiamondSvg(12)} (1/3)`;
        } else if (dailyGiftsClaimedCount === 1) {
            giftSub.innerHTML = (typeof t === 'function')
                ? t('next_pack_diamonds', { d: 15, icon: getDailyDiamondSvg(12), cur: 2, max: 3 })
                : `Next pack: 15 ${getDailyDiamondSvg(12)} (2/3)`;
        } else if (dailyGiftsClaimedCount === 2) {
            giftSub.innerHTML = (typeof t === 'function')
                ? t('next_pack_combo', { d: 20, dIcon: getDailyDiamondSvg(12), p: 1, pIcon: getDailyPrismSvg(12) })
                : `Next pack: 20 ${getDailyDiamondSvg(12)} + 1 ${getDailyPrismSvg(12)}`;
        } else {
            giftSub.textContent = (typeof t === 'function')
                ? t('claimed_today_packs', { cur: 3, max: 3 })
                : 'Claimed today: 3/3 packs';
        }
    }

    if (giftBtn) {
        if (dailyGiftsClaimedCount >= 3) {
            giftBtn.disabled = true;
            giftBtn.className = 'shop-item-btn shop-btn-claimed';
            giftBtn.innerHTML = `<span>${_tr('claimed')}</span>`;
        } else if (dailyGiftsClaimedCount === 0) {
            giftBtn.disabled = false;
            giftBtn.className = 'shop-item-btn shop-btn-free';
            giftBtn.innerHTML = `<span>${_tr('free')}</span>`;
        } else {
            giftBtn.disabled = false;
            giftBtn.className = 'shop-item-btn shop-btn-ad';
            giftBtn.innerHTML = `<svg width="16" height="13" viewBox="0 0 16 13" fill="none" style="flex:none; margin-right:4px;"><rect x="0.8" y="0.8" width="14.4" height="11.4" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.6"/><polygon points="6,3.5 11,6.5 6,9.5" fill="currentColor"/></svg><span>${_tr('watch_ad')}</span>`;
        }
    }

    const lockSvg = (typeof CUSTOM_LOCK_SVG !== 'undefined')
        ? CUSTOM_LOCK_SVG
        : `<svg width="12" height="12" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="flex:none;"><path d="M 7,10 V 6 C 7,3.5 9,2 12,2 C 15,2 17,3.5 17,6 V 10"/><rect x="4" y="10" width="16" height="12" rx="3" fill="currentColor" fill-opacity="0.2"/></svg>`;

    // --- Currency Exchange (обе кнопки заблокированы до 21 уровня Normal) ---
    const isExchangeUnlocked = (typeof devMode !== 'undefined' && devMode) ||
        (typeof maxUnlockedLevel !== 'undefined' && maxUnlockedLevel >= 21) ||
        (typeof clearedLevels !== 'undefined' && clearedLevels.includes(20));

    const synthBtn = document.getElementById('synthPrismBtn');
    const synthCard = document.getElementById('synthPrismCard') || (synthBtn ? synthBtn.closest('.shop-card') : null);
    if (synthBtn) {
        if (!isExchangeUnlocked) {
            if (synthCard) synthCard.classList.add('locked-item');
            synthBtn.disabled = false;
            synthBtn.className = 'shop-item-btn locked-buy';
            synthBtn.innerHTML = `<span style="display:inline-flex; align-items:center; justify-content:center; gap:3px;">${lockSvg} <span style="font-size:11px; font-weight:900;">L21</span></span>`;
            synthBtn.onclick = () => {
                if (typeof sfx === 'function') sfx('denied');
                if (typeof showHintToast === 'function') {
                    showHintToast(typeof t === 'function' ? t('unlocks_on_level_n', { n: 21 }) : 'Unlocks on Level 21');
                }
            };
        } else {
            if (synthCard) synthCard.classList.remove('locked-item');
            const hasEnoughDiamonds = diamonds >= 20;
            synthBtn.disabled = !hasEnoughDiamonds;
            synthBtn.className = `shop-item-btn shop-btn-buy shop-btn-exchange${hasEnoughDiamonds ? '' : ' dimmed'}`;
            synthBtn.innerHTML = `<span style="display:inline-flex; align-items:center; justify-content:center; gap:4px;">${getDailyDiamondSvg(12)} 20</span>`;
            synthBtn.onclick = () => synthesizePrism();
        }
    }

    const deconstructBtn = document.getElementById('deconstructPrismBtn');
    const deconstructCard = document.getElementById('deconstructPrismCard') || (deconstructBtn ? deconstructBtn.closest('.shop-card') : null);
    if (deconstructBtn) {
        if (!isExchangeUnlocked) {
            if (deconstructCard) deconstructCard.classList.add('locked-item');
            deconstructBtn.disabled = false;
            deconstructBtn.className = 'shop-item-btn locked-buy';
            deconstructBtn.innerHTML = `<span style="display:inline-flex; align-items:center; justify-content:center; gap:3px;">${lockSvg} <span style="font-size:11px; font-weight:900;">L21</span></span>`;
            deconstructBtn.onclick = () => {
                if (typeof sfx === 'function') sfx('denied');
                if (typeof showHintToast === 'function') {
                    showHintToast(typeof t === 'function' ? t('unlocks_on_level_n', { n: 21 }) : 'Unlocks on Level 21');
                }
            };
        } else {
            if (deconstructCard) deconstructCard.classList.remove('locked-item');
            const hasEnoughPrisms = prisms >= 1;
            deconstructBtn.disabled = !hasEnoughPrisms;
            deconstructBtn.className = `shop-item-btn shop-btn-buy shop-btn-prism shop-btn-exchange${hasEnoughPrisms ? '' : ' dimmed'}`;
            deconstructBtn.innerHTML = `<span style="display:inline-flex; align-items:center; justify-content:center; gap:4px;">${getDailyPrismSvg(12)} 1</span>`;
            deconstructBtn.onclick = () => deconstructPrism();
        }
    }

    // --- Обновление состояния кнопок тем ---
    const themesConfig = [
        { id: 'bio_venom', cost: 150, btnId: 'themeBtn-bio_venom' },
        { id: 'sakura_wave', cost: 200, btnId: 'themeBtn-sakura_wave' },
        { id: 'solar_inferno', cost: 300, btnId: 'themeBtn-solar_inferno' }
    ];

    themesConfig.forEach(tConf => {
        const btn = document.getElementById(tConf.btnId);
        if (!btn) return;
        const isOwned = Boolean(unlockedPalettes && unlockedPalettes.includes(tConf.id));
        const isActive = activePalette === tConf.id;

        if (isActive) {
            btn.disabled = true;
            btn.className = 'shop-item-btn shop-btn-claimed';
            btn.innerHTML = `<span>${_tr('equipped')}</span>`;
        } else if (isOwned) {
            btn.disabled = false;
            btn.className = 'shop-item-btn shop-btn-free';
            btn.innerHTML = `<span>${_tr('equip')}</span>`;
        } else {
            const canAfford = diamonds >= tConf.cost;
            btn.disabled = !canAfford;
            btn.className = `shop-item-btn shop-btn-buy${canAfford ? '' : ' dimmed'}`;
            btn.innerHTML = `<span style="display:inline-flex; align-items:center; justify-content:center; gap:4px;">${getDailyDiamondSvg(12)} ${tConf.cost}</span>`;
        }
    });

    // --- Time Modulation Perks State ---
    const t1Btn = document.getElementById('shopPerkTimeT1Btn') || document.getElementById('timeModT1Btn');
    const t1Card = document.getElementById('shopPerkTimeT1Card') || (t1Btn ? t1Btn.closest('.shop-card') : null);
    if (t1Btn) {
        if (timeModTier >= 1) {
            t1Btn.disabled = true;
            t1Btn.className = 'shop-item-btn shop-btn-claimed';
            t1Btn.textContent = _tr('owned');
            if (t1Card) t1Card.classList.remove('locked-item');
        } else {
            const canAffordT1 = diamonds >= 50;
            t1Btn.disabled = !canAffordT1;
            t1Btn.className = `shop-item-btn shop-btn-buy${canAffordT1 ? '' : ' dimmed'}`;
            t1Btn.innerHTML = `<span style="display:inline-flex; align-items:center; justify-content:center; gap:4px;">${getDailyDiamondSvg(12)} 50</span>`;
            if (t1Card) t1Card.classList.remove('locked-item');
        }
    }

    const t2Btn = document.getElementById('shopPerkTimeT2Btn') || document.getElementById('timeModT2Btn');
    const t2Card = document.getElementById('shopPerkTimeT2Card') || (t2Btn ? t2Btn.closest('.shop-card') : null);
    if (t2Btn) {
        if (timeModTier >= 2) {
            t2Btn.disabled = true;
            t2Btn.className = 'shop-item-btn shop-btn-claimed';
            t2Btn.textContent = _tr('owned');
            t2Btn.onclick = () => buyShopIAP('time_mod_t2');
            if (t2Card) t2Card.classList.remove('locked-item');
        } else if (timeModTier < 1) {
            t2Btn.disabled = false; // Оставляем кликабельной для вывода toast
            t2Btn.className = 'shop-item-btn locked-buy';
            const reqLabel = (typeof t === 'function' ? t('tier_1_required') : 'TIER 1<br>REQUIRED');
            t2Btn.innerHTML = `<span style="display:inline-flex; align-items:center; justify-content:center; gap:3px; text-align:center; font-size:9px; line-height:1.15;">${lockSvg} <span>${reqLabel}</span></span>`;
            t2Btn.onclick = () => {
                if (typeof sfx === 'function') sfx('denied');
                if (typeof showHintToast === 'function') {
                    showHintToast(typeof t === 'function' ? t('unlock_tier_1_first') : 'Unlock Tier 1 first!');
                }
            };
            if (t2Card) t2Card.classList.add('locked-item');
        } else {
            const canAffordT2 = diamonds >= 200;
            t2Btn.disabled = !canAffordT2;
            t2Btn.className = `shop-item-btn shop-btn-buy${canAffordT2 ? '' : ' dimmed'}`;
            t2Btn.innerHTML = `<span style="display:inline-flex; align-items:center; justify-content:center; gap:4px;">${getDailyDiamondSvg(12)} 200</span>`;
            t2Btn.onclick = () => buyShopIAP('time_mod_t2');
            if (t2Card) t2Card.classList.remove('locked-item');
        }
    }
}

// --- Daily Login 7-Day Calendar Logic ---
// [UI.GH]
function checkDailyLoginState() {
  const todayStr = getTodayDateString();
  return lastLoginClaimDate === todayStr;
}

// [UI.GI]
function updateMenuBadges() {
  const dailyBadge = document.getElementById('dailyBonusBadgeDot') || document.getElementById('dailyCalendarBadge');
  if (dailyBadge) {
    const isClaimedToday = checkDailyLoginState();
    dailyBadge.classList.toggle('hidden', isClaimedToday);
  }

  const bpBadge = document.getElementById('startBpBadgeDot');
  if (bpBadge) {
    let hasUnclaimed = false;
    if (typeof getBpTierInfo === 'function' && typeof BATTLE_PASS_TIERS !== 'undefined') {
      const { tier } = getBpTierInfo(bpXp);
      for (let t = 1; t <= tier; t++) {
        if (!bpClaimedFree[t]) { hasUnclaimed = true; break; }
        if (bpPremiumPurchased && !bpClaimedPrem[t]) { hasUnclaimed = true; break; }
      }
    }
    bpBadge.classList.toggle('hidden', !hasUnclaimed);
  }

  const shopBadge = document.getElementById('shopBadgeDot');
  if (shopBadge) {
    const hasUnclaimedGifts = (typeof dailyGiftsClaimedCount !== 'undefined') ? (dailyGiftsClaimedCount < 3) : false;
    shopBadge.classList.toggle('hidden', !hasUnclaimedGifts);
  }
}

// [UI.GJ]
function getDailyDiamondSvg(size = 20, opacity = 1) {
  const th = getTheme();
  const c1Rgb = th.rgb1 ? th.rgb1.cssRgb : '0, 229, 255';
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${th.c1}" stroke-width="2" stroke-linejoin="round"${opacity < 1 ? ` style="opacity:${opacity};"` : ''}><polygon points="6 3 18 3 22 9 12 22 2 9" fill="rgba(${c1Rgb}, 0.28)"/><polyline points="2 9 12 13 22 9"/><line x1="12" y1="22" x2="12" y2="13"/></svg>`;
}

// [UI.GK]
function getDailyPrismSvg(size = 20, opacity = 1) {
  const th = getTheme();
  const c2Rgb = th.rgb2 ? th.rgb2.cssRgb : '217, 70, 239';
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${th.c2}" stroke-width="2" stroke-linejoin="round"${opacity < 1 ? ` style="opacity:${opacity};"` : ''}><polygon points="12 2 21 12 12 22 3 12" fill="rgba(${c2Rgb}, 0.35)"/><line x1="12" y1="2" x2="12" y2="22"/><polyline points="3 12 12 15 21 12" fill="none"/></svg>`;
}

// [UI.GL]
function renderDailyLoginModal() {
  const grid = document.getElementById('dailyCalendarGrid');
  if (!grid) return;
  grid.innerHTML = '';

  const isClaimedToday = checkDailyLoginState();
  const lastClaimedDay = isClaimedToday ? (loginStreakDay === 1 ? 7 : loginStreakDay - 1) : (loginStreakDay - 1);

  const trackEl = document.getElementById('dailyStreakTrack');
  if (trackEl) {
    const th = getTheme();
    const c1Rgb = th.rgb1 ? th.rgb1.cssRgb : '0, 229, 255';
    const c2Rgb = th.rgb2 ? th.rgb2.cssRgb : '217, 70, 239';
    const doneCol = th.c1;
    const doneBg = `rgba(${c1Rgb}, 0.22)`;
    const actCol = th.c2;
    const actBg = `rgba(${c2Rgb}, 0.25)`;
    const day7FutCol = th.c3;
    const day7FutBg = `rgba(${th.rgb3 ? th.rgb3.cssRgb : '240, 95, 159'}, 0.2)`;

    const activeStreakDay = isClaimedToday ? (loginStreakDay === 1 ? 7 : loginStreakDay - 1) : loginStreakDay;
    let trackNodesHtml = '';

    trackNodesHtml += `<line x1="18" y1="16" x2="262" y2="16" stroke="#1e293b" stroke-width="2.5"/>`;

    const activeX = 18 + (activeStreakDay - 1) * 40.66;
    if (activeX > 18) {
      trackNodesHtml += `<line x1="18" y1="16" x2="${activeX}" y2="16" stroke="${doneCol}" stroke-width="2.5"/>`;
    }

    for (let d = 1; d <= 7; d++) {
      const cx = 18 + (d - 1) * 40.66;
      let nodeClaimed = false;
      let nodeActive = false;

      if (isClaimedToday) {
        if (d <= lastClaimedDay || lastClaimedDay === 7) nodeClaimed = true;
      } else {
        if (d < loginStreakDay) nodeClaimed = true;
        else if (d === loginStreakDay) nodeActive = true;
      }

      if (d < 7) {
        if (nodeClaimed) {
          trackNodesHtml += `<circle cx="${cx}" cy="16" r="6" fill="${doneBg}" stroke="${doneCol}" stroke-width="1.8"/>`;
          trackNodesHtml += `<path d="M ${cx - 2.5},16 L ${cx - 0.5},18 L ${cx + 3},14" fill="none" stroke="${doneCol}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`;
        } else if (nodeActive) {
          trackNodesHtml += `<circle cx="${cx}" cy="16" r="8" fill="${actBg}" stroke="${actCol}" stroke-width="2.2"/>`;
          trackNodesHtml += `<circle cx="${cx}" cy="16" r="3" fill="#ffffff"/>`;
        } else {
          trackNodesHtml += `<circle cx="${cx}" cy="16" r="5" fill="#0b1324" stroke="#334155" stroke-width="1.5"/>`;
        }
      } else {
        if (nodeClaimed) {
          trackNodesHtml += `<polygon points="${cx},9 ${cx+7},16 ${cx},23 ${cx-7},16" fill="${doneBg}" stroke="${doneCol}" stroke-width="1.8"/>`;
          trackNodesHtml += `<path d="M ${cx - 2.5},16 L ${cx - 0.5},18 L ${cx + 3},14" fill="none" stroke="${doneCol}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`;
        } else if (nodeActive) {
          trackNodesHtml += `<polygon points="${cx},8 ${cx+8},16 ${cx},24 ${cx-8},16" fill="${actBg}" stroke="${actCol}" stroke-width="2.2"/>`;
          trackNodesHtml += `<circle cx="${cx}" cy="16" r="3" fill="#ffffff"/>`;
        } else {
          trackNodesHtml += `<polygon points="${cx},10 ${cx+6},16 ${cx},22 ${cx-6},16" fill="${day7FutBg}" stroke="${day7FutCol}" stroke-width="1.6"/>`;
        }
      }
    }

    trackEl.innerHTML = `
      <svg width="280" height="32" viewBox="0 0 280 32" style="display:block; margin:auto;">
        ${trackNodesHtml}
      </svg>
      <div class="daily-streak-sub">${t('day_n_of_7', { n: activeStreakDay })}</div>
    `;
  }

  DAILY_LOGIN_REWARDS.forEach(item => {
    const d = item.day;
    const isDay7 = (d === 7);
    const card = document.createElement('div');

    let isClaimed = false;
    let isActive = false;
    let isFuture = false;

    if (isClaimedToday) {
      if (d <= lastClaimedDay || (lastClaimedDay === 7)) {
        isClaimed = true;
      } else {
        isFuture = true;
      }
    } else {
      if (d < loginStreakDay) {
        isClaimed = true;
      } else if (d === loginStreakDay) {
        isActive = true;
      } else {
        isFuture = true;
      }
    }

    const iconOpacity = isClaimed ? 0.35 : 1.0;

    if (isDay7) {
      card.className = `daily-card day7-card${isClaimed ? ' claimed' : ''}${isActive ? ' active' : ''}${isFuture ? ' future' : ''}`;

      let statusBadge = '';
      if (isClaimed) {
        const th = getTheme();
        statusBadge = `<div class="daily-check-pill"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${th.c1}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>`;
      }

      card.innerHTML = `
        <div class="day7-left">
          <div class="day7-badge">${t('grand_bonus')}</div>
          <div class="day7-title">${t('day_n', { n: 7 })}</div>
          ${statusBadge}
        </div>
        <div class="day7-right">
          <div class="day7-capsule diamond-capsule">
            ${getDailyDiamondSvg(18, iconOpacity)}
            <span class="day7-val">+50</span>
          </div>
          <span class="day7-plus">+</span>
          <div class="day7-capsule prism-capsule">
            ${getDailyPrismSvg(18, iconOpacity)}
            <span class="day7-val">+10</span>
          </div>
        </div>
      `;
    } else if (d === 5) {
      card.className = `daily-card day5-card${isClaimed ? ' claimed' : ''}${isActive ? ' active' : ''}${isFuture ? ' future' : ''}`;

      let topBadge = '';
      if (isActive) {
        topBadge = `<div class="daily-today-badge">${t('today')}</div>`;
      }

      let bottomBadge = '';
      if (isClaimed) {
        const th = getTheme();
        bottomBadge = `<div class="daily-check-pill"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${th.c1}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>`;
      }

      card.innerHTML = `
        ${topBadge}
        <span class="daily-card-num">${t('day_n', { n: 5 })}</span>
        <div class="daily-dual-wrap">
          <div class="daily-dual-side">
            ${getDailyDiamondSvg(16, iconOpacity)}
            <span class="daily-dual-val">+40</span>
          </div>
          <span class="daily-dual-plus">+</span>
          <div class="daily-dual-side">
            ${getDailyPrismSvg(16, iconOpacity)}
            <span class="daily-dual-val">+2</span>
          </div>
        </div>
        ${bottomBadge}
      `;
    } else {
      card.className = `daily-card${isClaimed ? ' claimed' : ''}${isActive ? ' active' : ''}${isFuture ? ' future' : ''}`;

      let topBadge = '';
      if (isActive) {
        topBadge = `<div class="daily-today-badge">${t('today')}</div>`;
      }

      let rewardIcon = item.prisms > 0 ? getDailyPrismSvg(22, iconOpacity) : getDailyDiamondSvg(22, iconOpacity);
      let rewardValText = item.prisms > 0 ? `+${item.prisms}` : `+${item.diamonds}`;

      let bottomBadge = '';
      if (isClaimed) {
        const th = getTheme();
        bottomBadge = `<div class="daily-check-pill"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${th.c1}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>`;
      }

      card.innerHTML = `
        ${topBadge}
        <span class="daily-card-num">${t('day_n', { n: d })}</span>
        <div class="daily-card-icon-wrap">${rewardIcon}</div>
        <span class="daily-card-val">${rewardValText}</span>
        ${bottomBadge}
      `;
    }

    grid.appendChild(card);
  });

  const normalBtn = document.getElementById('dailyLoginClaimNormalBtn');
  const doubleBtn = document.getElementById('dailyLoginClaimDoubleBtn');
  const doubleLabel = document.getElementById('dailyClaimDoubleLabel');
  const adIcon = document.getElementById('dailyDoubleAdIcon');

  if (isClaimedToday) {
    if (normalBtn) {
      normalBtn.disabled = true;
      normalBtn.innerHTML = `<span>${t('claimed_today')}</span>`;
    }
    if (doubleBtn) {
      doubleBtn.disabled = true;
      doubleBtn.style.display = 'none';
    }
  } else {
    if (normalBtn) {
      normalBtn.disabled = false;
      normalBtn.innerHTML = `<span>${t('claim')}</span>`;
    }
    if (doubleBtn) {
      doubleBtn.disabled = false;
      doubleBtn.style.display = 'flex';
      if (doubleLabel) doubleLabel.textContent = (typeof t === 'function' ? t('claim_x2') : 'CLAIM x2');
      if (adIcon) {
        adIcon.style.display = 'inline-block';
        adIcon.outerHTML = `<svg id="dailyDoubleAdIcon" width="18" height="15" viewBox="0 0 16 13" fill="none" style="flex:none; margin-right:6px;"><rect x="0.8" y="0.8" width="14.4" height="11.4" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.6"/><polygon points="6,3.5 11,6.5 6,9.5" fill="currentColor"/></svg>`;
      }
    }
  }
}

// [UI.GM]
function openDailyLoginModal() {
  const modal = document.getElementById('dailyLoginModal');
  if (!modal) return;
  modal.classList.remove('hidden');
  renderDailyLoginModal();
  sfx('confirm');

  updateDailyBonusBtnVisibility();
}

// [UI.GN]
function closeDailyLoginModal() {
  dailyLoginDismissedThisSession = true;
  const modal = document.getElementById('dailyLoginModal');
  if (modal) modal.classList.add('hidden');

  updateDailyBonusBtnVisibility();
}

// [UI.GO]
function claimDailyLoginReward(isDouble) {
  if (checkDailyLoginState()) {
    showHintToast(typeof t === 'function' ? t('already_claimed_today') : 'Already claimed today!');
    return;
  }

  const currentReward = DAILY_LOGIN_REWARDS[loginStreakDay - 1];
  if (!currentReward) return;

  // [UI.GP]
  const executeGrantReward = () => {
    const mult = isDouble ? 2 : 1;
    const addDiamonds = currentReward.diamonds * mult;
    const addPrisms = currentReward.prisms * mult;

    diamonds += addDiamonds;
    prisms += addPrisms;
    lastLoginClaimDate = getTodayDateString();
    const claimedDay = loginStreakDay;
    loginStreakDay = (loginStreakDay % 7) + 1;

    updateDiamondUI();
    if (typeof updatePrismUI === 'function') updatePrismUI();
    saveGame();
    sfx('reward');

    updateMenuBadges();
    renderDailyLoginModal();

    let toastText = isDouble 
      ? ((typeof t === 'function') ? t('x2_bonus_prefix') : 'x2 Bonus: ') 
      : ((typeof t === 'function') ? t('day_n_prefix', { n: claimedDay }) : `Day ${claimedDay}: `);
    const parts = [];
    const diaWord = (typeof t === 'function' && t('diamonds_word')) ? t('diamonds_word') : ((typeof t === 'function' && t('diamonds_upper')) ? t('diamonds_upper').toLowerCase() : 'diamonds');
    const prismWord = (typeof t === 'function' && t('prisms_word')) ? t('prisms_word') : 'prisms';
    if (addDiamonds > 0) parts.push(`+${addDiamonds} ${diaWord}`);
    if (addPrisms > 0) parts.push(`+${addPrisms} ${prismWord}`);
    toastText += parts.join(' ');
    showHintToast(toastText);

    closeDailyLoginModal();
  };

  if (isDouble) {
    showAdPlaceholder(executeGrantReward, null);
  } else {
    executeGrantReward();
  }
}

// [UI.GQ]
function renderVictoryStars(starsCount) {
  const row = document.getElementById('victoryStarsRow');
  if (!row) return;
  row.innerHTML = '';

  if (isOverdriveMode) {
    const isHyperion = (typeof activePalette !== 'undefined' && activePalette === 'matrix_green');
    const starStroke = isHyperion ? '#3b82f6' : '#00e5ff';
    const starGlow = isHyperion ? 'rgba(59, 130, 246, 0.95)' : 'rgba(0, 229, 255, 0.95)';
    const slot = document.createElement('span');
    slot.className = 'star-slot filled overdrive-victory-badge';
    setTimeout(() => sfx('star'), 160);
    slot.innerHTML = `
      <svg width="96" height="76" viewBox="0 0 48 38" fill="none" style="filter: drop-shadow(0 0 16px ${starGlow}) drop-shadow(0 0 32px rgba(240, 95, 159, 0.65));">
        <g transform="translate(1.5, 19.5) scale(0.18)">
          <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" 
            fill="#ffffff" stroke="#ffffff" stroke-width="2" stroke-linejoin="round" style="filter: drop-shadow(0 0 4px #ffffff);"/>
        </g>
        <g transform="translate(42.5, 19.5) scale(0.18)">
          <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" 
            fill="#ffffff" stroke="#ffffff" stroke-width="2" stroke-linejoin="round" style="filter: drop-shadow(0 0 4px #ffffff);"/>
        </g>
        <g transform="translate(12, 4) scale(1.0)">
          <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" 
            fill="#f05f9f" stroke="${starStroke}" stroke-width="1.6" stroke-linejoin="round"/>
        </g>
        <g transform="translate(21.8, 14.5) scale(0.18)">
          <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" 
            fill="#ffffff" stroke="#ffffff" stroke-width="2" stroke-linejoin="round" style="filter: drop-shadow(0 0 6px #ffffff);"/>
        </g>
      </svg>`;
    row.appendChild(slot);
    return;
  }

  for (let s = 1; s <= 3; s++) {
    const isFilled = s <= starsCount;
    const slot = document.createElement('span');
    slot.className = `star-slot ${isFilled ? 'filled' : 'empty'}`;
    if (isFilled) setTimeout(() => sfx('star'), 160 + (s - 1) * 180);
    slot.innerHTML = `
      <svg viewBox="0 0 24 24">
        <polygon points="12,2 15.1,8.6 22,9.6 17,14.6 18.2,21.6 12,18.3 5.8,21.6 7,14.6 2,9.6 8.9,8.6"
          fill="${isFilled ? '#f59e0b' : 'rgba(16,21,40,.7)'}"
          stroke="${isFilled ? '#f59e0b' : '#334155'}"
          stroke-width="1.8"
          stroke-linejoin="round" />
      </svg>`;
    row.appendChild(slot);
  }
}
