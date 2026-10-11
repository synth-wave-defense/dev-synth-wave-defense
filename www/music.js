// Synth Wave Defense -- music.js  v2.5 (1.36.15)
// [MUS100] Background Music Engine Module: Manages buffer-based music tracks, category transitions, Web Audio graph routing, and ducking/filtering.

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

  let activeTrack = null;  // { path, category, cfg, sourceNode, gainNode, startTime }
  let category = null;     // category currently requested
  let pending = null;      // category queued until the first user gesture
  let unlocked = false;
  let playlist = [];       // remaining shuffled tracks for a looping category

  // [MUS103] Buffer Caching & Preloading Pipeline
  const bufferCache = Object.create(null);
  const loadingPromises = Object.create(null);

  function loadTrackBuffer(url) {
    if (bufferCache[url]) return Promise.resolve(bufferCache[url]);
    if (loadingPromises[url]) return loadingPromises[url];

    const ctx = ensureAudioCtx();
    if (!ctx) return Promise.reject(new Error('No AudioContext available'));

    loadingPromises[url] = fetch(url)
      .then(res => {
        if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + url);
        return res.arrayBuffer();
      })
      .then(arrayBuffer => {
        return new Promise((resolve, reject) => {
          ctx.decodeAudioData(arrayBuffer, resolve, reject);
        });
      })
      .then(audioBuffer => {
        bufferCache[url] = audioBuffer;
        delete loadingPromises[url];
        return audioBuffer;
      })
      .catch(err => {
        delete loadingPromises[url];
        throw err;
      });

    return loadingPromises[url];
  }

  function preloadTracks() {
    Object.keys(TRACKS).forEach(cat => {
      (TRACKS[cat] || []).forEach(path => {
        if (!bufferCache[path] && !loadingPromises[path]) {
          loadTrackBuffer(path).catch(() => {});
        }
      });
    });
  }

  // [MUS104] Web Audio Graph Singleton Setup
  let audioCtx = null;
  let filterNode = null;

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

  // [MUS104.01] Audio Output Graph Configuration
  function setupAudioGraph() {
    const ctx = ensureAudioCtx();
    if (!ctx) return null;

    if (!filterNode) {
      try {
        filterNode = ctx.createBiquadFilter();
        filterNode.type = 'lowpass';
        filterNode.frequency.setValueAtTime(ducked ? DUCK_FILTER_FREQ : NORMAL_FILTER_FREQ, ctx.currentTime);

        const targetNode = (typeof SFX !== 'undefined' && SFX && typeof SFX._analyser === 'function' && SFX._analyser())
          ? SFX._analyser()
          : ctx.destination;

        filterNode.connect(targetNode);
      } catch (e) {
        console.warn('[music] Web Audio graph setup error:', e);
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

  function fadeOutAndStop(track, duration) {
    if (!track || !track.gainNode || !track.sourceNode) return;
    const ctx = ensureAudioCtx();
    const dur = Math.max(0.02, duration != null ? duration : 0.5);
    const now = ctx ? ctx.currentTime : 0;

    try {
      track.sourceNode.onended = null; // prevents advancing when stopped manually
      const currentVal = track.gainNode.gain.value;
      track.gainNode.gain.cancelScheduledValues(now);
      track.gainNode.gain.setValueAtTime(currentVal, now);
      track.gainNode.gain.linearRampToValueAtTime(0.0001, now + dur);
    } catch (e) {
      try { track.gainNode.gain.value = 0.0001; } catch (err) {}
    }

    const src = track.sourceNode;
    const gNode = track.gainNode;
    setTimeout(() => {
      try { src.stop(); } catch (e) {}
      try { src.disconnect(); } catch (e) {}
      try { gNode.disconnect(); } catch (e) {}
    }, (dur + 0.05) * 1000);
  }

  function fadeActiveTrackTo(targetVol, duration) {
    if (!activeTrack || !activeTrack.gainNode) return;
    const ctx = ensureAudioCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const dur = Math.max(0.01, duration || 0.1);
    const val = Math.max(0.0001, Math.min(1.0, targetVol));

    try {
      const currentVal = activeTrack.gainNode.gain.value;
      activeTrack.gainNode.gain.cancelScheduledValues(now);
      activeTrack.gainNode.gain.setValueAtTime(currentVal, now);
      activeTrack.gainNode.gain.linearRampToValueAtTime(val, now + dur);
    } catch (e) {
      try { activeTrack.gainNode.gain.value = val; } catch (err) {}
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

    if (activeTrack && activeTrack.cfg) {
      fadeActiveTrackTo(levelFor(activeTrack.cfg), duration);
    }
  }

  function startTrack(path, cat, cfg) {
    const ctx = setupAudioGraph();
    if (!ctx) return;

    loadTrackBuffer(path).then(audioBuffer => {
      if (category !== cat || !enabled) return;

      const now = ctx.currentTime;
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;

      const catList = TRACKS[cat] || [];
      const isSingleTrackLoop = cfg && cfg.loop && catList.length === 1;

      if (isSingleTrackLoop) {
        source.loop = true;
      } else {
        source.loop = false;
        source.onended = function () {
          if (activeTrack && activeTrack.sourceNode === source) {
            advance(cat, cfg);
          }
        };
      }

      const trackGain = ctx.createGain();
      const targetVol = levelFor(cfg);
      const fadeInDur = Math.max(0.02, cfg ? (cfg.fadeIn || 0.4) : 0.4);

      trackGain.gain.setValueAtTime(0.0001, now);
      source.connect(trackGain);
      trackGain.connect(filterNode);

      source.start(now);
      trackGain.gain.linearRampToValueAtTime(Math.max(0.0001, targetVol), now + fadeInDur);

      activeTrack = {
        path: path,
        category: cat,
        cfg: cfg,
        sourceNode: source,
        gainNode: trackGain,
        startTime: now
      };
    }).catch(err => {
      console.warn('[music] Failed to play track buffer:', path, err);
      if (category === cat && cfg && cfg.loop && playlist.length) {
        advance(cat, cfg);
      }
    });
  }

  function advance(cat, cfg) {
    if (!playlist.length) playlist = shuffle(TRACKS[cat] || []);
    const next = playlist.shift();
    if (!next) { activeTrack = null; return; }
    startTrack(next, cat, cfg);
  }

  function stopCurrent(fadeOut) {
    if (activeTrack) {
      fadeOutAndStop(activeTrack, fadeOut != null ? fadeOut : 0.6);
      activeTrack = null;
    }
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

    if (category === cat && activeTrack) {
      fadeActiveTrackTo(levelFor(cfg), cfg.fadeIn || 0.4);
      return;
    }

    startCategoryFresh(cat, cfg, list);
  }

  function startCategoryFresh(cat, cfg, list) {
    category = cat;

    if (!enabled) return;
    if (!unlocked) { pending = cat; return; }

    const prev = activeTrack;
    activeTrack = null;
    if (prev) fadeOutAndStop(prev, cfg.fadeOut != null ? cfg.fadeOut : 0.5);

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
      if (!activeTrack || !activeTrack.path) return 'None';
      try {
        const parts = activeTrack.path.split('/');
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
        category = null;      // force playCategory to restart
        playCategory(want);
      }
    },

    isEnabled: function () { return enabled; },

    setVolume: function (v) {
      volume = Math.max(0, Math.min(1, v));
      if (activeTrack && activeTrack.cfg) {
        fadeActiveTrackTo(levelFor(activeTrack.cfg), 0.15);
      }
    },

    // Unlock playback after initial user gesture
    unlock: function () {
      ensureAudioCtx();
      setupAudioGraph();
      if (!unlocked) {
        unlocked = true;
        preloadTracks();
      }
      const want = pending || category;
      if (want && enabled) {
        pending = null;
        if (!activeTrack) {
          category = null;
          playCategory(want);
        }
      }
    },

    suspend: function () {
      if (audioCtx && audioCtx.state === 'running') {
        try { audioCtx.suspend(); } catch (e) {}
      }
    },
    resume: function () {
      ensureAudioCtx();
      if (audioCtx && audioCtx.state === 'suspended') {
        try { audioCtx.resume(); } catch (e) {}
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
        requestedCategory: category,
        pendingCategory: pending,
        trackCounts: counts,
        playing: null
      };

      if (activeTrack) {
        const pos = audioCtx ? Math.round((audioCtx.currentTime - activeTrack.startTime) * 10) / 10 : 0;
        const dur = (activeTrack.sourceNode && activeTrack.sourceNode.buffer) ? activeTrack.sourceNode.buffer.duration : 0;
        report.playing = {
          category: activeTrack.category,
          path: activeTrack.path,
          volume: activeTrack.gainNode ? Math.round(activeTrack.gainNode.gain.value * 100) / 100 : null,
          position: pos,
          duration: dur
        };
      }

      const why = [];
      if (!enabled) why.push('music is switched off in Settings');
      if (!unlocked) why.push('no user gesture yet -- tap the screen once');
      if (!category) why.push('no category has been requested');
      if (category && !counts[category]) why.push('TRACKS.' + category + ' is empty');
      if (!why.length && activeTrack) why.push('nothing looks wrong -- pure Web Audio buffer playing');
      report.why = why;

      try { console.log('[music] diagnose', report); } catch (e) { }
      return report;
    }
  };
})();
