// Synth Wave Defense — ui_bg.js (Procedural nebula, starfield, loader warmup, menu triangle, horizon, perspective grid)

//  Math and random generator utilities for procedural background generation.
// [UI.ID]
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// [UI.IE]
function randn() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

// [UI.IF]
function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }

// [UI.IG]
function smoothstep(a, b, x) {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
}

//  2D Perlin Noise permutation table and gradient sampler.
const perlin = (function () {
  const rnd = mulberry32(1337);
  const perm = [];
  for (let i = 0; i < 256; i++) perm.push(i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const t = perm[i]; perm[i] = perm[j]; perm[j] = t;
  }
  const p = new Uint8Array(512);
  for (let i = 0; i < 512; i++) p[i] = perm[i & 255];

  const GX = [1, -1, 1, -1, 1, -1, 0, 0];
  const GY = [1, 1, -1, -1, 0, 0, 1, -1];
  const fade = t => t * t * t * (t * (t * 6 - 15) + 10);

  return function (x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const X = xi & 255, Y = yi & 255;
    const aa = p[p[X] + Y] & 7;
    const ab = p[p[X] + Y + 1] & 7;
    const ba = p[p[X + 1] + Y] & 7;
    const bb = p[p[X + 1] + Y + 1] & 7;
    const u = fade(xf), v = fade(yf);
    const g00 = GX[aa] * xf + GY[aa] * yf;
    const g10 = GX[ba] * (xf - 1) + GY[ba] * yf;
    const g01 = GX[ab] * xf + GY[ab] * (yf - 1);
    const g11 = GX[bb] * (xf - 1) + GY[bb] * (yf - 1);
    const x1 = g00 + u * (g10 - g00);
    const x2 = g01 + u * (g11 - g01);
    return x1 + v * (x2 - x1);
  };
})();

// [UI.IH]
function fbm(x, y, oct) {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) {
    s += a * perlin(x * f, y * f);
    f *= 2.03; a *= 0.5;
  }
  return s;
}

// [UI.II]
function ridged(x, y, oct) {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) {
    let n = 1 - Math.abs(perlin(x * f, y * f));
    n *= n;
    s += a * n;
    f *= 2.03; a *= 0.5;
  }
  return s;
}


//  Cosmic nebula and baked starfield texture renderer.

const NEBULA_DENSITY = 1.0;

//  Nebula color clusters aligned with logo gradient.
const NEBULA_CLUSTERS = [
  // Top-left cluster (pink-purple).
  { cx: 0.22, cy: 0.22, scale: 0.42, angle: 0.38, aspect: 0.64, intensity: 1.0,
    base: [0.34, 0.14, 0.58], hot: [0.95, 0.38, 0.88] },
  // Top-right cluster (cyan).
  { cx: 0.78, cy: 0.20, scale: 0.40, angle: -0.38, aspect: 0.65, intensity: 1.0,
    base: [0.04, 0.38, 0.62], hot: [0.25, 0.94, 0.96] },
  // Bottom-left cluster (muted pink-purple background).
  { cx: 0.20, cy: 0.76, scale: 0.45, angle: -0.28, aspect: 0.70, intensity: 0.52,
    base: [0.28, 0.10, 0.48], hot: [0.82, 0.30, 0.78] },
  // Bottom-right cluster (muted cyan background).
  { cx: 0.80, cy: 0.74, scale: 0.44, angle: 0.32, aspect: 0.70, intensity: 0.52,
    base: [0.04, 0.32, 0.50], hot: [0.20, 0.85, 0.88] }
];

// [UI.IJ]
function getActiveNebulaClusters() {
  if (typeof window !== 'undefined' && window.activeThemeColors && window.activeThemeColors.nebulaClusters) {
    return window.activeThemeColors.nebulaClusters;
  }
  return NEBULA_CLUSTERS;
}

// Noise offsets for randomized nebula structure per session.
const NEB_OFF = [Math.random() * 200, Math.random() * 200];

let nebulaCache = null;
let nebulaCacheKey = '';

//  Starfield parameters and sprite generation.
const BAKED_STAR_COUNT = 1620;
const TWINKLE_STAR_COUNT = 160;
const TWINKLE_STAR_COUNT_LOW = 65;
const STAR_NEBULA_SHARE = 0.5;

const STAR_TINTS = [
  { rgb: [155, 176, 255], w: 0.08 },
  { rgb: [202, 215, 255], w: 0.17 },
  { rgb: [248, 247, 255], w: 0.30 },
  { rgb: [255, 244, 234], w: 0.25 },
  { rgb: [255, 210, 161], w: 0.15 },
  { rgb: [255, 180, 130], w: 0.05 }
];

const STAR_CLASSES = [
  { sigma: 0.50, halo: 0.00, spike: 0.00, len: 0,  alpha: [0.25, 0.55] },
  { sigma: 0.65, halo: 0.04, spike: 0.00, len: 0,  alpha: [0.40, 0.70] },
  { sigma: 0.85, halo: 0.08, spike: 0.00, len: 0,  alpha: [0.55, 0.85] },
  { sigma: 1.05, halo: 0.14, spike: 0.00, len: 0,  alpha: [0.75, 1.00] },
  { sigma: 1.25, halo: 0.20, spike: 0.35, len: 12, alpha: [0.90, 1.00] }
];

let synthStars = [];
let lastStarUpdateTime = performance.now();

// [UI.IK]
function pickTint() {
  let r = Math.random();
  for (let i = 0; i < STAR_TINTS.length; i++) {
    r -= STAR_TINTS[i].w;
    if (r <= 0) return i;
  }
  return 2;
}

// [UI.IL]
function pickNebulaStarPosition() {
  const clusters = getActiveNebulaClusters();
  const idx = Math.random() < 0.75
    ? (Math.random() < 0.5 ? 0 : 1)
    : (Math.random() < 0.5 ? 2 : 3);
  const cluster = clusters[idx] || clusters[0];
  const lx = randn() * 0.45 * cluster.scale;
  const ly = randn() * 0.45 * cluster.scale * cluster.aspect;
  const cs = Math.cos(cluster.angle), sn = Math.sin(cluster.angle);
  let x = cluster.cx + lx * cs - ly * sn;
  let y = cluster.cy + lx * sn + ly * cs;
  return { x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) };
}

// [UI.IM]
function renderNebulaCache(w, h, dpr) {
  const isLowPerf = (typeof perfMode !== 'undefined' && perfMode === 'low');
  const effectiveDpr = isLowPerf ? Math.min(1.0, dpr) : dpr;
  const pw = Math.max(1, Math.round(w * effectiveDpr));
  const ph = Math.max(1, Math.round(h * effectiveDpr));
  const S = Math.min(w, h);

  const off = document.createElement('canvas');
  off.width = pw;
  off.height = ph;
  const c = off.getContext('2d');
  const img = c.createImageData(pw, ph);
  const d = img.data;

  const activeClusters = getActiveNebulaClusters();
  const cl = activeClusters.map(cluster => ({
    c: cluster,
    cx: cluster.cx * w,
    cy: cluster.cy * h,
    R: cluster.scale * S,
    cs: Math.cos(cluster.angle),
    sn: Math.sin(cluster.angle),
    intensity: cluster.intensity !== undefined ? cluster.intensity : 1.0
  }));
  const env = new Float32Array(cl.length);

  const octMain = isLowPerf ? 4 : 5;
  const octRidge = isLowPerf ? 3 : 4;

  for (let Y = 0; Y < ph; Y++) {
    const py = (Y + 0.5) / effectiveDpr;
    const t = py / h;
    let bgR, bgG, bgB;
    if (t < 0.5) {
      const q = t / 0.5;
      bgR = 6 + (5 - 6) * q;
      bgG = 9 + (7 - 9) * q;
      bgB = 20 + (17 - 20) * q;
    } else {
      const q = (t - 0.5) / 0.5;
      bgR = 5 + (2 - 5) * q;
      bgG = 7 + (3 - 7) * q;
      bgB = 17 + (8 - 17) * q;
    }

    for (let X = 0; X < pw; X++) {
      const px = (X + 0.5) / effectiveDpr;

      let maxEnv = 0;
      for (let i = 0; i < cl.length; i++) {
        const q = cl[i];
        const dx = (px - q.cx) / q.R;
        const dy = (py - q.cy) / q.R;
        const rx = dx * q.cs + dy * q.sn;
        const ry = -dx * q.sn + dy * q.cs;
        const sx = 0.85, sy = 0.85 * q.c.aspect;
        const e = Math.exp(-(rx * rx) / (sx * sx) - (ry * ry) / (sy * sy)) * q.intensity;
        env[i] = e;
        if (e > maxEnv) maxEnv = e;
      }

      let nr = 0, ng = 0, nb = 0;

      if (maxEnv > 0.01) {
        const u = px / S, v = py / S;

        const wx = u + 0.55 * fbm(u * 1.4 + NEB_OFF[0], v * 1.4 + NEB_OFF[1], 3);
        const wy = v + 0.55 * fbm(u * 1.4 + NEB_OFF[1] + 31.7, v * 1.4 + NEB_OFF[0] + 17.3, 3);

        const dustN = 0.5 + 1.1 * fbm(wx * 2.2 + 91.3, wy * 2.2 + 47.9, 4);
        const dust = smoothstep(0.52, 0.78, dustN);

        for (let i = 0; i < cl.length; i++) {
          const e = env[i];
          if (e < 0.01) continue;
          const q = cl[i].c;
          const offShift = i * 53.7;

          const n01 = 0.5 + 1.1 * fbm(wx * 3.0 + offShift, wy * 3.0 + offShift * 0.7, octMain);
          const dens = smoothstep(0.28, 0.82, n01);
          const fil = Math.pow(clamp01(ridged(wx * 3.6 + offShift + 7.1, wy * 3.6 + offShift - 3.9, octRidge) * 1.7), 1.4);

          let I = e * (0.28 + 0.95 * dens) * (0.5 + 0.95 * fil);
          I *= 1 - 0.7 * dust * Math.min(1, e * 3);

          const hotK = I * I * I * 0.6;
          nr += (q.base[0] * I + q.hot[0] * hotK) * 0.8;
          ng += (q.base[1] * I + q.hot[1] * hotK) * 0.8;
          nb += (q.base[2] * I + q.hot[2] * hotK) * 0.8;
        }
      }

      const tr = 1 - Math.exp(-nr * NEBULA_DENSITY);
      const tg = 1 - Math.exp(-ng * NEBULA_DENSITY);
      const tb = 1 - Math.exp(-nb * NEBULA_DENSITY);

      let r = bgR + tr * 255 * (1 - bgR / 255);
      let g = bgG + tg * 255 * (1 - bgG / 255);
      let b = bgB + tb * 255 * (1 - bgB / 255);

      const vr = Math.hypot(px - w * 0.5, py - h * 0.45) / (w * 0.85);
      const vt = smoothstep(0.35, 1.0, vr) * 0.9;
      r = r * (1 - vt) + 2 * vt;
      g = g * (1 - vt) + 3 * vt;
      b = b * (1 - vt) + 8 * vt;

      const nGrain = (Math.random() + Math.random() - 1) * 1.6;
      const o = (Y * pw + X) * 4;
      d[o] = Math.min(255, Math.max(0, r + nGrain));
      d[o + 1] = Math.min(255, Math.max(0, g + nGrain));
      d[o + 2] = Math.min(255, Math.max(0, b + nGrain));
      d[o + 3] = 255;
    }
  }

  const dustCount = Math.floor(pw * ph / 700);
  for (let i = 0; i < dustCount; i++) {
    const X = Math.floor(Math.random() * pw);
    const Y = Math.floor(Math.random() * ph);
    const o = (Y * pw + X) * 4;
    const v = 10 + Math.pow(Math.random(), 3) * 70;
    d[o] += v * 0.85;
    d[o + 1] += v * 0.92;
    d[o + 2] += v;
  }

  c.putImageData(img, 0, 0);

  const bakeRand = mulberry32(4242);
  c.save();
  c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < BAKED_STAR_COUNT; i++) {
    const inNeb = bakeRand() < STAR_NEBULA_SHARE;
    let sx, sy;
    if (inNeb) {
      const idx = bakeRand() < 0.75
        ? (bakeRand() < 0.5 ? 0 : 1)
        : (bakeRand() < 0.5 ? 2 : 3);
      const cluster = activeClusters[idx] || activeClusters[0];
      const u1 = Math.max(1e-6, bakeRand()), u2 = bakeRand();
      const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
      const z1 = Math.sqrt(-2.0 * Math.log(u1)) * Math.sin(2.0 * Math.PI * u2);
      const lx = z0 * 0.45 * cluster.scale;
      const ly = z1 * 0.45 * cluster.scale * cluster.aspect;
      const cs = Math.cos(cluster.angle), sn = Math.sin(cluster.angle);
      sx = Math.min(1, Math.max(0, cluster.cx + lx * cs - ly * sn));
      sy = Math.min(1, Math.max(0, cluster.cy + lx * sn + ly * cs));
    } else {
      sx = bakeRand();
      sy = bakeRand();
    }

    const u = bakeRand();
    const cls = u < 0.56 ? 0 : u < 0.82 ? 1 : u < 0.94 ? 2 : u < 0.988 ? 3 : 4;
    const aR = STAR_CLASSES[cls].alpha;
    const alpha = (aR[0] + bakeRand() * (aR[1] - aR[0])) * 0.88;

    let tr = bakeRand(), tintIdx = 2;
    for (let t = 0; t < STAR_TINTS.length; t++) {
      tr -= STAR_TINTS[t].w;
      if (tr <= 0) { tintIdx = t; break; }
    }

    const px = Math.round(sx * pw);
    const py = Math.round(sy * ph);
    c.globalAlpha = alpha;

    let bakeBrightness;
    if (cls >= 4) bakeBrightness = '#ffffff';
    else if (cls >= 3) bakeBrightness = '#e2e8f0';
    else if (cls >= 2) bakeBrightness = '#cbd5e1';
    else if (cls >= 1) bakeBrightness = '#94a3b8';
    else bakeBrightness = '#64748b';

    c.fillStyle = bakeBrightness;
    c.fillRect(px, py, 1, 1);
  }
  c.restore();

  return off;
}

// [UI.IN]
function getDpr() {
  if (typeof window !== 'undefined' && window.devicePixelRatio) {
    return window.devicePixelRatio;
  }
  return 1;
}

// [UI.IO]
function isMenuSceneActive() {
  const isUpgradesFromCombat = (typeof gameState !== 'undefined' && gameState === 'UPGRADES' && (typeof upgradesPreviousSource !== 'undefined' && (upgradesPreviousSource === 'victory' || upgradesPreviousSource === 'defeat')));
  const isSettingsFromCombat = (typeof gameState !== 'undefined' && gameState === 'SETTINGS' && (typeof settingsPreviousSource !== 'undefined' && settingsPreviousSource === 'pause'));
  const isShopFromCombat = (typeof gameState !== 'undefined' && gameState === 'SHOP' && (typeof shopPreviousSource !== 'undefined' && (shopPreviousSource === 'victory' || shopPreviousSource === 'defeat')));

  return (typeof gameState !== 'undefined' && (gameState === 'START' || gameState === 'LEVELS' || gameState === 'UPGRADES' || gameState === 'SHOP' || gameState === 'BATTLE_PASS')) &&
         !isUpgradesFromCombat && !isSettingsFromCombat && !isShopFromCombat;
}

let combatDimAlpha = 0;
let lastDimUpdateTime = typeof performance !== 'undefined' ? performance.now() : Date.now();

// [UI.IP]
function drawCosmicNebulaBackground(w, h, customDim = null) {
  const dpr = getDpr();
  const isLowPerf = (typeof perfMode !== 'undefined' && perfMode === 'low') ? 'low' : 'high';
  const palKey = typeof activePalette !== 'undefined' ? activePalette : 'default';
  const key = Math.round(w) + 'x' + Math.round(h) + '@' + dpr + '_' + isLowPerf + '_' + palKey;
  if (!nebulaCache || nebulaCacheKey !== key) {
    nebulaCache = renderNebulaCache(w, h, dpr);
    nebulaCacheKey = key;
  }
  
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(nebulaCache, 0, 0, w, h);
  ctx.restore();

  combatDimAlpha = 0;
}

let initialLoaderHidden = false;

// [UI.IQ]
function warmUpNebulaAndHideLoader() {
  if (initialLoaderHidden) return;
  initialLoaderHidden = true;

  const loader = document.getElementById('initialLoadingScreen');
  const barFill = document.getElementById('initialProgressBarFill');
  const loadingTextEl = document.getElementById('initialLoadingText');

  // [UI.IR]
  const setProgress = (pct) => {
    if (barFill) barFill.style.width = pct + '%';
  };

  // [UI.IS]
  const stepWait = (pct, delayMs = 140) => new Promise(resolve => {
    // [UI.IT]
    requestAnimationFrame(() => {
      setProgress(pct);
      // [UI.IU]
      requestAnimationFrame(() => {
        setTimeout(resolve, delayMs);
      });
    });
  });

  // [UI.IV]
  (async () => {
    try {
      const dpr = getDpr();
      const w = (typeof canvas !== 'undefined' && canvas) ? (canvas.width / dpr || window.innerWidth) : window.innerWidth;
      const h = (typeof canvas !== 'undefined' && canvas) ? (canvas.height / dpr || window.innerHeight) : window.innerHeight;

      await stepWait(20, 100);

      if (typeof canvas !== 'undefined' && canvas) {
        drawCosmicNebulaBackground(w, h);
      }
      await stepWait(50, 120);

      const horizonY = h * 0.44;
      if (typeof renderTriangleLogoCache === 'function') {
        const isLowPerfFlag = (typeof perfMode !== 'undefined' && perfMode === 'low');
        const texScale = isLowPerfFlag ? 1.5 : Math.min(3.0, Math.max(2.0, dpr * 1.5));
        const palKey = typeof activePalette !== 'undefined' ? activePalette : 'default';
        const key = Math.round(w) + 'x' + Math.round(horizonY) + '@' + texScale.toFixed(2) + '_' + (isLowPerfFlag ? 'low' : 'high') + '_' + palKey;
        if (!triangleLogoCache || triangleLogoCacheKey !== key) {
          triangleLogoCache = renderTriangleLogoCache(w, horizonY, texScale);
          triangleLogoCacheKey = key;
        }
      }
      await stepWait(75, 100);

      if (typeof MusicManager !== 'undefined' && typeof MusicManager.warmUpMenuAudio === 'function') {
        await MusicManager.warmUpMenuAudio();
      }
      if (typeof SFX !== 'undefined' && typeof SFX.autoload === 'function') {
        await SFX.autoload();
      }
      await stepWait(92, 100);

      if (typeof drawSynthWavePerspectiveScene === 'function') {
        drawSynthWavePerspectiveScene(performance.now());
      }
      const startSc = document.getElementById('startScreen');
      if (startSc) void startSc.offsetHeight;

      await stepWait(100, 160);

    } catch (e) {
      console.warn('Pre-warm scene failed:', e);
      setProgress(100);
    }

    if (loader) {
      if (barFill) {
        barFill.style.transition = 'none';
        barFill.style.setProperty('width', '100%', 'important');
      }

      if (loadingTextEl) {
        loadingTextEl.textContent = typeof t === 'function' ? t('ready') : 'READY';
      }

      const titleBox = document.createElement('div');
      titleBox.className = 'loader-title-zone';
      titleBox.innerHTML = `
        <div class="start-sub-title">Synth Wave</div>
        <div class="start-main-title">Defense</div>
      `;
      loader.appendChild(titleBox);

      const goBtn = document.createElement('button');
      goBtn.className = 'shop-item-btn shop-btn-free';
      goBtn.setAttribute('data-sfx', 'tap');
      goBtn.style.position = 'absolute';
      goBtn.style.left = '50%';
      const centerBox = document.getElementById('initialLoaderCenterBox');
      const baseTop = (centerBox && centerBox.style.top) ? centerBox.style.top : '50lvh';
      goBtn.style.top = `calc(${baseTop} + 56px)`;
      goBtn.style.transform = 'translateX(-50%)';
      goBtn.style.pointerEvents = 'auto';
      goBtn.style.padding = '10px 42px';
      goBtn.style.fontSize = '14px';
      goBtn.style.opacity = '0';
      goBtn.style.animation = 'goBtnAppear 1s ease-out forwards, goBtnPulse 2s infinite ease-in-out 1s';
      goBtn.innerHTML = `<span>${typeof t === 'function' ? t('go') : 'GO'}</span>`;

      // [UI.IW]
      goBtn.onclick = () => {
        if (typeof SFX !== 'undefined' && typeof SFX.unlock === 'function') SFX.unlock();
        if (typeof musicUnlock === 'function') musicUnlock();

        loader.style.opacity = '0';
        loader.style.pointerEvents = 'none';
        // [UI.IX]
        setTimeout(() => {
          if (loader.parentNode) loader.parentNode.removeChild(loader);
        }, 400);
      };

      loader.appendChild(goBtn);
    }
  })();
}

// [UI.IY]
function createStar(randomizeLife = false, inNebula = false) {
  const maxLife = Math.random() * 16.0 + 10.0;
  const u = Math.random();
  const cls = u < 0.25 ? 0 : u < 0.55 ? 1 : u < 0.82 ? 2 : u < 0.95 ? 3 : 4;
  const aR = STAR_CLASSES[cls].alpha;

  const pos = inNebula ? pickNebulaStarPosition() : { x: Math.random(), y: Math.random() };

  return {
    x: pos.x,
    y: pos.y,
    cls: cls,
    tint: pickTint(),
    baseAlpha: aR[0] + Math.random() * (aR[1] - aR[0]),
    twinkleSpeed: Math.random() * 1.6 + 0.7,
    twinklePhase: Math.random() * Math.PI * 2,
    life: randomizeLife ? Math.random() * maxLife : 0,
    maxLife: maxLife
  };
}

// [UI.IZ]
function initSynthStars() {
  synthStars = [];
  for (let i = 0; i < TWINKLE_STAR_COUNT; i++) {
    synthStars.push(createStar(true, Math.random() < STAR_NEBULA_SHARE));
  }
}
initSynthStars();

// [UI.JA]
function updateAndDrawStars(w, h, now) {
  const dt = Math.min((now - lastStarUpdateTime) / 1000, 0.1);
  lastStarUpdateTime = now;
  const time = now / 1000;

  const isLowPerf = (typeof perfMode !== 'undefined' && perfMode === 'low');
  const activeCount = isLowPerf ? Math.min(synthStars.length, TWINKLE_STAR_COUNT_LOW) : synthStars.length;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  for (let i = 0; i < activeCount; i++) {
    const star = synthStars[i];
    star.life += dt;
    if (star.life >= star.maxLife) {
      synthStars[i] = createStar(false, Math.random() < STAR_NEBULA_SHARE);
      continue;
    }

    const lifeProgress = star.life / star.maxLife;
    const fade = Math.min(1, Math.sin(lifeProgress * Math.PI) * 3);

    const twinkle = 0.55 + 0.45 * Math.sin(time * star.twinkleSpeed + star.twinklePhase);
    const alpha = star.baseAlpha * twinkle * fade;
    if (alpha <= 0.02) continue;

    const px = Math.round(star.x * w);
    const py = Math.round(star.y * h);

    ctx.globalAlpha = alpha;

    let starBrightness;
    if (star.cls >= 4) {
      starBrightness = '#ffffff';
    } else if (star.cls >= 3) {
      starBrightness = '#e2e8f0';
    } else if (star.cls >= 2) {
      starBrightness = '#cbd5e1';
    } else if (star.cls >= 1) {
      starBrightness = '#94a3b8';
    } else {
      starBrightness = '#64748b';
    }

    ctx.fillStyle = starBrightness;
    ctx.fillRect(px, py, 1, 1);
  }
  ctx.restore();
}

let triangleLogoCache = null;
let triangleLogoCacheKey = '';

// [UI.JB]
function renderTriangleLogoCache(w, horizonY, texScale) {
  const isLowPerf = (typeof perfMode !== 'undefined' && perfMode === 'low');
  const effScale = texScale || (isLowPerf ? 1.5 : Math.min(3.0, Math.max(2.0, getDpr() * 1.5)));

  const pad = 70;
  const ch = Math.ceil(horizonY + pad);
  const off = document.createElement('canvas');
  off.width = Math.max(1, Math.round(w * effScale));
  off.height = Math.max(1, Math.round(ch * effScale));
  const c = off.getContext('2d');
  c.scale(effScale, effScale);

  const cx = w * 0.5;
  const tipY = horizonY - 24;
  const topY = Math.max(98, horizonY * 0.26);
  const halfW = Math.min(w * 0.35, (tipY - topY) * 0.65);

  const A = { x: cx,         y: tipY };
  const B = { x: cx - halfW, y: topY };
  const C = { x: cx + halfW, y: topY };

  const sa = Math.hypot(B.x - C.x, B.y - C.y);
  const sb = Math.hypot(A.x - C.x, A.y - C.y);
  const sc = Math.hypot(A.x - B.x, A.y - B.y);
  const per = sa + sb + sc;
  const inX = (sa * A.x + sb * B.x + sc * C.x) / per;
  const inY = (sa * A.y + sb * B.y + sc * C.y) / per;
  const inR = (halfW * (tipY - topY)) / (per / 2);

  // [UI.JC]
  const triPoints = (offset) => {
    const k = 1 + offset / inR;
    // [UI.JD]
    const p = v => ({ x: inX + (v.x - inX) * k, y: inY + (v.y - inY) * k });
    return [p(A), p(B), p(C)];
  };

  const triPath = (offset) => {
    const [a, b, d] = triPoints(offset);
    c.beginPath();
    c.moveTo(a.x, a.y);
    c.lineTo(b.x, b.y);
    c.lineTo(d.x, d.y);
    c.closePath();
  };

  const th = getTheme();
  const c1Rgb = th.rgb1 ? th.rgb1.cssRgb : '0, 229, 255';
  const c2Rgb = th.rgb2 ? th.rgb2.cssRgb : '217, 70, 239';
  const c3Rgb = th.rgb3 ? th.rgb3.cssRgb : '240, 95, 159';

  const drawRadialSpot = (x, y, r, stops) => {
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    for (let i = 0; i < stops.length; i++) {
      g.addColorStop(stops[i][0], stops[i][1]);
    }
    c.fillStyle = g;
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fill();
  };

  // [UI.JE]
  const makeGrad = (lighten) => {
    const g = c.createLinearGradient(B.x - 20, 0, C.x + 20, 0);
    if (lighten) {
      g.addColorStop(0.00, th.c1Light);
      g.addColorStop(0.52, th.c2Light);
      g.addColorStop(1.00, th.c3Light);
    } else {
      g.addColorStop(0.00, th.c1);
      g.addColorStop(0.52, th.c2);
      g.addColorStop(1.00, th.c3);
    }
    return g;
  };

  c.save();
  c.globalCompositeOperation = 'lighter';

  const cornerR = halfW * 0.30;
  const cornerSpots = [
    { x: B.x, y: B.y, r: cornerR, stops: [[0.0, `rgba(${c1Rgb}, 0.24)`], [0.4, `rgba(${c1Rgb}, 0.10)`], [1.0, `rgba(${c1Rgb}, 0)`]] },
    { x: C.x, y: C.y, r: cornerR, stops: [[0.0, `rgba(${c3Rgb}, 0.24)`], [0.4, `rgba(${c2Rgb}, 0.10)`], [1.0, `rgba(${c2Rgb}, 0)`]] },
    { x: A.x, y: A.y - 3, r: cornerR * 0.50, stops: [[0.0, 'rgba(255, 255, 255, 0.10)'], [0.30, `rgba(${c2Rgb}, 0.18)`], [0.65, `rgba(${c3Rgb}, 0.06)`], [1.0, `rgba(${c2Rgb}, 0)`]] }
  ];
  for (let i = 0; i < cornerSpots.length; i++) {
    const s = cornerSpots[i];
    drawRadialSpot(s.x, s.y, s.r, s.stops);
  }
  c.restore();

  // [UI.JEM] Soft inner tinting veil & volumetric neon mist inside outer triangle.
  c.save();
  triPath(0);
  c.clip();

  const veilGrad = c.createLinearGradient(0, topY, 0, tipY);
  veilGrad.addColorStop(0.0, 'rgba(10, 14, 34, 0.36)');
  veilGrad.addColorStop(0.55, 'rgba(14, 18, 46, 0.30)');
  veilGrad.addColorStop(1.0, `rgba(${c2Rgb}, 0.28)`);
  c.fillStyle = veilGrad;
  c.fillRect(B.x - 10, B.y - 10, halfW * 2 + 20, (tipY - topY) + 20);

  c.globalAlpha = 0.08;
  c.fillStyle = makeGrad(false);
  c.fillRect(B.x - 10, B.y - 10, halfW * 2 + 20, (tipY - topY) + 20);

  c.globalCompositeOperation = 'lighter';
  c.globalAlpha = 1.0;
  drawRadialSpot(inX, inY, inR * 1.35, [
    [0.0, `rgba(${c2Rgb}, 0.15)`],
    [0.55, `rgba(${c1Rgb}, 0.07)`],
    [1.0, 'rgba(0, 0, 0, 0)']
  ]);

  c.lineJoin = 'round';
  c.lineCap = 'round';
  c.strokeStyle = makeGrad(false);
  c.globalAlpha = 0.09;
  c.lineWidth = 24;
  triPath(0);
  c.stroke();
  c.globalAlpha = 0.12;
  c.lineWidth = 10;
  triPath(0);
  c.stroke();
  c.restore();

  const GLOW_FALLOFF = [
    { mult: 5.8, alpha: 0.015 },
    { mult: 4.3, alpha: 0.024 },
    { mult: 3.1, alpha: 0.040 },
    { mult: 2.1, alpha: 0.065 },
    { mult: 1.3, alpha: 0.100 }
  ];

  // [UI.JF]
  const neonTriSoft = (offset, width, lighten, strength) => {
    c.save();
    c.lineJoin = 'round';
    c.lineCap = 'round';

    const glowGrad = makeGrad(false);
    const coreGrad = makeGrad(lighten);

    c.globalCompositeOperation = 'lighter';
    c.strokeStyle = glowGrad;
    for (let i = 0; i < GLOW_FALLOFF.length; i++) {
      const layer = GLOW_FALLOFF[i];
      c.globalAlpha = layer.alpha * strength;
      c.lineWidth = width * layer.mult;
      triPath(offset);
      c.stroke();
    }

    c.globalCompositeOperation = 'screen';
    c.globalAlpha = 0.92;
    c.strokeStyle = coreGrad;
    c.lineWidth = width;
    triPath(offset);
    c.stroke();

    c.globalCompositeOperation = 'lighter';
    c.globalAlpha = 0.48 * strength;
    c.strokeStyle = '#ffffff';
    c.lineWidth = width * 0.34;
    triPath(offset);
    c.stroke();

    c.restore();
  };

  neonTriSoft(-inR * 0.40, 4.2, false, 0.88);
  neonTriSoft(-14,         4.8, false, 0.94);
  neonTriSoft(0,           5.2, true,  1.12);

  // [UI.JFM] Post-line screen blooms positioned right inside each bottom V-tip to round out inner glow.
  const r2 = th.rgb2 ? th.rgb2.r : 217;
  const g2 = th.rgb2 ? th.rgb2.g : 70;
  const b2 = th.rgb2 ? th.rgb2.b : 239;
  const c2LightRgb = `${Math.round(r2 + (255 - r2) * 0.55)}, ${Math.round(g2 + (255 - g2) * 0.55)}, ${Math.round(b2 + (255 - b2) * 0.55)}`;

  c.save();
  triPath(0);
  c.clip();
  c.globalCompositeOperation = 'screen';

  const postSpots = [
    { x: A.x, y: inY + (A.y - inY) * 1.0 - 8,                  r: 20, stops: [[0.0, `rgba(${c2LightRgb}, 0.45)`], [0.45, `rgba(${c2Rgb}, 0.16)`], [1.0, `rgba(${c2Rgb}, 0)`]] },
    { x: A.x, y: inY + (A.y - inY) * (1 - 14 / inR) - 12,      r: 26, stops: [[0.0, `rgba(${c2LightRgb}, 0.42)`], [0.45, `rgba(${c2Rgb}, 0.16)`], [1.0, `rgba(${c2Rgb}, 0)`]] },
    { x: A.x, y: inY + (A.y - inY) * 0.60 - 14,                r: 34, stops: [[0.0, `rgba(${c2LightRgb}, 0.36)`], [0.45, `rgba(${c2Rgb}, 0.14)`], [1.0, `rgba(${c2Rgb}, 0)`]] },
    { x: B.x + 12, y: B.y + 8, r: cornerR * 0.65, stops: [[0.0, `rgba(${c1Rgb}, 0.18)`], [0.5, `rgba(${c1Rgb}, 0.06)`], [1.0, `rgba(${c1Rgb}, 0)`]] },
    { x: C.x - 12, y: C.y + 8, r: cornerR * 0.65, stops: [[0.0, `rgba(${c3Rgb}, 0.18)`], [0.5, `rgba(${c2Rgb}, 0.06)`], [1.0, `rgba(${c2Rgb}, 0)`]] }
  ];
  for (let i = 0; i < postSpots.length; i++) {
    const s = postSpots[i];
    drawRadialSpot(s.x, s.y, s.r, s.stops);
  }
  c.restore();

  return { canvas: off, height: ch };
}

// [UI.JG]
function drawSynthWaveTriangleLogo5C(w, horizonY, time) {
  const dpr = getDpr();
  const isLowPerfFlag = (typeof perfMode !== 'undefined' && perfMode === 'low');
  const texScale = isLowPerfFlag ? 1.5 : Math.min(3.0, Math.max(2.0, dpr * 1.5));
  const palKey = typeof activePalette !== 'undefined' ? activePalette : 'default';
  const key = Math.round(w) + 'x' + Math.round(horizonY) + '@' + texScale.toFixed(2) + '_' + (isLowPerfFlag ? 'low' : 'high') + '_' + palKey;

  if (!triangleLogoCache || triangleLogoCacheKey !== key) {
    triangleLogoCache = renderTriangleLogoCache(w, horizonY, texScale);
    triangleLogoCacheKey = key;
  }

  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(triangleLogoCache.canvas, 0, 0, w, triangleLogoCache.height);
  ctx.restore();
}

//  Multi-pass neon horizon beam renderer (baked into menu stage cache).
// [UI.JH]
function drawSynthWaveHorizonBeam(w, horizonY, targetCtx) {
  const tCtx = targetCtx || ctx;
  const th = getTheme();
  const c1Rgb = th.rgb1 ? th.rgb1.cssRgb : '0, 229, 255';
  const c2Rgb = th.rgb2 ? th.rgb2.cssRgb : '217, 70, 239';
  const c3Rgb = th.rgb3 ? th.rgb3.cssRgb : '240, 95, 159';

  tCtx.save();
  tCtx.globalCompositeOperation = 'lighter';

  const bloomR = 46;
  const vBloom = tCtx.createLinearGradient(0, horizonY - bloomR, 0, horizonY + bloomR);
  vBloom.addColorStop(0.00, `rgba(${c2Rgb}, 0)`);
  vBloom.addColorStop(0.22, `rgba(${c2Rgb}, 0.04)`);
  vBloom.addColorStop(0.36, `rgba(${c2Rgb}, 0.11)`);
  vBloom.addColorStop(0.45, `rgba(${c1Rgb}, 0.25)`);
  vBloom.addColorStop(0.50, 'rgba(240, 250, 255, 0.44)');
  vBloom.addColorStop(0.55, `rgba(${c1Rgb}, 0.25)`);
  vBloom.addColorStop(0.64, `rgba(${c1Rgb}, 0.11)`);
  vBloom.addColorStop(0.78, `rgba(${c1Rgb}, 0.04)`);
  vBloom.addColorStop(1.00, `rgba(${c1Rgb}, 0)`);
  tCtx.fillStyle = vBloom;
  tCtx.fillRect(0, horizonY - bloomR, w, bloomR * 2);

  const sideRx = w * 0.46;
  const sideRy = 26;
  const sideGlows = [
    { x: w * 0.27, cStart: c1Rgb, cMid: c1Rgb },
    { x: w * 0.73, cStart: c3Rgb, cMid: c2Rgb }
  ];
  for (let i = 0; i < sideGlows.length; i++) {
    const sg = sideGlows[i];
    tCtx.save();
    tCtx.translate(sg.x, horizonY);
    tCtx.scale(1, sideRy / sideRx);
    const g = tCtx.createRadialGradient(0, 0, 0, 0, 0, sideRx);
    g.addColorStop(0.00, `rgba(${sg.cStart}, 0.38)`);
    g.addColorStop(0.35, `rgba(${sg.cMid}, 0.18)`);
    g.addColorStop(0.70, `rgba(${sg.cMid}, 0.05)`);
    g.addColorStop(1.00, `rgba(${sg.cMid}, 0)`);
    tCtx.fillStyle = g;
    tCtx.beginPath();
    tCtx.arc(0, 0, sideRx, 0, Math.PI * 2);
    tCtx.fill();
    tCtx.restore();
  }

  const tightR = 7;
  const tightBloom = tCtx.createLinearGradient(0, horizonY - tightR, 0, horizonY + tightR);
  tightBloom.addColorStop(0.00, 'rgba(255, 255, 255, 0)');
  tightBloom.addColorStop(0.30, `rgba(${c2Rgb}, 0.28)`);
  tightBloom.addColorStop(0.50, 'rgba(255, 255, 255, 0.76)');
  tightBloom.addColorStop(0.70, `rgba(${c1Rgb}, 0.28)`);
  tightBloom.addColorStop(1.00, 'rgba(255, 255, 255, 0)');
  tCtx.fillStyle = tightBloom;
  tCtx.fillRect(0, horizonY - tightR, w, tightR * 2);

  const hBeamGrad = tCtx.createLinearGradient(0, 0, w, 0);
  hBeamGrad.addColorStop(0.00, th.c1);
  hBeamGrad.addColorStop(0.22, th.c1Light);
  hBeamGrad.addColorStop(0.50, th.c2);
  hBeamGrad.addColorStop(0.78, th.c3Light || th.c3);
  hBeamGrad.addColorStop(1.00, th.c3);

  tCtx.globalCompositeOperation = 'source-over';
  tCtx.strokeStyle = hBeamGrad;
  tCtx.globalAlpha = 0.95;
  tCtx.lineWidth = 3.2;
  tCtx.beginPath();
  tCtx.moveTo(0, horizonY);
  tCtx.lineTo(w, horizonY);
  tCtx.stroke();

  const coreGrad = tCtx.createLinearGradient(0, 0, w, 0);
  coreGrad.addColorStop(0.00, 'rgba(255, 255, 255, 0.78)');
  coreGrad.addColorStop(0.15, 'rgba(255, 255, 255, 0.94)');
  coreGrad.addColorStop(0.50, 'rgba(255, 255, 255, 0.94)');
  coreGrad.addColorStop(0.85, 'rgba(255, 255, 255, 0.94)');
  coreGrad.addColorStop(1.00, 'rgba(255, 255, 255, 0.78)');

  tCtx.globalCompositeOperation = 'lighter';
  tCtx.strokeStyle = coreGrad;
  tCtx.globalAlpha = 0.95;
  tCtx.lineWidth = 1.6;
  tCtx.beginPath();
  tCtx.moveTo(0, horizonY);
  tCtx.lineTo(w, horizonY);
  tCtx.stroke();

  tCtx.restore();
}

let menuStageCache = null;
let menuStageCacheKey = '';

// [UI.JHM] Offscreen cache for static main menu stage (floor gradient, perspective rays, road, horizon beam).
function renderMenuStageCache(w, h, horizonY, texScale) {
  const off = document.createElement('canvas');
  off.width = Math.max(1, Math.round(w * texScale));
  off.height = Math.max(1, Math.round(h * texScale));
  const mCtx = off.getContext('2d');
  mCtx.scale(texScale, texScale);

  const floorH = h - horizonY;
  const vpX = w * 0.5;
  const th = getTheme();
  const c1Rgb = th.rgb1 ? th.rgb1.cssRgb : '0, 229, 255';

  mCtx.save();
  const planeGrad = mCtx.createLinearGradient(0, horizonY, 0, h);
  planeGrad.addColorStop(0, 'rgba(14, 22, 48, 0.06)');
  planeGrad.addColorStop(0.35, 'rgba(12, 20, 44, 0.18)');
  planeGrad.addColorStop(1, 'rgba(8, 14, 32, 0.36)');
  mCtx.fillStyle = planeGrad;
  mCtx.fillRect(0, horizonY, w, floorH);

  mCtx.beginPath();
  mCtx.rect(0, horizonY, w, floorH);
  mCtx.clip();

  mCtx.shadowColor = th.c1;
  mCtx.shadowBlur = 5;

  const horizCount = 14;
  const bottomStep = Math.max(34, (floorH / horizCount) * 1.5);
  const targetBottomCellWidth = bottomStep * 1.1;
  const numLines = Math.ceil((w * 1.4) / targetBottomCellWidth);

  mCtx.lineWidth = 1.0;
  mCtx.strokeStyle = `rgba(${c1Rgb}, 0.34)`;
  for (let i = -numLines; i <= numLines; i++) {
    const bottomX = vpX + (i + 0.5) * targetBottomCellWidth;
    const topX = vpX + (i + 0.5) * (targetBottomCellWidth * 0.32);
    mCtx.beginPath();
    mCtx.moveTo(topX, horizonY);
    mCtx.lineTo(bottomX, h);
    mCtx.stroke();
  }

  const roadTopHalfW = targetBottomCellWidth * 0.16;
  const roadBottomHalfW = targetBottomCellWidth * 0.50;

  mCtx.shadowBlur = 0;
  mCtx.fillStyle = 'rgba(12, 20, 44, 0.25)';
  mCtx.beginPath();
  mCtx.moveTo(vpX - roadTopHalfW, horizonY);
  mCtx.lineTo(vpX + roadTopHalfW, horizonY);
  mCtx.lineTo(vpX + roadBottomHalfW, h);
  mCtx.lineTo(vpX - roadBottomHalfW, h);
  mCtx.closePath();
  mCtx.fill();

  mCtx.lineWidth = 2.6;
  mCtx.strokeStyle = `rgba(${c1Rgb}, 0.24)`;
  mCtx.beginPath();
  mCtx.moveTo(vpX - roadTopHalfW, horizonY);
  mCtx.lineTo(vpX - roadBottomHalfW, h);
  mCtx.moveTo(vpX + roadTopHalfW, horizonY);
  mCtx.lineTo(vpX + roadBottomHalfW, h);
  mCtx.stroke();

  mCtx.restore();

  drawSynthWaveHorizonBeam(w, horizonY, mCtx);
  return { canvas: off, horizCount, targetBottomCellWidth, roadTopHalfW, roadBottomHalfW };
}

//  Synthwave background perspective grid scene renderer.
// [UI.JI]
function drawSynthWavePerspectiveScene(now) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const time = now / 1000;
  const horizonY = h * 0.44;
  const floorH = h - horizonY;
  const vpX = w * 0.5;
  const th = getTheme();
  const c1Rgb = th.rgb1 ? th.rgb1.cssRgb : '0, 229, 255';
  const c2Rgb = th.rgb2 ? th.rgb2.cssRgb : '217, 70, 239';
  const c4Rgb = th.rgb4 ? th.rgb4.cssRgb : '255, 145, 0';

  drawCosmicNebulaBackground(w, h);
  updateAndDrawStars(w, h, now);

  const dpr = getDpr();
  const isLowPerfFlag = (typeof perfMode !== 'undefined' && perfMode === 'low');
  const stageScale = isLowPerfFlag ? 1.25 : Math.min(3.0, Math.max(2.0, dpr));
  const palKey = typeof activePalette !== 'undefined' ? activePalette : 'default';
  const stageKey = Math.round(w) + 'x' + Math.round(h) + '@' + stageScale.toFixed(2) + '_' + (isLowPerfFlag ? 'low' : 'high') + '_' + palKey;

  if (!menuStageCache || menuStageCacheKey !== stageKey) {
    menuStageCache = renderMenuStageCache(w, h, horizonY, stageScale);
    menuStageCacheKey = stageKey;
  }

  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(menuStageCache.canvas, 0, 0, w, h);

  ctx.beginPath();
  ctx.rect(0, horizonY, w, floorH);
  ctx.clip();

  const { horizCount, roadTopHalfW, roadBottomHalfW } = menuStageCache;
  const isDefaultTheme = (th.id === 'default');

  // Animated dashed road rails (no shadowBlur for 60+ FPS).
  ctx.save();
  ctx.setLineDash([12, 10]);
  ctx.lineDashOffset = (time * 36);
  ctx.lineWidth = 3.8;
  ctx.strokeStyle = `rgba(${c1Rgb}, 0.24)`;
  ctx.beginPath();
  ctx.moveTo(vpX - roadTopHalfW, horizonY);
  ctx.lineTo(vpX - roadBottomHalfW, h);
  ctx.moveTo(vpX + roadTopHalfW, horizonY);
  ctx.lineTo(vpX + roadBottomHalfW, h);
  ctx.stroke();

  ctx.lineWidth = 1.8;
  ctx.strokeStyle = th.c1Light;
  ctx.stroke();
  ctx.restore();

  const speed = 0.42;
  const cycle = (time * speed) % 1;
  const baseWave = Math.floor(time * speed);

  for (let j = 0; j < horizCount; j++) {
    const progress = (j + cycle) / horizCount;
    const currentY = horizonY + Math.pow(progress, 1.95) * floorH;
    const alpha = Math.min(0.42, 0.08 + progress * 0.35);

    const lineId = (baseWave - j) % 2;
    ctx.strokeStyle = (isDefaultTheme || lineId === 0)
      ? `rgba(${c1Rgb}, ${alpha})`
      : `rgba(${c2Rgb}, ${alpha})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, currentY);
    ctx.lineTo(w, currentY);
    ctx.stroke();
  }

  const scoutColor = th.c4;
  const mobCycleDuration = 13.5;
  const mobLinearProgress = (time % mobCycleDuration) / mobCycleDuration;
  const u = 1 - mobLinearProgress;

  const mobY = horizonY + Math.pow(u, 1.95) * floorH;
  const mobScale = 0.2 + 0.8 * u;
  const scoutBaseR = 12 * mobScale;
  const mobFade = Math.min(1, Math.min(u / 0.15, (1 - u) / 0.12));

  ctx.save();
  ctx.translate(vpX, mobY);
  ctx.globalAlpha = Math.max(0, mobFade);
  ctx.rotate(-Math.PI / 2);

  const R = scoutBaseR * 1.25;
  ctx.beginPath();
  ctx.moveTo(R, 0);
  ctx.lineTo(-R * 0.5, R * 0.866);
  ctx.lineTo(-R * 0.5, -R * 0.866);
  ctx.closePath();

  ctx.strokeStyle = `rgba(${c4Rgb}, 0.30)`;
  ctx.lineWidth = 4.5 * mobScale;
  ctx.stroke();

  ctx.fillStyle = `rgba(${c4Rgb}, 0.34)`;
  ctx.strokeStyle = scoutColor;
  ctx.lineWidth = 1.8 * mobScale;
  ctx.fill();
  ctx.stroke();

  ctx.restore();
  ctx.restore();

  drawSynthWaveTriangleLogo5C(w, horizonY, time);
}
