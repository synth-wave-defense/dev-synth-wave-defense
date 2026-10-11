// Synth Wave Defense -- music.js  v2.5 (1.36.14)
// [MUS100] Background Music Engine Module: Manages streaming music tracks, category transitions, Web Audio graph routing, and ducking/filtering.

const MusicManager = (function () {
  'use strict';

  // [MUS101] Track Playlist Registry (mapped by game screen state)
  const TRACKS = {
    menu: [
      'music/menu_01.ogg',
      'music/menu_02.ogg'
    ],
    battle: [
      'music/battle_01.ogg',
      'music/battle_02.ogg',
      'music/battle_03.ogg',
      'music/battle_04.ogg',
      'music/battle_05.ogg',
      'music/battle_06.ogg',
      'music/battle_07.ogg',
      'music/battle_08.ogg',
      'music/battle_09.ogg',
    ],
    win: [
      'music/win.ogg'
    ],
    lose: [
      'music/lose.ogg'
    ]
  };

  // [MUS101.01] Music Category Behaviors (volume, looping, and fade durations)
  const CATEGORY = {
    menu:   { loop: true,  volume: 0.45, fadeIn: 1.2,  fadeOut: 0.8 },
    battle: { loop: true,  volume: 0.38, fadeIn: 0.9,  fadeOut: 0.6 },
    win:    { loop: true,  volume: 0.60, fadeIn: 0.05, fadeOut: 0.4 },
    lose:   { loop: true,  volume: 0.55, fadeIn: 0.05, fadeOut: 0.4 }
  };

  // [MUS102] Music Engine State Variables
  let enabled = true;
  let volume = 1;          // player's master music trim, 0..1
  let ducked = false;      // menu/pause ducking state for in-battle music
  const DUCK_FACTOR = 0.80;
  const DUCK_FILTER_FREQ = 800;     // Hz low-pass cutoff when paused/ducked
  const NORMAL_FILTER_FREQ = 20000; // Hz low-pass cutoff during normal playback

  let current = null;      // { el, category, cfg }
  let category = null;     // category currently requested
  let pending = null;      // category queued until the first user gesture
  let unlocked = false;
  let playlist = [];       // remaining shuffled tracks for a looping category

  if (typeof window._audioStallEvents === 'undefined') window._audioStallEvents = 0;

  // [MUS102.01] Attach stall/waiting/suspend listeners for music thread diagnostics
  function attachStallListeners(el) {
    if (!el || el._stallListenersAttached) return;
    el._stallListenersAttached = true;
    ['stalled', 'waiting', 'suspend'].forEach(evt => {
      el.addEventListener(evt, () => {
        window._audioStallEvents = (window._audioStallEvents || 0) + 1;
      });
    });
  }

  // [MUS103] Asset Preloading Pipeline
  const preloadedAudio = Object.create(null);
  function preloadTracks() {
    Object.keys(TRACKS).forEach(cat => {
      (TRACKS[cat] || []).forEach(path => {
        if (!preloadedAudio[path]) {
          try {
            const a = new Audio();
            a.crossOrigin = "anonymous";
            attachStallListeners(a);
            a.src = path;
            a.preload = 'auto';
            preloadedAudio[path] = a;
          } catch (e) {}
        }
      });
    });
  }
  try { preloadTracks(); } catch (e) {}

  // [MUS104] Persistent Audio Element & Web Audio Graph Initialization
  let audioCtx = null;
  let filterNode = null;

  function getAudioElement() {
    if (!window._musicAudioElement) {
      const el = new Audio();
      el.crossOrigin = "anonymous";
      try { el.volume = 1.0; } catch (e) {}
      attachStallListeners(el);
      window._musicAudioElement = el;
    }
    return window._musicAudioElement;
  }

  function ensureAudioCtx() {
    if (typeof SFX !== 'undefined' && SFX && typeof SFX._ctx === 'function') {
      const sfxCtx = SFX._ctx();
      if (sfxCtx) {
        audioCtx = sfxCtx;
        if (audioCtx.state === 'suspended') {
          try { audioCtx.resume(); } catch (e) {}
        }
      }
    }
    if (!audioCtx) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) audioCtx = new AC();
      } catch (e) {
        audioCtx = null;
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      try { audioCtx.resume(); } catch (e) {}
    }
    return audioCtx;
  }

  // [MUS104.01] Web Audio Graph Singleton Setup
  function setupAudioGraph() {
    const ctx = ensureAudioCtx();
    if (!ctx) return null;

    const el = getAudioElement();
    el.crossOrigin = "anonymous";
    try { el.volume = 1.0; } catch (e) {}

    if (!window._musicSourceNode) {
      try {
        window._musicSourceNode = ctx.createMediaElementSource(el);
        window._musicGainNode = ctx.createGain();

        if (!filterNode) {
          filterNode = ctx.createBiquadFilter();
          filterNode.type = 'lowpass';
          filterNode.frequency.setValueAtTime(ducked ? DUCK_FILTER_FREQ : NORMAL_FILTER_FREQ, ctx.currentTime);
        }

        // Route: HTML Audio -> Source -> Gain Node -> Filter Node -> Analyser/Destination
        window._musicSourceNode.connect(window._musicGainNode);
        window._musicGainNode.connect(filterNode);

        const targetNode = (typeof SFX !== 'undefined' && SFX && typeof SFX._analyser === 'function' && SFX._analyser())
          ? SFX._analyser()
          : ctx.destination;

        filterNode.connect(targetNode);
      } catch (e) {
        console.warn('[music] Web Audio graph routing error:', e);
      }
    }
    return ctx;
  }

  function shuffle(list) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // [MUS105] Volume Fading & Dynamic Automation
  function levelFor(cfg) {
    if (!cfg) return volume * (ducked ? DUCK_FACTOR : 1.0);
    return cfg.volume * volume * (ducked ? DUCK_FACTOR : 1.0);
  }

  function fadeToTarget(to, dur, stopAtEnd) {
    const ctx = ensureAudioCtx();
    setupAudioGraph();

    const targetVol = Math.max(0, Math.min(1, to));
    const duration = Math.max(0.01, dur || 0.05);

    if (window._musicGainNode && ctx) {
      try {
        const now = ctx.currentTime;
        const currentVal = window._musicGainNode.gain.value;
        window._musicGainNode.gain.cancelScheduledValues(now);
        window._musicGainNode.gain.setValueAtTime(currentVal, now);
        window._musicGainNode.gain.linearRampToValueAtTime(targetVol, now + duration);
      } catch (e) {
        try { window._musicGainNode.gain.value = targetVol; } catch (err) {}
      }
    }

    if (stopAtEnd) {
      setTimeout(() => {
        if (window._musicAudioElement && targetVol === 0) {
          try { window._musicAudioElement.pause(); } catch (e) {}
        }
      }, (duration + 0.05) * 1000);
    }
  }

  // [MUS106] Playback Execution & Playlist Management
  function setDucked(on, dur) {
    ducked = !!on;
    const duration = dur != null ? dur : 0.08;
    const targetFreq = ducked ? DUCK_FILTER_FREQ : NORMAL_FILTER_FREQ;

    ensureAudioCtx();
    setupAudioGraph();

    if (filterNode && audioCtx) {
      try {
        const now = audioCtx.currentTime;
        filterNode.frequency.cancelScheduledValues(now);
        filterNode.frequency.setTargetAtTime(Math.max(10, targetFreq), now, Math.max(0.01, duration / 3));
      } catch (e) {
        try { filterNode.frequency.value = targetFreq; } catch (err) {}
      }
    }

    if (current && current.cfg) fadeToTarget(levelFor(current.cfg), duration);
  }

  function startTrack(path, cat, cfg) {
    const el = getAudioElement();
    setupAudioGraph();

    el.crossOrigin = "anonymous";
    try { el.volume = 1.0; } catch (e) {}

    if (!el.src || !el.src.endsWith(path)) {
      el.src = path;
    }
    el.loop = false;
    el.preload = 'auto';

    if (!el._musicEventsAttached) {
      el._musicEventsAttached = true;

      el.addEventListener('ended', function () {
        if (!current) return;
        const cCat = current.category;
        const cCfg = current.cfg;
        if (cCfg && cCfg.loop) {
          const catList = TRACKS[cCat] || [];
          if (catList.length === 1) {
            try {
              el.currentTime = 0;
              const p = el.play();
              if (p && typeof p.catch === 'function') p.catch(function () {});
              fadeToTarget(levelFor(cCfg), 0.1);
            } catch (e) {
              advance(cCat, cCfg);
            }
          } else {
            advance(cCat, cCfg);
          }
        } else {
          current = null;
        }
      });

      el.addEventListener('error', function () {
        if (!current) return;
        const cCat = current.category;
        const cCfg = current.cfg;
        current = null;
        if (playlist.length && cCfg && cCfg.loop) advance(cCat, cCfg);
      });
    }

    current = { el: el, category: cat, cfg: cfg };

    const p = (function () { try { return el.play(); } catch (e) { return null; } })();
    if (p && typeof p.catch === 'function') {
      p.catch(function (err) {
        if (!unlocked || (err && err.name === 'NotAllowedError')) {
          pending = cat;
        }
      });
    }

    fadeToTarget(levelFor(cfg), cfg.fadeIn || 0.4);
    return el;
  }

  function advance(cat, cfg) {
    if (!playlist.length) playlist = shuffle(TRACKS[cat] || []);
    const next = playlist.shift();
    if (!next) { current = null; return; }
    const el = startTrack(next, cat, cfg);
    current = el ? { el: el, category: cat, cfg: cfg } : null;
  }

  function stopCurrent(fadeOut) {
    if (!current) return;
    fadeToTarget(0, fadeOut == null ? 0.6 : fadeOut, true);
    current = null;
  }

  // [MUS106.02] Category Playback Switcher
  function playCategory(cat) {
    const cfg = CATEGORY[cat];
    if (!cfg) return;

    const list = TRACKS[cat] || [];
    if (!list.length) {
      if (cfg.loop) { category = cat; stopCurrent(cfg.fadeOut); }
      return;
    }

    if (ducked) {
      setDucked(false, 0.08);
    }

    if (category === cat && current && current.el) {
      if (current.el.paused) {
        const p = (function () { try { return current.el.play(); } catch (e) { return null; } })();
        if (p && typeof p.catch === 'function') {
          p.catch(function () {
            startCategoryFresh(cat, cfg, list);
          });
        }
      }
      fadeToTarget(levelFor(cfg), cfg.fadeIn || 0.4);
      return;
    }

    startCategoryFresh(cat, cfg, list);
  }

  function startCategoryFresh(cat, cfg, list) {
    category = cat;

    if (!enabled) return;
    if (!unlocked) { pending = cat; return; }

    const prev = current;
    current = null;
    if (prev) fadeToTarget(0, cfg.fadeIn * 0.8, false);

    playlist = shuffle(list);
    advance(cat, cfg);
  }

  // [MUS107] Public Interface & Lifecycle Control
  return {
    menu: function () { playCategory('menu'); },
    battle: function () { playCategory('battle'); },
    win: function () { playCategory('win'); },
    lose: function () { playCategory('lose'); },

    play: playCategory,
    current: function () { return category; },
    currentTrack: function () {
      if (!current || !current.el || !current.el.src) return 'None';
      try {
        const src = current.el.src;
        const parts = src.split('/');
        return parts[parts.length - 1] || 'None';
      } catch (e) {
        return 'None';
      }
    },
    setDucked: function (on, dur) { setDucked(on, dur); },

    stop: function (fadeOut) {
      category = null;
      pending = null;
      stopCurrent(fadeOut);
    },

    setEnabled: function (on) {
      const next = !!on;
      if (enabled === next) return;
      enabled = next;
      if (!enabled) {
        pending = category;
        stopCurrent(0.35);
      } else if (category) {
        const want = category;
        category = null;      // force playCategory to actually restart
        playCategory(want);
      }
    },

    isEnabled: function () { return enabled; },

    setVolume: function (v) {
      volume = Math.max(0, Math.min(1, v));
      if (current && current.cfg) {
        fadeToTarget(levelFor(current.cfg), 0.15);
      } else {
        fadeToTarget(levelFor(null), 0.15);
      }
    },

    // Unlock playback after initial user gesture
    unlock: function () {
      ensureAudioCtx();
      setupAudioGraph();
      if (!unlocked) {
        unlocked = true;
      }
      const want = pending || category;
      if (want && enabled) {
        pending = null;
        if (!current || !window._musicAudioElement || window._musicAudioElement.paused) {
          category = null;
          playCategory(want);
        }
      }
    },

    suspend: function () {
      if (audioCtx && audioCtx.state === 'running') {
        try { audioCtx.suspend(); } catch (e) {}
      }
      if (window._musicAudioElement) {
        try { window._musicAudioElement.pause(); } catch (e) {}
      }
    },
    resume: function () {
      ensureAudioCtx();
      if (audioCtx && audioCtx.state === 'suspended') {
        try { audioCtx.resume(); } catch (e) {}
      }
      if (current && enabled && window._musicAudioElement) {
        if (window._musicAudioElement.paused) {
          const p = (function () { try { return window._musicAudioElement.play(); } catch (e) { return null; } })();
          if (p && typeof p.catch === 'function') p.catch(function () {});
        }
      }
    },

    _tracks: function () { return TRACKS; },
    _categories: function () { return CATEGORY; },

    // [MUS107.01] Diagnostic Inspector Function
    diagnose: function () {
      const counts = {};
      Object.keys(TRACKS).forEach(function (k) { counts[k] = (TRACKS[k] || []).length; });

      const report = {
        enabled: enabled,
        unlocked: unlocked,
        ducked: ducked,
        audioCtxState: audioCtx ? audioCtx.state : 'null',
        filterFreq: filterNode ? Math.round(filterNode.frequency.value) : null,
        webAudioGain: window._musicGainNode ? Math.round(window._musicGainNode.gain.value * 100) / 100 : null,
        requestedCategory: category,
        pendingCategory: pending,
        trackCounts: counts,
        playing: null
      };

      if (current && current.el) {
        report.playing = {
          category: current.category,
          src: current.el.src,
          paused: current.el.paused,
          volume: Math.round((window._musicGainNode ? window._musicGainNode.gain.value : 0) * 100) / 100,
          elementVolume: current.el.volume,
          position: Math.round((current.el.currentTime || 0) * 10) / 10,
          duration: current.el.duration,
          readyState: current.el.readyState,
          networkState: current.el.networkState,
          error: current.el.error ? current.el.error.code : null
        };
      }

      const why = [];
      if (!enabled) why.push('music is switched off in Settings');
      if (!unlocked) why.push('no user gesture yet -- tap the screen once');
      if (!category) why.push('no category has been requested');
      if (category && !counts[category]) why.push('TRACKS.' + category + ' is empty');
      if (current && current.el.error) why.push('the current file failed to load -- check the path and its exact capitalisation');
      if (current && current.el.paused) why.push('the element is paused');
      if (!why.length && current) why.push('nothing looks wrong -- if you still hear nothing, check device volume and the master trim');
      report.why = why;

      try { console.log('[music] diagnose', report); } catch (e) { }
      return report;
    }
  };
})();
