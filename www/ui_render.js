// Synth Wave Defense — ui_render.js (Offscreen grid, path rails, tower V8 renderer, master render(now) loop)

// [UI.G]
function updateOffscreenGrid() {
  if (!offscreenGridCanvas) {
    offscreenGridCanvas = document.createElement('canvas');
  }

  const w = COLS * TILE_SIZE;
  const h = ROWS * TILE_SIZE;

  if (offscreenGridCanvas.width !== w || offscreenGridCanvas.height !== h) {
    offscreenGridCanvas.width = w;
    offscreenGridCanvas.height = h;
  }

  const oCtx = offscreenGridCanvas.getContext('2d');
  oCtx.clearRect(0, 0, w, h);

  const th = getTheme();
  const c1Rgb = th.rgb1 ? th.rgb1.cssRgb : '0, 229, 255';

  // Static grid cell background rendering.
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cellVal = grid[r] ? grid[r][c] : 0;
      oCtx.fillStyle = (cellVal === 1)
        ? `rgba(${c1Rgb}, 0.08)`
        : (cellVal === 3 ? 'rgba(0, 0, 0, 0.78)' : 'rgba(8, 12, 26, 0.40)');
      oCtx.fillRect(c * TILE_SIZE, r * TILE_SIZE, TILE_SIZE, TILE_SIZE);

      oCtx.strokeStyle = (cellVal === 1)
        ? `rgba(${c1Rgb}, 0.18)`
        : (cellVal === 3 ? 'rgba(0, 0, 0, 0.90)' : `rgba(${c1Rgb}, 0.14)`);
      oCtx.lineWidth = 1;
      oCtx.strokeRect(c * TILE_SIZE, r * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }
  }

  oCtx.save();
  oCtx.strokeStyle = `rgba(${c1Rgb}, 0.34)`;
  oCtx.lineWidth = 1.6;

  // Static track side rails rendering.
  if (typeof pathCells !== 'undefined' && Array.isArray(pathCells)) {
    pathCells.forEach(cell => {
      if (cell.rails) {
        cell.rails.forEach(rail => {
          oCtx.beginPath();
          oCtx.moveTo(rail.x1, rail.y1);
          oCtx.lineTo(rail.x2, rail.y2);
          oCtx.stroke();
        });
      }
      if (cell.turnCurves) {
        cell.turnCurves.forEach(tc => {
          oCtx.beginPath();
          oCtx.moveTo(tc.startX, tc.startY);
          oCtx.arcTo(tc.cornerX, tc.cornerY, tc.endX, tc.endY, tc.r);
          oCtx.lineTo(tc.endX, tc.endY);
          oCtx.stroke();
        });
      }
    });
  }
  oCtx.restore();

  // Static spawn & base portal chevrons baked directly into offscreenGridCanvas
  if (typeof activePathTiles !== 'undefined' && activePathTiles && activePathTiles.length >= 2) {

    const startTile = activePathTiles[0];
    const nextTile = activePathTiles[1];
    const spawnX = startTile.c * TILE_SIZE;
    const spawnY = startTile.r * TILE_SIZE;
    const spawnAngle = Math.atan2(nextTile.r - startTile.r, nextTile.c - startTile.c);
    const offsets = [-14, 0, 14];

    for (let i = 0; i < 3; i++) {
      const off = offsets[i];
      drawNeonChevron(oCtx, spawnX + 35 + Math.cos(spawnAngle) * off, spawnY + 35 + Math.sin(spawnAngle) * off, spawnAngle, 13, th.c1);
    }

    const prevTile = activePathTiles[activePathTiles.length - 2];
    const endTile = activePathTiles[activePathTiles.length - 1];
    const baseX = endTile.c * TILE_SIZE;
    const baseY = endTile.r * TILE_SIZE;
    const baseAngle = Math.atan2(endTile.r - prevTile.r, endTile.c - prevTile.c);

    for (let i = 0; i < 3; i++) {
      const off = offsets[i];
      drawNeonChevron(oCtx, baseX + 35 + Math.cos(baseAngle) * off, baseY + 35 + Math.sin(baseAngle) * off, baseAngle, 13, th.c3);
    }
  }

  offscreenGridDirty = false;
}

// [UI.JJ] Offscreen-кэш полноэкранного градиента для режимов Endless и Hardcore
let _modeOverlayCache = null;
let _modeOverlayKey = '';

function getModeOverlayCanvas(w, h, modeName) {
  const key = `${Math.round(w)}x${Math.round(h)}_${modeName}`;
  if (_modeOverlayCache && _modeOverlayKey === key) return _modeOverlayCache;

  const off = document.createElement('canvas');
  off.width = Math.max(1, Math.round(w));
  off.height = Math.max(1, Math.round(h));
  const mCtx = off.getContext('2d');

  const maxDim = Math.max(100, Math.max(w, h) * 0.75);
  const grad = mCtx.createRadialGradient(w * 0.5, h * 0.35, 10, w * 0.5, h * 0.45, maxDim);
  if (modeName === 'endless') {
    grad.addColorStop(0, 'rgba(110, 15, 140, 0.28)');
    grad.addColorStop(0.5, 'rgba(55, 8, 75, 0.18)');
    grad.addColorStop(1, 'rgba(4, 5, 14, 0.05)');
  } else {
    grad.addColorStop(0, 'rgba(120, 10, 60, 0.26)');
    grad.addColorStop(0.5, 'rgba(60, 5, 30, 0.16)');
    grad.addColorStop(1, 'rgba(4, 5, 14, 0.05)');
  }
  mCtx.fillStyle = grad;
  mCtx.fillRect(0, 0, off.width, off.height);

  _modeOverlayCache = off;
  _modeOverlayKey = key;
  return off;
}

// [UI.JKM] Offscreen-спрайт индикатора оглушения EMP над башней (3x разрешение)
let _empDisabledSprite = null;
function getEmpDisabledSprite() {
  if (_empDisabledSprite) return _empDisabledSprite;
  const texScale = 3.0;
  const logicalSize = 24;
  const half = logicalSize / 2;
  const off = document.createElement('canvas');
  off.width = logicalSize * texScale;
  off.height = logicalSize * texScale;
  const eCtx = off.getContext('2d');

  eCtx.scale(texScale, texScale);
  eCtx.translate(half, half);

  eCtx.fillStyle = '#0a0e1c';
  eCtx.beginPath();
  eCtx.arc(0, 0, 8, 0, Math.PI * 2);
  eCtx.fill();

  eCtx.strokeStyle = '#f05f9f';
  eCtx.lineWidth = 1.5;
  eCtx.stroke();

  eCtx.lineCap = 'round';
  eCtx.lineJoin = 'round';
  eCtx.beginPath();
  eCtx.moveTo(1, -4);
  eCtx.lineTo(-3, 1);
  eCtx.lineTo(0, 1);
  eCtx.lineTo(-1, 4);
  eCtx.lineTo(3, -1);
  eCtx.lineTo(0, -1);
  eCtx.closePath();
  eCtx.fillStyle = '#f05f9f';
  eCtx.fill();

  _empDisabledSprite = { canvas: off, half, size: logicalSize };
  return _empDisabledSprite;
}

// [UI.JL]
function renderCellRails(cell) {
  if (!cell.isTurn && cell.rails) {
    ctx.beginPath();
    ctx.moveTo(cell.rails[0].x1, cell.rails[0].y1);
    ctx.lineTo(cell.rails[0].x2, cell.rails[0].y2);
    ctx.moveTo(cell.rails[1].x1, cell.rails[1].y1);
    ctx.lineTo(cell.rails[1].x2, cell.rails[1].y2);
    ctx.stroke();
  } else if (cell.isTurn && cell.turnCurves) {
    cell.turnCurves.forEach(tc => {
      ctx.beginPath();
      ctx.moveTo(tc.startX, tc.startY);
      ctx.arcTo(tc.cornerX, tc.cornerY, tc.endX, tc.endY, tc.r);
      ctx.lineTo(tc.endX, tc.endY);
      ctx.stroke();
    });
  }
}

let battlePathAlpha = 1.0;
let lastPathTime = performance.now();
let battleStartedOnce = false;

//  Dynamic track flow and animated path rails pass.
// [UI.JM]
function drawPathRails(now) {
  if (!pathCells || pathCells.length <= 2) return;
  const totalCells = pathCells.length;
  const th = getTheme();
  const c1Rgb = th.rgb1 ? th.rgb1.cssRgb : '0, 229, 255';

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.strokeStyle = `rgba(${c1Rgb}, 0.18)`;
  ctx.lineWidth = 3.5;
  ctx.setLineDash([]);
  for (let i = 1; i < totalCells - 1; i++) {
    renderCellRails(pathCells[i]);
  }

  const curTime = (typeof now === 'number' && now > 0) ? now : performance.now();
  const dt = Math.min((curTime - (lastPathTime || curTime)) / 1000, 0.1);
  lastPathTime = curTime;

  const isBattleActive = (typeof waveInProgress !== 'undefined' && waveInProgress) || 
                         (typeof enemies !== 'undefined' && enemies.length > 0);

  if (isBattleActive) {
    battleStartedOnce = true;
  }

  if (battleStartedOnce || isBattleActive) {
    if (battlePathAlpha > 0) {
      battlePathAlpha = Math.max(0, battlePathAlpha - dt * 0.5);
    }
  } else {
    battlePathAlpha = 1.0;
  }

  if (battlePathAlpha > 0.005) {
    ctx.strokeStyle = `rgba(${c1Rgb}, ${0.90 * battlePathAlpha})`;
    ctx.lineWidth = 1.8;
    ctx.setLineDash([12, 10]);
    ctx.lineDashOffset = -((curTime / 1000) * 36);

    for (let i = 1; i < totalCells - 1; i++) {
      renderCellRails(pathCells[i]);
    }
  }

  ctx.restore();
}

// [UI.JP] Tower Beautification Renderer V8 (4-Level Evolution, 3x Retina Offscreen Base Cache + Zero-Blur Dynamic Turrets)
const TOWER_DARK = '#0a0e1c';

const TOWER_CORES_BY_LEVEL = {
  1: [],
  2: [{ cx: 0, cy: 0, r: 3.2 }],
  3: [{ cx: 0, cy: -4.2, r: 3 }, { cx: 0, cy: 4.2, r: 3 }],
  4: [{ cx: -3.4, cy: -4.2, r: 3 }, { cx: -3.4, cy: 4.2, r: 3 }, { cx: 4.2, cy: 0, r: 3 }]
};

const TOWER_VISUAL_CFG = {
  hullShape: 'round',       // Круглые основания башен
  roundRingStyle: 'solid',  // Ровное сплошное 3-е кольцо на Lv.4
  wideLegs: true,           // 4 широкие опоры (ноги) с эволюцией Lv.2 -> Lv.3 -> Lv.4 (Lv.1 без опор)
  whiteNeonRim: true,       // Белый неоновый контур с цветным свечением
  outrunStripes: true,      // Outrun-полосы внутри корпуса (с Lv.2)
  outerEvolution: true,     // Внешние кольца эволюции Lv.3 и Lv.4
  powerCellsGlow: true,     // Яркие энерго-ячейки с белым центром (0-1-2-3)
  laserSight: true,         // Пунктирный лазерный целеуказатель на цель
  recoil: false,
  glowIntensity: 2.2
};

const TOWER_BASE_SPRITE_CACHE = Object.create(null);

// [UI.JPA]
function traceTowerPolygon(c, sides, r, rot = 0) {
  c.beginPath();
  for (let i = 0; i < sides; i++) {
    const a = rot + (i * Math.PI * 2) / sides;
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r;
    if (i === 0) c.moveTo(px, py);
    else c.lineTo(px, py);
  }
  c.closePath();
}

// [UI.JPB]
function traceTowerHullShape(c, lvl, r, cfg = TOWER_VISUAL_CFG) {
  if (cfg.hullShape === 'poly6816') {
    const sides = (lvl <= 2) ? 6 : 8;
    const baseRot = (sides === 8) ? Math.PI / 8 : 0;
    traceTowerPolygon(c, sides, r * 1.04, baseRot);
  } else {
    c.beginPath();
    c.arc(0, 0, r, 0, Math.PI * 2);
  }
}

// [UI.JPC] Ступенчатая эволюция 4 широких опор (ног) Lv.2 -> Lv.3 -> Lv.4 (Lv.1 без опор; рисуется в кэш-спрайт)
function drawTowerWideLegsToCtx(c, lvl, col, glow, glowMult, isDisabled) {
  if (lvl <= 1) return;
  c.save();
  for (let i = 0; i < 4; i++) {
    c.save();
    c.rotate(Math.PI / 4 + i * (Math.PI / 2));

    // 1. Внутренняя секция ноги (Lv.2, Lv.3, Lv.4)
    c.beginPath();
    c.moveTo(13.0, -5.6);
    c.lineTo(20.2, -4.6);
    c.lineTo(20.2, 4.6);
    c.lineTo(13.0, 5.6);
    c.closePath();

    if (lvl === 2 || isDisabled) {
      c.shadowBlur = 0;
      c.fillStyle = col;
      c.globalAlpha = 0.35;
      c.fill();
      c.globalAlpha = 0.85;
      c.strokeStyle = col;
      c.lineWidth = 1.4;
      c.stroke();
    } else if (lvl === 3) {
      c.shadowBlur = 0;
      c.fillStyle = '#080d1e';
      c.globalAlpha = 1;
      c.fill();
      c.strokeStyle = col;
      c.globalAlpha = 0.82;
      c.lineWidth = 1.45;
      c.stroke();
      c.fillStyle = col;
      c.globalAlpha = 0.55;
      c.fillRect(15.2, -2.3, 3.8, 4.6);
    } else {
      c.fillStyle = '#070b19';
      c.shadowColor = glow;
      c.shadowBlur = 9 * glowMult;
      c.globalAlpha = 1;
      c.fill();
      c.strokeStyle = '#ffffff';
      c.lineWidth = 1.65;
      c.stroke();
      c.shadowBlur = 0;
      c.fillStyle = col;
      c.fillRect(15.2, -2.4, 3.8, 4.8);
    }

    // 2. Внешняя секция ноги (Lv.3 без неона, Lv.4 с ярким неоном)
    if (lvl >= 3) {
      c.beginPath();
      c.moveTo(20.2, -4.3);
      c.lineTo(25.2, -3.1);
      c.lineTo(26.4, -1.8);
      c.lineTo(26.4, 1.8);
      c.lineTo(25.2, 3.1);
      c.lineTo(20.2, 4.3);
      c.closePath();

      if (lvl === 3 || isDisabled) {
        c.shadowBlur = 0;
        c.fillStyle = col;
        c.globalAlpha = 0.30;
        c.fill();
        c.strokeStyle = col;
        c.globalAlpha = 0.85;
        c.lineWidth = 1.45;
        c.stroke();
      } else {
        c.fillStyle = col;
        c.shadowColor = glow;
        c.shadowBlur = 11 * glowMult;
        c.globalAlpha = 0.85;
        c.fill();
        c.strokeStyle = '#ffffff';
        c.globalAlpha = 1;
        c.lineWidth = 1.65;
        c.stroke();
        c.shadowBlur = 0;
      }
    }

    c.restore();
  }
  c.restore();
}

// [UI.JPD] Offscreen-кэш статичного корпуса башни в 3x разрешении (4 уровня + LOD по зуму)
function getTowerBaseSprite(lvl, col, glowCol, isDisabled, isLowPerf, isFarZoom = false) {
  const cfg = TOWER_VISUAL_CFG;
  const safeLvl = Math.max(1, Math.min(4, lvl || 1));
  const key = `${cfg.hullShape}_${safeLvl}_${col}_${glowCol}_${isDisabled ? 1 : 0}_${isLowPerf ? 1 : 0}_${isFarZoom ? 1 : 0}`;
  if (TOWER_BASE_SPRITE_CACHE[key]) return TOWER_BASE_SPRITE_CACHE[key];

  const texScale = isLowPerf ? 1.5 : 3.0;
  const logicalSize = 96;
  const half = logicalSize / 2;
  const off = document.createElement('canvas');
  off.width = Math.round(logicalSize * texScale);
  off.height = Math.round(logicalSize * texScale);
  const c = off.getContext('2d');

  const glowMult = (isLowPerf || isDisabled) ? 0.4 : (cfg.glowIntensity || 2.2);
  const lvlHaloScale = safeLvl === 1 ? 0.30 : (safeLvl === 2 ? 0.45 : (safeLvl === 3 ? 0.72 : 1.0));

  c.save();
  c.scale(texScale, texScale);
  c.translate(half, half);
  c.lineJoin = 'round';
  c.lineCap = 'round';

  // 1. Внешнее неоновое гало (4 ступени)
  if (!isDisabled) {
    const haloR = (27 + (safeLvl - 1) * 3.8) * Math.min(1.45, Math.max(0.7, glowMult * 0.62));
    const radGrad = c.createRadialGradient(0, 0, 5, 0, 0, haloR);
    radGrad.addColorStop(0, glowCol + (safeLvl === 4 ? '44' : (safeLvl === 3 ? '28' : (safeLvl === 2 ? '18' : '16'))));
    radGrad.addColorStop(0.6, glowCol + (safeLvl === 4 ? '18' : (safeLvl === 3 ? '0a' : '06')));
    radGrad.addColorStop(1, 'transparent');
    c.fillStyle = radGrad;
    c.beginPath();
    c.arc(0, 0, haloR, 0, Math.PI * 2);
    c.fill();
  }

  // 2. 4 широкие опоры (начиная с Lv.2)
  if (cfg.wideLegs && safeLvl >= 2) {
    drawTowerWideLegsToCtx(c, safeLvl, col, glowCol, glowMult * lvlHaloScale, isDisabled);
  }

  // 3. Внешние кольца эволюции Lv.3 и Lv.4
  if (cfg.outerEvolution) {
    if (safeLvl >= 3) {
      c.save();
      c.shadowBlur = 0;
      c.strokeStyle = col;
      c.globalAlpha = 0.68;
      c.lineWidth = 1.7;
      c.beginPath();
      c.arc(0, 0, 21.5, 0, Math.PI * 2);
      c.stroke();
      c.restore();
    }
    if (safeLvl >= 4) {
      c.save();
      if (!isDisabled) {
        c.shadowColor = glowCol;
        c.shadowBlur = 11 * glowMult;
      }
      c.globalAlpha = 0.96;

      c.strokeStyle = col;
      c.lineWidth = isFarZoom ? 3.25 : 3.0;
      c.beginPath();
      c.arc(0, 0, 26.0, 0, Math.PI * 2);
      c.stroke();

      c.shadowBlur = 0;
      c.strokeStyle = isDisabled ? '#64748b' : '#ffffff';
      if (isFarZoom) c.globalAlpha = 0.46;
      c.lineWidth = isFarZoom ? 0.78 : 1.08;
      c.beginPath();
      c.arc(0, 0, 26.0, 0, Math.PI * 2);
      c.stroke();
      c.restore();
    }
  }

  // 4. Главный круглый корпус + неоновый обод (Lv.1: приглушённое кольцо + 4 ярких 20° фрагмента, Lv.2–4: полный обод)
  c.save();
  c.fillStyle = TOWER_DARK;
  traceTowerHullShape(c, safeLvl, 16.8, cfg);
  c.fill();

  if (safeLvl === 1) {
    // Вариант 2: приглушённое полное кольцо + 4 ярких неоновых фрагмента 20° по диагональным углам
    c.strokeStyle = col;
    c.globalAlpha = isFarZoom ? 0.34 : 0.28;
    c.lineWidth = isFarZoom ? 1.6 : 1.4;
    c.stroke();

    const halfSpan = (20 * Math.PI / 180) * 0.5;
    c.beginPath();
    for (let b = 0; b < 4; b++) {
      const center = Math.PI / 4 + b * (Math.PI / 2);
      c.moveTo(Math.cos(center - halfSpan) * 16.8, Math.sin(center - halfSpan) * 16.8);
      c.arc(0, 0, 16.8, center - halfSpan, center + halfSpan);
    }
    c.globalAlpha = 1.0;
    c.strokeStyle = col;
    if (!isDisabled) {
      c.shadowColor = glowCol;
      c.shadowBlur = 10 * glowMult * 0.65;
    }
    c.lineWidth = isFarZoom ? 3.25 : 3.0;
    c.stroke();

    c.strokeStyle = isDisabled ? '#64748b' : '#ffffff';
    if (!isDisabled && !isFarZoom) {
      c.shadowColor = '#ffffff';
      c.shadowBlur = 3.0 * glowMult * 0.5;
    } else {
      c.shadowBlur = 0;
    }
    if (isFarZoom) c.globalAlpha = 0.52;
    c.lineWidth = isFarZoom ? 0.85 : 1.15;
    c.stroke();
  } else if (cfg.whiteNeonRim) {
    c.strokeStyle = col;
    if (!isDisabled) {
      c.shadowColor = glowCol;
      c.shadowBlur = (safeLvl >= 4 ? 13 : (safeLvl === 3 ? 7 : 3)) * glowMult * 0.65;
    }
    c.lineWidth = isFarZoom ? 3.25 : 3.0;
    c.stroke();

    c.strokeStyle = isDisabled ? '#64748b' : '#ffffff';
    if (!isDisabled && !isFarZoom) {
      c.shadowColor = '#ffffff';
      c.shadowBlur = (safeLvl >= 4 ? 4 : 1.5) * glowMult * 0.5;
    } else {
      c.shadowBlur = 0;
    }
    if (isFarZoom) c.globalAlpha = 0.46;
    c.lineWidth = isFarZoom ? 0.78 : 1.08;
    c.stroke();
  } else {
    c.strokeStyle = col;
    c.lineWidth = 2.0;
    c.stroke();
  }
  c.restore();

  // 5. Outrun-полосы внутри корпуса (только начиная с Lv.2; запекаются 1 раз в текстуру)
  if (cfg.outrunStripes && safeLvl >= 2) {
    c.save();
    traceTowerHullShape(c, safeLvl, 15.2, cfg);
    c.clip();
    c.strokeStyle = col;
    c.globalAlpha = isFarZoom ? 0.24 : 0.44;
    c.lineWidth = 1.35;
    c.beginPath();
    for (let sy = -14; sy <= 14; sy += 3.8) {
      c.moveTo(-16, sy);
      c.lineTo(16, sy);
    }
    c.stroke();
    c.restore();
  }

  c.restore();

  const sprite = { canvas: off, half, size: logicalSize };
  TOWER_BASE_SPRITE_CACHE[key] = sprite;
  return sprite;
}

// [UI.JPE] Единая снежинка Stasis (Zero-Blur двойной штрих, 4 уровня)
function drawStasisSnowflake(c, lvl, time, col, isDisabled) {
  const safeLvl = Math.max(1, Math.min(4, lvl || 1));
  c.save();
  if (!isDisabled) c.rotate(time * 0.42);
  c.lineCap = 'round';
  c.lineJoin = 'round';

  const mainR = safeLvl === 1 ? 9.5 : (safeLvl === 2 ? 10.6 : (safeLvl === 3 ? 11.6 : 12.6));
  const baseLw = safeLvl === 1 ? 1.35 : (safeLvl === 2 ? 1.7 : 1.85);

  if (!isDisabled) {
    c.strokeStyle = col;
    c.globalAlpha = safeLvl >= 4 ? 0.45 : (safeLvl === 1 ? 0.18 : 0.30);
    c.lineWidth = baseLw + (safeLvl === 1 ? 1.6 : 2.2);
    c.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      c.moveTo(0, 0);
      c.lineTo(Math.cos(a) * mainR, Math.sin(a) * mainR);
    }
    c.stroke();
    c.globalAlpha = 1;
  }

  c.strokeStyle = isDisabled ? '#64748b' : '#ffffff';
  c.lineWidth = baseLw;

  for (let i = 0; i < 6; i++) {
    c.save();
    c.rotate((i * Math.PI) / 3);

    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(mainR, 0);
    c.stroke();

    // Lv.1: упрощённые короткие V-веточки ближе к краю; Lv.2+: полноценные крупные веточки
    const tipBranchPos = safeLvl === 1 ? (mainR * 0.70) : (mainR * 0.58);
    const tipBranchLen = safeLvl === 1 ? 2.25 : (safeLvl === 2 ? 3.8 : 4.2);
    c.beginPath();
    c.moveTo(tipBranchPos + tipBranchLen * 0.68, -tipBranchLen * 0.75);
    c.lineTo(tipBranchPos, 0);
    c.lineTo(tipBranchPos + tipBranchLen * 0.68, tipBranchLen * 0.75);
    c.stroke();

    if (safeLvl >= 3) {
      const midBranchPos = mainR * 0.35;
      const midBranchLen = 3.0;
      c.beginPath();
      c.moveTo(midBranchPos + midBranchLen * 0.65, -midBranchLen * 0.72);
      c.lineTo(midBranchPos, 0);
      c.lineTo(midBranchPos + midBranchLen * 0.65, midBranchLen * 0.72);
      c.stroke();
    }

    if (safeLvl >= 4) {
      c.fillStyle = isDisabled ? '#64748b' : '#ffffff';
      c.beginPath();
      c.arc(mainR + 1.1, 0, 1.25, 0, Math.PI * 2);
      c.fill();
    }

    c.restore();
  }

  if (safeLvl >= 3) {
    c.strokeStyle = col;
    c.lineWidth = 1.25;
    traceTowerPolygon(c, 6, mainR * 0.44, Math.PI / 6);
    c.stroke();
  }

  if (safeLvl >= 4) {
    c.save();
    if (!isDisabled) c.rotate(-time * 0.8 + Math.PI / 6);
    c.strokeStyle = col;
    c.lineWidth = 1.35;
    for (let i = 0; i < 6; i++) {
      c.save();
      c.rotate((i * Math.PI) / 3);
      c.beginPath();
      c.moveTo(3.2, 0);
      c.lineTo(8.4, 0);
      c.moveTo(8.0, -2.0);
      c.lineTo(6.2, 0);
      c.lineTo(8.0, 2.0);
      c.stroke();
      c.restore();
    }
    c.restore();
  }

  c.fillStyle = col;
  if (safeLvl === 1) {
    c.beginPath();
    c.arc(0, 0, 2.0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = isDisabled ? '#64748b' : '#ffffff';
    c.beginPath();
    c.arc(0, 0, 0.95, 0, Math.PI * 2);
    c.fill();
  } else {
    traceTowerPolygon(c, 6, 3.0, 0);
    c.fill();
    c.fillStyle = isDisabled ? '#64748b' : '#ffffff';
    c.beginPath();
    c.arc(0, 0, 1.4, 0, Math.PI * 2);
    c.fill();
  }

  c.restore();
}

// [UI.JPF] Круговой прогресс-бар перегрева Melter (Zero-Blur)
function drawMelterOverheatGauge(c, heat, time, col, isCooling) {
  const clamped = Math.max(0, Math.min(1, heat));
  const gaugeR = 13.8;

  c.save();
  c.rotate(-Math.PI / 2);

  c.strokeStyle = 'rgba(15, 23, 42, 0.88)';
  c.lineWidth = 3.4;
  c.beginPath();
  c.arc(0, 0, gaugeR, 0, Math.PI * 2);
  c.stroke();

  c.strokeStyle = 'rgba(232, 82, 104, 0.28)';
  c.lineWidth = 1;
  c.setLineDash([2, 4.2]);
  c.beginPath();
  c.arc(0, 0, gaugeR, 0, Math.PI * 2);
  c.stroke();
  c.setLineDash([]);

  if (clamped > 0.01) {
    const isMaxHeat = clamped > 0.88 || isCooling;
    const arcCol = isMaxHeat
      ? (Math.sin(time * 30) > 0 ? '#ffffff' : '#fde047')
      : (clamped > 0.45 ? '#fb923c' : col);

    c.lineCap = 'round';
    c.strokeStyle = arcCol;
    c.globalAlpha = 0.35;
    c.lineWidth = 6.2;
    c.beginPath();
    c.arc(0, 0, gaugeR, 0, Math.PI * 2 * clamped);
    c.stroke();

    c.globalAlpha = 1;
    c.lineWidth = 3.2;
    c.beginPath();
    c.arc(0, 0, gaugeR, 0, Math.PI * 2 * clamped);
    c.stroke();

    const tipAngle = Math.PI * 2 * clamped;
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.arc(Math.cos(tipAngle) * gaugeR, Math.sin(tipAngle) * gaugeR, 2.0, 0, Math.PI * 2);
    c.fill();
  }

  c.restore();
}

// [UI.JPG] Главная функция отрисовки башни (4 уровня)
function drawTowerModel(type, angle, color, level = 1, glow = '#00e5ff', isDisabled = false, isCooling = false, isShooting = false, heatProgress = 0, extra = null) {
  const cfg = TOWER_VISUAL_CFG;
  const id = type || 'gun';
  const baseCol = color || '#00e5ff';
  const col = isDisabled ? '#475569' : baseCol;
  const glowCol = isDisabled ? '#64748b' : (glow || baseCol);
  const lvl = Math.max(1, Math.min(4, level || 1));
  const ext = lvl - 1;

  const time = (extra && typeof extra.time === 'number') ? extra.time : (performance.now() * 0.001);
  const target = extra ? extra.target : null;
  const towerX = extra ? extra.x : 0;
  const towerY = extra ? extra.y : 0;
  const isFiring = !!(isShooting || (target && !isDisabled && !isCooling));
  const recoil = (cfg.recoil && extra && extra.recoil) ? extra.recoil : 0;
  const heat = Math.max(0, Math.min(1, heatProgress || 0));
  const isLowPerf = (typeof perfMode !== 'undefined' && perfMode === 'low');
  const isFarZoom = (typeof camZoom === 'number' && camZoom > 0 && camZoom < 0.65);

  ctx.save();
  if (isDisabled) ctx.globalAlpha = 0.55;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // 1. Статичный корпус башни (3x Retina Offscreen-кэш с LOD по зуму)
  const baseSprite = getTowerBaseSprite(lvl, col, glowCol, isDisabled, isLowPerf, isFarZoom);
  ctx.drawImage(baseSprite.canvas, -baseSprite.half, -baseSprite.half, baseSprite.size, baseSprite.size);

  // 2. Круговой прогресс-бар перегрева Melter
  if (id === 'melter' && (heat > 0 || isCooling)) {
    drawMelterOverheatGauge(ctx, heat, time, col, isCooling);
  }

  // 3. Поворотная башня, прицел, стволы и ядро
  const effAngle = (id === 'stasis') ? 0 : (angle || 0);
  ctx.save();
  ctx.rotate(effAngle);

  // Лазерный целеуказатель на захваченную цель
  if (cfg.laserSight && id !== 'stasis' && target && !isDisabled && !isCooling) {
    const dist = Math.hypot(target.x - towerX, target.y - towerY);
    const sightEnd = Math.max(26, dist);
    ctx.save();
    ctx.strokeStyle = col;
    ctx.globalAlpha = 0.65;
    ctx.lineWidth = 1.3;
    ctx.setLineDash([5, 4]);
    ctx.lineDashOffset = -time * 24;
    ctx.beginPath();
    ctx.moveTo(22, 0);
    ctx.lineTo(sightEnd, 0);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(sightEnd, 0, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  const recShift = -recoil * 4.0;

  if (id === 'gun') {
    const sinceShot = (extra && typeof extra.lastFire === 'number') ? extra.lastFire : 999;
    const shotIdx = (extra && typeof extra.shotIndex === 'number') ? extra.shotIndex : 0;
    const kickT = (sinceShot >= 0 && sinceShot < 0.16) ? (1 - sinceShot / 0.16) : 0;
    const kickOffset = -(kickT * kickT) * 3.4;

    const topShift = (shotIdx === 0) ? kickOffset : 0;
    const botShift = (shotIdx === 1) ? kickOffset : 0;
    const bLen = 14 + ext * 1.1;

    ctx.fillStyle = TOWER_DARK;
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.4;
    ctx.fillRect(7, -6.2, 8.5, 12.4);
    ctx.strokeRect(7, -6.2, 8.5, 12.4);

    ctx.fillStyle = col;
    ctx.fillRect(11.5 + recShift + topShift, -5.0, bLen, 2.7);
    ctx.fillRect(11.5 + recShift + botShift, 2.3, bLen, 2.7);
    ctx.fillStyle = isDisabled ? '#64748b' : '#ffffff';
    ctx.fillRect(11.5 + bLen - 2.4 + recShift + topShift, -4.6, 2.4, 1.9);
    ctx.fillRect(11.5 + bLen - 2.4 + recShift + botShift, 2.7, 2.4, 1.9);
  } else if (id === 'laser') {
    const tipX = 24 + ext;
    ctx.fillStyle = TOWER_DARK;
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(8, -6.5);
    ctx.lineTo(tipX, -2.0);
    ctx.lineTo(tipX, 2.0);
    ctx.lineTo(8, 6.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = isDisabled ? '#64748b' : '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(10, 0);
    ctx.lineTo(tipX - 1, 0);
    ctx.stroke();

    ctx.fillStyle = (isFiring && !isDisabled) ? '#ffffff' : col;
    ctx.beginPath();
    ctx.arc(tipX, 0, isFiring ? 3.0 : 2.1, 0, Math.PI * 2);
    ctx.fill();
  } else if (id === 'mortar' || id === 'splash') {
    const fore = Math.cos(55 * Math.PI / 180);
    ctx.save();
    ctx.scale(fore, 1);
    ctx.fillStyle = TOWER_DARK;
    ctx.strokeStyle = col;
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(7 + recShift * 1.4, -7.2, 16 + ext, 14.4, 3);
    } else {
      ctx.rect(7 + recShift * 1.4, -7.2, 16 + ext, 14.4);
    }
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = col;
    ctx.fillRect(11 + recShift * 1.4, -5.2, 9 + ext, 10.4);
    ctx.restore();

    const mx = (23 + ext + recShift * 1.4) * fore;
    ctx.beginPath();
    ctx.ellipse(mx, 0, 3.2, 5.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = (isFiring && !isDisabled) ? '#ffffff' : TOWER_DARK;
    ctx.fill();
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.8;
    ctx.stroke();
  } else if (id === 'tesla') {
    const bStart = 8.5 + recShift * 0.7;
    ctx.fillStyle = TOWER_DARK;
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(bStart, -6.8);
    ctx.lineTo(bStart + 14.0, -5.8);
    ctx.lineTo(bStart + 16.0, -3.6);
    ctx.lineTo(bStart + 16.0, 3.6);
    ctx.lineTo(bStart + 14.0, 5.8);
    ctx.lineTo(bStart, 6.8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = isDisabled ? 'rgba(100, 116, 139, 0.45)' : 'rgba(255, 255, 255, 0.55)';
    ctx.lineWidth = 0.95;
    ctx.beginPath();
    ctx.moveTo(bStart + 2.0, -4.4);
    ctx.lineTo(bStart + 13.0, -3.8);
    ctx.moveTo(bStart + 2.0, 4.4);
    ctx.lineTo(bStart + 13.0, 3.8);
    ctx.stroke();

    ctx.save();
    ctx.translate(bStart + 8.3, 0);
    ctx.rotate(Math.PI / 2);
    ctx.scale(0.56, 0.56);
    ctx.fillStyle = isDisabled ? '#64748b' : '#ffffff';
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    const boltPts = [2.5, -11, -6.0, 1.2, -0.4, 1.2, -3.2, 11, 6.5, -2.2, 0.8, -2.2];
    ctx.moveTo(boltPts[0], boltPts[1]);
    for (let i = 2; i < boltPts.length; i += 2) ctx.lineTo(boltPts[i], boltPts[i + 1]);
    ctx.closePath();
    ctx.stroke();
    ctx.fill();
    ctx.restore();
  } else if (id === 'melter') {
    const hotCol = isDisabled ? '#475569' : (heat > 0.75 ? '#ffffff' : (heat > 0.32 ? '#fb923c' : col));
    const innerPipeCol = isDisabled ? '#64748b' : (heat > 0.55 ? '#ffffff' : '#fb923c');

    ctx.strokeStyle = col;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(9.0, -5.2);
    ctx.lineTo(20.5, -2.2);
    ctx.moveTo(9.0, 5.2);
    ctx.lineTo(20.5, 2.2);
    ctx.stroke();

    ctx.strokeStyle = innerPipeCol;
    ctx.lineWidth = 1.15;
    ctx.beginPath();
    ctx.moveTo(10.5, -4.8);
    ctx.lineTo(19.8, -2.4);
    ctx.moveTo(10.5, 4.8);
    ctx.lineTo(19.8, 2.4);
    ctx.stroke();

    ctx.fillStyle = TOWER_DARK;
    ctx.strokeStyle = isDisabled ? '#64748b' : '#ffffff';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(19.0, -4.5, 3.6, 9.0, 1.2);
    } else {
      ctx.rect(19.0, -4.5, 3.6, 9.0);
    }
    ctx.fill();
    ctx.stroke();

    if (!isCooling && !isDisabled) {
      const flameTip = 27.5 + heat * 2.5 + (isFiring ? Math.sin(time * 35) * 0.8 : 0);
      ctx.fillStyle = hotCol;
      ctx.beginPath();
      ctx.moveTo(22.6, -2.5);
      ctx.lineTo(flameTip, 0);
      ctx.lineTo(22.6, 2.5);
      ctx.closePath();
      ctx.fill();
    }
  } else if (id === 'railgun') {
    const railLen = 13.5 + ext * 0.8;
    const rStart = 8.5 + recShift * 0.85;

    ctx.fillStyle = (isFiring && !isDisabled) ? '#ffffff' : col;
    ctx.globalAlpha = (isFiring && !isDisabled) ? 0.95 : 0.45;
    ctx.fillRect(rStart + 1.5, -1.3, railLen - 2.0, 2.6);
    ctx.globalAlpha = 1;

    ctx.fillStyle = TOWER_DARK;
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.45;

    ctx.beginPath();
    ctx.moveTo(rStart, -4.4);
    ctx.lineTo(rStart + railLen, -3.6);
    ctx.lineTo(rStart + railLen - 2.0, -1.8);
    ctx.lineTo(rStart, -1.8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(rStart, 4.4);
    ctx.lineTo(rStart + railLen, 3.6);
    ctx.lineTo(rStart + railLen - 2.0, 1.8);
    ctx.lineTo(rStart, 1.8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = isDisabled ? '#64748b' : '#ffffff';
    ctx.fillRect(rStart + 2.2, -5.0, 2.2, 10.0);
  }

  // 4. Индикаторы в центре ядра (0-1-2-3 ячейки или снежинка Stasis)
  if (id === 'stasis') {
    drawStasisSnowflake(ctx, lvl, time, col, isDisabled);
  } else {
    const cells = TOWER_CORES_BY_LEVEL[lvl] || [];
    for (let i = 0; i < cells.length; i++) {
      const d = cells[i];
      const coreCol = (!isDisabled && id === 'melter' && heat > 0.65) ? '#ffffff' : col;
      ctx.fillStyle = coreCol;
      ctx.beginPath();
      ctx.arc(d.cx, d.cy, d.r + (cfg.powerCellsGlow ? 0.6 : 0), 0, Math.PI * 2);
      ctx.fill();
      if (cfg.powerCellsGlow && !isDisabled) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(d.cx, d.cy, d.r * (isFarZoom ? 0.28 : 0.36), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  ctx.restore();
  ctx.restore();
}

// Enemy model vector graphics and health bar renderer.
// [UI.JQ]
function drawEnemyModel(e, showHpBar = true) {
  if (typeof renderConfiguredEnemyModel === 'function') {
    renderConfiguredEnemyModel(e, showHpBar);
    return;
  }
}

//  Master gameplay canvas graphics rendering pipeline.
let reviveStartTime = 0;

// [UI.JS]
function render(now) {
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

  if (gameState === 'DEFEAT' && reviveTimerInterval) {
    const progressEl = document.getElementById('reviveTimerProgress');
    if (progressEl) {
      if (reviveStartTime === 0) reviveStartTime = now;
      const elapsed = (now - reviveStartTime) / 1000;
      const fraction = Math.max(0, 1 - (elapsed / 3));
      const totalDash = 276.46;
      progressEl.style.strokeDashoffset = (totalDash * (1 - fraction)).toFixed(2);
    }
  } else {
    reviveStartTime = 0;
  }

  if (isMenuSceneActive()) {
    const _lvlSc = document.getElementById('levelsScreen');
    const _isLevelsVisible = (_lvlSc && !_lvlSc.classList.contains('hidden') && !_lvlSc.classList.contains('screen-bg-only') && gameState === 'LEVELS');
    if (_isLevelsVisible && !ModeBattlePreview.isActive()) {
      startModeBattlePreview(typeof currentLevelMode !== 'undefined' ? currentLevelMode : 'normal');
    } else if (!_isLevelsVisible && ModeBattlePreview.isActive()) {
      stopNormalModePreview();
    }
    if (!ModeBattlePreview.isActive()) {
      clearFxLayerState();
    }
    _lastFxRenderNow = now;
    drawSynthWavePerspectiveScene(now);
    return;
  } else if (ModeBattlePreview.isActive()) {
    stopNormalModePreview();
  }

  let fxDt = _lastFxRenderNow > 0 ? (now - _lastFxRenderNow) * 0.001 : 0.016;
  _lastFxRenderNow = now;
  if (fxDt < 0 || fxDt > 0.05) fxDt = 0.016;
  if (typeof gameState !== 'undefined' && gameState !== 'PLAYING') fxDt = 0;
  else if (typeof isSimulationPaused !== 'undefined' && isSimulationPaused) fxDt = 0;
  else if (typeof gameTimeScale !== 'undefined' && gameTimeScale > 0) fxDt *= gameTimeScale;

  const w = window.innerWidth;
  const h = window.innerHeight;
  drawCosmicNebulaBackground(w, h);
  updateAndDrawStars(w, h, now);

  if (typeof isEndlessMode !== 'undefined' && isEndlessMode) {
    ctx.drawImage(getModeOverlayCanvas(w, h, 'endless'), 0, 0, w, h);
  } else if (typeof isOverdriveMode !== 'undefined' && isOverdriveMode) {
    ctx.drawImage(getModeOverlayCanvas(w, h, 'overdrive'), 0, 0, w, h);
  }

  let shakeX = 0;
  let shakeY = 0;

  if (typeof cameraShakeTimer !== 'undefined' && cameraShakeTimer > 0) {
    const maxDur = (typeof cameraShakeMaxDur !== 'undefined' && cameraShakeMaxDur > 0) ? cameraShakeMaxDur : 0.35;
    const decay = Math.max(0, Math.min(1, cameraShakeTimer / maxDur));
    const currentAmp = cameraShakeIntensity * decay;
    shakeX = (Math.random() - 0.5) * currentAmp;
    shakeY = (Math.random() - 0.5) * currentAmp;
  }

  const isHyperion = (typeof activePalette !== 'undefined' && activePalette === 'matrix_green');

  ctx.save();
  ctx.translate(camX + shakeX, camY + shakeY);
  ctx.scale(camZoom, camZoom);

  if (offscreenGridDirty || !offscreenGridCanvas) {
    updateOffscreenGrid();
  }
  ctx.drawImage(offscreenGridCanvas, 0, 0);

  drawPathRails(now);

  towers.forEach(t => {
    if (t.type === 'stasis') {
      ctx.save();
      ctx.fillStyle = isHyperion ? 'rgba(96, 165, 250, 0.08)' : 'rgba(56, 189, 248, 0.07)';
      ctx.strokeStyle = isHyperion ? 'rgba(96, 165, 250, 0.28)' : 'rgba(56, 189, 248, 0.22)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.range, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  });

  enemies.forEach(e => {
    if (e.type === 'emp_bomber' || e.type === 'emp_overlord') {
      const effectRadius = e.type === 'emp_overlord' ? 180 : 110;
      ctx.save();
      ctx.fillStyle = 'rgba(240, 95, 159, 0.07)';
      ctx.strokeStyle = 'rgba(240, 95, 159, 0.22)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(e.x, e.y, effectRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  });

  if (selectedTower) {
    const thSel = getTheme();
    const selMainRgb = isHyperion ? '255, 145, 0' : (thSel.rgb1 ? thSel.rgb1.cssRgb : '0, 229, 255');
    const selStrokeRgb = isHyperion ? '255, 183, 0' : (thSel.rgb1 ? thSel.rgb1.cssRgb : '0, 229, 255');
    ctx.save();
    ctx.beginPath();
    ctx.arc(selectedTower.x, selectedTower.y, selectedTower.range, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(${selStrokeRgb}, 0.5)`;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = `rgba(${selMainRgb}, 0.09)`;
    ctx.fillRect(selectedTower.c * TILE_SIZE, selectedTower.r * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    ctx.strokeStyle = `rgba(${selStrokeRgb}, 0.5)`;
    ctx.strokeRect(selectedTower.c * TILE_SIZE, selectedTower.r * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    ctx.restore();
  }

  const nowSec = now * 0.001;
  const empBadge = getEmpDisabledSprite();

  towers.forEach(t => {
    if (fxDt > 0 && (t.type === 'gun' || t.type === 'mortar' || t.type === 'stasis')) {
      if (t._fxPrevLastFire !== undefined && t.lastFire < t._fxPrevLastFire) {
        if (t.type === 'stasis') {
          const rSq = (t.range || 110) * (t.range || 110);
          for (let ei = 0; ei < enemies.length; ei++) {
            const em = enemies[ei];
            const dxS = em.x - t.x, dyS = em.y - t.y;
            if (dxS * dxS + dyS * dyS <= rSq && !em.isShielded) {
              spawnFxHitLayers(em.x, em.y, 'stasis', t.color || '#38bdf8', Math.atan2(dyS, dxS), em.radius || 13);
            }
          }
        } else {
          const cosA = Math.cos(t.angle), sinA = Math.sin(t.angle);
          const side = t.type === 'gun' ? ((t.shotIndex || 0) === 0 ? -3.5 : 3.5) : 0;
          const mDist = t.type === 'mortar' ? 14 : 24;
          spawnFxMuzzleLayers(t.x + cosA * mDist - sinA * side, t.y + sinA * mDist + cosA * side, t.type, t.color, t.angle);
        }
      }
      t._fxPrevLastFire = t.lastFire;
    }
    ctx.save();
    ctx.translate(t.x, t.y);
    const isCooling = (t.type === 'melter' && t.melterCoolingTimer > 0);
    const isTeslaShooting = (t.type === 'tesla' && lightningBolts.some(lb => lb.x1 === t.x && lb.life > 0.04));
    const isBeamShooting = ((t.type === 'laser' || t.type === 'melter') && t.target && t.isLockedOn && !isCooling && t.disabledTimer <= 0);
    const melterRampT = (t.type === 'melter') ? (t.melterRampTime || TOWER_CONFIGS.melter.rampTime || 4.0) : 4.0;
    const meltHeatProgress = (t.type === 'melter')
      ? (isCooling ? (t.melterCoolingTimer / melterRampT) : Math.min(1, (t.melterFireTimer || 0) / melterRampT))
      : 0;
    drawTowerModel(
      t.type, t.angle, t.color, t.level, t.glow,
      t.disabledTimer > 0, isCooling, isTeslaShooting || isBeamShooting, meltHeatProgress,
      { x: t.x, y: t.y, target: t.target, time: nowSec, lastFire: t.lastFire, shotIndex: t.shotIndex || 0 }
    );

    if (t.disabledTimer > 0) {
      ctx.drawImage(empBadge.canvas, 16 - empBadge.half, -16 - empBadge.half, empBadge.size, empBadge.size);
    }
    ctx.restore();

    if (t.type === 'laser' && t.target && t.isLockedOn && t.disabledTimer <= 0) {
      const muzzleX = t.x + Math.cos(t.angle) * 24;
      const muzzleY = t.y + Math.sin(t.angle) * 24;
      const laserBeamCol = t.color || '#f05f9f';
      const pulse = Math.sin(now * 0.024);
      ctx.save();
      ctx.lineCap = 'round';
      ctx.globalCompositeOperation = 'lighter';

      // Внешний неоновый ореол луча (Zero-Blur)
      ctx.strokeStyle = laserBeamCol;
      ctx.globalAlpha = 0.32;
      ctx.lineWidth = 9.5 + pulse * 2.0;
      ctx.beginPath();
      ctx.moveTo(muzzleX, muzzleY);
      ctx.lineTo(t.target.x, t.target.y);
      ctx.stroke();

      // Основной луч
      ctx.globalAlpha = 0.92;
      ctx.lineWidth = 3.6 + pulse * 1.1;
      ctx.beginPath();
      ctx.moveTo(muzzleX, muzzleY);
      ctx.lineTo(t.target.x, t.target.y);
      ctx.stroke();

      // Белый энергетический сердечник + точка плавления на мобе
      ctx.strokeStyle = '#ffffff';
      ctx.globalAlpha = 0.95;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(muzzleX, muzzleY);
      ctx.lineTo(t.target.x, t.target.y);
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(t.target.x, t.target.y, 3.6 + pulse * 0.9, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (t.type === 'melter' && t.target && t.isLockedOn && t.disabledTimer <= 0 && t.melterCoolingTimer <= 0) {
      const muzzleX = t.x + Math.cos(t.angle) * 24;
      const muzzleY = t.y + Math.sin(t.angle) * 24;
      const heatCol = meltHeatProgress > 0.72 ? '#ffffff' : (meltHeatProgress > 0.35 ? '#fb923c' : (t.color || '#e85268'));
      const beamW = 3.2 + meltHeatProgress * 4.2 + Math.sin(now * 0.035) * (0.6 + meltHeatProgress * 1.1);
      ctx.save();
      ctx.lineCap = 'round';
      ctx.globalCompositeOperation = 'lighter';

      // Внешний плазменный ореол, раздувающийся с разогревом
      ctx.strokeStyle = meltHeatProgress > 0.45 ? '#fb923c' : (t.color || '#e85268');
      ctx.globalAlpha = 0.30 + meltHeatProgress * 0.25;
      ctx.lineWidth = beamW * 2.4;
      ctx.beginPath();
      ctx.moveTo(muzzleX, muzzleY);
      ctx.lineTo(t.target.x, t.target.y);
      ctx.stroke();

      // Основной ствол термического луча
      ctx.strokeStyle = heatCol;
      ctx.globalAlpha = 0.95;
      ctx.lineWidth = beamW;
      ctx.beginPath();
      ctx.moveTo(muzzleX, muzzleY);
      ctx.lineTo(t.target.x, t.target.y);
      ctx.stroke();

      // Белый сердечник при высоком разогреве + раскалённое пятно на цели
      if (meltHeatProgress > 0.25) {
        ctx.strokeStyle = '#ffffff';
        ctx.globalAlpha = Math.min(1, 0.45 + meltHeatProgress * 0.55);
        ctx.lineWidth = Math.max(1.4, beamW * 0.42);
        ctx.beginPath();
        ctx.moveTo(muzzleX, muzzleY);
        ctx.lineTo(t.target.x, t.target.y);
        ctx.stroke();
      }

      const spotR = 4.0 + meltHeatProgress * 5.5 + Math.sin(now * 0.04) * 1.1;
      ctx.fillStyle = heatCol;
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.arc(t.target.x, t.target.y, spotR * 1.6, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.95;
      ctx.beginPath();
      ctx.arc(t.target.x, t.target.y, spotR * 0.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  });

  const viewLeft = -camX / camZoom - TILE_SIZE;
  const viewTop = -camY / camZoom - TILE_SIZE;
  const viewRight = (w - camX) / camZoom + TILE_SIZE;
  const viewBottom = (h - camY) / camZoom + TILE_SIZE;

  const _tMobsStart = performance.now();

  const enemyFxCfg = ENEMY_REACTIONS || {};
  const _beamTargets = new Set();
  for (let ti = 0; ti < towers.length; ti++) {
    const bt = towers[ti];
    if ((bt.type === 'laser' || bt.type === 'melter') && bt.target && bt.isLockedOn && bt.disabledTimer <= 0 && !(bt.type === 'melter' && bt.melterCoolingTimer > 0)) {
      _beamTargets.add(bt.target);
    }
  }
  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    const isBeamTarget = _beamTargets.has(e);
    if (e._fxLastHp !== undefined && e.hp < e._fxLastHp && fxDt > 0) {
      const ang = (e.angle || 0) + Math.PI;
      if (!isBeamTarget) {
        if (enemyFxCfg.knockback) {
          e._fxKbX = Math.cos(ang) * (e.isBoss ? 1.8 : 3.5);
          e._fxKbY = Math.sin(ang) * (e.isBoss ? 1.8 : 3.5);
        }
        if (enemyFxCfg.hitTilt) e._fxTilt = (Math.random() > 0.5 ? 1 : -1) * (e.isBoss ? 0.06 : 0.14);
      }
      if (enemyFxCfg.jitter) {
        e._fxJitT = 0.10;
        e._fxJitBeam = isBeamTarget;
      }
    }
    e._fxLastHp = e.hp;

    if (fxDt > 0) {
      const sp = Math.exp(-18 * fxDt);
      if (e._fxKbX) e._fxKbX *= sp;
      if (e._fxKbY) e._fxKbY *= sp;
      if (e._fxTilt) e._fxTilt *= Math.exp(-14 * fxDt);
      if (e._fxJitT > 0) {
        e._fxJitT = Math.max(0, e._fxJitT - fxDt);
        if (e._fxJitBeam) {
          e._fxJitStep = (e._fxJitStep || 0) - fxDt;
          if (e._fxJitStep <= 0) {
            e._fxJitStep = 0.05; // <-- частота смены позиции (раз в 0.1 сек = 10 Гц), тряска, дрожь при попадании
            e._fxJx = (Math.random() - 0.5) * 2.0; // <-- амплитуда для лазера/мелтера
            e._fxJy = (Math.random() - 0.5) * 2.0;
          }
        } else {
          e._fxJx = (Math.random() - 0.5) * 3.8; // <-- амплитуда для обычных попаданий
          e._fxJy = (Math.random() - 0.5) * 3.8;
        }
      } else {
        e._fxJx = 0;
        e._fxJy = 0;
      }
    }

    const jx = (e._fxJitT > 0) ? (e._fxJx || 0) : 0;
    const jy = (e._fxJitT > 0) ? (e._fxJy || 0) : 0;
    const fxOx = (e._fxKbX || 0) + jx;
    const fxOy = (e._fxKbY || 0) + jy;
    const fxTilt = e._fxTilt || 0;

    if (e.x < viewLeft || e.x > viewRight || e.y < viewTop || e.y > viewBottom) continue;
    if (Math.abs(fxOx) > 0.05 || Math.abs(fxOy) > 0.05 || Math.abs(fxTilt) > 0.005) {
      ctx.save();
      ctx.translate(e.x + fxOx, e.y + fxOy);
      if (Math.abs(fxTilt) > 0.005) ctx.rotate(fxTilt);
      ctx.translate(-e.x, -e.y);
      drawEnemyModel(e);
      ctx.restore();
    } else {
      drawEnemyModel(e);
    }
  }

  if (window.perfProfiler) perfProfiler.accum.drawMobs += (performance.now() - _tMobsStart);

  projectiles.forEach(p => {
    ctx.save();
    if (p.type === 'bullet') {
      drawFxBulletTrails(p);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
      ctx.fillStyle = p.color || '#00e5ff';
      ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
    } else if (p.type === 'mortar_shell') {
      const tProg = Math.max(0, Math.min(1, p.elapsed / p.duration));
      const apex = p.arcApex || 45;
      const heightOffset = 4 * apex * tProg * (1 - tProg);
      const shadowScale = 1 - 0.45 * (heightOffset / Math.max(1, apex));
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, 5 * shadowScale, 2.6 * shadowScale, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      const shellCol = p.color || '#ff9100';
      ctx.fillStyle = shellCol;
      setGlow(shellCol, 8);
      ctx.beginPath();
      ctx.arc(p.x, p.y - heightOffset, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  });

  lightningBolts.forEach(lb => {
    if (lb.delay && lb.delay > 0) return;
    const alpha = lb.life / lb.maxLife;
    if (lb.isRail) {
      ctx.save();
      ctx.lineCap = 'round';
      ctx.globalCompositeOperation = 'lighter';
      const railGlowColor = lb.color || '#a275df';

      ctx.beginPath();
      ctx.moveTo(lb.x1, lb.y1);
      ctx.lineTo(lb.x2, lb.y2);

      if (perfMode !== 'low') {
        ctx.strokeStyle = railGlowColor;
        ctx.globalAlpha = alpha * 0.32;
        ctx.lineWidth = 14;
        ctx.stroke();
      }

      ctx.strokeStyle = railGlowColor;
      ctx.globalAlpha = alpha * 0.85;
      ctx.lineWidth = 6;
      ctx.stroke();

      ctx.strokeStyle = '#ffffff';
      ctx.globalAlpha = alpha;
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.restore();
    } else {
      const prog = lb.travelTime ? Math.min(1.0, (lb.elapsed || 0) / lb.travelTime) : 1.0;
      drawJaggedLightning(lb.x1, lb.y1, lb.x2, lb.y2, lb.towerColor || lb.color || '#00ffcc', alpha, prog);
    }
  });

  shockwaves.forEach(sw => {
    const prog = sw.elapsed / sw.duration;
    const currentR = sw.maxRadius * Math.sin(prog * (Math.PI / 2));
    const safeAlpha = Math.max(0, 1 - prog);
    ctx.save();
    ctx.beginPath();
    ctx.arc(sw.x, sw.y, currentR, 0, Math.PI * 2);

    if (perfMode !== 'low') {
      ctx.strokeStyle = sw.color;
      ctx.globalAlpha = safeAlpha * 0.28;
      ctx.lineWidth = 6.5 * (1 - prog);
      ctx.stroke();
    }

    ctx.strokeStyle = sw.color;
    ctx.globalAlpha = safeAlpha;
    ctx.lineWidth = 2.5 * (1 - prog);
    ctx.stroke();
    ctx.restore();
  });
  
  const _tFxStart = performance.now();
  
  ctx.globalCompositeOperation = 'source-over';
  const smokeSprite = typeof getSmokeSprite === 'function' ? getSmokeSprite() : null;

  for (let i = 0; i < particles.length; i++) {
    const pt = particles[i];
    if (!pt.isSmoke && !pt.isSteam) continue;

    const rawProg = Math.max(0, Math.min(1, pt.life / pt.maxLife));
    if (pt.isSmoke && smokeSprite) {
      let smokeAlpha = rawProg > 0.85 ? (1.0 - rawProg) / 0.15 : rawProg / 0.85;
      ctx.globalAlpha = Math.max(0, Math.min(0.6, smokeAlpha * 0.6));
      const currentR = pt.radius * (1.0 + (1.0 - rawProg) * 1.3);
      ctx.drawImage(smokeSprite, pt.x - currentR, pt.y - currentR, currentR * 2, currentR * 2);
    } else if (pt.isSteam) {
      const growProg = 1.0 - rawProg;
      ctx.globalAlpha = rawProg * 0.45;
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.radius * (0.6 + growProg * 0.9), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.0;
  for (let i = 0; i < particles.length; i++) {
    const pt = particles[i];
    if (!pt.isShard) continue;

    const rawProg = Math.max(0, Math.min(1, pt.life / pt.maxLife));
    pt.angle = (pt.angle || 0) + (pt.vRot || 0) * 0.016;
    ctx.globalAlpha = Math.min(1.0, rawProg * 1.4);

    ctx.save();
    ctx.translate(pt.x, pt.y);
    ctx.rotate(pt.angle);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    if (pt.pts && pt.pts.length >= 3) {
      ctx.moveTo(pt.pts[0].x, pt.pts[0].y);
      for (let k = 1; k < pt.pts.length; k++) {
        ctx.lineTo(pt.pts[k].x, pt.pts[k].y);
      }
    } else {
      ctx.rect(-pt.radius / 2, -pt.radius / 2, pt.radius, pt.radius);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < particles.length; i++) {
    const pt = particles[i];
    if (pt.isSmoke || pt.isSteam || pt.isShard || pt.isText) continue;

    const rawProg = Math.max(0, Math.min(1, pt.life / pt.maxLife));
    const easeProg = rawProg * rawProg;

    if (pt.isRing) {
      const expandProg = 1.0 - rawProg;
      const curR = Math.max(2, pt.radius * Math.sin(expandProg * (Math.PI * 0.5)));
      ctx.globalAlpha = rawProg * 0.9;
      ctx.strokeStyle = pt.color || '#ffffff';
      ctx.lineWidth = Math.max(0.8, (pt.lineWidth || 2.2) * rawProg);
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, curR, 0, Math.PI * 2);
      ctx.stroke();
    } else if (pt.isCrossFlash) {
      const len = pt.radius * (0.45 + easeProg * 0.75);
      const thick = Math.max(1.2, pt.radius * 0.14 * rawProg);
      ctx.save();
      ctx.translate(pt.x, pt.y);
      ctx.rotate(pt.angle || 0);
      ctx.globalAlpha = rawProg * 0.95;

      ctx.fillStyle = pt.color || '#ff9100';
      ctx.beginPath();
      ctx.ellipse(0, 0, len, thick * 1.4, 0, 0, Math.PI * 2);
      ctx.ellipse(0, 0, thick * 1.4, len, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(0, 0, len * 0.68, thick * 0.65, 0, 0, Math.PI * 2);
      ctx.ellipse(0, 0, thick * 0.65, len * 0.68, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (pt.isFlash && typeof getGlowSprite === 'function') {
      ctx.globalAlpha = rawProg;
      const sprite = getGlowSprite(pt.color || '#ffffff');
      const r = pt.radius * (1.1 - (1.0 - rawProg) * 0.3);
      ctx.drawImage(sprite, pt.x - r, pt.y - r, r * 2, r * 2);
    } else if (pt.isGlowHalo && typeof getGlowSprite === 'function') {
      ctx.globalAlpha = rawProg * (pt.alphaMult || 0.4);
      const glowSprite = getGlowSprite(pt.color || '#ff9100');
      ctx.drawImage(glowSprite, pt.x - pt.radius, pt.y - pt.radius, pt.radius * 2, pt.radius * 2);
    } else if (pt.isStreak) {
      ctx.globalAlpha = rawProg * 0.9;
      ctx.save();
      ctx.translate(pt.x, pt.y);
      ctx.rotate(Math.atan2(pt.vy, pt.vx));
      const len = pt.radius * (1.5 + easeProg * 2.4);
      const width = Math.max(1.2, pt.radius * easeProg * 0.5);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, len, width, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else {
      ctx.globalAlpha = rawProg;
      const sprite = getNeonDiscSprite(pt.color || '#00e5ff');
      const curRadius = pt.radius * (0.4 + easeProg * 0.6);
      ctx.drawImage(sprite, pt.x - curRadius, pt.y - curRadius, curRadius * 2, curRadius * 2);
    }
  }

  updateAndDrawFxLayers(fxDt, nowSec);

  ctx.globalCompositeOperation = 'source-over';
  for (let i = 0; i < particles.length; i++) {
    const pt = particles[i];
    if (!pt.isText) continue;

    const rawProg = Math.max(0, Math.min(1, pt.life / pt.maxLife));
    ctx.globalAlpha = rawProg > 0.3 ? 1.0 : rawProg / 0.3;
    ctx.font = '900 12px Montserrat, sans-serif';
    ctx.fillStyle = pt.color || '#f05f9f';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 4;
    ctx.fillText(pt.text, pt.x, pt.y);
    ctx.shadowBlur = 0;
  }

  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1.0;

  if (window.perfProfiler) perfProfiler.accum.drawFx += (performance.now() - _tFxStart);

  if (draggingTower) {
    const c = Math.floor(draggingTower.worldX / TILE_SIZE);
    const r = Math.floor(draggingTower.worldY / TILE_SIZE);
    const isValidCell = c >= 0 && c < COLS && r >= 0 && r < ROWS;
    const canBuild = isValidCell && grid[r][c] === 0;
    const conf = TOWER_CONFIGS[draggingTower.type];

    const thDrag = getTheme();
    const dragMainCol = isHyperion ? '#ff9100' : (thDrag.c1 || '#00e5ff');
    const dragMainRgb = isHyperion ? '255, 145, 0' : (thDrag.rgb1 ? thDrag.rgb1.cssRgb : '0, 229, 255');
    const validStroke = dragMainCol;
    const validFill = `rgba(${dragMainRgb}, 0.20)`;

    if (isValidCell) {
      ctx.fillStyle = canBuild ? validFill : 'rgba(240, 95, 159, 0.3)';
      ctx.fillRect(c * TILE_SIZE, r * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      ctx.strokeStyle = canBuild ? validStroke : '#f05f9f';
      ctx.lineWidth = 2;
      ctx.strokeRect(c * TILE_SIZE, r * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }

    ctx.beginPath();
    ctx.arc(draggingTower.worldX, draggingTower.worldY, conf.range, 0, Math.PI * 2);
    ctx.strokeStyle = canBuild
      ? `rgba(${dragMainRgb}, 0.48)`
      : 'rgba(240, 95, 159, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.save();
    ctx.globalAlpha = 0.8;
    ctx.translate(draggingTower.worldX, draggingTower.worldY);
    drawTowerModel(draggingTower.type, 0, conf.color, 1, conf.glow);
    ctx.restore();
  }

  ctx.restore();

  updateTutorialOverlay(now);
}
