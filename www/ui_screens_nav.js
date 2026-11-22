// Synth Wave Defense — ui_screens_nav.js (Tech Tree, Levels/Modes, Endless Dashboard, Start Menu, Settings/Pause)

// [UI.BT]
function getUpgradeStatSummary(key, currentLvl) {
  const curEff = typeof getUpgradeEffectiveLevel === 'function' ? getUpgradeEffectiveLevel(key) : currentLvl;
  const isMaxed = currentLvl >= 15 && typeof isScalingBranch === 'function' && !isScalingBranch(key);

  const nextEff = (function() {
    const nextLvl = currentLvl + 1;
    if (nextLvl <= 10) return nextLvl;
    if (nextLvl <= 15) return nextLvl === 15 ? 16.5 : nextLvl;
    if (key === 'base_hp') return 16.5 + (nextLvl - 15);
    const k = nextLvl - 15;
    return 16.5 + 20 * (1 - Math.pow(0.95, k));
  })();
  const deltaEff = Math.max(0, nextEff - curEff);

  const _tr = (typeof window.t === 'function') ? window.t : ((k) => k.toUpperCase());
  const maxLabel = _tr('max') || 'MAX';
  const hpLabel = _tr('stat_hp') || 'HP:';
  const goldLabel = _tr('stat_gold') || 'GOLD:';
  const slowLabel = _tr('stat_slow') || 'SLOW:';
  const durLabel = _tr('stat_dur') || 'DUR:';
  const rngLabel = _tr('stat_rng') || 'RNG:';
  const dmgLabel = _tr('stat_dmg') || 'DMG:';
  const spdLabel = _tr('stat_spd') || 'SPD:';
  const dpsLabel = _tr('stat_dps') || 'DPS:';

  if (key === 'base_hp') {
    const curHp = 10 + Math.round(curEff);
    const nextTag = isMaxed ? `<span class="upg-stat-next">${maxLabel}</span>` : `<span class="upg-stat-next">+1 ${hpLabel.replace(':', '')}</span>`;
    return `<span class="upg-stat-cur"><span class="upg-lbl">${hpLabel}</span> ${curHp}</span>${nextTag}`;
  }

  if (key === 'base_gold') {
    const curGold = Math.round(curEff * 5);
    const stepGold = +(deltaEff * 5).toFixed(1);
    const nextTag = isMaxed ? `<span class="upg-stat-next">${maxLabel}</span>` : `<span class="upg-stat-next">+${stepGold}%</span>`;
    return `<span class="upg-stat-cur"><span class="upg-lbl">${goldLabel}</span> +${curGold}%</span>${nextTag}`;
  }

  const towerType = key.replace('_power', '');
  const conf = (typeof TOWER_CONFIGS !== 'undefined') ? TOWER_CONFIGS[towerType] : null;
  if (!conf) return '';

  const curRangeBonus = (typeof getUpgradeRangeBonus === 'function')
    ? getUpgradeRangeBonus(towerType, curEff)
    : (curEff <= 10 ? curEff * (conf.powerRange || 0) : 10 * (conf.powerRange || 0) + (curEff - 10) * 0.01);

  const nextRangeBonus = (typeof getUpgradeRangeBonus === 'function')
    ? getUpgradeRangeBonus(towerType, nextEff)
    : (nextEff <= 10 ? nextEff * (conf.powerRange || 0) : 10 * (conf.powerRange || 0) + (nextEff - 10) * 0.01);

  const curRng = Math.round(conf.range * (1 + curRangeBonus));
  const rngStep = Math.round((nextRangeBonus - curRangeBonus) * 100);
  const dStep = Math.round(deltaEff * (conf.powerDmg || 0) * 100);
  const rStep = Math.round(deltaEff * (conf.powerRate || 0) * 100);

  if (towerType === 'stasis') {
    const baseSlow = conf.slowFactor || 0.30;
    const baseDur = conf.slowDuration || 1.4;
    const curSlow = Math.min(90, Math.round(baseSlow * (1 + curEff * (conf.powerSlow || 0)) * 100));
    const curDur = +(baseDur * (1 + curEff * (conf.powerDuration || 0))).toFixed(1);
    const sStep = Math.round(deltaEff * (conf.powerSlow || 0) * 100);
    const durStep = Math.round(deltaEff * (conf.powerDuration || 0) * 100);

    const nextTag = isMaxed ? `<span class="upg-stat-next">${maxLabel}</span>` : `<span class="upg-stat-next">+${sStep}/${durStep}/${rngStep}%</span>`;
    return `<span class="upg-stat-cur"><span class="upg-lbl">${slowLabel}</span> ${curSlow}%<span class="upg-sep">·</span><span class="upg-lbl">${durLabel}</span> ${curDur}s<span class="upg-sep">·</span><span class="upg-lbl">${rngLabel}</span> ${curRng}</span>${nextTag}`;
  }

  const baseDmg = conf.damage || conf.dps || conf.baseDps || 0;
  const curDmg = +(baseDmg * (1 + curEff * (conf.powerDmg || 0))).toFixed(1);

  if (conf.fireRate) {
    const curRate = +(conf.fireRate / (1 + curEff * (conf.powerRate || 0))).toFixed(2);
    const nextTag = isMaxed ? `<span class="upg-stat-next">${maxLabel}</span>` : `<span class="upg-stat-next">+${dStep}/${rStep}/${rngStep}%</span>`;
    return `<span class="upg-stat-cur"><span class="upg-lbl">${dmgLabel}</span> ${curDmg} <span class="upg-sep">·</span> <span class="upg-lbl">${spdLabel}</span> ${curRate}s <span class="upg-sep">·</span> <span class="upg-lbl">${rngLabel}</span> ${curRng}</span>${nextTag}`;
  }

  const nextTag = isMaxed ? `<span class="upg-stat-next">${maxLabel}</span>` : `<span class="upg-stat-next">+${dStep}/${rngStep}%</span>`;
  return `<span class="upg-stat-cur"><span class="upg-lbl">${dpsLabel}</span> ${curDmg} <span class="upg-sep">·</span> <span class="upg-lbl">${rngLabel}</span> ${curRng}</span>${nextTag}`;
}

// [UI.BU]
function getUpgradeDetailedToast(key) {
  const curEff = typeof getUpgradeEffectiveLevel === 'function' ? getUpgradeEffectiveLevel(key) : (upgradeTreeData[key] || 0);
  if (key === 'base_hp') {
    const hp = 10 + Math.round(curEff);
    return `Base Health: ${hp} HP (+${Math.round(curEff)} bonus)`;
  }
  if (key === 'base_gold') {
    return `Bounty Bonus: +${Math.round(curEff * 5)}% Gold`;
  }
  const towerType = key.replace('_power', '');
  const conf = (typeof TOWER_CONFIGS !== 'undefined') ? TOWER_CONFIGS[towerType] : null;
  if (!conf) return '';
  const name = (typeof TOWER_NAMES !== 'undefined' && TOWER_NAMES[towerType]) ? TOWER_NAMES[towerType] : towerType;

  if (towerType === 'stasis') {
    const slow = Math.min(90, Math.round((conf.slowFactor || 0.30) * (1 + curEff * (conf.powerSlow || 0)) * 100));
    const dur = ((conf.slowDuration || 1.4) * (1 + curEff * (conf.powerDuration || 0))).toFixed(2);
    return `${name} Lv.1 Stats: ${slow}% Slow for ${dur}s`;
  }

  const baseDmg = conf.damage || conf.dps || conf.baseDps || 0;
  const dmg = (baseDmg * (1 + curEff * (conf.powerDmg || 0))).toFixed(1);
  const rng = Math.round(conf.range * (1 + curEff * (conf.powerRange || 0)));
  if (conf.fireRate) {
    const rate = (conf.fireRate / (1 + curEff * (conf.powerRate || 0))).toFixed(2);
    return `${name} Lv.1 Stats: ${dmg} DMG · ${rate}s Rate · ${rng} RNG`;
  }
  return `${name} Lv.1 Stats: ${dmg} DPS · ${rng} RNG`;
}

//  Meta-upgrade skill tree DOM interface renderer.
// [UI.BV]
function renderUpgradeTree() {
  updateDiamondUI();
  updatePrismUI();
  const container = document.getElementById('upgradesTreeBody');
  if (!container) return;
  enablePointerScroll(container);
  container.innerHTML = '';

  const th = getTheme();
  const primaryAccent = th.c1;
  BASE_BRANCH_COLORS.base_hp = th.c3;
  BASE_BRANCH_COLORS.base_gold = th.c4;
  BASE_BRANCH_ICONS.base_hp = `<svg width="34" height="34" viewBox="-20 -20 40 40"><g transform="scale(1.35)"><path d="M 0 8 L -7.5 0.5 A 4.8 4.8 0 0 1 0 -6 A 4.8 4.8 0 0 1 7.5 0.5 Z" fill="${th.c3}"/></g></svg>`;
  BASE_BRANCH_ICONS.base_gold = `<svg width="34" height="34" viewBox="-20 -20 40 40"><g transform="translate(-12, -12)"><circle cx="12" cy="12" r="11" fill="${th.c4}"/><text x="12" y="17.5" font-size="16" font-weight="900" fill="#000000" text-anchor="middle" font-family="Montserrat, sans-serif">$</text></g></svg>`;

  const maxStep = devMode ? 10 : getMaxUpgradeStep();
  const isPhase2UnlockedGlobally = devMode || getLoadoutReferenceLevel() >= 31 || maxUnlockedLevel >= 31 || (typeof clearedLevels !== 'undefined' && clearedLevels.includes(30));

  const towerRows = UPGRADE_BRANCH_SPECS.towers.map(card => {
    const towerType = card.icon;
    const isLockedCard = !devMode && getLoadoutReferenceLevel() < getTowerUnlockLevel(towerType);
    return {
      key: card.branches[0].key,
      label: card.title,
      iconHtml: TOWER_ICONS[towerType] || '',
      color: (TOWER_CONFIGS[towerType] && TOWER_CONFIGS[towerType].color) || primaryAccent,
      isLockedCard,
      lockedLabel: isLockedCard ? `${card.title} (Lv.${getTowerUnlockLevel(towerType)})` : card.title
    };
  });
  const baseRows = (UPGRADE_BRANCH_SPECS.base[0].branches || []).map(br => {
    const locName = br.key === 'base_hp'
      ? (typeof t === 'function' ? t('base_hp') : br.name)
      : (br.key === 'base_gold' ? (typeof t === 'function' ? t('bounty') : br.name) : br.name);
    return {
      key: br.key,
      label: locName,
      iconHtml: BASE_BRANCH_ICONS[br.key] || '',
      color: BASE_BRANCH_COLORS[br.key] || primaryAccent,
      isLockedCard: false,
      lockedLabel: locName
    };
  });

  // [UI.BW]
  const addGroupLabel = (text) => {
    const label = document.createElement('div');
    label.className = 'upgrades-row-group-label';
    label.textContent = text;
    container.appendChild(label);
  };

  // [UI.BX]
  const addRow = (row) => {
    const currentLvl = upgradeTreeData[row.key] || 0;
    const nextStep = currentLvl + 1;

    let isSectorGated = false;
    let lvlNeeded = 11;
    let isAscGatedByBranches = false;

    if (!row.isLockedCard && !devMode) {
      if (nextStep <= 10) {
        if (nextStep > maxStep) {
          isSectorGated = true;
          if (nextStep > 8) lvlNeeded = 31;
          else if (nextStep > 6) lvlNeeded = 21;
          else lvlNeeded = 11;
        }
      } else {
        if (!isPhase2UnlockedGlobally) {
          isSectorGated = true;
          lvlNeeded = 31;
        } else if (!areAllBranchesMaxPhase1()) {
          isAscGatedByBranches = true;
        }
      }
    }

    const card = document.createElement('div');
    card.className = 'upgrade-row-card' + (row.isLockedCard ? ' locked-row' : '');

    const iconWrap = document.createElement('div');
    iconWrap.className = 'upgrade-row-icon' + (row.isLockedCard ? ' locked-icon' : '');
    iconWrap.innerHTML = row.iconHtml;
    card.appendChild(iconWrap);

    const info = document.createElement('div');
    info.className = 'upgrade-row-info';

    const head = document.createElement('div');
    head.className = 'upgrade-row-head';
    const nameEl = document.createElement('span');
    nameEl.className = 'upgrade-row-name' + (row.isLockedCard ? ' locked-name' : '');
    nameEl.textContent = row.label;

    const lvlEl = document.createElement('span');
    lvlEl.className = 'upgrade-row-level';

    const _tr = (typeof window.t === 'function') ? window.t : ((k) => k);

    if (row.isLockedCard) {
      lvlEl.textContent = ''; 
    } else if (currentLvl < 10) {
      lvlEl.style.color = row.color;
      lvlEl.textContent = `${currentLvl}/10`;
    } else if (currentLvl < 15) {
      lvlEl.style.color = '#d946ef';
      lvlEl.textContent = `ASC ${currentLvl - 10}/5`;
    } else if (!isScalingBranch(row.key)) {
      lvlEl.style.color = '#d946ef';
      lvlEl.textContent = _tr('ascended_max') || 'ASCENDED MAX';
    } else {
      lvlEl.style.color = th.c1;
      lvlEl.textContent = (typeof t === 'function') ? t('synth_plus_n', { n: currentLvl - 15 }) : `SYNTH +${currentLvl - 15}`;
    }

    head.appendChild(nameEl);
    head.appendChild(lvlEl);
    info.appendChild(head);

    const segs = document.createElement('div');
    segs.className = 'upgrade-row-segments';

    if (currentLvl < 10) {
      for (let s = 1; s <= 10; s++) {
        const seg = document.createElement('div');
        seg.className = 'upgrade-row-seg' + (row.isLockedCard ? ' locked-seg' : '');
        if (!row.isLockedCard && s <= currentLvl) {
          seg.style.background = row.color;
        }
        segs.appendChild(seg);
      }
    } else if (currentLvl < 15 || !isScalingBranch(row.key)) {
      for (let s = 1; s <= 5; s++) {
        const seg = document.createElement('div');
        seg.className = 'upgrade-row-seg' + (row.isLockedCard ? ' locked-seg' : '');
        if (!row.isLockedCard && s <= (currentLvl - 10)) {
          seg.style.background = '#d946ef';
          seg.style.boxShadow = '0 0 8px #d946ef';
        }
        segs.appendChild(seg);
      }
    } else {
      const seg = document.createElement('div');
      seg.className = 'upgrade-row-seg';
      seg.style.flex = '1';
      seg.style.background = `linear-gradient(90deg, ${th.c1}, ${th.c2}, ${th.c3})`;
      seg.style.boxShadow = `0 0 10px rgba(${th.rgb2 ? th.rgb2.cssRgb : '217, 70, 239'}, 0.5)`;
      segs.appendChild(seg);
    }
    info.appendChild(segs);

    const statsLine = document.createElement('div');
    statsLine.className = 'upgrade-row-stats';
    if (row.isLockedCard) {
      statsLine.innerHTML = '';
    } else {
      statsLine.innerHTML = getUpgradeStatSummary(row.key, currentLvl);
    }
    info.appendChild(statsLine);

    card.appendChild(info);

    if (devMode && !row.isLockedCard && currentLvl > 0) {
      const minusBtn = document.createElement('button');
      minusBtn.className = 'upgrade-row-dev-minus';
      minusBtn.textContent = '−';
      minusBtn.onclick = () => handleNodeClick(row.key, currentLvl - 1);
      card.appendChild(minusBtn);
    }

    const buyBtn = document.createElement('button');
    buyBtn.className = 'upgrade-row-buy';

    if (row.isLockedCard) {
      const reqLvl = getTowerUnlockLevel(row.key.replace('_power', ''));
      buyBtn.classList.add('locked-buy');
      buyBtn.innerHTML = `${CUSTOM_LOCK_SVG}<span class="upgrade-row-buy-cost" style="color:#8ea3c4; font-size:11px; margin-left:3px; font-weight:900;">L${reqLvl}</span>`;
      // [UI.BY]
      buyBtn.onclick = () => {
        if (typeof sfx === 'function') sfx('denied');
        if (typeof showHintToast === 'function') {
          showHintToast(typeof t === 'function' ? t('unlocks_on_level_n', { n: reqLvl }) : `Unlocks on Level ${reqLvl}`);
        }
      };
    } else if (currentLvl >= 15 && !isScalingBranch(row.key)) {
      buyBtn.classList.add('locked-buy', 'max-buy');
      buyBtn.innerHTML = `<span class="upgrade-row-buy-cost" style="color:#d946ef; font-size:10px;">${_tr('ascended_max') || 'ASCENDED MAX'}</span>`;
      // [UI.BZ]
      buyBtn.onclick = () => {
        if (typeof sfx === 'function') sfx('denied');
        if (typeof showHintToast === 'function') {
          showHintToast(typeof t === 'function' ? t('branch_ascended_max') : 'Branch is ASCENDED MAX (Lvl 15)');
        }
      };
    } else if (isSectorGated) {
      buyBtn.classList.add('locked-buy');
      buyBtn.innerHTML = `${CUSTOM_LOCK_SVG}<span class="upgrade-row-buy-cost" style="color:#8ea3c4; font-size:11px; margin-left:3px; font-weight:900;">L${lvlNeeded}</span>`;
      // [UI.CA]
      buyBtn.onclick = () => {
        if (typeof sfx === 'function') sfx('denied');
        if (typeof showHintToast === 'function') {
          showHintToast(typeof t === 'function' ? t('unlocks_on_level_n', { n: lvlNeeded }) : `Unlocks on Level ${lvlNeeded}`);
        }
      };
    } else if (isAscGatedByBranches) {
      buyBtn.classList.add('locked-buy');
      buyBtn.innerHTML = `${CUSTOM_LOCK_SVG}<span class="upgrade-row-buy-cost" style="color:#d946ef; font-size:11px; margin-left:3px; font-weight:900;">ASC</span>`;
      // [UI.CB]
      buyBtn.onclick = () => {
        if (typeof sfx === 'function') sfx('denied');
        if (typeof showHintToast === 'function') {
          showHintToast(typeof t === 'function' ? t('upgrade_all_branches_10') : 'Upgrade all branches to 10/10 first to unlock ASC');
        }
      };
    } else {
      const costs = getUpgradeCostForLevel(nextStep);
      const costD = costs.diamonds;
      const costP = costs.prisms;

      const diamondIcon = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#00e5ff" stroke-width="2.2" stroke-linejoin="round" style="flex:none;"><polygon points="6 3 18 3 22 9 12 22 2 9" fill="rgba(0,229,255,.25)"/><polyline points="2 9 12 13 22 9"/><line x1="12" y1="22" x2="12" y2="13"/></svg>`;
      const prismIcon = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#d946ef" stroke-width="2.2" stroke-linejoin="round" style="flex:none;"><polygon points="12 2 21 12 12 22 3 12" fill="rgba(217,70,239,.25)"/><polyline points="3 12 12 15 21 12"/><line x1="12" y1="2" x2="12" y2="22"/></svg>`;

      const canAffordD = diamonds >= costD;
      const canAffordP = prisms >= costP;
      const canAffordBoth = canAffordD && canAffordP;

      if (costD > 0 && costP > 0) {
        buyBtn.classList.add('dual-cost-btn');
        buyBtn.innerHTML = `
          <div class="dual-cost-row">
            ${diamondIcon}
            <span class="upgrade-row-buy-cost" style="color:${canAffordD ? '#ffffff' : '#f05f9f'};">${costD}</span>
          </div>
          <div class="dual-cost-row">
            ${prismIcon}
            <span class="upgrade-row-buy-cost" style="color:${canAffordP ? '#ffffff' : '#f05f9f'};">${costP}</span>
          </div>
        `;
      } else if (costP > 0) {
        buyBtn.innerHTML = `${prismIcon}<span class="upgrade-row-buy-cost" style="color:${canAffordP ? '#ffffff' : '#f05f9f'};">${costP}</span>`;
      } else {
        buyBtn.innerHTML = `${diamondIcon}<span class="upgrade-row-buy-cost" style="color:${canAffordD ? '#ffffff' : '#f05f9f'};">${costD}</span>`;
      }

      if (!canAffordBoth) {
        buyBtn.style.opacity = '0.75';
      }

      buyBtn.onclick = () => handleNodeClick(row.key, nextStep);
    }
    card.appendChild(buyBtn);
    container.appendChild(card);
  };

  addGroupLabel(typeof t === 'function' ? t('towers_group') : 'Towers');
  towerRows.forEach(addRow);
  addGroupLabel(typeof t === 'function' ? t('base_group') : 'Base');
  baseRows.forEach(addRow);
}

let isNavigatingSection = false;
let modeLevelSections = { normal: 1, overdrive: 1, endless: 1 };

// [UI.CC]
function navLevelSection(dir) {
  if (isNavigatingSection) return;
  const target = currentLevelSection + dir;
  if (target < 1 || target > TOTAL_SECTIONS) return;
  
  let isTargetUnlocked = false;
  if (devMode) {
      isTargetUnlocked = true;
  } else if (currentLevelMode === 'overdrive') {
      const reqLvl = (target - 1) * LEVELS_PER_SECTION;
      isTargetUnlocked = reqLvl === 0 || !!overdriveClearedLevels[reqLvl];
  } else {
      isTargetUnlocked = maxUnlockedLevel > (target - 1) * LEVELS_PER_SECTION;
  }
  
  if (!isTargetUnlocked) {
    if (typeof sfx === 'function') sfx('denied');
    return;
  }

  // Воспроизводим звук перелистывания для обоих направлений
  if (typeof sfx === 'function') sfx('slide');

  const grid = document.getElementById('levelsGrid');
  if (!grid) {
    currentLevelSection = target;
    modeLevelSections[currentLevelMode] = target;
    renderLevelsGrid();
    return;
  }

  isNavigatingSection = true;
  grid.classList.remove('grid-swipe-out-left', 'grid-swipe-out-right', 'grid-swipe-in-left', 'grid-swipe-in-right');
  void grid.offsetWidth;
  const outClass = dir > 0 ? 'grid-swipe-out-left' : 'grid-swipe-out-right';
  const inClass = dir > 0 ? 'grid-swipe-in-right' : 'grid-swipe-in-left';

  grid.classList.add(outClass);

  // [UI.CD]
  setTimeout(() => {
    currentLevelSection = target;
    modeLevelSections[currentLevelMode] = target;
    renderLevelsGrid();
    grid.classList.remove(outClass);
    void grid.offsetWidth;
    grid.classList.add(inClass);

    // [UI.CE]
    setTimeout(() => {
      grid.classList.remove(inClass);
      isNavigatingSection = false;
    }, 220);
  }, 180);
}

let currentLevelMode = 'normal';

// [UI.CF]
function selectLevelMode(mode) {
  const checkOverdrive = (typeof isOverdriveUnlocked === 'function')
    ? isOverdriveUnlocked()
    : ((typeof window !== 'undefined' && typeof window.isOverdriveUnlocked === 'function') ? window.isOverdriveUnlocked() : (typeof maxUnlockedLevel === 'number' && maxUnlockedLevel > 20));

  const checkEndless = (typeof isEndlessUnlocked === 'function')
    ? isEndlessUnlocked()
    : ((typeof window !== 'undefined' && typeof window.isEndlessUnlocked === 'function') ? window.isEndlessUnlocked() : (typeof maxUnlockedLevel === 'number' && maxUnlockedLevel > 15));

  if (mode === 'overdrive') {
    if (!checkOverdrive) {
      if (typeof sfx === 'function') sfx('denied');
      if (typeof showHintToast === 'function') {
        showHintToast(typeof t === 'function' ? t('unlock_hardcore_hint') : 'Complete Normal Level 20 to unlock HARDCORE');
      }
      return;
    }
  } else if (mode === 'endless') {
    if (!checkEndless) {
      if (typeof sfx === 'function') sfx('denied');
      if (typeof showHintToast === 'function') {
        showHintToast(typeof t === 'function' ? t('unlock_endless_hint') : 'Complete Normal Level 15 to unlock Endless Arena');
      }
      return;
    }
  }

  if (typeof sfx === 'function') sfx('confirm');
  
  if (currentLevelMode) {
    modeLevelSections[currentLevelMode] = currentLevelSection;
  }
  
  currentLevelMode = mode;
  isOverdriveMode = (mode === 'overdrive');
  isEndlessMode = (mode === 'endless');

  let targetSec = modeLevelSections[mode] || 1;
  let maxAllowedSec = 1;
  
  if (typeof devMode !== 'undefined' && devMode) {
    maxAllowedSec = typeof TOTAL_SECTIONS !== 'undefined' ? TOTAL_SECTIONS : 5;
  } else if (mode === 'overdrive') {
    let maxHC = 1;
    const hcKeys = (typeof overdriveClearedLevels !== 'undefined') ? Object.keys(overdriveClearedLevels).map(Number) : [];
    if (hcKeys.length > 0) {
      maxHC = Math.max(...hcKeys) + 1;
    }
    maxAllowedSec = Math.ceil(maxHC / LEVELS_PER_SECTION);
  } else {
    maxAllowedSec = Math.ceil((typeof maxUnlockedLevel === 'number' ? maxUnlockedLevel : 1) / LEVELS_PER_SECTION);
  }
  
  currentLevelSection = Math.min(targetSec, Math.max(1, maxAllowedSec));
  modeLevelSections[mode] = currentLevelSection;

  updateModeSwitcherUI();
  if (mode === 'endless') {
    renderEndlessDashboardUI();
  } else {
    renderLevelsGrid();
  }
}

// [UI.CG]
function updateModeSwitcherUI() {
  const tabNormal = document.getElementById('tabNormal');
  const tabOverdrive = document.getElementById('tabOverdrive');
  const tabEndless = document.getElementById('tabEndless');
  const levelsScreen = document.getElementById('levelsScreen');

  const odUnlocked = (typeof isOverdriveUnlocked === 'function')
    ? isOverdriveUnlocked()
    : ((typeof window !== 'undefined' && typeof window.isOverdriveUnlocked === 'function') ? window.isOverdriveUnlocked() : false);

  const endlessUnlocked = (typeof isEndlessUnlocked === 'function')
    ? isEndlessUnlocked()
    : ((typeof window !== 'undefined' && typeof window.isEndlessUnlocked === 'function') ? window.isEndlessUnlocked() : false);

  if (tabNormal) tabNormal.classList.toggle('active', currentLevelMode === 'normal');
  if (tabOverdrive) {
    tabOverdrive.classList.toggle('active', currentLevelMode === 'overdrive');
    tabOverdrive.classList.toggle('locked', !odUnlocked);
  }
  if (tabEndless) {
    tabEndless.classList.toggle('active', currentLevelMode === 'endless');
    tabEndless.classList.toggle('locked', !endlessUnlocked);
  }

  if (levelsScreen) {
    levelsScreen.classList.toggle('mode-normal-active', currentLevelMode === 'normal');
    levelsScreen.classList.toggle('mode-overdrive-active', currentLevelMode === 'overdrive');
    levelsScreen.classList.toggle('mode-endless-active', currentLevelMode === 'endless');
  }

  const campaignView = document.getElementById('levelsCampaignView');
  const endlessView = document.getElementById('endlessDashboardView');
  const swipeHint = document.getElementById('chapterSwipeHint');

  if (currentLevelMode === 'endless') {
    if (campaignView) campaignView.classList.add('hidden');
    if (endlessView) {
      endlessView.classList.remove('hidden');
      if (swipeHint) {
        const endlessNav = document.querySelector('.endless-part-nav');
        if (endlessNav) endlessNav.after(swipeHint);
      }
    }
    if (typeof renderEndlessDashboardUI === 'function') renderEndlessDashboardUI();
  } else {
    if (campaignView) {
      campaignView.classList.remove('hidden');
      if (swipeHint) {
        const normalNav = document.querySelector('.level-part-navigator:not(.endless-part-nav)');
        if (normalNav) normalNav.after(swipeHint);
      }
    }
    if (endlessView) endlessView.classList.add('hidden');
  }

  const svgSlot = document.getElementById('modeArtSvgSlot');
  const previewStage = document.getElementById('modePreviewStage');
  const previewTint = document.getElementById('modePreviewTint');

  if (svgSlot) svgSlot.classList.add('hidden');
  if (previewStage) previewStage.classList.remove('hidden');
  if (previewTint) previewTint.classList.remove('breach-flash');
  startModeBattlePreview(currentLevelMode);

  const rulesBanner = document.getElementById('modeRulesBanner');
  if (rulesBanner) {
    if (currentLevelMode === 'overdrive') {
      rulesBanner.className = 'mode-rules-banner hardcore-rules';
      const hpHeartSvg = `<span style="display:inline-flex; align-items:center; vertical-align:middle; filter:drop-shadow(0 0 5px rgba(240,95,159,0.8)); margin:0 2px;"><svg width="13" height="12" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="#f05f9f"/></svg></span>`;
      const ruleText = (typeof t === 'function') ? t('rules_hardcore') : '1 {heart} BASE — 1.2 SPEED & ENRAGED MOBS';
      rulesBanner.innerHTML = ruleText.replace('{heart}', hpHeartSvg);
    } else if (currentLevelMode === 'endless') {
      rulesBanner.className = 'mode-rules-banner endless-rules';
      const prismIcon = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#d946ef" stroke-width="2.2" stroke-linejoin="round" style="vertical-align: middle; display: inline-block; margin: 0 1px 2px 2px;"><polygon points="12 2 21 12 12 22 3 12" fill="rgba(217,70,239,.25)"/><polyline points="3 12 12 15 21 12"/><line x1="12" y1="2" x2="12" y2="22"/></svg>`;
      const diamondIcon = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#00e5ff" stroke-width="2.2" stroke-linejoin="round" style="vertical-align: middle; display: inline-block; margin: 0 1px 2px 1px;"><polygon points="6 3 18 3 22 9 12 22 2 9" fill="rgba(0,229,255,.25)"/><polyline points="2 9 12 13 22 9"/><line x1="12" y1="22" x2="12" y2="13"/></svg>`;
      const ruleText = (typeof t === 'function') ? t('rules_endless') : 'Infinite Loop • Earn {prism} Prisms & {diamond} Diamonds';
      rulesBanner.innerHTML = ruleText.replace('{prism}', prismIcon).replace('{diamond}', diamondIcon);
    } else {
      rulesBanner.className = 'mode-rules-banner normal-rules';
      const diamondIcon = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#00e5ff" stroke-width="2.2" stroke-linejoin="round" style="vertical-align: middle; display: inline-block; margin: 0 1px 2px 1px;"><polygon points="6 3 18 3 22 9 12 22 2 9" fill="rgba(0,229,255,.25)"/><polyline points="2 9 12 13 22 9"/><line x1="12" y1="22" x2="12" y2="13"/></svg>`;
      const ruleText = (typeof t === 'function') ? t('rules_normal') : 'Standard TD Rules • Earn {diamond} Diamonds';
      rulesBanner.innerHTML = ruleText.replace('{diamond}', diamondIcon);
    }
  }
}

// [UI.CH]
function renderEndlessDashboardUI() {
  const valEl = document.getElementById('endlessRecordVal');
  const mapEl = document.getElementById('endlessMapText');
  const ticketEl = document.getElementById('endlessDeployTicketText');
  const fillEl = document.getElementById('highwayTrackFill');
  const thumbEl = document.getElementById('highwayThumbPin');
  const startEl = document.getElementById('highwayStartLabel');
  const currEl = document.getElementById('highwayCurrLabel');
  const endEl = document.getElementById('highwayEndLabel');
  const rewardEl = document.getElementById('highwayRewardBadge');

  const sec = currentLevelSection || 1;
  const bestWave = (typeof endlessBestWavesBySection !== 'undefined' && endlessBestWavesBySection[sec]) 
    ? endlessBestWavesBySection[sec] 
    : 0;
  if (valEl) valEl.textContent = typeof t === 'function' ? t('best_wave_n', { n: bestWave }) : `BEST : WAVE ${bestWave}`;

  const startWave = bestWave > 0 ? Math.floor(Math.max(0, bestWave - 1) / 10) * 10 + 1 : 1;
  const endWave = startWave + 9;
  const pct = bestWave >= startWave ? Math.min(100, Math.max(0, ((bestWave - startWave + 1) / 10) * 100)) : 0;

  if (startEl) startEl.textContent = startWave;
  if (currEl) currEl.textContent = `W${bestWave}`;
  if (endEl) endEl.textContent = endWave;

  if (fillEl) fillEl.style.width = `${pct}%`;
  if (thumbEl) thumbEl.style.left = `${pct}%`;

  if (rewardEl) {
    const prismReward = (endWave % 50 === 0) ? '+5' : '+1';
    rewardEl.innerHTML = `
      <span class="reward-val">${prismReward}</span>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#d946ef" stroke-width="2" stroke-linejoin="round">
        <polygon points="12 2 21 12 12 22 3 12" fill="rgba(217,70,239,.4)"/>
      </svg>
    `;
  }

  if (mapEl) mapEl.textContent = typeof t === 'function' ? t('chapter_n', { n: currentLevelSection }) : `CHAPTER ${currentLevelSection}`;

  const prevBtn = document.getElementById('endlessNavPrev');
  const nextBtn = document.getElementById('endlessNavNext');
  
  if (prevBtn) {
    prevBtn.disabled = currentLevelSection <= 1;
  }
  if (nextBtn) {
    const nextSecUnlocked = (typeof devMode !== 'undefined' && devMode) || maxUnlockedLevel > currentLevelSection * LEVELS_PER_SECTION;
    nextBtn.disabled = currentLevelSection >= (typeof TOTAL_SECTIONS !== 'undefined' ? TOTAL_SECTIONS : 5) || !nextSecUnlocked;
  }

  if (ticketEl) {
    const status = (typeof getEndlessEntryStatus === 'function') ? getEndlessEntryStatus() : { type: 'free', text: 'FREE (1/1)' };
    const labelText = status.type === 'free'
      ? (typeof t === 'function' ? t('free_ticket', { cur: 1, max: 1 }) : 'FREE (1/1)')
      : (status.type === 'ad'
          ? (typeof t === 'function' ? t('watch_ad_ticket', { cur: 2, max: 2 }) : 'WATCH AD (2/2)')
          : (status.text || status.label || '').toUpperCase());

    if (status.type === 'ad') {
      const adIconSvg = `<svg width="15" height="12" viewBox="0 0 16 13" fill="none" style="flex:none; margin-right:5px; vertical-align:middle;"><rect x="0.8" y="0.8" width="14.4" height="11.4" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.6"/><polygon points="6,3.5 11,6.5 6,9.5" fill="currentColor"/></svg>`;
      ticketEl.innerHTML = `<span style="display:inline-flex; align-items:center; justify-content:center; white-space:nowrap;">${adIconSvg}${labelText}</span>`;
    } else if (status.type === 'diamonds') {
      const diamondIconSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00e5ff" stroke-width="2.2" stroke-linejoin="round" style="flex:none; margin-left:5px; vertical-align:middle; filter:drop-shadow(0 0 4px rgba(0,229,255,0.6));"><polygon points="6 3 18 3 22 9 12 22 2 9" fill="rgba(0,229,255,.28)"/><polyline points="2 9 12 13 22 9"/><line x1="12" y1="22" x2="12" y2="13"/></svg>`;
      const cost = status.cost || 15;
      ticketEl.innerHTML = `<span style="display:inline-flex; align-items:center; justify-content:center; width:100%;">${cost}${diamondIconSvg}</span>`;
    } else {
      ticketEl.textContent = labelText;
    }
  }

  const swipeHint = document.getElementById('chapterSwipeHint');
  if (swipeHint && typeof currentLevelMode !== 'undefined' && currentLevelMode === 'endless') {
    const canSwipe = (maxUnlockedLevel > 15 || devMode) && typeof TOTAL_SECTIONS !== 'undefined' && TOTAL_SECTIONS > 1;
    swipeHint.classList.toggle('hidden', !canSwipe);
  }
}

// [UI.CI]
function navEndlessLevel(dir) {
  const target = currentLevelSection + dir;
  if (target < 1 || (typeof TOTAL_SECTIONS !== 'undefined' && target > TOTAL_SECTIONS)) return;
  
  const isTargetUnlocked = (typeof devMode !== 'undefined' && devMode) || maxUnlockedLevel > (target - 1) * LEVELS_PER_SECTION;
  if (!isTargetUnlocked) {
    if (typeof showHintToast === 'function') {
      showHintToast(typeof t === 'function' ? t('chapter_locked') : 'Chapter locked!');
    }
    return;
  }
  
  currentLevelSection = target;
  if (typeof sfx === 'function') sfx('click');
  renderEndlessDashboardUI();
}

// [UI.CJ]
function confirmStartEndlessRun() {
  if (!isEndlessUnlocked()) {
    if (typeof showHintToast === 'function') {
      showHintToast(typeof t === 'function' ? t('unlock_endless_hint') : 'Complete Normal Level 15 to unlock Endless Arena');
    }
    return;
  }

  if (!selectedLoadout || selectedLoadout.length === 0) {
    if (typeof showHintToast === 'function') {
      showHintToast(typeof t === 'function' ? t('select_at_least_1_tower') : 'Select at least 1 tower!');
    }
    return;
  }

  const status = (typeof getEndlessEntryStatus === 'function') ? getEndlessEntryStatus() : { type: 'free', cost: 0 };

  // [UI.CK]
  const launch = () => {
    endlessDailyRunsUsed++;
    if (typeof saveGame === 'function') saveGame();
    if (typeof startEndlessMatch === 'function') startEndlessMatch();
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
    if (diamonds < status.cost) {
      if (typeof showHintToast === 'function') {
        showHintToast(typeof t === 'function' ? t('need_diamonds_for_entry', { cost: status.cost }) : `Need ${status.cost} Diamonds for entry!`);
      }
      return;
    }
    diamonds -= status.cost;
    if (typeof updateDiamondUI === 'function') updateDiamondUI();
    launch();
  } else {
    launch();
  }
}
window.confirmStartEndlessRun = confirmStartEndlessRun;

if (typeof getEndlessEntryStatus !== 'undefined') {
  window.getEndlessEntryStatus = getEndlessEntryStatus;
}

// [UI.CL]
function renderLevelsGrid() {
  updateModeSwitcherUI();
  const levelsGrid = document.getElementById('levelsGrid');
  if (!levelsGrid) return;
  levelsGrid.innerHTML = '';

  const partLabel = document.getElementById('partNavLabel');
  const prevBtn = document.getElementById('partNavPrev');
  const nextBtn = document.getElementById('partNavNext');
  
  let nextSecUnlocked = false;
  if (devMode) {
      nextSecUnlocked = true;
  } else if (currentLevelMode === 'overdrive') {
      const reqLvl = currentLevelSection * LEVELS_PER_SECTION;
      nextSecUnlocked = !!overdriveClearedLevels[reqLvl];
  } else {
      nextSecUnlocked = maxUnlockedLevel > currentLevelSection * LEVELS_PER_SECTION;
  }

  if (partLabel) partLabel.textContent = typeof t === 'function' ? t('chapter_n', { n: currentLevelSection }) : `CHAPTER ${currentLevelSection}`;

  if (prevBtn) {
    const canGoPrev = currentLevelSection > 1;
    prevBtn.disabled = !canGoPrev;
  }
  if (nextBtn) {
    const canGoNext = currentLevelSection < TOTAL_SECTIONS && nextSecUnlocked;
    nextBtn.disabled = !canGoNext;
  }

  const swipeHint = document.getElementById('chapterSwipeHint');
  const canSwipe = (maxUnlockedLevel >= 11 || devMode) && typeof TOTAL_SECTIONS !== 'undefined' && TOTAL_SECTIONS > 1;
  if (swipeHint && currentLevelMode !== 'endless') {
    swipeHint.classList.toggle('hidden', !canSwipe);
  }

  const startLvl = (currentLevelSection - 1) * LEVELS_PER_SECTION + 1;
  const endLvl = currentLevelSection * LEVELS_PER_SECTION;

  for (let lvl = startLvl; lvl <= endLvl; lvl++) {
    const btn = document.createElement('button');

    if (currentLevelMode !== 'overdrive') {
      const isUnlocked = devMode || lvl <= maxUnlockedLevel;
      const earnedStars = levelStars[lvl] || 0;
      const isCleared = clearedLevels.includes(lvl) || earnedStars > 0;
      const isCurrent = lvl === maxUnlockedLevel && !isCleared;

      if (isUnlocked) {
        btn.className = 'level-card-btn' + (isCurrent ? ' current' : (isCleared ? ' cleared' : ''));
        btn.innerHTML = `
          <span class="level-num">${lvl}</span>
          <div class="level-card-stars">
            <span class="mini-star ${earnedStars >= 1 ? 'filled' : 'empty'}">★</span>
            <span class="mini-star ${earnedStars >= 2 ? 'filled' : 'empty'}">★</span>
            <span class="mini-star ${earnedStars >= 3 ? 'filled' : 'empty'}">★</span>
          </div>
        `;
        btn.onclick = () => startSpecificLevel(lvl);
      } else {
        btn.className = 'level-card-btn locked';
        btn.disabled = true;
        btn.innerHTML = `
          <svg width="20" height="20" viewBox="0 0 24 24" stroke="#475569" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <path d="M 7,10 V 6 C 7,3.5 9,2 12,2 C 15,2 17,3.5 17,6 V 10" />
            <rect x="4" y="10" width="16" height="12" rx="3" fill="#080e1a" />
          </svg>
        `;
      }
    } else {
      const isOdCleared = !!overdriveClearedLevels[lvl];
      const isUnlockedInHC = devMode || isOdCleared || (lvl === 1) || !!overdriveClearedLevels[lvl - 1];
      const isCurrentOd = isUnlockedInHC && !isOdCleared;

      if (isUnlockedInHC) {
        btn.className = 'level-card-btn' + (isCurrentOd ? ' current' : (isOdCleared ? ' cleared' : ''));
        if (isOdCleared) {
          btn.innerHTML = `
            <span class="level-num">${lvl}</span>
            <div class="level-card-overdrive-badge filled" title="Hardcore Cleared">
              <span class="od-reward-tag" style="color:#ffd1f4;">+3</span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#d946ef" stroke-width="2" stroke-linejoin="round"><polygon points="12 2 21 12 12 22 3 12" fill="rgba(217,70,239,.4)"/></svg>
            </div>
          `;
        } else {
          btn.innerHTML = `
            <span class="level-num">${lvl}</span>
            <div class="level-card-overdrive-badge empty">
              <span class="od-reward-tag" style="color:#ffb3ea;">+3</span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#475569" stroke-width="1.8" stroke-linejoin="round"><polygon points="12 2 21 12 12 22 3 12" fill="#1a061c"/></svg>
            </div>
          `;
        }
        btn.onclick = () => startSpecificLevel(lvl);
      } else {
        btn.className = 'level-card-btn locked';
        btn.disabled = true;
        btn.innerHTML = `
          <svg width="20" height="20" viewBox="0 0 24 24" stroke="#52274b" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <path d="M 7,10 V 6 C 7,3.5 9,2 12,2 C 15,2 17,3.5 17,6 V 10" />
            <rect x="4" y="10" width="16" height="12" rx="3" fill="#120412" />
          </svg>
        `;
      }
    }
    levelsGrid.appendChild(btn);
  }
}

//  Navigation & screen visibility controllers.

// [UI.DP]
function updateDailyBonusBtnVisibility() {
  const btn = document.getElementById('dailyBonusQuickBtn');
  if (!btn) return;
  const startScreen = document.getElementById('startScreen');
  const isStartVisible = startScreen && !startScreen.classList.contains('hidden');

  const modals = [
    'settingsScreen', 'upgradesScreen', 'shopScreen', 'battlePassScreen',
    'dailyLoginModal', 'levelsScreen',
    'giveUpConfirmModal', 'gameCompletionModal',
    'milestoneScreen', 'victoryScreen', 'defeatScreen'
  ];

  // [UI.DQ]
  const isAnyModalOpen = modals.some(id => {
    const el = document.getElementById(id);
    return el && !el.classList.contains('hidden');
  });

  if (isStartVisible && gameState === 'START' && !isAnyModalOpen) {
    btn.classList.remove('hidden');
  } else {
    btn.classList.add('hidden');
  }
}

// [UI.DR]
function showStartScreen() {
  stopNormalModePreview();
  isEndlessMode = false;
  music('menu');
  if (reviveTimerInterval) { clearInterval(reviveTimerInterval); reviveTimerInterval = null; }
  document.getElementById('pauseScreen')?.classList.add('hidden');
  document.getElementById('levelsScreen').classList.add('hidden');
  document.getElementById('settingsScreen').classList.add('hidden');
  document.getElementById('upgradesScreen').classList.add('hidden');
  document.getElementById('victoryScreen').classList.add('hidden');
  document.getElementById('defeatScreen').classList.add('hidden');
  const revSc = document.getElementById('reviveScreen');
  if (revSc) revSc.classList.add('hidden');
  document.getElementById('startScreen').classList.remove('hidden');

  document.getElementById('econHpSplitBadge').classList.add('hidden');
  document.getElementById('levelWaveSplitBadge').classList.add('hidden');
  document.getElementById('hudRightGroup').classList.remove('hidden');

  updateStartChapterLabel(true);
  document.getElementById('controlsWrapper').classList.add('hidden');

  const waveBtn = document.getElementById('waveBtn');
  if (waveBtn) waveBtn.classList.add('hidden');

  const customSpawner = document.getElementById('devCustomSpawner');
  if (customSpawner) customSpawner.classList.add('hidden');

  const isHyperion = (typeof activePalette !== 'undefined' && activePalette === 'matrix_green');
  const startSubTitle = document.querySelector('.start-sub-title');
  if (startSubTitle) {
    startSubTitle.style.textShadow = '0 0 14px rgba(2, 3, 8, 0.95), 0 2px 8px rgba(2, 3, 8, 0.95)';
  }
  const startMainTitle = document.querySelector('.start-main-title');
  if (startMainTitle) {
    startMainTitle.style.textShadow = isHyperion
      ? '0 0 24px rgba(255, 145, 0, 0.85), 0 0 12px rgba(2, 3, 8, 0.95), 0 3px 10px rgba(2, 3, 8, 0.95)'
      : '0 0 24px rgba(0, 229, 255, 0.9), 0 0 12px rgba(2, 3, 8, 0.95), 0 3px 10px rgba(2, 3, 8, 0.95)';
  }

  const l1 = MAP_CATALOG['L1'];
  if (l1) buildLevelGeometry(l1.path, l1.cols, l1.rows, l1.blocked);
  resizeCanvasAndCamera();
  gameState = 'START';
  updateHudSpeedWidget();
  updateUpgradeButtonsLock();
  const resumeBtn = document.getElementById('mainResumeBtn');
  const playBtnText = document.getElementById('mainPlayBtnText');
  const hasSavedBattle = (typeof activeBattleSave !== 'undefined' && activeBattleSave !== null);

  if (resumeBtn) {
    resumeBtn.classList.toggle('hidden', !hasSavedBattle);
  }
  if (playBtnText) {
    playBtnText.textContent = hasSavedBattle 
      ? (typeof t === 'function' ? t('play_new') : 'PLAY NEW') 
      : (typeof t === 'function' ? t('play') : 'PLAY');
  }
  updateBpProgressUI();
  updateMenuBadges();

  if (!hasAutoShownDailyLoginModalThisSession) {
    const isNotClaimedToday = !checkDailyLoginState();
    const milestoneScr = document.getElementById('milestoneScreen');
    const isMilestoneHidden = milestoneScr ? milestoneScr.classList.contains('hidden') : true;
    const isNotDismissedThisSession = (typeof dailyLoginDismissedThisSession !== 'undefined') ? !dailyLoginDismissedThisSession : true;

    if (isNotClaimedToday && isMilestoneHidden && isNotDismissedThisSession) {
      hasAutoShownDailyLoginModalThisSession = true;
      setTimeout(() => openDailyLoginModal(), 300);
    }
  }

  if (typeof warmUpNebulaAndHideLoader === 'function') {
    warmUpNebulaAndHideLoader();
  }
  
  syncTopHudVisibility();
  updateDailyBonusBtnVisibility();
}

// [UI.DS]
function updateUpgradeButtonsLock() {
  const unlockLevel = getLoadoutStartLevel();
  const isUpgradesUnlocked = devMode || getLoadoutReferenceLevel() >= unlockLevel;
  const mainTechTreeIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="flex:none;"><path d="M12 21 v-5 l-4 -3.5 v-4 m4 7.5 l4 -3.5 v-4 m-4 7.5 v-8" /><circle cx="12" cy="21" r="1.5" fill="currentColor" stroke="none" /><circle cx="8" cy="8.5" r="1.5" fill="currentColor" stroke="none" /><circle cx="16" cy="8.5" r="1.5" fill="currentColor" stroke="none" /><circle cx="12" cy="5" r="1.5" fill="currentColor" stroke="none" /></svg>`;
  const resTechTreeIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="flex:none; margin-right: 4px;"><path d="M12 21 v-5 l-4 -3.5 v-4 m4 7.5 l4 -3.5 v-4 m-4 7.5 v-8" /><circle cx="12" cy="21" r="1.5" fill="currentColor" stroke="none" /><circle cx="8" cy="8.5" r="1.5" fill="currentColor" stroke="none" /><circle cx="16" cy="8.5" r="1.5" fill="currentColor" stroke="none" /><circle cx="12" cy="5" r="1.5" fill="currentColor" stroke="none" /></svg>`;

  const techTreeLabel = (typeof t === 'function') ? t('tech_tree') : 'TECH TREE';

  ['mainUpgradesBtn', 'victoryUpgradesBtn', 'defeatUpgradesBtn'].forEach(id => {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.disabled = false;
    btn.classList.toggle('no-press-feedback', !isUpgradesUnlocked);
    btn.classList.toggle('btn-locked', !isUpgradesUnlocked);
    const isMain = id === 'mainUpgradesBtn';
    const activeIcon = isMain ? mainTechTreeIcon : resTechTreeIcon;
    btn.innerHTML = `${activeIcon}<span>${techTreeLabel}</span>`;
  });
}

let settingsPreviousSource = 'start';
let settingsAccordionExpanded = false;
let devSettingsTapCount = 0;
let devSettingsTapTimer = null;

//  Settings accordion toggle and pause menu controller.
// [UI.DT]
function toggleSettingsAccordion(forceState) {
  if (typeof forceState === 'boolean') {
    settingsAccordionExpanded = forceState;
  } else {
    settingsAccordionExpanded = !settingsAccordionExpanded;
  }

  const body = document.getElementById('settingsBody');
  const arrow = document.getElementById('settingsArrow');
  if (body) {
    body.classList.toggle('hidden', !settingsAccordionExpanded);
  }
  if (arrow) {
    arrow.textContent = settingsAccordionExpanded ? '▴' : '▾';
  }
}

// [UI.DU]
const _EXT_DEV_MOD_KEY = 'swd_ext_dev_mod_v1';
let _isDevAuthInProgress = false;

function mountExternalDevCode(codeStr) {
  if (!codeStr) return false;
  try {
    (new Function(codeStr))();
    return true;
  } catch (err) {
    console.warn('[DevLoader] Module execution error:', err);
    return false;
  }
}

function loadDevPanelFromStage() {
  if (document.getElementById('devPanelStageScript')) {
    if (typeof window.openDevMode === 'function') window.openDevMode();
    return;
  }
  const s = document.createElement('script');
  s.id = 'devPanelStageScript';
  s.src = 'dev/dev-panel.js?t=' + Date.now();
  document.head.appendChild(s);
}

// [UI.DUN] Кастомное модальное окно ввода для Dev-меню (не триггерит ресайз фона на мобилках)
function showDevInputModal(titleText, defaultValue = '', isPassword = false) {
  return new Promise(resolve => {
    devInputOpen = true;
    if (typeof suppressBackgroundPause === 'function') suppressBackgroundPause(60000);

    let modal = document.getElementById('devCustomInputModal');
    if (modal) modal.remove();

    modal = document.createElement('div');
    modal.id = 'devCustomInputModal';
    modal.className = 'dev-input-modal-overlay';
    modal.innerHTML = `
      <div class="dev-input-modal-card">
        <div class="dev-input-modal-title">${titleText}</div>
        <input
          type="${isPassword ? 'password' : 'text'}"
          inputmode="${isPassword ? 'text' : 'numeric'}"
          id="devCustomModalInput"
          class="dev-modal-field"
          value="${defaultValue !== null && defaultValue !== undefined ? defaultValue : ''}"
          autocomplete="off"
          autocorrect="off"
          autocapitalize="off"
          spellcheck="false"
        />
        <div class="dev-input-modal-actions">
          <button type="button" class="dev-modal-btn dev-modal-btn-cancel" id="devModalCancelBtn">CANCEL</button>
          <button type="button" class="dev-modal-btn dev-modal-btn-ok" id="devModalOkBtn">OK</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const inputEl = document.getElementById('devCustomModalInput');
    const okBtn = document.getElementById('devModalOkBtn');
    const cancelBtn = document.getElementById('devModalCancelBtn');

    const cleanup = (val) => {
      if (inputEl) inputEl.blur();
      if (modal && modal.parentNode) modal.parentNode.removeChild(modal);
      setTimeout(() => {
        devInputOpen = false;
        if (typeof suppressBackgroundPause === 'function') suppressBackgroundPause(1200);
      }, 250);
      resolve(val);
    };

    okBtn.onclick = (ev) => {
      ev.stopPropagation();
      cleanup(inputEl ? inputEl.value : '');
    };
    cancelBtn.onclick = (ev) => {
      ev.stopPropagation();
      cleanup(null);
    };
    modal.onclick = (ev) => {
      if (ev.target === modal) cleanup(null);
    };
    if (inputEl) {
      inputEl.onkeydown = (ev) => {
        if (ev.key === 'Enter') {
          ev.preventDefault();
          cleanup(inputEl.value);
        } else if (ev.key === 'Escape') {
          ev.preventDefault();
          cleanup(null);
        }
      };
      setTimeout(() => {
        inputEl.focus({ preventScroll: true });
        if (!isPassword && inputEl.select) inputEl.select();
      }, 30);
    }
  });
}
window.showDevInputModal = showDevInputModal;

async function handleHudSettingsClick(e) {
  if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
  if (_isDevAuthInProgress) return;

  devSettingsTapCount++;
  if (devSettingsTapTimer) clearTimeout(devSettingsTapTimer);

  // [UI.DV]
  devSettingsTapTimer = setTimeout(() => {
    devSettingsTapCount = 0;
    devSettingsTapTimer = null;
  }, 1800);

  if (devSettingsTapCount >= 5) {
    devSettingsTapCount = 0;
    if (devSettingsTapTimer) {
      clearTimeout(devSettingsTapTimer);
      devSettingsTapTimer = null;
    }

    if (typeof devMode !== 'undefined' && devMode) {
      if (typeof closeDevMode === 'function') closeDevMode();
      if (typeof showHintToast === 'function') showHintToast('DEV MODE: OFF');
      return;
    }

    const settingsSc = document.getElementById('settingsScreen');

    // Стейдж: 5 тапов сразу открывают дев-меню без пароля
    if (window.__APP_STAGE__ === 'development') {
      if (settingsSc) settingsSc.classList.add('hidden');
      loadDevPanelFromStage();
      return;
    }

    // Прод: если модуль уже сохранён на устройстве — запускаем сразу
    let cachedCode = null;
    try { cachedCode = localStorage.getItem(_EXT_DEV_MOD_KEY); } catch (err) {}

    if (cachedCode) {
      if (settingsSc) settingsSc.classList.add('hidden');
      if (typeof window.openDevMode === 'function') {
        window.openDevMode();
      } else {
        mountExternalDevCode(cachedCode);
      }
      return;
    }

    // Прод (первый вход): запрашиваем прямую ссылку в виде обычного окна Access Code
    _isDevAuthInProgress = true;
    const rawUrl = await showDevInputModal('Access Code:', '', true);

    if (!rawUrl) {
      setTimeout(() => { _isDevAuthInProgress = false; }, 300);
      return;
    }

    const cleanUrl = String(rawUrl).trim();
    if (!/^https?:\/\//i.test(cleanUrl)) {
      if (typeof showHintToast === 'function') showHintToast('Access Denied');
      if (typeof sfx === 'function') sfx('denied');
      setTimeout(() => { _isDevAuthInProgress = false; }, 400);
      return;
    }

    try {
      const sep = cleanUrl.includes('?') ? '&' : '?';
      const resp = await fetch(cleanUrl + sep + 't=' + Date.now(), { cache: 'no-store' });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const scriptText = await resp.text();
      if (!scriptText || scriptText.length < 50) throw new Error('Empty payload');

      try { localStorage.setItem(_EXT_DEV_MOD_KEY, scriptText); } catch (err) {}
      if (settingsSc) settingsSc.classList.add('hidden');

      if (mountExternalDevCode(scriptText)) {
        if (typeof showHintToast === 'function') showHintToast('⚡ DEV ACCESS GRANTED ⚡');
        if (typeof sfx === 'function') sfx('reward');
      } else {
        throw new Error('Mount failed');
      }
    } catch (err) {
      if (typeof showHintToast === 'function') showHintToast('Access Denied');
      if (typeof sfx === 'function') sfx('denied');
    }

    setTimeout(() => { _isDevAuthInProgress = false; }, 400);
    return;
  }

  const settingsSc = document.getElementById('settingsScreen');
  const isSettingsOpen = settingsSc && !settingsSc.classList.contains('hidden');

  if (isSettingsOpen || gameState === 'PAUSED' || gameState === 'SETTINGS') {
    closeSettings();
    return;
  }

  if (gameState === 'PLAYING') {
    if (typeof saveActiveBattleSnapshot === 'function') {
      saveActiveBattleSnapshot();
      saveGameSoon();
    }
    gameState = 'PAUSED';
    sfxStopBeams();
    showSettings('combat');
  } else {
    showSettings(gameState ? gameState.toLowerCase() : 'start');
  }
}

// [UI.DW]
function showSettings(fromSource = 'start') {
  settingsPreviousSource = fromSource;
  if (fromSource === 'combat' || fromSource === 'pause') {
    musicSetDucked(true);
  }

  const isResultScreen = (fromSource === 'victory' || fromSource === 'defeat');
  const bgScreenId = fromSource === 'victory' ? 'victoryScreen' 
                   : (fromSource === 'defeat' ? 'defeatScreen' 
                   : (fromSource === 'levels' ? 'levelsScreen' 
                   : (fromSource === 'shop' ? 'shopScreen' 
                   : (fromSource === 'upgrades' ? 'upgradesScreen' : 'startScreen'))));

  ['startScreen', 'victoryScreen', 'defeatScreen', 'levelsScreen', 'shopScreen', 'upgradesScreen']
    .forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.classList.remove('screen-bg-only');
      if (id === bgScreenId && isResultScreen) {
        el.classList.remove('hidden');
        el.classList.add('screen-bg-only');
      } else if (id === bgScreenId) {
        el.classList.add('hidden');
      }
    });

  const settingsSc = document.getElementById('settingsScreen');
  if (settingsSc) {
    settingsSc.classList.remove('hidden');
    settingsSc.classList.remove('screen-bg-only');
  }
  const hudRightGroup = document.getElementById('hudRightGroup');
  if (hudRightGroup) hudRightGroup.classList.remove('hidden');

  const kickerEl = document.getElementById('settingsKicker');
  const titleEl = document.getElementById('settingsTitle');
  const combatActions = document.getElementById('settingsCombatActions');
  const backBtn = document.getElementById('settingsBackBtn');
  const loadoutAnchor = document.getElementById('loadoutAnchor-pause');
  const collapsibleWidget = document.getElementById('settingsCollapsible');

  if (fromSource === 'combat') {
    if (kickerEl) kickerEl.textContent = typeof t === 'function' ? t('game_kicker') : 'Game';
    if (titleEl) titleEl.textContent = typeof t === 'function' ? t('paused_title') : 'Paused';
    if (combatActions) combatActions.classList.remove('hidden');

    const pauseRetryBtn = combatActions ? combatActions.querySelector('.result-btn-retry') : null;
    if (pauseRetryBtn) {
      pauseRetryBtn.classList.toggle('hidden', !!(typeof isEndlessMode !== 'undefined' && isEndlessMode));
    }

    if (backBtn) backBtn.classList.add('hidden');
    if (loadoutAnchor) loadoutAnchor.classList.remove('hidden');
    if (collapsibleWidget) collapsibleWidget.classList.remove('plain-mode');
    showLoadoutWidgetIn('loadoutAnchor-pause');
    toggleSettingsAccordion(false);
  } else {
    if (kickerEl) kickerEl.textContent = typeof t === 'function' ? t('game_kicker') : 'Game';
    if (titleEl) titleEl.textContent = typeof t === 'function' ? t('settings_title') : 'Settings';
    if (combatActions) combatActions.classList.add('hidden');
    if (backBtn) backBtn.classList.remove('hidden');
    if (loadoutAnchor) loadoutAnchor.classList.add('hidden');
    if (collapsibleWidget) collapsibleWidget.classList.add('plain-mode');
    toggleSettingsAccordion(true);
  }

  const hpCheckbox = document.getElementById('settingShowHp');
  if (hpCheckbox) hpCheckbox.checked = !!settings.showEnemyHp;

  const dmgCheckbox = document.getElementById('settingShowDamage');
  if (dmgCheckbox) dmgCheckbox.checked = settings.showDamage !== false;

  const perfCheckbox = document.getElementById('settingPerfMode');
  if (perfCheckbox) perfCheckbox.checked = (perfMode === 'low');

  const vibCheckbox = document.getElementById('settingVibration');
  if (vibCheckbox) vibCheckbox.checked = settings.vibrationEnabled !== false;

  const shakeCheckbox = document.getElementById('settingScreenShake');
  if (shakeCheckbox) shakeCheckbox.checked = settings.screenShakeEnabled !== false;

  updatePaletteSelectDropdown('settingPaletteSelect');

  applySfxVolume(settings.sfxVolume != null ? settings.sfxVolume : 100, false);
  applyMusicVolume(settings.musicVolume != null ? settings.musicVolume : 70, false);

  const versionLabel = document.getElementById('settingsVersionLabel');
  if (versionLabel) {
    const fallbackVer = window.APP_VERSION || '1.38.29';
    const liveVersion = (window.SyncTelemetry && window.SyncTelemetry.localVersion && window.SyncTelemetry.localVersion !== '—' && window.SyncTelemetry.localVersion !== 'ERROR' && window.SyncTelemetry.localVersion !== 'MISSING')
      ? window.SyncTelemetry.localVersion
      : fallbackVer;
    versionLabel.textContent = (typeof t === 'function') ? t('version_label', { v: liveVersion }) : `Version: ${liveVersion}`;
  }
  if (typeof populateLanguageDropdown === 'function') {
    populateLanguageDropdown();
  }
  syncTopHudVisibility();
  updateDailyBonusBtnVisibility();
}
