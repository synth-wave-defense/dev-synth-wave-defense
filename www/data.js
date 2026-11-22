// Game configuration data: campaign constants, upgrade branch specifications, tower definitions, enemy parameters, map catalog, and level generator.

if (typeof console !== 'undefined') {
  console.log('[data.js] Loading game data...');
}

// Campaign Constants & Meta Upgrade Branches: Defines campaign structure and purchasable tech tree branches for towers and base.
const TOTAL_LEVELS = 50;
const LEVELS_PER_SECTION = 10;
const TOTAL_SECTIONS = 5;

// Константа стоимости премиального пропуска в алмазах (Этап 2)
const SYNTH_PASS_PREMIUM_COST = 300;

const DAILY_LOGIN_REWARDS = [
  { day: 1, diamonds: 15, prisms: 0 },
  { day: 2, diamonds: 20, prisms: 0 },
  { day: 3, diamonds: 0, prisms: 3 },
  { day: 4, diamonds: 30, prisms: 0 },
  { day: 5, diamonds: 40, prisms: 2 },
  { day: 6, diamonds: 50, prisms: 0 },
  { day: 7, diamonds: 50, prisms: 10 }
];

// Synth Pass Battle Pass Tiers & Neon Color Palettes Configuration: Reward tiers and palettes.
const BATTLE_PASS_TIERS = [
  { tier: 1, freeReward: { type: 'diamonds', amount: 10 }, premReward: { type: 'palette', paletteId: 'cyber_gold', title: 'Cyber Gold Palette' } },
  { tier: 2, freeReward: { type: 'diamonds', amount: 10 }, premReward: { type: 'diamonds', amount: 25 } },
  { tier: 3, freeReward: { type: 'diamonds', amount: 15 }, premReward: { type: 'diamonds', amount: 30 } },
  { tier: 4, freeReward: { type: 'diamonds', amount: 15 }, premReward: { type: 'prisms', amount: 3 } },
  { tier: 5, freeReward: { type: 'ad_capsule', prisms: 2, title: 'Ad-Capsule (+2 \u{1F52E})' }, premReward: { type: 'diamonds', amount: 35 } },
  { tier: 6, freeReward: { type: 'diamonds', amount: 15 }, premReward: { type: 'prisms', amount: 4 } },
  { tier: 7, freeReward: { type: 'diamonds', amount: 20 }, premReward: { type: 'diamonds', amount: 40 } },
  { tier: 8, freeReward: { type: 'diamonds', amount: 20 }, premReward: { type: 'prisms', amount: 4 } },
  { tier: 9, freeReward: { type: 'diamonds', amount: 20 }, premReward: { type: 'diamonds', amount: 40 } },
  { tier: 10, freeReward: { type: 'combo', paletteId: 'matrix_green', prisms: 3, title: 'Hyperion Sunburst + 3 \u{1F52E}' }, premReward: { type: 'prisms', amount: 6 } },
  { tier: 11, freeReward: { type: 'diamonds', amount: 20 }, premReward: { type: 'diamonds', amount: 45 } },
  { tier: 12, freeReward: { type: 'diamonds', amount: 20 }, premReward: { type: 'prisms', amount: 5 } },
  { tier: 13, freeReward: { type: 'diamonds', amount: 25 }, premReward: { type: 'diamonds', amount: 45 } },
  { tier: 14, freeReward: { type: 'diamonds', amount: 25 }, premReward: { type: 'prisms', amount: 5 } },
  { tier: 15, freeReward: { type: 'ad_capsule', prisms: 2, title: 'Ad-Capsule (+2 \u{1F52E})' }, premReward: { type: 'perk', perkId: 'starting_reserve', title: 'Starting Reserve (+15% Gold)' } },
  { tier: 16, freeReward: { type: 'diamonds', amount: 25 }, premReward: { type: 'diamonds', amount: 50 } },
  { tier: 17, freeReward: { type: 'diamonds', amount: 25 }, premReward: { type: 'prisms', amount: 6 } },
  { tier: 18, freeReward: { type: 'diamonds', amount: 25 }, premReward: { type: 'diamonds', amount: 50 } },
  { tier: 19, freeReward: { type: 'diamonds', amount: 25 }, premReward: { type: 'prisms', amount: 6 } },
  { tier: 20, freeReward: { type: 'prisms', amount: 5 }, premReward: { type: 'prisms', amount: 8 } },
  { tier: 21, freeReward: { type: 'diamonds', amount: 25 }, premReward: { type: 'diamonds', amount: 50 } },
  { tier: 22, freeReward: { type: 'diamonds', amount: 25 }, premReward: { type: 'prisms', amount: 7 } },
  { tier: 23, freeReward: { type: 'diamonds', amount: 25 }, premReward: { type: 'diamonds', amount: 50 } },
  { tier: 24, freeReward: { type: 'diamonds', amount: 25 }, premReward: { type: 'prisms', amount: 7 } },
  { tier: 25, freeReward: { type: 'ad_capsule', prisms: 2, title: 'Ad-Capsule (+2 \u{1F52E})' }, premReward: { type: 'diamonds', amount: 50 } },
  { tier: 26, freeReward: { type: 'diamonds', amount: 25 }, premReward: { type: 'prisms', amount: 8 } },
  { tier: 27, freeReward: { type: 'diamonds', amount: 25 }, premReward: { type: 'diamonds', amount: 50 } },
  { tier: 28, freeReward: { type: 'diamonds', amount: 25 }, premReward: { type: 'prisms', amount: 8 } },
  { tier: 29, freeReward: { type: 'diamonds', amount: 25 }, premReward: { type: 'prisms', amount: 10 } },
  { tier: 30, freeReward: { type: 'prisms', amount: 10 }, premReward: { type: 'ultimate', paletteId: 'blood_moon', prisms: 25, diamonds: 150, title: 'Blood Moon + 25 \u{1F52E} + 150 \u{1F48E}' } }
];

// Каталог неоновых палитр (Этап 3: добавлены флаги source, cost, currency, unlockedByDefault)
const NEON_PALETTES = {
  default: {
    id: 'default',
    name: 'Cyan Sunset',
    source: 'default',
    cost: 0,
    unlockedByDefault: true,
    c1: '#00e5ff', // Основной: UI, Алмазы, Gun, Правая туманность
    c2: '#d946ef', // Вторичный: Призмы, Танк, Railgun, Левая туманность
    c3: '#f05f9f', // Акцент/Враги: HP, Hardcore, Laser/Melter, Grunt
    c4: '#ff9100', // Теплый: Золото $, Splash, Scout
    c5: '#38bdf8', // Вспомогательный: Stasis, Tesla, Swarm, Blinker
    bg: '#03050d'
  },
  matrix_green: {
    id: 'matrix_green',
    name: 'Hyperion Sunburst',
    source: 'synth_pass',
    cost: 0,
    unlockedByDefault: false,
    c1: '#3b82f6', // Синий кобальт
    c2: '#ff6b00', // Солнечно-оранжевый
    c3: '#ffb700', // Желто-золотой
    c4: '#ff9100', // Янтарный
    c5: '#60a5fa', // Небесно-синий
    bg: '#03050d',
    unlockHint: 'Free Pass Tier 10'
  },
  cyber_gold: {
    id: 'cyber_gold',
    name: 'Cyber Gold',
    source: 'synth_pass',
    cost: 0,
    unlockedByDefault: false,
    c1: '#ffd700', // Чистое золото
    c2: '#9d4edd', // Королевский фиолет
    c3: '#ff007f', // Неоновая фуксия
    c4: '#ff9100', // Оранжевое золото
    c5: '#c084fc', // Светлый аметист
    bg: '#06040d',
    unlockHint: 'Premium Pass Tier 1'
  },
  blood_moon: {
    id: 'blood_moon',
    name: 'Blood Moon',
    source: 'synth_pass',
    cost: 0,
    unlockedByDefault: false,
    c1: '#ff003c', // Кроваво-алый
    c2: '#9d4edd', // Темно-фиолетовый
    c3: '#ff6b00', // Огненно-оранжевый
    c4: '#ffb700', // Золотой
    c5: '#fb7185', // Розово-алый лед
    bg: '#0a0306',
    unlockHint: 'Premium Pass Tier 30'
  },
  bio_venom: {
    id: 'bio_venom',
    name: 'Bio-Venom Matrix',
    source: 'shop',
    cost: 150,
    currency: 'diamonds',
    unlockedByDefault: false,
    c1: '#84cc16', // Кислотный лайм
    c2: '#a855f7', // Неоновый фиолет
    c3: '#d946ef', // Яркий пурпур
    c4: '#a3e635', // Желто-лаймовый
    c5: '#22c55e', // Изумрудный
    bg: '#070410'
  },
  sakura_wave: {
    id: 'sakura_wave',
    name: 'Sakura Vaporwave',
    source: 'shop',
    cost: 200,
    currency: 'diamonds',
    unlockedByDefault: false,
    c1: '#00ffcc', // Мятная бирюза
    c2: '#38bdf8', // Ледяной голубой
    c3: '#ff4da6', // Розовая сакура
    c4: '#ffb3c6', // Нежно-персиковый
    c5: '#7dd3fc', // Небесный
    bg: '#09040e'
  },
  solar_inferno: {
    id: 'solar_inferno',
    name: 'Solar Inferno',
    source: 'shop',
    cost: 300,
    currency: 'diamonds',
    unlockedByDefault: false,
    c1: '#ffb700', // Янтарное золото
    c2: '#ff6b00', // Огненный оранж
    c3: '#ff2a00', // Лавовый красный
    c4: '#fde047', // Солнечно-лимонный
    c5: '#fb923c', // Раскаленный уголь
    bg: '#0d0402'
  }
};

// [DAT.A]
function getBpTierInfo(xp) {
    const currentXp = Math.max(0, xp || 0);
    const tier = Math.min(30, Math.floor(currentXp / 100));
    const isMax = currentXp >= 3000;
    const xpInTier = isMax ? 100 : (currentXp % 100);
    return { tier, xpInTier, isMax, totalXp: currentXp };
}

const UPGRADE_BRANCH_SPECS = {
  towers: [
    { title: 'GUN', icon: 'gun', branches: [{ key: 'gun_power', name: 'Power', stepVal: 8, unit: '%', prefix: '+' }] },
    { title: 'Laser', icon: 'laser', branches: [{ key: 'laser_power', name: 'Power', stepVal: 8, unit: '%', prefix: '+' }] },
    { title: 'Splash', icon: 'mortar', branches: [{ key: 'mortar_power', name: 'Power', stepVal: 8, unit: '%', prefix: '+' }] },
    { title: 'Tesla', icon: 'tesla', branches: [{ key: 'tesla_power', name: 'Power', stepVal: 5, unit: '%', prefix: '+' }] },
    { title: 'Stasis', icon: 'stasis', branches: [{ key: 'stasis_power', name: 'Power', stepVal: 5, unit: '%', prefix: '+' }] },
    { title: 'Melter', icon: 'melter', branches: [{ key: 'melter_power', name: 'Power', stepVal: 5, unit: '%', prefix: '+' }] },
    { title: 'Railgun', icon: 'railgun', branches: [{ key: 'railgun_power', name: 'Power', stepVal: 8, unit: '%', prefix: '+' }] }
  ],
  base: [
    {
      title: 'Base',
      branches: [
        { key: 'base_hp', name: 'Base HP', stepVal: 1, unit: ' HP', prefix: '+' },
        { key: 'base_gold', name: 'Bounty', stepVal: 5, unit: '%', prefix: '+' }
      ]
    }
  ]
};

const upgradeTreeData = {
  gun_power: 0, laser_power: 0, mortar_power: 0, tesla_power: 0,
  stasis_power: 0, melter_power: 0, railgun_power: 0,
  base_hp: 0, base_gold: 0
};

const TOWER_NAMES = {
  gun: 'Gun',
  laser: 'Laser',
  mortar: 'Splash',
  tesla: 'Tesla',
  stasis: 'Stasis',
  melter: 'Melter',
  railgun: 'Railgun'
};

// Tower Visual Geometry: Geometric rendering specs aligned with V8 Round Tower Design.
const TOWER_GLYPH_DARK = '#0a0e1c';

const TOWER_GLYPH_SPECS = {
  gun: { barrel: [ { t: 'rect', x: 9, y: -5, w: 15, h: 2.6, r: 1.3, f: 'c' },
                   { t: 'rect', x: 9, y: 2.4, w: 15, h: 2.6, r: 1.3, f: 'c' } ] },
  laser: { barrel: [ { t: 'poly', pts: [9, -5.5, 25, -1.6, 25, 1.6, 9, 5.5], f: 'c' } ] },
  mortar: { elevationDeg: 55,
            barrel: [ { t: 'rect', x: 9, y: -6, w: 14, h: 12, r: 3, f: 'c' } ],
            muzzle: { atX: 23, rx: 3.0, ry: 5.2 } },
  tesla: { barrel: [ { t: 'poly', pts: [8.5, -6.8, 22.5, -5.8, 24.5, -3.6, 24.5, 3.6, 22.5, 5.8, 8.5, 6.8], f: 'd', s: 'c', sw: 1.6 },
                     { t: 'bolt', cx: 16.8, rot: 90, scale: 0.56,
                       pts: [2.5, -11, -6.0, 1.2, -0.4, 1.2, -3.2, 11, 6.5, -2.2, 0.8, -2.2], f: 'w' } ] },
  stasis: { barrel: [], flakes: true },
  melter: { barrel: [ { t: 'pline', pts: [9.0, -5.2, 20.5, -2.2], sw: 2.5 },
                      { t: 'pline', pts: [9.0, 5.2, 20.5, 2.2], sw: 2.5 },
                      { t: 'rect', x: 19.0, y: -4.5, w: 3.6, h: 9.0, r: 1.2, f: 'd', s: 'w', sw: 1.3 },
                      { t: 'poly', pts: [22.6, -2.5, 28.2, 0, 22.6, 2.5], f: 'c' } ] },
  railgun: { barrel: [ { t: 'rect', x: 10.0, y: -1.3, w: 12.5, h: 2.6, f: 'c' },
                       { t: 'poly', pts: [8.5, -4.4, 23.0, -3.6, 21.0, -1.8, 8.5, -1.8], f: 'd', s: 'c', sw: 1.45 },
                       { t: 'poly', pts: [8.5, 4.4, 23.0, 3.6, 21.0, 1.8, 8.5, 1.8], f: 'd', s: 'c', sw: 1.45 },
                       { t: 'rect', x: 10.7, y: -5.0, w: 2.2, h: 10.0, f: 'w' } ] }
};

const TOWER_GLYPH_RINGS = { 1: [], 2: [], 3: [21.5], 4: [21.5, 26.0] };
const TOWER_GLYPH_CORES = {
  1: [],
  2: [{ cx: 0, cy: 0, r: 3.2 }],
  3: [{ cx: 0, cy: -4.2, r: 3 }, { cx: 0, cy: 4.2, r: 3 }],
  4: [{ cx: -3.4, cy: -4.2, r: 3 }, { cx: -3.4, cy: 4.2, r: 3 }, { cx: 4.2, cy: 0, r: 3 }]
};

const TOWER_GLYPH_FLAKES = {
  1: [],
  2: [{ cx: 0, cy: 0, scale: 1.0, sw: 1.9 }],
  3: [{ cx: 0, cy: -4.5, scale: 0.95, sw: 2.0 }, { cx: 0, cy: 5, scale: 0.95, sw: 2.0 }],
  4: [{ cx: -3.5, cy: -5, scale: 0.85, sw: 2.24 }, { cx: -4, cy: 5.5, scale: 0.85, sw: 2.24 },
      { cx: 5.5, cy: 0.5, scale: 0.85, sw: 2.24 }]
};

// Tower SVG Generator: Generates standalone SVG strings aligned with 4-Level Round Tower Design & Level Evolution.
// [DAT.B]
function buildTowerIconSvg(type, level = 1, size = 28, angleDeg = 0) {
  const conf = TOWER_CONFIGS[type];
  if (!conf) return '';
  const c = conf.color;
  const lvl = Math.max(1, Math.min(MAX_TOWER_LEVEL, level));
  const ext = lvl - 1;

  let out = `<svg width="${size}" height="${size}" viewBox="-32 -32 64 64">`;

  // 1. 4 широкие диагональные опоры (Lv.1 — без опор; эволюция Lv.2 -> Lv.3 -> Lv.4)
  if (lvl >= 2) {
    [45, 135, 225, 315].forEach(deg => {
      out += `<g transform="rotate(${deg})">`;
      if (lvl === 2) {
        out += `<polygon points="13.0,-5.6 20.2,-4.6 20.2,4.6 13.0,5.6" fill="${c}" fill-opacity="0.35" stroke="${c}" stroke-width="1.4" stroke-linejoin="round"/>`;
      } else if (lvl === 3) {
        out += `<polygon points="13.0,-5.6 20.2,-4.6 20.2,4.6 13.0,5.6" fill="#080d1e" stroke="${c}" stroke-width="1.45" stroke-linejoin="round"/>`;
        out += `<rect x="15.2" y="-2.3" width="3.8" height="4.6" fill="${c}" fill-opacity="0.6"/>`;
        out += `<polygon points="20.2,-4.3 25.2,-3.1 26.4,-1.8 26.4,1.8 25.2,3.1 20.2,4.3" fill="${c}" fill-opacity="0.32" stroke="${c}" stroke-width="1.45" stroke-linejoin="round"/>`;
      } else {
        out += `<polygon points="13.0,-5.6 20.2,-4.6 20.2,4.6 13.0,5.6" fill="#070b19" stroke="#ffffff" stroke-width="1.65" stroke-linejoin="round"/>`;
        out += `<rect x="15.2" y="-2.4" width="3.8" height="4.8" fill="${c}"/>`;
        out += `<polygon points="20.2,-4.3 25.2,-3.1 26.4,-1.8 26.4,1.8 25.2,3.1 20.2,4.3" fill="${c}" fill-opacity="0.88" stroke="#ffffff" stroke-width="1.65" stroke-linejoin="round"/>`;
      }
      out += `</g>`;
    });
  }

  // 2. Внешние кольца эволюции Lv.3 (r=21.5) и Lv.4 (r=26.0 с белым сердечником)
  if (lvl >= 3) {
    out += `<circle cx="0" cy="0" r="21.5" fill="none" stroke="${c}" stroke-width="1.7" stroke-opacity="0.72"/>`;
  }
  if (lvl >= 4) {
    out += `<circle cx="0" cy="0" r="26.0" fill="none" stroke="${c}" stroke-width="3.2" stroke-opacity="0.95"/>`;
    out += `<circle cx="0" cy="0" r="26.0" fill="none" stroke="#ffffff" stroke-width="0.9" stroke-opacity="0.72"/>`;
  }

  // 3. Круглый корпус: Lv.1 (Вариант 2 — без полос, приглушённое кольцо + 4 ярких 20° края) | Lv.2–4 (Outrun-полосы + полный неоновый обод)
  out += `<circle cx="0" cy="0" r="16.8" fill="${TOWER_GLYPH_DARK}"/>`;
  if (lvl === 1) {
    out += `<circle cx="0" cy="0" r="16.8" fill="none" stroke="${c}" stroke-width="2.1" stroke-opacity="0.46"/>`;
    const halfRad = (20 * Math.PI / 180) * 0.5;
    const r = 16.8;
    [45, 135, 225, 315].forEach(deg => {
      const rad = deg * Math.PI / 180;
      const x1 = (Math.cos(rad - halfRad) * r).toFixed(2);
      const y1 = (Math.sin(rad - halfRad) * r).toFixed(2);
      const x2 = (Math.cos(rad + halfRad) * r).toFixed(2);
      const y2 = (Math.sin(rad + halfRad) * r).toFixed(2);
      out += `<path d="M ${x1},${y1} A ${r},${r} 0 0,1 ${x2},${y2}" fill="none" stroke="${c}" stroke-width="3.6" stroke-linecap="round"/>`;
      out += `<path d="M ${x1},${y1} A ${r},${r} 0 0,1 ${x2},${y2}" fill="none" stroke="#ffffff" stroke-width="1.0" stroke-opacity="0.82" stroke-linecap="round"/>`;
    });
  } else {
    [-11.4, -7.6, -3.8, 0, 3.8, 7.6, 11.4].forEach(sy => {
      const halfChord = Math.sqrt(Math.max(0, 14.8 * 14.8 - sy * sy));
      if (halfChord > 2) {
        out += `<line x1="${(-halfChord).toFixed(1)}" y1="${sy}" x2="${halfChord.toFixed(1)}" y2="${sy}" stroke="${c}" stroke-width="1.2" stroke-opacity="0.24"/>`;
      }
    });
    out += `<circle cx="0" cy="0" r="16.8" fill="none" stroke="${c}" stroke-width="3.2" stroke-opacity="0.95"/>`;
    out += `<circle cx="0" cy="0" r="16.8" fill="none" stroke="#ffffff" stroke-width="0.9" stroke-opacity="0.72"/>`;
  }

  // Декоративная дуга перегрева для Melter
  if (type === 'melter') {
    out += `<path d="M 0,-13.8 A 13.8,13.8 0 1,1 -11.8,7.1" fill="none" stroke="#fb923c" stroke-width="2.4" stroke-linecap="round"/>`;
  }

  // 4. Поворотная башня (ствол + ядро)
  const effDeg = (type === 'stasis') ? 0 : angleDeg;
  const rot = effDeg ? ` transform="rotate(${effDeg})"` : '';
  out += `<g${rot}>`;

  if (type === 'gun') {
    out += `<rect x="7" y="-6.2" width="8.5" height="12.4" fill="${TOWER_GLYPH_DARK}" stroke="${c}" stroke-width="1.4"/>`;
    out += `<rect x="11.5" y="-5.0" width="${14 + ext}" height="2.7" fill="${c}"/>`;
    out += `<rect x="11.5" y="2.3" width="${14 + ext}" height="2.7" fill="${c}"/>`;
    out += `<rect x="${23.2 + ext}" y="-4.6" width="2.4" height="1.9" fill="#ffffff"/>`;
    out += `<rect x="${23.2 + ext}" y="2.7" width="2.4" height="1.9" fill="#ffffff"/>`;
  } else if (type === 'laser') {
    const tipX = 24 + ext;
    out += `<polygon points="8,-6.5 ${tipX},-2.0 ${tipX},2.0 8,6.5" fill="${TOWER_GLYPH_DARK}" stroke="${c}" stroke-width="1.6" stroke-linejoin="round"/>`;
    out += `<line x1="10" y1="0" x2="${tipX - 1}" y2="0" stroke="#ffffff" stroke-width="1.2" stroke-linecap="round"/>`;
    out += `<circle cx="${tipX}" cy="0" r="2.2" fill="${c}"/>`;
  } else if (type === 'mortar' || type === 'splash') {
    const fore = Math.cos(55 * Math.PI / 180);
    const len = 16 + ext;
    out += `<g transform="scale(${fore.toFixed(3)},1)">`;
    out += `<rect x="7" y="-7.2" width="${len}" height="14.4" rx="3" fill="${TOWER_GLYPH_DARK}" stroke="${c}" stroke-width="2"/>`;
    out += `<rect x="11" y="-5.2" width="${9 + ext}" height="10.4" fill="${c}"/>`;
    out += `</g>`;
    const mx = (23 + ext) * fore;
    out += `<ellipse cx="${mx.toFixed(2)}" cy="0" rx="3.2" ry="5.5" fill="${TOWER_GLYPH_DARK}" stroke="${c}" stroke-width="1.8"/>`;
  } else if (type === 'tesla') {
    out += `<polygon points="8.5,-6.8 22.5,-5.8 24.5,-3.6 24.5,3.6 22.5,5.8 8.5,6.8" fill="${TOWER_GLYPH_DARK}" stroke="${c}" stroke-width="1.6" stroke-linejoin="round"/>`;
    out += `<line x1="10.5" y1="-4.4" x2="21.5" y2="-3.8" stroke="#ffffff" stroke-opacity="0.55" stroke-width="0.95" stroke-linecap="round"/>`;
    out += `<line x1="10.5" y1="4.4" x2="21.5" y2="3.8" stroke="#ffffff" stroke-opacity="0.55" stroke-width="0.95" stroke-linecap="round"/>`;
    out += `<g transform="translate(16.8,0) rotate(90) scale(0.56)"><polygon points="2.5,-11 -6.0,1.2 -0.4,1.2 -3.2,11 6.5,-2.2 0.8,-2.2" fill="#ffffff" stroke="${c}" stroke-width="1.3" stroke-linejoin="round"/></g>`;
  } else if (type === 'melter') {
    out += `<line x1="9.0" y1="-5.2" x2="20.5" y2="-2.2" stroke="${c}" stroke-width="2.6" stroke-linecap="round"/>`;
    out += `<line x1="9.0" y1="5.2" x2="20.5" y2="2.2" stroke="${c}" stroke-width="2.6" stroke-linecap="round"/>`;
    out += `<line x1="10.5" y1="-4.8" x2="19.8" y2="-2.4" stroke="#fb923c" stroke-width="1.15" stroke-linecap="round"/>`;
    out += `<line x1="10.5" y1="4.8" x2="19.8" y2="2.4" stroke="#fb923c" stroke-width="1.15" stroke-linecap="round"/>`;
    out += `<rect x="19.0" y="-4.5" width="3.6" height="9.0" rx="1.2" fill="${TOWER_GLYPH_DARK}" stroke="#ffffff" stroke-width="1.3"/>`;
    out += `<polygon points="22.6,-2.5 28.2,0 22.6,2.5" fill="#fb923c"/>`;
  } else if (type === 'railgun') {
    const railLen = 13.5 + ext * 0.8;
    const endX = 8.5 + railLen;
    out += `<rect x="10.0" y="-1.3" width="${(railLen - 2.0).toFixed(1)}" height="2.6" fill="${c}" fill-opacity="0.68"/>`;
    out += `<polygon points="8.5,-4.4 ${endX.toFixed(1)},-3.6 ${(endX - 2.0).toFixed(1)},-1.8 8.5,-1.8" fill="${TOWER_GLYPH_DARK}" stroke="${c}" stroke-width="1.45" stroke-linejoin="round"/>`;
    out += `<polygon points="8.5,4.4 ${endX.toFixed(1)},3.6 ${(endX - 2.0).toFixed(1)},1.8 8.5,1.8" fill="${TOWER_GLYPH_DARK}" stroke="${c}" stroke-width="1.45" stroke-linejoin="round"/>`;
    out += `<rect x="10.7" y="-5.0" width="2.2" height="10.0" fill="#ffffff"/>`;
  }

  // 5. Ядро (снежинка для Stasis с 4 ступенями или 0/1/2/3 энерго-ячейки с белым центром)
  if (type === 'stasis') {
    const mainR = lvl === 1 ? 9.5 : (lvl === 2 ? 10.6 : (lvl === 3 ? 11.6 : 12.6));
    const sw = lvl === 1 ? 1.35 : (lvl === 2 ? 1.7 : 1.85);
    for (let i = 0; i < 6; i++) {
      const deg = i * 60;
      out += `<g transform="rotate(${deg})" stroke="#ffffff" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" fill="none">`;
      out += `<line x1="0" y1="0" x2="${mainR}" y2="0"/>`;
      const tipPos = lvl === 1 ? (mainR * 0.70) : (mainR * 0.58);
      const tipLen = lvl === 1 ? 2.25 : (lvl === 2 ? 3.8 : 4.2);
      out += `<polyline points="${(tipPos + tipLen * 0.68).toFixed(1)},${(-tipLen * 0.75).toFixed(1)} ${tipPos.toFixed(1)},0 ${(tipPos + tipLen * 0.68).toFixed(1)},${(tipLen * 0.75).toFixed(1)}"/>`;
      if (lvl >= 3) {
        const midPos = mainR * 0.35;
        out += `<polyline points="${(midPos + 1.95).toFixed(1)},-2.16 ${midPos.toFixed(1)},0 ${(midPos + 1.95).toFixed(1)},2.16"/>`;
      }
      if (lvl >= 4) {
        out += `<circle cx="${(mainR + 1.1).toFixed(1)}" cy="0" r="1.25" fill="#ffffff" stroke="none"/>`;
      }
      out += `</g>`;
    }
    if (lvl >= 3) {
      const hr = mainR * 0.44;
      const hexPts = [0, 1, 2, 3, 4, 5].map(k => {
        const a = Math.PI / 6 + (k * Math.PI) / 3;
        return `${(Math.cos(a) * hr).toFixed(1)},${(Math.sin(a) * hr).toFixed(1)}`;
      }).join(' ');
      out += `<polygon points="${hexPts}" fill="none" stroke="${c}" stroke-width="1.25"/>`;
    }
    if (lvl >= 4) {
      for (let i = 0; i < 6; i++) {
        out += `<g transform="rotate(${30 + i * 60})" stroke="${c}" stroke-width="1.35" stroke-linecap="round" fill="none">`;
        out += `<line x1="3.2" y1="0" x2="8.4" y2="0"/><polyline points="8.0,-2.0 6.2,0 8.0,2.0"/>`;
        out += `</g>`;
      }
    }
    const coreR = lvl === 1 ? 2.0 : 2.8;
    out += `<circle cx="0" cy="0" r="${coreR}" fill="${c}"/><circle cx="0" cy="0" r="0.95" fill="#ffffff"/>`;
  } else {
    (TOWER_GLYPH_CORES[lvl] || []).forEach(d => {
      out += `<circle cx="${d.cx}" cy="${d.cy}" r="${(d.r + 0.5).toFixed(1)}" fill="${c}"/>`;
      out += `<circle cx="${d.cx}" cy="${d.cy}" r="${(d.r * 0.30).toFixed(2)}" fill="#ffffff"/>`;
    });
  }

  out += `</g></svg>`;
  return out;
}

// [DAT.BM]
// 4-Level Tower Progression Single Source of Truth (Lv.1 Base + 3 Upgrades)
const MAX_TOWER_LEVEL = 4;
const TOWER_UPGRADE_COST_MULTS = [0.75, 1.35, 2.30]; // Lv.1->2, Lv.2->3, Lv.3->4 (от базовой cost, округление до 5)
const TOWER_DPS_MULTS = [1.0, 1.8, 3.3, 6.0]; // Целевой множитель DPS для Lv.1..Lv.4

// Tower Configurations: Base costs, range, attack metrics, upgrade multipliers, 4-level stat tables, and milestone unlocked blurbs.
const TOWER_CONFIGS = {
  gun: {
    cost: 50, range: 165, damage: 16, fireRate: 0.52,
    color: '#00e5ff', glow: '#00e5ff', type: 'projectile',
    costMultiplier: 1.3, damageMultiplier: 1.7, rateMultiplier: 0.8, rangeMultiplier: 1.1,
    powerDmg: 0.08, powerRate: 0.06, powerRange: 0.04,
    levels: [
      { level: 1, damageMult: 1.00, fireRateMult: 1.00, rangeMult: 1.000 },
      { level: 2, damageMult: 1.62, fireRateMult: 0.90, rangeMult: 1.065 },
      { level: 3, damageMult: 2.67, fireRateMult: 0.81, rangeMult: 1.135 },
      { level: 4, damageMult: 4.32, fireRateMult: 0.72, rangeMult: 1.210 }
    ]
  },
  laser: {
    cost: 70, range: 150, dps: 48,
    color: '#f05f9f', glow: '#f05f9f', type: 'beam',
    costMultiplier: 1.3, damageMultiplier: 1.85, rangeMultiplier: 1.1,
    powerDmg: 0.08, powerRate: 0.06, powerRange: 0.04,
    levels: [
      { level: 1, damageMult: 1.00, fireRateMult: 1.00, rangeMult: 1.000 },
      { level: 2, damageMult: 1.80, fireRateMult: 1.00, rangeMult: 1.065 },
      { level: 3, damageMult: 3.30, fireRateMult: 1.00, rangeMult: 1.135 },
      { level: 4, damageMult: 6.00, fireRateMult: 1.00, rangeMult: 1.210 }
    ]
  },
  mortar: {
    cost: 85, range: 195, damage: 32, splash: 80, fireRate: 1.5,
    color: '#ff9100', glow: '#ff9100', type: 'mortar',
    costMultiplier: 1.3, damageMultiplier: 1.6, rateMultiplier: 0.9, rangeMultiplier: 1.1,
    powerDmg: 0.08, powerRate: 0.06, powerRange: 0.04,
    levels: [
      { level: 1, damageMult: 1.00, fireRateMult: 1.00, rangeMult: 1.000, blastRadius: 80,  splash: 80 },
      { level: 2, damageMult: 1.69, fireRateMult: 0.94, rangeMult: 1.065, blastRadius: 88,  splash: 88 },
      { level: 3, damageMult: 2.90, fireRateMult: 0.88, rangeMult: 1.135, blastRadius: 96,  splash: 96 },
      { level: 4, damageMult: 4.92, fireRateMult: 0.82, rangeMult: 1.210, blastRadius: 104, splash: 104 }
    ]
  },
  tesla: {
    cost: 75, range: 145, damage: 22, chainTargets: 3, jumpRadius: 90, fireRate: 0.85,
    color: '#00ffcc', glow: '#00ffcc', type: 'chain',
    costMultiplier: 1.3, damageMultiplier: 1.55, rateMultiplier: 0.85, rangeMultiplier: 1.1,
    powerDmg: 0.05, powerRate: 0.04, powerRange: 0.03,
    levels: [
      { level: 1, damageMult: 1.00, fireRateMult: 1.00, rangeMult: 1.000, chainCount: 3, chainTargets: 3 },
      { level: 2, damageMult: 1.66, fireRateMult: 0.92, rangeMult: 1.065, chainCount: 3, chainTargets: 3 },
      { level: 3, damageMult: 2.77, fireRateMult: 0.84, rangeMult: 1.135, chainCount: 4, chainTargets: 4 },
      { level: 4, damageMult: 4.56, fireRateMult: 0.76, rangeMult: 1.210, chainCount: 5, chainTargets: 5 }
    ]
  },
  stasis: {
    cost: 65,
    range: 115,
    damage: 0,
    fireRate: 1.6,
    slowFactor: 0.30,
    slowDuration: 1.4,
    color: '#38bdf8', glow: '#38bdf8', type: 'stasis',
    costMultiplier: 1.3,
    damageMultiplier: 1.0,
    rateMultiplier: 0.88,
    rangeMultiplier: 1.15,
    powerRange: 0.05, powerSlow: 0.04, powerDuration: 0.06,
    levels: [
      { level: 1, damageMult: 1.00, fireRateMult: 1.00, rangeMult: 1.00, slowFactor: 0.30, slowDuration: 1.40 },
      { level: 2, damageMult: 1.00, fireRateMult: 0.92, rangeMult: 1.10, slowFactor: 0.37, slowDuration: 1.55 },
      { level: 3, damageMult: 1.00, fireRateMult: 0.85, rangeMult: 1.21, slowFactor: 0.44, slowDuration: 1.70 },
      { level: 4, damageMult: 1.00, fireRateMult: 0.78, rangeMult: 1.32, slowFactor: 0.50, slowDuration: 1.85 }
    ]
  },
  melter: {
    cost: 95,
    range: 140,
    baseDps: 10,
    rampCap: 40,
    rampTime: 4.0,
    cooldownTime: 4.0,
    color: '#e85268', glow: '#e477a3', type: 'melter',
    costMultiplier: 1.35,
    damageMultiplier: 1.55,
    rangeMultiplier: 1.1,
    powerDmg: 0.05, powerRate: 0.05, powerRange: 0.03,
    levels: [
      { level: 1, damageMult: 1.00, fireRateMult: 1.00, rangeMult: 1.000, rampCap: 40, rampTime: 4.00, cooldownTime: 4.00 },
      { level: 2, damageMult: 1.80, fireRateMult: 1.00, rangeMult: 1.065, rampCap: 40, rampTime: 4.25, cooldownTime: 3.75 },
      { level: 3, damageMult: 3.30, fireRateMult: 1.00, rangeMult: 1.135, rampCap: 40, rampTime: 4.55, cooldownTime: 3.45 },
      { level: 4, damageMult: 6.00, fireRateMult: 1.00, rangeMult: 1.210, rampCap: 40, rampTime: 4.80, cooldownTime: 3.20 }
    ]
  },
  railgun: {
    cost: 115, range: 220, damage: 120, fireRate: 2.2,
    color: '#a275df', glow: '#b57fdd', type: 'railgun',
    costMultiplier: 1.35, damageMultiplier: 1.5, rangeMultiplier: 1.1,
    powerDmg: 0.10, powerRate: 0.06, powerRange: 0.04,
    levels: [
      { level: 1, damageMult: 1.00, fireRateMult: 1.00, rangeMult: 1.000 },
      { level: 2, damageMult: 1.80, fireRateMult: 1.00, rangeMult: 1.065 },
      { level: 3, damageMult: 3.30, fireRateMult: 1.00, rangeMult: 1.135 },
      { level: 4, damageMult: 6.00, fireRateMult: 1.00, rangeMult: 1.210 }
    ]
  }
};

// [DAT.BN]
function getTowerLevelSpec(type, level) {
  const conf = TOWER_CONFIGS[type];
  if (!conf || !Array.isArray(conf.levels) || !conf.levels.length) return null;
  const maxLvl = typeof MAX_TOWER_LEVEL === 'number' ? MAX_TOWER_LEVEL : conf.levels.length;
  const idx = Math.max(1, Math.min(maxLvl, level || 1)) - 1;
  return conf.levels[idx] || conf.levels[0];
}

// [DAT.BO]
function getTowerUpgradeCostByLevel(type, currentLevel) {
  const conf = TOWER_CONFIGS[type];
  if (!conf) return 0;
  const lvl = Math.max(1, Math.floor(currentLevel || 1));
  if (lvl >= MAX_TOWER_LEVEL) return 0;
  const mult = TOWER_UPGRADE_COST_MULTS[lvl - 1];
  if (typeof mult !== 'number') return 0;
  return Math.round((conf.cost * mult) / 5) * 5;
}

const TOWER_ICONS = {
  gun: buildTowerIconSvg('gun'),
  laser: buildTowerIconSvg('laser'),
  mortar: buildTowerIconSvg('mortar'),
  tesla: buildTowerIconSvg('tesla'),
  stasis: buildTowerIconSvg('stasis'),
  melter: buildTowerIconSvg('melter'),
  railgun: buildTowerIconSvg('railgun')
};

const TOWER_UNLOCK_BLURBS = {
  gun: [
    '⚡ Fast single-target fire rate',
    '💰 Low cost — ideal early defense',
    '🎯 Reliable vs steady enemy lines'
  ],
  laser: [
    '🔥 Continuous unmissable beam',
    '🛡️ Melts slow armored targets',
    '⚡ Instant hit — zero travel time'
  ],
  mortar: [
    '💥 Huge AoE splash explosion',
    '🔭 Long artillery attack range',
    '👾 Crushes tight enemy groups'
  ],
  tesla: [
    '⚡ Chains up to 3–5 targets',
    '🐝 Ultimate swarm wiper',
    '🎯 Bypasses front-line blockers'
  ],
  stasis: [
    '❄️ Slows all enemies in radius',
    '⏱️ Multiplies time in kill-zones',
    '🔄 360° full-circle coverage'
  ],
  melter: [
    '📈 Damage ramps up to x40',
    '👑 Ultimate Boss & Goliath killer',
    '🔥 Devastating single-target lock'
  ],
  railgun: [
    '☄️ Pierces ALL enemies in a line',
    '🔭 Extreme sniper range (220)',
    '💥 Massive burst damage per shot'
  ]
};

const UPGRADE_STEP_COSTS = [6, 7, 8, 9, 10, 11, 12, 13, 15, 19];

// Tech Tree Upgrade Cost & Effective Level Calculators: Phase 1 (1-10), Phase 2 (11-15), Phase 3 (16+) spend and stat formulas.
// [DAT.C]
function getUpgradeCostForLevel(nextLvl) {
  if (nextLvl <= 10) {
    return {
      diamonds: UPGRADE_STEP_COSTS[nextLvl - 1] || 10,
      prisms: 0
    };
  } else if (nextLvl <= 15) {
    const phase2Costs = {
      11: { diamonds: 40, prisms: 2 },
      12: { diamonds: 50, prisms: 4 },
      13: { diamonds: 65, prisms: 6 },
      14: { diamonds: 80, prisms: 9 },
      15: { diamonds: 100, prisms: 12 }
    };
    return phase2Costs[nextLvl] || { diamonds: 100, prisms: 12 };
  } else {
    return {
      diamonds: 0,
      prisms: 15 + (nextLvl - 16) * 5
    };
  }
}

// [DAT.D]
function isScalingBranch(key) {
  if (!key) return false;
  if (key.endsWith('_power') || key === 'base_hp' || key === 'base_gold') {
    return true;
  }
  return false;
}

// [DAT.E]
function areAllBranchesMaxPhase1() {
  const branches = [
    'gun_power', 'laser_power', 'mortar_power', 'tesla_power',
    'stasis_power', 'melter_power', 'railgun_power',
    'base_hp', 'base_gold'
  ];
  return branches.every(key => (upgradeTreeData[key] || 0) >= 10);
}

// [DAT.F]
function getUpgradeEffectiveLevel(key) {
  const lvl = upgradeTreeData[key] || 0;
  if (lvl <= 10) return lvl;
  if (lvl <= 15) {
    if (lvl === 15) return 15 * 1.10; // 16.5 (бонус 10% на ASC MAX)
    return lvl;
  }
  if (key === 'base_hp') {
    return 16.5 + (lvl - 15);
  }
  const k = lvl - 15;
  const synthBonus = 20 * (1 - Math.pow(0.95, k));
  return 16.5 + synthBonus;
}

// [DAT.G]
function getUpgradeRangeBonus(towerType, effLvl) {
  const conf = TOWER_CONFIGS[towerType];
  if (!conf || !conf.powerRange) return 0;
  if (effLvl <= 10) {
    return effLvl * conf.powerRange;
  }
  const base10 = 10 * conf.powerRange;
  const post10 = (effLvl - 10) * 0.01;
  return base10 + post10;
}

// Tower Target Lock-on Specs: Lock-on delay constants and targeted tower classification.
const LOCK_ON_DELAY_LIGHT = 0.1;
const LOCK_ON_DELAY_HEAVY = 0.5;
const LOCKED_TARGET_TOWERS = ['laser', 'melter'];
const MORTAR_BASE_TRAVEL_TIME = 1.0;

// Enemy Configurations: Base stats, shapes, speeds, bounties, and swarm clump parameters.
const SWARM_CLUMP_SIZE = 10;
const SWARM_CLUMP_SIZE_DEBUT = 8;
const SWARM_DEBUT_LEVEL = 11;
// [DAT.H]
function swarmClumpSizeFor(lvl) {
  return lvl === SWARM_DEBUT_LEVEL ? SWARM_CLUMP_SIZE_DEBUT : SWARM_CLUMP_SIZE;
}
const SWARM_CLUMP_INTERVAL = 0.03;
const SWARM_CLUMP_GAP = 3.2;
const SWARM_BOUNTY_SCALE = 0.62;

const ENEMY_CONFIGS = {
  grunt: { shape: 'circle', color: '#f05f9f', glow: '#f05f9f', size: 11, baseSpeed: 55, baseHp: 40, baseBounty: 7 },
  scout: { shape: 'triangle', color: '#ff9100', glow: '#ffaa33', size: 11, baseSpeed: 110, baseHp: 24, baseBounty: 6 },
  tank: { shape: 'square', color: '#a06fdc', glow: '#825cc2', size: 13, baseSpeed: 38, baseHp: 100, baseBounty: 12 },
  swarm: { shape: 'diamond', color: '#00ffcc', glow: '#00ffcc', size: 8, baseSpeed: 170, baseHp: 16, baseBounty: 3 },
  blinker: { shape: 'hexagon', color: '#3b82f6', glow: '#60a5fa', size: 12, baseSpeed: 62, baseHp: 65, baseBounty: 8 },
  goliath: { shape: 'octagon', color: '#8964c4', glow: '#7050a4', size: 15, baseSpeed: 30, baseHp: 260, baseBounty: 18 },
  emp_bomber: { shape: 'triangle_inverted', color: '#38bdf8', glow: '#f05f9f', size: 13, baseSpeed: 40, baseHp: 170, baseBounty: 14 },
  hive_empress: { shape: 'diamond', color: '#00ffcc', glow: '#00ffcc', size: 15, baseSpeed: 38, baseHp: 2200, baseBounty: 60 },
  chronos_warp: { shape: 'hexagon', color: '#3b82f6', glow: '#60a5fa', size: 16, baseSpeed: 40, baseHp: 4200, baseBounty: 85 },
  titan_core: { shape: 'octagon', color: '#f97316', glow: '#fb923c', size: 17, baseSpeed: 28, baseHp: 5800, baseBounty: 110 },
  emp_overlord: { shape: 'triangle_inverted', color: '#38bdf8', glow: '#f05f9f', size: 17, baseSpeed: 30, baseHp: 7200, baseBounty: 140 }
};

// Map Catalog: Grid dimensions, tile paths, and obstacle locations for campaign levels.
const MAP_CATALOG = {
  L1: { name: "Straight Path", cols: 5, rows: 7, path: [{c: 2, r: 0}, {c: 2, r: 6}] },
  L2: { name: "First Turn", cols: 6, rows: 6, path: [{c: 4, r: 1}, {c: 4, r: 4}, {c: 1, r: 4}] },
  L3: { name: "Double Zigzag", cols: 6, rows: 7, path: [{c: 3, r: 0}, {c: 3, r: 2}, {c: 2, r: 2}, {c: 2, r: 6}] },
  L4: { name: "Centered Angle", cols: 7, rows: 7, path: [{c: 4, r: 0}, {c: 4, r: 3}, {c: 2, r: 3}, {c: 2, r: 6}] },
  L5: { name: "Side Runner", cols: 7, rows: 8, path: [{c: 1, r: 0}, {c: 1, r: 6}, {c: 3, r: 6}, {c: 3, r: 5}, {c: 5, r: 5}] },
  L6: { name: "Twin Bend", cols: 5, rows: 8, path: [{c: 3, r: 0}, {c: 3, r: 6}, {c: 1, r: 6}, {c: 1, r: 0}] },
  L7: { name: "Smooth Curve", cols: 7, rows: 8, path: [{c: 0, r: 6}, {c: 6, r: 6}, {c: 6, r: 3}, {c: 3, r: 3}, {c: 3, r: 0}] },
  L8: { name: "Loop Start", cols: 8, rows: 7, path: [{c: 1, r: 6}, {c: 1, r: 0}, {c: 6, r: 0}, {c: 6, r: 6}] },
  L9: { name: "Mirror Path", cols: 6, rows: 9, path: [{c: 0, r: 3}, {c: 2, r: 3}, {c: 2, r: 7}, {c: 4, r: 7}, {c: 4, r: 0}] },
  L10: { name: "Prime Boss", cols: 7, rows: 9, path: [{c: 3, r: 8}, {c: 3, r: 1}, {c: 1, r: 1}, {c: 1, r: 3}, {c: 6, r: 3}] },
  L11: { name: "Canyon Run", cols: 7, rows: 10, path: [{c: 6, r: 9}, {c: 0, r: 9}, {c: 0, r: 0}] },
  L12: { name: "Wall Trace", cols: 7, rows: 10, path: [{c: 6, r: 0}, {c: 6, r: 9}, {c: 0, r: 9}, {c: 0, r: 7}, {c: 1, r: 7}, {c: 1, r: 6}, {c: 2, r: 6}, {c: 2, r: 5}, {c: 3, r: 5}, {c: 3, r: 4}, {c: 4, r: 4}, {c: 4, r: 0}] },
  L13: { name: "Spiral In", cols: 7, rows: 10, path: [{c: 6, r: 9}, {c: 6, r: 5}, {c: 0, r: 5}, {c: 0, r: 3}, {c: 6, r: 3}, {c: 6, r: 0}] },
  L14: { name: "Crossroads", cols: 7, rows: 11, path: [{c: 0, r: 10}, {c: 0, r: 0}, {c: 6, r: 0}, {c: 6, r: 10}, {c: 2, r: 10}] },
  L15: { name: "Pocket Maze", cols: 4, rows: 11, path: [{c: 1, r: 10}, {c: 1, r: 2}, {c: 0, r: 2}, {c: 0, r: 0}, {c: 3, r: 0}, {c: 3, r: 2}, {c: 2, r: 2}, {c: 2, r: 10}] },
  L16: { name: "Offset Line", cols: 7, rows: 11, path: [{c: 0, r: 10}, {c: 6, r: 10}, {c: 6, r: 0}, {c: 0, r: 0}, {c: 0, r: 6}, {c: 4, r: 6}, {c: 4, r: 2}, {c: 2, r: 2}, {c: 2, r: 4}, {c: 3, r: 4}] },
  L17: { name: "Fold Twice", cols: 7, rows: 11, path: [{c: 6, r: 10}, {c: 0, r: 10}, {c: 0, r: 6}, {c: 6, r: 6}, {c: 6, r: 4}, {c: 0, r: 4}, {c: 0, r: 0}, {c: 6, r: 0}] },
  L18: { name: "Flow Pattern", cols: 7, rows: 11, path: [{c: 0, r: 0}, {c: 0, r: 4}, {c: 1, r: 4}, {c: 1, r: 6}, {c: 0, r: 6}, {c: 0, r: 10}, {c: 6, r: 10}, {c: 6, r: 6}, {c: 5, r: 6}, {c: 5, r: 4}, {c: 6, r: 4}, {c: 6, r: 0}] },
  L19: { name: "Loop Pocket", cols: 7, rows: 11, path: [{c: 6, r: 10}, {c: 0, r: 10}, {c: 0, r: 4}, {c: 6, r: 4}, {c: 6, r: 7}, {c: 2, r: 7}, {c: 2, r: 0}] },
  L20: { name: "Echo Boss", cols: 7, rows: 11, path: [{c: 6, r: 10}, {c: 5, r: 10}, {c: 5, r: 9}, {c: 4, r: 9}, {c: 4, r: 8}, {c: 3, r: 8}, {c: 3, r: 7}, {c: 2, r: 7}, {c: 2, r: 6}, {c: 1, r: 6}, {c: 1, r: 5}, {c: 0, r: 5}, {c: 0, r: 4}, {c: 1, r: 4}, {c: 1, r: 3}, {c: 2, r: 3}, {c: 2, r: 2}, {c: 3, r: 2}, {c: 3, r: 1}, {c: 4, r: 1}, {c: 4, r: 0}, {c: 5, r: 0}] },
  L21: { name: "Corridor East", cols: 7, rows: 12, path: [{c: 6, r: 11}, {c: 6, r: 7}, {c: 1, r: 7}, {c: 1, r: 9}, {c: 4, r: 9}, {c: 4, r: 10}, {c: 0, r: 10}, {c: 0, r: 5}, {c: 6, r: 5}, {c: 6, r: 0}, {c: 2, r: 0}, {c: 2, r: 2}, {c: 4, r: 2}, {c: 4, r: 3}, {c: 0, r: 3}, {c: 0, r: 0}] },
  L22: { name: "Zigzag Wide", cols: 7, rows: 13, path: [{c: 0, r: 12}, {c: 0, r: 7}, {c: 6, r: 7}, {c: 6, r: 11}, {c: 1, r: 11}, {c: 1, r: 1}, {c: 6, r: 1}, {c: 6, r: 5}, {c: 0, r: 5}, {c: 0, r: 0}] },
  L23: { name: "Box Track", cols: 6, rows: 14, path: [{c: 1, r: 13}, {c: 1, r: 10}, {c: 4, r: 10}, {c: 4, r: 12}, {c: 2, r: 12}, {c: 2, r: 7}, {c: 4, r: 7}, {c: 4, r: 9}, {c: 1, r: 9}, {c: 1, r: 4}, {c: 3, r: 4}, {c: 3, r: 6}, {c: 0, r: 6}, {c: 0, r: 1}, {c: 5, r: 1}, {c: 5, r: 3}, {c: 1, r: 3}] },
  L24: { name: "Double Fold", cols: 7, rows: 13, path: [{c: 6, r: 12}, {c: 6, r: 0}, {c: 4, r: 0}, {c: 4, r: 2}, {c: 5, r: 2}, {c: 5, r: 4}, {c: 4, r: 4}, {c: 4, r: 6}, {c: 5, r: 6}, {c: 5, r: 8}, {c: 4, r: 8}, {c: 4, r: 10}, {c: 5, r: 10}, {c: 5, r: 12}, {c: 0, r: 12}, {c: 0, r: 6}, {c: 2, r: 6}, {c: 2, r: 5}, {c: 0, r: 5}, {c: 0, r: 0}] },
  L25: { name: "Weave Path", cols: 7, rows: 14, path: [{c: 0, r: 0}, {c: 0, r: 13}, {c: 3, r: 13}, {c: 3, r: 10}, {c: 1, r: 10}, {c: 1, r: 12}, {c: 6, r: 12}, {c: 6, r: 6}, {c: 1, r: 6}, {c: 1, r: 4}, {c: 6, r: 4}, {c: 6, r: 0}] },
  L26: { name: "Staircase", cols: 8, rows: 14, path: [{c: 0, r: 13}, {c: 7, r: 13}, {c: 7, r: 11}, {c: 0, r: 11}, {c: 0, r: 7}, {c: 7, r: 7}, {c: 7, r: 5}, {c: 0, r: 5}, {c: 0, r: 2}, {c: 7, r: 2}, {c: 7, r: 0}, {c: 0, r: 0}] },
  L27: { name: "Reverse Flow", cols: 7, rows: 15, path: [{c: 4, r: 11}, {c: 4, r: 8}, {c: 2, r: 8}, {c: 2, r: 10}, {c: 6, r: 10}, {c: 6, r: 0}, {c: 0, r: 0}, {c: 0, r: 3}, {c: 4, r: 3}, {c: 4, r: 1}, {c: 2, r: 1}, {c: 2, r: 5}, {c: 0, r: 5}, {c: 0, r: 14}, {c: 6, r: 14}] },
  L28: { name: "Spiral Tight", cols: 8, rows: 16, path: [{c: 0, r: 0}, {c: 0, r: 4}, {c: 3, r: 4}, {c: 3, r: 0}, {c: 1, r: 0}, {c: 1, r: 3}, {c: 7, r: 3}, {c: 7, r: 0}, {c: 4, r: 0}, {c: 4, r: 15}, {c: 7, r: 15}, {c: 7, r: 11}, {c: 0, r: 11}, {c: 0, r: 15}, {c: 3, r: 15}, {c: 3, r: 8}, {c: 0, r: 8}] },
  L29: { name: "Loop Maze", cols: 8, rows: 16, path: [{c: 0, r: 15}, {c: 7, r: 15}, {c: 7, r: 0}, {c: 0, r: 0}, {c: 0, r: 13}, {c: 5, r: 13}, {c: 5, r: 2}, {c: 2, r: 2}, {c: 2, r: 11}] },
  L30: { name: "Chaos Boss", cols: 8, rows: 16, path: [{c: 0, r: 15}, {c: 7, r: 15}, {c: 7, r: 6}, {c: 1, r: 6}, {c: 1, r: 11}, {c: 5, r: 11}, {c: 5, r: 9}, {c: 2, r: 9}, {c: 2, r: 7}, {c: 6, r: 7}, {c: 6, r: 12}, {c: 0, r: 12}, {c: 0, r: 4}, {c: 7, r: 4}, {c: 7, r: 0}, {c: 0, r: 0}, {c: 0, r: 3}, {c: 6, r: 3}, {c: 6, r: 1}, {c: 1, r: 1}] },
  L31: { name: "Branch Left", cols: 7, rows: 14, path: [{c: 1, r: 0}, {c: 1, r: 4}, {c: 4, r: 4}, {c: 4, r: 8}, {c: 1, r: 8}, {c: 1, r: 13}, {c: 5, r: 13}, {c: 5, r: 10}, {c: 3, r: 10}, {c: 3, r: 12}], blocked: [{c: 3, r: 2}, {c: 2, r: 6}, {c: 3, r: 9}] },
  L32: { name: "Branch Right", cols: 7, rows: 14, path: [{c: 3, r: 0}, {c: 3, r: 4}, {c: 6, r: 4}, {c: 6, r: 7}, {c: 4, r: 7}, {c: 4, r: 9}, {c: 0, r: 9}, {c: 0, r: 11}, {c: 2, r: 11}, {c: 2, r: 13}], blocked: [{c: 5, r: 2}, {c: 4, r: 3}, {c: 2, r: 7}, {c: 3, r: 6}, {c: 3, r: 10}] },
  L33: { name: "Grid Cross", cols: 6, rows: 14, path: [{c: 4, r: 0}, {c: 4, r: 4}, {c: 0, r: 4}, {c: 0, r: 7}, {c: 5, r: 7}, {c: 5, r: 9}, {c: 0, r: 9}, {c: 0, r: 13}, {c: 5, r: 13}, {c: 5, r: 11}], blocked: [{c: 1, r: 5}, {c: 2, r: 6}, {c: 3, r: 5}, {c: 3, r: 8}, {c: 1, r: 8}, {c: 2, r: 10}, {c: 3, r: 11}, {c: 1, r: 11}, {c: 2, r: 12}, {c: 4, r: 10}] },
  L34: { name: "Offset Grid", cols: 6, rows: 13, path: [{c: 4, r: 0}, {c: 4, r: 4}, {c: 1, r: 4}, {c: 1, r: 7}, {c: 5, r: 7}, {c: 5, r: 10}, {c: 2, r: 10}, {c: 2, r: 12}, {c: 0, r: 12}, {c: 0, r: 9}, {c: 2, r: 9}], blocked: [{c: 2, r: 6}, {c: 3, r: 5}, {c: 4, r: 6}, {c: 5, r: 5}, {c: 3, r: 3}, {c: 2, r: 2}, {c: 1, r: 1}, {c: 3, r: 9}, {c: 4, r: 8}, {c: 2, r: 8}, {c: 1, r: 10}, {c: 3, r: 11}, {c: 0, r: 6}, {c: 0, r: 5}] },
  L35: { name: "Spiral Out", cols: 7, rows: 14, path: [{c: 5, r: 0}, {c: 5, r: 4}, {c: 2, r: 4}, {c: 2, r: 9}, {c: 6, r: 9}, {c: 6, r: 12}, {c: 2, r: 12}, {c: 2, r: 10}, {c: 0, r: 10}, {c: 0, r: 13}, {c: 2, r: 13}], blocked: [{c: 3, r: 8}, {c: 3, r: 7}, {c: 3, r: 6}, {c: 3, r: 5}, {c: 5, r: 5}, {c: 5, r: 6}, {c: 5, r: 7}, {c: 5, r: 8}, {c: 3, r: 10}, {c: 3, r: 11}, {c: 5, r: 11}, {c: 5, r: 10}, {c: 1, r: 11}, {c: 1, r: 12}, {c: 3, r: 13}, {c: 5, r: 13}, {c: 1, r: 9}, {c: 1, r: 8}, {c: 1, r: 7}, {c: 1, r: 6}, {c: 1, r: 5}, {c: 1, r: 4}, {c: 1, r: 3}, {c: 1, r: 2}, {c: 1, r: 1}, {c: 1, r: 0}, {c: 3, r: 3}, {c: 3, r: 2}, {c: 3, r: 1}, {c: 3, r: 0}] },
  L36: { name: "Wide Loop", cols: 7, rows: 14, path: [{c: 1, r: 0}, {c: 1, r: 3}, {c: 4, r: 3}, {c: 4, r: 7}, {c: 0, r: 7}, {c: 0, r: 10}, {c: 4, r: 10}, {c: 4, r: 8}, {c: 6, r: 8}, {c: 6, r: 11}, {c: 4, r: 11}, {c: 4, r: 13}], blocked: [{c: 3, r: 1}, {c: 2, r: 5}, {c: 3, r: 8}, {c: 5, r: 9}, {c: 4, r: 2}, {c: 2, r: 0}, {c: 2, r: 2}, {c: 4, r: 0}, {c: 5, r: 1}, {c: 6, r: 0}, {c: 6, r: 1}, {c: 6, r: 2}, {c: 6, r: 3}, {c: 6, r: 4}, {c: 6, r: 5}, {c: 6, r: 6}, {c: 6, r: 7}, {c: 0, r: 13}, {c: 1, r: 13}, {c: 2, r: 13}, {c: 2, r: 12}, {c: 1, r: 12}, {c: 0, r: 12}, {c: 6, r: 13}, {c: 0, r: 6}, {c: 0, r: 5}, {c: 0, r: 4}, {c: 0, r: 3}, {c: 0, r: 2}, {c: 0, r: 1}, {c: 0, r: 0}, {c: 3, r: 4}, {c: 1, r: 4}, {c: 3, r: 6}, {c: 1, r: 6}, {c: 5, r: 3}, {c: 5, r: 5}, {c: 5, r: 7}, {c: 2, r: 9}, {c: 1, r: 8}, {c: 1, r: 11}, {c: 3, r: 11}, {c: 3, r: 13}, {c: 5, r: 12}] },
  L37: { name: "Double Spiral", cols: 7, rows: 14, path: [{c: 1, r: 0}, {c: 1, r: 5}, {c: 6, r: 5}, {c: 6, r: 8}, {c: 1, r: 8}, {c: 1, r: 10}, {c: 4, r: 10}, {c: 4, r: 13}, {c: 2, r: 13}, {c: 2, r: 11}, {c: 0, r: 11}, {c: 0, r: 13}], blocked: [{c: 3, r: 3}, {c: 3, r: 2}, {c: 3, r: 1}, {c: 3, r: 0}, {c: 4, r: 1}, {c: 4, r: 0}, {c: 4, r: 2}, {c: 4, r: 3}, {c: 5, r: 3}, {c: 6, r: 3}, {c: 6, r: 2}, {c: 5, r: 2}, {c: 5, r: 1}, {c: 6, r: 1}, {c: 6, r: 0}, {c: 5, r: 0}, {c: 0, r: 0}, {c: 0, r: 1}, {c: 2, r: 0}, {c: 0, r: 2}, {c: 0, r: 3}, {c: 0, r: 4}, {c: 0, r: 5}, {c: 0, r: 6}, {c: 0, r: 7}, {c: 0, r: 8}, {c: 0, r: 9}, {c: 0, r: 10}, {c: 5, r: 13}, {c: 6, r: 13}, {c: 6, r: 12}, {c: 6, r: 11}, {c: 6, r: 10}, {c: 5, r: 10}, {c: 5, r: 11}, {c: 5, r: 12}, {c: 6, r: 9}, {c: 5, r: 9}, {c: 4, r: 9}, {c: 1, r: 13}, {c: 6, r: 4}, {c: 5, r: 4}, {c: 2, r: 4}, {c: 5, r: 6}, {c: 5, r: 7}, {c: 1, r: 6}, {c: 1, r: 7}, {c: 2, r: 6}, {c: 2, r: 7}] },
  L38: { name: "Needle Eye", cols: 7, rows: 14, path: [{c: 1, r: 0}, {c: 1, r: 12}, {c: 5, r: 12}, {c: 5, r: 1}, {c: 2, r: 1}, {c: 2, r: 11}], blocked: [{c: 0, r: 12}, {c: 1, r: 13}, {c: 2, r: 13}, {c: 3, r: 13}, {c: 4, r: 13}, {c: 5, r: 13}, {c: 6, r: 12}, {c: 0, r: 10}, {c: 0, r: 0}, {c: 2, r: 0}, {c: 3, r: 0}, {c: 4, r: 0}, {c: 5, r: 0}, {c: 6, r: 1}, {c: 6, r: 10}, {c: 6, r: 7}, {c: 6, r: 4}, {c: 0, r: 7}, {c: 0, r: 3}, {c: 3, r: 11}, {c: 4, r: 10}, {c: 4, r: 2}, {c: 3, r: 3}, {c: 3, r: 8}, {c: 4, r: 8}, {c: 4, r: 7}, {c: 4, r: 6}, {c: 4, r: 5}, {c: 3, r: 5}, {c: 3, r: 6}, {c: 3, r: 7}, {c: 4, r: 4}, {c: 3, r: 9}] },
  L39: { name: "Complex Maze", cols: 7, rows: 14, path: [{c: 0, r: 13}, {c: 6, r: 13}, {c: 6, r: 0}, {c: 0, r: 0}, {c: 0, r: 12}, {c: 5, r: 12}, {c: 5, r: 7}, {c: 4, r: 7}, {c: 4, r: 5}, {c: 5, r: 5}, {c: 5, r: 1}, {c: 1, r: 1}, {c: 1, r: 5}, {c: 2, r: 5}, {c: 2, r: 7}, {c: 1, r: 7}, {c: 1, r: 11}, {c: 3, r: 11}, {c: 3, r: 2}], blocked: [{c: 2, r: 9}, {c: 4, r: 9}] },
  L40: { name: "Ultimate Boss", cols: 7, rows: 14, path: [{c: 0, r: 13}, {c: 3, r: 13}, {c: 3, r: 9}, {c: 0, r: 9}, {c: 0, r: 12}, {c: 6, r: 12}, {c: 6, r: 13}, {c: 4, r: 13}, {c: 4, r: 6}, {c: 6, r: 6}, {c: 6, r: 8}, {c: 0, r: 8}, {c: 0, r: 4}, {c: 3, r: 4}, {c: 3, r: 6}, {c: 1, r: 6}, {c: 1, r: 1}, {c: 6, r: 1}, {c: 6, r: 4}, {c: 4, r: 4}, {c: 4, r: 0}], blocked: [{c: 0, r: 0}, {c: 1, r: 0}, {c: 2, r: 0}, {c: 3, r: 0}, {c: 5, r: 0}, {c: 6, r: 0}, {c: 0, r: 1}, {c: 0, r: 2}, {c: 0, r: 3}, {c: 2, r: 3}, {c: 3, r: 2}, {c: 6, r: 5}, {c: 5, r: 5}, {c: 3, r: 7}, {c: 2, r: 10}, {c: 1, r: 11}, {c: 6, r: 9}, {c: 6, r: 10}, {c: 6, r: 11}] },
  L41: { name: "Expansion Alpha", cols: 8, rows: 15, path: [{c: 0, r: 13}, {c: 7, r: 13}, {c: 7, r: 11}, {c: 0, r: 11}, {c: 0, r: 8}, {c: 7, r: 8}, {c: 7, r: 4}, {c: 0, r: 4}, {c: 0, r: 0}, {c: 7, r: 0}], blocked: [{c: 0, r: 14}, {c: 7, r: 14}, {c: 4, r: 12}, {c: 0, r: 12}, {c: 1, r: 14}, {c: 6, r: 14}, {c: 7, r: 9}, {c: 7, r: 10}, {c: 7, r: 3}, {c: 7, r: 2}, {c: 7, r: 1}, {c: 0, r: 7}, {c: 0, r: 6}, {c: 0, r: 5}, {c: 1, r: 6}, {c: 2, r: 6}, {c: 3, r: 6}, {c: 4, r: 6}, {c: 5, r: 6}, {c: 2, r: 2}, {c: 3, r: 2}, {c: 4, r: 2}, {c: 5, r: 2}, {c: 6, r: 2}] },
  L42: { name: "Expansion Beta", cols: 8, rows: 16, path: [{c: 0, r: 15}, {c: 7, r: 15}, {c: 7, r: 11}, {c: 0, r: 11}, {c: 0, r: 14}, {c: 6, r: 14}, {c: 6, r: 9}, {c: 0, r: 9}, {c: 0, r: 7}, {c: 2, r: 7}, {c: 2, r: 10}, {c: 7, r: 10}, {c: 7, r: 4}, {c: 0, r: 4}, {c: 0, r: 6}, {c: 6, r: 6}, {c: 6, r: 0}, {c: 0, r: 0}, {c: 0, r: 3}, {c: 7, r: 3}, {c: 7, r: 1}, {c: 1, r: 1}], blocked: [{c: 7, r: 0}, {c: 0, r: 10}, {c: 1, r: 12}, {c: 1, r: 13}, {c: 5, r: 13}, {c: 5, r: 12}, {c: 6, r: 8}, {c: 6, r: 7}, {c: 1, r: 5}] },
  L43: { name: "Growth Gamma", cols: 9, rows: 16, path: [{c: 0, r: 15}, {c: 8, r: 15}, {c: 8, r: 8}, {c: 6, r: 8}, {c: 6, r: 5}, {c: 8, r: 5}, {c: 8, r: 0}, {c: 5, r: 0}, {c: 5, r: 1}, {c: 3, r: 1}, {c: 3, r: 0}, {c: 0, r: 0}, {c: 0, r: 5}, {c: 3, r: 5}, {c: 3, r: 8}, {c: 0, r: 8}, {c: 0, r: 10}, {c: 6, r: 10}, {c: 6, r: 13}, {c: 0, r: 13}], blocked: [{c: 8, r: 7}, {c: 8, r: 6}, {c: 7, r: 6}, {c: 7, r: 7}, {c: 4, r: 0}, {c: 2, r: 6}, {c: 2, r: 7}, {c: 1, r: 7}, {c: 0, r: 7}, {c: 0, r: 6}, {c: 1, r: 6}, {c: 7, r: 1}, {c: 1, r: 1}, {c: 7, r: 14}, {c: 0, r: 14}, {c: 0, r: 12}, {c: 0, r: 11}, {c: 5, r: 12}, {c: 1, r: 14}, {c: 1, r: 9}, {c: 2, r: 9}, {c: 1, r: 11}, {c: 1, r: 12}, {c: 5, r: 11}, {c: 1, r: 4}, {c: 7, r: 4}, {c: 6, r: 3}, {c: 6, r: 2}, {c: 2, r: 2}, {c: 2, r: 3}] },
  L44: { name: "Growth Delta", cols: 9, rows: 18, path: [{c: 0, r: 17}, {c: 4, r: 17}, {c: 4, r: 12}, {c: 5, r: 12}, {c: 5, r: 17}, {c: 8, r: 17}, {c: 8, r: 8}, {c: 4, r: 8}, {c: 4, r: 7}, {c: 8, r: 7}, {c: 8, r: 0}, {c: 5, r: 0}, {c: 5, r: 4}, {c: 4, r: 4}, {c: 4, r: 0}, {c: 0, r: 0}, {c: 0, r: 7}, {c: 3, r: 7}, {c: 3, r: 8}, {c: 0, r: 8}, {c: 0, r: 16}], blocked: [{c: 2, r: 16}, {c: 1, r: 16}, {c: 1, r: 15}, {c: 2, r: 14}, {c: 1, r: 14}, {c: 1, r: 13}, {c: 1, r: 12}, {c: 2, r: 12}, {c: 3, r: 15}, {c: 3, r: 13}, {c: 1, r: 9}, {c: 2, r: 10}, {c: 3, r: 10}, {c: 4, r: 10}, {c: 5, r: 10}, {c: 6, r: 10}, {c: 1, r: 11}, {c: 7, r: 10}, {c: 7, r: 11}, {c: 6, r: 12}, {c: 7, r: 13}, {c: 6, r: 14}, {c: 7, r: 15}, {c: 6, r: 16}, {c: 3, r: 11}, {c: 5, r: 11}, {c: 3, r: 9}, {c: 5, r: 9}, {c: 7, r: 9}, {c: 1, r: 6}, {c: 1, r: 5}, {c: 1, r: 4}, {c: 1, r: 3}, {c: 1, r: 2}, {c: 1, r: 1}, {c: 2, r: 6}, {c: 3, r: 5}, {c: 4, r: 6}, {c: 5, r: 5}, {c: 6, r: 6}, {c: 7, r: 5}, {c: 6, r: 4}, {c: 7, r: 3}, {c: 6, r: 2}, {c: 7, r: 1}, {c: 2, r: 4}, {c: 3, r: 3}, {c: 2, r: 2}, {c: 3, r: 1}] },
  L45: { name: "Growth Large", cols: 9, rows: 17, path: [{c: 0, r: 16}, {c: 8, r: 16}, {c: 8, r: 8}, {c: 1, r: 8}, {c: 1, r: 14}, {c: 6, r: 14}, {c: 6, r: 13}, {c: 2, r: 13}, {c: 2, r: 9}, {c: 3, r: 9}, {c: 3, r: 12}, {c: 7, r: 12}, {c: 7, r: 15}, {c: 0, r: 15}, {c: 0, r: 6}, {c: 8, r: 6}, {c: 8, r: 0}, {c: 0, r: 0}, {c: 0, r: 4}, {c: 7, r: 4}, {c: 7, r: 1}, {c: 1, r: 1}, {c: 1, r: 3}, {c: 6, r: 3}], blocked: [{c: 8, r: 7}, {c: 0, r: 5}, {c: 1, r: 7}, {c: 7, r: 5}, {c: 4, r: 11}, {c: 5, r: 10}, {c: 6, r: 9}, {c: 7, r: 11}, {c: 4, r: 2}, {c: 3, r: 5}, {c: 4, r: 5}, {c: 4, r: 7}, {c: 5, r: 7}] },
  L46: { name: "Extended Path", cols: 9, rows: 18, path: [{c: 8, r: 0}, {c: 7, r: 0}, {c: 7, r: 1}, {c: 6, r: 1}, {c: 6, r: 2}, {c: 2, r: 2}, {c: 2, r: 3}, {c: 1, r: 3}, {c: 1, r: 4}, {c: 0, r: 4}, {c: 0, r: 5}, {c: 1, r: 5}, {c: 1, r: 6}, {c: 2, r: 6}, {c: 2, r: 7}, {c: 6, r: 7}, {c: 6, r: 8}, {c: 7, r: 8}, {c: 7, r: 9}, {c: 8, r: 9}, {c: 8, r: 10}, {c: 7, r: 10}, {c: 7, r: 11}, {c: 6, r: 11}, {c: 6, r: 12}, {c: 2, r: 12}, {c: 2, r: 13}, {c: 1, r: 13}, {c: 1, r: 14}, {c: 0, r: 14}, {c: 0, r: 15}, {c: 1, r: 15}, {c: 1, r: 16}, {c: 2, r: 16}, {c: 2, r: 17}, {c: 4, r: 17}, {c: 4, r: 0}], blocked: [{c: 8, r: 17}, {c: 7, r: 17}, {c: 8, r: 16}, {c: 7, r: 16}, {c: 8, r: 15}, {c: 7, r: 15}, {c: 8, r: 14}, {c: 7, r: 14}, {c: 6, r: 17}, {c: 6, r: 16}, {c: 6, r: 15}, {c: 6, r: 14}, {c: 0, r: 11}, {c: 1, r: 11}, {c: 1, r: 10}, {c: 0, r: 10}, {c: 0, r: 9}, {c: 1, r: 9}, {c: 2, r: 9}, {c: 2, r: 10}, {c: 0, r: 8}, {c: 1, r: 8}, {c: 8, r: 6}, {c: 7, r: 6}, {c: 7, r: 5}, {c: 8, r: 5}, {c: 8, r: 4}, {c: 8, r: 3}, {c: 7, r: 3}, {c: 7, r: 4}, {c: 6, r: 4}, {c: 6, r: 5}, {c: 0, r: 1}, {c: 1, r: 0}, {c: 0, r: 0}, {c: 2, r: 0}, {c: 6, r: 0}, {c: 3, r: 0}, {c: 5, r: 0}, {c: 5, r: 6}, {c: 5, r: 3}, {c: 3, r: 6}, {c: 3, r: 3}, {c: 0, r: 2}, {c: 1, r: 1}, {c: 3, r: 8}, {c: 3, r: 11}, {c: 5, r: 10}, {c: 5, r: 9}, {c: 8, r: 13}, {c: 7, r: 13}, {c: 8, r: 12}, {c: 8, r: 7}, {c: 5, r: 13}, {c: 5, r: 17}, {c: 3, r: 13}, {c: 3, r: 16}, {c: 5, r: 15}, {c: 0, r: 12}, {c: 0, r: 16}, {c: 0, r: 17}, {c: 1, r: 17}, {c: 8, r: 2}, {c: 0, r: 7}] },
  L47: { name: "Extended Wide", cols: 10, rows: 20, path: [{c: 5, r: 19}, {c: 5, r: 8}, {c: 4, r: 8}, {c: 4, r: 9}, {c: 3, r: 9}, {c: 3, r: 7}, {c: 2, r: 7}, {c: 2, r: 10}, {c: 4, r: 10}, {c: 4, r: 11}, {c: 1, r: 11}, {c: 1, r: 6}, {c: 4, r: 6}, {c: 4, r: 7}, {c: 5, r: 7}, {c: 5, r: 6}, {c: 8, r: 6}, {c: 8, r: 11}, {c: 6, r: 11}, {c: 6, r: 10}, {c: 7, r: 10}, {c: 7, r: 9}, {c: 6, r: 9}, {c: 6, r: 8}, {c: 7, r: 8}, {c: 7, r: 7}, {c: 6, r: 7}, {c: 6, r: 0}], blocked: [{c: 9, r: 19}, {c: 8, r: 19}, {c: 6, r: 19}, {c: 7, r: 19}, {c: 8, r: 18}, {c: 9, r: 18}, {c: 9, r: 17}, {c: 4, r: 19}, {c: 3, r: 19}, {c: 2, r: 19}, {c: 0, r: 19}, {c: 1, r: 19}, {c: 0, r: 18}, {c: 1, r: 18}, {c: 0, r: 17}, {c: 1, r: 17}, {c: 2, r: 18}, {c: 0, r: 16}, {c: 0, r: 15}, {c: 1, r: 16}, {c: 2, r: 17}, {c: 3, r: 18}, {c: 7, r: 18}, {c: 8, r: 17}, {c: 9, r: 16}, {c: 9, r: 15}, {c: 0, r: 14}, {c: 0, r: 12}, {c: 0, r: 13}, {c: 9, r: 12}, {c: 9, r: 14}, {c: 9, r: 13}, {c: 9, r: 4}, {c: 9, r: 3}, {c: 9, r: 2}, {c: 9, r: 1}, {c: 9, r: 0}, {c: 7, r: 0}, {c: 8, r: 0}, {c: 8, r: 1}, {c: 5, r: 0}, {c: 4, r: 0}, {c: 3, r: 0}, {c: 2, r: 0}, {c: 1, r: 0}, {c: 0, r: 0}, {c: 0, r: 1}, {c: 0, r: 2}, {c: 0, r: 3}, {c: 0, r: 4}, {c: 0, r: 5}, {c: 1, r: 1}, {c: 1, r: 2}, {c: 2, r: 1}, {c: 4, r: 1}, {c: 3, r: 1}, {c: 2, r: 2}, {c: 3, r: 2}, {c: 1, r: 3}, {c: 2, r: 3}, {c: 1, r: 4}, {c: 9, r: 5}, {c: 4, r: 12}, {c: 6, r: 12}, {c: 7, r: 5}, {c: 5, r: 5}, {c: 1, r: 15}, {c: 1, r: 14}, {c: 1, r: 13}, {c: 1, r: 12}] },
  L48: { name: "Extended Deep", cols: 10, rows: 20, path: [{c: 1, r: 16}, {c: 1, r: 13}, {c: 4, r: 13}, {c: 4, r: 17}, {c: 0, r: 17}, {c: 0, r: 12}, {c: 5, r: 12}, {c: 5, r: 18}, {c: 0, r: 18}, {c: 0, r: 19}, {c: 9, r: 19}, {c: 9, r: 18}, {c: 6, r: 18}, {c: 6, r: 12}, {c: 9, r: 12}, {c: 9, r: 17}, {c: 8, r: 17}, {c: 8, r: 0}, {c: 1, r: 0}, {c: 1, r: 10}, {c: 6, r: 10}, {c: 6, r: 2}, {c: 3, r: 2}, {c: 3, r: 8}, {c: 5, r: 8}, {c: 5, r: 7}, {c: 4, r: 7}, {c: 4, r: 6}, {c: 5, r: 6}, {c: 5, r: 5}, {c: 4, r: 5}], blocked: [{c: 2, r: 16}, {c: 3, r: 16}, {c: 7, r: 17}, {c: 7, r: 16}, {c: 9, r: 11}, {c: 9, r: 9}, {c: 9, r: 10}, {c: 9, r: 8}, {c: 9, r: 7}, {c: 9, r: 6}, {c: 9, r: 5}, {c: 9, r: 4}, {c: 9, r: 3}, {c: 9, r: 2}, {c: 9, r: 0}, {c: 9, r: 1}, {c: 0, r: 0}, {c: 0, r: 1}, {c: 0, r: 2}, {c: 0, r: 3}, {c: 0, r: 4}, {c: 0, r: 6}, {c: 0, r: 5}, {c: 0, r: 7}, {c: 0, r: 8}, {c: 0, r: 9}, {c: 0, r: 10}, {c: 0, r: 11}, {c: 5, r: 9}, {c: 4, r: 9}, {c: 2, r: 9}, {c: 3, r: 9}, {c: 2, r: 1}, {c: 7, r: 1}, {c: 7, r: 11}, {c: 7, r: 10}, {c: 1, r: 11}, {c: 2, r: 11}, {c: 6, r: 11}, {c: 5, r: 11}, {c: 4, r: 11}, {c: 3, r: 11}, {c: 7, r: 9}, {c: 6, r: 1}, {c: 5, r: 1}, {c: 4, r: 1}, {c: 3, r: 1}, {c: 2, r: 2}, {c: 7, r: 2}, {c: 7, r: 3}, {c: 2, r: 3}, {c: 2, r: 4}, {c: 7, r: 4}, {c: 7, r: 5}, {c: 2, r: 5}] },
  L49: { name: "Extended Complex", cols: 10, rows: 20, path: [{c: 4, r: 4}, {c: 4, r: 5}, {c: 5, r: 5}, {c: 5, r: 3}, {c: 3, r: 3}, {c: 3, r: 6}, {c: 6, r: 6}, {c: 6, r: 2}, {c: 2, r: 2}, {c: 2, r: 7}, {c: 6, r: 7}, {c: 6, r: 17}, {c: 2, r: 17}, {c: 2, r: 12}, {c: 5, r: 12}, {c: 5, r: 16}, {c: 3, r: 16}, {c: 3, r: 13}, {c: 4, r: 13}, {c: 4, r: 15}], blocked: [{c: 9, r: 19}, {c: 9, r: 18}, {c: 9, r: 17}, {c: 9, r: 16}, {c: 9, r: 15}, {c: 9, r: 14}, {c: 9, r: 13}, {c: 9, r: 12}, {c: 9, r: 7}, {c: 9, r: 5}, {c: 9, r: 4}, {c: 9, r: 3}, {c: 9, r: 2}, {c: 9, r: 1}, {c: 9, r: 0}, {c: 5, r: 11}, {c: 5, r: 10}, {c: 5, r: 9}, {c: 5, r: 8}, {c: 7, r: 8}, {c: 7, r: 9}, {c: 7, r: 11}, {c: 7, r: 10}, {c: 4, r: 8}, {c: 3, r: 8}, {c: 2, r: 8}, {c: 1, r: 8}, {c: 0, r: 8}, {c: 0, r: 11}, {c: 1, r: 11}, {c: 2, r: 11}, {c: 3, r: 11}, {c: 4, r: 11}, {c: 0, r: 0}, {c: 0, r: 19}] },
  L50: { name: "Final Apex", cols: 20, rows: 17, path: [{c: 0, r: 16}, {c: 0, r: 11}, {c: 6, r: 11}, {c: 6, r: 16}, {c: 1, r: 16}, {c: 1, r: 12}, {c: 5, r: 12}, {c: 5, r: 15}, {c: 2, r: 15}, {c: 2, r: 10}, {c: 19, r: 10}, {c: 19, r: 16}, {c: 14, r: 16}, {c: 14, r: 11}, {c: 18, r: 11}, {c: 18, r: 15}, {c: 15, r: 15}, {c: 15, r: 12}, {c: 17, r: 12}, {c: 17, r: 2}, {c: 14, r: 2}, {c: 14, r: 5}, {c: 18, r: 5}, {c: 18, r: 1}, {c: 13, r: 1}, {c: 13, r: 6}, {c: 19, r: 6}, {c: 19, r: 0}, {c: 0, r: 0}, {c: 0, r: 6}, {c: 6, r: 6}, {c: 6, r: 1}, {c: 1, r: 1}, {c: 1, r: 5}, {c: 5, r: 5}, {c: 5, r: 2}, {c: 2, r: 2}, {c: 2, r: 8}, {c: 10, r: 8}], blocked: [{c: 0, r: 10}, {c: 1, r: 10}, {c: 1, r: 9}, {c: 1, r: 8}, {c: 1, r: 7}, {c: 0, r: 7}, {c: 0, r: 8}, {c: 0, r: 9}, {c: 7, r: 16}, {c: 8, r: 16}, {c: 9, r: 16}, {c: 10, r: 16}, {c: 11, r: 16}, {c: 12, r: 16}, {c: 13, r: 16}, {c: 13, r: 15}, {c: 13, r: 14}, {c: 13, r: 13}, {c: 13, r: 12}, {c: 13, r: 11}, {c: 12, r: 11}, {c: 11, r: 11}, {c: 10, r: 11}, {c: 9, r: 11}, {c: 8, r: 11}, {c: 7, r: 11}, {c: 7, r: 12}, {c: 7, r: 13}, {c: 7, r: 14}, {c: 7, r: 15}, {c: 8, r: 15}, {c: 9, r: 15}, {c: 10, r: 15}, {c: 11, r: 15}, {c: 12, r: 15}, {c: 12, r: 14}, {c: 11, r: 14}, {c: 10, r: 14}, {c: 9, r: 14}, {c: 8, r: 14}, {c: 8, r: 13}, {c: 9, r: 13}, {c: 10, r: 13}, {c: 11, r: 13}, {c: 12, r: 12}, {c: 12, r: 13}, {c: 11, r: 12}, {c: 10, r: 12}, {c: 9, r: 12}, {c: 8, r: 12}, {c: 7, r: 1}, {c: 8, r: 1}, {c: 9, r: 1}, {c: 10, r: 1}, {c: 11, r: 1}, {c: 12, r: 1}, {c: 12, r: 2}, {c: 12, r: 3}, {c: 12, r: 4}, {c: 12, r: 5}, {c: 12, r: 6}, {c: 11, r: 6}, {c: 10, r: 6}, {c: 9, r: 6}, {c: 8, r: 6}, {c: 7, r: 6}, {c: 7, r: 5}, {c: 7, r: 4}, {c: 7, r: 3}, {c: 7, r: 2}, {c: 8, r: 2}, {c: 9, r: 2}, {c: 10, r: 2}, {c: 11, r: 2}, {c: 11, r: 3}, {c: 10, r: 3}, {c: 9, r: 3}, {c: 8, r: 3}, {c: 8, r: 4}, {c: 9, r: 4}, {c: 10, r: 4}, {c: 11, r: 4}, {c: 11, r: 5}, {c: 10, r: 5}, {c: 9, r: 5}, {c: 8, r: 5}, {c: 18, r: 9}, {c: 19, r: 9}, {c: 19, r: 8}, {c: 19, r: 7}, {c: 18, r: 7}, {c: 18, r: 8}, {c: 16, r: 9}, {c: 16, r: 8}, {c: 16, r: 7}, {c: 15, r: 7}, {c: 14, r: 7}, {c: 14, r: 8}, {c: 15, r: 8}, {c: 15, r: 9}, {c: 14, r: 9}, {c: 13, r: 9}, {c: 13, r: 8}, {c: 13, r: 7}, {c: 12, r: 7}, {c: 12, r: 8}, {c: 12, r: 9}, {c: 2, r: 9}, {c: 3, r: 7}, {c: 4, r: 7}, {c: 5, r: 7}, {c: 6, r: 7}, {c: 7, r: 7}, {c: 3, r: 9}, {c: 4, r: 9}, {c: 5, r: 9}, {c: 6, r: 9}, {c: 7, r: 9}] }
};