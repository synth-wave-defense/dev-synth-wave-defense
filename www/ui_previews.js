// Synth Wave Defense — ui_previews.js (ModeBattlePreview & MilestoneTowerPreview live battle demos)

// [UI.CFM] Generalized autonomous live battle preview controller (Normal / Endless / Overdrive).
const ModeBattlePreview = (() => {
  const T_SIZE = 70;

  let activeMode = 'normal';
  let _rafId = null;
  let _lastTs = 0;
  let _lastDt = 0.016;
  let _simTime = 0;

  // Normal state
  const N_COLS = 7, N_ROWS = 5;
  const N_VIEW_X_MIN = 0.35 * T_SIZE;
  const N_VIEW_X_MAX = 6.65 * T_SIZE;
  const N_VIEW_Y_MIN = 0;
  const N_VIEW_Y_MAX = 4.15 * T_SIZE;
  const N_VIEW_W = N_VIEW_X_MAX - N_VIEW_X_MIN;
  const N_VIEW_H = N_VIEW_Y_MAX - N_VIEW_Y_MIN;
  const N_WAYPOINTS = [
    { x: 3.5 * T_SIZE, y: 5.5 * T_SIZE },
    { x: 3.5 * T_SIZE, y: 1.5 * T_SIZE },
    { x: 1.5 * T_SIZE, y: 1.5 * T_SIZE },
    { x: 1.5 * T_SIZE, y: 3.5 * T_SIZE },
    { x: 7.2 * T_SIZE, y: 3.5 * T_SIZE }
  ];
  const N_PATH_CELLS = new Set([
    '3,4', '3,3', '3,2', '3,1',
    '2,1', '1,1',
    '1,2', '1,3',
    '2,3', '3,3', '4,3', '5,3', '6,3'
  ]);

  // Endless state (15x7 = 1050x490, zoomed-out sleek mathematical ∞ over square grid)
  const E_COLS = 15, E_ROWS = 7;
  const E_VIEW_W = E_COLS * T_SIZE;
  const E_VIEW_H = E_ROWS * T_SIZE;
  const E_CX = E_VIEW_W * 0.5;
  const E_CY = E_VIEW_H * 0.5;
  const E_RX = 460;
  const E_RY = 182;
  const E_SAMPLES = 160;
  const E_CURVE = [];
  const E_PATH_CELLS = new Set();
  let E_TOTAL_LEN = 0;
  (function buildSmoothInfinityLut() {
    let prev = null;
    for (let i = 0; i <= E_SAMPLES; i++) {
      const t = (i / E_SAMPLES) * Math.PI * 2;
      const x = E_CX + E_RX * Math.sin(t);
      const y = E_CY + E_RY * Math.sin(2 * t);
      if (prev) E_TOTAL_LEN += Math.hypot(x - prev.x, y - prev.y);
      E_CURVE.push({ x, y, s: E_TOTAL_LEN });
      const tc = Math.floor(x / T_SIZE);
      const tr = Math.floor(y / T_SIZE);
      if (tc >= 0 && tc < E_COLS && tr >= 0 && tr < E_ROWS) {
        E_PATH_CELLS.add(tc + ',' + tr);
      }
      prev = { x, y };
    }
  })();

  function sampleLemniscate(dist) {
    let s = dist % E_TOTAL_LEN;
    if (s < 0) s += E_TOTAL_LEN;
    let lo = 0, hi = E_SAMPLES;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if (E_CURVE[mid].s <= s) lo = mid;
      else hi = mid;
    }
    const p0 = E_CURVE[lo], p1 = E_CURVE[hi];
    const seg = Math.max(0.0001, p1.s - p0.s);
    const u = (s - p0.s) / seg;
    return {
      x: p0.x + (p1.x - p0.x) * u,
      y: p0.y + (p1.y - p0.y) * u,
      angle: Math.atan2(p1.y - p0.y, p1.x - p0.x)
    };
  }

  // Overdrive (Hardcore) state (7x4 = 490x280, strictly tile-aligned)
  const O_COLS = 7, O_ROWS = 4;
  const O_VIEW_W = O_COLS * T_SIZE;
  const O_VIEW_H = O_ROWS * T_SIZE;
  const O_WAYPOINTS = [
    { x: -0.2 * T_SIZE, y: 2.5 * T_SIZE },
    { x: 2.5 * T_SIZE,  y: 2.5 * T_SIZE },
    { x: 2.5 * T_SIZE,  y: 1.5 * T_SIZE },
    { x: 5.5 * T_SIZE,  y: 1.5 * T_SIZE }
  ];
  const O_PATH_CELLS = new Set([
    '0,2', '1,2', '2,2',
    '2,1', '3,1', '4,1', '5,1'
  ]);
  const O_BASE_X = 5.5 * T_SIZE;
  const O_BASE_Y = 1.5 * T_SIZE;

  let _gridCaches = { normal: null, endless: null, overdrive: null };
  let _gridCacheKeys = { normal: '', endless: '', overdrive: '' };

  let _waveTimer = 0;
  let _burstRemaining = 0;
  let _burstTimer = 0;
  let _endlessSpawnTimer = 0;
  let _endlessMobIdx = 0;
  let _odBreached = false;
  let _odBreachTimer = 0;
  let _odFlashTimer = 0;

  let previewEnemies = [];
  let previewProjectiles = [];
  let previewBolts = [];

  const normalTower = {
    type: 'gun', x: 2.5 * T_SIZE, y: 2.5 * T_SIZE,
    range: 155, fireRate: 0.48, damage: 16,
    angle: -Math.PI / 2, fireCooldown: 0.15, lastFire: -10, shotIndex: 0
  };

  const endlessTowers = [
    {
      type: 'gun', x: 3.5 * T_SIZE, y: 3.5 * T_SIZE,
      range: 245, fireRate: 0.42, damage: 16,
      angle: 0, fireCooldown: 0.15, lastFire: -10, shotIndex: 0
    },
    {
      type: 'tesla', x: 11.5 * T_SIZE, y: 3.5 * T_SIZE,
      range: 255, fireRate: 0.78, damage: 22,
      angle: Math.PI, fireCooldown: 0.30, lastFire: -10, shotIndex: 0
    }
  ];

  const odTower = {
    type: 'gun', x: 3.5 * T_SIZE, y: 2.5 * T_SIZE,
    range: 148, fireRate: 0.42, damage: 14,
    angle: Math.PI, fireCooldown: 0.15, lastFire: -10, shotIndex: 0
  };

  function traceNormalRails(tCtx) {
    const hr = 18, rIn = 18, rOut = 52;
    const p0 = N_WAYPOINTS[0], p1 = N_WAYPOINTS[1], p2 = N_WAYPOINTS[2], p3 = N_WAYPOINTS[3], p4 = N_WAYPOINTS[4];
    tCtx.beginPath();
    tCtx.moveTo(p0.x + hr, p0.y);
    tCtx.arcTo(p1.x + hr, p1.y - hr, p2.x - hr, p2.y - hr, rOut);
    tCtx.arcTo(p2.x - hr, p2.y - hr, p3.x - hr, p3.y + hr, rOut);
    tCtx.arcTo(p3.x - hr, p3.y + hr, p4.x, p4.y + hr, rOut);
    tCtx.lineTo(p4.x, p4.y + hr);
    tCtx.stroke();

    tCtx.beginPath();
    tCtx.moveTo(p0.x - hr, p0.y);
    tCtx.arcTo(p1.x - hr, p1.y + hr, p2.x + hr, p2.y + hr, rIn);
    tCtx.arcTo(p2.x + hr, p2.y + hr, p3.x + hr, p3.y - hr, rIn);
    tCtx.arcTo(p3.x + hr, p3.y - hr, p4.x, p4.y - hr, rIn);
    tCtx.lineTo(p4.x, p4.y - hr);
    tCtx.stroke();
  }

  function traceOverdriveRails(tCtx) {
    const hr = 18, rIn = 18, rOut = 48;
    const p0 = O_WAYPOINTS[0], p1 = O_WAYPOINTS[1], p2 = O_WAYPOINTS[2], p3 = O_WAYPOINTS[3];
    // Top rail (inside turn up at p1, outside turn right at p2)
    tCtx.beginPath();
    tCtx.moveTo(p0.x, p0.y - hr);
    tCtx.arcTo(p1.x - hr, p1.y - hr, p2.x - hr, p2.y - hr, rIn);
    tCtx.arcTo(p2.x - hr, p2.y - hr, p3.x, p3.y - hr, rOut);
    tCtx.lineTo(p3.x + 28, p3.y - hr);
    tCtx.stroke();
    // Bottom rail (outside turn up at p1, inside turn right at p2)
    tCtx.beginPath();
    tCtx.moveTo(p0.x, p0.y + hr);
    tCtx.arcTo(p1.x + hr, p1.y + hr, p2.x + hr, p2.y + hr, rOut);
    tCtx.arcTo(p2.x + hr, p2.y + hr, p3.x, p3.y + hr, rIn);
    tCtx.lineTo(p3.x + 28, p3.y + hr);
    tCtx.stroke();
  }

  function traceEndlessRails(tCtx) {
    tCtx.beginPath();
    tCtx.moveTo(E_CURVE[0].x, E_CURVE[0].y);
    for (let i = 1; i <= E_SAMPLES; i++) {
      tCtx.lineTo(E_CURVE[i].x, E_CURVE[i].y);
    }
    tCtx.closePath();
    tCtx.stroke();
  }

  function buildNormalGridCache(th) {
    const c1Rgb = th.rgb1 ? th.rgb1.cssRgb : '0, 229, 255';
    const off = document.createElement('canvas');
    off.width = N_COLS * T_SIZE;
    off.height = N_ROWS * T_SIZE + 70;
    const oCtx = off.getContext('2d');

    for (let r = 0; r < N_ROWS; r++) {
      for (let c = 0; c < N_COLS; c++) {
        const isPath = N_PATH_CELLS.has(c + ',' + r);
        oCtx.fillStyle = isPath ? `rgba(${c1Rgb}, 0.08)` : 'rgba(8, 12, 26, 0.40)';
        oCtx.fillRect(c * T_SIZE, r * T_SIZE, T_SIZE, T_SIZE);
        oCtx.strokeStyle = isPath ? `rgba(${c1Rgb}, 0.18)` : `rgba(${c1Rgb}, 0.14)`;
        oCtx.lineWidth = 1;
        oCtx.strokeRect(c * T_SIZE, r * T_SIZE, T_SIZE, T_SIZE);
      }
    }

    oCtx.save();
    oCtx.strokeStyle = `rgba(${c1Rgb}, 0.34)`;
    oCtx.lineWidth = 1.6;
    oCtx.lineJoin = 'round';
    oCtx.lineCap = 'round';
    traceNormalRails(oCtx);
    oCtx.restore();

    const spawnX = 3.5 * T_SIZE, spawnY = 4.35 * T_SIZE, spawnAng = -Math.PI / 2;
    const offsets = [-14, 0, 14];
    for (let i = 0; i < 3; i++) {
      drawNeonChevron(oCtx, spawnX + Math.cos(spawnAng) * offsets[i], spawnY + Math.sin(spawnAng) * offsets[i], spawnAng, 13, th.c1 || '#00e5ff');
    }
    return off;
  }

  function buildEndlessGridCache() {
    const off = document.createElement('canvas');
    off.width = E_VIEW_W;
    off.height = E_VIEW_H;
    const oCtx = off.getContext('2d');

    for (let r = 0; r < E_ROWS; r++) {
      for (let c = 0; c < E_COLS; c++) {
        const isPath = E_PATH_CELLS.has(c + ',' + r);
        oCtx.fillStyle = isPath ? 'rgba(217, 70, 239, 0.10)' : 'rgba(12, 8, 28, 0.44)';
        oCtx.fillRect(c * T_SIZE, r * T_SIZE, T_SIZE, T_SIZE);
        oCtx.strokeStyle = isPath ? 'rgba(217, 70, 239, 0.24)' : 'rgba(217, 70, 239, 0.14)';
        oCtx.lineWidth = 1;
        oCtx.strokeRect(c * T_SIZE, r * T_SIZE, T_SIZE, T_SIZE);
      }
    }

    oCtx.save();
    oCtx.lineJoin = 'round';
    oCtx.lineCap = 'round';
    oCtx.strokeStyle = 'rgba(217, 70, 239, 0.40)';
    oCtx.lineWidth = 1.8;
    traceEndlessRails(oCtx);
    oCtx.restore();

    // Directional chevrons aligned strictly along the smooth ∞ curve
    const chevFracs = [0.125, 0.375, 0.625, 0.875];
    for (let i = 0; i < chevFracs.length; i++) {
      const pt = sampleLemniscate(chevFracs[i] * E_TOTAL_LEN);
      drawNeonChevron(oCtx, pt.x, pt.y, pt.angle, 12, '#d946ef');
    }
    return off;
  }

  function buildOverdriveGridCache() {
    const off = document.createElement('canvas');
    off.width = O_VIEW_W;
    off.height = O_VIEW_H;
    const oCtx = off.getContext('2d');

    for (let r = 0; r < O_ROWS; r++) {
      for (let c = 0; c < O_COLS; c++) {
        const isPath = O_PATH_CELLS.has(c + ',' + r);
        oCtx.fillStyle = isPath ? 'rgba(240, 95, 159, 0.09)' : 'rgba(18, 6, 16, 0.44)';
        oCtx.fillRect(c * T_SIZE, r * T_SIZE, T_SIZE, T_SIZE);
        oCtx.strokeStyle = isPath ? 'rgba(240, 95, 159, 0.24)' : 'rgba(240, 95, 159, 0.14)';
        oCtx.lineWidth = 1;
        oCtx.strokeRect(c * T_SIZE, r * T_SIZE, T_SIZE, T_SIZE);
      }
    }

    oCtx.save();
    oCtx.strokeStyle = 'rgba(240, 95, 159, 0.44)';
    oCtx.lineWidth = 1.8;
    oCtx.lineJoin = 'round';
    oCtx.lineCap = 'round';
    traceOverdriveRails(oCtx);
    oCtx.restore();

    // 3 base portal chevrons centered inside tile (c=5, r=1)
    const offsets = [-14, 0, 14];
    for (let i = 0; i < 3; i++) {
      drawNeonChevron(oCtx, O_BASE_X + offsets[i], O_BASE_Y, 0, 12, '#f05f9f');
    }
    return off;
  }

  function advanceAlongWaypoints(e, waypoints, dt) {
    let rem = e.speed * dt;
    while (rem > 0 && e.wpIndex < waypoints.length) {
      const target = waypoints[e.wpIndex];
      const dx = target.x - e.x;
      const dy = target.y - e.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= 0.001) {
        e.wpIndex++;
        continue;
      }
      e.angle = Math.atan2(dy, dx);
      if (rem >= dist) {
        e.x = target.x;
        e.y = target.y;
        rem -= dist;
        e.wpIndex++;
      } else {
        e.x += (dx / dist) * rem;
        e.y += (dy / dist) * rem;
        rem = 0;
      }
    }
  }

  function spawnNormalGrunt(initialDistOffset) {
    const cfg = (typeof ENEMY_CONFIGS !== 'undefined' && ENEMY_CONFIGS.grunt) ? ENEMY_CONFIGS.grunt : null;
    const e = {
      type: 'grunt',
      color: (cfg && cfg.color) || '#f05f9f',
      radius: 11,
      speed: 56,
      hp: 80,
      maxHp: 80,
      wpIndex: 1,
      x: N_WAYPOINTS[0].x,
      y: N_WAYPOINTS[0].y,
      angle: -Math.PI / 2,
      spawnTimer: (initialDistOffset && initialDistOffset > 0) ? 0 : 0.22,
      spawnDuration: 0.22,
      hitTilt: 0,
      _fxKbX: 0,
      _fxKbY: 0,
      _fxJitT: 0
    };
    if (initialDistOffset && initialDistOffset > 0) {
      advanceAlongWaypoints(e, N_WAYPOINTS, initialDistOffset / e.speed);
    }
    previewEnemies.push(e);
  }

  function spawnEndlessMob(distAlongCurve) {
    const types = ['grunt', 'scout', 'swarm'];
    const type = types[_endlessMobIdx % types.length];
    _endlessMobIdx++;
    const cfg = (typeof ENEMY_CONFIGS !== 'undefined' && ENEMY_CONFIGS[type]) ? ENEMY_CONFIGS[type] : null;
    const defCols = { grunt: '#f05f9f', scout: '#ff9100', swarm: '#00ffcc' };
    const defRads = { grunt: 13, scout: 12, swarm: 10 };
    const defSpds = { grunt: 84, scout: 108, swarm: 96 };
    const defHps  = { grunt: 54, scout: 38, swarm: 30 };

    const s = (distAlongCurve !== undefined) ? distAlongCurve : 0;
    const pt = sampleLemniscate(s);
    previewEnemies.push({
      type,
      color: (cfg && cfg.color) || defCols[type],
      radius: defRads[type],
      speed: defSpds[type],
      hp: defHps[type],
      maxHp: defHps[type],
      curveDist: s,
      x: pt.x,
      y: pt.y,
      angle: pt.angle,
      spawnTimer: 0.22,
      spawnDuration: 0.22,
      hitTilt: 0,
      _fxKbX: 0,
      _fxKbY: 0,
      _fxJitT: 0
    });
  }

  function spawnOverdriveTank() {
    const cfg = (typeof ENEMY_CONFIGS !== 'undefined' && ENEMY_CONFIGS.tank) ? ENEMY_CONFIGS.tank : null;
    previewEnemies = [{
      type: 'tank',
      color: (cfg && cfg.color) || '#a06fdc',
      radius: 15,
      isEnraged: true,
      speed: 64,
      hp: 260,
      maxHp: 260,
      wpIndex: 1,
      x: O_WAYPOINTS[0].x,
      y: O_WAYPOINTS[0].y,
      angle: 0,
      spawnTimer: 0.22,
      spawnDuration: 0.22,
      hitTilt: 0,
      _fxKbX: 0,
      _fxKbY: 0,
      _fxJitT: 0
    }];
  }

  function findTargetFor(tw) {
    const rSq = tw.range * tw.range;
    for (let i = 0; i < previewEnemies.length; i++) {
      const e = previewEnemies[i];
      const dx = e.x - tw.x;
      const dy = e.y - tw.y;
      if (dx * dx + dy * dy <= rSq) return e;
    }
    return null;
  }

  function stepGunTower(tw, dt) {
    const gunColor = (typeof TOWER_CONFIGS !== 'undefined' && TOWER_CONFIGS.gun && TOWER_CONFIGS.gun.color) || '#00e5ff';
    const target = findTargetFor(tw);
    if (tw.fireCooldown > 0) tw.fireCooldown = Math.max(0, tw.fireCooldown - dt);

    if (target) {
      const desired = Math.atan2(target.y - tw.y, target.x - tw.x);
      let diff = desired - tw.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const maxTurn = 12 * dt;
      if (Math.abs(diff) <= maxTurn) tw.angle = desired;
      else tw.angle += Math.sign(diff) * maxTurn;

      if (tw.fireCooldown <= 0 && Math.abs(diff) < 0.35) {
        tw.fireCooldown = tw.fireRate;
        tw.lastFire = _simTime;
        const cosA = Math.cos(tw.angle), sinA = Math.sin(tw.angle);
        const side = (tw.shotIndex === 0) ? -3.5 : 3.5;
        const mx = tw.x + cosA * 24 - sinA * side;
        const my = tw.y + sinA * 24 + cosA * side;
        tw.shotIndex = (tw.shotIndex + 1) % 2;

        if (typeof spawnFxMuzzleLayers === 'function') {
          spawnFxMuzzleLayers(mx, my, 'gun', gunColor, tw.angle);
        }
        previewProjectiles.push({
          x: mx, y: my, prevX: mx, prevY: my,
          target, speed: 460, damage: tw.damage, color: gunColor
        });
      }
    }
  }

  function stepTeslaTower(tw, dt) {
    const teslaColor = (typeof TOWER_CONFIGS !== 'undefined' && TOWER_CONFIGS.tesla && TOWER_CONFIGS.tesla.color) || '#00ffcc';
    if (tw.fireCooldown > 0) tw.fireCooldown = Math.max(0, tw.fireCooldown - dt);
    const first = findTargetFor(tw);
    if (!first || tw.fireCooldown > 0) return;

    tw.fireCooldown = tw.fireRate;
    tw.lastFire = _simTime;
    tw.angle = Math.atan2(first.y - tw.y, first.x - tw.x);

    const hitList = [first];
    let cur = first;
    for (let chain = 0; chain < 2; chain++) {
      let best = null, bestD = 115 * 115;
      for (let i = 0; i < previewEnemies.length; i++) {
        const cand = previewEnemies[i];
        if (hitList.indexOf(cand) !== -1) continue;
        const dx = cand.x - cur.x, dy = cand.y - cur.y;
        const dSq = dx * dx + dy * dy;
        if (dSq < bestD) { bestD = dSq; best = cand; }
      }
      if (!best) break;
      hitList.push(best);
      cur = best;
    }

    let prevX = tw.x, prevY = tw.y;
    for (let i = 0; i < hitList.length; i++) {
      const e = hitList[i];
      const ang = Math.atan2(e.y - prevY, e.x - prevX);
      previewBolts.push({ x1: prevX, y1: prevY, x2: e.x, y2: e.y, color: teslaColor, life: 0.22, maxLife: 0.22 });
      e.hp -= tw.damage;
      e.hitTilt = (Math.random() > 0.5 ? 1 : -1) * 0.14;
      e._fxJitT = 0.14;
      const killed = e.hp <= 0;
      if (typeof spawnFxHitLayers === 'function') {
        spawnFxHitLayers(e.x, e.y, killed ? 'mortar' : 'tesla', killed ? e.color : teslaColor, ang, e.radius);
      }
      if (killed) {
        const idx = previewEnemies.indexOf(e);
        if (idx !== -1) previewEnemies.splice(idx, 1);
        if (activeMode === 'endless' && previewEnemies.length < 10) {
          spawnEndlessMob((e.curveDist + E_TOTAL_LEN * 0.5) % E_TOTAL_LEN);
        }
      }
      prevX = e.x;
      prevY = e.y;
    }
  }

  function stepProjectiles(dt) {
    for (let i = previewProjectiles.length - 1; i >= 0; i--) {
      const p = previewProjectiles[i];
      p.prevX = p.x;
      p.prevY = p.y;
      if (!p.target || p.target.hp <= 0 || previewEnemies.indexOf(p.target) === -1) {
        previewProjectiles.splice(i, 1);
        continue;
      }
      const dx = p.target.x - p.x;
      const dy = p.target.y - p.y;
      const dist = Math.hypot(dx, dy);
      const stepDist = p.speed * dt;
      if (dist <= stepDist + p.target.radius * 0.7) {
        const hitAng = Math.atan2(dy, dx);
        p.target.hp -= p.damage;
        p.target.hitTilt = (Math.random() > 0.5 ? 1 : -1) * 0.14;
        p.target._fxKbX = Math.cos(hitAng) * 3.5;
        p.target._fxKbY = Math.sin(hitAng) * 3.5;
        p.target._fxJitT = 0.14;
        const killed = p.target.hp <= 0;
        if (typeof spawnFxHitLayers === 'function') {
          spawnFxHitLayers(p.target.x, p.target.y, killed ? 'mortar' : 'gun', killed ? p.target.color : p.color, hitAng, p.target.radius);
        }
        if (killed) {
          const deadDist = p.target.curveDist || 0;
          const idx = previewEnemies.indexOf(p.target);
          if (idx !== -1) previewEnemies.splice(idx, 1);
          if (activeMode === 'endless' && previewEnemies.length < 10) {
            spawnEndlessMob((deadDist + E_TOTAL_LEN * 0.5) % E_TOTAL_LEN);
          }
        }
        previewProjectiles.splice(i, 1);
      } else {
        p.x += (dx / dist) * stepDist;
        p.y += (dy / dist) * stepDist;
      }
    }
  }

  function step(dt) {
    _lastDt = dt;
    _simTime += dt;
    const kbDecay = Math.exp(-14 * dt);

    // Update lightning bolts
    for (let i = previewBolts.length - 1; i >= 0; i--) {
      previewBolts[i].life -= dt;
      if (previewBolts[i].life <= 0) previewBolts.splice(i, 1);
    }

    if (activeMode === 'normal') {
      _waveTimer -= dt;
      if (_waveTimer <= 0) {
        _waveTimer = 4.2;
        _burstRemaining = 3;
        _burstTimer = 0;
      }
      if (_burstRemaining > 0) {
        _burstTimer -= dt;
        if (_burstTimer <= 0) {
          spawnNormalGrunt(0);
          _burstRemaining--;
          _burstTimer = 0.65;
        }
      }
      for (let i = previewEnemies.length - 1; i >= 0; i--) {
        const e = previewEnemies[i];
        if (e.spawnTimer > 0) e.spawnTimer = Math.max(0, e.spawnTimer - dt);
        advanceAlongWaypoints(e, N_WAYPOINTS, dt);
        if (e._fxJitT > 0) e._fxJitT = Math.max(0, e._fxJitT - dt);
        e.hitTilt *= kbDecay;
        e._fxKbX *= kbDecay;
        e._fxKbY *= kbDecay;
        if (e.wpIndex >= N_WAYPOINTS.length) previewEnemies.splice(i, 1);
      }
      stepGunTower(normalTower, dt);
      stepProjectiles(dt);

    } else if (activeMode === 'endless') {
      _endlessSpawnTimer -= dt;
      if (_endlessSpawnTimer <= 0) {
        _endlessSpawnTimer = 0.75;
        if (previewEnemies.length < 16) {
          spawnEndlessMob(0);
        }
      }
      for (let i = 0; i < previewEnemies.length; i++) {
        const e = previewEnemies[i];
        if (e.spawnTimer > 0) e.spawnTimer = Math.max(0, e.spawnTimer - dt);
        e.curveDist = (e.curveDist + e.speed * dt) % E_TOTAL_LEN;
        const pt = sampleLemniscate(e.curveDist);
        e.x = pt.x;
        e.y = pt.y;
        e.angle = pt.angle;
        if (e._fxJitT > 0) e._fxJitT = Math.max(0, e._fxJitT - dt);
        e.hitTilt *= kbDecay;
        e._fxKbX *= kbDecay;
        e._fxKbY *= kbDecay;
      }
      stepGunTower(endlessTowers[0], dt);
      stepTeslaTower(endlessTowers[1], dt);
      stepProjectiles(dt);

    } else if (activeMode === 'overdrive') {
      if (_odFlashTimer > 0) {
        _odFlashTimer -= dt;
        if (_odFlashTimer <= 0) {
          const tint = document.getElementById('modePreviewTint');
          if (tint) tint.classList.remove('breach-flash');
        }
      }

      if (_odBreached) {
        _odBreachTimer -= dt;
        if (_odBreachTimer <= 0) {
          _odBreached = false;
          odTower.angle = Math.PI;
          odTower.fireCooldown = 0.15;
          spawnOverdriveTank();
        }
      } else {
        for (let i = previewEnemies.length - 1; i >= 0; i--) {
          const e = previewEnemies[i];
          if (e.spawnTimer > 0) e.spawnTimer = Math.max(0, e.spawnTimer - dt);
          advanceAlongWaypoints(e, O_WAYPOINTS, dt);
          if (e._fxJitT > 0) e._fxJitT = Math.max(0, e._fxJitT - dt);
          e.hitTilt *= kbDecay;
          e._fxKbX *= kbDecay;
          e._fxKbY *= kbDecay;
          if (e.wpIndex >= O_WAYPOINTS.length) {
            // Breach!
            if (typeof spawnEnemyBaseHitFx === 'function') {
              spawnEnemyBaseHitFx(O_BASE_X, O_BASE_Y, e);
            }
            previewEnemies.splice(i, 1);
            _odBreached = true;
            _odBreachTimer = 1.5;
            _odFlashTimer = 0.45;
            const tint = document.getElementById('modePreviewTint');
            if (tint) tint.classList.add('breach-flash');
          }
        }
        stepGunTower(odTower, dt);
      }
      stepProjectiles(dt);
    }
  }

  function renderOverdriveBaseShield(pCtx) {
    // Centered cleanly inside tile (c=6, r=1), strictly to the right of the portal chevrons in (c=5, r=1)
    const bx = 6.5 * T_SIZE;
    const by = O_BASE_Y;
    pCtx.save();
    if (_odBreached) {
      const pulse = 0.5 + 0.5 * Math.sin(_simTime * 14);
      const ringR = 24 + (1 - Math.max(0, _odBreachTimer / 1.5)) * 22;
      pCtx.beginPath();
      pCtx.arc(O_BASE_X, O_BASE_Y, ringR, 0, Math.PI * 2);
      pCtx.strokeStyle = `rgba(240, 95, 159, ${(0.85 * Math.max(0, _odBreachTimer / 1.5)).toFixed(2)})`;
      pCtx.lineWidth = 3;
      pCtx.stroke();

      pCtx.fillStyle = `rgba(240, 40, 90, ${(0.22 + 0.16 * pulse).toFixed(2)})`;
      pCtx.strokeStyle = '#ff2a85';
    } else {
      pCtx.fillStyle = 'rgba(240, 95, 159, 0.16)';
      pCtx.strokeStyle = '#f05f9f';
    }
    pCtx.lineWidth = 2;
    pCtx.beginPath();
    pCtx.roundRect ? pCtx.roundRect(bx - 28, by - 18, 56, 36, 10) : pCtx.rect(bx - 28, by - 18, 56, 36);
    pCtx.fill();
    pCtx.stroke();

    pCtx.fillStyle = _odBreached ? '#ff7aa8' : '#ffffff';
    pCtx.font = '800 16px Inter, sans-serif';
    pCtx.textAlign = 'center';
    pCtx.textBaseline = 'middle';
    pCtx.fillText(_odBreached ? '0 💔' : '1 ❤️', bx, by + 1);
    pCtx.restore();
  }

  function render(now) {
    const pCanvas = document.getElementById('modePreviewCanvas');
    if (!pCanvas) return;
    const rect = pCanvas.getBoundingClientRect();
    if (rect.width < 10 || rect.height < 10) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const pw = Math.round(rect.width * dpr);
    const ph = Math.round(rect.height * dpr);
    if (pCanvas.width !== pw || pCanvas.height !== ph) {
      pCanvas.width = pw;
      pCanvas.height = ph;
    }

    const pCtx = pCanvas.getContext('2d');
    const th = (typeof getTheme === 'function') ? getTheme() : { id: 'default', c1: '#00e5ff', rgb1: { cssRgb: '0, 229, 255' } };
    const palKey = th.id || 'default';
    const c1Rgb = th.rgb1 ? th.rgb1.cssRgb : '0, 229, 255';

    let viewXMin = 0, viewYMin = 0, viewW = E_VIEW_W, viewH = E_VIEW_H;
    let gridCache = null;

    if (activeMode === 'normal') {
      viewXMin = N_VIEW_X_MIN; viewYMin = N_VIEW_Y_MIN; viewW = N_VIEW_W; viewH = N_VIEW_H;
      if (!_gridCaches.normal || _gridCacheKeys.normal !== palKey) {
        _gridCaches.normal = buildNormalGridCache(th);
        _gridCacheKeys.normal = palKey;
      }
      gridCache = _gridCaches.normal;
    } else if (activeMode === 'endless') {
      viewXMin = 0; viewYMin = 0; viewW = E_VIEW_W; viewH = E_VIEW_H;
      if (!_gridCaches.endless) _gridCaches.endless = buildEndlessGridCache();
      gridCache = _gridCaches.endless;
    } else {
      viewXMin = 0; viewYMin = 0; viewW = O_VIEW_W; viewH = O_VIEW_H;
      if (!_gridCaches.overdrive) _gridCaches.overdrive = buildOverdriveGridCache();
      gridCache = _gridCaches.overdrive;
    }

    const previewScale = (activeMode === 'endless') ? Math.min(rect.width / (viewW + 24), rect.height / (viewH + 16)) : Math.max(rect.width / viewW, rect.height / viewH);
    const offsetX = (rect.width - viewW * previewScale) * 0.5 - viewXMin * previewScale;
    const offsetY = (rect.height - viewH * previewScale) * 0.5 - viewYMin * previewScale;

    pCtx.save();
    pCtx.scale(dpr, dpr);
    pCtx.clearRect(0, 0, rect.width, rect.height);
    pCtx.translate(offsetX, offsetY);
    pCtx.scale(previewScale, previewScale);

    // 1. Baked grid & track
    pCtx.drawImage(gridCache, 0, 0);

    // Animated dashed rails per mode
    pCtx.save();
    pCtx.lineCap = 'round';
    pCtx.lineJoin = 'round';
    if (activeMode === 'normal') {
      pCtx.strokeStyle = `rgba(${c1Rgb}, 0.85)`;
      pCtx.lineWidth = 1.8;
      pCtx.setLineDash([12, 10]);
      pCtx.lineDashOffset = -(_simTime * 36);
      traceNormalRails(pCtx);
    } else if (activeMode === 'endless') {
      pCtx.lineWidth = 2.6;
      pCtx.setLineDash([16, 14]);
      pCtx.strokeStyle = 'rgba(217, 70, 239, 0.85)';
      pCtx.lineDashOffset = -(_simTime * 48);
      traceEndlessRails(pCtx);

      pCtx.strokeStyle = 'rgba(0, 229, 255, 0.55)';
      pCtx.lineDashOffset = (_simTime * 48);
      traceEndlessRails(pCtx);
    } else {
      pCtx.strokeStyle = 'rgba(240, 95, 159, 0.85)';
      pCtx.lineWidth = 1.8;
      pCtx.setLineDash([12, 10]);
      pCtx.lineDashOffset = -(_simTime * 44);
      traceOverdriveRails(pCtx);
    }
    pCtx.restore();

    if (activeMode === 'overdrive') {
      renderOverdriveBaseShield(pCtx);
    }

    const towersToDraw = (activeMode === 'normal') ? [normalTower]
      : (activeMode === 'endless' ? endlessTowers : [odTower]);

    // Subtle range circles
    pCtx.save();
    pCtx.lineWidth = 1.2;
    pCtx.strokeStyle = (activeMode === 'endless') ? 'rgba(217, 70, 239, 0.16)'
      : (activeMode === 'overdrive' ? 'rgba(240, 95, 159, 0.16)' : `rgba(${c1Rgb}, 0.14)`);
    for (let i = 0; i < towersToDraw.length; i++) {
      const tw = towersToDraw[i];
      pCtx.beginPath();
      pCtx.arc(tw.x, tw.y, tw.range, 0, Math.PI * 2);
      pCtx.stroke();
    }
    pCtx.restore();

    // 2 & 3. Render towers, enemies, lightning bolts & combat FX via temporary ctx/camZoom swap
    const prevCtx = ctx;
    const prevZoom = (typeof camZoom !== 'undefined') ? camZoom : 1;
    try {
      ctx = pCtx;
      if (typeof camZoom !== 'undefined') camZoom = previewScale;

      if (typeof drawTowerModel === 'function') {
        for (let i = 0; i < towersToDraw.length; i++) {
          const tw = towersToDraw[i];
          const tCfg = (typeof TOWER_CONFIGS !== 'undefined' && TOWER_CONFIGS[tw.type]) ? TOWER_CONFIGS[tw.type] : null;
          const col = (tCfg && tCfg.color) || (tw.type === 'tesla' ? '#00ffcc' : '#00e5ff');
          const glow = (tCfg && tCfg.glow) || col;
          const target = findTargetFor(tw);
          const isTeslaShooting = (tw.type === 'tesla' && previewBolts.length > 0);
          pCtx.save();
          pCtx.translate(tw.x, tw.y);
          drawTowerModel(tw.type, tw.angle, col, 1, glow, false, false, isTeslaShooting, 0, {
            x: tw.x, y: tw.y, target, time: _simTime, lastFire: tw.lastFire, shotIndex: tw.shotIndex
          });
          pCtx.restore();
        }
      }

      for (let i = 0; i < previewEnemies.length; i++) {
        const e = previewEnemies[i];
        const jitX = e._fxJitT > 0 ? (Math.sin(_simTime * 80 + i) * 1.4) : 0;
        const jitY = e._fxJitT > 0 ? (Math.cos(_simTime * 75 + i) * 1.4) : 0;
        const renderEnemy = Object.assign({}, e, {
          x: e.x + (e._fxKbX || 0) + jitX,
          y: e.y + (e._fxKbY || 0) + jitY
        });
        if (typeof renderConfiguredEnemyModel === 'function') {
          renderConfiguredEnemyModel(renderEnemy, false);
        } else {
          pCtx.beginPath();
          pCtx.arc(renderEnemy.x, renderEnemy.y, renderEnemy.radius, 0, Math.PI * 2);
          pCtx.fillStyle = renderEnemy.color;
          pCtx.fill();
        }
      }

      if (typeof drawJaggedLightning === 'function') {
        for (let i = 0; i < previewBolts.length; i++) {
          const b = previewBolts[i];
          const a = Math.max(0, b.life / b.maxLife);
          drawJaggedLightning(b.x1, b.y1, b.x2, b.y2, b.color, a, 1.0);
        }
      }

      if (typeof updateAndDrawFxLayers === 'function') {
        updateAndDrawFxLayers(_lastDt, _simTime);
      }
    } finally {
      ctx = prevCtx;
      if (typeof camZoom !== 'undefined') camZoom = prevZoom;
    }

    // 4. Bullets with gradient tracers
    pCtx.save();
    pCtx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < previewProjectiles.length; i++) {
      const p = previewProjectiles[i];
      const ang = Math.atan2(p.y - p.prevY, p.x - p.prevX);
      const tailX = p.x - Math.cos(ang) * 16;
      const tailY = p.y - Math.sin(ang) * 16;
      const tg = pCtx.createLinearGradient(tailX, tailY, p.x, p.y);
      tg.addColorStop(0, 'rgba(0, 229, 255, 0)');
      tg.addColorStop(1, p.color);
      pCtx.strokeStyle = tg;
      pCtx.lineWidth = 3;
      pCtx.lineCap = 'round';
      pCtx.beginPath();
      pCtx.moveTo(tailX, tailY);
      pCtx.lineTo(p.x, p.y);
      pCtx.stroke();

      pCtx.fillStyle = '#ffffff';
      pCtx.beginPath();
      pCtx.arc(p.x, p.y, 2.2, 0, Math.PI * 2);
      pCtx.fill();
    }
    pCtx.restore();
    pCtx.restore();
  }

  function tick(now) {
    const lvlSc = document.getElementById('levelsScreen');
    if (!lvlSc || lvlSc.classList.contains('hidden') || (typeof gameState !== 'undefined' && gameState === 'PLAYING')) {
      stop();
      return;
    }
    if (!_lastTs) _lastTs = now;
    const dt = Math.min(0.05, Math.max(0.001, (now - _lastTs) / 1000));
    _lastTs = now;
    try {
      step(dt);
      render(now);
    } catch (_e) {}
    _rafId = requestAnimationFrame(tick);
  }

  function isActive() {
    return _rafId !== null;
  }

  function initScenario(mode) {
    previewEnemies = [];
    previewProjectiles = [];
    previewBolts = [];
    if (typeof clearFxLayerState === 'function') clearFxLayerState();
    const tint = document.getElementById('modePreviewTint');
    if (tint) tint.classList.remove('breach-flash');

    _lastTs = 0;
    _lastDt = 0.016;
    _simTime = 0;

    if (mode === 'normal') {
      _waveTimer = 2.4;
      _burstRemaining = 0;
      _burstTimer = 0;
      normalTower.angle = -Math.PI / 2;
      normalTower.fireCooldown = 0.1;
      normalTower.lastFire = -10;
      normalTower.shotIndex = 0;
      spawnNormalGrunt(240);
      spawnNormalGrunt(200);
      spawnNormalGrunt(160);
    } else if (mode === 'endless') {
      _endlessSpawnTimer = 0.75;
      _endlessMobIdx = 0;
      endlessTowers[0].angle = 0;
      endlessTowers[0].fireCooldown = 0.15;
      endlessTowers[0].lastFire = -10;
      endlessTowers[1].angle = Math.PI;
      endlessTowers[1].fireCooldown = 0.30;
      endlessTowers[1].lastFire = -10;
      for (let i = 0; i < 14; i++) {
        spawnEndlessMob((i / 14) * E_TOTAL_LEN);
      }
    } else if (mode === 'overdrive') {
      _odBreached = false;
      _odBreachTimer = 0;
      _odFlashTimer = 0;
      odTower.angle = Math.PI;
      odTower.fireCooldown = 0.15;
      odTower.lastFire = -10;
      odTower.shotIndex = 0;
      spawnOverdriveTank();
    }
  }

  function start(mode) {
    const targetMode = (mode === 'endless' || mode === 'overdrive') ? mode : 'normal';
    if (_rafId !== null && activeMode === targetMode) return;
    activeMode = targetMode;
    initScenario(activeMode);
    if (_rafId === null) {
      _rafId = requestAnimationFrame(tick);
    }
  }

  function stop() {
    if (_rafId !== null) {
      cancelAnimationFrame(_rafId);
      _rafId = null;
    }
    previewEnemies = [];
    previewProjectiles = [];
    previewBolts = [];
    if (typeof clearFxLayerState === 'function') clearFxLayerState();
    const tint = document.getElementById('modePreviewTint');
    if (tint) tint.classList.remove('breach-flash');
  }

  return { start, stop, isActive };
})();

function startModeBattlePreview(mode) { ModeBattlePreview.start(mode); }
function stopModeBattlePreview() { ModeBattlePreview.stop(); }
function startNormalModePreview() { ModeBattlePreview.start('normal'); }
function stopNormalModePreview() { ModeBattlePreview.stop(); }

// [UI.FU]
function buildTowerFiringDemoHtml(type) {
  const conf = (typeof TOWER_CONFIGS !== 'undefined' && TOWER_CONFIGS[type]) ? TOWER_CONFIGS[type] : { color: '#00e5ff' };
  const col = conf.color || '#00e5ff';
  return `
    <div class="ms-firing-stage" style="--stage-col:${col};">
      <canvas id="milestoneTowerPreviewCanvas"></canvas>
      <div class="ms-firing-dimmer"></div>
    </div>`;
}

// [UI.FUM] Autonomous real-renderer showcase for all 7 tower classes on #milestoneScreen.
const MilestoneTowerPreview = (() => {
  const COLS_M = 6;
  const ROWS_M = 3;
  const T_SIZE = 70;
  const VIEW_W = COLS_M * T_SIZE; // 420
  const VIEW_H = ROWS_M * T_SIZE; // 210

  let _type = 'gun';
  let _rafId = null;
  let _lastTs = 0;
  let _lastDt = 0.016;
  let _simTime = 0;

  let _gridCaches = {};
  let _enemies = [];
  let _projectiles = [];
  let _bolts = [];
  let _railBeams = [];
  let _stasisWaves = [];
  let _steamPuffs = [];
  let _fxParts = [];
  let _fxWaves = [];

  let _spawnTimer = 0;
  let _beamHitTimer = 0;

  const _tower = {
    type: 'gun',
    x: 2.5 * T_SIZE,
    y: 1.5 * T_SIZE,
    range: 165,
    angle: Math.PI * 0.5,
    fireCooldown: 0.25,
    lastFire: -10,
    shotIndex: 0,
    heatProgress: 0,
    isCooling: false,
    coolTimer: 0,
    steamTimer: 0
  };

  function withIsolatedFx(fn) {
    const prevParts = fxLayerParts;
    const prevWaves = fxLayerWaves;
    fxLayerParts = _fxParts;
    fxLayerWaves = _fxWaves;
    try {
      fn();
    } finally {
      fxLayerParts = prevParts;
      fxLayerWaves = prevWaves;
    }
  }

  function buildGridCache(isRail, th) {
    const c1Rgb = th.rgb1 ? th.rgb1.cssRgb : '0, 229, 255';
    const off = document.createElement('canvas');
    off.width = VIEW_W;
    off.height = VIEW_H;
    const oCtx = off.getContext('2d');

    const pathRow = isRail ? 1 : 2;
    for (let r = 0; r < ROWS_M; r++) {
      for (let c = 0; c < COLS_M; c++) {
        const isPath = (r === pathRow) && (!isRail || c >= 1);
        oCtx.fillStyle = isPath ? `rgba(${c1Rgb}, 0.08)` : 'rgba(8, 12, 26, 0.42)';
        oCtx.fillRect(c * T_SIZE, r * T_SIZE, T_SIZE, T_SIZE);
        oCtx.strokeStyle = isPath ? `rgba(${c1Rgb}, 0.20)` : `rgba(${c1Rgb}, 0.13)`;
        oCtx.lineWidth = 1;
        oCtx.strokeRect(c * T_SIZE, r * T_SIZE, T_SIZE, T_SIZE);
      }
    }

    const py = (pathRow + 0.5) * T_SIZE;
    const hr = 18;
    const xStart = isRail ? 1.35 * T_SIZE : 0;
    oCtx.save();
    oCtx.strokeStyle = `rgba(${c1Rgb}, 0.36)`;
    oCtx.lineWidth = 1.6;
    oCtx.beginPath();
    oCtx.moveTo(xStart, py - hr); oCtx.lineTo(VIEW_W, py - hr);
    oCtx.moveTo(xStart, py + hr); oCtx.lineTo(VIEW_W, py + hr);
    oCtx.stroke();
    oCtx.restore();

    const chevCol = th.c1 || '#00e5ff';
    if (isRail) {
      for (let i = 0; i < 3; i++) {
        drawNeonChevron(oCtx, VIEW_W - 22 - i * 13, py, Math.PI, 10, chevCol);
      }
    } else {
      for (let i = 0; i < 3; i++) {
        drawNeonChevron(oCtx, 18 + i * 13, py, 0, 10, chevCol);
      }
    }
    return off;
  }

  function makeEnemy(eType, x, y, hp, speed, radius, dirX) {
    const cfg = (typeof ENEMY_CONFIGS !== 'undefined' && ENEMY_CONFIGS[eType]) ? ENEMY_CONFIGS[eType] : null;
    const defCols = { grunt: '#f05f9f', scout: '#ff9100', tank: '#a06fdc', swarm: '#00ffcc' };
    return {
      type: eType,
      color: (cfg && cfg.color) || defCols[eType] || '#f05f9f',
      radius: radius || 11,
      speed: speed || 54,
      hp: hp,
      maxHp: hp,
      x: x,
      y: y,
      dirX: dirX || 1,
      angle: (dirX || 1) >= 0 ? 0 : Math.PI,
      spawnTimer: 0.20,
      spawnDuration: 0.20,
      slowTimer: 0,
      slowFactor: 1.0,
      hitTilt: 0,
      _fxKbX: 0,
      _fxKbY: 0,
      _fxJitT: 0
    };
  }

  function spawnScenarioWave(initial) {
    const py = (_type === 'railgun') ? (1.5 * T_SIZE) : (2.5 * T_SIZE);
    if (_type === 'gun') {
      const base = initial ? 95 : -16;
      _enemies.push(makeEnemy('grunt', base, py, 56, 56, 11, 1));
      if (initial) _enemies.push(makeEnemy('grunt', base - 58, py, 56, 56, 11, 1));
    } else if (_type === 'laser') {
      const base = initial ? 105 : -16;
      const t = (Math.random() > 0.45) ? 'grunt' : 'scout';
      _enemies.push(makeEnemy(t, base, py, t === 'grunt' ? 70 : 48, t === 'grunt' ? 54 : 74, t === 'grunt' ? 11 : 10, 1));
    } else if (_type === 'mortar') {
      const base = initial ? 115 : -16;
      _enemies.push(makeEnemy('grunt', base,      py - 4, 64, 48, 11, 1));
      _enemies.push(makeEnemy('swarm', base - 22, py + 7, 36, 48, 8,  1));
      _enemies.push(makeEnemy('swarm', base - 38, py - 6, 36, 48, 8,  1));
      _enemies.push(makeEnemy('grunt', base - 56, py + 2, 64, 48, 11, 1));
    } else if (_type === 'tesla') {
      const base = initial ? 120 : -16;
      _enemies.push(makeEnemy('scout', base,      py - 3, 52, 60, 10, 1));
      _enemies.push(makeEnemy('swarm', base - 30, py + 6, 40, 60, 8,  1));
      _enemies.push(makeEnemy('swarm', base - 58, py - 5, 40, 60, 8,  1));
      _enemies.push(makeEnemy('scout', base - 86, py + 3, 52, 60, 10, 1));
    } else if (_type === 'stasis') {
      const base = initial ? 90 : -16;
      _enemies.push(makeEnemy('scout', base, py, 999, 102, 10, 1));
      if (initial) _enemies.push(makeEnemy('scout', base - 72, py, 999, 102, 10, 1));
    } else if (_type === 'melter') {
      if (_enemies.length === 0) {
        _enemies.push(makeEnemy('tank', initial ? 78 : -20, py, 420, 32, 15, 1));
      }
    } else if (_type === 'railgun') {
      const base = initial ? 310 : VIEW_W + 18;
      _enemies.push(makeEnemy('grunt', base,      py, 75, 42, 11, -1));
      _enemies.push(makeEnemy('grunt', base + 56, py, 75, 42, 11, -1));
      _enemies.push(makeEnemy('tank',  base + 114, py, 140, 42, 14, -1));
    }
  }

  function findTarget() {
    const rSq = _tower.range * _tower.range;
    for (let i = 0; i < _enemies.length; i++) {
      const e = _enemies[i];
      const dx = e.x - _tower.x, dy = e.y - _tower.y;
      if (dx * dx + dy * dy <= rSq) return e;
    }
    return null;
  }

  function damageEnemy(e, dmg, hitAng, fxKind, fxCol, kbMag) {
    e.hp -= dmg;
    e.hitTilt = (Math.random() > 0.5 ? 1 : -1) * 0.15;
    e._fxKbX = Math.cos(hitAng) * (kbMag || 3.5);
    e._fxKbY = Math.sin(hitAng) * (kbMag || 3.5);
    e._fxJitT = 0.14;
    const killed = e.hp <= 0;
    if (typeof spawnFxHitLayers === 'function') {
      withIsolatedFx(() => {
        spawnFxHitLayers(e.x, e.y, killed ? 'mortar' : fxKind, killed ? e.color : fxCol, hitAng, e.radius);
      });
    }
    if (killed) {
      const idx = _enemies.indexOf(e);
      if (idx !== -1) _enemies.splice(idx, 1);
    }
  }

  function step(dt) {
    _lastDt = dt;
    _simTime += dt;
    const kbDecay = Math.exp(-14 * dt);

    // Spawn waves
    _spawnTimer -= dt;
    if (_spawnTimer <= 0) {
      if (_type === 'gun') _spawnTimer = 1.45;
      else if (_type === 'laser') _spawnTimer = 1.65;
      else if (_type === 'mortar') _spawnTimer = 3.2;
      else if (_type === 'tesla') _spawnTimer = 2.8;
      else if (_type === 'stasis') _spawnTimer = 1.75;
      else if (_type === 'melter') _spawnTimer = 1.2;
      else if (_type === 'railgun') _spawnTimer = 3.1;
      spawnScenarioWave(false);
    }

    // Move enemies
    for (let i = _enemies.length - 1; i >= 0; i--) {
      const e = _enemies[i];
      if (e.spawnTimer > 0) e.spawnTimer = Math.max(0, e.spawnTimer - dt);
      if (e.slowTimer > 0) {
        e.slowTimer = Math.max(0, e.slowTimer - dt);
        if (e.slowTimer <= 0) e.slowFactor = 1.0;
      }
      const effSpeed = e.speed * (e.slowTimer > 0 ? e.slowFactor : 1.0);
      e.x += e.dirX * effSpeed * dt;
      if (e._fxJitT > 0) e._fxJitT = Math.max(0, e._fxJitT - dt);
      e.hitTilt *= kbDecay;
      e._fxKbX *= kbDecay;
      e._fxKbY *= kbDecay;

      const outRight = (e.dirX > 0 && e.x > VIEW_W + 28);
      const outLeft = (e.dirX < 0 && e.x < 1.35 * T_SIZE);
      if (outRight || outLeft) _enemies.splice(i, 1);
    }

    // Update bolts, rail beams, stasis waves, steam puffs
    for (let i = _bolts.length - 1; i >= 0; i--) {
      _bolts[i].life -= dt;
      if (_bolts[i].life <= 0) _bolts.splice(i, 1);
    }
    for (let i = _railBeams.length - 1; i >= 0; i--) {
      _railBeams[i].life -= dt;
      if (_railBeams[i].life <= 0) _railBeams.splice(i, 1);
    }
    for (let i = _stasisWaves.length - 1; i >= 0; i--) {
      const sw = _stasisWaves[i];
      sw.life -= dt;
      sw.r = sw.maxR * (1 - sw.life / sw.maxLife);
      if (sw.life <= 0) _stasisWaves.splice(i, 1);
    }
    for (let i = _steamPuffs.length - 1; i >= 0; i--) {
      const sp = _steamPuffs[i];
      sp.life -= dt;
      sp.x += sp.vx * dt;
      sp.y += sp.vy * dt;
      sp.r += 10 * dt;
      if (sp.life <= 0) _steamPuffs.splice(i, 1);
    }

    const tCfg = (typeof TOWER_CONFIGS !== 'undefined' && TOWER_CONFIGS[_type]) ? TOWER_CONFIGS[_type] : null;
    const tCol = (tCfg && tCfg.color) || '#00e5ff';
    const target = findTarget();

    if (_tower.fireCooldown > 0) _tower.fireCooldown = Math.max(0, _tower.fireCooldown - dt);

    // Aim tower
    if (target && _type !== 'stasis' && _type !== 'railgun') {
      const desired = Math.atan2(target.y - _tower.y, target.x - _tower.x);
      let diff = desired - _tower.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const maxTurn = 11 * dt;
      _tower.angle += Math.abs(diff) <= maxTurn ? diff : Math.sign(diff) * maxTurn;
    }

    // Per-tower firing logic
    if (_type === 'gun' && target && _tower.fireCooldown <= 0) {
      _tower.fireCooldown = 0.34;
      _tower.lastFire = _simTime;
      const cosA = Math.cos(_tower.angle), sinA = Math.sin(_tower.angle);
      const side = (_tower.shotIndex === 0) ? -3.5 : 3.5;
      const mx = _tower.x + cosA * 24 - sinA * side;
      const my = _tower.y + sinA * 24 + cosA * side;
      _tower.shotIndex = (_tower.shotIndex + 1) % 2;
      if (typeof spawnFxMuzzleLayers === 'function') {
        withIsolatedFx(() => spawnFxMuzzleLayers(mx, my, 'gun', tCol, _tower.angle));
      }
      _projectiles.push({ kind: 'bullet', x: mx, y: my, target, speed: 460, damage: 18, color: tCol });

    } else if (_type === 'laser' && target) {
      target.hp -= 30 * dt;
      target._fxJitT = 0.10;
      _beamHitTimer -= dt;
      if (_beamHitTimer <= 0) {
        _beamHitTimer = 0.10;
        const ang = Math.atan2(target.y - _tower.y, target.x - _tower.x);
        if (typeof spawnFxHitLayers === 'function') {
          withIsolatedFx(() => spawnFxHitLayers(target.x, target.y, 'laser', tCol, ang, target.radius));
        }
      }
      if (target.hp <= 0) {
        const ang = Math.atan2(target.y - _tower.y, target.x - _tower.x);
        damageEnemy(target, 1, ang, 'laser', tCol, 2.0);
      }

    } else if (_type === 'mortar' && target && _tower.fireCooldown <= 0) {
      _tower.fireCooldown = 1.55;
      _tower.lastFire = _simTime;
      const mx = _tower.x + Math.cos(_tower.angle) * 14;
      const my = _tower.y + Math.sin(_tower.angle) * 14;
      if (typeof spawnFxMuzzleLayers === 'function') {
        withIsolatedFx(() => spawnFxMuzzleLayers(mx, my, 'mortar', tCol, _tower.angle));
      }
      const leadX = Math.min(VIEW_W - 24, target.x + target.speed * 0.45);
      _projectiles.push({
        kind: 'mortar', startX: mx, startY: my, x: mx, y: my,
        tx: leadX, ty: target.y, t: 0, dur: 0.56, splashR: 72, damage: 46, color: tCol
      });

    } else if (_type === 'tesla' && target && _tower.fireCooldown <= 0) {
      _tower.fireCooldown = 0.95;
      _tower.lastFire = _simTime;
      const hitList = [target];
      let cur = target;
      for (let chain = 0; chain < 2; chain++) {
        let best = null, bestD = 120 * 120;
        for (let i = 0; i < _enemies.length; i++) {
          const cand = _enemies[i];
          if (hitList.indexOf(cand) !== -1) continue;
          const dSq = (cand.x - cur.x) ** 2 + (cand.y - cur.y) ** 2;
          if (dSq < bestD) { bestD = dSq; best = cand; }
        }
        if (!best) break;
        hitList.push(best);
        cur = best;
      }
      let px = _tower.x, py = _tower.y;
      for (let i = 0; i < hitList.length; i++) {
        const e = hitList[i];
        const ang = Math.atan2(e.y - py, e.x - px);
        _bolts.push({ x1: px, y1: py, x2: e.x, y2: e.y, color: tCol, life: 0.24, maxLife: 0.24 });
        damageEnemy(e, 24, ang, 'tesla', tCol, 2.5);
        px = e.x; py = e.y;
      }

    } else if (_type === 'stasis' && target && _tower.fireCooldown <= 0) {
      _tower.fireCooldown = 1.25;
      _tower.lastFire = _simTime;
      _stasisWaves.push({ x: _tower.x, y: _tower.y, r: 10, maxR: _tower.range, life: 0.45, maxLife: 0.45, color: tCol });
      const rSq = _tower.range * _tower.range;
      for (let i = 0; i < _enemies.length; i++) {
        const e = _enemies[i];
        const dx = e.x - _tower.x, dy = e.y - _tower.y;
        if (dx * dx + dy * dy <= rSq) {
          e.slowTimer = 1.65;
          e.slowFactor = 0.40;
          if (typeof spawnFxHitLayers === 'function') {
            withIsolatedFx(() => spawnFxHitLayers(e.x, e.y, 'stasis', tCol, Math.atan2(dy, dx), e.radius));
          }
        }
      }

    } else if (_type === 'melter') {
      if (_tower.isCooling) {
        _tower.coolTimer = Math.max(0, _tower.coolTimer - dt);
        _tower.heatProgress = _tower.coolTimer / 2.2;
        _tower.steamTimer -= dt;
        if (_tower.steamTimer <= 0) {
          _tower.steamTimer = 0.14;
          _steamPuffs.push({
            x: _tower.x + (Math.random() - 0.5) * 14,
            y: _tower.y - 6,
            vx: (Math.random() - 0.5) * 14,
            vy: -22 - Math.random() * 14,
            r: 4 + Math.random() * 3,
            life: 0.65, maxLife: 0.65
          });
        }
        if (_tower.coolTimer <= 0) {
          _tower.isCooling = false;
          _tower.heatProgress = 0;
        }
      } else if (target) {
        _tower.heatProgress = Math.min(1, _tower.heatProgress + dt / 3.0);
        const dps = 18 + 85 * (_tower.heatProgress * _tower.heatProgress);
        target.hp = Math.max(25, target.hp - dps * dt);
        target._fxJitT = 0.10;
        _beamHitTimer -= dt;
        if (_beamHitTimer <= 0) {
          _beamHitTimer = 0.10;
          const ang = Math.atan2(target.y - _tower.y, target.x - _tower.x);
          if (typeof spawnFxHitLayers === 'function') {
            withIsolatedFx(() => spawnFxHitLayers(target.x, target.y, 'melter', tCol, ang, target.radius));
          }
        }
        if (_tower.heatProgress >= 1.0) {
          _tower.isCooling = true;
          _tower.coolTimer = 2.2;
          _tower.steamTimer = 0;
        }
      } else {
        _tower.heatProgress = Math.max(0, _tower.heatProgress - dt * 0.6);
      }

    } else if (_type === 'railgun' && _enemies.length > 0 && _tower.fireCooldown <= 0) {
      // Wait until at least one mob is well inside the track
      const ready = _enemies.some(e => e.x < VIEW_W - 60);
      if (ready) {
        _tower.fireCooldown = 1.85;
        _tower.lastFire = _simTime;
        const mx = _tower.x + 24;
        const my = _tower.y;
        if (typeof spawnFxMuzzleLayers === 'function') {
          withIsolatedFx(() => spawnFxMuzzleLayers(mx, my, 'railgun', tCol, 0));
        }
        _railBeams.push({ x1: mx, y1: my, x2: VIEW_W + 10, y2: my, color: tCol, life: 0.38, maxLife: 0.38 });
        const snap = _enemies.slice();
        for (let i = 0; i < snap.length; i++) {
          damageEnemy(snap[i], 76, 0, 'railgun', tCol, 8.5);
        }
      }
    }

    // Step projectiles (gun bullets & mortar shells)
    for (let i = _projectiles.length - 1; i >= 0; i--) {
      const p = _projectiles[i];
      if (p.kind === 'bullet') {
        if (!p.target || p.target.hp <= 0 || _enemies.indexOf(p.target) === -1) {
          _projectiles.splice(i, 1);
          continue;
        }
        const dx = p.target.x - p.x, dy = p.target.y - p.y;
        const dist = Math.hypot(dx, dy);
        const stepD = p.speed * dt;
        if (dist <= stepD + p.target.radius * 0.7) {
          damageEnemy(p.target, p.damage, Math.atan2(dy, dx), 'gun', p.color, 3.5);
          _projectiles.splice(i, 1);
        } else {
          p.x += (dx / dist) * stepD;
          p.y += (dy / dist) * stepD;
        }
      } else if (p.kind === 'mortar') {
        p.t += dt / p.dur;
        const u = Math.min(1, p.t);
        p.x = p.startX + (p.tx - p.startX) * u;
        p.y = p.startY + (p.ty - p.startY) * u;
        p.arcY = p.y - Math.sin(u * Math.PI) * 52;
        if (p.t >= 1) {
          if (typeof spawnFxHitLayers === 'function') {
            withIsolatedFx(() => spawnFxHitLayers(p.tx, p.ty, 'mortar', p.color, null, 14));
          }
          const snap = _enemies.slice();
          for (let j = 0; j < snap.length; j++) {
            const e = snap[j];
            const d = Math.hypot(e.x - p.tx, e.y - p.ty);
            if (d <= p.splashR) {
              damageEnemy(e, p.damage, Math.atan2(e.y - p.ty, e.x - p.tx), 'mortar', p.color, 4.5);
            }
          }
          _projectiles.splice(i, 1);
        }
      }
    }
  }

  function render(now) {
    const pCanvas = document.getElementById('milestoneTowerPreviewCanvas');
    if (!pCanvas) return;
    const rect = pCanvas.getBoundingClientRect();
    if (rect.width < 10 || rect.height < 10) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const pw = Math.round(rect.width * dpr);
    const ph = Math.round(rect.height * dpr);
    if (pCanvas.width !== pw || pCanvas.height !== ph) {
      pCanvas.width = pw;
      pCanvas.height = ph;
    }

    const pCtx = pCanvas.getContext('2d');
    const th = (typeof getTheme === 'function') ? getTheme() : { id: 'default', c1: '#00e5ff', rgb1: { cssRgb: '0, 229, 255' } };
    const isRail = (_type === 'railgun');
    const cacheKey = (isRail ? 'rail_' : 'std_') + (th.id || 'default');
    if (!_gridCaches[cacheKey]) {
      _gridCaches[cacheKey] = buildGridCache(isRail, th);
    }

    const c1Rgb = th.rgb1 ? th.rgb1.cssRgb : '0, 229, 255';
    const previewScale = Math.max(rect.width / VIEW_W, rect.height / VIEW_H);
    const offsetX = (rect.width - VIEW_W * previewScale) * 0.5;
    const offsetY = (rect.height - VIEW_H * previewScale) * 0.5;

    pCtx.save();
    pCtx.scale(dpr, dpr);
    pCtx.clearRect(0, 0, rect.width, rect.height);
    pCtx.translate(offsetX, offsetY);
    pCtx.scale(previewScale, previewScale);

    // 1. Baked grid & rails
    pCtx.drawImage(_gridCaches[cacheKey], 0, 0);

    // Running dashed rails
    const pathRow = isRail ? 1 : 2;
    const py = (pathRow + 0.5) * T_SIZE;
    const hr = 18;
    const xStart = isRail ? 1.35 * T_SIZE : 0;
    pCtx.save();
    pCtx.strokeStyle = `rgba(${c1Rgb}, 0.80)`;
    pCtx.lineWidth = 1.6;
    pCtx.setLineDash([12, 10]);
    pCtx.lineDashOffset = (isRail ? 1 : -1) * (_simTime * 36);
    pCtx.beginPath();
    pCtx.moveTo(xStart, py - hr); pCtx.lineTo(VIEW_W, py - hr);
    pCtx.moveTo(xStart, py + hr); pCtx.lineTo(VIEW_W, py + hr);
    pCtx.stroke();
    pCtx.restore();

    const tCfg = (typeof TOWER_CONFIGS !== 'undefined' && TOWER_CONFIGS[_type]) ? TOWER_CONFIGS[_type] : null;
    const tCol = (tCfg && tCfg.color) || '#00e5ff';
    const tGlow = (tCfg && tCfg.glow) || tCol;
    const target = findTarget();

    // Range circle (stasis gets soft cyan fill too)
    if (!isRail) {
      pCtx.save();
      pCtx.beginPath();
      pCtx.arc(_tower.x, _tower.y, _tower.range, 0, Math.PI * 2);
      if (_type === 'stasis') {
        pCtx.fillStyle = 'rgba(56, 189, 248, 0.08)';
        pCtx.fill();
        pCtx.strokeStyle = 'rgba(56, 189, 248, 0.32)';
      } else {
        pCtx.strokeStyle = `rgba(${c1Rgb}, 0.16)`;
      }
      pCtx.lineWidth = 1.2;
      pCtx.stroke();
      pCtx.restore();
    }

    // Stasis pulse rings
    for (let i = 0; i < _stasisWaves.length; i++) {
      const sw = _stasisWaves[i];
      const a = Math.max(0, sw.life / sw.maxLife);
      pCtx.save();
      pCtx.globalCompositeOperation = 'lighter';
      pCtx.globalAlpha = a * 0.75;
      pCtx.strokeStyle = sw.color;
      pCtx.lineWidth = 3.0;
      pCtx.beginPath();
      pCtx.arc(sw.x, sw.y, sw.r, 0, Math.PI * 2);
      pCtx.stroke();
      pCtx.restore();
    }

    // 2. Render tower, enemies, bullet trails, lightning, beams & isolated FX layers
    const prevCtx = ctx;
    const prevZoom = (typeof camZoom !== 'undefined') ? camZoom : 1;
    const prevParts = fxLayerParts;
    const prevWaves = fxLayerWaves;
    try {
      ctx = pCtx;
      if (typeof camZoom !== 'undefined') camZoom = previewScale;
      fxLayerParts = _fxParts;
      fxLayerWaves = _fxWaves;

      if (typeof drawTowerModel === 'function') {
        const isShooting = ((_type === 'laser' && !!target) || (_type === 'melter' && !!target && !_tower.isCooling) || (_type === 'tesla' && _bolts.length > 0));
        pCtx.save();
        pCtx.translate(_tower.x, _tower.y);
        drawTowerModel(_type, _tower.angle, tCol, 1, tGlow, false, _tower.isCooling, isShooting, _tower.heatProgress, {
          x: _tower.x, y: _tower.y, target: isRail ? null : target, time: _simTime, lastFire: _tower.lastFire, shotIndex: _tower.shotIndex
        });
        pCtx.restore();
      }

      // Laser 3-layer beam
      if (_type === 'laser' && target) {
        const mx = _tower.x + Math.cos(_tower.angle) * 24;
        const my = _tower.y + Math.sin(_tower.angle) * 24;
        const pulse = Math.sin(_simTime * 24);
        pCtx.save();
        pCtx.lineCap = 'round';
        pCtx.globalCompositeOperation = 'lighter';
        pCtx.strokeStyle = tCol;
        pCtx.globalAlpha = 0.32;
        pCtx.lineWidth = 9.5 + pulse * 1.8;
        pCtx.beginPath(); pCtx.moveTo(mx, my); pCtx.lineTo(target.x, target.y); pCtx.stroke();
        pCtx.globalAlpha = 0.92;
        pCtx.lineWidth = 3.6 + pulse * 0.9;
        pCtx.stroke();
        pCtx.strokeStyle = '#ffffff';
        pCtx.globalAlpha = 0.95;
        pCtx.lineWidth = 1.4;
        pCtx.stroke();
        pCtx.fillStyle = '#ffffff';
        pCtx.beginPath(); pCtx.arc(target.x, target.y, 4.5, 0, Math.PI * 2); pCtx.fill();
        pCtx.restore();
      }

      // Melter ramping heat beam
      if (_type === 'melter' && target && !_tower.isCooling) {
        const mx = _tower.x + Math.cos(_tower.angle) * 24;
        const my = _tower.y + Math.sin(_tower.angle) * 24;
        const hp = _tower.heatProgress;
        const beamCol = hp > 0.72 ? '#ffffff' : (hp > 0.38 ? '#fb923c' : tCol);
        const coreW = 3.2 + hp * 4.2;
        pCtx.save();
        pCtx.lineCap = 'round';
        pCtx.globalCompositeOperation = 'lighter';
        pCtx.strokeStyle = hp > 0.4 ? '#fb923c' : tCol;
        pCtx.globalAlpha = 0.36;
        pCtx.lineWidth = coreW * 2.4;
        pCtx.beginPath(); pCtx.moveTo(mx, my); pCtx.lineTo(target.x, target.y); pCtx.stroke();
        pCtx.strokeStyle = beamCol;
        pCtx.globalAlpha = 0.92;
        pCtx.lineWidth = coreW;
        pCtx.stroke();
        pCtx.strokeStyle = '#ffffff';
        pCtx.globalAlpha = 0.75 + 0.25 * hp;
        pCtx.lineWidth = Math.max(1.4, coreW * 0.38);
        pCtx.stroke();
        pCtx.restore();
      }

      // Railgun piercing 3-layer beam
      for (let i = 0; i < _railBeams.length; i++) {
        const rb = _railBeams[i];
        const a = Math.max(0, rb.life / rb.maxLife);
        pCtx.save();
        pCtx.lineCap = 'round';
        pCtx.globalCompositeOperation = 'lighter';
        pCtx.strokeStyle = rb.color;
        pCtx.globalAlpha = 0.35 * a;
        pCtx.lineWidth = 14 * a;
        pCtx.beginPath(); pCtx.moveTo(rb.x1, rb.y1); pCtx.lineTo(rb.x2, rb.y2); pCtx.stroke();
        pCtx.globalAlpha = 0.92 * a;
        pCtx.lineWidth = 6 * a;
        pCtx.stroke();
        pCtx.strokeStyle = '#ffffff';
        pCtx.globalAlpha = a;
        pCtx.lineWidth = 2.5 * a;
        pCtx.stroke();
        pCtx.restore();
      }

      // Enemies with HP bars & real mob_renderer
      for (let i = 0; i < _enemies.length; i++) {
        const e = _enemies[i];
        const jitX = e._fxJitT > 0 ? Math.sin(_simTime * 80 + i) * 1.4 : 0;
        const jitY = e._fxJitT > 0 ? Math.cos(_simTime * 75 + i) * 1.4 : 0;
        const renderEnemy = Object.assign({}, e, {
          x: e.x + (e._fxKbX || 0) + jitX,
          y: e.y + (e._fxKbY || 0) + jitY
        });
        if (typeof renderConfiguredEnemyModel === 'function') {
          renderConfiguredEnemyModel(renderEnemy, _type !== 'stasis');
        }
      }

      // Tesla chain lightning
      if (typeof drawJaggedLightning === 'function') {
        for (let i = 0; i < _bolts.length; i++) {
          const b = _bolts[i];
          drawJaggedLightning(b.x1, b.y1, b.x2, b.y2, b.color, Math.max(0, b.life / b.maxLife), 1.0);
        }
      }

      // Projectiles (bullets via drawFxBulletTrails, mortar shells with shadow)
      for (let i = 0; i < _projectiles.length; i++) {
        const p = _projectiles[i];
        if (p.kind === 'bullet') {
          if (typeof drawFxBulletTrails === 'function') drawFxBulletTrails(p);
          pCtx.save();
          pCtx.fillStyle = '#ffffff';
          pCtx.beginPath(); pCtx.arc(p.x, p.y, 2.2, 0, Math.PI * 2); pCtx.fill();
          pCtx.restore();
        } else if (p.kind === 'mortar') {
          pCtx.save();
          pCtx.fillStyle = 'rgba(0, 0, 0, 0.35)';
          pCtx.beginPath(); pCtx.ellipse(p.x, p.y + 4, 6, 3, 0, 0, Math.PI * 2); pCtx.fill();
          pCtx.globalCompositeOperation = 'lighter';
          pCtx.fillStyle = p.color;
          pCtx.beginPath(); pCtx.arc(p.x, p.arcY, 5.5, 0, Math.PI * 2); pCtx.fill();
          pCtx.fillStyle = '#ffffff';
          pCtx.beginPath(); pCtx.arc(p.x, p.arcY, 2.5, 0, Math.PI * 2); pCtx.fill();
          pCtx.restore();
        }
      }

      // Melter cooling steam puffs
      for (let i = 0; i < _steamPuffs.length; i++) {
        const sp = _steamPuffs[i];
        const a = Math.max(0, sp.life / sp.maxLife) * 0.45;
        pCtx.save();
        pCtx.fillStyle = `rgba(210, 235, 255, ${a.toFixed(2)})`;
        pCtx.beginPath(); pCtx.arc(sp.x, sp.y, sp.r, 0, Math.PI * 2); pCtx.fill();
        pCtx.restore();
      }

      if (typeof updateAndDrawFxLayers === 'function') {
        updateAndDrawFxLayers(_lastDt, _simTime);
      }
    } finally {
      ctx = prevCtx;
      if (typeof camZoom !== 'undefined') camZoom = prevZoom;
      fxLayerParts = prevParts;
      fxLayerWaves = prevWaves;
    }

    pCtx.restore();
  }

  function tick(now) {
    const msSc = document.getElementById('milestoneScreen');
    const pCanvas = document.getElementById('milestoneTowerPreviewCanvas');
    if (!msSc || msSc.classList.contains('hidden') || !pCanvas) {
      stop();
      return;
    }
    if (!_lastTs) _lastTs = now;
    const dt = Math.min(0.05, Math.max(0.001, (now - _lastTs) / 1000));
    _lastTs = now;
    try {
      step(dt);
      render(now);
    } catch (_e) {}
    _rafId = requestAnimationFrame(tick);
  }

  function start(type) {
    stop();
    _type = type || 'gun';
    _lastTs = 0;
    _lastDt = 0.016;
    _simTime = 0;
    _spawnTimer = 1.2;
    _beamHitTimer = 0;

    const isRail = (_type === 'railgun');
    _tower.type = _type;
    _tower.x = isRail ? (0.9 * T_SIZE) : (2.5 * T_SIZE);
    _tower.y = 1.5 * T_SIZE;
    _tower.range = (_type === 'stasis') ? 132 : (isRail ? 380 : 168);
    _tower.angle = isRail ? 0 : Math.PI * 0.5;
    _tower.fireCooldown = 0.20;
    _tower.lastFire = -10;
    _tower.shotIndex = 0;
    _tower.heatProgress = 0;
    _tower.isCooling = false;
    _tower.coolTimer = 0;
    _tower.steamTimer = 0;

    spawnScenarioWave(true);
    _rafId = requestAnimationFrame(tick);
  }

  function stop() {
    if (_rafId !== null) {
      cancelAnimationFrame(_rafId);
      _rafId = null;
    }
    _enemies = [];
    _projectiles = [];
    _bolts = [];
    _railBeams = [];
    _stasisWaves = [];
    _steamPuffs = [];
    _fxParts.length = 0;
    _fxWaves.length = 0;
  }

  return { start, stop };
})();
