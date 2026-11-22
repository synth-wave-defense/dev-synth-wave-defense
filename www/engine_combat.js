// ============================================================================
// Synth Wave Defense -- engine_combat.js (Part 3 of 3)
// Level geometry, entity arrays, tower build/upgrade/sell, wave spawning,
// dev spawner, DOM init, performance monitor, gameLoop, and update(dt).
// Load order: engine_state.js -> engine_meta.js -> engine_combat.js
// ============================================================================

// Map Geometry & Path Grid Construction: Path nodes, cell blocking, and grid topology initialization.
// [ENG.AP]
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
      const innerR = half - D; // 12px — внутренний угол
      const outerR = half + D; // 58px — концентрический внешний угол (ширина коридора 2*D = 46px)

      const makeCornerCurve = (sideSign, rCorner) => {
        const startX = cx - inDir.x * half + outDir.x * (sideSign * D);
        const startY = cy - inDir.y * half + outDir.y * (sideSign * D);
        const endX = cx + outDir.x * half - inDir.x * (sideSign * D);
        const endY = cy + outDir.y * half - inDir.y * (sideSign * D);
        const cornerX = cx - inDir.x * (sideSign * D) + outDir.x * (sideSign * D);
        const cornerY = cy - inDir.y * (sideSign * D) + outDir.y * (sideSign * D);
        return { startX, startY, cornerX, cornerY, endX, endY, r: rCorner };
      };

      cell.turnCurves = [
        makeCornerCurve(1, innerR),
        makeCornerCurve(-1, outerR)
      ];
    }
  }

  // Строим гладкую траекторию: каждый поворот разбиваем на 24 микро-сегмента Безье (R = 28px),
  // чтобы кривизна поворота была абсолютно непрерывной без угловых ступенек
  const rawWaypoints = pathNodes.map(p => ({
    x: p.c * TILE_SIZE + TILE_SIZE / 2,
    y: p.r * TILE_SIZE + TILE_SIZE / 2
  }));

  if (rawWaypoints.length <= 2) {
    WAYPOINTS = rawWaypoints;
  } else {
    const smoothWps = [rawWaypoints[0]];
    const CORNER_CUT = 28;
    const ARC_SEGMENTS = 24;

    for (let i = 1; i < rawWaypoints.length - 1; i++) {
      const prev = rawWaypoints[i - 1];
      const curr = rawWaypoints[i];
      const next = rawWaypoints[i + 1];

      const v1x = curr.x - prev.x;
      const v1y = curr.y - prev.y;
      const len1 = Math.hypot(v1x, v1y) || 1;

      const v2x = next.x - curr.x;
      const v2y = next.y - curr.y;
      const len2 = Math.hypot(v2x, v2y) || 1;

      const cut = Math.min(CORNER_CUT, len1 * 0.45, len2 * 0.45);
      if (cut < 2) {
        smoothWps.push(curr);
        continue;
      }

      const pStart = {
        x: curr.x - (v1x / len1) * cut,
        y: curr.y - (v1y / len1) * cut
      };
      const pEnd = {
        x: curr.x + (v2x / len2) * cut,
        y: curr.y + (v2y / len2) * cut
      };

      for (let s = 0; s <= ARC_SEGMENTS; s++) {
        const t = s / ARC_SEGMENTS;
        const invT = 1 - t;
        smoothWps.push({
          x: invT * invT * pStart.x + 2 * invT * t * curr.x + t * t * pEnd.x,
          y: invT * invT * pStart.y + 2 * invT * t * curr.y + t * t * pEnd.y
        });
      }
    }

    smoothWps.push(rawWaypoints[rawWaypoints.length - 1]);
    WAYPOINTS = smoothWps;
  }

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

// Tower Construction & Inspection Management: Build, upgrade, sell, and drag-and-drop placement logic.
// [ENG.CR]
function buildTowerAt(type, c, r) {
  const conf = TOWER_CONFIGS[type];
  if (grid[r][c] === 0 && gold >= conf.cost) {
    gold -= conf.cost;
    grid[r][c] = 2;

    const powerLvl = getBattleUpgradeEffectiveLevel(`${type}_power`);
    const dmgBonus = 1 + powerLvl * (conf.powerDmg || 0);
    const rateBonus = 1 + powerLvl * (conf.powerRate || 0);
    const rangeBonus = 1 + getBattleUpgradeRangeBonus(type, powerLvl);
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
    vibrate('light');
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
      melterCoolingTimer: 0,
      accumDamage: 0,
      accumTimer: 0,
      accumTarget: null
    };

    applyTowerLevelStats(newTower);
    towers.push(newTower);
    createShockwave(newTower.x, newTower.y, 40, conf.color);
    updateUI();
    saveActiveBattleSnapshot();
    saveGameSoon();

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

// [ENG.CS]
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

// [ENG.CT]
function getUpgradeCost(towerOrType, level) {
  const type = typeof towerOrType === 'object' ? towerOrType.type : towerOrType;
  const lvl = typeof towerOrType === 'object' ? towerOrType.level : level;
  if (typeof getTowerUpgradeCostByLevel === 'function') {
    return getTowerUpgradeCostByLevel(type, lvl);
  }
  const conf = TOWER_CONFIGS[type];
  if (!conf) return 0;
  const maxLvl = (typeof MAX_TOWER_LEVEL === 'number') ? MAX_TOWER_LEVEL : 4;
  if (lvl >= maxLvl) return 0;
  const costTable = (typeof TOWER_UPGRADE_COST_MULTS !== 'undefined' && Array.isArray(TOWER_UPGRADE_COST_MULTS))
    ? TOWER_UPGRADE_COST_MULTS
    : [0.75, 1.35, 2.30];
  const mult = costTable[lvl - 1];
  if (typeof mult !== 'number') return 0;
  return Math.round((conf.cost * mult) / 5) * 5;
}
const getTowerUpgradeCost = getUpgradeCost;

// [ENG.CTM] Пересчёт боевых характеристик башни по 4-уровневой таблице data.js с учётом Tech Tree
function applyTowerLevelStats(tower) {
  if (!tower) return;
  const conf = TOWER_CONFIGS[tower.type];
  if (!conf) return;

  const maxLvl = (typeof MAX_TOWER_LEVEL === 'number') ? MAX_TOWER_LEVEL : 4;
  const lvl = Math.max(1, Math.min(maxLvl, tower.level || 1));
  const lvlIdx = lvl - 1;
  const spec = (typeof getTowerLevelSpec === 'function')
    ? getTowerLevelSpec(tower.type, lvl)
    : (Array.isArray(conf.levels) ? (conf.levels[lvlIdx] || conf.levels[0]) : null);

  const powerLvl = getBattleUpgradeEffectiveLevel(`${tower.type}_power`);
  const dmgBonus = 1 + powerLvl * (conf.powerDmg || 0);
  const rateBonus = 1 + powerLvl * (conf.powerRate || 0);
  const rangeBonus = 1 + getBattleUpgradeRangeBonus(tower.type, powerLvl);

  const dmgScale = (spec && typeof spec.damageMult === 'number')
    ? spec.damageMult
    : ((typeof TOWER_DPS_MULTS !== 'undefined' && Array.isArray(TOWER_DPS_MULTS) && typeof TOWER_DPS_MULTS[lvlIdx] === 'number')
      ? TOWER_DPS_MULTS[lvlIdx]
      : [1.0, 1.8, 3.3, 6.0][lvlIdx]);
  const rateScale = (spec && typeof spec.fireRateMult === 'number')
    ? spec.fireRateMult
    : 1.0;
  const rangeScale = (spec && typeof spec.rangeMult === 'number')
    ? spec.rangeMult
    : Math.pow(conf.rangeMultiplier || 1.1, lvlIdx);

  tower.damage = (conf.damage || conf.dps || conf.baseDps || 0) * dmgScale * dmgBonus;
  tower.range = conf.range * rangeScale * rangeBonus;
  tower.fireRate = conf.fireRate ? ((conf.fireRate * rateScale) / rateBonus) : 0;

  if (tower.type === 'tesla') {
    tower.chainCount = (spec && typeof spec.chainCount === 'number')
      ? spec.chainCount
      : ((spec && typeof spec.chainTargets === 'number') ? spec.chainTargets : (conf.chainTargets || 3));
  }

  if (tower.type === 'mortar') {
    const rad = (spec && typeof spec.blastRadius === 'number')
      ? spec.blastRadius
      : ((spec && typeof spec.splash === 'number') ? spec.splash : (conf.splash || 80));
    tower.blastRadius = rad;
    tower.splash = rad;
  }

  if (tower.type === 'stasis') {
    tower.slowFactor = (spec && typeof spec.slowFactor === 'number')
      ? spec.slowFactor
      : (conf.slowFactor || 0.30);
    tower.slowDuration = (spec && typeof spec.slowDuration === 'number')
      ? spec.slowDuration
      : (conf.slowDuration || 1.40);
  }

  if (tower.type === 'melter') {
    const baseRamp = (spec && typeof spec.rampTime === 'number') ? spec.rampTime : (conf.rampTime || 4.0);
    const baseCool = (spec && typeof spec.cooldownTime === 'number') ? spec.cooldownTime : (conf.cooldownTime || 4.0);
    tower.melterRampTime = baseRamp / rateBonus;
    tower.melterCooldownTime = baseCool / rateBonus;
    if (spec && typeof spec.rampCap === 'number') {
      tower.rampCap = spec.rampCap;
    }
  }
}

// [ENG.CU]
function upgradeSelectedTower() {
  const lvlConfig = LEVELS_DATA[currentLevel];
  const isL1FirstTime = (currentLevel === 1 && !isEndlessMode && !isOverdriveMode && !hasClearedLevelBefore(1) && !devMode);
  if (lvlConfig && lvlConfig.canUpgrade === false && isL1FirstTime) return;
  const maxLvl = (typeof MAX_TOWER_LEVEL === 'number') ? MAX_TOWER_LEVEL : 4;
  if (!selectedTower || selectedTower.level >= maxLvl) return;
  const cost = getUpgradeCost(selectedTower.type, selectedTower.level);
  if (gold >= cost) {
    gold -= cost;
    selectedTower.level++;
    sfx('upgrade');
    selectedTower.totalInvested += cost;

    if (selectedTower.type === 'melter') {
      selectedTower.melterFireTimer = 0;
      selectedTower.melterCoolingTimer = 0;
    }
    applyTowerLevelStats(selectedTower);

    createShockwave(selectedTower.x, selectedTower.y, 60, selectedTower.color);
    createDamageShards(selectedTower.x, selectedTower.y, selectedTower.color, 40, false);
    updateUI();
    saveActiveBattleSnapshot();
    saveGameSoon();

    if (tutorialActive && tutorialLevel === 2 && tutorialStep === 1) {
      tutorialStep = 2;
    }
  }
}

// [ENG.CV]
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
  saveActiveBattleSnapshot();
  saveGameSoon();
}

// Wave Spawning & Enemy Queue Management: Auto/manual wave triggers, miniboss/boss delays, and spawn timers.
// [ENG.CW]
function getAutoWaveDelay() {
  if (currentLevel >= 40) return 9.0;
  if (currentLevel >= 30) return 7.0;
  return 5.0;
}

// [ENG.CX]
function triggerManualWave() {
  if (tutorialActive && tutorialLevel === 1 && tutorialStep === 1) {
    completeTutorial(1);
  }

  const lvlConfig = LEVELS_DATA[currentLevel];
  const maxW = lvlConfig ? lvlConfig.totalWaves : 10;

  if (!isEndlessMode && finalWaveSpawned) {
    return;
  }

  if (waveTimerActive) {
    const secondsSaved = autoWaveTimeRemaining;
    waveTimerActive = false;
    autoWaveTimeRemaining = 0;
    fieldClearDelayTimer = 0;
    isWaveTimerAccelerated = false;
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
      const moneyMultiplier = 1 + getBattleUpgradeEffectiveLevel('base_gold') * 0.05;
      const fractionSaved = totalDelay > 0 ? Math.min(1, Math.max(0, secondsSaved / totalDelay)) : 0;
      const earlyCallBonus = Math.round(fractionSaved * baseBonus * moneyMultiplier);

      if (earlyCallBonus > 0) {
        gold += earlyCallBonus;
        sfx('confirm');
      }
      startWave();
    }
  } else if (!waveInProgress && spawnQueue.length === 0) {
    if (isEndlessMode || (wave <= maxW && !finalWaveSpawned)) startWave();
  }
}

// [ENG.CY]
function getMinibossPreDelay() { return 2.0; }
// [ENG.CZ]
function getBossPreDelay(lvl) {
  const clamped = Math.max(10, Math.min(50, lvl));
  return 2.5 + ((clamped - 10) / 40) * 2.5;
}

// [ENG.DA]
function startWave() {
  if (isEndlessMode) {
    waveInProgress = true;
    waveTimerActive = false;
    autoWaveTimeRemaining = 0;
    fieldClearDelayTimer = 0;
    isWaveTimerAccelerated = false;
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
            color: proto.color || grp.color,
            glow: proto.glow || grp.glow,
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
    if (devMode && typeof refreshDevDropdowns === 'function') refreshDevDropdowns();
    saveActiveBattleSnapshot();
    saveGameSoon();
    return;
  }

  const lvlConfig = LEVELS_DATA[currentLevel];
  const maxW = lvlConfig ? lvlConfig.totalWaves : 10;
  if (wave > maxW) return;

  waveInProgress = true;
  waveTimerActive = false;
  autoWaveTimeRemaining = 0;
  fieldClearDelayTimer = 0;
  isWaveTimerAccelerated = false;
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
          color: proto.color || grp.color,
          glow: proto.glow || grp.glow,
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
  if (devMode && typeof refreshDevDropdowns === 'function') refreshDevDropdowns();
  saveActiveBattleSnapshot();
  saveGameSoon();
}

// Developer Tools & Spawner Integration: Custom spawner injections, dev controls, and cheat handlers.
// [ENG.DB]
function handleDevSpawnClick() {
  if (!devMode || gameState !== 'PLAYING') return;
  const typeSel = document.getElementById('devSpawnType');
  const countEl = document.getElementById('devSpawnCount');
  const intEl = document.getElementById('devSpawnInterval');
  
  if (typeSel && countEl && intEl) {
    const type = typeSel.value;
    const count = parseInt(countEl.value, 10) || 1;
    const interval = parseFloat(intEl.value) || 0.5;
    injectCustomSpawn(type, count, interval, 1.0, 1.0);
  }
}

// [ENG.DC]
function onDomReady() {
  if (window.__APP_STAGE__ === 'development') {
    import('./dev/ota-service.dev.js')
      .then(m => m.runOtaUpdate())
      .catch(err => console.warn('[DevSync] Not loaded:', err));
  } else {
    // Production mode: читаем только локальный манифест для версии и легальной докачки музыки (.ogg)
    fetch('update_manifest.json?t=' + Date.now(), { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(manifest => {
        if (!manifest) return;
        if (manifest.version) {
          window.APP_VERSION = String(manifest.version);
          const verLabel = document.getElementById('settingsVersionLabel');
          if (verLabel) {
            verLabel.textContent = (typeof t === 'function')
              ? t('version_label', { v: window.APP_VERSION })
              : `Version: ${window.APP_VERSION}`;
          }
        }
        if (window.MusicDownloader) {
          window.MusicDownloader.setManifest(manifest);
          window.MusicDownloader.startBackgroundDownload(manifest);
        }
      })
      .catch(() => {});
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', onDomReady);
} else {
  onDomReady();
}

// [ENG.DD]
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

// Performance Monitor & Main Game Loop: Dynamic performance downgrades and main requestAnimationFrame loop.
// [ENG.DE]
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

// [ENG.DF]
function gameLoop(now) {
  sfxReap();
  const rawDt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  // Расчет коэффициента плавного разгона игры после паузы
  let rampMult = 1.0;
  if (resumeRampTimer > 0 && gameState === 'PLAYING' && !isLivePaused) {
    resumeRampTimer = Math.max(0, resumeRampTimer - rawDt);
    const progress = 1.0 - (resumeRampTimer / RESUME_RAMP_DURATION);
    // Плавное ускорение от RESUME_RAMP_START_MULT (0.5) до 1.0
    rampMult = RESUME_RAMP_START_MULT + (1.0 - RESUME_RAMP_START_MULT) * progress;
  }

  const dt = isLivePaused ? 0 : rawDt * gameTimeScale * rampMult;

  samplePerfAndMaybeDowngrade(rawDt);

  if (gameState === 'PLAYING' && dt > 0) {
    update(dt);
  }
  render(now);
  requestAnimationFrame(gameLoop);
}

// Navigation & Screen Transition Helpers: Start screen, level selection, and chapter label controllers.
// Simulation Step Update Pipeline: Enemy movement, tower targeting, projectile physics, and status effects.
// javascript-obfuscator: disable
// [ENG.DPM] Вспомогательные функции физических реакций врагов на попадание (ENEMY_REACTIONS)
function normalizeAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function applyEnemyHitReaction(e, dirAngle, isBeam) {
  if (!e || typeof ENEMY_REACTIONS === 'undefined' || !ENEMY_REACTIONS) return;
  const hasAngle = (typeof dirAngle === 'number' && isFinite(dirAngle));
  if (ENEMY_REACTIONS.knockback && !isBeam && !e.isBoss && hasAngle) {
    e.kbX = Math.cos(dirAngle) * 3.5;
    e.kbY = Math.sin(dirAngle) * 3.5;
  }
  if (ENEMY_REACTIONS.jitter) {
    e.jitterTimer = 0.105;
  }
  if (ENEMY_REACTIONS.hitTilt && !isBeam && hasAngle) {
    const relAngle = normalizeAngle(dirAngle - (e.angle || 0));
    e.hitTilt = (relAngle >= 0 ? 1 : -1) * 0.14;
  }
}

// [ENG.DQ]
function update(dt) {
  if (cameraShakeTimer > 0) {
    cameraShakeTimer -= dt;
    if (cameraShakeTimer <= 0) {
      cameraShakeTimer = 0;
      cameraShakeMaxDur = 0;
      cameraShakeIntensity = 0;
    }
  }

  // Расчет плавной разморозки с защитой от NaN / деления на 0
  let thawMult = 1.0;
  if (typeof resumeThawTimer !== 'undefined' && resumeThawTimer > 0) {
    resumeThawTimer = Math.max(0, resumeThawTimer - dt);
    const dur = (typeof RESUME_THAW_DURATION === 'number' && RESUME_THAW_DURATION > 0) ? RESUME_THAW_DURATION : 0.3;
    const startMult = (typeof RESUME_START_SPEED_MULT === 'number') ? RESUME_START_SPEED_MULT : 0.2;
    const thawProg = Math.min(1.0, Math.max(0, 1.0 - resumeThawTimer / dur));
    thawMult = startMult + (1.0 - startMult) * thawProg;
  }
  if (!isFinite(thawMult) || thawMult <= 0) thawMult = 1.0;

  const lvlConfig = LEVELS_DATA[currentLevel];
  const maxW = lvlConfig ? lvlConfig.totalWaves : 10;
  const btn = el('waveBtn');
  const btnText = el('waveBtnText');

  if (waveInProgress && spawnQueue.length > 0) waveSpawnElapsedTime += dt;
  updateWaveCircle(dt);

  // [ENG.EA] Предупреждение о приближении босса
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

  // [ENG.EB] Кнопка Go и таймер между волнами
  const goLabel = (typeof t === 'function' ? t('go') : 'Go');
  if (waveTimerActive && autoWaveTimeRemaining > 0) {
    if (enemies.length === 0 && spawnQueue.length === 0) {
      fieldClearDelayTimer += dt;
    } else {
      fieldClearDelayTimer = 0;
    }

    const canAccelerate = (fieldClearDelayTimer >= 0.30) && (autoWaveTimeRemaining > 0.75);
    isWaveTimerAccelerated = canAccelerate;

    const timerSpeedMult = canAccelerate ? 2.0 : 1.0;
    autoWaveTimeRemaining -= dt * timerSpeedMult;

    if (autoWaveTimeRemaining <= 0) {
      autoWaveTimeRemaining = 0;
      waveTimerActive = false;
      isWaveTimerAccelerated = false;
      fieldClearDelayTimer = 0;
      if (isEndlessMode || wave < maxW) {
        if (isEndlessMode) {
          addBpXp(5);
        }
        wave++;
        startWave();
      }
    } else {
      if (btn) btn.disabled = false;
      if (btnText) btnText.textContent = goLabel;
    }
  } else {
    isWaveTimerAccelerated = false;
    fieldClearDelayTimer = 0;
  }

  // Спавн мобов из очереди на карту
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

      const initAngle = Math.atan2(WAYPOINTS[1].y - WAYPOINTS[0].y, WAYPOINTS[1].x - WAYPOINTS[0].x);
      const spawnedEnemy = {
        x: spawnX,
        y: spawnY,
        laneOffset: eData.laneOffset || 0,
        angle: initAngle,
        wpIndex: 1,
          type: eData.type,
          isBoss: !!eData.isBoss,
          isMiniBoss: !!eData.isMiniBoss,
          shape: eData.shape,
          color: eData.color,
          glow: eData.glow,
          hp: eData.hp,
          maxHp: eData.hp,
          speed: eData.speed,
          baseSpeed: eData.speed,
          bounty: eData.bounty,
          radius: eData.radius,
          shieldTimer: 0,
          isShielded: false,
          warpTimer: 0,
          dashTimer: 0,
          summonTimer: 0,
          empTimer: 0,
          slowTimer: 0,
          spawnTimer: 0.22,
          spawnDuration: 0.22
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
        if (typeof spawnEnemySpawnFx === 'function') {
          spawnEnemySpawnFx(spawnX, spawnY, spawnedEnemy);
        }
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
          if (btnText) btnText.textContent = goLabel;
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
          if (btnText) btnText.textContent = goLabel;
        }
      }
    }
  }

  // Обновление состояния и перемещение врагов
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];

    // Пружинящий возврат физических реакций (ENEMY_REACTIONS) и таймер материализации
    if (e.kbX) e.kbX *= Math.exp(-18 * dt);
    if (e.kbY) e.kbY *= Math.exp(-18 * dt);
    if (e.hitTilt) e.hitTilt *= Math.exp(-14 * dt);
    if (e.jitterTimer > 0) e.jitterTimer = Math.max(0, e.jitterTimer - dt);
    if (e.spawnTimer > 0) e.spawnTimer = Math.max(0, e.spawnTimer - dt);

    // Анимация ударной волны базы при Revive
    if (e.revivePushAnim) {
      e.revivePushAnim.timer += dt;
      const prog = Math.min(1.0, e.revivePushAnim.timer / e.revivePushAnim.duration);
      const ease = 1 - Math.pow(1 - prog, 3);
      e.x = e.revivePushAnim.startX + (e.revivePushAnim.endX - e.revivePushAnim.startX) * ease;
      e.y = e.revivePushAnim.startY + (e.revivePushAnim.endY - e.revivePushAnim.startY) * ease;

      if (Math.random() < 0.4 && typeof createImpactSmoke === 'function') {
        createImpactSmoke(e.x, e.y, 8);
      }

      if (prog >= 1.0) {
        e.x = e.revivePushAnim.endX;
        e.y = e.revivePushAnim.endY;
        e.wpIndex = e.revivePushAnim.endWp;
        e.revivePushAnim = null;
      }
      continue;
    }

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
        const isEndlessArena1 = (typeof isEndlessMode !== 'undefined' && isEndlessMode) && 
          ((typeof currentLevelSection === 'undefined') || currentLevelSection === 1);
        let dashRemaining = isEndlessArena1 ? 70 : 140;

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
        const swCol = (typeof ENEMY_CONFIGS !== 'undefined' && ENEMY_CONFIGS.swarm) ? ENEMY_CONFIGS.swarm.color : '#00ffcc';
        const swGlow = (typeof ENEMY_CONFIGS !== 'undefined' && ENEMY_CONFIGS.swarm) ? ENEMY_CONFIGS.swarm.glow : swCol;
        createShockwave(e.x, e.y, 65, swCol);
        for (let s = 0; s < 3; s++) {
          const drone = {
            x: e.x + (Math.random() - 0.5) * 16,
            y: e.y + (Math.random() - 0.5) * 16,
            angle: e.angle,
            wpIndex: e.wpIndex,
            type: 'swarm',
            isBoss: false,
            isMiniBoss: false,
            shape: 'diamond',
            color: swCol,
            glow: swGlow,
            hp: 20,
            maxHp: 20,
            speed: 95,
            baseSpeed: 95,
            bounty: 3,
            radius: 8,
            slowTimer: 0,
            spawnTimer: 0.22,
            spawnDuration: 0.22
          };
          enemies.push(drone);
          if (typeof spawnEnemySpawnFx === 'function') {
            spawnEnemySpawnFx(drone.x, drone.y, drone);
          }
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

    const effectiveSpeed = e.speed * (isOverdriveMode ? 1.2 : 1.0) * thawMult;
    let remainingStep = effectiveSpeed * dt;
    let reachedBase = false;

    const getWpPosWithOffset = (idx) => {
      const wpCurr = WAYPOINTS[idx];
      let tx = wpCurr.x;
      let ty = wpCurr.y;
      if (e.laneOffset) {
        const prevWp = WAYPOINTS[idx - 1] || WAYPOINTS[0];
        const nextWp = WAYPOINTS[idx + 1];
        const segDx = wpCurr.x - prevWp.x;
        const segDy = wpCurr.y - prevWp.y;
        const segLen = Math.hypot(segDx, segDy) || 1;
        let offX = -segDy / segLen;
        let offY = segDx / segLen;
        if (nextWp) {
          const seg2Dx = nextWp.x - wpCurr.x;
          const seg2Dy = nextWp.y - wpCurr.y;
          const seg2Len = Math.hypot(seg2Dx, seg2Dy) || 1;
          offX += -seg2Dy / seg2Len;
          offY += seg2Dx / seg2Len;
        }
        const offLen = Math.hypot(offX, offY);
        if (offLen > 1e-4) {
          tx += (offX / offLen) * e.laneOffset;
          ty += (offY / offLen) * e.laneOffset;
        }
      }
      return { x: tx, y: ty };
    };

    while (remainingStep > 0 && e.wpIndex < WAYPOINTS.length) {
      const targetPt = getWpPosWithOffset(e.wpIndex);
      const dx = targetPt.x - e.x;
      const dy = targetPt.y - e.y;
      const dist = Math.hypot(dx, dy);

      if (dist <= remainingStep) {
        e.x = targetPt.x;
        e.y = targetPt.y;
        remainingStep -= dist;
        e.wpIndex++;
        if (e.wpIndex >= WAYPOINTS.length) {
          reachedBase = true;
          break;
        }
      } else {
        e.x += (dx / dist) * remainingStep;
        e.y += (dy / dist) * remainingStep;
        remainingStep = 0;
      }
    }

    // Непрерывное сглаживание угла корпуса с упреждением на 14px вперёд по траектории (без ступенек)
    if (!reachedBase && e.wpIndex < WAYPOINTS.length) {
      let lookDist = 14.0;
      let lx = e.x;
      let ly = e.y;
      let lIdx = e.wpIndex;

      while (lookDist > 0 && lIdx < WAYPOINTS.length) {
        const pt = getWpPosWithOffset(lIdx);
        const ldx = pt.x - lx;
        const ldy = pt.y - ly;
        const ld = Math.hypot(ldx, ldy);
        if (ld <= lookDist) {
          lx = pt.x;
          ly = pt.y;
          lookDist -= ld;
          lIdx++;
        } else {
          lx += (ldx / ld) * lookDist;
          ly += (ldy / ld) * lookDist;
          lookDist = 0;
        }
      }

      const aimDx = lx - e.x;
      const aimDy = ly - e.y;
      if (aimDx * aimDx + aimDy * aimDy > 0.0001) {
        const desiredAngle = Math.atan2(aimDy, aimDx);
        if (typeof e.angle !== 'number' || !isFinite(e.angle)) {
          e.angle = desiredAngle;
        } else {
          let diff = desiredAngle - e.angle;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          // Экспоненциальный фильтр: поворот пропорционален скорости моба и абсолютно плавный на каждом кадре
          const turnRate = Math.max(8.0, (effectiveSpeed / 45) * 9.5);
          const blend = 1 - Math.exp(-turnRate * dt);
          e.angle += diff * blend;
        }
      }
    }

    if (reachedBase) {
      const damageToBasePath = getBaseDamageFor(e);
      baseHp = Math.max(0, baseHp - damageToBasePath);
      saveActiveBattleSnapshot();
      saveGameSoon();
      sfx('baseHit');
      if (typeof spawnEnemyBaseHitFx === 'function') {
        spawnEnemyBaseHitFx(e.x, e.y, e);
      } else {
        createShockwave(e.x, e.y, e.isBoss ? 80 : (e.isMiniBoss ? 50 : 35), '#f05f9f');
      }
      if (e.isBoss || damageToBasePath >= 4) {
        triggerImpactFeedback('heavy', 'heavy', { dur: 0.40, intensity: 14 });
      } else if (e.isMiniBoss || (damageToBasePath >= 2 && damageToBasePath <= 3)) {
        triggerImpactFeedback('medium', 'heavy');
      } else if (damageToBasePath === 1) {
        triggerImpactFeedback('light', 'light');
      }
      enemies.splice(i, 1);
      updateUI();
      if (baseHp <= 0) {
        baseHp = 0;
        if (!reviveUsedThisMatch && !isOverdriveMode) {
          triggerEmergencyRevivePrompt();
          return;
        }
        triggerDefeat();
        return;
      }
      continue;
    }
  }

  // Обновление и стрельба башен
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
        t.shotIndex = ((t.shotIndex || 0) + 1) % 2;
        sfx('gun');
        const barrelSide = (t.shotIndex === 0) ? -3.6 : 3.6;
        const cosA = Math.cos(t.angle);
        const sinA = Math.sin(t.angle);
        const mx = t.x + cosA * 24 - sinA * barrelSide;
        const my = t.y + sinA * 24 + cosA * barrelSide;
        projectiles.push({
          type: 'bullet',
          x: mx,
          y: my,
          target: target,
          damage: t.damage,
          speed: 460,
          color: t.color,
          hasTrail: true
        });
      }
    }

    if (t.type === 'laser') {
      const isFiring = target && isLockedOn && !target.isShielded && t.disabledTimer <= 0;

      if ((!isFiring || t.accumTarget !== target) && t.accumDamage >= 1) {
        const flushX = t.accumTarget ? t.accumTarget.x : t.x;
        const flushY = t.accumTarget ? t.accumTarget.y : t.y;
        if (typeof createFloatingDamage === 'function') {
          createFloatingDamage(flushX, flushY, t.accumDamage, t.color || '#f05f9f');
        }
        t.accumDamage = 0;
        t.accumTimer = 0;
      }

      if (isFiring) {
        sfx('laserHit');
        const dDmg = t.damage * dt;
        target.hp -= dDmg;
        checkEnemyEnrage(target);

        t.accumTarget = target;
        t.accumDamage = (t.accumDamage || 0) + dDmg;
        t.accumTimer = (t.accumTimer || 0) + dt;

        if (t.accumTimer >= 1.0) {
          if (typeof createFloatingDamage === 'function' && t.accumDamage >= 1) {
            createFloatingDamage(target.x, target.y, t.accumDamage, t.color || '#f05f9f');
          }
          t.accumDamage = 0;
          t.accumTimer -= 1.0;
        }

        applyEnemyHitReaction(target, t.angle, true);
        t.fxAccum = (t.fxAccum || 0) + dt;
        if (t.fxAccum >= 0.10) {
          t.fxAccum -= 0.10;
          if (t.fxAccum >= 0.10) t.fxAccum = 0;
          if (typeof createHitImpactFx === 'function') {
            createHitImpactFx(target.x, target.y, t.color || '#f05f9f', 'bullet', t.angle);
          } else {
            createDamageShards(target.x, target.y, target.color, dDmg * 4, false);
          }
          if (Math.random() < 0.5) createImpactSmoke(target.x, target.y, 8);
        }
      } else {
        t.accumTarget = null;
        t.fxAccum = 0;
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
          targetX: target.x,
          targetY: target.y,
          targetRef: target,
          damage: t.damage,
          splash: t.blastRadius || (TOWER_CONFIGS.mortar.splash * (1 + (t.level - 1) * 0.15)),
          duration: t.mortarTravelTime || MORTAR_BASE_TRAVEL_TIME || 1.0,
          elapsed: 0,
          startX: launchX,
          startY: launchY,
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
        const maxChains = t.chainCount || ((TOWER_CONFIGS.tesla.chainTargets || 3) + Math.max(0, (t.level || 1) - 1));
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
            const stasisPowerLvl = getBattleUpgradeEffectiveLevel('stasis_power');
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
      const isFiring = target && isLockedOn && !target.isShielded && t.melterCoolingTimer <= 0 && t.disabledTimer <= 0;

      if ((!isFiring || t.accumTarget !== target) && t.accumDamage >= 1) {
        const flushX = t.accumTarget ? t.accumTarget.x : t.x;
        const flushY = t.accumTarget ? t.accumTarget.y : t.y;
        if (typeof createFloatingDamage === 'function') {
          createFloatingDamage(flushX, flushY, t.accumDamage, t.color || '#e85268');
        }
        t.accumDamage = 0;
        t.accumTimer = 0;
      }

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
          const dDmg = t.damage * rampMultiplier * dt;
          target.hp -= dDmg;

          t.accumTarget = target;
          t.accumDamage = (t.accumDamage || 0) + dDmg;
          t.accumTimer = (t.accumTimer || 0) + dt;

          if (t.accumTimer >= 1.0) {
            if (typeof createFloatingDamage === 'function' && t.accumDamage >= 1) {
              createFloatingDamage(target.x, target.y, t.accumDamage, t.color || '#e85268');
            }
            t.accumDamage = 0;
            t.accumTimer -= 1.0;
          }

          applyEnemyHitReaction(target, t.angle, true);
          t.fxAccum = (t.fxAccum || 0) + dt;
          if (t.fxAccum >= 0.10) {
            t.fxAccum -= 0.10;
            if (t.fxAccum >= 0.10) t.fxAccum = 0;
            const sparkCol = rampProgress > 0.7 ? '#ffffff' : (rampProgress > 0.35 ? '#fb923c' : (t.color || '#e85268'));
            if (typeof createHitImpactFx === 'function') {
              createHitImpactFx(target.x, target.y, sparkCol, 'bullet', t.angle);
            } else {
              createDamageShards(target.x, target.y, target.color, dDmg * 3, false);
            }
            createImpactSmoke(target.x, target.y, 9 + rampProgress * 6);
          }
        } else {
          t.fxAccum = 0;
        }

        checkEnemyEnrage(target);

        if (t.melterFireTimer >= rampTime) {
          if (t.accumDamage >= 1 && typeof createFloatingDamage === 'function') {
            createFloatingDamage(target.x, target.y, t.accumDamage, t.color || '#e85268');
            t.accumDamage = 0;
            t.accumTimer = 0;
          }
          t.melterCoolingTimer = t.melterCooldownTime || rampTime;
          t.melterFireTimer = 0;
          createDamageShards(t.x, t.y, '#fb923c', 25, false);
          for (let s = 0; s < 7; s++) createSteamPuff(t.x, t.y - 9);
        }
      } else {
        t.accumTarget = null;
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

        const rMuzzleDist = (typeof TOWER_GLYPH_SPECS !== 'undefined' && TOWER_GLYPH_SPECS.railgun && TOWER_GLYPH_SPECS.railgun.muzzle)
          ? TOWER_GLYPH_SPECS.railgun.muzzle.atX : 26;
        const rMx = t.x + Math.cos(t.angle) * rMuzzleDist;
        const rMy = t.y + Math.sin(t.angle) * rMuzzleDist;

        const beamLength = 3500;
        const beamEndX = t.x + Math.cos(t.angle) * beamLength;
        const beamEndY = t.y + Math.sin(t.angle) * beamLength;
        let railShardCount = 0;
        let nonSwarmKills = 0;

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
            const wasAlive = e.hp > 0;
            e.hp -= t.damage;
            if (wasAlive && e.hp <= 0 && e.type !== 'swarm') {
              nonSwarmKills++;
            }
            checkEnemyEnrage(e);
            applyEnemyHitReaction(e, t.angle, false);
            if (typeof createFloatingDamage === 'function') {
              createFloatingDamage(e.x, e.y, t.damage, t.color || '#a275df');
            }
            if (typeof createHitImpactFx === 'function') {
              createHitImpactFx(e.x, e.y, t.color || '#a275df', 'railgun', t.angle);
            }
            if (railShardCount < 4) {
              createDamageShards(e.x, e.y, e.color, t.damage, false);
              if (typeof createImpactSmoke === 'function') createImpactSmoke(e.x, e.y, 12);
              railShardCount++;
            }
          }
        }

        if (nonSwarmKills >= 8) {
          triggerImpactFeedback('heavy', 'light', { dur: 0.35, intensity: 12 });
        } else if (nonSwarmKills >= 4) {
          triggerImpactFeedback('medium', 'light', { isMultiKill: true });
        }

        if (typeof createRailBeamFx === 'function') {
          createRailBeamFx(t.x, t.y, beamEndX, beamEndY, t.color || '#00e5ff');
        }
      }
    }
  });

// Полет пуль и снарядов мортиры
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    if (p.type === 'bullet') {
      if (!enemies.includes(p.target)) { projectiles.splice(i, 1); continue; }
      const dx = p.target.x - p.x;
      const dy = p.target.y - p.y;
      const dist = Math.hypot(dx, dy);
      const step = p.speed * dt;
      const hitAngle = Math.atan2(dy, dx);

      if (dist <= step) {
        if (!p.target.isShielded) {
          p.target.hp -= p.damage;
          checkEnemyEnrage(p.target);
          if (typeof createFloatingDamage === 'function') {
            createFloatingDamage(p.target.x, p.target.y, p.damage, p.color || '#00e5ff');
          }
          applyEnemyHitReaction(p.target, hitAngle, false);
          if (typeof createHitImpactFx === 'function') {
            createHitImpactFx(p.target.x, p.target.y, p.color || '#00e5ff', 'bullet', hitAngle);
          } else {
            createShockwave(p.target.x, p.target.y, 14, p.color || '#00e5ff');
          }
          createDamageShards(p.target.x, p.target.y, p.target.color, p.damage, false);
          createImpactSmoke(p.target.x, p.target.y, 11);
        } else {
          if (typeof createHitImpactFx === 'function') {
            createHitImpactFx(p.target.x, p.target.y, '#60a5fa', 'shield', hitAngle);
          }
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
        let hitCount = 0;
        let nonSwarmKills = 0;

        for (let j = 0; j < enemies.length; j++) {
          const e = enemies[j];
          const dx = e.x - p.targetX;
          const dy = e.y - p.targetY;
          const distSq = dx * dx + dy * dy;

          if (distSq <= splashSq && !e.isShielded) {
            hitCount++;
            if (!hitEnemyColor) hitEnemyColor = e.color;
            const d = Math.sqrt(distSq);
            const splashDmg = p.damage * (1 - d / (p.splash * 1.3));
            const wasAlive = e.hp > 0;
            e.hp -= splashDmg;
            if (wasAlive && e.hp <= 0 && e.type !== 'swarm') {
              nonSwarmKills++;
            }
            checkEnemyEnrage(e);
            const blastDir = Math.atan2(e.y - p.targetY, e.x - p.targetX);
            applyEnemyHitReaction(e, blastDir, false);
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
        if (nonSwarmKills >= 8) {
          triggerImpactFeedback('heavy', 'light', { dur: 0.35, intensity: 12 });
        } else if (nonSwarmKills >= 4) {
          triggerImpactFeedback('medium', 'light', { isMultiKill: true });
        } else if (hitCount > 0) {
          triggerImpactFeedback('light', 'light', { isSplash: true });
        }
        createExplosion(p.targetX, p.targetY, p.splash, p.color || '#ff9100', '#f05f9f', 'mortar');
        projectiles.splice(i, 1);
      }
    }
  }

  // Гибель врагов
  let enemyKilledThisTick = false;
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    if (e.hp <= 0) {
      enemyKilledThisTick = true;
      sessionMobKillsCount++;
      if (sessionMobKillsCount % 5 === 0) {
        addBpXp(1);
      }
      const moneyMultiplier = 1 + getBattleUpgradeEffectiveLevel('base_gold') * 0.05;
      gold += Math.round(e.bounty * moneyMultiplier);
      sfxDeath(e);

      if (e.type === 'emp_bomber') {
        sfx('stasis');
        createShockwave(e.x, e.y, 110, '#f05f9f');
        if (typeof createExplosion === 'function') {
          createExplosion(e.x, e.y, 48, '#f05f9f', '#38bdf8', 'standard');
        }
        towers.forEach(t => {
          if (Math.hypot(t.x - e.x, t.y - e.y) <= 110) {
            t.disabledTimer = Math.max(t.disabledTimer || 0, 3.0);
            sfx('steam');
            createDamageShards(t.x, t.y, '#f05f9f', 16, false);
          }
        });
      }

      if (e.isBoss || e.isMiniBoss) {
        if (e.isBoss) {
          triggerImpactFeedback('heavy', 'heavy', { dur: 0.38, intensity: 14 });
        } else {
          triggerImpactFeedback('medium', 'light');
        }
        createExplosion(e.x, e.y, e.isBoss ? 52 : 28, e.color, e.glow || e.color, 'boss');
      } else if (e.isElite) {
        triggerImpactFeedback('medium', 'light');
      }

      createDamageShards(e.x, e.y, e.color, e.isBoss ? 120 : (e.isMiniBoss ? 60 : 35), true);
      enemies.splice(i, 1);
    }
  }
  if (enemyKilledThisTick) {
    updateUI();
  }

  // Частицы (с физическим торможением drag для искр и осколков)
  for (let i = particles.length - 1; i >= 0; i--) {
    const pt = particles[i];
    if (pt.drag) {
      const damping = Math.pow(pt.drag, dt * 60);
      pt.vx *= damping;
      pt.vy *= damping;
    }
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.life -= dt;
    if (pt.life <= 0) particles.splice(i, 1);
  }

  // Ударные волны
  for (let i = shockwaves.length - 1; i >= 0; i--) {
    const sw = shockwaves[i];
    sw.elapsed += dt;
    if (sw.elapsed >= sw.duration) shockwaves.splice(i, 1);
  }

  // Разряды молний Tesla
  for (let i = lightningBolts.length - 1; i >= 0; i--) {
    const lb = lightningBolts[i];
    if (lb.delay && lb.delay > 0) {
      lb.delay -= dt;
      continue;
    }
    lb.elapsed = (lb.elapsed || 0) + dt;
    lb.life -= dt;

    if (!lb.hasDealtDamage && !lb.targetRef.isShielded && enemies.includes(lb.targetRef)) {
      lb.hasDealtDamage = true;
      lb.targetRef.hp -= lb.damage;
      checkEnemyEnrage(lb.targetRef);

      if (typeof createFloatingDamage === 'function') {
        createFloatingDamage(lb.targetRef.x, lb.targetRef.y, lb.damage, lb.towerColor || lb.color || '#00ffcc');
      }

      const chainDir = Math.atan2(lb.targetRef.y - lb.y1, lb.targetRef.x - lb.x1);
      applyEnemyHitReaction(lb.targetRef, chainDir, false);
      if (typeof createHitImpactFx === 'function') {
        createHitImpactFx(lb.x2, lb.y2, lb.towerColor || lb.color || '#00ffcc', 'tesla');
      }

      if (Math.random() < 0.6) {
        if (typeof createDamageShards === 'function') {
          createDamageShards(lb.x2, lb.y2, lb.targetRef.color, lb.damage, false);
        } else {
          createSparks(lb.x2, lb.y2, lb.towerColor || lb.color || '#00ffcc', 3, lb.targetRef.color);
        }
      }
    }

    if (lb.life <= 0) lightningBolts.splice(i, 1);
  }

  // Проверка завершения матча (Победа)
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
