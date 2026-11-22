// ============================================================================
// Synth Wave Defense -- engine_meta.js (Part 2 of 3)
// Endless progression & wave generator, Tech Tree & loadout management,
// level lifecycle (start/reset/pause/back/victory/defeat/revive), ads UI,
// daily gifts, currency exchange, and shop perks.
// Load order: engine_state.js -> engine_meta.js -> engine_combat.js
// ============================================================================

// [ENG.V]
function resetEndlessDailyRunsIfNeeded() {
  const todayStr = new Date().toISOString().slice(0, 10);
  if (endlessDailyRunsDate !== todayStr) {
    endlessDailyRunsDate = todayStr;
    endlessDailyRunsUsed = 0;
  }
}

// [ENG.X]
function getEndlessEntryStatus() {
  resetEndlessDailyRunsIfNeeded();

  let diamondCost = 25;
  if (endlessDailyRunsUsed === 4) {
    diamondCost = 50;
  } else if (endlessDailyRunsUsed >= 5) {
    diamondCost = 100;
  }

  // 1-й вход: бесплатно
  if (endlessDailyRunsUsed === 0) {
    return { type: 'free', text: 'FREE (1/1)', label: 'FREE (1/1)', cost: 0 };
  } else if (endlessDailyRunsUsed < 3) {
    // 2-й и 3-й заходы: строго за просмотр Rewarded Video
    const remainingAdRuns = 3 - endlessDailyRunsUsed;
    return { type: 'ad', text: `WATCH AD (${remainingAdRuns}/2)`, label: `WATCH AD (${remainingAdRuns}/2)`, cost: 0 };
  } else {
    // 4-й и далее: за алмазы
    return { 
      type: 'diamonds', 
      text: `${diamondCost} DIAMONDS`, 
      label: `${diamondCost} DIAMONDS`, 
      cost: diamondCost 
    };
  }
}

window.getEndlessEntryStatus = getEndlessEntryStatus;

// [ENG.Y] - Оставляем генератор волн без изменений (он идет следом в коде)
function generateEndlessWaveData(w) {
  const arena = (typeof currentLevelSection !== 'undefined') ? Math.min(5, Math.max(1, currentLevelSection)) : 1;
  const cWave = ((w - 1) % 20) + 1; // Позиция внутри 20-волнового цикла (1..20)
  const isSecondHalf = cWave > 10; // Вторые 10 волн цикла сложнее первых 10

  // 1. СТУПЕНЧАТАЯ КРИВАЯ HP С ЗАПАСОМ СЛОЖНОСТИ (Контрольные стены: 10 / 20 / 40 / 60 / 80 / <100)
  let hpScalingMult = 1.0;
  if (w === 1) {
    hpScalingMult = 0.90; // Мягкий старт на 1-й волне
  } else if (w === 2) {
    hpScalingMult = 1.15;
  } else if (w === 3) {
    hpScalingMult = 1.45;
  } else if (w <= 10) {
    // Волны 4–10: крутой разгон к стене 10-й волны (потолок для 0/10 Tech Tree)
    hpScalingMult = 1.45 * Math.pow(1.31, w - 3);
  } else if (w <= 20) {
    // Волны 11–20: стена 20-й волны (потолок для 4/10 Tech Tree)
    const w10 = 1.45 * Math.pow(1.31, 7); // ~9.62
    hpScalingMult = w10 * Math.pow(1.135, w - 10);
  } else if (w <= 40) {
    // Волны 21–40: стена 40-й волны (потолок для 6/10 Tech Tree)
    const w20 = 1.45 * Math.pow(1.31, 7) * Math.pow(1.135, 10); // ~34.1
    hpScalingMult = w20 * Math.pow(1.062, w - 20);
  } else if (w <= 60) {
    // Волны 41–60: стена 60-й волны (потолок для 8/10 Tech Tree)
    const w40 = 1.45 * Math.pow(1.31, 7) * Math.pow(1.135, 10) * Math.pow(1.062, 20); // ~113.6
    hpScalingMult = w40 * Math.pow(1.055, w - 40);
  } else if (w <= 80) {
    // Волны 61–80: стена 80-й волны (потолок для 10/10 Tech Tree)
    const w60 = 1.45 * Math.pow(1.31, 7) * Math.pow(1.135, 10) * Math.pow(1.062, 20) * Math.pow(1.055, 20); // ~331.5
    hpScalingMult = w60 * Math.pow(1.058, w - 60);
  } else {
    // Волны 81+: Финальный заслон для Ascended 15/15 + SYNTH (непроходимо к 95–100 волне)
    const w80 = 1.45 * Math.pow(1.31, 7) * Math.pow(1.135, 10) * Math.pow(1.062, 20) * Math.pow(1.055, 20) * Math.pow(1.058, 20); // ~1024
    hpScalingMult = w80 * Math.pow(1.14, w - 80);
  }

  // Надбавка сложности во второй половине 20-волнового цикла (волны 11-19 цикла плотнее на 12%)
  if (isSecondHalf && cWave !== 20) {
    hpScalingMult *= 1.12;
  }

  // Множитель HP от самой Арены (чем выше глава карты, тем крепче враги со старта)
  const arenaHpFactor = [1.0, 1.0, 1.12, 1.25, 1.38, 1.50][arena] || 1.0;
  hpScalingMult *= arenaHpFactor;

  // 2. ПРОГРЕССИЯ СКОРОСТИ И КОЛИЧЕСТВА МОБОВ
  const spdMult = Math.min(2.05, 1 + (w - 1) * 0.015 + (isSecondHalf ? 0.05 : 0));

  // Масштаб толпы: на 1-3 волнах мало врагов, к 40-80 волнам идут массированные армии
  const crowdScale = Math.min(4.2, 1 + (w - 1) * 0.055 + (isSecondHalf ? 0.25 : 0));

  // 3. ЭКОНОМИКА С УЧЕТОМ РАСТУЩЕГО БОНУСА КНОПКИ "GO"
  // Так как бонус за ранний вызов волны (15 + w * 1.5) растет, награда за самих мобов плавно сжимается,
  // чтобы игрок не смог застроить мусорные краевые слоты
  const targetWaveBounty = w <= 6 ? 75 : Math.max(18, Math.round(78 - (w - 6) * 1.15));

  const spawns = [];


  // БОССЫ ЦИКЛА: ВОЛНА 10 (МЛАДШИЙ БОСС) И ВОЛНА 20 (СТАРШИЙ БОСС)
  if (cWave === 10 || cWave === 20) {
    const isMajorBoss = (cWave === 20); // На 20, 40, 60, 80, 100 волнах — главный босс!

    // Выбор босса строго по главам Normal Mode для каждой Арены
    let bossType = 'tank';
    if (arena === 1) {
      // Арена 1 (Главы 1–2): W10 -> Mega Tank (босс Гл.1), W20 -> Hive Empress (босс Гл.2)
      bossType = isMajorBoss ? 'hive_empress' : 'tank';
    } else if (arena === 2) {
      // Арена 2 (Главы 1–3): W10 -> Hive Empress (Гл.2), W20 -> Chronos Warp (босс Гл.3)
      bossType = isMajorBoss ? 'chronos_warp' : 'hive_empress';
    } else if (arena === 3) {
      // Арена 3 (Главы 1–4): W10 -> Chronos Warp (Гл.3), W20 -> Titan Core (босс Гл.4)
      bossType = isMajorBoss ? 'titan_core' : 'chronos_warp';
    } else if (arena === 4) {
      // Арена 4 (Главы 1–5): W10 -> Titan Core (Гл.4), W20 -> EMP Overlord (босс Гл.5)
      bossType = isMajorBoss ? 'emp_overlord' : 'titan_core';
    } else {
      // Арена 5 (Главы 1–5, Альтернативная): W10 -> чередование Titan / Chronos, W20 -> EMP Overlord
      bossType = isMajorBoss ? 'emp_overlord' : ((Math.floor(w / 20) % 2 === 0) ? 'titan_core' : 'chronos_warp');
    }
    const protoBoss = (typeof ENEMY_CONFIGS !== 'undefined' && ENEMY_CONFIGS[bossType]) ? ENEMY_CONFIGS[bossType] : null;
    let bColor = protoBoss ? protoBoss.color : '#a06fdc';
    let bGlow = protoBoss ? protoBoss.glow : bColor;
    let bShape = protoBoss ? protoBoss.shape : 'octagon';
    let bBaseSpeed = 30;
    if (bossType === 'tank') { bShape = 'square'; bBaseSpeed = 29; }
    else if (bossType === 'hive_empress') { bShape = 'diamond'; bBaseSpeed = 36; }
    else if (bossType === 'chronos_warp') { bShape = 'hexagon'; bBaseSpeed = 38; }
    else if (bossType === 'titan_core') { bShape = 'octagon'; bBaseSpeed = 28; }
    else if (bossType === 'emp_overlord') { bShape = 'triangle_inverted'; bBaseSpeed = 28; }

    // База HP босса: на 10-й волне ~5800 HP (непроходимо с 0/10 Tech Tree), на 20-й волне Старший Босс еще мощнее
    const bossMultiplier = isMajorBoss ? 680 : 580;
    const bossHp = Math.round(bossMultiplier * hpScalingMult);
    const bossBounty = Math.round(targetWaveBounty * 0.60);

    // Свита босса (зависит от арены и половины цикла)
    let escortType = isMajorBoss ? 'tank' : 'grunt';
    if (arena >= 2 && isMajorBoss) escortType = 'blinker';
    if (arena >= 3 && isMajorBoss && w >= 40) escortType = 'goliath';

    const escortCount = isMajorBoss
      ? Math.min(28, Math.round(6 + w * 0.28))
      : Math.min(20, Math.round(5 + w * 0.22));
    const escortBounty = Math.max(1, Math.floor((targetWaveBounty * 0.40) / escortCount));
    const protoEscort = (typeof ENEMY_CONFIGS !== 'undefined' && ENEMY_CONFIGS[escortType])
      ? ENEMY_CONFIGS[escortType] : { baseHp: 40, baseSpeed: 50 };

    // Сначала запускаем часть авангарда, затем Босса
    spawns.push({
      type: escortType,
      isBoss: false,
      isMiniBoss: false,
      count: escortCount,
      hp: Math.round(protoEscort.baseHp * hpScalingMult * 0.85),
      speed: Math.min(165, Math.round(protoEscort.baseSpeed * spdMult)),
      bounty: escortBounty,
      interval: (escortType === 'tank' || escortType === 'goliath') ? 1.7 : 0.65
    });

    spawns.push({
      type: bossType,
      isBoss: true,
      isMiniBoss: false,
      count: 1,
      hp: bossHp,
      speed: Math.min(85, Math.round(bBaseSpeed * Math.min(1.5, spdMult))),
      bounty: bossBounty,
      interval: 2.0,
      shape: bShape,
      color: bColor,
      glow: bGlow
    });

    return { wave: w, delayAfter: 6.5, spawns };
  }

  // ==========================================
  // ОБЫЧНЫЕ ВОЛНЫ: 20-ВОЛНОВОЙ ЦИКЛ ДЛЯ КАЖДОЙ ИЗ 5 КАРТ
  // ==========================================
  let g1Type = 'grunt', g1BaseCount = 5, g1Interval = 0.65, g1HpMod = 1.0;
  let g2Type = null, g2BaseCount = 0, g2Interval = 0.65, g2HpMod = 0.9;

  // ------------------------------------------
  // АРЕНА 1 (Главы 1–2): ТОЛЬКО grunt, scout, tank, swarm
  // ------------------------------------------
  if (arena === 1) {
    if (!isSecondHalf) {
      // Волны 1–9 цикла (Попроще): знакомство со скоростями и первыми танками
      const step = cWave % 4;
      if (cWave === 1) {
        g1Type = 'grunt'; g1BaseCount = 5; g1Interval = 0.75;
      } else if (cWave === 2) {
        g1Type = 'grunt'; g1BaseCount = 5; g1Interval = 0.65;
        g2Type = 'scout'; g2BaseCount = 3; g2Interval = 0.50;
      } else if (step === 3) {
        g1Type = 'scout'; g1BaseCount = 7; g1Interval = 0.45;
      } else if (step === 0) {
        g1Type = 'tank'; g1BaseCount = 2; g1Interval = 1.75; // Танки идут свободно
        g2Type = 'grunt'; g2BaseCount = 5; g2Interval = 0.60;
      } else if (step === 1) {
        g1Type = 'swarm'; g1BaseCount = 12; g1Interval = 0.05; // Плотная пачка роя
        g2Type = 'grunt'; g2BaseCount = 4; g2Interval = 0.65;
      } else {
        g1Type = 'grunt'; g1BaseCount = 7; g1Interval = 0.58;
        g2Type = 'scout'; g2BaseCount = 5; g2Interval = 0.45;
      }
    } else {
      // Волны 11–19 цикла (Посложнее): плотные комбо танков, быстрых скаутов и двойного роя
      const step = cWave % 4;
      if (step === 3) {
        g1Type = 'tank'; g1BaseCount = 4; g1Interval = 1.65;
        g2Type = 'scout'; g2BaseCount = 8; g2Interval = 0.40;
      } else if (step === 0) {
        g1Type = 'swarm'; g1BaseCount = 22; g1Interval = 0.045;
        g2Type = 'scout'; g2BaseCount = 7; g2Interval = 0.42;
      } else if (step === 1) {
        g1Type = 'tank'; g1BaseCount = 3; g1Interval = 1.70;
        g2Type = 'swarm'; g2BaseCount = 16; g2Interval = 0.05;
      } else {
        g1Type = 'grunt'; g1BaseCount = 10; g1Interval = 0.50;
        g2Type = 'tank'; g2BaseCount = 3; g2Interval = 1.65;
      }
    }
  }
  // ------------------------------------------
  // АРЕНА 2 (Главы 1–3): + blinker (фазовые щиты)
  // ------------------------------------------
  else if (arena === 2) {
    if (!isSecondHalf) {
      // Волны 1–9 цикла: акцент на скорость, рой и первые выходы блинкеров
      const step = cWave % 4;
      if (cWave === 1) {
        g1Type = 'scout'; g1BaseCount = 6; g1Interval = 0.50;
      } else if (step === 2) {
        g1Type = 'swarm'; g1BaseCount = 14; g1Interval = 0.05;
        g2Type = 'grunt'; g2BaseCount = 5; g2Interval = 0.60;
      } else if (step === 3) {
        g1Type = 'blinker'; g1BaseCount = 3; g1Interval = 0.95;
        g2Type = 'scout'; g2BaseCount = 5; g2Interval = 0.45;
      } else if (step === 0) {
        g1Type = 'tank'; g1BaseCount = 3; g1Interval = 1.70;
        g2Type = 'grunt'; g2BaseCount = 6; g2Interval = 0.58;
      } else {
        g1Type = 'blinker'; g1BaseCount = 4; g1Interval = 0.90;
        g2Type = 'grunt'; g2BaseCount = 6; g2Interval = 0.58;
      }
    } else {
      // Волны 11–19 цикла: массированные атаки блинкеров под прикрытием роя и танков
      const step = cWave % 4;
      if (step === 3) {
        g1Type = 'blinker'; g1BaseCount = 6; g1Interval = 0.82;
        g2Type = 'swarm'; g2BaseCount = 20; g2Interval = 0.045;
      } else if (step === 0) {
        g1Type = 'tank'; g1BaseCount = 4; g1Interval = 1.65;
        g2Type = 'blinker'; g2BaseCount = 5; g2Interval = 0.85;
      } else if (step === 1) {
        g1Type = 'swarm'; g1BaseCount = 26; g1Interval = 0.045;
        g2Type = 'scout'; g2BaseCount = 9; g2Interval = 0.38;
      } else {
        g1Type = 'blinker'; g1BaseCount = 6; g1Interval = 0.80;
        g2Type = 'scout'; g2BaseCount = 8; g2Interval = 0.40;
      }
    }
  }
  // ------------------------------------------
  // АРЕНА 3 (Главы 1–4): + goliath (сверхтяжелая броня)
  // ------------------------------------------
  else if (arena === 3) {
    if (!isSecondHalf) {
      // Волны 1–9 цикла: пехота, танки, блинкеры и одиночные голиафы с 5-й волны
      const step = cWave % 4;
      if (cWave <= 2) {
        g1Type = 'grunt'; g1BaseCount = 6; g1Interval = 0.60;
        g2Type = 'scout'; g2BaseCount = 4; g2Interval = 0.48;
      } else if (step === 3) {
        g1Type = 'tank'; g1BaseCount = 3; g1Interval = 1.70;
        g2Type = 'scout'; g2BaseCount = 6; g2Interval = 0.45;
      } else if (step === 0) {
        g1Type = (cWave >= 6) ? 'goliath' : 'tank';
        g1BaseCount = (g1Type === 'goliath') ? 2 : 3;
        g1Interval = (g1Type === 'goliath') ? 2.30 : 1.70;
        g2Type = 'grunt'; g2BaseCount = 6; g2Interval = 0.58;
      } else if (step === 1) {
        g1Type = 'blinker'; g1BaseCount = 4; g1Interval = 0.88;
        g2Type = 'swarm'; g2BaseCount = 15; g2Interval = 0.05;
      } else {
        g1Type = 'tank'; g1BaseCount = 3; g1Interval = 1.65;
        g2Type = 'blinker'; g2BaseCount = 4; g2Interval = 0.90;
      }
    } else {
      // Волны 11–19 цикла: тяжелые осадные колонны голиафов и танков
      const step = cWave % 4;
      if (step === 3) {
        g1Type = 'goliath'; g1BaseCount = 3; g1Interval = 2.20;
        g2Type = 'blinker'; g2BaseCount = 5; g2Interval = 0.82;
      } else if (step === 0) {
        g1Type = 'goliath'; g1BaseCount = 2; g1Interval = 2.30;
        g2Type = 'tank'; g2BaseCount = 4; g2Interval = 1.65;
      } else if (step === 1) {
        g1Type = 'swarm'; g1BaseCount = 24; g1Interval = 0.045;
        g2Type = 'goliath'; g2BaseCount = 2; g2Interval = 2.20;
      } else {
        g1Type = 'tank'; g1BaseCount = 5; g1Interval = 1.60;
        g2Type = 'scout'; g2BaseCount = 9; g2Interval = 0.38;
      }
    }
  }
  // ------------------------------------------
  // АРЕНА 4 (Главы 1–5): + emp_bomber (отключают башни во 2-й половине цикла)
  // ------------------------------------------
  else if (arena === 4) {
    if (!isSecondHalf) {
      // Волны 1–9 цикла: без EMP, но плотные связки 1–4 глав
      const step = cWave % 4;
      if (cWave === 1) {
        g1Type = 'grunt'; g1BaseCount = 7; g1Interval = 0.58;
      } else if (step === 2) {
        g1Type = 'blinker'; g1BaseCount = 4; g1Interval = 0.85;
        g2Type = 'scout'; g2BaseCount = 6; g2Interval = 0.42;
      } else if (step === 3) {
        g1Type = 'goliath'; g1BaseCount = 2; g1Interval = 2.25;
        g2Type = 'grunt'; g2BaseCount = 6; g2Interval = 0.55;
      } else if (step === 0) {
        g1Type = 'swarm'; g1BaseCount = 18; g1Interval = 0.045;
        g2Type = 'tank'; g2BaseCount = 3; g2Interval = 1.70;
      } else {
        g1Type = 'tank'; g1BaseCount = 4; g1Interval = 1.65;
        g2Type = 'blinker'; g2BaseCount = 4; g2Interval = 0.85;
      }
    } else {
      // Волны 11–19 цикла: подключаются EMP Bomber (строго дозированно, с интервалом 2.5с)
      const step = cWave % 4;
      if (step === 3) {
        g1Type = 'goliath'; g1BaseCount = 3; g1Interval = 2.20;
        g2Type = 'emp_bomber'; g2BaseCount = 2; g2Interval = 2.50;
      } else if (step === 0) {
        g1Type = 'blinker'; g1BaseCount = 6; g1Interval = 0.80;
        g2Type = 'emp_bomber'; g2BaseCount = 2; g2Interval = 2.60;
      } else if (step === 1) {
        g1Type = 'swarm'; g1BaseCount = 26; g1Interval = 0.045;
        g2Type = 'blinker'; g2BaseCount = 5; g2Interval = 0.82;
      } else {
        g1Type = 'tank'; g1BaseCount = 5; g1Interval = 1.60;
        g2Type = 'goliath'; g2BaseCount = 2; g2Interval = 2.20;
      }
    }
  }
  // ------------------------------------------
  // АРЕНА 5 (Главы 1–5, Финальный Апекс): альтернативная последовательность элиты
  // ------------------------------------------
  else {
    if (!isSecondHalf) {
      // Волны 1–9 цикла: сразу быстрые и бронированные комбинации в обратном порядке
      const step = cWave % 4;
      if (cWave === 1) {
        g1Type = 'scout'; g1BaseCount = 8; g1Interval = 0.45;
      } else if (step === 2) {
        g1Type = 'tank'; g1BaseCount = 3; g1Interval = 1.65;
        g2Type = 'blinker'; g2BaseCount = 4; g2Interval = 0.85;
      } else if (step === 3) {
        g1Type = 'swarm'; g1BaseCount = 20; g1Interval = 0.045;
        g2Type = 'scout'; g2BaseCount = 6; g2Interval = 0.40;
      } else if (step === 0) {
        g1Type = 'goliath'; g1BaseCount = 2; g1Interval = 2.20;
        g2Type = 'emp_bomber'; g2BaseCount = 1; g2Interval = 2.60;
      } else {
        g1Type = 'blinker'; g1BaseCount = 5; g1Interval = 0.82;
        g2Type = 'grunt'; g2BaseCount = 7; g2Interval = 0.52;
      }
    } else {
      // Волны 11–19 цикла: тотальный штурм всеми типами войск
      const step = cWave % 4;
      if (step === 3) {
        g1Type = 'swarm'; g1BaseCount = 30; g1Interval = 0.04;
        g2Type = 'emp_bomber'; g2BaseCount = 2; g2Interval = 2.50;
      } else if (step === 0) {
        g1Type = 'goliath'; g1BaseCount = 4; g1Interval = 2.10;
        g2Type = 'blinker'; g2BaseCount = 6; g2Interval = 0.78;
      } else if (step === 1) {
        g1Type = 'tank'; g1BaseCount = 5; g1Interval = 1.55;
        g2Type = 'emp_bomber'; g2BaseCount = 2; g2Interval = 2.50;
      } else {
        g1Type = 'goliath'; g1BaseCount = 3; g1Interval = 2.15;
        g2Type = 'swarm'; g2BaseCount = 24; g2Interval = 0.045;
      }
    }
  }

  // Масштабируем численность групп с ростом номера волны (от малого на старте к огромным армиям на 40+)
  let g1Count = Math.round(g1BaseCount * crowdScale);
  if (g1Type === 'swarm') {
    g1Count = Math.min(60, Math.max(12, Math.round(g1BaseCount * (0.9 + w * 0.045))));
    g1HpMod = 0.35;
  } else if (g1Type === 'goliath') {
    g1Count = Math.min(12, Math.max(1, Math.round(g1BaseCount * (0.8 + w * 0.025))));
  } else if (g1Type === 'tank') {
    g1Count = Math.min(16, Math.max(2, Math.round(g1BaseCount * (0.85 + w * 0.03))));
  } else if (g1Type === 'emp_bomber') {
    g1Count = Math.min(4, 1 + Math.floor(w / 22));
  } else {
    g1Count = Math.min(35, Math.max(4, g1Count));
  }

  let g2Count = 0;
  if (g2Type && g2BaseCount > 0) {
    g2Count = Math.round(g2BaseCount * crowdScale);
    if (g2Type === 'swarm') {
      g2Count = Math.min(50, Math.max(10, Math.round(g2BaseCount * (0.9 + w * 0.04))));
      g2HpMod = 0.35;
    } else if (g2Type === 'goliath') {
      g2Count = Math.min(8, Math.max(1, Math.round(g2BaseCount * (0.8 + w * 0.02))));
    } else if (g2Type === 'tank') {
      g2Count = Math.min(12, Math.max(2, Math.round(g2BaseCount * (0.85 + w * 0.025))));
    } else if (g2Type === 'emp_bomber') {
      g2Count = Math.min(3, 1 + Math.floor(w / 25)); // Не больше 1-3 штук, чтобы не глушить всю карту
    } else {
      g2Count = Math.min(28, Math.max(3, g2Count));
    }
  }

  // Распределение бюджета золота за волну между группами
  let g1BountyShare = (g2Type && g2Count > 0) ? 0.60 : 1.0;
  if (g1Type === 'swarm' && g2Type) g1BountyShare = 0.30;

  const g1Bounty = Math.max(1, Math.floor((targetWaveBounty * g1BountyShare) / g1Count));
  const proto1 = (typeof ENEMY_CONFIGS !== 'undefined' && ENEMY_CONFIGS[g1Type])
    ? ENEMY_CONFIGS[g1Type] : { baseHp: 40, baseSpeed: 55 };

  spawns.push({
    type: g1Type,
    isBoss: false,
    isMiniBoss: false,
    count: g1Count,
    hp: Math.max(10, Math.round(proto1.baseHp * hpScalingMult * g1HpMod)),
    speed: Math.min(180, Math.round(proto1.baseSpeed * spdMult)),
    bounty: g1Bounty,
    interval: g1Interval,
    clumps: (g1Type === 'swarm') ? Math.max(2, Math.ceil(g1Count / 10)) : 0
  });

  if (g2Type && g2Count > 0) {
    const g2Bounty = Math.max(1, Math.floor((targetWaveBounty * (1 - g1BountyShare)) / g2Count));
    const proto2 = (typeof ENEMY_CONFIGS !== 'undefined' && ENEMY_CONFIGS[g2Type])
      ? ENEMY_CONFIGS[g2Type] : { baseHp: 40, baseSpeed: 55 };

    spawns.push({
      type: g2Type,
      isBoss: false,
      isMiniBoss: false,
      count: g2Count,
      hp: Math.max(10, Math.round(proto2.baseHp * hpScalingMult * g2HpMod)),
      speed: Math.min(180, Math.round(proto2.baseSpeed * spdMult)),
      bounty: g2Bounty,
      interval: g2Interval,
      clumps: (g2Type === 'swarm') ? Math.max(2, Math.ceil(g2Count / 10)) : 0
    });
  }

  return { wave: w, delayAfter: 5.5, spawns };
}

// [ENG.Z]
function isOverdriveUnlocked() {
  if (typeof devMode !== 'undefined' && devMode) return true;
  if (typeof clearedLevels !== 'undefined' && (clearedLevels.includes(20) || clearedLevels.some(l => l >= 20))) return true;
  if (typeof maxUnlockedLevel === 'number' && maxUnlockedLevel > 20) return true;
  return false;
}
window.isOverdriveUnlocked = isOverdriveUnlocked;

function isEndlessUnlocked() {
  if (typeof devMode !== 'undefined' && devMode) return true;
  if (typeof clearedLevels !== 'undefined' && (clearedLevels.includes(15) || clearedLevels.some(l => l >= 15))) return true;
  if (typeof maxUnlockedLevel === 'number' && maxUnlockedLevel > 15) return true;
  return false;
}
window.isEndlessUnlocked = isEndlessUnlocked;

// Meta-Upgrade Tech Tree & Player Loadout Management: Tower unlocks, loadout slots, and skill tree node handlers.
// [ENG.AQ]
function getMaxUpgradeStep() {
  const lvl = getLoadoutReferenceLevel();
  if (lvl < 11) return 0;
  if (lvl <= 20) return 6;
  if (lvl <= 30) return 8;
  return 10;
}

// [ENG.AR]
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
    showHintToast(typeof t === 'function' ? t('branch_ascended_max') : 'Branch is ASCENDED MAX (Lvl 15)');
    return;
  }

  const maxStep = getMaxUpgradeStep();
  const isPhase2UnlockedGlobally = getLoadoutReferenceLevel() >= 31 || maxUnlockedLevel >= 31 || (typeof clearedLevels !== 'undefined' && clearedLevels.includes(30));

  if (targetStep <= 10) {
    if (targetStep > maxStep) {
      let lvlNeeded = 11;
      if (targetStep > 8) lvlNeeded = 31;
      else if (targetStep > 6) lvlNeeded = 21;
      sfx('denied');
      showHintToast(typeof t === 'function' ? t('unlocks_on_level_n', { n: lvlNeeded }) : `Unlocks on Level ${lvlNeeded}`);
      return;
    }
  } else {
    if (!isPhase2UnlockedGlobally) {
      sfx('denied');
      showHintToast(typeof t === 'function' ? t('unlocks_on_level_n', { n: 31 }) : 'Unlocks on Level 31');
      return;
    }
    // Проверка для входа в ASC: все ветки должны быть 10/10
    if (!areAllBranchesMaxPhase1()) {
      sfx('denied');
      showHintToast(typeof t === 'function' ? t('upgrade_all_branches_10') : 'Upgrade all branches to 10/10 first to unlock ASC');
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
      showHintToast(typeof t === 'function' ? t('not_enough_diamonds_prisms') : 'Not enough Diamonds & Prisms!');
    } else if (diamonds < costD) {
      showHintToast(typeof t === 'function' ? t('not_enough_diamonds') : 'Not enough Diamonds!');
    } else {
      showHintToast(typeof t === 'function' ? t('not_enough_prisms') : 'Not enough Prisms!');
    }
  }
}

// [ENG.AS]
function getLoadoutReferenceLevel() {
  return Math.max(maxUnlockedLevel, currentLevel || 1);
}

// [ENG.AT]
function getLoadoutStartLevel() {
  for (let l = 1; l <= TOTAL_LEVELS; l++) {
    const pool = LEVELS_DATA[l] && LEVELS_DATA[l].unlockedTowers;
    if (pool && pool.length > LOADOUT_SIZE) return l;
  }
  return TOTAL_LEVELS + 1;
}

// [ENG.AU]
function getTowerUnlockLevel(type) {
  for (let l = 1; l <= TOTAL_LEVELS; l++) {
    const pool = LEVELS_DATA[l] && LEVELS_DATA[l].unlockedTowers;
    if (pool && pool.includes(type)) return l;
  }
  return 1;
}

// [ENG.AV]
function getPlayerUnlockedTowers() {
  if (devMode) return Object.keys(TOWER_CONFIGS);
  const highestLvl = Math.max(maxUnlockedLevel || 1, currentLevel || 1);
  const canonical = Object.keys(TOWER_CONFIGS);
  return canonical.filter(t => getTowerUnlockLevel(t) <= highestLvl);
}

// [ENG.AW]
function getBuildPanelPool(lvl) {
  if (devMode) return Object.keys(TOWER_CONFIGS);
  const highestLvl = Math.max(maxUnlockedLevel || 1, lvl || 1);
  const loadoutStart = getLoadoutStartLevel(); // 11

  // Если игрок в принципе еще не дошел до 11 уровня (ранняя игра) —
  // показываем 3 первыe башни (Gatling, Laser, Mortar), блокируя незаблокированные по уровню
  if (highestLvl < loadoutStart) {
    return ['gun', 'laser', 'mortar'];
  }

  // Если игрок дошел до 11 уровня и выше — на ЛЮБОМ уровне используются
  // башни из его зафиксированного боевого лодаута
  const pool = (activeBattleLoadout && activeBattleLoadout.length > 0)
    ? activeBattleLoadout
    : selectedLoadout;
  return (pool && pool.length > 0) ? pool.slice() : ['gun'];
}

// [ENG.AX]
function isTowerActiveThisLevel(type) {
  if (devMode) return true;
  const loadoutStart = getLoadoutStartLevel();

  if (isEndlessMode) {
    const pool = (activeBattleLoadout && activeBattleLoadout.length > 0) ? activeBattleLoadout : selectedLoadout;
    return pool.includes(type);
  }

  const highestLvl = Math.max(maxUnlockedLevel || 1, currentLevel || 1);
  if (highestLvl < loadoutStart) {
    const curUnlocked = (LEVELS_DATA[currentLevel] && LEVELS_DATA[currentLevel].unlockedTowers) || ['gun'];
    return curUnlocked.includes(type);
  }

  const pool = (activeBattleLoadout && activeBattleLoadout.length > 0)
    ? activeBattleLoadout
    : selectedLoadout;
  return pool.includes(type);
}

// [ENG.AY]
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

// [ENG.AZ]
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

// Game Match Lifecycle & State Controller: Level start, pause, hardware back button, and level reset routines.
// [ENG.BA]
function startSpecificLevel(lvl) {
  refreshLoadoutForProgress();
  reallyStartLevel(lvl);
}

// [ENG.BB]
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
  waveStartGold = gold;
  baseHp = 10 + Math.round(getUpgradeEffectiveLevel('base_hp'));
  matchStartBaseHp = baseHp;
  wave = 1;

  initBuildPanel();
  updateUI();
  resizeCanvasAndCamera();
  gameState = 'PLAYING';
  updateUI();
  lastTime = performance.now();
  safeTrack('endless_start', { runsUsed: endlessDailyRunsUsed });
  battleUpgradeSnapshot = Object.assign({}, upgradeTreeData);
  saveActiveBattleSnapshot();
  saveGameSoon();
}

// [ENG.BC]
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

  if (devMode) {
    const customSpawner = document.getElementById('devCustomSpawner');
    if (customSpawner) customSpawner.classList.remove('hidden');
  }

  resetLevelState();
  if (bpClaimedPrem[15] || bpClaimedPrem['15']) {
    gold = Math.round(gold * 1.15);
  }
  waveStartGold = gold;
  battleUpgradeSnapshot = Object.assign({}, upgradeTreeData);
  saveActiveBattleSnapshot();
  saveGameSoon();
  initBuildPanel();
  gameState = 'PLAYING';
  updateUI();
  resizeCanvasAndCamera();
  lastTime = performance.now();
  initTutorialForLevel(lvl);
  safeTrack('level_start', { level: lvl });
}

// [ENG.BD]
let finalWaveSpawned = false;

function resetLevelState() {
  if (typeof stopNormalModePreview === 'function') stopNormalModePreview();
  if (reviveTimerInterval) { clearInterval(reviveTimerInterval); reviveTimerInterval = null; }
  reviveUsedThisMatch = false;
  sessionMobKillsCount = 0;
  cameraShakeTimer = 0;
  cameraShakeMaxDur = 0;
  cameraShakeIntensity = 0;

  const lvlConfig = LEVELS_DATA[currentLevel];
  gold = lvlConfig ? lvlConfig.startGold : 100;
  const initialBaseHp = (lvlConfig && lvlConfig.startHp !== undefined) ? lvlConfig.startHp : 10;
  baseHp = isOverdriveMode ? 1 : (initialBaseHp + Math.round(getUpgradeEffectiveLevel('base_hp')));
  matchStartBaseHp = baseHp;
  regularSpawnCounter = 0;

  wave = 1;
  waveInProgress = false;
  finalWaveSpawned = false;
  autoWaveTimeRemaining = 0;
  waveTimerActive = false;
  fieldClearDelayTimer = 0;
  isWaveTimerAccelerated = false;
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
  if (btnText) btnText.textContent = (typeof t === 'function' ? t('go') : 'Go');
  updateWaveCircle(0);
  updateUI();
  if (devMode && typeof refreshDevDropdowns === 'function') refreshDevDropdowns();
}

// [ENG.BE]
function nextLevel() {
  if (currentLevel < TOTAL_LEVELS) {
    startSpecificLevel(currentLevel + 1);
  } else {
    showLevelSelect();
  }
}

// [ENG.BF]
function retryLevel() {
  if (isEndlessMode) {
    const status = getEndlessEntryStatus();
    // [ENG.BG]
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
    } else if (status.type === 'diamonds' || status.type === 'diamond') {
      const cost = status.cost || 25;
      if (diamonds < cost) {
        if (typeof showHintToast === 'function') showHintToast(`Need ${cost} Diamonds for entry!`);
        return;
      }
      diamonds -= cost;
      updateDiamondUI();
      launch();
    }
  } else {
    reallyStartLevel(currentLevel);
  }
}

// [ENG.BH]
function togglePause() {
  if (typeof handleHudSettingsClick === 'function') {
    handleHudSettingsClick();
  }
}

// [ENG.BI]
function forcePauseForBackground() {
  if (gameState === 'PLAYING' || gameState === 'PAUSED') {
    saveActiveBattleSnapshot();
  }
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

let lastBackPressTime = 0;
let lastHardwareBackRun = 0;

// [ENG.BJ]
function handleHardwareBack() {
  const now = Date.now();
  // Защита от дребезга системных событий
  if (now - lastHardwareBackRun < 300) return;
  lastHardwareBackRun = now;

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

  const gameCompModal = document.getElementById('gameCompletionModal');
  if (gameCompModal && !gameCompModal.classList.contains('hidden')) {
    if (typeof closeGameCompletionModal === 'function') closeGameCompletionModal();
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
    if (typeof showStartScreen === 'function') showStartScreen();
    return;
  }

  const victoryEl = document.getElementById('victoryScreen');
  if (victoryEl && !victoryEl.classList.contains('hidden')) {
    if (typeof showLevelSelectFromGame === 'function') showLevelSelectFromGame();
    return;
  }

  const defeatEl = document.getElementById('defeatScreen');
  if (defeatEl && !defeatEl.classList.contains('hidden')) {
    if (typeof showLevelSelectFromGame === 'function') showLevelSelectFromGame();
    return;
  }

  if (gameState === 'PAUSED') {
    if (typeof closeSettings === 'function') closeSettings();
    return;
  }

  if (gameState === 'PLAYING') {
    if (typeof handleHudSettingsClick === 'function') handleHudSettingsClick();
    return;
  }

  // Строгая изоляция выхода: сработает только на экране START
  if (gameState === 'START') {
    if (now - lastBackPressTime < 2000) {
      const AppPlugin = window.Capacitor?.Plugins?.App || window.App;
      if (AppPlugin && typeof AppPlugin.exitApp === 'function') {
        AppPlugin.exitApp();
      }
    } else {
      lastBackPressTime = now;
      if (typeof showHintToast === 'function') {
        showHintToast(typeof t === 'function' ? t('tap_back_exit') : 'Tap Back one more time to close game');
      }
    }
  }
}
window.handleHardwareBack = handleHardwareBack;

// Match Result & Victory/Defeat Handlers: Star calculations, rewards, revive prompt, and victory/defeat sequences.
// [ENG.BK]
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
  let rewardKey = 'farm_reward';
  let rewardLabel = 'FARM REWARD';

  if (!isOverdriveMode && earnedStars > prevBestStars) {
    const deltaStars = earnedStars - prevBestStars;
    rewardDiamonds = deltaStars * 2;
    rewardKey = (prevBestStars === 0) ? 'first_clear_bonus' : 'star_upgrade_bonus';
    rewardLabel = (prevBestStars === 0) 
      ? (typeof t === 'function' ? t('first_clear_bonus') : 'FIRST CLEAR BONUS') 
      : (typeof t === 'function' ? t('star_upgrade_bonus') : 'STAR UPGRADE BONUS');
    levelStars[lvl] = earnedStars;
    if (!clearedLevels.includes(lvl)) {
      clearedLevels.push(lvl);
    }
  } else {
    if (lvl <= 20) rewardDiamonds = 1;
    else if (lvl <= 40) rewardDiamonds = 2;
    else rewardDiamonds = 3;
    rewardKey = 'farm_reward';
    rewardLabel = (typeof t === 'function' ? t('farm_reward') : 'FARM REWARD');
  }

  return { stars: earnedStars, reward: rewardDiamonds, rewardLabel, rewardKey };
}

// [ENG.BL] Универсальный показ вознаграждаемой рекламы (РСЯ / Web SDK)
async function showAdPlaceholder(onRewarded, onNotRewarded) {
  const bridge = window.NativeYandexAdsBridge || window.NativeAdsBridge;

  // 1. Показ через нативный мост РСЯ в приложении
  if (bridge && typeof bridge.showRewardedAd === 'function') {
    try {
      if (!isAdsInitialized) {
        await initAdsBridge();
      }

      const isReady = isRewardAdReady || (typeof bridge.isRewardedAdReady === 'function' && bridge.isRewardedAdReady());

      if (isReady) {
        activeAdCallbacks = {
          onRewarded: onRewarded || null,
          onNotRewarded: onNotRewarded || null,
          rewardedFlag: false
        };
        logAdEvent('Calling NativeBridge.showRewardedAd()...');

        if (typeof suppressBackgroundPause === 'function') suppressBackgroundPause(60000);
        bridge.showRewardedAd();
        return;
      } else {
        logAdEvent('Ad not ready yet, triggering preload and showing toast...');
        preloadRewardedAd();
        const toastMsg = typeof t === 'function' ? t('ad_not_ready') : 'Video is loading, please check network connection.';
        if (typeof showHintToast === 'function') showHintToast(toastMsg);
        if (typeof onNotRewarded === 'function') onNotRewarded();
        return;
      }
    } catch (e) {
      const errStr = (e && e.message) ? e.message : String(e);
      if (window.AdDiagnostics) window.AdDiagnostics.lastError = errStr;
      logAdEvent('Native Show Exception: ' + errStr);
      const toastMsg = typeof t === 'function' ? t('ad_not_ready') : 'Video is loading, please check network connection.';
      if (typeof showHintToast === 'function') showHintToast(toastMsg);
      if (typeof onNotRewarded === 'function') onNotRewarded();
      return;
    }
  }

  // 2. Показ через веб-версию РСЯ (при запуске в браузере с подключенным AdvManager)
  if (window.Ya && window.Ya.Context && window.Ya.Context.AdvManager) {
    let webRewarded = false;
    logAdEvent('Calling Web AdvManager (rewarded)...');
    window.Ya.Context.AdvManager.render({
      blockId: REWARDED_AD_UNIT_ID,
      type: 'rewarded',
      platform: 'touch',
      onRewarded: function(isRewarded) {
        webRewarded = !!isRewarded;
        logAdEvent('Web onRewarded: ' + webRewarded);
      },
      onClose: function() {
        logAdEvent('Web Ad Closed');
        if (webRewarded) {
          if (typeof onRewarded === 'function') onRewarded();
        } else {
          if (typeof onNotRewarded === 'function') onNotRewarded();
        }
      },
      onError: function(err) {
        const errStr = JSON.stringify(err);
        if (window.AdDiagnostics) window.AdDiagnostics.lastError = errStr;
        logAdEvent('Web Ad Error: ' + errStr);
        const toastMsg = typeof t === 'function' ? t('ad_not_ready') : 'Video is loading, please check network connection.';
        if (typeof showHintToast === 'function') showHintToast(toastMsg);
        if (typeof onNotRewarded === 'function') onNotRewarded();
      }
    });
    return;
  }

  // 3. Если нет рекламного плагина и нет интернета — информируем игрока и отклоняем награду
  logAdEvent('Ad bridge unavailable');
  const toastMsg = typeof t === 'function' ? t('ad_not_ready') : 'Video is loading, please check network connection.';
  if (typeof showHintToast === 'function') showHintToast(toastMsg);
  if (typeof onNotRewarded === 'function') onNotRewarded();
}

// [ENG.BP]
function getStandardAdIconSvg() {
  return `<svg width="18" height="15" viewBox="0 0 16 13" fill="none" style="flex:none; margin-right:6px;"><rect x="0.8" y="0.8" width="14.4" height="11.4" rx="2.5" fill="none" stroke="#ffffff" stroke-width="1.6"/><polygon points="6,3.5 11,6.5 6,9.5" fill="#ffffff"/></svg>`;
}

// [ENG.BQ]
function claimX2Reward() {
  if (hasClaimedX2ThisLevel) return;
  const claimBtn = document.getElementById('claimX2Btn');

  // [ENG.BR]
  const executeGrant = () => {
    hasClaimedX2ThisLevel = true;
    diamonds += lastVictoryDiamondsReward;
    updateDiamondUI();
    if (claimBtn) {
      claimBtn.disabled = true;
      const claimedLabel = typeof t === 'function' ? t('claimed_x2') : 'CLAIMED x2';
      claimBtn.innerHTML = `<span style="display:inline-flex; align-items:center; gap:4px;">${claimedLabel} (+${lastVictoryDiamondsReward} <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><polygon points="6 3 18 3 22 9 12 22 2 9" fill="currentColor" fill-opacity="0.25"/><polyline points="2 9 12 13 22 9"/><line x1="12" y1="22" x2="12" y2="13"/></svg>)</span>`;
    }
    sfx('reward');
    saveGame();
  };

  showAdPlaceholder(executeGrant, null);
}

// [ENG.BS]
function claimOverdriveBonusPrism() {
  if (hasClaimedX2ThisLevel) return;
  const claimBtn = document.getElementById('claimX2Btn');

  // [ENG.BT]
  const executeGrant = () => {
    hasClaimedX2ThisLevel = true;
    prisms += 1;
    if (typeof updatePrismUI === 'function') updatePrismUI();
    if (claimBtn) {
      claimBtn.disabled = true;
      const prismSvg = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" style="vertical-align: middle; display: inline-block; margin: 0 3px;">
          <polygon points="12 2 21 12 12 22 3 12" fill="currentColor" fill-opacity="0.25"/>
          <polyline points="3 12 12 15 21 12"/>
          <line x1="12" y1="22" x2="12" y2="22"/>
        </svg>`;
      const claimedPlus1Label = typeof t === 'function' ? t('claimed_plus_1') : 'CLAIMED +1';
      claimBtn.innerHTML = `<span style="display:inline-flex; align-items:center;">${claimedPlus1Label} ${prismSvg}</span>`;
    }
    sfx('reward');
    saveGame();
  };

  showAdPlaceholder(executeGrant, null);
}

// [ENG.BU]
function restoreNormalVictoryRewardBox() {
  const rewardBox = document.getElementById('victoryRewardBox');
  const isHyperion = (typeof activePalette !== 'undefined' && activePalette === 'matrix_green');
  const borderCol = isHyperion ? '#3b82f6' : '#00e5ff';
  const labelCol = isHyperion ? '#93c5fd' : '#8ef3ff';
  const dFill = isHyperion ? 'rgba(59,130,246,.28)' : 'rgba(0,229,255,.25)';
  const diamondsLabel = typeof t === 'function' ? t('diamonds_upper') : 'DIAMONDS';
  if (rewardBox) {
    rewardBox.style.setProperty('--chip-border', borderCol);
    rewardBox.style.setProperty('--chip-label', labelCol);
    rewardBox.innerHTML = `
      <span class="reward-label" id="victoryRewardBadgeType">${diamondsLabel}</span>
      <div style="display:flex; align-items:center; gap:6px;">
        <span class="reward-amount" id="victoryRewardVal">+2</span>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${borderCol}" stroke-width="2.2" stroke-linejoin="round">
          <polygon points="6 3 18 3 22 9 12 22 2 9" fill="${dFill}"/>
          <polyline points="2 9 12 13 22 9"/><line x1="12" y1="22" x2="12" y2="13"/>
        </svg>
      </div>
    `;
  }
}

let victoryFanfareTimer = null;

// [ENG.BV]
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

// [ENG.BW]
function triggerVictory() {
  gameState = 'VICTORY';
  if (typeof syncTopHudVisibility === 'function') syncTopHudVisibility();
  const defeatScreen = document.getElementById('defeatScreen');
  if (defeatScreen) defeatScreen.classList.add('hidden');
  sfxStopBeams();
  music('win');
  sfx('victory');
  vibrate('light');
  const { stars, reward, rewardLabel, rewardKey } = calculateLevelStarsAndReward(currentLevel, baseHp, matchStartBaseHp);
  lastVictoryDiamondsReward = reward;
  hasClaimedX2ThisLevel = false;

  if (!isOverdriveMode) {
    restoreNormalVictoryRewardBox();
    diamonds += reward;
    addBpXp(25);
    updateDiamondUI();
    renderVictoryStars(stars);
    playVictoryFanfare();

    const badgeTypeEl = document.getElementById('victoryRewardBadgeType');
    if (badgeTypeEl) {
      const isHyperion = (typeof activePalette !== 'undefined' && activePalette === 'matrix_green');
      badgeTypeEl.textContent = rewardLabel;
      badgeTypeEl.style.color = (rewardKey === 'first_clear_bonus' || rewardKey === 'star_upgrade_bonus') ? '#f59e0b' : (isHyperion ? '#93c5fd' : '#8ef3ff');
    }

    const rewardValEl = document.getElementById('victoryRewardVal');
    if (rewardValEl) rewardValEl.textContent = `+${reward}`;

    const claimBtn = document.getElementById('claimX2Btn');
    if (claimBtn) {
      claimBtn.disabled = false;
      claimBtn.classList.remove('hidden');
      const activeIcon = getStandardAdIconSvg();
      const claimX2Label = typeof t === 'function' ? t('claim_x2') : 'CLAIM x2';
      claimBtn.innerHTML = `${activeIcon}<span>${claimX2Label}</span>`;
      claimBtn.onclick = claimX2Reward;
    }
  } else {
    const isFirstOverdriveClear = !overdriveClearedLevels[currentLevel];
    let gainedPrisms = 0;
    let gainedDiamonds = 0;
    let odRewardLabel = typeof t === 'function' ? t('hardcore_farm') : 'HARDCORE FARM';

    if (isFirstOverdriveClear) {
      const isBossLvl = (currentLevel % LEVELS_PER_SECTION === 0);
      gainedPrisms = isBossLvl ? 5 : 3;
      gainedDiamonds = isBossLvl ? 30 : 15;
      odRewardLabel = typeof t === 'function' ? t('hardcore_clear') : 'HARDCORE CLEAR';
      overdriveClearedLevels[currentLevel] = true;
    } else {
      if (currentLevel <= 20) gainedDiamonds = 3;
      else if (currentLevel <= 40) gainedDiamonds = 4;
      else gainedDiamonds = 5;
      gainedPrisms = 0;
      odRewardLabel = typeof t === 'function' ? t('hardcore_farm') : 'HARDCORE FARM';
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
      rewardBox.style.setProperty('--chip-border', '#f05f9f');
      rewardBox.style.setProperty('--chip-label', '#ffd1f4');

      const diamondSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00e5ff" stroke-width="2.2" stroke-linejoin="round" style="flex:none; filter: drop-shadow(0 0 5px rgba(0,229,255,0.7));"><polygon points="6 3 18 3 22 9 12 22 2 9" fill="rgba(0,229,255,.25)"/><polyline points="2 9 12 13 22 9"/><line x1="12" y1="22" x2="12" y2="13"/></svg>`;
      const prismSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d946ef" stroke-width="2.2" stroke-linejoin="round" style="flex:none; filter: drop-shadow(0 0 5px rgba(217,70,239,0.7));"><polygon points="12 2 21 12 12 22 3 12" fill="rgba(217,70,239,.25)"/><polyline points="3 12 12 15 21 12"/><line x1="12" y1="22" x2="12" y2="22"/></svg>`;

      if (gainedPrisms > 0) {
        rewardBox.innerHTML = `
          <span class="reward-label" id="victoryRewardBadgeType">${odRewardLabel}</span>
          <div class="reward-row-content">
            <span class="reward-amount" id="victoryRewardVal">+${gainedDiamonds}</span>
            ${diamondSvg}
            <span class="reward-sep">|</span>
            <span class="reward-amount">+${gainedPrisms}</span>
            ${prismSvg}
          </div>
        `;
      } else {
        rewardBox.innerHTML = `
          <span class="reward-label" id="victoryRewardBadgeType">${odRewardLabel}</span>
          <div class="reward-row-content">
            <span class="reward-amount" id="victoryRewardVal">+${gainedDiamonds}</span>
            ${diamondSvg}
          </div>
        `;
      }
    }

    const claimBtn = document.getElementById('claimX2Btn');
    if (claimBtn) {
      claimBtn.disabled = false;
      claimBtn.classList.remove('hidden');

      const adSvg = getStandardAdIconSvg();
      const prismSvg = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#d946ef" stroke-width="2.2" stroke-linejoin="round" style="vertical-align: middle; display: inline-block; margin: 0 4px;">
          <polygon points="12 2 21 12 12 22 3 12" fill="rgba(217,70,239,.35)"/>
          <polyline points="3 12 12 15 21 12"/>
          <line x1="12" y1="22" x2="12" y2="22"/>
        </svg>`;

      const claimPlus1Label = typeof t === 'function' ? t('claim_plus_1') : 'CLAIM +1';
      claimBtn.innerHTML = `
        ${adSvg}
        <span style="display:inline-flex; align-items:center;">${claimPlus1Label} ${prismSvg}</span>
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

  // [ENG.BX]
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

  if (!isOverdriveMode && isFirstClear && typeof hasMilestoneForLevel === 'function' && hasMilestoneForLevel(currentLevel)) {
    showMilestoneSequence(currentLevel, showVictory);
  } else {
    showVictory();
  }
  clearActiveBattleSave();
}

// [ENG.BY]
function playVictoryUnlockFx() {
  if (pendingUpgradeUnlockFx) {
    const btn = document.getElementById('victoryUpgradesBtn');
    if (btn) {
      const pcbTreeIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="flex:none; margin-right: 4px;"><path d="M12 21 v-5 l-4 -3.5 v-4 m4 7.5 l4 -3.5 v-4 m-4 7.5 v-8" /><circle cx="12" cy="21" r="1.5" fill="currentColor" stroke="none" /><circle cx="8" cy="8.5" r="1.5" fill="currentColor" stroke="none" /><circle cx="16" cy="8.5" r="1.5" fill="currentColor" stroke="none" /><circle cx="12" cy="5" r="1.5" fill="currentColor" stroke="none" /></svg>`;
      btn.classList.add('btn-locked', 'btn-unlocking');
      btn.disabled = true;
      btn.innerHTML = pcbTreeIcon + '<span>TECH TREE</span>';
      // [ENG.BZ]
      setTimeout(() => {
        btn.disabled = false;
        btn.classList.remove('btn-locked', 'btn-unlocking', 'no-press-feedback');
        btn.innerHTML = pcbTreeIcon + '<span>TECH TREE</span>';
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

// [ENG.CA]
function triggerDefeat() {
  musicSetDucked(false);
  sfxStopBeams();
  music('lose');
  sfx('defeat');
  vibrate('error');
  if (reviveTimerInterval) { clearInterval(reviveTimerInterval); reviveTimerInterval = null; }
  if (reviveSkipShowTimer) { clearTimeout(reviveSkipShowTimer); reviveSkipShowTimer = null; }
  gameState = 'DEFEAT';
  if (typeof syncTopHudVisibility === 'function') syncTopHudVisibility();

  const victoryScreen = document.getElementById('victoryScreen');
  if (victoryScreen) victoryScreen.classList.add('hidden');

  const reviveTimerContainer = document.getElementById('reviveTimerContainer');
  if (reviveTimerContainer) reviveTimerContainer.classList.add('hidden');

  const tacticalTipsWidget = document.getElementById('tacticalTipsWidget');
  if (tacticalTipsWidget) {
    tacticalTipsWidget.classList.toggle('hidden', !!isEndlessMode);
  }

  const reviveBtn = document.getElementById('reviveBtn');
  const skipBtn = document.getElementById('reviveSkipBtn');
  const retryBtn = document.getElementById('defeatRetryBtn');
  const upgBtn = document.getElementById('defeatUpgradesBtn');
  const levelsBtn = document.getElementById('defeatLevelsBtn');
  const shopBtn = document.getElementById('defeatShopBtn');

  if (reviveBtn) reviveBtn.classList.add('hidden');
  if (skipBtn) skipBtn.classList.add('hidden');
  if (retryBtn) retryBtn.classList.toggle('hidden', !!isEndlessMode);
  if (upgBtn) upgBtn.classList.remove('hidden');
  if (levelsBtn) levelsBtn.classList.remove('hidden');
  if (shopBtn) shopBtn.classList.remove('hidden');

  updateUpgradeButtonsLock();
  updateDefeatWaveLine();
  document.getElementById('defeatScreen').classList.remove('hidden');
  if (!isEndlessMode) {
    replayDefeatFlash();
  } else {
    const existingFlash = document.getElementById('defeatFlash');
    if (existingFlash) existingFlash.remove();
  }
  showLoadoutWidgetIn('loadoutAnchor-defeat');
  registerDefeatOutcome();
  clearActiveBattleSave();
}

// [ENG.CB]
function registerDefeatOutcome() {
  safeTrack('level_failed', { level: currentLevel, wave });
}

// [ENG.CC]
function showGameCompletionModal() {
  const modal = document.getElementById('gameCompletionModal');
  if (modal) modal.classList.remove('hidden');
}

// [ENG.CD]
function closeGameCompletionModal() {
  const modal = document.getElementById('gameCompletionModal');
  if (modal) modal.classList.add('hidden');
}

// [ENG.CE]
function setReviveBtnLabel(seconds) {
  const numEl = document.getElementById('reviveTimerNumber');
  if (numEl) numEl.textContent = `${seconds}s`;
  const label = document.getElementById('reviveBtnLabel');
  if (label) {
    label.textContent = (typeof t === 'function' ? t('revive') : 'REVIVE');
  }
}

let defeatFlashTimeout = null;

// [ENG.CF]
function replayDefeatFlash() {
  if (typeof isEndlessMode !== 'undefined' && isEndlessMode) return;
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

// [ENG.CG]
function claimEndlessDoubleRewards() {
  if (endlessHasClaimedDouble || (lastEndlessEarnedDiamonds <= 0 && lastEndlessEarnedPrisms <= 0)) return;
  const doubleBtn = document.getElementById('endlessDoubleBtn');

  // [ENG.CH]
  const executeDouble = () => {
    endlessHasClaimedDouble = true;
    diamonds += lastEndlessEarnedDiamonds;
    prisms += lastEndlessEarnedPrisms;
    updateDiamondUI();
    if (typeof updatePrismUI === 'function') updatePrismUI();
    if (doubleBtn) {
      doubleBtn.disabled = true;
      const diamondSvg = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><polygon points="6 3 18 3 22 9 12 22 2 9" fill="currentColor" fill-opacity="0.25"/><polyline points="2 9 12 13 22 9"/><line x1="12" y1="22" x2="12" y2="13"/></svg>`;
      const prismSvg = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><polygon points="12 2 21 12 12 22 3 12" fill="currentColor" fill-opacity="0.25"/><polyline points="3 12 12 15 21 12"/><line x1="12" y1="22" x2="12" y2="22"/></svg>`;
      
      let rewardText = `(+${lastEndlessEarnedDiamonds} ${diamondSvg}`;
      if (lastEndlessEarnedPrisms > 0) {
        rewardText += ` +${lastEndlessEarnedPrisms} ${prismSvg}`;
      }
      rewardText += `)`;

      const claimedLabel = typeof t === 'function' ? t('claimed_x2') : 'CLAIMED x2';
      doubleBtn.innerHTML = `<span style="display:inline-flex; align-items:center; gap:4px; font-size:11px; letter-spacing:0.5px;">${claimedLabel} ${rewardText}</span>`;
    }
    sfx('reward');
    saveGame();
  };

  showAdPlaceholder(executeDouble, null);
}

// [ENG.CI]
function updateDefeatWaveLine() {
  const el = document.getElementById('defeatWaveLine');
  const defeatScreen = document.getElementById('defeatScreen');
  const kicker = defeatScreen ? defeatScreen.querySelector('.result-kicker') : null;
  const title = defeatScreen ? defeatScreen.querySelector('.result-title') : null;
  const rewardsBox = document.getElementById('endlessRewardsBox');
  const lootLine = document.getElementById('endlessLootLine');
  const doubleBtn = document.getElementById('endlessDoubleBtn');
  const tacticalTipsWidget = document.getElementById('tacticalTipsWidget');

  if (isEndlessMode) {
    if (defeatScreen) defeatScreen.classList.add('endless-result-active');
    if (tacticalTipsWidget) tacticalTipsWidget.classList.add('hidden');

    const clearedWaves = Math.max(0, wave - 1);
    const sec = currentLevelSection || 1;
    const currentMapBest = endlessBestWavesBySection[sec] || 0;
    const isNewRecord = clearedWaves > currentMapBest;
    if (isNewRecord) {
      endlessBestWavesBySection[sec] = clearedWaves;
      endlessBestWave = Math.max(...Object.values(endlessBestWavesBySection));
      saveGameSoon();
    }

    if (kicker) kicker.textContent = typeof t === 'function' ? t('endless_arena') : 'ENDLESS ARENA';
    if (title) {
      const runCompleteText = typeof t === 'function' ? t('run_complete') : 'RUN COMPLETE';
      title.textContent = runCompleteText;
      title.setAttribute('data-text', runCompleteText);
    }
    if (el) {
      el.textContent = typeof t === 'function'
        ? t('wave_n_cleared', { n: wave, c: clearedWaves })
        : `WAVE ${wave} REACHED (${clearedWaves} CLEARED)`;
    }

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

    if (lootLine) {
      const diamondSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00e5ff" stroke-width="2.2" stroke-linejoin="round" style="filter: drop-shadow(0 0 5px rgba(0,229,255,0.7));"><polygon points="6 3 18 3 22 9 12 22 2 9" fill="rgba(0,229,255,.25)"/><polyline points="2 9 12 13 22 9"/><line x1="12" y1="22" x2="12" y2="13"/></svg>`;
      const prismSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d946ef" stroke-width="2.2" stroke-linejoin="round" style="filter: drop-shadow(0 0 5px rgba(217,70,239,0.7));"><polygon points="12 2 21 12 12 22 3 12" fill="rgba(217,70,239,.25)"/><polyline points="3 12 12 15 21 12"/><line x1="12" y1="22" x2="12" y2="22"/></svg>`;

      const rewardsLabel = typeof t === 'function' ? t('rewards') : 'REWARDS';

      lootLine.innerHTML = `
        <div class="result-reward-chip" style="--chip-border: #d946ef; --chip-label: #f5d0fe; margin: 10px auto 8px auto;">
          <span class="reward-label">${rewardsLabel}</span>
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="reward-amount">+${lastEndlessEarnedDiamonds}</span>
            ${diamondSvg}
            <span style="color: rgba(255, 255, 255, 0.2); font-weight: 300; margin: 0 2px;">|</span>
            <span class="reward-amount" style="color:#f5d0fe;">+${totalPrismsGranted}</span>
            ${prismSvg}
          </div>
        </div>
      `;
    }

    if (doubleBtn) {
      if (lastEndlessEarnedDiamonds > 0 || lastEndlessEarnedPrisms > 0) {
        doubleBtn.classList.remove('hidden');
        doubleBtn.disabled = false;
        const endlessAdIcon = getStandardAdIconSvg();
        const claimX2Label = typeof t === 'function' ? t('claim_x2') : 'CLAIM x2';
        doubleBtn.innerHTML = `
          ${endlessAdIcon}
          <span style="color:#ffffff; font-weight:800; letter-spacing:1px;">${claimX2Label}</span>
        `;
      } else {
        doubleBtn.classList.add('hidden');
      }
    }
  } else {
    if (defeatScreen) defeatScreen.classList.remove('endless-result-active');
    if (kicker) {
      if (typeof t === 'function') {
        kicker.textContent = isOverdriveMode ? t('hardcore') : t('level_kicker');
      } else {
        kicker.textContent = isOverdriveMode ? 'HARDCORE' : 'LEVEL';
      }
    }
    if (title) {
      const failedText = typeof t === 'function' ? t('failed') : 'FAILED';
      title.textContent = failedText;
      title.setAttribute('data-text', failedText);
    }
    if (rewardsBox) rewardsBox.classList.add('hidden');
    if (el) {
      const maxW = (LEVELS_DATA[currentLevel] && LEVELS_DATA[currentLevel].totalWaves) || 1;
      el.textContent = typeof t === 'function'
        ? t('wave_n_of_m', { n: Math.min(wave, maxW), m: maxW })
        : `WAVE ${Math.min(wave, maxW)} OF ${maxW} REACHED`;
    }
  }
}

// [ENG.CJ]
function updateRevivePromptHeadings() {
  const defeatScreen = document.getElementById('defeatScreen');
  const kicker = defeatScreen ? defeatScreen.querySelector('.result-kicker') : null;
  const title = defeatScreen ? defeatScreen.querySelector('.result-title') : null;
  const el = document.getElementById('defeatWaveLine');
  const rewardsBox = document.getElementById('endlessRewardsBox');

  if (rewardsBox) rewardsBox.classList.add('hidden');

  if (isEndlessMode) {
    if (defeatScreen) defeatScreen.classList.add('endless-result-active');
    if (kicker) kicker.textContent = typeof t === 'function' ? t('endless_arena') : 'ENDLESS ARENA';
    if (el) {
      const clearedWaves = Math.max(0, wave - 1);
      el.textContent = typeof t === 'function'
        ? t('wave_n_cleared', { n: wave, c: clearedWaves })
        : `WAVE ${wave} REACHED (${clearedWaves} CLEARED)`;
    }
  } else {
    if (defeatScreen) defeatScreen.classList.remove('endless-result-active');
    if (kicker) {
      if (typeof t === 'function') {
        kicker.textContent = isOverdriveMode ? t('hardcore') : t('level_kicker');
      } else {
        kicker.textContent = isOverdriveMode ? 'HARDCORE' : 'LEVEL';
      }
    }
    if (el) {
      const maxW = (LEVELS_DATA[currentLevel] && LEVELS_DATA[currentLevel].totalWaves) || 1;
      el.textContent = typeof t === 'function'
        ? t('wave_n_of_m', { n: Math.min(wave, maxW), m: maxW })
        : `WAVE ${Math.min(wave, maxW)} OF ${maxW} REACHED`;
    }
  }

  if (title) {
    const revQ = typeof t === 'function' ? t('revive_q') : 'REVIVE?';
    title.textContent = revQ;
    title.setAttribute('data-text', revQ);
  }
}

// [ENG.CK]
let isReviveAdPending = false;

function triggerEmergencyRevivePrompt() {
  gameState = 'DEFEAT';
  isReviveAdPending = false;
  if (typeof syncTopHudVisibility === 'function') syncTopHudVisibility();
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
  
  if (reviveBtn) {
    reviveBtn.disabled = false;
    reviveBtn.classList.remove('hidden');
    const reviveIcon = getStandardAdIconSvg();
    const reviveText = (typeof t === 'function' ? t('revive') : 'REVIVE');
    reviveBtn.innerHTML = `
      ${reviveIcon}
      <span id="reviveBtnLabel">${reviveText}</span>
    `;
    setReviveBtnLabel(reviveRemainingSeconds);
  }
  if (skipBtn) skipBtn.classList.add('hidden');
  if (retryBtn) retryBtn.classList.add('hidden');
  if (upgBtn) upgBtn.classList.add('hidden');
  if (levelsBtn) levelsBtn.classList.add('hidden');
  if (shopBtn) shopBtn.classList.add('hidden');

  updateRevivePromptHeadings();

  const loadoutWidget = document.getElementById('loadoutWidget');
  if (loadoutWidget) loadoutWidget.classList.add('hidden');
  document.getElementById('defeatScreen').classList.remove('hidden');
  if (!isEndlessMode) {
    replayDefeatFlash();
  } else {
    const existingFlash = document.getElementById('defeatFlash');
    if (existingFlash) existingFlash.remove();
  }

  if (reviveSkipShowTimer) clearTimeout(reviveSkipShowTimer);
  // [ENG.CL]
  reviveSkipShowTimer = setTimeout(() => {
    reviveSkipShowTimer = null;
    if (skipBtn) skipBtn.classList.remove('hidden');
  }, 1000);

  if (reviveTimerInterval) clearInterval(reviveTimerInterval);
  // [ENG.CM]
  reviveTimerInterval = setInterval(() => {
    if (isReviveAdPending) return;
    reviveRemainingSeconds--;
    if (reviveBtn && reviveRemainingSeconds > 0) {
      setReviveBtnLabel(reviveRemainingSeconds);
    }
    if (reviveRemainingSeconds <= 0) {
      finishRevivePromptWindow();
    }
  }, 1000);
}

// [ENG.CN]
function finishRevivePromptWindow() {
  isReviveAdPending = false;
  if (reviveTimerInterval) { clearInterval(reviveTimerInterval); reviveTimerInterval = null; }
  if (reviveSkipShowTimer) { clearTimeout(reviveSkipShowTimer); reviveSkipShowTimer = null; }
  musicSetDucked(false);
  music('lose');
  sfx('defeat');
  vibrate('error');

  const reviveTimerContainer = document.getElementById('reviveTimerContainer');
  if (reviveTimerContainer) reviveTimerContainer.classList.add('hidden');

  const tacticalTipsWidget = document.getElementById('tacticalTipsWidget');
  if (tacticalTipsWidget) {
    tacticalTipsWidget.classList.toggle('hidden', !!isEndlessMode);
  }

  const reviveBtn = document.getElementById('reviveBtn');
  const skipBtn = document.getElementById('reviveSkipBtn');
  const retryBtn = document.getElementById('defeatRetryBtn');
  const upgBtn = document.getElementById('defeatUpgradesBtn');
  const levelsBtn = document.getElementById('defeatLevelsBtn');
  const shopBtn = document.getElementById('defeatShopBtn');

  if (reviveBtn) {
    reviveBtn.disabled = false;
    reviveBtn.classList.add('hidden');
  }
  if (skipBtn) skipBtn.classList.add('hidden');
  if (retryBtn) retryBtn.classList.toggle('hidden', !!isEndlessMode);
  if (upgBtn) upgBtn.classList.remove('hidden');
  if (levelsBtn) levelsBtn.classList.remove('hidden');
  if (shopBtn) shopBtn.classList.remove('hidden');

  updateDefeatWaveLine();
  updateUpgradeButtonsLock();
  showLoadoutWidgetIn('loadoutAnchor-defeat');
  registerDefeatOutcome();
  clearActiveBattleSave();
}

// [ENG.CO]
function skipEmergencyRevive() {
  if (isReviveAdPending) return;
  finishRevivePromptWindow();
}

// [ENG.CP]
function acceptEmergencyRevive() {
  if (isReviveAdPending) return;
  isReviveAdPending = true;

  const reviveBtn = document.getElementById('reviveBtn');
  if (reviveBtn) reviveBtn.disabled = true;
  sfx('revive');

  // [ENG.CQ]
  const executeRevive = () => {
    isReviveAdPending = false;
    if (reviveTimerInterval) { clearInterval(reviveTimerInterval); reviveTimerInterval = null; }
    if (reviveSkipShowTimer) { clearTimeout(reviveSkipShowTimer); reviveSkipShowTimer = null; }
    if (reviveBtn) reviveBtn.disabled = false;
    const defeatScreen = document.getElementById('defeatScreen');
    if (defeatScreen) defeatScreen.classList.add('hidden');
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
      triggerImpactFeedback('heavy', 'heavy', { dur: 0.5, intensity: 16, forceShake: true });
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

        e.revivePushAnim = {
          startX: e.x,
          startY: e.y,
          endX: newX,
          endY: newY,
          endWp: newK,
          timer: 0,
          duration: 0.75
        };
      });
    }
    gameState = 'PLAYING';
    if (typeof syncTopHudVisibility === 'function') syncTopHudVisibility();
    updateUI();
    lastTime = performance.now();
  };

  const onNotRewarded = () => {
    isReviveAdPending = false;
    if (reviveBtn) reviveBtn.disabled = false;
    if (reviveRemainingSeconds <= 0) {
      finishRevivePromptWindow();
      return;
    }
    const skipBtn = document.getElementById('reviveSkipBtn');
    if (skipBtn) skipBtn.classList.remove('hidden');
    if (reviveBtn) setReviveBtnLabel(reviveRemainingSeconds);
  };

  showAdPlaceholder(executeRevive, onNotRewarded);
}

// Daily Rewards & Shop Operations
// [ENG.DI]
function getTodayDateString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// [ENG.DJ]
function checkDailyGiftReset() {
  const today = getTodayDateString();
  if (dailyGiftsClaimedDate !== today) {
    dailyGiftsClaimedDate = today;
    dailyGiftsClaimedCount = 0;
    saveGameSoon();
  }
}
window.forcePauseForBackground = forcePauseForBackground;

// [ENG.DK]
function claimDailyGiftsPack() {
  checkDailyGiftReset();
  if (dailyGiftsClaimedCount >= 3) {
    showHintToast(typeof t === 'function' ? t('daily_limit_reached') : 'Daily limit reached (3/3)');
    return;
  }

  // 1-й пак бесплатно, 2-й и 3-й строго через просмотр видео
  const needsAd = dailyGiftsClaimedCount > 0;

  // [ENG.DL]
  const grantGift = () => {
    let msg = '';
    if (dailyGiftsClaimedCount === 0) {
      diamonds += 10;
      msg = typeof t === 'function' ? t('diamonds_claimed', { n: 10 }) : '+10 Diamonds claimed!';
    } else if (dailyGiftsClaimedCount === 1) {
      diamonds += 15;
      msg = typeof t === 'function' ? t('diamonds_claimed', { n: 15 }) : '+15 Diamonds claimed!';
    } else {
      diamonds += 20;
      prisms += 1;
      msg = typeof t === 'function' ? t('combo_claimed', { d: 20, p: 1 }) : '+20 Diamonds & +1 Prism claimed!';
    }
    dailyGiftsClaimedCount++;
    updateDiamondUI();
    if (typeof updatePrismUI === 'function') updatePrismUI();
    if (typeof updateMenuBadges === 'function') updateMenuBadges();
    saveGame();
    sfx('reward');
    if (typeof renderShopScreen === 'function') renderShopScreen();
    showHintToast(msg);
  };

  if (needsAd) {
    showAdPlaceholder(grantGift, null);
  } else {
    grantGift();
  }
}

// [ENG.DM]
function synthesizePrism() {
  const isUnlocked = (typeof devMode !== 'undefined' && devMode) ||
    (typeof maxUnlockedLevel !== 'undefined' && maxUnlockedLevel >= 21) ||
    (typeof clearedLevels !== 'undefined' && clearedLevels.includes(20));
  if (!isUnlocked) {
    showHintToast(typeof t === 'function' ? t('unlocks_on_level_n', { n: 21 }) : 'Unlocks on Level 21');
    sfx('denied');
    return;
  }
  if (diamonds < 20) {
    showHintToast(typeof t === 'function' ? t('not_enough_diamonds_cost', { cost: 20 }) : 'Not enough Diamonds! (20 required)');
    sfx('denied');
    return;
  }
  diamonds -= 20;
  prisms = (prisms || 0) + 1;
  updateDiamondUI();
  if (typeof updatePrismUI === 'function') updatePrismUI();
  saveGame();
  sfx('reward');
  if (typeof renderShopScreen === 'function') renderShopScreen();
  showHintToast(typeof t === 'function' ? t('prism_synthesized') : '+1 Prism synthesized!');
}

// [ENG.DN]
function deconstructPrism() {
  const isUnlocked = (typeof devMode !== 'undefined' && devMode) ||
    (typeof maxUnlockedLevel !== 'undefined' && maxUnlockedLevel >= 21) ||
    (typeof clearedLevels !== 'undefined' && clearedLevels.includes(20));
  if (!isUnlocked) {
    showHintToast(typeof t === 'function' ? t('unlocks_on_level_n', { n: 21 }) : 'Unlocks on Level 21');
    sfx('denied');
    return;
  }
  if (prisms < 1) {
    showHintToast(typeof t === 'function' ? t('not_enough_prisms_cost', { cost: 1 }) : 'Not enough Prisms! (1 required)');
    sfx('denied');
    return;
  }
  prisms -= 1;
  diamonds = (diamonds || 0) + 15;
  updateDiamondUI();
  if (typeof updatePrismUI === 'function') updatePrismUI();
  saveGame();
  sfx('reward');
  if (typeof renderShopScreen === 'function') renderShopScreen();
  showHintToast(typeof t === 'function' ? t('diamonds_deconstructed') : '+15 Diamonds deconstructed!');
}

// [ENG.DO] Покупки только внутриигровых перков за кристаллы
function buyShopIAP(productId) {
  sfx('confirm');

  if (productId === 'time_mod_t1') {
    if (timeModTier >= 1) {
      showHintToast(typeof t === 'function' ? t('already_unlocked') : 'Already unlocked!');
      return;
    }
    if (diamonds < 50) {
      sfx('denied');
      showHintToast(typeof t === 'function' ? t('not_enough_diamonds_cost', { cost: 50 }) : 'Not enough Diamonds! (50 required)');
      return;
    }
    diamonds -= 50;
    timeModTier = 1;
    updateDiamondUI();
    saveGame();
    sfx('reward');
    if (typeof renderShopScreen === 'function') renderShopScreen();
    showHintToast(typeof t === 'function' ? t('time_mod_t1_unlocked') : 'Time Control Tier 1 unlocked!');
    return;
  }

  if (productId === 'time_mod_t2') {
    if (timeModTier >= 2) {
      showHintToast(typeof t === 'function' ? t('already_maxed') : 'Already maxed!');
      return;
    }
    if (timeModTier < 1) {
      sfx('denied');
      showHintToast(typeof t === 'function' ? t('unlock_tier_1_first') : 'Unlock Tier 1 first!');
      return;
    }
    if (diamonds < 200) {
      sfx('denied');
      showHintToast(typeof t === 'function' ? t('not_enough_diamonds_cost', { cost: 200 }) : 'Not enough Diamonds! (200 required)');
      return;
    }
    diamonds -= 200;
    timeModTier = 2;
    updateDiamondUI();
    saveGame();
    sfx('reward');
    if (typeof renderShopScreen === 'function') renderShopScreen();
    showHintToast(typeof t === 'function' ? t('time_mod_t2_unlocked') : 'Time Control Tier 2 unlocked!');
    return;
  }
}
window.buyShopIAP = buyShopIAP;

