/* audio.js — 効果音はWebAudioで合成（音声ファイル不要）、
   声だけ Mac の `say -v Kyoko` で作った m4a を再生する。
   iOSは最初のタッチまで音が出ないので unlock() で起こす。 */
(function (global) {
  'use strict';

  var ctx = null;
  var master = null;
  var voices = {};
  var VOICE_RATE = 1.28;   // 少し速く＝高く再生して怪獣っぽくする
  var enabled = true;

  function ensure() {
    if (!ctx) {
      var AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function unlock() {
    ensure();
    // 音声要素もユーザー操作のうちに一度触っておく（iOS対策）
    for (var k in voices) {
      if (!voices[k].__primed) {
        voices[k].__primed = true;
        voices[k].load();
      }
    }
  }

  function tone(opt) {
    if (!enabled) return;
    var c = ensure(); if (!c) return;
    var t0 = c.currentTime + (opt.delay || 0);
    var dur = opt.dur || 0.12;
    var osc = c.createOscillator();
    var g = c.createGain();
    osc.type = opt.type || 'triangle';
    osc.frequency.setValueAtTime(opt.freq, t0);
    if (opt.to) osc.frequency.exponentialRampToValueAtTime(opt.to, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(opt.gain || 0.3, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(master);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  }

  function noise(opt) {
    if (!enabled) return;
    var c = ensure(); if (!c) return;
    var t0 = c.currentTime + (opt.delay || 0);
    var dur = opt.dur || 0.14;
    var len = Math.max(1, Math.floor(c.sampleRate * dur));
    var buf = c.createBuffer(1, len, c.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var src = c.createBufferSource(); src.buffer = buf;
    var filt = c.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.setValueAtTime(opt.cutoff || 900, t0);
    var g = c.createGain();
    g.gain.setValueAtTime(opt.gain || 0.35, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filt); filt.connect(g); g.connect(master);
    src.start(t0); src.stop(t0 + dur + 0.02);
  }

  /* --- 効果音 --- */
  var sfx = {
    key: function (n) {              // テンキー: 数字ごとに少し音程を変える
      tone({ freq: 620 + (n || 0) * 28, dur: 0.07, type: 'square', gain: 0.18 });
    },
    erase: function () { tone({ freq: 480, to: 300, dur: 0.11, type: 'sine', gain: 0.22 }); },
    reject: function () { tone({ freq: 150, dur: 0.16, type: 'square', gain: 0.18 }); },
    wake:  function () { tone({ freq: 520, to: 880, dur: 0.22, type: 'sine', gain: 0.22 }); },
    mode:  function () { tone({ freq: 760, to: 1100, dur: 0.1, type: 'triangle', gain: 0.2 }); },
    suck:  function (i) {            // お金が吸い込まれる
      tone({ freq: 300 + i * 40, to: 1200, dur: 0.16, type: 'sine', gain: 0.14 });
    },
    chew: function (i) {             // もぐもぐ
      noise({ dur: 0.17, cutoff: 520 + (i % 2) * 260, gain: 0.4 });
      tone({ freq: 110 + (i % 2) * 24, dur: 0.14, type: 'sawtooth', gain: 0.1 });
    },
    fanfare: function () {
      [523.25, 659.25, 783.99, 1046.5].forEach(function (f, i) {
        tone({ freq: f, dur: 0.22, type: 'triangle', gain: 0.26, delay: i * 0.1 });
      });
    },
    open: function () { tone({ freq: 400, to: 900, dur: 0.26, type: 'sine', gain: 0.2 }); }
  };

  /* --- 声（assets/voice/*.m4a） --- */
  function registerVoice(name, url) {
    var a = new Audio(url);
    a.preload = 'auto';
    a.playbackRate = VOICE_RATE;
    voices[name] = a;
  }

  function say(name) {
    if (!enabled) return;
    var a = voices[name];
    if (!a) return speak(name);
    try {
      a.currentTime = 0;
      a.playbackRate = VOICE_RATE;
      var p = a.play();
      if (p && p.catch) p.catch(function () { speak(name); });
    } catch (e) { speak(name); }
  }

  // 音声ファイルが無い/鳴らせないときの保険
  var FALLBACK_TEXT = { waai: 'わーい', arigatou: 'おかいけい ありがとう' };
  function speak(name) {
    var text = FALLBACK_TEXT[name];
    if (!text || !global.speechSynthesis) return;
    try {
      var u = new SpeechSynthesisUtterance(text);
      u.lang = 'ja-JP'; u.pitch = 1.6; u.rate = 1.05;
      global.speechSynthesis.speak(u);
    } catch (e) {}
  }

  global.CT = global.CT || {};
  global.CT.audio = {
    unlock: unlock, sfx: sfx, say: say, registerVoice: registerVoice,
    setEnabled: function (v) { enabled = !!v; },
    isEnabled: function () { return enabled; }
  };
})(this);
