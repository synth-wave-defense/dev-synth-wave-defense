// Synth Wave Defense — ui_fx.js (Hit & Explosion FX Sandbox v11, particles, shards, lightning, shockwaves)

// [UI.HV]
function createFloatingDamage(x, y, damage, color = '#f05f9f') {
  if (typeof settings !== 'undefined' && settings.showDamage === false) return;
  const dmgVal = typeof damage === 'number' ? Math.round(damage) : damage;
  if (!dmgVal || dmgVal <= 0) return;

  pushParticle({
    x: x + (Math.random() - 0.5) * 12,
    y: y - 8 + (Math.random() - 0.5) * 6,
    vx: (Math.random() - 0.5) * 18,
    vy: -28 - Math.random() * 22,
    text: `-${dmgVal}`,
    color: color,
    life: 0.65,
    maxLife: 0.65,
    isText: true
  });
}

// [UI.HW]
function createDamageShards(x, y, color, damage = 16, isDeath = false) {
  if (!isDeath && typeof TOWER_FX !== 'undefined') return;
  const count = isDeath ? (perfMode === 'low' ? 6 : 11) : Math.max(2, Math.min(4, Math.ceil(damage / 20)));
  const baseSize = isDeath ? 7.8 : Math.max(3.4, Math.min(6.4, 2.4 + damage * 0.06));
  const col = color || '#00e5ff';

  // При гибели моба добавляем короткую неоновую вспышку и россыпь светящихся искр его цвета
  if (isDeath) {
    pushParticle({
      x, y, vx: 0, vy: 0,
      color: col,
      radius: perfMode === 'low' ? 16 : 22,
      life: 0.16, maxLife: 0.16,
      isFlash: true
    });
    const glowCount = perfMode === 'low' ? 4 : 8;
    for (let g = 0; g < glowCount; g++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 45 + Math.random() * 115;
      pushParticle({
        x, y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        drag: 0.92,
        color: g % 3 === 0 ? '#ffffff' : col,
        radius: 2.6 + Math.random() * 2.4,
        life: 0.28 + Math.random() * 0.18,
        maxLife: 0.46,
        isStreak: true
      });
    }
  }

  for (let i = 0; i < count; i++) {
    const angle = (isDeath ? (i * (Math.PI * 2 / count)) : Math.random() * Math.PI * 2) + (Math.random() - 0.5) * 0.55;
    const speed = isDeath ? (65 + Math.random() * 135) : (35 + Math.random() * 85);
    const sz = baseSize * (0.75 + Math.random() * 0.55);

    const shapeType = Math.floor(Math.random() * 3);
    let pts;

    if (shapeType === 0) {
      pts = [
        { x: -sz * 0.6, y: -sz * 0.3 },
        { x: sz * 0.8, y: -sz * 0.1 },
        { x: (Math.random() - 0.5) * sz * 0.5, y: sz * 0.7 }
      ];
    } else if (shapeType === 1) {
      pts = [
        { x: -sz * 0.5, y: -sz * 0.5 },
        { x: sz * 0.6, y: -sz * 0.4 },
        { x: sz * 0.4, y: sz * 0.6 },
        { x: -sz * 0.5, y: sz * 0.4 }
      ];
    } else {
      pts = [
        { x: -sz * 0.8, y: -sz * 0.2 },
        { x: sz * 0.9, y: -sz * 0.15 },
        { x: sz * 0.6, y: sz * 0.25 },
        { x: -sz * 0.7, y: sz * 0.2 }
      ];
    }

    pushParticle({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      drag: 0.94,
      color: col,
      radius: sz,
      pts: pts,
      angle: Math.random() * Math.PI * 2,
      vRot: (Math.random() - 0.5) * 16,
      life: isDeath ? (0.36 + Math.random() * 0.22) : (0.22 + Math.random() * 0.14),
      maxLife: isDeath ? 0.58 : 0.36,
      isShard: true
    });
  }
}

// [UI.HWF] Конфигурация спецэффектов v11 (1-в-1 из Hit & Explosion FX Sandbox v11) + Offscreen-кэширование
const ENEMY_REACTIONS = {"knockback": true, "jitter": true, "hitTilt": true};
const TOWER_FX = {"gun": {"blastScale": 1, "layers": [{"uid": "L62", "type": "bulletTrails", "name": "Трассеры пуль #1", "enabled": true, "params": {"size": 2.25, "speed": 1.6, "opacity": 0.55, "colorMode": "tower", "customColor": "#ff0000"}}, {"uid": "L63", "type": "muzzleFlash", "name": "Дульная вспышка #1", "enabled": true, "params": {"size": 0.9, "speed": 2.5, "opacity": 0.55, "duration": 0.32, "smooth": 2.5, "shape": "default", "customPoly": [{"x": 0.01, "y": -0.9}, {"x": 0.581, "y": -0.614}, {"x": 0.881, "y": -0.029}, {"x": 0.596, "y": 0.586}, {"x": -0.004, "y": 0.886}], "colorMode": "white", "customColor": "#ffffff"}}, {"uid": "L64", "type": "deepGlow", "name": "Глубокий Glow #1", "enabled": true, "params": {"size": 1.85, "speed": 1.9, "opacity": 1, "duration": 0.66, "smooth": 0.2, "flicker": false, "colorMode": "tower", "customColor": "#ff9100"}}, {"uid": "L65", "type": "volumeHalo", "name": "Объёмный ореол #1", "enabled": true, "params": {"size": 0.7, "speed": 1.6, "opacity": 0.85, "duration": 0.7, "smooth": 1.9, "flicker": false, "colorMode": "tower", "customColor": "#38bdf8"}}, {"uid": "L66", "type": "sparks", "name": "Искры #2", "enabled": true, "params": {"size": 1, "speed": 0.7, "opacity": 1, "count": 14, "stretch": 1, "range": 1.1, "centerFade": 0.1, "duration": 0.32, "directionalCone": true, "velocityStretch": false, "tempGradient": false, "shape": "default", "customPoly": [{"x": 0, "y": -0.9}, {"x": 0.3, "y": -0.25}, {"x": 0.9, "y": 0}, {"x": 0.3, "y": 0.25}, {"x": 0, "y": 0.9}, {"x": -0.3, "y": 0.25}, {"x": -0.9, "y": 0}, {"x": -0.3, "y": -0.25}], "colorMode": "tower", "customColor": "#ff9100"}}, {"uid": "L67", "type": "energyMotes", "name": "Энерго-пыльца #1", "enabled": true, "params": {"size": 1, "speed": 1, "opacity": 1, "count": 10, "spread": 0.45, "duration": 0.95, "smooth": 1, "shape": "default", "customPoly": [{"x": 0, "y": -0.9}, {"x": 0.3, "y": -0.25}, {"x": 0.9, "y": 0}, {"x": 0.3, "y": 0.25}, {"x": 0, "y": 0.9}, {"x": -0.3, "y": 0.25}, {"x": -0.9, "y": 0}, {"x": -0.3, "y": -0.25}], "colorMode": "tower", "customColor": "#38bdf8"}}]}, "laser": {"blastScale": 1, "layers": [{"uid": "L68", "type": "sparks", "name": "Искры #1", "enabled": true, "params": {"size": 1, "speed": 1, "opacity": 1, "count": 6, "stretch": 0.2, "range": 1, "centerFade": 0, "duration": 0.28, "directionalCone": true, "velocityStretch": true, "tempGradient": false, "shape": "default", "customPoly": [{"x": 0, "y": -0.9}, {"x": 0.3, "y": -0.25}, {"x": 0.9, "y": 0}, {"x": 0.3, "y": 0.25}, {"x": 0, "y": 0.9}, {"x": -0.3, "y": 0.25}, {"x": -0.9, "y": 0}, {"x": -0.3, "y": -0.25}], "colorMode": "tower", "customColor": "#ff9100"}}, {"uid": "L69", "type": "deepGlow", "name": "Глубокий Glow", "enabled": true, "params": {"size": 1.45, "speed": 1, "opacity": 0.6, "duration": 0.24, "smooth": 0.6, "flicker": true, "colorMode": "tower", "customColor": "#ff9100"}}, {"uid": "L70", "type": "deepGlow", "name": "Глубокий Glow #2", "enabled": true, "params": {"size": 3, "speed": 1, "opacity": 0.05, "duration": 0.24, "smooth": 1.6, "flicker": true, "colorMode": "tower", "customColor": "#ff9100"}}, {"uid": "L71", "type": "volumeHalo", "name": "Объёмный ореол #1", "enabled": false, "params": {"size": 1.7, "speed": 1.35, "opacity": 0.1, "duration": 0.34, "smooth": 1.45, "flicker": true, "colorMode": "tower", "customColor": "#38bdf8"}}]}, "mortar": {"blastScale": 1, "layers": [{"uid": "L72", "type": "muzzleFlash", "name": "Дульная вспышка #1", "enabled": true, "params": {"size": 0.9, "speed": 2.4, "opacity": 0.55, "duration": 0.32, "smooth": 2.5, "shape": "default", "customPoly": [{"x": 0, "y": -0.9}, {"x": 0.3, "y": -0.25}, {"x": 0.9, "y": 0}, {"x": 0.3, "y": 0.25}, {"x": 0, "y": 0.9}, {"x": -0.3, "y": 0.25}, {"x": -0.9, "y": 0}, {"x": -0.3, "y": -0.25}], "colorMode": "tower", "customColor": "#ffffff"}}, {"uid": "L73", "type": "plasmaVortex", "name": "Плазменный вихрь #1", "enabled": true, "params": {"size": 1.75, "speed": 1, "opacity": 0.85, "count": 12, "spread": 1, "duration": 0.32, "thickness": 2.2, "colorMode": "tower", "customColor": "#ff9100"}}, {"uid": "L74", "type": "threePhaseCore", "name": "Трехфазное ядро #1", "enabled": true, "params": {"size": 0.55, "speed": 1, "opacity": 1, "count": 1, "duration": 0.84, "smooth": 2.5, "flicker": false, "fakeGlow": true, "shape": "default", "customPoly": [{"x": 0, "y": -0.9}, {"x": 0.3, "y": -0.25}, {"x": 0.9, "y": 0}, {"x": 0.3, "y": 0.25}, {"x": 0, "y": 0.9}, {"x": -0.3, "y": 0.25}, {"x": -0.9, "y": 0}, {"x": -0.3, "y": -0.25}], "colorMode": "tower", "customColor": "#ff9100"}}, {"uid": "L75", "type": "threePhaseCore", "name": "Трехфазное ядро #2", "enabled": true, "params": {"size": 1.35, "speed": 0.8, "opacity": 0.75, "count": 1, "duration": 0.48, "smooth": 2.5, "flicker": false, "fakeGlow": true, "shape": "default", "customPoly": [{"x": 0, "y": -0.9}, {"x": 0.3, "y": -0.25}, {"x": 0.9, "y": 0}, {"x": 0.3, "y": 0.25}, {"x": 0, "y": 0.9}, {"x": -0.3, "y": 0.25}, {"x": -0.9, "y": 0}, {"x": -0.3, "y": -0.25}], "colorMode": "tower", "customColor": "#ff9100"}}, {"uid": "L76", "type": "threePhaseCore", "name": "Трехфазное ядро #3", "enabled": true, "params": {"size": 2.1, "speed": 0.8, "opacity": 0.3, "count": 1, "duration": 0.26, "smooth": 2.5, "flicker": false, "fakeGlow": true, "shape": "default", "customPoly": [{"x": 0, "y": -0.9}, {"x": 0.3, "y": -0.25}, {"x": 0.9, "y": 0}, {"x": 0.3, "y": 0.25}, {"x": 0, "y": 0.9}, {"x": -0.3, "y": 0.25}, {"x": -0.9, "y": 0}, {"x": -0.3, "y": -0.25}], "colorMode": "tower", "customColor": "#ff9100"}}, {"uid": "L77", "type": "sineEmbers", "name": "Угли 360° #1", "enabled": true, "params": {"size": 1.3, "speed": 2.05, "opacity": 1, "count": 10, "spread": 1.25, "waveAmp": 22, "duration": 1, "shape": "default", "customPoly": [{"x": 0, "y": -0.9}, {"x": 0.3, "y": -0.25}, {"x": 0.9, "y": 0}, {"x": 0.3, "y": 0.25}, {"x": 0, "y": 0.9}, {"x": -0.3, "y": 0.25}, {"x": -0.9, "y": 0}, {"x": -0.3, "y": -0.25}], "colorMode": "tower", "customColor": "#ff9100"}}, {"uid": "L78", "type": "volumeHalo", "name": "Объёмный ореол #1", "enabled": true, "params": {"size": 1.55, "speed": 2.8, "opacity": 0.85, "duration": 1.2, "smooth": 0.65, "flicker": false, "colorMode": "tower", "customColor": "#38bdf8"}}]}, "tesla": {"blastScale": 1, "layers": [{"uid": "L79", "type": "arcLightning", "name": "Плазменные дуги", "enabled": true, "params": {"size": 1, "speed": 1, "opacity": 1, "count": 3, "duration": 0.18, "thickness": 1, "colorMode": "tower", "customColor": "#00ffcc"}}, {"uid": "L80", "type": "rgbRing", "name": "Хроматик-кольцо", "enabled": true, "params": {"size": 0.6, "speed": 1, "opacity": 1, "duration": 0.3, "thickness": 1.5, "offset": 1.8, "shape": "default", "customPoly": [{"x": 0, "y": -0.9}, {"x": 0.3, "y": -0.25}, {"x": 0.9, "y": 0}, {"x": 0.3, "y": 0.25}, {"x": 0, "y": 0.9}, {"x": -0.3, "y": 0.25}, {"x": -0.9, "y": 0}, {"x": -0.3, "y": -0.25}], "colorMode": "tower", "customColor": "#00e5ff"}}, {"uid": "L81", "type": "deepGlow", "name": "Глубокий Glow", "enabled": true, "params": {"size": 0.7, "speed": 1, "opacity": 0.75, "duration": 0.62, "smooth": 2.3, "flicker": true, "colorMode": "tower", "customColor": "#ff9100"}}, {"uid": "L82", "type": "volumeHalo", "name": "Объёмный ореол", "enabled": true, "params": {"size": 2.4, "speed": 1, "opacity": 0.85, "duration": 0.62, "smooth": 1, "flicker": true, "colorMode": "tower", "customColor": "#38bdf8"}}, {"uid": "L83", "type": "energyMotes", "name": "Энерго-пыльца #1", "enabled": false, "params": {"size": 1.85, "speed": 1, "opacity": 1, "count": 28, "spread": 0.45, "duration": 0.95, "smooth": 0.9, "shape": "default", "customPoly": [{"x": 0, "y": -0.9}, {"x": 0.3, "y": -0.25}, {"x": 0.9, "y": 0}, {"x": 0.3, "y": 0.25}, {"x": 0, "y": 0.9}, {"x": -0.3, "y": 0.25}, {"x": -0.9, "y": 0}, {"x": -0.3, "y": -0.25}], "colorMode": "tower", "customColor": "#38bdf8"}}, {"uid": "L84", "type": "coolingEmbers", "name": "Остывающие точки #1", "enabled": true, "params": {"size": 0.65, "speed": 3, "opacity": 1, "count": 7, "spread": 0.55, "duration": 0.8, "shape": "default", "customPoly": [{"x": 0, "y": -0.9}, {"x": 0.3, "y": -0.25}, {"x": 0.9, "y": 0}, {"x": 0.3, "y": 0.25}, {"x": 0, "y": 0.9}, {"x": -0.3, "y": 0.25}, {"x": -0.9, "y": 0}, {"x": -0.3, "y": -0.25}], "colorMode": "tower", "customColor": "#ff9100"}}]}, "stasis": {"blastScale": 1, "layers": [{"uid": "L85", "type": "deepGlow", "name": "Глубокий Glow", "enabled": true, "params": {"size": 0.85, "speed": 2.35, "opacity": 0.5, "duration": 1.2, "smooth": 2.5, "flicker": false, "colorMode": "tower", "customColor": "#ff9100"}}, {"uid": "L86", "type": "implosionLines", "name": "Воронка имплозии", "enabled": true, "params": {"size": 0.75, "speed": 1, "opacity": 1, "count": 6, "duration": 0.24, "thickness": 1.5, "colorMode": "tower", "customColor": "#38bdf8"}}, {"uid": "L87", "type": "volumeHalo", "name": "Объёмный ореол", "enabled": true, "params": {"size": 3, "speed": 1, "opacity": 0.5, "duration": 0.22, "smooth": 1, "flicker": false, "colorMode": "tower", "customColor": "#38bdf8"}}, {"uid": "L88", "type": "energyMotes", "name": "Энерго-пыльца", "enabled": true, "params": {"size": 1, "speed": 1, "opacity": 1, "count": 8, "spread": 0.45, "duration": 0.7, "smooth": 1, "shape": "default", "customPoly": [{"x": 0, "y": -0.9}, {"x": 0.3, "y": -0.25}, {"x": 0.9, "y": 0}, {"x": 0.3, "y": 0.25}, {"x": 0, "y": 0.9}, {"x": -0.3, "y": 0.25}, {"x": -0.9, "y": 0}, {"x": -0.3, "y": -0.25}], "colorMode": "tower", "customColor": "#38bdf8"}}]}, "melter": {"blastScale": 1, "layers": [{"uid": "L89", "type": "sparks", "name": "Искры #1", "enabled": true, "params": {"size": 1, "speed": 1, "opacity": 1, "count": 6, "stretch": 1, "range": 1, "centerFade": 0, "duration": 0.28, "directionalCone": true, "velocityStretch": true, "tempGradient": true, "shape": "default", "customPoly": [{"x": 0, "y": -0.9}, {"x": 0.3, "y": -0.25}, {"x": 0.9, "y": 0}, {"x": 0.3, "y": 0.25}, {"x": 0, "y": 0.9}, {"x": -0.3, "y": 0.25}, {"x": -0.9, "y": 0}, {"x": -0.3, "y": -0.25}], "colorMode": "tower", "customColor": "#ff9100"}}, {"uid": "L90", "type": "deepGlow", "name": "Глубокий Glow", "enabled": true, "params": {"size": 0.25, "speed": 1, "opacity": 1, "duration": 0.22, "smooth": 2.5, "flicker": true, "colorMode": "tower", "customColor": "#ff9100"}}, {"uid": "L91", "type": "deepGlow", "name": "Глубокий Glow #2", "enabled": true, "params": {"size": 1, "speed": 1, "opacity": 0.1, "duration": 0.22, "smooth": 2.5, "flicker": true, "colorMode": "tower", "customColor": "#ff9100"}}, {"uid": "L92", "type": "deepGlow", "name": "Глубокий Glow #3", "enabled": true, "params": {"size": 2.5, "speed": 1, "opacity": 0.05, "duration": 0.22, "smooth": 2.5, "flicker": true, "colorMode": "tower", "customColor": "#ff9100"}}, {"uid": "L93", "type": "coolingEmbers", "name": "Остывающие точки #1", "enabled": true, "params": {"size": 0.55, "speed": 1, "opacity": 1, "count": 3, "spread": 0.4, "duration": 0.6, "shape": "default", "customPoly": [{"x": 0, "y": -0.9}, {"x": 0.3, "y": -0.25}, {"x": 0.9, "y": 0}, {"x": 0.3, "y": 0.25}, {"x": 0, "y": 0.9}, {"x": -0.3, "y": 0.25}, {"x": -0.9, "y": 0}, {"x": -0.3, "y": -0.25}], "colorMode": "tower", "customColor": "#ff9100"}}, {"uid": "L94", "type": "plasmaVortex", "name": "Плазменный вихрь #1", "enabled": true, "params": {"size": 1.7, "speed": 1, "opacity": 0.25, "count": 4, "spread": 1, "duration": 0.32, "thickness": 2.2, "colorMode": "tower", "customColor": "#ff9100"}}, {"uid": "L95", "type": "volumeHalo", "name": "Объёмный ореол #1", "enabled": true, "params": {"size": 2.15, "speed": 1, "opacity": 0.1, "duration": 0.34, "smooth": 1, "flicker": false, "colorMode": "tower", "customColor": "#38bdf8"}}]}, "railgun": {"blastScale": 1, "layers": [{"uid": "L96", "type": "muzzleFlash", "name": "Дульная вспышка", "enabled": true, "params": {"size": 0.9, "speed": 2.5, "opacity": 0.55, "duration": 0.32, "smooth": 2.5, "shape": "default", "customPoly": [{"x": 0, "y": -0.9}, {"x": 0.3, "y": -0.25}, {"x": 0.9, "y": 0}, {"x": 0.3, "y": 0.25}, {"x": 0, "y": 0.9}, {"x": -0.3, "y": 0.25}, {"x": -0.9, "y": 0}, {"x": -0.3, "y": -0.25}], "colorMode": "tower", "customColor": "#ffffff"}}, {"uid": "L97", "type": "arcLightning", "name": "Плазменные дуги", "enabled": true, "params": {"size": 1.9, "speed": 1, "opacity": 1, "count": 3, "duration": 0.18, "thickness": 1, "colorMode": "tower", "customColor": "#00ffcc"}}, {"uid": "L98", "type": "rgbRing", "name": "Хроматик-кольцо", "enabled": true, "params": {"size": 0.95, "speed": 1, "opacity": 1, "duration": 0.3, "thickness": 1.5, "offset": 1.8, "shape": "default", "customPoly": [{"x": 0, "y": -0.9}, {"x": 0.3, "y": -0.25}, {"x": 0.9, "y": 0}, {"x": 0.3, "y": 0.25}, {"x": 0, "y": 0.9}, {"x": -0.3, "y": 0.25}, {"x": -0.9, "y": 0}, {"x": -0.3, "y": -0.25}], "colorMode": "tower", "customColor": "#00e5ff"}}, {"uid": "L99", "type": "deepGlow", "name": "Глубокий Glow", "enabled": true, "params": {"size": 0.65, "speed": 1, "opacity": 1, "duration": 0.22, "smooth": 1, "flicker": false, "colorMode": "tower", "customColor": "#ff9100"}}, {"uid": "L100", "type": "volumeHalo", "name": "Объёмный ореол", "enabled": true, "params": {"size": 1.1, "speed": 1, "opacity": 1, "duration": 0.8, "smooth": 2.5, "flicker": true, "colorMode": "tower", "customColor": "#38bdf8"}}, {"uid": "L101", "type": "energyMotes", "name": "Энерго-пыльца", "enabled": true, "params": {"size": 2.4, "speed": 2.25, "opacity": 1, "count": 28, "spread": 0.75, "duration": 0.75, "smooth": 0.95, "shape": "default", "customPoly": [{"x": 0, "y": -0.9}, {"x": 0.3, "y": -0.25}, {"x": 0.9, "y": 0}, {"x": 0.3, "y": 0.25}, {"x": 0, "y": 0.9}, {"x": -0.3, "y": 0.25}, {"x": -0.9, "y": 0}, {"x": -0.3, "y": -0.25}], "colorMode": "tower", "customColor": "#38bdf8"}}, {"uid": "L102", "type": "sineEmbers", "name": "Угли 360° #1", "enabled": true, "params": {"size": 1.1, "speed": 2.15, "opacity": 1, "count": 11, "spread": 1.35, "waveAmp": 14, "duration": 0.85, "shape": "default", "customPoly": [{"x": 0, "y": -0.9}, {"x": 0.3, "y": -0.25}, {"x": 0.9, "y": 0}, {"x": 0.3, "y": 0.25}, {"x": 0, "y": 0.9}, {"x": -0.3, "y": 0.25}, {"x": -0.9, "y": 0}, {"x": -0.3, "y": -0.25}], "colorMode": "tower", "customColor": "#ff9100"}}]}};
const MOB_SPAWN_FX = {
  blastScale: 1,
  layers: [
    { uid: 'L62', type: 'implosionLines', name: 'Воронка имплозии', enabled: true, params: { size: 1.25, speed: 1, opacity: 1, count: 7, duration: 0.24, thickness: 2, colorMode: 'enemy', customColor: '#f05f9f' } },
    { uid: 'L63', type: 'deepGlow', name: 'Ядро вспышки', enabled: true, params: { size: 1.05, speed: 1, opacity: 1, duration: 0.54, smooth: 1, flicker: false, colorMode: 'white', customColor: '#ffffff' } },
    { uid: 'L64', type: 'deepGlow', name: 'Внешний ореол', enabled: true, params: { size: 2.2, speed: 1, opacity: 1, duration: 0.28, smooth: 1, flicker: false, colorMode: 'enemy', customColor: '#f05f9f' } }
  ]
};
const MOB_BASE_HIT_FX = {
  blastScale: 1,
  layers: [
    { uid: 'L63', type: 'deepGlow', name: 'Белый сердечник', enabled: true, params: { size: 1.5, speed: 1, opacity: 1, duration: 0.42, smooth: 1.4, flicker: false, colorMode: 'white', customColor: '#ffffff' } },
    { uid: 'L67', type: 'plasmaVortex', name: 'Плазменный вихрь #1', enabled: true, params: { size: 1.4, speed: 1.2, opacity: 0.9, count: 6, spread: 1.0, duration: 0.36, thickness: 2.2, colorMode: 'themeBaseShield', customColor: '#00e5ff' } },
    { uid: 'L70', type: 'plasmaVortex', name: 'Плазменный вихрь #2', enabled: true, params: { size: 2.1, speed: 0.85, opacity: 0.55, count: 4, spread: 1.3, duration: 0.44, thickness: 1.8, colorMode: 'themeBaseShield', customColor: '#00e5ff' } },
    { uid: 'L68', type: 'threePhaseCore', name: 'Трехфазное ядро', enabled: true, params: { size: 1.25, speed: 0.9, opacity: 0.95, count: 3, duration: 0.45, smooth: 1.6, flicker: true, fakeGlow: true, shape: 'default', colorMode: 'themeBaseDmgLight', customColor: '#ff8fb0' } },
    { uid: 'L69', type: 'rgbRing', name: 'Хроматик-кольцо', enabled: true, params: { size: 1.35, speed: 1.0, opacity: 0.95, duration: 0.38, thickness: 2.0, offset: 2.4, shape: 'default', colorMode: 'themeBaseShield', customColor: '#00e5ff' } },
    { uid: 'L73', type: 'volumeHalo', name: 'Объёмный ореол', enabled: true, params: { size: 2.3, speed: 1.0, opacity: 0.85, duration: 0.55, smooth: 1.2, flicker: false, colorMode: 'themeBaseDmg', customColor: '#f05f9f' } },
    { uid: 'L75', type: 'coolingEmbers', name: 'Остывающие точки #1', enabled: true, params: { size: 0.9, speed: 1.1, opacity: 0.95, count: 9, spread: 0.75, duration: 0.95, shape: 'default', colorMode: 'themeBaseDmg', customColor: '#f05f9f' } },
    { uid: 'L76', type: 'coolingEmbers', name: 'Остывающие точки #2', enabled: true, params: { size: 0.75, speed: 1.3, opacity: 0.9, count: 7, spread: 0.9, duration: 0.85, shape: 'default', colorMode: 'themeBaseShield', customColor: '#00e5ff' } },
    { uid: 'L77', type: 'sparks', name: 'Искры щита', enabled: true, params: { size: 1.05, speed: 1.15, opacity: 1.0, count: 40, stretch: 1.25, range: 1.2, centerFade: 0.05, duration: 0.36, directionalCone: false, velocityStretch: true, tempGradient: false, shape: 'default', colorMode: 'themeBaseShield', customColor: '#00e5ff' } }
  ]
};
if (typeof window !== 'undefined') {
  window.ENEMY_REACTIONS = ENEMY_REACTIONS;
  window.TOWER_FX = TOWER_FX;
  window.MOB_SPAWN_FX = MOB_SPAWN_FX;
  window.MOB_BASE_HIT_FX = MOB_BASE_HIT_FX;
}

const TOWER_FX_BASE_R = {
  gun: 22,
  laser: 22,
  mortar: 58,
  tesla: 28,
  stasis: 26,
  melter: 26,
  railgun: 34
};

const FX_GLOW_SPRITE_CACHE = Object.create(null);
const FX_POLY_SPRITE_CACHE = Object.create(null);
const _fxShapeKeyMap = new WeakMap();
let _fxCachePaletteId = '';

let fxLayerParts = [];
let fxLayerWaves = [];
let _lastFxRenderNow = 0;

function clearFxSpriteCaches() {
  for (const k in FX_GLOW_SPRITE_CACHE) delete FX_GLOW_SPRITE_CACHE[k];
  for (const k in FX_POLY_SPRITE_CACHE) delete FX_POLY_SPRITE_CACHE[k];
  _fxCachePaletteId = (typeof activePalette !== 'undefined') ? activePalette : 'default';
}

function clearFxLayerState() {
  fxLayerParts.length = 0;
  fxLayerWaves.length = 0;
}

function syncFxCachePalette() {
  const curPal = (typeof activePalette !== 'undefined') ? activePalette : 'default';
  if (_fxCachePaletteId !== curPal) {
    clearFxSpriteCaches();
  }
}

function createFxOffscreenCanvas(size) {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(size, size);
  }
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  return c;
}

function fxResolveColor(params, towerColor) {
  if (!params) return towerColor || '#00e5ff';
  if (params.colorMode === 'white') return '#ffffff';
  if (params.colorMode === 'custom' && params.customColor) return params.customColor;
  return towerColor || params.customColor || '#00e5ff';
}

function fxHexRgb(col) {
  if (!col) return { r: 255, g: 145, b: 0 };
  const m = String(col).match(/^rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i);
  if (m) return { r: +m[1], g: +m[2], b: +m[3] };
  let h = String(col).replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return {
    r: Number.isNaN(r) ? 255 : r,
    g: Number.isNaN(g) ? 145 : g,
    b: Number.isNaN(b) ? 0 : b
  };
}

function fxTempColor(age, baseHex, whiteEnd = false) {
  const w = { r: 255, g: 255, b: 255 };
  const y = { r: 255, g: 230, b: 90 };
  const c = fxHexRgb(baseHex);
  const dr = whiteEnd ? w : { r: 150, g: 20, b: 20 };
  const mix = (a, b, t) => `rgb(${Math.round(a.r + (b.r - a.r) * t)},${Math.round(a.g + (b.g - a.g) * t)},${Math.round(a.b + (b.b - a.b) * t)})`;
  if (age < 0.22) return mix(w, y, age / 0.22);
  if (age < 0.62) return mix(y, c, (age - 0.22) / 0.40);
  return mix(c, dr, (age - 0.62) / 0.38);
}

// Точный 9-слойный кэш мягких радиальных свечений 128x128 (bloom / volume / ground) из Sandbox v11
function getFxDeepGlowSprite(color, mode = 'bloom', smooth = 1.0) {
  syncFxCachePalette();
  const sm = Math.max(0.2, Math.min(2.5, smooth || 1.0));
  const rgb = fxHexRgb(color);
  const r = Math.min(255, Math.round(rgb.r / 8) * 8);
  const gr = Math.min(255, Math.round(rgb.g / 8) * 8);
  const b = Math.min(255, Math.round(rgb.b / 8) * 8);
  const key = `${r},${gr},${b}_${mode}_${sm.toFixed(2)}`;
  if (FX_GLOW_SPRITE_CACHE[key]) return FX_GLOW_SPRITE_CACHE[key];

  const size = 128, half = 64;
  const off = createFxOffscreenCanvas(size);
  const g = off.getContext('2d');

  g.save();
  g.globalCompositeOperation = 'lighter';
  if (mode === 'ground') {
    const grad = g.createRadialGradient(half, half, 0, half, half, half);
    grad.addColorStop(0.00, 'rgba(255, 255, 255, 0.34)');
    grad.addColorStop(0.10, `rgba(${r}, ${gr}, ${b}, 0.32)`);
    grad.addColorStop(0.22, `rgba(${r}, ${gr}, ${b}, 0.24)`);
    grad.addColorStop(0.36, `rgba(${r}, ${gr}, ${b}, 0.16)`);
    grad.addColorStop(0.50, `rgba(${r}, ${gr}, ${b}, 0.105)`);
    grad.addColorStop(0.65, `rgba(${r}, ${gr}, ${b}, 0.060)`);
    grad.addColorStop(0.80, `rgba(${r}, ${gr}, ${b}, 0.030)`);
    grad.addColorStop(0.92, `rgba(${r}, ${gr}, ${b}, 0.010)`);
    grad.addColorStop(1.00, `rgba(${r}, ${gr}, ${b}, 0)`);
    g.fillStyle = grad;
    g.beginPath(); g.arc(half, half, half, 0, Math.PI * 2); g.fill();
  } else if (mode === 'volume') {
    const grad = g.createRadialGradient(half, half, 0, half, half, half);
    grad.addColorStop(0.00, 'rgba(255, 255, 255, 0.55)');
    const s1 = Math.min(0.45, 0.18 * sm);
    const s2 = Math.min(0.78, 0.45 * Math.pow(sm, 0.5));
    const s3 = Math.min(0.95, 0.75 * Math.pow(sm, 0.3));
    grad.addColorStop(s1, `rgba(${r}, ${gr}, ${b}, 0.42)`);
    grad.addColorStop(s2, `rgba(${r}, ${gr}, ${b}, 0.18)`);
    grad.addColorStop(s3, `rgba(${Math.round(r * 0.4)}, ${Math.round(gr * 0.5)}, ${Math.min(255, b + 60)}, 0.07)`);
    grad.addColorStop(1.00, 'rgba(10, 20, 50, 0)');
    g.fillStyle = grad;
    g.beginPath(); g.arc(half, half, half, 0, Math.PI * 2); g.fill();
  } else {
    const invSm = 1 / sm;
    const alphaMult = Math.pow(sm, 0.25);
    const midStop = Math.min(0.95, 0.65 * Math.pow(sm, 0.35));
    const falloff = [
      { rMult: 1.00, a: 0.022 }, { rMult: 0.84, a: 0.032 }, { rMult: 0.68, a: 0.048 },
      { rMult: 0.54, a: 0.070 }, { rMult: 0.42, a: 0.105 }, { rMult: 0.32, a: 0.150 },
      { rMult: 0.23, a: 0.215 }, { rMult: 0.16, a: 0.310 }, { rMult: 0.10, a: 0.440 }
    ];
    for (let i = 0; i < falloff.length; i++) {
      const rad = half * Math.pow(falloff[i].rMult, invSm);
      const rg = g.createRadialGradient(half, half, 0, half, half, rad);
      const a0 = Math.min(1, falloff[i].a * alphaMult);
      rg.addColorStop(0, `rgba(${r}, ${gr}, ${b}, ${a0})`);
      rg.addColorStop(midStop, `rgba(${r}, ${gr}, ${b}, ${(a0 * 0.5).toFixed(4)})`);
      rg.addColorStop(1, `rgba(${r}, ${gr}, ${b}, 0)`);
      g.fillStyle = rg;
      g.beginPath(); g.arc(half, half, rad, 0, Math.PI * 2); g.fill();
    }
    const coreR = half * Math.min(0.68, 0.28 * Math.pow(sm, 0.38));
    const core = g.createRadialGradient(half, half, 0, half, half, coreR);
    core.addColorStop(0.00, 'rgba(255, 255, 255, 1.0)');
    core.addColorStop(0.40, 'rgba(255, 255, 255, 0.78)');
    core.addColorStop(0.78, `rgba(${r}, ${gr}, ${b}, 0.35)`);
    core.addColorStop(1.00, 'rgba(255, 255, 255, 0)');
    g.fillStyle = core;
    g.beginPath(); g.arc(half, half, coreR, 0, Math.PI * 2); g.fill();
  }
  g.restore();
  FX_GLOW_SPRITE_CACHE[key] = off;
  return off;
}

function drawFxCachedGlow(targetCtx, x, y, radius, color, alpha = 1.0, mode = 'bloom', smooth = 1.0) {
  const spr = getFxDeepGlowSprite(color, mode, smooth);
  const d = radius * 2.5;
  targetCtx.globalAlpha = Math.max(0, Math.min(1, alpha));
  targetCtx.drawImage(spr, x - d * 0.5, y - d * 0.5, d, d);
}

function fxBuildShapePath(c, shape, r, customPoly) {
  c.beginPath();
  if (shape === 'circle' || shape === 'ring') {
    c.arc(0, 0, r, 0, Math.PI * 2);
    return shape === 'ring' ? 'stroke' : 'fill';
  }
  if (shape === 'line') {
    c.moveTo(-r * 1.7, 0);
    c.lineTo(r * 1.7, 0);
    return 'stroke';
  }
  if (shape === 'diamond') {
    c.moveTo(0, -r * 1.25); c.lineTo(r * 0.85, 0); c.lineTo(0, r * 1.25); c.lineTo(-r * 0.85, 0); c.closePath();
    return 'fill';
  }
  if (shape === 'square') {
    c.rect(-r * 0.85, -r * 0.85, r * 1.7, r * 1.7);
    return 'fill';
  }
  if (shape === 'triangle') {
    c.moveTo(r * 1.2, 0); c.lineTo(-r * 0.9, -r * 0.95); c.lineTo(-r * 0.9, r * 0.95); c.closePath();
    return 'fill';
  }
  if (shape === 'star4' || shape === 'star5') {
    const spikes = shape === 'star4' ? 4 : 5;
    const outer = r * 1.2, inner = r * (shape === 'star4' ? 0.32 : 0.48);
    for (let i = 0; i < spikes * 2; i++) {
      const rad = i % 2 === 0 ? outer : inner;
      const a = (i * Math.PI) / spikes - Math.PI / 2;
      if (i === 0) c.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
      else c.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
    }
    c.closePath();
    return 'fill';
  }
  if (shape === 'hex') {
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      if (i === 0) c.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    c.closePath();
    return 'fill';
  }
  if (shape === 'cross') {
    const w = r * 0.34, l = r * 1.1;
    c.moveTo(-w, -l); c.lineTo(w, -l); c.lineTo(w, -w);
    c.lineTo(l, -w); c.lineTo(l, w); c.lineTo(w, w);
    c.lineTo(w, l); c.lineTo(-w, l); c.lineTo(-w, w);
    c.lineTo(-l, w); c.lineTo(-l, -w); c.lineTo(-w, -w);
    c.closePath();
    return 'fill';
  }
  if (shape === 'shard') {
    c.moveTo(r * 1.55, 0); c.lineTo(-r * 0.45, -r * 0.58); c.lineTo(-r * 1.1, 0); c.lineTo(-r * 0.45, r * 0.58); c.closePath();
    return 'fill';
  }
  if (shape === 'crescent') {
    c.arc(0, 0, r, -Math.PI * 0.65, Math.PI * 0.65, false);
    c.arc(r * 0.35, 0, r * 0.78, Math.PI * 0.55, -Math.PI * 0.55, true);
    c.closePath();
    return 'fill';
  }
  if (shape === 'spiral') {
    const turns = 2.2, steps = 22;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const a = t * turns * Math.PI * 2;
      const rad = r * t;
      if (i === 0) c.moveTo(0, 0); else c.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
    }
    return 'stroke';
  }
  if (shape === 'customPoly') {
    const pts = (Array.isArray(customPoly) && customPoly.length >= 2) ? customPoly : null;
    if (pts) {
      c.moveTo(pts[0].x * r, pts[0].y * r);
      for (let i = 1; i < pts.length; i++) c.lineTo(pts[i].x * r, pts[i].y * r);
      if (pts.length >= 3) c.closePath();
      return pts.length >= 3 ? 'fill' : 'stroke';
    }
  }
  c.arc(0, 0, r, 0, Math.PI * 2);
  return 'fill';
}

function fxGetPolyKey(shape, customPoly) {
  if (shape !== 'customPoly' || !Array.isArray(customPoly)) return shape || 'circle';
  let k = _fxShapeKeyMap.get(customPoly);
  if (k) return k;
  k = 'poly';
  for (let i = 0; i < customPoly.length; i++) {
    k += '_' + Math.round(customPoly[i].x * 100) + ',' + Math.round(customPoly[i].y * 100);
  }
  _fxShapeKeyMap.set(customPoly, k);
  return k;
}

// Кэш 48x48 Offscreen-спрайтов для кастомных форм (customPoly и нестандартные shape)
function getFxPolySprite(shape, customPoly, color, mode = 'fill', lineWidth = 1.6) {
  syncFxCachePalette();
  const shapeKey = fxGetPolyKey(shape, customPoly);
  const col = color || '#ffffff';
  const cacheKey = `${shapeKey}_${col}_${mode}`;
  if (FX_POLY_SPRITE_CACHE[cacheKey]) return FX_POLY_SPRITE_CACHE[cacheKey];

  const size = 48, half = 24, r = 16;
  const off = createFxOffscreenCanvas(size);
  const c = off.getContext('2d');
  c.save();
  c.translate(half, half);
  const pref = fxBuildShapePath(c, shape, r, customPoly);
  const effMode = (pref === 'stroke' && mode === 'fill') ? 'stroke' : (mode || pref);
  if (effMode === 'fill' || effMode === 'both') {
    c.fillStyle = col;
    c.fill();
  }
  if (effMode === 'stroke' || effMode === 'both') {
    c.strokeStyle = effMode === 'both' ? '#ffffff' : col;
    c.lineWidth = Math.max(1.0, lineWidth || 1.6);
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.stroke();
  }
  c.restore();
  FX_POLY_SPRITE_CACHE[cacheKey] = off;
  return off;
}

function drawFxStyledShape(c, shape, r, color, mode, lineWidth, customPoly) {
  const rad = Math.max(0.5, r);
  if (mode === 'stroke' && rad > 18) {
    const pref = fxBuildShapePath(c, shape, rad, customPoly);
    c.strokeStyle = color;
    c.lineWidth = Math.max(0.8, lineWidth || 1.6);
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.stroke();
    return;
  }
  const spr = getFxPolySprite(shape, customPoly, color, mode || 'fill', lineWidth || 1.6);
  const drawHalf = rad * (24 / 16);
  c.drawImage(spr, -drawHalf, -drawHalf, drawHalf * 2, drawHalf * 2);
}

function addFxPart(p) {
  const cap = (typeof perfMode !== 'undefined' && perfMode === 'low') ? 180 : 520;
  if (fxLayerParts.length >= cap) fxLayerParts.shift();
  fxLayerParts.push(p);
}

function spawnFxMuzzleLayers(mx, my, profileKey, towerColor, angle) {
  const prof = TOWER_FX && TOWER_FX[profileKey];
  if (!prof || !Array.isArray(prof.layers)) return;
  const scale = prof.blastScale || 1.0;
  for (let i = 0; i < prof.layers.length; i++) {
    const layer = prof.layers[i];
    if (!layer.enabled || layer.type !== 'muzzleFlash') continue;
    const p = layer.params || {};
    const spd = Math.max(0.15, p.speed || 1.0);
    const life = Math.max(0.05, (p.duration || 0.18) / spd);
    const col = fxResolveColor(p, towerColor);
    addFxPart({
      kind: 'muzzle', x: mx, y: my, col, ang: angle,
      r: 22 * scale * (p.size || 1.0),
      smooth: p.smooth || 1.0,
      alpha: p.opacity !== undefined ? p.opacity : 1.0,
      shape: p.shape || 'default',
      customPoly: p.customPoly,
      life, max: life
    });
  }
}

function spawnFxHitLayers(x, y, profileKey, towerColor, dirAngle = null, mobR = 13) {
  const prof = TOWER_FX && TOWER_FX[profileKey];
  if (!prof || !Array.isArray(prof.layers)) return;
  const isLow = (typeof perfMode !== 'undefined' && perfMode === 'low');
  const scale = prof.blastScale || 1.0;
  const baseR = TOWER_FX_BASE_R[profileKey] || 24;
  const R = baseR * scale;
  const isMortar = profileKey === 'mortar';
  const hasDir = typeof dirAngle === 'number' && !isMortar && profileKey !== 'tesla' && profileKey !== 'stasis';
  const baseA = typeof dirAngle === 'number' ? dirAngle : 0;

  for (let li = 0; li < prof.layers.length; li++) {
    const layer = prof.layers[li];
    if (!layer.enabled) continue;
    const p = layer.params || {};
    const col = fxResolveColor(p, towerColor);
    const sz = Math.max(0.1, p.size !== undefined ? p.size : 1.0);
    const spdM = Math.max(0.15, p.speed !== undefined ? p.speed : 1.0);
    const op = Math.max(0, Math.min(1, p.opacity !== undefined ? p.opacity : 1.0));
    const sh = p.shape || 'default';
    const poly = p.customPoly;
    const cntScale = isLow ? 0.55 : 1.0;

    switch (layer.type) {
      case 'groundBounce': {
        const life = Math.max(0.04, (p.duration || 0.30) / spdM);
        addFxPart({ kind: 'bounce', x, y: y + 4, col, r: R * 1.55 * sz, smooth: p.smooth || 1.0, flicker: !!p.flicker, alpha: op, life, max: life });
        break;
      }
      case 'volumeHalo': {
        const life = Math.max(0.04, (p.duration || 0.34) / spdM);
        addFxPart({ kind: 'volhalo', x, y, col, r: R * 1.35 * sz, smooth: p.smooth || 1.0, flicker: !!p.flicker, alpha: op, life, max: life });
        break;
      }
      case 'deepGlow': {
        const life = Math.max(0.04, (p.duration || 0.28) / spdM);
        addFxPart({ kind: 'glow', x, y, col, r: R * 1.05 * sz, smooth: p.smooth || 1.0, flicker: !!p.flicker, alpha: op, life, max: life });
        break;
      }
      case 'smoke': {
        const cnt = Math.max(1, Math.round((p.count || 3) * cntScale));
        const spread = p.spread !== undefined ? p.spread : 0.45;
        const life = Math.max(0.1, (p.duration || 0.85) / Math.pow(spdM, 0.5));
        for (let s = 0; s < cnt; s++) {
          const a = cnt === 1 ? Math.random() * 6.283 : (s / cnt) * 6.283 + (Math.random() - 0.5) * 0.5;
          const d = cnt === 1 ? 0 : (0.15 + Math.random() * 0.45) * R * (spread / 0.45);
          const spd = (10 + Math.random() * 18) * spdM;
          addFxPart({
            kind: 'smoke', x: x + Math.cos(a) * d, y: y + Math.sin(a) * d,
            vx: Math.cos(a) * spd, vy: Math.sin(a) * spd - 8 * spdM, drag: 0.95,
            col, r: ((isMortar ? 16 : 11) + Math.random() * 8) * sz * scale,
            p3d: !!p.p3d, hot: !!p.hot, alpha: op, shape: sh, customPoly: poly,
            rot: Math.random() * 6.283, vRot: (Math.random() - 0.5) * 1.5,
            life, max: life
          });
        }
        break;
      }
      case 'threePhaseCore': {
        const cnt = Math.max(1, Math.round(p.count || 5));
        const baseLife = Math.max(0.06, (p.duration || 0.34) / spdM);
        for (let b = 0; b < cnt; b++) {
          const a = b === 0 ? 0 : (b / (cnt - 1)) * 6.283;
          const d = b === 0 ? 0 : R * 0.25 * sz;
          const spd = b === 0 ? 0 : 28 * spdM;
          const life = b === 0 ? baseLife : baseLife * 0.85;
          addFxPart({
            kind: 'core3', x: x + Math.cos(a) * d, y: y + Math.sin(a) * d,
            vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, drag: 0.88,
            col, r: (b === 0 ? R * 0.56 : R * 0.32) * sz,
            smooth: p.smooth || 1.0, flicker: !!p.flicker, fakeGlow: p.fakeGlow !== false,
            alpha: op, shape: sh, customPoly: poly, rot: a,
            life, max: life
          });
        }
        break;
      }
      case 'perpFlash': {
        const life = Math.max(0.04, (p.duration || 0.14) / spdM);
        addFxPart({
          kind: 'perp', x, y, col,
          r: (isMortar ? R * 0.75 : 20 * scale) * sz,
          smooth: p.smooth || 1.0, ang: baseA + Math.PI / 2,
          alpha: op, shape: sh, customPoly: poly,
          life, max: life
        });
        break;
      }
      case 'crossFlash': {
        const cnt = Math.max(1, Math.round((p.count || 10) * cntScale));
        const baseDur = p.duration || 0.28;
        for (let s = 0; s < cnt; s++) {
          const a = Math.random() * 6.283;
          const spd = (isMortar ? 160 + Math.random() * 190 : 120 + Math.random() * 150) * scale * spdM;
          const life = Math.max(0.06, (baseDur * (0.75 + Math.random() * 0.5)) / Math.pow(spdM, 0.35));
          addFxPart({
            kind: 'shard', x, y,
            vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, drag: 0.91,
            col, r: (2.3 + Math.random() * 1.1) * sz, alpha: op,
            shape: sh, customPoly: poly, rot: a,
            life, max: life
          });
        }
        break;
      }
      case 'arcLightning': {
        const cnt = Math.max(1, Math.round((p.count || 3) * cntScale));
        const life = Math.max(0.04, (p.duration || 0.18) / spdM);
        for (let a = 0; a < cnt; a++) {
          const ang = Math.random() * 6.283;
          const len = (isMortar ? R * 0.85 : 32 * scale) * sz * (0.8 + Math.random() * 0.5);
          const pts = [0];
          for (let k = 1; k < 4; k++) pts.push((Math.random() - 0.5) * 14 * sz);
          pts.push(0);
          addFxPart({
            kind: 'arc', x, y, col, ang, len, pts,
            thickness: p.thickness || 1.0, alpha: op, life, max: life
          });
        }
        break;
      }
      case 'shockwave': {
        const dur = Math.max(0.06, (p.duration || 0.32) / spdM);
        const lw = p.thickness || 2.2;
        if (p.doubleWave) {
          fxLayerWaves.push({ x, y, maxR: R * 1.25 * sz, col, dur: dur * 0.75, t: 0, lw: lw * 0.7, alpha: op, shape: sh, customPoly: poly });
          fxLayerWaves.push({ x, y, maxR: R * 0.82 * sz, col, dur: dur * 1.18, t: 0, lw: lw * 1.45, alpha: op, shape: sh, customPoly: poly });
        } else {
          fxLayerWaves.push({ x, y, maxR: R * 1.15 * sz, col, dur, t: 0, lw, alpha: op, shape: sh, customPoly: poly });
        }
        break;
      }
      case 'rgbRing': {
        const dur = Math.max(0.06, (p.duration || 0.30) / spdM);
        const lw = p.thickness || 1.5;
        const off = p.offset !== undefined ? p.offset : 1.8;
        fxLayerWaves.push({ x: x - off, y: y - off * 0.6, maxR: R * 1.12 * sz, col: '#00e5ff', dur, t: 0, lw, alpha: op, shape: sh, customPoly: poly });
        fxLayerWaves.push({ x: x + off, y: y + off * 0.6, maxR: R * 1.06 * sz, col: '#f05f9f', dur: dur * 1.06, t: 0, lw, alpha: op, shape: sh, customPoly: poly });
        break;
      }
      case 'plasmaVortex': {
        const arcCnt = Math.max(1, Math.round((p.count || 3) * cntScale));
        const vSpread = p.spread !== undefined ? p.spread : 1.0;
        const vDur = Math.max(0.05, p.duration || 0.32);
        for (let v = 0; v < arcCnt; v++) {
          const ringStep = arcCnt > 1 ? (v / (arcCnt - 1)) : 0;
          const radiusMult = 0.55 + ringStep * 0.65 * vSpread;
          addFxPart({
            kind: 'vortex', x, y, col,
            r: (isMortar ? R * 0.55 : 22 * scale) * radiusMult * sz,
            ang: (v / arcCnt) * 6.283 + Math.random() * 0.4,
            vRot: (v % 2 === 0 ? 1 : -1) * (6.5 + Math.random() * 3) * spdM,
            span: 1.1 + Math.random() * 0.7,
            lw: p.thickness || 2.2, alpha: op,
            life: vDur, max: vDur
          });
        }
        break;
      }
      case 'implosionLines': {
        const cnt = Math.max(2, Math.round((p.count || 10) * cntScale));
        const life = Math.max(0.06, (p.duration || 0.24) / spdM);
        for (let i = 0; i < cnt; i++) {
          const ang = (i / cnt) * 6.283 + Math.random() * 0.3;
          const startR = R * (1.2 + Math.random() * 0.4) * sz;
          const len = (14 + Math.random() * 12) * sz;
          addFxPart({ kind: 'implode', x, y, col, ang, startR, len, lw: p.thickness || 2.0, alpha: op, life, max: life });
        }
        break;
      }
      case 'sparks': {
        const spCnt = Math.max(1, Math.round((p.count || 10) * cntScale));
        const sRng = Math.max(0.25, p.range !== undefined ? p.range : 1.0);
        const sDrag = Math.pow(0.89, spdM / sRng);
        const sLife = Math.max(0.05, (p.duration || 0.28) * (sRng / spdM));
        for (let i = 0; i < spCnt; i++) {
          const a = (p.directionalCone && hasDir)
            ? baseA + (Math.random() - 0.5) * 1.05
            : (i / spCnt) * 6.283 + (Math.random() - 0.5) * 0.4;
          const spd = (isMortar ? 110 + Math.random() * 170 : 90 + Math.random() * 120) * scale * spdM;
          addFxPart({
            kind: 'spark', x, y, px: x, py: y,
            vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, drag: sDrag,
            col, temp: !!p.tempGradient, stretch: !!p.velocityStretch,
            stretchMult: p.stretch !== undefined ? p.stretch : 1.0,
            cf: p.centerFade !== undefined ? p.centerFade : 0.0,
            r: 2.3 * sz, alpha: op, shape: sh, customPoly: poly,
            life: sLife, max: sLife
          });
        }
        break;
      }
      case 'exitSparks': {
        const cnt = Math.max(1, Math.round((p.count || 4) * cntScale));
        const sRng = Math.max(0.25, p.range !== undefined ? p.range : 1.0);
        const sDrag = Math.pow(0.89, spdM / sRng);
        const exLife = Math.max(0.05, (p.duration || 0.22) * (sRng / spdM));
        const exA = hasDir ? baseA : (Math.random() * 6.283);
        const ex = x + Math.cos(exA) * (mobR * 1.7);
        const ey = y + Math.sin(exA) * (mobR * 1.7);
        for (let e = 0; e < cnt; e++) {
          const a = exA + (Math.random() - 0.5) * 0.6;
          const spd = (120 + Math.random() * 90) * scale * spdM;
          addFxPart({
            kind: 'spark', x: ex, y: ey, px: ex, py: ey,
            vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, drag: sDrag,
            col, temp: !!p.tempGradient, stretch: !!p.velocityStretch,
            stretchMult: p.stretch !== undefined ? p.stretch : 1.0,
            cf: p.centerFade !== undefined ? p.centerFade : 0.0,
            r: 1.9 * sz, alpha: op, shape: sh, customPoly: poly,
            life: exLife, max: exLife
          });
        }
        break;
      }
      case 'sineEmbers': {
        const cnt = Math.max(1, Math.round((p.count || 10) * cntScale));
        const spread = p.spread !== undefined ? p.spread : 0.70;
        const life = Math.max(0.1, (p.duration || 0.85) / Math.pow(spdM, 0.35));
        const amp = p.waveAmp !== undefined ? p.waveAmp : 14;
        for (let e = 0; e < cnt; e++) {
          const spawnA = Math.random() * 6.283;
          const spawnD = Math.random() * R * 0.35 * spread;
          const flyA = Math.random() * 6.283;
          const flySpd = (18 + Math.random() * 44) * Math.max(0.4, spread) * spdM;
          addFxPart({
            kind: 'ember',
            x: x + Math.cos(spawnA) * spawnD, y: y + Math.sin(spawnA) * spawnD,
            vx: Math.cos(flyA) * flySpd, vy: Math.sin(flyA) * flySpd, drag: 0.96,
            amp: amp * (0.7 + Math.random() * 0.6), freq: (6 + Math.random() * 5) * spdM, ph: Math.random() * 6.283,
            col, r: 2.1 * sz, alpha: op, shape: sh, customPoly: poly,
            life, max: life
          });
        }
        break;
      }
      case 'energyMotes': {
        const cnt = Math.max(1, Math.round((p.count || 10) * cntScale));
        const spread = p.spread !== undefined ? p.spread : 0.45;
        const life = Math.max(0.1, (p.duration || 0.95) / Math.pow(spdM, 0.35));
        for (let m = 0; m < cnt; m++) {
          const ma = Math.random() * 6.283, md = Math.random() * R * spread;
          const spd = (12 + Math.random() * 28) * spdM;
          addFxPart({
            kind: 'mote',
            x: x + Math.cos(ma) * md, y: y + Math.sin(ma) * md,
            vx: (Math.random() - 0.5) * spd, vy: (-10 - Math.random() * 18) * spdM,
            drag: 0.94, col,
            r: (4 + Math.random() * 5) * scale * sz,
            smooth: p.smooth || 1.0, alpha: op, shape: sh, customPoly: poly,
            ph: Math.random() * 6.283, life, max: life
          });
        }
        break;
      }
      case 'coolingEmbers': {
        const cnt = Math.max(1, Math.round((p.count || 5) * cntScale));
        const spread = p.spread !== undefined ? p.spread : 0.55;
        const life = Math.max(0.1, (p.duration || 0.85) / Math.pow(spdM, 0.4));
        for (let c = 0; c < cnt; c++) {
          const a = Math.random() * 6.283, d = Math.random() * R * spread;
          addFxPart({
            kind: 'cool', x: x + Math.cos(a) * d, y: y + Math.sin(a) * d,
            col, r: 1.6 * sz, ph: Math.random() * 6.283, pulseSpd: 18 * spdM,
            alpha: op, shape: sh, customPoly: poly, life, max: life
          });
        }
        break;
      }
      case 'customShape': {
        const cnt = Math.max(1, Math.round((p.count || 8) * cntScale));
        const life = Math.max(0.06, (p.duration || 0.55) / Math.pow(spdM, 0.45));
        const spread = p.spread !== undefined ? p.spread : 1.0;
        const motion = p.motion || 'burst';
        for (let i = 0; i < cnt; i++) {
          const a = motion === 'cone'
            ? baseA + (Math.random() - 0.5) * 1.0
            : (i / cnt) * 6.283 + (Math.random() - 0.5) * 0.25;
          let sx = x, sy = y, vx = 0, vy = 0, startR = 0;
          if (motion === 'burst' || motion === 'cone' || motion === 'wave') {
            const spd = (55 + Math.random() * 95) * scale * spread * spdM;
            vx = Math.cos(a) * spd;
            vy = Math.sin(a) * spd;
          } else if (motion === 'implode') {
            startR = R * 1.15 * spread * (0.75 + Math.random() * 0.5);
            sx = x + Math.cos(a) * startR;
            sy = y + Math.sin(a) * startR;
          } else if (motion === 'spin') {
            const d = cnt > 1 ? R * 0.35 * spread : 0;
            sx = x + Math.cos(a) * d;
            sy = y + Math.sin(a) * d;
          }
          addFxPart({
            kind: 'custom', x: sx, y: sy, ox: x, oy: y,
            vx, vy, drag: motion === 'burst' || motion === 'cone' ? 0.92 : 0.96,
            motion, ang: a, startR,
            col, r: 9 * sz * scale,
            shape: sh === 'default' ? 'star4' : sh,
            customPoly: poly,
            drawMode: p.drawMode || 'both',
            blendMode: p.blendMode || 'lighter',
            lw: p.lineWidth || 1.8,
            rot: a, vRot: (p.rotSpeed !== undefined ? p.rotSpeed : 3.5) * spdM,
            ph: Math.random() * 6.283,
            alpha: op, life, max: life
          });
        }
        break;
      }
    }
  }
}

function spawnEnemySpawnFx(x, y, enemy) {
  if (typeof MOB_SPAWN_FX === 'undefined' || !Array.isArray(MOB_SPAWN_FX.layers)) return;
  const isLow = (typeof perfMode !== 'undefined' && perfMode === 'low');
  const enemyColor = (enemy && enemy.color) ? enemy.color : '#f05f9f';
  const isBoss = !!(enemy && enemy.isBoss);
  const isMiniBoss = !!(enemy && !isBoss && (enemy.isMiniBoss || enemy.type === 'goliath'));
  const isSwarm = !!(enemy && !isBoss && !isMiniBoss && enemy.type === 'swarm');

  let countMult = 1.0;
  let lineScale = 1.0;
  let glowScale = 1.0;
  let alphaMult = 1.0;

  if (isSwarm) {
    countMult = 0.5;
    lineScale = 0.6;
    glowScale = 0.5;
    alphaMult = 0.45;
  } else if (isMiniBoss) {
    countMult = 1.65;
    lineScale = 1.35;
    glowScale = 1.4;
    alphaMult = 1.0;
  } else if (isBoss) {
    countMult = 2.4;
    lineScale = 1.75;
    glowScale = 1.85;
    alphaMult = 1.0;
  }

  const cntPerfScale = isLow ? 0.55 : 1.0;
  const baseR = 24 * (MOB_SPAWN_FX.blastScale || 1.0);

  for (let i = 0; i < MOB_SPAWN_FX.layers.length; i++) {
    const layer = MOB_SPAWN_FX.layers[i];
    if (!layer || !layer.enabled) continue;
    const p = layer.params || {};
    const col = (p.colorMode === 'white')
      ? '#ffffff'
      : ((p.colorMode === 'custom' && p.customColor) ? p.customColor : enemyColor);
    const sz = Math.max(0.1, p.size !== undefined ? p.size : 1.0);
    const spdM = Math.max(0.15, p.speed !== undefined ? p.speed : 1.0);
    const op = Math.max(0, Math.min(1, (p.opacity !== undefined ? p.opacity : 1.0) * alphaMult));

    if (layer.type === 'implosionLines') {
      const cnt = Math.max(2, Math.round((p.count || 7) * countMult * cntPerfScale));
      const life = Math.max(0.06, (p.duration || 0.24) / spdM);
      const lw = (p.thickness || 2.0) * (isBoss ? 1.25 : (isSwarm ? 0.75 : 1.0));
      for (let k = 0; k < cnt; k++) {
        const ang = (k / cnt) * 6.283 + Math.random() * 0.3;
        const startR = baseR * (1.2 + Math.random() * 0.4) * sz * lineScale;
        const len = (14 + Math.random() * 12) * sz * lineScale;
        addFxPart({
          kind: 'implode', x, y, col, ang, startR, len,
          lw, alpha: op, life, max: life
        });
      }
    } else if (layer.type === 'deepGlow') {
      const life = Math.max(0.04, (p.duration || 0.28) / spdM);
      addFxPart({
        kind: 'glow', x, y, col,
        r: baseR * 1.05 * sz * glowScale,
        smooth: p.smooth || 1.0,
        flicker: !!p.flicker,
        alpha: op,
        life, max: life
      });
    }
  }
}
if (typeof window !== 'undefined') {
  window.spawnEnemySpawnFx = spawnEnemySpawnFx;
}

function spawnEnemyBaseHitFx(x, y, enemy) {
  if (typeof MOB_BASE_HIT_FX === 'undefined' || !Array.isArray(MOB_BASE_HIT_FX.layers)) return;
  const isLow = (typeof perfMode !== 'undefined' && perfMode === 'low');
  const th = (typeof getTheme === 'function')
    ? getTheme()
    : { c1: '#00e5ff', c3: '#f05f9f', c3Light: '#ff8fb0' };
  const primaryCol = th.c1 || '#00e5ff';
  const dmgCol = th.c3 || '#f05f9f';
  const dmgLightCol = th.c3Light || dmgCol;

  const isBoss = !!(enemy && enemy.isBoss);
  const isMiniBoss = !!(enemy && !isBoss && (enemy.isMiniBoss || enemy.type === 'goliath'));
  const isSwarm = !!(enemy && !isBoss && !isMiniBoss && enemy.type === 'swarm');

  let sizeMult = 1.0;
  let countMult = 1.0;
  let durMult = 1.0;
  let alphaMult = 1.0;

  if (isSwarm) {
    sizeMult = 0.55;
    countMult = 0.30;
    durMult = 0.75;
    alphaMult = 0.75;
  } else if (isMiniBoss) {
    sizeMult = 1.35;
    countMult = 1.40;
    durMult = 1.25;
    alphaMult = 1.0;
  } else if (isBoss) {
    sizeMult = 1.75;
    countMult = 1.85;
    durMult = 1.50;
    alphaMult = 1.0;
  }

  const cntPerfScale = isLow ? 0.50 : 1.0;
  const scale = (MOB_BASE_HIT_FX.blastScale || 1.0) * sizeMult;
  const R = 34 * scale;

  const resolveBaseHitColor = (p) => {
    if (!p) return dmgCol;
    if (p.colorMode === 'white') return '#ffffff';
    if (p.colorMode === 'themeBaseDmg') return dmgCol;
    if (p.colorMode === 'themeBaseDmgLight') return dmgLightCol;
    if (p.colorMode === 'themeBaseShield') return primaryCol;
    return p.customColor || dmgCol;
  };

  for (let i = 0; i < MOB_BASE_HIT_FX.layers.length; i++) {
    const layer = MOB_BASE_HIT_FX.layers[i];
    if (!layer || !layer.enabled) continue;
    const p = layer.params || {};
    const col = resolveBaseHitColor(p);
    const sz = Math.max(0.1, p.size !== undefined ? p.size : 1.0);
    const spdM = Math.max(0.15, p.speed !== undefined ? p.speed : 1.0);
    const op = Math.max(0, Math.min(1, (p.opacity !== undefined ? p.opacity : 1.0) * alphaMult));
    const sh = p.shape || 'default';
    const poly = p.customPoly;

    switch (layer.type) {
      case 'deepGlow': {
        const life = Math.max(0.05, ((p.duration || 0.42) * durMult) / spdM);
        addFxPart({
          kind: 'glow', x, y, col,
          r: R * 1.05 * sz,
          smooth: p.smooth || 1.0,
          flicker: !!p.flicker,
          alpha: op,
          life, max: life
        });
        break;
      }
      case 'volumeHalo': {
        const life = Math.max(0.05, ((p.duration || 0.55) * durMult) / spdM);
        addFxPart({
          kind: 'volhalo', x, y, col,
          r: R * 1.35 * sz,
          smooth: p.smooth || 1.0,
          flicker: !!p.flicker,
          alpha: op,
          life, max: life
        });
        break;
      }
      case 'threePhaseCore': {
        const cnt = Math.max(1, Math.round((p.count || 3) * (isLow ? 0.65 : 1.0)));
        const baseLife = Math.max(0.06, ((p.duration || 0.45) * durMult) / spdM);
        for (let b = 0; b < cnt; b++) {
          const a = b === 0 ? 0 : (b / (cnt - 1)) * 6.283;
          const d = b === 0 ? 0 : R * 0.25 * sz;
          const spd = b === 0 ? 0 : 28 * spdM;
          const life = b === 0 ? baseLife : baseLife * 0.85;
          addFxPart({
            kind: 'core3', x: x + Math.cos(a) * d, y: y + Math.sin(a) * d,
            vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, drag: 0.88,
            col, r: (b === 0 ? R * 0.56 : R * 0.32) * sz,
            smooth: p.smooth || 1.0, flicker: !!p.flicker, fakeGlow: p.fakeGlow !== false,
            alpha: op, shape: sh, customPoly: poly, rot: a,
            life, max: life
          });
        }
        break;
      }
      case 'plasmaVortex': {
        const arcCnt = Math.max(1, Math.round((p.count || 4) * Math.min(1.5, Math.max(0.6, countMult)) * cntPerfScale));
        const vSpread = p.spread !== undefined ? p.spread : 1.0;
        const vDur = Math.max(0.06, (p.duration || 0.36) * durMult);
        for (let v = 0; v < arcCnt; v++) {
          const ringStep = arcCnt > 1 ? (v / (arcCnt - 1)) : 0;
          const radiusMult = 0.55 + ringStep * 0.65 * vSpread;
          addFxPart({
            kind: 'vortex', x, y, col,
            r: R * 0.65 * radiusMult * sz,
            ang: (v / arcCnt) * 6.283 + Math.random() * 0.4,
            vRot: (v % 2 === 0 ? 1 : -1) * (6.5 + Math.random() * 3) * spdM,
            span: 1.1 + Math.random() * 0.7,
            lw: (p.thickness || 2.0) * (isBoss ? 1.2 : 1.0),
            alpha: op,
            life: vDur, max: vDur
          });
        }
        break;
      }
      case 'rgbRing': {
        const dur = Math.max(0.08, ((p.duration || 0.38) * durMult) / spdM);
        const lw = (p.thickness || 2.0) * (isBoss ? 1.25 : 1.0);
        const off = (p.offset !== undefined ? p.offset : 2.4) * Math.max(0.75, sizeMult);
        fxLayerWaves.push({
          x: x - off, y: y - off * 0.6,
          maxR: R * 1.18 * sz, col: primaryCol, dur, t: 0, lw,
          alpha: op, shape: sh, customPoly: poly
        });
        fxLayerWaves.push({
          x: x + off, y: y + off * 0.6,
          maxR: R * 1.10 * sz, col: dmgCol, dur: dur * 1.08, t: 0, lw,
          alpha: op, shape: sh, customPoly: poly
        });
        break;
      }
      case 'coolingEmbers': {
        const cnt = Math.max(1, Math.round((p.count || 8) * countMult * cntPerfScale));
        const spread = p.spread !== undefined ? p.spread : 0.75;
        const life = Math.max(0.12, ((p.duration || 0.90) * durMult) / Math.pow(spdM, 0.4));
        for (let c = 0; c < cnt; c++) {
          const a = Math.random() * 6.283;
          const d = Math.random() * R * spread;
          addFxPart({
            kind: 'cool', x: x + Math.cos(a) * d, y: y + Math.sin(a) * d,
            col, r: 1.7 * sz * Math.max(0.7, sizeMult * 0.85),
            ph: Math.random() * 6.283, pulseSpd: 18 * spdM,
            alpha: op, shape: sh, customPoly: poly,
            life, max: life
          });
        }
        break;
      }
      case 'sparks': {
        const spCnt = Math.max(4, Math.round((p.count || 40) * countMult * cntPerfScale));
        const sRng = Math.max(0.25, p.range !== undefined ? p.range : 1.2);
        const sDrag = Math.pow(0.89, spdM / sRng);
        const sLife = Math.max(0.06, ((p.duration || 0.36) * durMult) * (sRng / spdM));
        for (let k = 0; k < spCnt; k++) {
          const a = (k / spCnt) * 6.283 + (Math.random() - 0.5) * 0.4;
          const spd = (95 + Math.random() * 165) * scale * spdM;
          addFxPart({
            kind: 'spark', x, y, px: x, py: y,
            vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, drag: sDrag,
            col, temp: !!p.tempGradient, stretch: !!p.velocityStretch,
            stretchMult: (p.stretch !== undefined ? p.stretch : 1.25) * (isBoss ? 1.25 : 1.0),
            cf: p.centerFade !== undefined ? p.centerFade : 0.05,
            r: 2.3 * sz * Math.max(0.75, Math.min(1.4, sizeMult)),
            alpha: op, shape: sh, customPoly: poly,
            life: sLife, max: sLife
          });
        }
        break;
      }
    }
  }
}
if (typeof window !== 'undefined') {
  window.spawnEnemyBaseHitFx = spawnEnemyBaseHitFx;
}

function updateAndDrawFxLayers(dt, nowSec) {
  if (fxLayerWaves.length === 0 && fxLayerParts.length === 0) return;
  syncFxCachePalette();

  // Ударные волны и хроматик-кольца (rgbRing / shockwave)
  for (let i = fxLayerWaves.length - 1; i >= 0; i--) {
    const w = fxLayerWaves[i];
    w.t += dt;
    if (w.t >= w.dur) { fxLayerWaves.splice(i, 1); continue; }
    const pr = w.t / w.dur;
    const r = Math.max(1, w.maxR * Math.sin(pr * 1.570796));
    ctx.save();
    ctx.translate(w.x, w.y);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = (1 - pr) * (w.alpha !== undefined ? w.alpha : 1.0);
    const lw = Math.max(0.5, w.lw * (1 - pr * 0.85));
    if (!w.shape || w.shape === 'default' || w.shape === 'circle' || w.shape === 'ring') {
      ctx.strokeStyle = w.col;
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      drawFxStyledShape(ctx, w.shape, r, w.col, 'stroke', lw, w.customPoly);
    }
    ctx.restore();
  }

  // Частицы и слои свечений (1-в-1 с Sandbox v11)
  for (let i = fxLayerParts.length - 1; i >= 0; i--) {
    const p = fxLayerParts[i];
    p.px = p.x; p.py = p.y;
    if (dt > 0) {
      if (p.drag) { const d = Math.pow(p.drag, dt * 60); p.vx *= d; p.vy *= d; }
      if (p.kind === 'ember') {
        const perpA = Math.atan2(p.vy, p.vx) + Math.PI / 2;
        const waveOffset = Math.cos(nowSec * p.freq + p.ph) * p.amp;
        p.x += (p.vx + Math.cos(perpA) * waveOffset) * dt;
        p.y += (p.vy + Math.sin(perpA) * waveOffset) * dt;
      } else if (p.kind === 'custom' && p.motion === 'wave') {
        const perpA = Math.atan2(p.vy, p.vx) + Math.PI / 2;
        const waveOffset = Math.cos(nowSec * 9 + p.ph) * 22;
        p.x += (p.vx + Math.cos(perpA) * waveOffset) * dt;
        p.y += (p.vy + Math.sin(perpA) * waveOffset) * dt;
      } else if (p.vx || p.vy) {
        p.x += p.vx * dt; p.y += p.vy * dt;
      }
      if (p.vRot && p.kind !== 'vortex') p.rot = (p.rot || 0) + p.vRot * dt;
      p.life -= dt;
      if (p.life <= 0) { fxLayerParts.splice(i, 1); continue; }
    }

    const prog = Math.max(0, Math.min(1, p.life / p.max));
    const age = 1 - prog;
    const op = p.alpha !== undefined ? p.alpha : 1.0;
    const flk = p.flicker ? (0.85 + Math.random() * 0.3) : 1;

    ctx.save();
    if (p.kind === 'bounce') {
      ctx.globalCompositeOperation = 'lighter';
      ctx.translate(p.x, p.y); ctx.scale(1.15, 0.52);
      drawFxCachedGlow(ctx, 0, 0, p.r * flk, p.col, prog * 0.9 * op, 'ground', p.smooth || 1.0);
    } else if (p.kind === 'volhalo') {
      ctx.globalCompositeOperation = 'lighter';
      drawFxCachedGlow(ctx, p.x, p.y, p.r * flk, p.col, prog * 0.85 * op, 'volume', p.smooth || 1.0);
    } else if (p.kind === 'smoke') {
      const r = p.r * (0.75 + age * 1.2);
      ctx.globalAlpha = prog * op;
      if (p.shape && p.shape !== 'default' && p.shape !== 'circle') {
        ctx.translate(p.x, p.y); ctx.rotate(p.rot || 0);
        const el = p.max - p.life;
        const c = (p.hot && el < 0.2) ? p.col : 'rgba(58,66,92,0.85)';
        drawFxStyledShape(ctx, p.shape, r, c, 'fill', 1.5, p.customPoly);
      } else {
        if (p.p3d) {
          ctx.fillStyle = 'rgba(10,14,26,0.85)';
          ctx.beginPath(); ctx.arc(p.x, p.y + r * 0.2, r * 0.9, 0, Math.PI * 2); ctx.fill();
        }
        const el = p.max - p.life;
        const sg = ctx.createRadialGradient(p.x, p.y, r * 0.1, p.x, p.y, r);
        if (p.hot && el < 0.2) {
          const rgb = fxHexRgb(p.col);
          sg.addColorStop(0, `rgba(${rgb.r},${rgb.g},${rgb.b},${(0.75 * (1 - el / 0.2)).toFixed(2)})`);
          sg.addColorStop(0.5, 'rgba(42,48,70,0.8)');
        } else {
          sg.addColorStop(0, 'rgba(58,66,92,0.8)');
        }
        sg.addColorStop(1, 'transparent');
        ctx.fillStyle = sg;
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
      }
    } else if (p.kind === 'cool') {
      ctx.globalCompositeOperation = 'lighter';
      const pulse = 0.45 + 0.55 * Math.sin(p.life * (p.pulseSpd || 18) + p.ph);
      ctx.globalAlpha = prog * pulse * op;
      if (p.shape && p.shape !== 'default') {
        ctx.translate(p.x, p.y);
        drawFxStyledShape(ctx, p.shape, p.r * 1.4, p.col, 'fill', 1.2, p.customPoly);
      } else {
        ctx.fillStyle = p.col;
        const s = p.r * 1.6;
        ctx.fillRect(p.x - s * 0.5, p.y - s * 0.5, s, s);
      }
    } else if (p.kind === 'custom') {
      ctx.globalCompositeOperation = p.blendMode || 'lighter';
      let cx = p.x, cy = p.y, curR = p.r;
      if (p.motion === 'expand') {
        curR = p.r * (0.25 + age * 2.2);
      } else if (p.motion === 'implode') {
        const dist = p.startR * prog;
        cx = p.ox + Math.cos(p.ang) * dist;
        cy = p.oy + Math.sin(p.ang) * dist;
        curR = p.r * (0.35 + prog * 0.65);
      } else {
        curR = p.r * (0.3 + prog * 0.7);
      }
      ctx.translate(cx, cy); ctx.rotate(p.rot || 0);
      ctx.globalAlpha = prog * op;
      drawFxStyledShape(ctx, p.shape, curR, p.col, p.drawMode, p.lw, p.customPoly);
    } else {
      ctx.globalCompositeOperation = 'lighter';
      if (p.kind === 'core3') {
        const el = p.max - p.life;
        const c = el < 0.038 ? '#ffffff' : (el < 0.12 ? '#fde047' : (age > 0.55 ? '#ffffff' : fxTempColor(age, p.col, true)));
        const r = p.r * (0.55 + prog * 0.55) * flk;
        if (p.shape && p.shape !== 'default' && p.shape !== 'circle') {
          ctx.translate(p.x, p.y); ctx.rotate(p.rot || 0);
          ctx.globalAlpha = prog * 0.9 * op;
          drawFxStyledShape(ctx, p.shape, r, c, 'fill', 1.8, p.customPoly);
        } else if (p.fakeGlow) {
          drawFxCachedGlow(ctx, p.x, p.y, r, c, prog * 0.95 * op, 'bloom', p.smooth || 1.0);
        } else {
          ctx.globalAlpha = prog * 0.85 * op; ctx.fillStyle = c; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
        }
      } else if (p.kind === 'glow') {
        drawFxCachedGlow(ctx, p.x, p.y, p.r * flk, p.col, prog * op, 'bloom', p.smooth || 1.0);
      } else if (p.kind === 'muzzle') {
        if (p.shape && p.shape !== 'default') {
          ctx.translate(p.x, p.y); ctx.rotate(p.ang || 0);
          ctx.globalAlpha = prog * op;
          drawFxStyledShape(ctx, p.shape, p.r * 0.65 * prog, p.col, 'both', 1.5, p.customPoly);
        } else {
          drawFxCachedGlow(ctx, p.x, p.y, p.r * flk, p.col, prog * op, 'bloom', p.smooth || 1.0);
          drawFxCachedGlow(ctx, p.x, p.y, p.r * 0.55, '#ffffff', prog * 0.95 * op, 'bloom', p.smooth || 1.0);
        }
      } else if (p.kind === 'perp') {
        ctx.translate(p.x, p.y); ctx.rotate(p.ang);
        if (p.shape && p.shape !== 'default') {
          ctx.globalAlpha = prog * op;
          drawFxStyledShape(ctx, p.shape, p.r * 0.85, p.col, 'both', 1.6, p.customPoly);
        } else {
          ctx.scale(1.35, 0.30);
          drawFxCachedGlow(ctx, 0, 0, p.r, p.col, prog * op, 'bloom', p.smooth || 1.0);
          drawFxCachedGlow(ctx, 0, 0, p.r * 0.55, '#ffffff', prog * 0.9 * op, 'bloom', p.smooth || 1.0);
        }
      } else if (p.kind === 'shard') {
        const fade = Math.pow(prog, 2.2) * op;
        const c = prog > 0.6 ? '#ffffff' : p.col;
        if (p.shape && p.shape !== 'default') {
          ctx.translate(p.x, p.y); ctx.rotate(Math.atan2(p.vy, p.vx));
          ctx.globalAlpha = fade;
          drawFxStyledShape(ctx, p.shape, p.r * (0.65 + 0.65 * prog), c, 'fill', 1.4, p.customPoly);
        } else {
          ctx.globalAlpha = fade; ctx.fillStyle = c;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (0.45 + 0.55 * prog), 0, Math.PI * 2); ctx.fill();
          if (prog > 0.45) {
            ctx.globalAlpha = fade * 0.55; ctx.fillStyle = p.col;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 1.9 * prog, 0, Math.PI * 2); ctx.fill();
          }
        }
      } else if (p.kind === 'vortex') {
        if (dt > 0) p.ang += p.vRot * dt;
        ctx.translate(p.x, p.y); ctx.rotate(p.ang);
        ctx.globalAlpha = prog * op; ctx.strokeStyle = p.col; ctx.lineWidth = p.lw || 2.2;
        ctx.beginPath(); ctx.arc(0, 0, p.r * (0.4 + (1 - prog) * 0.6), 0, p.span); ctx.stroke();
      } else if (p.kind === 'spark') {
        const c = p.temp ? fxTempColor(age, p.col) : (age < 0.2 ? '#ffffff' : p.col);
        ctx.globalAlpha = prog * op; ctx.strokeStyle = c; ctx.fillStyle = c;
        if (p.shape && p.shape !== 'default' && p.shape !== 'line') {
          ctx.translate(p.x, p.y); ctx.rotate(Math.atan2(p.vy, p.vx));
          drawFxStyledShape(ctx, p.shape, p.r * (0.65 + prog * 0.9), c, 'fill', 1.3, p.customPoly);
        } else if (p.stretch || p.shape === 'line') {
          const sm = p.stretchMult !== undefined ? p.stretchMult : 1.0;
          const spd = Math.hypot(p.vx, p.vy);
          const dirX = spd > 0.01 ? p.vx / spd : 0, dirY = spd > 0.01 ? p.vy / spd : 0;
          const rad = p.r * prog;
          const cf = p.cf || 0;
          const baseTail = rad * 2 + spd * 0.065 * sm * prog;
          const tailLen = baseTail * (1 - cf * 0.88);
          const tx = p.x - dirX * tailLen, ty = p.y - dirY * tailLen;
          ctx.lineCap = 'round'; ctx.lineWidth = Math.max(1.2, rad * 1.6);
          if (cf > 0.01) {
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = (prog > 0.15 ? 1 : prog / 0.15) * op;
            const fadeStop = Math.min(0.92, cf * (0.15 + age * 0.85));
            const g = ctx.createLinearGradient(tx, ty, p.x, p.y);
            g.addColorStop(0, '#050811'); g.addColorStop(fadeStop, '#050811'); g.addColorStop(1, c);
            ctx.strokeStyle = g;
          }
          ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(p.x, p.y); ctx.stroke();
        } else {
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r * prog, 0, Math.PI * 2); ctx.fill();
        }
      } else if (p.kind === 'ember') {
        ctx.globalAlpha = prog * (0.6 + 0.4 * Math.sin(p.life * 25 + p.ph)) * op;
        if (p.shape && p.shape !== 'default') {
          ctx.translate(p.x, p.y); ctx.rotate(Math.atan2(p.vy, p.vx));
          drawFxStyledShape(ctx, p.shape, p.r * (0.6 + prog * 0.8), p.col, 'fill', 1.2, p.customPoly);
        } else {
          ctx.fillStyle = p.col;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r * prog, 0, Math.PI * 2); ctx.fill();
        }
      } else if (p.kind === 'arc') {
        ctx.translate(p.x, p.y); ctx.rotate(p.ang);
        const th = p.thickness || 1.0;
        ctx.strokeStyle = p.col; ctx.lineWidth = 4.5 * th * prog; ctx.globalAlpha = prog * 0.55 * op;
        ctx.beginPath(); ctx.moveTo(0, 0);
        for (let k = 1; k < p.pts.length; k++) ctx.lineTo((k / (p.pts.length - 1)) * p.len, p.pts[k]);
        ctx.stroke();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.4 * th * prog; ctx.globalAlpha = prog * op;
        ctx.stroke();
      } else if (p.kind === 'implode') {
        const curR = p.startR * prog, tailR = curR + p.len * prog;
        const hx = p.x + Math.cos(p.ang) * curR, hy = p.y + Math.sin(p.ang) * curR;
        const tx = p.x + Math.cos(p.ang) * tailR, ty = p.y + Math.sin(p.ang) * tailR;
        const g = ctx.createLinearGradient(tx, ty, hx, hy);
        g.addColorStop(0, 'transparent'); g.addColorStop(1, p.col);
        ctx.strokeStyle = g; ctx.lineWidth = (p.lw || 2.0) * prog; ctx.globalAlpha = prog * op;
        ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(hx, hy); ctx.stroke();
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(hx, hy, 1.2 * prog, 0, Math.PI * 2); ctx.fill();
      } else if (p.kind === 'mote') {
        const pulse = prog * (0.55 + 0.45 * Math.sin(nowSec * 14 + p.ph)) * op;
        if (p.shape && p.shape !== 'default') {
          ctx.translate(p.x, p.y); ctx.globalAlpha = pulse;
          drawFxStyledShape(ctx, p.shape, p.r * 0.55, p.col, 'both', 1.2, p.customPoly);
        } else {
          drawFxCachedGlow(ctx, p.x, p.y, p.r, p.col, pulse, 'volume', p.smooth || 1.0);
          ctx.fillStyle = '#ffffff'; ctx.globalAlpha = pulse;
          ctx.beginPath(); ctx.arc(p.x, p.y, 1.2, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
    ctx.restore();
  }
}

function drawFxBulletTrails(p) {
  const prof = TOWER_FX && TOWER_FX.gun;
  if (!prof || !Array.isArray(prof.layers)) return;
  if (p._startX === undefined) { p._startX = p.x; p._startY = p.y; }
  let a = 0;
  if (p.target) a = Math.atan2(p.target.y - p.y, p.target.x - p.x);
  else if (p._prevX !== undefined) a = Math.atan2(p.y - p._prevY, p.x - p._prevX);
  p._prevX = p.x; p._prevY = p.y;

  const distStart = Math.hypot(p.x - p._startX, p.y - p._startY);
  for (let i = 0; i < prof.layers.length; i++) {
    const tl = prof.layers[i];
    if (!tl.enabled || tl.type !== 'bulletTrails') continue;
    const tp = tl.params || {};
    const len = Math.min(distStart, 26 * (tp.speed || 1.0));
    if (len < 1.5) continue;
    const tCol = fxResolveColor(tp, p.color || '#00e5ff');
    const tx = p.x - Math.cos(a) * len;
    const ty = p.y - Math.sin(a) * len;
    const g = ctx.createLinearGradient(tx, ty, p.x, p.y);
    g.addColorStop(0, 'transparent');
    g.addColorStop(1, tCol);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = tp.opacity !== undefined ? tp.opacity : 1.0;
    ctx.strokeStyle = g;
    ctx.lineWidth = 2.5 * (tp.size || 1.0);
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ctx.restore();
  }
}

// [UI.HWM] Специализированные сочные эффекты попаданий (Gun, Tesla, Railgun, Shield, Beam)
function createHitImpactFx(x, y, color, kind = 'bullet', dirAngle = null) {
  const col = color || '#00e5ff';
  const isLow = (perfMode === 'low');

  let resolvedKind = kind;
  if (kind === 'bullet' && typeof towers !== 'undefined' && Array.isArray(towers)) {
    for (let i = 0; i < towers.length; i++) {
      const t = towers[i];
      if ((t.type === 'laser' || t.type === 'melter') && t.target && t.isLockedOn && t.disabledTimer <= 0) {
        if (Math.hypot(t.target.x - x, t.target.y - y) < 30) {
          resolvedKind = t.type;
          break;
        }
      }
    }
  }

  if (resolvedKind === 'bullet') {
    spawnFxHitLayers(x, y, 'gun', col, dirAngle, 13);
    return;
  }
  if (resolvedKind === 'laser' || resolvedKind === 'melter' || resolvedKind === 'tesla' || resolvedKind === 'railgun') {
    spawnFxHitLayers(x, y, resolvedKind, col, dirAngle, 13);
    return;
  }

  if (kind === 'shield') {
    // Энергетическая рябь при попадании в неуязвимый фазовый щит Blinker / Chronos
    pushParticle({
      x, y, vx: 0, vy: 0,
      color: '#60a5fa',
      radius: 15,
      life: 0.16, maxLife: 0.16,
      isRing: true,
      lineWidth: 2.2
    });
    const cnt = isLow ? 3 : 5;
    for (let i = 0; i < cnt; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 40 + Math.random() * 70;
      pushParticle({
        x, y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        drag: 0.90,
        color: i % 2 === 0 ? '#ffffff' : '#60a5fa',
        radius: 2.2,
        life: 0.20, maxLife: 0.20,
        isStreak: true
      });
    }
    return;
  }

}

// [UI.HX] No-op stub (kept for legacy call sites in engine.js)
function createImpactSmoke() {}

// [UI.HY]
function createSparks(x, y, color1, count = 6, color2 = null) {
  createDamageShards(x, y, color1, count * 5, false);
}

// [UI.HZ]
function createSteamPuff(x, y) {
  const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.0;
  const speed = 12 + Math.random() * 16;
  pushParticle({
    x: x + (Math.random() - 0.5) * 7,
    y: y + (Math.random() - 0.5) * 3,
    vx: Math.cos(angle) * speed * 0.35,
    vy: Math.sin(angle) * speed,
    color: '#e2e8f0',
    radius: 3 + Math.random() * 3,
    life: 0.55 + Math.random() * 0.4,
    maxLife: 0.95,
    isSteam: true
  });
}

// [UI.IA] Многослойные сочные взрывы (Mortar, Boss, MiniBoss, Standard)
function createExplosion(x, y, radius, color1 = '#ff9100', color2 = null, kind = 'standard') {
  const c1 = color1;
  const c2 = color2 || (kind === 'mortar' ? '#f05f9f' : '#00e5ff');
  const isMortar = (kind === 'mortar');
  const isBoss = (kind === 'boss');
  const isLow = (perfMode === 'low');

  if (isMortar) {
    spawnFxHitLayers(x, y, 'mortar', c1, null, 13);
    return;
  }

  // Взрыв босса / мини-босса / стандартный
  pushParticle({
    x, y, vx: 0, vy: 0,
    color: c1,
    radius: radius * (isBoss ? 1.85 : 1.15),
    life: isBoss ? 0.32 : 0.20,
    maxLife: isBoss ? 0.32 : 0.20,
    isGlowHalo: true,
    alphaMult: isBoss ? 0.78 : 0.50
  });

  pushParticle({
    x, y, vx: 0, vy: 0,
    color: isBoss ? '#ffffff' : c1,
    radius: radius * (isBoss ? 1.4 : 0.85),
    life: isBoss ? 0.30 : 0.20,
    maxLife: isBoss ? 0.30 : 0.20,
    isCrossFlash: true,
    angle: Math.PI / 4
  });

  createShockwave(x, y, radius * (isBoss ? 1.5 : 0.9), '#ffffff');
  if (isBoss) {
    pushParticle({
      x, y, vx: 0, vy: 0,
      color: c1,
      radius: radius * 2.1,
      life: 0.42, maxLife: 0.42,
      isRing: true,
      lineWidth: 3.5
    });
    pushParticle({
      x, y, vx: 0, vy: 0,
      color: c2,
      radius: radius * 1.15,
      life: 0.28, maxLife: 0.28,
      isRing: true,
      lineWidth: 2.5
    });
  }

  const count = isLow ? (isBoss ? 14 : 9) : (isBoss ? 28 : 16);
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
    const speed = (isBoss ? 65 : 45) + Math.random() * (isBoss ? 195 : 130);
    pushParticle({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      drag: 0.92,
      color: i % 4 === 0 ? '#ffffff' : (i % 2 === 0 ? c1 : c2),
      radius: (isBoss ? 3.8 : 3.0) + Math.random() * 2.6,
      life: (isBoss ? 0.42 : 0.30) + Math.random() * 0.22,
      maxLife: isBoss ? 0.64 : 0.52,
      isStreak: i % 2 === 0
    });
  }

  if (isBoss) {
    for (let s = 0; s < 9; s++) {
      const sAngle = Math.random() * Math.PI * 2;
      const sSpeed = 10 + Math.random() * 26;
      pushParticle({
        x: x + (Math.random() - 0.5) * 18,
        y: y + (Math.random() - 0.5) * 18,
        vx: Math.cos(sAngle) * sSpeed,
        vy: Math.sin(sAngle) * sSpeed - 6,
        radius: 16 + Math.random() * 10,
        life: 0.75 + Math.random() * 0.3,
        maxLife: 1.05,
        isSmoke: true
      });
    }
  }
}

// [UI.IB]
function createRailBeamFx(x1, y1, x2, y2, color) {
  const beamColor = color || (typeof TOWER_CONFIGS !== 'undefined' && TOWER_CONFIGS.railgun ? TOWER_CONFIGS.railgun.color : '#a275df');
  // Дульная вспышка рельсотрона (профиль railgun из TOWER_FX)
  const railAng = Math.atan2(y2 - y1, x2 - x1);
  spawnFxMuzzleLayers(x1 + Math.cos(railAng) * 24, y1 + Math.sin(railAng) * 24, 'railgun', beamColor, railAng);
  lightningBolts.push({
    x1, y1, x2, y2,
    isRail: true,
    life: 0.38,
    maxLife: 0.38,
    hasDealtDamage: true,
    color: beamColor
  });
}

// [UI.IC]
function createShockwave(x, y, maxRadius, color) {
  shockwaves.push({ x, y, maxRadius, color, duration: 0.32, elapsed: 0 });
}

//  Jagged lightning path generator and beam renderer.
// [UI.JR]
function drawJaggedLightning(x1, y1, x2, y3, color, alpha, progress = 1.0) {
  const fullDist = Math.hypot(x2 - x1, y3 - y1);
  if (fullDist <= 0 || progress <= 0) return;

  const currentDist = fullDist * Math.min(1.0, progress);
  const dirX = (x2 - x1) / fullDist;
  const dirY = (y3 - y1) / fullDist;
  const endX = x1 + dirX * currentDist;
  const endY = y1 + dirY * currentDist;

  const segments = Math.max(5, Math.floor(currentDist / 12));
  const normalX = -dirY;
  const normalY = dirX;

  const points = [{ x: x1, y: y1 }];
  const dx = (endX - x1) / segments;
  const dy = (endY - y1) / segments;

  for (let s = 1; s < segments; s++) {
    const jitter = (Math.random() - 0.5) * 22;
    points.push({
      x: x1 + dx * s + normalX * jitter,
      y: y1 + dy * s + normalY * jitter
    });
  }
  points.push({ x: endX, y: endY });

  const safeAlpha = Math.max(0, Math.min(1, alpha));
  const zapCol = color || '#00ffcc';

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.globalCompositeOperation = 'lighter';

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }

  // 1. Внешний мягкий неоновый ореол (Zero-Blur)
  if (perfMode !== 'low') {
    ctx.strokeStyle = zapCol;
    ctx.globalAlpha = safeAlpha * 0.28;
    ctx.lineWidth = 9.0;
    ctx.stroke();
  }

  // 2. Основной цветной разряд
  ctx.strokeStyle = zapCol;
  ctx.globalAlpha = safeAlpha * 0.85;
  ctx.lineWidth = 4.2;
  ctx.stroke();

  // 3. Яркий белый сердечник молнии
  ctx.strokeStyle = '#ffffff';
  ctx.globalAlpha = safeAlpha;
  ctx.lineWidth = 1.8;
  ctx.stroke();

  // 4. Ответвления дуги
  if (points.length >= 4 && perfMode !== 'low') {
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = zapCol;
    ctx.globalAlpha = safeAlpha * 0.75;
    const numForks = Math.min(3, Math.floor(points.length / 3));
    ctx.beginPath();
    for (let f = 0; f < numForks; f++) {
      const idx = 1 + Math.floor(Math.random() * (points.length - 2));
      const pt = points[idx];
      const forkAngle = Math.atan2(dirY, dirX) + (Math.random() > 0.5 ? 1 : -1) * (0.6 + Math.random() * 0.7);
      const forkLen = 8 + Math.random() * 14;
      const forkMidX = pt.x + Math.cos(forkAngle) * (forkLen * 0.5) + (Math.random() - 0.5) * 6;
      const forkMidY = pt.y + Math.sin(forkAngle) * (forkLen * 0.5) + (Math.random() - 0.5) * 6;
      const forkEndX = pt.x + Math.cos(forkAngle) * forkLen;
      const forkEndY = pt.y + Math.sin(forkAngle) * forkLen;
      ctx.moveTo(pt.x, pt.y);
      ctx.lineTo(forkMidX, forkMidY);
      ctx.lineTo(forkEndX, forkEndY);
    }
    ctx.stroke();
  }

  ctx.restore();
}
