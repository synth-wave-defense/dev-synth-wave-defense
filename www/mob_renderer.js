// Mob Beautification & Rendering Engine (Variant 4 — 20 Modular Settings & Dynamic Context Resolver)

// [MOB.A] Базовый профиль настроек по умолчанию (12/20 активных слоев + Свечение 1.3x)
const MOB_BEAUTIFICATION_DEFAULT = {
  beveledArmor: true,      // #1: Двойной контур бронепластин
  cornerBrackets: false,   // #2: Угловые силовые бамперы (снаружи корпуса)
  chassisStruts: true,     // #3: Силовые ребра жесткости шасси
  darkGlassFill: true,     // #4: Обсидиановая заливка корпуса
  vinylGrooves: false,      // #5: Виниловые звуковые дорожки
  liveWaveform: true,      // #6: Живая осциллограмма в ядре (по форме моба)
  vuEqualizer: true,      // #7: Спектральный эквалайзер (VU-Meter для боссов/минибоссов)
  subBassKick: false,      // #8: Сабвуферный бас-импульс (125 BPM)
  beatNeonBloom: true,     // #9: Вспышка неона на сильную долю
  sonicBowWave: false,     // #10: Носовая акустическая волна
  pathRotation: true,      // #11: Поворот корпуса по курсу движения
  plasmaThrusters: true,   // #12: Реактивные сопла и струи плазмы
  afterimageTrail: true,   // #13: Фантомный шлейф скорости
  cyberVisor: false,       // #14: Неоновый визор «Глаз Лидера»
  freqSparks: true,        // #15: Шлейф цифровых искр (Audio Dust)
  outrunStripes: true,     // #16: Ретро-полосы синтвейв-заката
  rgbChromatic: false,      // #17: Хроматический RGB-глитч контура
  coreTeslaArcs: false,    // #18: Энергетические микро-молнии ядра
  hardcoreFlame: false,    // #19: Корона Хардкор-Ярости (#f04878)
  bossOrbitals: false,     // #20: Орбитальные кольца Голиафа и Боссов
  glowDistance: 1.3        // Переменная дальность свечения (0.2x .. 2.6x)
};

// [MOB.B] Переопределения по игровым режимам (normal, endless, overdrive)
const MOB_MODE_OVERRIDES = {
  normal: {},
  endless: {
    cornerBrackets: true,
	sonicBowWave: true
  },
  overdrive: {
    vinylGrooves: true,
	rgbChromatic: true,
    glowDistance: 1.5
  }
};

// [MOB.C] Переопределения по цветовым палитрам (NEON_PALETTES)
const MOB_PALETTE_OVERRIDES = {
  default: {},
  matrix_green: {},
  cyber_gold: {},
  blood_moon: {},
  bio_venom: {},
  sakura_wave: {},
  solar_inferno: {}
};

// [MOB.D] Переопределения по главам/разделам (1..5)
const MOB_SECTION_OVERRIDES = {
  1: {},
  2: {},
  3: {},
  4: {},
  5: {}
};

// [MOB.E] Ручные живые переопределения из консоли или Dev-панели
window.MOB_CUSTOM_OVERRIDES = {};

// [MOB.F] Резолвер активной конфигурации (собирает итоговые переменные на текущий кадр)
const _activeMobCfg = Object.assign({}, MOB_BEAUTIFICATION_DEFAULT);

function resolveMobBeautificationConfig() {
  // 1. Сброс к дефолтному пресету игрока (12/20, glow 1.3x)
  for (let k in MOB_BEAUTIFICATION_DEFAULT) {
    _activeMobCfg[k] = MOB_BEAUTIFICATION_DEFAULT[k];
  }

  // 2. Применение переопределений раздела/главы (1..5)
  const sec = (typeof currentLevelSection !== 'undefined') ? currentLevelSection : 1;
  const secOv = MOB_SECTION_OVERRIDES[sec];
  if (secOv) {
    for (let k in secOv) _activeMobCfg[k] = secOv[k];
  }

  // 3. Применение переопределений цветовой темы (activePalette)
  const pal = (typeof activePalette !== 'undefined') ? activePalette : 'default';
  const palOv = MOB_PALETTE_OVERRIDES[pal];
  if (palOv) {
    for (let k in palOv) _activeMobCfg[k] = palOv[k];
  }

  // 4. Применение переопределений режима игры (normal / endless / overdrive)
  const mode = (typeof isOverdriveMode !== 'undefined' && isOverdriveMode)
    ? 'overdrive'
    : ((typeof isEndlessMode !== 'undefined' && isEndlessMode) ? 'endless' : 'normal');
  const modeOv = MOB_MODE_OVERRIDES[mode];
  if (modeOv) {
    for (let k in modeOv) _activeMobCfg[k] = modeOv[k];
  }

  // 5. Ручные переопределения (window.MOB_CUSTOM_OVERRIDES)
  if (window.MOB_CUSTOM_OVERRIDES) {
    for (let k in window.MOB_CUSTOM_OVERRIDES) {
      _activeMobCfg[k] = window.MOB_CUSTOM_OVERRIDES[k];
    }
  }

  // 6. Защита FPS при включенном Performance Mode (perfMode === 'low')
  if (typeof perfMode !== 'undefined' && perfMode === 'low') {
    _activeMobCfg.afterimageTrail = false;
    _activeMobCfg.rgbChromatic = false;
    _activeMobCfg.freqSparks = false;
    _activeMobCfg.outrunStripes = false;
    _activeMobCfg.glowDistance = Math.min(0.8, _activeMobCfg.glowDistance);
  }

  return _activeMobCfg;
}

// Утилита для быстрого переключения любого параметра из кода или консоли
function setMobBeautificationVar(key, value) {
  if (!window.MOB_CUSTOM_OVERRIDES) window.MOB_CUSTOM_OVERRIDES = {};
  window.MOB_CUSTOM_OVERRIDES[key] = value;
}
window.setMobBeautificationVar = setMobBeautificationVar;
window.resolveMobBeautificationConfig = resolveMobBeautificationConfig;

// [MOB.G] Геометрические примитивы и контуры корпусов Варианта 4 (нос направлен по +X = 0 рад)
function traceMobRegularPolygon(ctx, sides, r, rot = 0) {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const a = rot + (i * Math.PI * 2) / sides;
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function resolveMobCanonicalType(e) {
  const t = e.type || '';
  if (t === 'grunt' || t === 'scout' || t === 'tank' || t === 'swarm' || t === 'blinker' || t === 'goliath' ||
      t === 'emp_bomber' || t === 'boss_tank' || t === 'hive_empress' || t === 'chronos_warp' ||
      t === 'titan_core' || t === 'emp_overlord') {
    return t;
  }
  const sh = e.shape || 'circle';
  if (sh === 'triangle') return 'scout';
  if (sh === 'square') return e.isBoss ? 'boss_tank' : 'tank';
  if (sh === 'diamond' || sh === 'kite') return e.isBoss ? 'hive_empress' : 'swarm';
  if (sh === 'hexagon') return e.isBoss ? 'chronos_warp' : 'blinker';
  if (sh === 'octagon') return e.isBoss ? 'titan_core' : 'goliath';
  if (sh === 'triangle_inverted' || sh === 'trapezoid') return e.isBoss ? 'emp_overlord' : 'emp_bomber';
  return 'grunt';
}

function traceVariant4HullPath(ctx, id, r) {
  if (id === 'grunt') {
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
  } else if (id === 'scout') {
    ctx.beginPath();
    ctx.moveTo(r * 1.16, 0);
    ctx.lineTo(-r * 0.86, -r * 0.9);
    ctx.lineTo(-r * 0.52, 0);
    ctx.lineTo(-r * 0.86, r * 0.9);
    ctx.closePath();
  } else if (id === 'tank' || id === 'boss_tank') {
    const s = r * 0.88;
    const c = s * 0.22;
    ctx.beginPath();
    ctx.moveTo(s - c, -s);
    ctx.lineTo(s, -s + c);
    ctx.lineTo(s, s - c);
    ctx.lineTo(s - c, s);
    ctx.lineTo(-s + c, s);
    ctx.lineTo(-s, s - c);
    ctx.lineTo(-s, -s + c);
    ctx.lineTo(-s + c, -s);
    ctx.closePath();
  } else if (id === 'swarm' || id === 'hive_empress') {
    ctx.beginPath();
    ctx.moveTo(r * 1.15, 0);
    ctx.lineTo(0, -r * 0.82);
    ctx.lineTo(-r * 1.02, 0);
    ctx.lineTo(0, r * 0.82);
    ctx.closePath();
  } else if (id === 'blinker' || id === 'chronos_warp') {
    traceMobRegularPolygon(ctx, 6, r, 0);
  } else if (id === 'goliath' || id === 'titan_core') {
    traceMobRegularPolygon(ctx, 8, r, Math.PI / 8);
  } else if (id === 'emp_bomber' || id === 'emp_overlord') {
    ctx.beginPath();
    ctx.moveTo(r * 1.08, 0);
    ctx.lineTo(-r * 0.84, -r * 0.98);
    ctx.lineTo(-r * 0.52, 0);
    ctx.lineTo(-r * 0.84, r * 0.98);
    ctx.closePath();
  } else {
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
  }
}

// [MOB.H] Offscreen-кэш статических слоёв корпуса Варианта 4 в 3x Retina-разрешении (без мыла при зуме)
const _variant4HullSpriteCache = Object.create(null);
let _variant4HullSpriteCount = 0;

function clearVariant4HullCache() {
  for (const k in _variant4HullSpriteCache) delete _variant4HullSpriteCache[k];
  _variant4HullSpriteCount = 0;
}
window.clearVariant4HullCache = clearVariant4HullCache;

function getVariant4HullSprite(id, baseR, col, glowCol, isBoss, cfg) {
  const qR = Math.max(6, Math.round(baseR));
  const glowDist = cfg.glowDistance !== undefined ? cfg.glowDistance : 1.3;
  const qGlow = Math.round(glowDist * 10);
  const isLowPerf = (typeof perfMode !== 'undefined' && perfMode === 'low');
  const flags =
    (cfg.darkGlassFill ? 1 : 0) |
    (cfg.outrunStripes ? 2 : 0) |
    (cfg.chassisStruts ? 4 : 0) |
    (cfg.beveledArmor ? 8 : 0) |
    (cfg.vinylGrooves ? 16 : 0) |
    (cfg.cornerBrackets ? 32 : 0) |
    (cfg.cyberVisor ? 64 : 0) |
    (cfg.rgbChromatic ? 128 : 0) |
    (isBoss ? 256 : 0) |
    (isLowPerf ? 512 : 0);

  const key = `${id}_${qR}_${col}_${glowCol}_${qGlow}_${flags}`;
  const cached = _variant4HullSpriteCache[key];
  if (cached) return cached;

  // Защита от разрастания кэша при смене тем/режимов
  if (_variant4HullSpriteCount > 180) {
    clearVariant4HullCache();
  }

  // 3x разрешение для бритвенной резкости при максимальном зуме камеры (1.5x в режиме Low Perf)
  const texScale = isLowPerf ? 1.5 : 3.0;
  const blurPad = Math.ceil((isBoss ? 14 : 10) * Math.max(0.8, glowDist)) + 8;
  const halfSize = Math.ceil(qR * 1.45 + blurPad);
  const sizePx = Math.max(8, Math.round(halfSize * 2 * texScale));

  const off = document.createElement('canvas');
  off.width = sizePx;
  off.height = sizePx;
  const sCtx = off.getContext('2d');
  sCtx.scale(texScale, texScale);
  sCtx.translate(halfSize, halfSize);
  sCtx.lineJoin = 'round';
  sCtx.lineCap = 'round';

  const r = qR;

  // --- #17. CHROMATIC RGB GLITCH SPLIT ---
  if (cfg.rgbChromatic) {
    const shift = 1.6;
    sCtx.save();
    sCtx.translate(0, -shift);
    sCtx.strokeStyle = '#00e5ff';
    sCtx.globalAlpha = 0.45;
    sCtx.lineWidth = 1.4;
    traceVariant4HullPath(sCtx, id, r);
    sCtx.stroke();
    sCtx.restore();

    sCtx.save();
    sCtx.translate(0, shift);
    sCtx.strokeStyle = '#f05f9f';
    sCtx.globalAlpha = 0.45;
    sCtx.lineWidth = 1.4;
    traceVariant4HullPath(sCtx, id, r);
    sCtx.stroke();
    sCtx.restore();
  }

  // --- #4. MAIN HULL FILL (Obsidian Glass) & NEON GLOW ---
  sCtx.save();
  const baseBlur = (isBoss ? 12 : 8) * glowDist;
  sCtx.shadowColor = glowCol;
  sCtx.shadowBlur = Math.min(baseBlur, 12);
  sCtx.strokeStyle = col;
  sCtx.lineWidth = isBoss ? 2.6 : 2.1;

  traceVariant4HullPath(sCtx, id, r);
  if (cfg.darkGlassFill) {
    const innerR = Math.max(0.05, r * 0.12 * glowDist);
    const outerR = Math.max(innerR + 1, r * Math.min(2.2, Math.max(0.65, glowDist)));
    const grad = sCtx.createRadialGradient(0, 0, innerR, 0, 0, outerR);
    grad.addColorStop(0, 'rgba(12, 24, 58, 0.46)');
    grad.addColorStop(Math.min(0.85, 0.48 * glowDist), 'rgba(6, 11, 24, 0.62)');
    grad.addColorStop(1, 'rgba(3, 4, 10, 0.76)');
    sCtx.fillStyle = grad;
    sCtx.fill();
  } else {
    sCtx.fillStyle = glowCol + '28';
    sCtx.fill();
  }
  sCtx.stroke();
  sCtx.restore();

  // --- #16. OUTRUN SUN-STRIPES INSIDE HULL (1 раз при создании спрайта!) ---
  if (cfg.outrunStripes && r >= 9) {
    sCtx.save();
    traceVariant4HullPath(sCtx, id, r * 0.9);
    sCtx.clip();
    sCtx.strokeStyle = col;
    sCtx.globalAlpha = 0.28;
    sCtx.lineWidth = 1.2;
    const step = Math.max(2.5, r * 0.28);
    sCtx.beginPath();
    for (let sy = -r; sy <= r; sy += step) {
      sCtx.moveTo(-r, sy);
      sCtx.lineTo(r, sy);
    }
    sCtx.stroke();
    sCtx.restore();
  }

  // --- #3. INTERNAL WIREFRAME CHASSIS STRUTS ---
  if (cfg.chassisStruts) {
    sCtx.save();
    sCtx.strokeStyle = col;
    sCtx.globalAlpha = 0.42;
    sCtx.lineWidth = 1.15;
    const strutCount = (id === 'goliath' || id === 'titan_core') ? 8 : (id === 'blinker' || id === 'chronos_warp' ? 6 : 4);
    const rotOffset = (id === 'tank' || id === 'boss_tank') ? Math.PI / 4 : 0;
    sCtx.beginPath();
    for (let i = 0; i < strutCount; i++) {
      const a = rotOffset + (i * Math.PI * 2) / strutCount;
      const cosA = Math.cos(a);
      const sinA = Math.sin(a);
      sCtx.moveTo(cosA * r * 0.38, sinA * r * 0.38);
      sCtx.lineTo(cosA * r * 0.88, sinA * r * 0.88);
    }
    sCtx.stroke();
    sCtx.restore();
  }

  // --- #1. BEVELED ARMOR PLATES ---
  if (cfg.beveledArmor) {
    sCtx.save();
    sCtx.strokeStyle = col;
    sCtx.globalAlpha = 0.58;
    sCtx.lineWidth = 1.25;
    traceVariant4HullPath(sCtx, id, r * 0.68);
    sCtx.stroke();
    sCtx.restore();
  }

  // --- #5. CONCENTRIC VINYL GROOVES ---
  if (cfg.vinylGrooves) {
    sCtx.save();
    sCtx.strokeStyle = '#ffffff';
    sCtx.globalAlpha = 0.22;
    sCtx.lineWidth = 0.9;
    sCtx.beginPath();
    sCtx.arc(0, 0, r * 0.54, 0, Math.PI * 2);
    sCtx.moveTo(r * 0.36, 0);
    sCtx.arc(0, 0, r * 0.36, 0, Math.PI * 2);
    sCtx.stroke();
    sCtx.restore();
  }

  // --- #2. CORNER BRACKETS (Positioned Outside Hull) ---
  if (cfg.cornerBrackets) {
    sCtx.save();
    sCtx.strokeStyle = '#ffffff';
    sCtx.shadowColor = col;
    sCtx.shadowBlur = 5;
    sCtx.lineWidth = 1.9;
    const gap = 2.4;

    const drawExternalCornerBracketAt = (vCurr, vPrev, vNext, armLen) => {
      const d1x = vPrev[0] - vCurr[0], d1y = vPrev[1] - vCurr[1];
      const len1 = Math.hypot(d1x, d1y) || 1;
      const u1x = d1x / len1, u1y = d1y / len1;

      const d2x = vNext[0] - vCurr[0], d2y = vNext[1] - vCurr[1];
      const len2 = Math.hypot(d2x, d2y) || 1;
      const u2x = d2x / len2, u2y = d2y / len2;

      const bx = u1x + u2x, by = u1y + u2y;
      const blen = Math.hypot(bx, by) || 1;
      let nout_x = -bx / blen, nout_y = -by / blen;
      if (nout_x * vCurr[0] + nout_y * vCurr[1] < 0) {
        nout_x = -nout_x;
        nout_y = -nout_y;
      }

      const cosTheta = u1x * u2x + u1y * u2y;
      const sinHalf = Math.sqrt(Math.max(0.08, (1 - cosTheta) * 0.5));
      const shift = Math.min(gap * 2.2, gap / sinHalf);

      const vx = vCurr[0] + nout_x * shift;
      const vy = vCurr[1] + nout_y * shift;

      const a1 = Math.min(armLen, len1 * 0.44);
      const a2 = Math.min(armLen, len2 * 0.44);

      sCtx.beginPath();
      sCtx.moveTo(vx + u1x * a1, vy + u1y * a1);
      sCtx.lineTo(vx, vy);
      sCtx.lineTo(vx + u2x * a2, vy + u2y * a2);
      sCtx.stroke();
    };

    if (id === 'tank' || id === 'boss_tank') {
      const s = r * 0.98;
      const b = s * 0.34;
      [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sy]) => {
        sCtx.beginPath();
        sCtx.moveTo(sx * (s - b), sy * s);
        sCtx.lineTo(sx * s, sy * s);
        sCtx.lineTo(sx * s, sy * (s - b));
        sCtx.stroke();
      });
    } else if (id === 'grunt' || id === 'goliath' || id === 'titan_core') {
      const rExt = r + gap;
      for (let a of [-0.65, 0.65, Math.PI - 0.65, Math.PI + 0.65]) {
        sCtx.beginPath();
        sCtx.arc(0, 0, rExt, a - 0.16, a + 0.16);
        sCtx.stroke();
      }
    } else if (id === 'scout') {
      const v = [[r * 1.16, 0], [-r * 0.86, -r * 0.9], [-r * 0.52, 0], [-r * 0.86, r * 0.9]];
      const arm = r * 0.36;
      drawExternalCornerBracketAt(v[0], v[3], v[1], arm);
      drawExternalCornerBracketAt(v[1], v[0], v[2], arm);
      drawExternalCornerBracketAt(v[3], v[2], v[0], arm);
    } else if (id === 'swarm' || id === 'hive_empress') {
      const v = [[r * 1.15, 0], [0, -r * 0.82], [-r * 1.02, 0], [0, r * 0.82]];
      const arm = r * 0.32;
      for (let i = 0; i < 4; i++) {
        drawExternalCornerBracketAt(v[i], v[(i + 3) % 4], v[(i + 1) % 4], arm);
      }
    } else if (id === 'blinker' || id === 'chronos_warp') {
      const v = [];
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI * 2) / 6;
        v.push([Math.cos(a) * r, Math.sin(a) * r]);
      }
      const arm = r * 0.32;
      [1, 5].forEach(i => drawExternalCornerBracketAt(v[i], v[(i + 5) % 6], v[(i + 1) % 6], arm));
    } else if (id === 'emp_bomber' || id === 'emp_overlord') {
      const v = [[r * 1.08, 0], [-r * 0.84, -r * 0.98], [-r * 0.52, 0], [-r * 0.84, r * 0.98]];
      const arm = r * 0.36;
      drawExternalCornerBracketAt(v[0], v[3], v[1], arm);
      drawExternalCornerBracketAt(v[1], v[0], v[2], arm);
      drawExternalCornerBracketAt(v[3], v[2], v[0], arm);
    }
    sCtx.restore();
  }

  // --- #14. CYBER VISOR ("Leader Eye") ---
  if (cfg.cyberVisor) {
    sCtx.save();
    sCtx.strokeStyle = '#ffffff';
    sCtx.shadowColor = '#00e5ff';
    sCtx.shadowBlur = 6;
    sCtx.lineWidth = 2.0;
    sCtx.beginPath();
    sCtx.moveTo(r * 0.68, -r * 0.24);
    sCtx.lineTo(r * 0.92, 0);
    sCtx.lineTo(r * 0.68, r * 0.24);
    sCtx.stroke();
    sCtx.restore();
  }

  // --- Внутренняя голографическая рамка ядра (запекаем в спрайт, чтобы не тратить GPU каждый кадр) ---
  if (cfg.liveWaveform && !isBoss && id !== 'goliath' && id !== 'grunt' && r >= 9) {
    sCtx.save();
    const isPinkWave = (id === 'emp_bomber' || id === 'emp_overlord');
    sCtx.strokeStyle = isPinkWave ? 'rgba(240, 95, 159, 0.55)' : 'rgba(255, 255, 255, 0.52)';
    sCtx.lineWidth = 1.1;
    if (id === 'scout') {
      sCtx.beginPath();
      sCtx.moveTo(r * 0.72, 0);
      sCtx.lineTo(-r * 0.54, -r * 0.54);
      sCtx.lineTo(-r * 0.36, 0);
      sCtx.lineTo(-r * 0.54, r * 0.54);
      sCtx.closePath();
      sCtx.stroke();
    } else if (id === 'emp_bomber' || id === 'emp_overlord') {
      sCtx.beginPath();
      sCtx.moveTo(r * 0.68, 0);
      sCtx.lineTo(-r * 0.52, -r * 0.58);
      sCtx.lineTo(-r * 0.32, 0);
      sCtx.lineTo(-r * 0.52, r * 0.58);
      sCtx.closePath();
      sCtx.stroke();
    } else if (id === 'tank' || id === 'boss_tank') {
      const sq = r * 0.52;
      const cq = sq * 0.25;
      sCtx.beginPath();
      sCtx.moveTo(sq - cq, -sq);
      sCtx.lineTo(sq, -sq + cq);
      sCtx.lineTo(sq, sq - cq);
      sCtx.lineTo(sq - cq, sq);
      sCtx.lineTo(-sq + cq, sq);
      sCtx.lineTo(-sq, sq - cq);
      sCtx.lineTo(-sq, -sq + cq);
      sCtx.lineTo(-sq + cq, -sq);
      sCtx.closePath();
      sCtx.stroke();
    } else if (id === 'swarm' || id === 'hive_empress') {
      sCtx.beginPath();
      sCtx.moveTo(r * 0.68, 0);
      sCtx.lineTo(0, -r * 0.50);
      sCtx.lineTo(-r * 0.62, 0);
      sCtx.lineTo(0, r * 0.50);
      sCtx.closePath();
      sCtx.stroke();
    } else if (id === 'blinker' || id === 'chronos_warp') {
      traceMobRegularPolygon(sCtx, 6, r * 0.58, 0);
      sCtx.stroke();
    }
    sCtx.restore();
  }

  const entry = { canvas: off, halfSize, baseR: qR };
  _variant4HullSpriteCache[key] = entry;
  _variant4HullSpriteCount++;
  return entry;
}

// [MOB.I] Отрисовка всех слоев Варианта 4 с использованием кэша корпуса и адаптивного crowdThrottle
function drawVariant4MobUnit(ctx, e, cfg, time, crowdLevel = 0) {
  const id = resolveMobCanonicalType(e);
  const isBlinkerShielded = (id === 'blinker' || id === 'chronos_warp') && e.isShielded;
  const col = e.isEnraged ? '#f04878' : (isBlinkerShielded ? '#64748b' : (e.color || '#00e5ff'));
  const glowCol = e.glow || col;

  // #8. Sub-Bass Heartbeat Scale (125 BPM)
  const beatPhase = (time * (125 / 60)) % 1;
  const kickEnv = Math.pow(Math.max(0, 1 - beatPhase * 2.4), 2);
  const pulseMult = cfg.subBassKick ? (1 + kickEnv * 0.085) : 1;
  const baseR = Math.max(6, e.radius || 12);
  const r = baseR * pulseMult;
  const isBossOrMiniBoss = !!(e.isBoss || e.isMiniBoss || id === 'goliath');
  const isTinySwarm = (id === 'swarm' && baseR <= 9);

  // Режим толпы: при 30+ мобах отключаем живой shadowBlur (свечение уже есть в кэше спрайта!)
  const allowLiveGlow = (crowdLevel < 2) || isBossOrMiniBoss;
  const angle = ((cfg.pathRotation && typeof e.angle === 'number') ? e.angle : 0) + (e.hitTilt || 0);

  ctx.save();
  ctx.rotate(angle);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // --- #19. HARDCORE ENRAGED FLAME CROWN (#f04878) ---
  if (cfg.hardcoreFlame || e.isEnraged) {
    ctx.strokeStyle = '#f04878';
    ctx.shadowBlur = allowLiveGlow ? 6 : 0;
    if (allowLiveGlow) ctx.shadowColor = '#f04878';
    ctx.lineWidth = 1.6;
    const spikes = 10;
    ctx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const rad = i % 2 === 0 ? r * 1.34 : r * 1.14;
      const a = time * 2.2 + (i * Math.PI) / spikes;
      if (i === 0) ctx.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
      else ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
    }
    ctx.closePath();
    ctx.stroke();
  }

  // --- #20. BOSS & GOLIATH HARMONIC ORBITALS ---
  if (cfg.bossOrbitals && isBossOrMiniBoss) {
    ctx.save();
    ctx.strokeStyle = col;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 1.4;
    ctx.setLineDash([5, 4]);
    ctx.rotate(time * 1.1);
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.26, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // --- BLINKER PHASE SHIELD (#64748b / #ffffff) ---
  if (id === 'blinker' || id === 'chronos_warp') {
    ctx.save();
    ctx.strokeStyle = isBlinkerShielded ? '#ffffff' : '#64748b';
    ctx.lineWidth = isBlinkerShielded ? 2.2 : 1.5;
    ctx.setLineDash([6, 4]);
    ctx.rotate(time * 1.4);
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.24, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // --- #13. AFTERIMAGE MOTION TRAIL (сокращаем при сильной толпе) ---
  if (cfg.afterimageTrail && (!isTinySwarm || crowdLevel === 0)) {
    const trailSteps = crowdLevel >= 2 ? 1 : 2;
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.3;
    ctx.shadowBlur = 0;
    for (let tIdx = 1; tIdx <= trailSteps; tIdx++) {
      ctx.save();
      ctx.translate(-tIdx * 4.5, 0);
      ctx.scale(1 - tIdx * 0.08, 1 - tIdx * 0.08);
      ctx.globalAlpha = 0.28 / tIdx;
      traceVariant4HullPath(ctx, id, r);
      ctx.stroke();
      ctx.restore();
    }
  }

  // --- #15. AUDIO FREQUENCY SPARKS (Audio Dust) ---
  if (cfg.freqSparks && (crowdLevel < 2 || isBossOrMiniBoss)) {
    ctx.fillStyle = col;
    ctx.shadowBlur = 0;
    const sparkCount = crowdLevel >= 1 && !isBossOrMiniBoss ? 2 : 3;
    for (let sp = 0; sp < sparkCount; sp++) {
      const prog = ((time * 2.4 + sp * 0.33) % 1);
      const sx = -r * (0.85 + prog * 0.9);
      const sy = Math.sin(sp * 2.5 + time * 8) * r * 0.45 * (1 - prog * 0.5);
      const sz = (1 - prog) * 2.6;
      ctx.globalAlpha = (1 - prog) * 0.75;
      ctx.fillRect(sx - sz * 0.5, sy - sz * 0.5, sz, sz);
    }
    ctx.globalAlpha = 1.0;
  }

  // --- #12. PLASMA THRUSTER PLUMES ---
  if (cfg.plasmaThrusters) {
    const flameLen = r * (0.48 + Math.sin(time * 28) * 0.12 + (cfg.subBassKick ? kickEnv * 0.22 : 0));
    const thrustCol = (id === 'emp_bomber' || id === 'emp_overlord') ? '#f05f9f' : col;
    ctx.fillStyle = thrustCol;
    ctx.shadowBlur = (allowLiveGlow && crowdLevel === 0) ? 5 : 0;
    if (ctx.shadowBlur > 0) ctx.shadowColor = thrustCol;
    ctx.globalAlpha = 0.85;

    const drawNozzleFlame = (ny, nWidth) => {
      ctx.beginPath();
      ctx.moveTo(-r * 0.72, ny - nWidth);
      ctx.lineTo(-r * 0.72 - flameLen, ny);
      ctx.lineTo(-r * 0.72, ny + nWidth);
      ctx.closePath();
      ctx.fill();
    };

    if (id === 'tank' || id === 'boss_tank' || id === 'goliath' || id === 'titan_core') {
      drawNozzleFlame(-r * 0.38, r * 0.16);
      drawNozzleFlame(r * 0.38, r * 0.16);
    } else {
      drawNozzleFlame(0, r * 0.22);
    }
    ctx.globalAlpha = 1.0;
    ctx.shadowBlur = 0;
  }

  // --- #10. SONIC BOW WAVE ---
  if (cfg.sonicBowWave && (crowdLevel < 2 || isBossOrMiniBoss)) {
    const bowDist = r * (1.22 + ((time * 1.8) % 1) * 0.32);
    const bowAlpha = (1 - ((time * 1.8) % 1)) * 0.65;
    ctx.strokeStyle = '#ffffff';
    ctx.globalAlpha = bowAlpha;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, bowDist, -0.55, 0.55);
    ctx.stroke();
    ctx.globalAlpha = 1.0;
  }

  // --- #4, #1, #3, #5, #14, #16, #17: БЫСТРЫЙ ВЫВОД ЗАКЭШИРОВАННОГО КОРПУСА ---
  const hullSprite = getVariant4HullSprite(id, baseR, col, glowCol, !!e.isBoss, cfg);
  const drawScale = r / hullSprite.baseR;
  const drawHalf = hullSprite.halfSize * drawScale;
  ctx.drawImage(hullSprite.canvas, -drawHalf, -drawHalf, drawHalf * 2, drawHalf * 2);

  // --- #9. BEAT NEON BLOOM (лёгкая пульсация обводки на бит без shadowBlur) ---
  if (cfg.beatNeonBloom && kickEnv > 0.25 && crowdLevel < 2) {
    ctx.strokeStyle = '#ffffff';
    ctx.globalAlpha = kickEnv * 0.35;
    ctx.lineWidth = 1.2;
    traceVariant4HullPath(ctx, id, r);
    ctx.stroke();
    ctx.globalAlpha = 1.0;
  }

  // --- #18. CORE TESLA ARCS ---
  if (cfg.coreTeslaArcs) {
    ctx.strokeStyle = (id === 'emp_bomber' || id === 'emp_overlord') ? '#f05f9f' : '#00e5ff';
    ctx.globalAlpha = 0.78;
    ctx.lineWidth = 1.15;
    for (let k = 0; k < 2; k++) {
      const ang = time * 5.5 + k * Math.PI;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(ang + 0.25) * r * 0.45, Math.sin(ang - 0.25) * r * 0.45);
      ctx.lineTo(Math.cos(ang) * r * 0.82, Math.sin(ang) * r * 0.82);
      ctx.stroke();
    }
    ctx.globalAlpha = 1.0;
  }

  // --- #7. VU-METER EQUALIZER BARS (Только у Боссов и Минибоссов) ---
  const hasVuEqualizer = cfg.vuEqualizer && isBossOrMiniBoss;
  if (hasVuEqualizer) {
    const isPinkEmp = (id === 'emp_overlord' || id === 'emp_bomber');
    const barW = r * 0.2;
    ctx.shadowBlur = isPinkEmp ? 5 : 0;
    if (isPinkEmp) ctx.shadowColor = '#f05f9f';
    for (let b = -1; b <= 1; b++) {
      const amp = 0.28 + 0.65 * Math.abs(Math.sin(time * 6.5 - b * 1.1));
      const bh = r * 0.84 * amp;
      if (isPinkEmp) {
        ctx.fillStyle = amp > 0.72 ? '#ff94c8' : '#f05f9f';
      } else {
        ctx.fillStyle = amp > 0.75 ? '#ffffff' : col;
      }
      ctx.fillRect(b * (barW * 1.45) - barW * 0.5, -bh * 0.5, barW, bh);
    }
    ctx.shadowBlur = 0;
  }

  // --- #6. LIVE OSCILLOSCOPE WAVEFORM IN CORE (Zero-Clip аналитическая отрисовка) ---
  if (cfg.liveWaveform && !hasVuEqualizer) {
    const isPinkWave = (id === 'emp_bomber' || id === 'emp_overlord');
    ctx.strokeStyle = isPinkWave ? '#ff7ac3' : '#ffffff';
    ctx.shadowBlur = (allowLiveGlow && crowdLevel === 0) ? 4 : 0;
    if (ctx.shadowBlur > 0) ctx.shadowColor = isPinkWave ? '#f05f9f' : col;
    ctx.lineWidth = 1.5;

    if (isTinySwarm) {
      // Ультра-быстрый импульс для мелких юнитов роя (без 20-шагового цикла)
      const amp = Math.sin(time * 14) * (r * 0.26);
      ctx.beginPath();
      ctx.moveTo(-r * 0.42, 0);
      ctx.lineTo(0, amp);
      ctx.lineTo(r * 0.48, 0);
      ctx.stroke();
    } else if (id === 'grunt') {
      ctx.beginPath();
      const span = r * 0.60;
      const samples = 12;
      for (let i = 0; i <= samples; i++) {
        const nx = (i / samples) * 2 - 1;
        const px = nx * span;
        const envelope = Math.cos(nx * Math.PI * 0.5);
        const py = Math.sin(nx * 5.2 + time * 11.5) * (r * 0.34) * envelope;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    } else if (id === 'scout') {
      ctx.beginPath();
      const xStart = -r * 0.44;
      const xEnd = r * 0.60;
      const steps = 12;
      for (let i = 0; i <= steps; i++) {
        const tNorm = i / steps;
        const px = xStart + tNorm * (xEnd - xStart);
        const maxHalfH = (1 - tNorm * 0.85) * (r * 0.32);
        const phase = tNorm * 7.5 + time * 13.0;
        const waveVal = (Math.sin(phase) + 0.45 * Math.sin(phase * 2)) / 1.35;
        const py = waveVal * maxHalfH;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    } else if (id === 'emp_bomber' || id === 'emp_overlord') {
      ctx.beginPath();
      const span = r * 0.46;
      const steps = 12;
      for (let i = 0; i <= steps; i++) {
        const nx = (i / steps) * 2 - 1;
        const px = -r * 0.04 + nx * span;
        const env = (1 - Math.abs(nx) * 0.65);
        const py = Math.sin(nx * 6.5 + time * 12) * (r * 0.28) * env;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    } else if (id === 'tank' || id === 'boss_tank') {
      const sq = r * 0.44;
      ctx.beginPath();
      const steps = 12;
      for (let i = 0; i <= steps; i++) {
        const nx = (i / steps) * 2 - 1;
        const px = nx * sq;
        const rawSin = Math.sin(nx * 4.8 + time * 9.5);
        const sqVal = Math.tanh(rawSin * 4.5);
        const py = sqVal * (sq * 0.56);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    } else if (id === 'swarm' || id === 'hive_empress') {
      ctx.beginPath();
      const span = r * 0.52;
      const steps = 10;
      for (let i = 0; i <= steps; i++) {
        const nx = (i / steps) * 2 - 1;
        const px = nx * span;
        const env = Math.max(0, 1 - Math.abs(nx));
        const py = Math.sin(nx * 6.5 + time * 14) * (r * 0.34) * env;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    } else if (id === 'blinker' || id === 'chronos_warp') {
      ctx.beginPath();
      const span = r * 0.48;
      const steps = 12;
      for (let i = 0; i <= steps; i++) {
        const nx = (i / steps) * 2 - 1;
        const px = nx * span;
        const hexEnv = Math.min(1, (1 - Math.abs(nx)) * 1.45);
        const py = Math.sin(nx * 5.5 + time * 11.5) * (r * 0.32) * hexEnv;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    } else {
      ctx.beginPath();
      const span = r * 0.48;
      const steps = 12;
      for (let i = 0; i <= steps; i++) {
        const nx = (i / steps) * 2 - 1;
        const px = nx * span;
        const octEnv = Math.cos(nx * Math.PI * 0.45);
        const py = Math.tanh(Math.sin(nx * 4.5 + time * 9.5) * 3.0) * (r * 0.28) * octEnv;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
  }

  ctx.restore();
}

// [MOB.J] Главная функция отрисовки врага для вызова из ui.js
let _stasisSnowflakeSprite = null;
function getStasisSnowflakeSprite() {
  if (_stasisSnowflakeSprite) return _stasisSnowflakeSprite;
  const c = document.createElement('canvas');
  c.width = 48;
  c.height = 48;
  const sCtx = c.getContext('2d');
  sCtx.scale(2, 2);
  sCtx.translate(12, 12);
  sCtx.lineCap = 'round';
  sCtx.lineJoin = 'round';

  const mainR = 9.0;
  const tipPos = mainR * 0.56;
  const branchLen = 3.2;

  // Ледяное свечение #38bdf8 в стиле центральной снежинки Stasis
  sCtx.strokeStyle = '#38bdf8';
  sCtx.globalAlpha = 0.55;
  sCtx.lineWidth = 3.4;
  sCtx.beginPath();
  for (let k = 0; k < 6; k++) {
    const a = (k * Math.PI) / 3;
    sCtx.moveTo(0, 0);
    sCtx.lineTo(Math.cos(a) * mainR, Math.sin(a) * mainR);
  }
  sCtx.stroke();

  // Чёткий белый каркас с V-образными веточками на концах лучей
  sCtx.globalAlpha = 1.0;
  sCtx.strokeStyle = '#ffffff';
  sCtx.lineWidth = 1.5;
  for (let k = 0; k < 6; k++) {
    sCtx.save();
    sCtx.rotate((k * Math.PI) / 3);

    sCtx.beginPath();
    sCtx.moveTo(0, 0);
    sCtx.lineTo(mainR, 0);
    sCtx.stroke();

    sCtx.beginPath();
    sCtx.moveTo(tipPos + branchLen * 0.68, -branchLen * 0.75);
    sCtx.lineTo(tipPos, 0);
    sCtx.lineTo(tipPos + branchLen * 0.68, branchLen * 0.75);
    sCtx.stroke();

    sCtx.restore();
  }

  _stasisSnowflakeSprite = c;
  return c;
}

function renderConfiguredEnemyModel(e, showHpBar = true) {
  if (!e || typeof e.x !== 'number' || typeof e.y !== 'number') return;
  const isHyperion = (typeof activePalette !== 'undefined' && activePalette === 'matrix_green');
  const cfg = resolveMobBeautificationConfig();
  const time = performance.now() / 1000;

  const totalEnemies = (typeof enemies !== 'undefined' && enemies) ? enemies.length : 0;
  const crowdLevel = totalEnemies >= 24 ? 2 : (totalEnemies >= 14 ? 1 : 0);

  ctx.save();
  const jx = (e.jitterTimer > 0) ? (Math.random() - 0.5) * 3.8 : 0;
  const jy = (e.jitterTimer > 0) ? (Math.random() - 0.5) * 3.8 : 0;
  ctx.translate(e.x + (e.kbX || 0) + jx, e.y + (e.kbY || 0) + jy);

  // 1. Аура элитного моба (isElite)
  if (e.isElite) {
    const eRad = e.radius || 12;
    const col1 = e.glow || e.color || '#00e5ff';
    const col2 = '#f04878';

    ctx.strokeStyle = col1;
    ctx.lineWidth = 2.0;
    ctx.shadowBlur = crowdLevel === 0 ? 6 : 0;
    if (ctx.shadowBlur > 0) ctx.shadowColor = col1;
    ctx.beginPath();
    ctx.arc(0, 0, eRad * 1.35, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = col2;
    ctx.lineWidth = 1.8;
    if (ctx.shadowBlur > 0) ctx.shadowColor = col2;
    ctx.beginPath();
    ctx.arc(0, 0, eRad * 1.62, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  // 2. Отрисовка самого моба со всеми выбранными слоями Варианта 4
  drawVariant4MobUnit(ctx, e, cfg, time, crowdLevel);

  // 3. Индикатор замедления Stasis (кэшированная снежинка вместо дорогого fillText)
  if (e.slowTimer > 0) {
    const rad = e.radius || 12;
    const snowSprite = getStasisSnowflakeSprite();
    ctx.drawImage(snowSprite, rad * 0.85 - 8, -rad * 0.85 - 8, 16, 16);
  }

  // 4. Эффект рывка босса (dashLineMoving)
  if (e.dashLineMoving) {
    ctx.save();
    ctx.rotate(e.angle || 0);
    ctx.strokeStyle = e.glow || '#fb923c';
    ctx.lineWidth = 4;
    if (typeof setGlow === 'function') setGlow(e.color || '#f97316', 10);
    ctx.beginPath();
    ctx.moveTo(-50, 0);
    ctx.lineTo(0, 0);
    ctx.stroke();
    ctx.restore();
  }

  // 5. Эффект вспышки телепорта (teleportFlashTimer)
  if (e.teleportFlashTimer > 0) {
    const prog = e.teleportFlashTimer / 0.35;
    ctx.save();
    ctx.strokeStyle = e.glow || '#fb923c';
    ctx.lineWidth = 4;
    if (typeof setGlow === 'function') setGlow(e.glow || '#fb923c', 12 * prog);
    ctx.beginPath();
    ctx.arc(0, 0, (e.radius || 17) * (1.2 + (1.0 - prog) * 0.6), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // 6. Полоска здоровья (HP Bar)
  if (showHpBar && typeof settings !== 'undefined' && settings.showEnemyHp && (e.isBoss || e.isMiniBoss || (e.hp < e.maxHp))) {
    ctx.shadowBlur = 0;
    const rad = e.radius || 12;
    const barW = Math.max(22, rad * 2.2);
    const barH = e.isBoss ? 5 : (e.isMiniBoss ? 4 : 3);
    const hpPct = Math.max(0, e.hp / (e.maxHp || 1));
    const barY = -rad - (e.isBoss ? 14 : (e.isMiniBoss ? 12 : 8));

    ctx.fillStyle = 'rgba(7, 10, 20, 0.9)';
    ctx.fillRect(-barW / 2, barY, barW, barH);
    const highHpColor = isHyperion ? '#ff6b00' : '#00e5ff';
    ctx.fillStyle = e.isBoss ? (e.color || '#f05f9f') : (hpPct > 0.5 ? highHpColor : '#ffb700');
    ctx.fillRect(-barW / 2, barY, barW * hpPct, barH);
  }

  ctx.restore();
}
window.renderConfiguredEnemyModel = renderConfiguredEnemyModel;