/* monster.js — 怪獣の状態マシンと、口の中(トレイ)へのお金の配置・アニメーション。
   状態: sleep -> input -> eating(吸い込み -> もぐもぐ) -> thanks -> sleep
   タイミングはスタイルガイドの「アニメーション」表に合わせてある。 */
(function (global) {
  'use strict';

  var TRAY_PAD_MM = 1.0;
  var CONTROLS_MAX_VH = 0.56;   // css/base.css の #controls { height: min(..., 56vh) } と合わせること

  var MOUTH_OPEN_MS = 380;      // 口がひらくまで
  var POP_STEP_MS = 40;         // お金が1枚ずつ出る間隔
  var SUCK_MS = 600;            // 吸い込み
  var SUCK_STEP_MS = 20;        // 吸い込みをずらす間隔
  var CHEW_MS = 250;            // もぐもぐ1回
  var CHEW_TIMES = 6;
  var THANKS_MS = 3000;         // お礼を出しておく時間

  var els = {};
  var mode = 'fine';
  var state = 'sleep';
  var amount = 0;
  var pieces = [];
  var timers = [];
  var blinkTimer = null;
  var onFinish = function () {};
  var lastScale = 1;
  var lastTrayH = 0;
  var settleTimer = null;

  function init(opts) {
    els = opts;
    onFinish = opts.onFinish || onFinish;
    setMode(mode);
    setState('sleep');
  }

  /* ---------- 状態 ---------- */

  function setState(s) {
    state = s;
    document.body.dataset.state = s;
    scheduleBlink();
  }
  function getState() { return state; }

  function setMode(m) {
    mode = (m === 'coarse') ? 'coarse' : 'fine';
    document.body.dataset.mode = mode;
    if (els.modeLabel) els.modeLabel.textContent = (mode === 'coarse') ? 'まとめる' : 'こまかい';
    if (state === 'input' || state === 'sleep') render();
  }
  function getMode() { return mode; }

  function toggleMode() {
    setMode(mode === 'fine' ? 'coarse' : 'fine');
    CT.audio.sfx.mode();
    flash('mode-pop', 260);
    if (state === 'sleep') peek();
    return mode;
  }

  // 目のアニメーション用クラスを一瞬だけ付ける
  function flash(cls, ms) {
    var eyes = document.querySelectorAll('.eye');
    for (var i = 0; i < eyes.length; i++) {
      (function (el) {
        el.classList.remove(cls);
        void el.offsetWidth;
        el.classList.add(cls);
        setTimeout(function () { el.classList.remove(cls); }, ms);
      })(eyes[i]);
    }
  }

  // まばたき: INPUT と THANKS のときだけ、4〜7秒おきにランダム
  function scheduleBlink() {
    clearTimeout(blinkTimer);
    if (state !== 'input' && state !== 'thanks') return;
    blinkTimer = setTimeout(function () {
      flash('blink', 160);
      scheduleBlink();
    }, 4000 + Math.random() * 3000);
  }

  // 眠っているときに目をタップしたら、一瞬だけ目を開けてモードを見せる
  function peek() {
    document.body.classList.add('peek');
    clearTimeout(peek._t);
    peek._t = setTimeout(function () { document.body.classList.remove('peek'); }, 1600);
  }

  function setAmount(a) {
    var wasAsleep = (state === 'sleep');
    amount = a;
    if (state === 'eating' || state === 'thanks') return;   // 食事中は入力を反映しない
    var next = a > 0 ? 'input' : 'sleep';
    if (next === 'input' && wasAsleep) CT.audio.sfx.wake();
    setState(next);
    render(wasAsleep && next === 'input');
  }
  function getAmount() { return amount; }

  /* ---------- トレイの描画 ---------- */

  function clearPieces() {
    pieces.length = 0;
    clearTimeout(settleTimer);
    if (els.tray) {
      els.tray.textContent = '';
      els.tray.classList.remove('settled');
    }
  }

  function moneySvg(kind) {
    return '<svg class="money-svg" aria-hidden="true">' +
           '<use href="#m-' + kind + '" width="100%" height="100%"/></svg>';
  }

  /* 口の高さは測らずに計算する。
     #controls には height の transition が付いているので、
     data-keypad を変えた直後に clientHeight を読むと「遷移中の値」が返るため。 */
  function controlsHeight(pxmm) {
    var cs = getComputedStyle(document.documentElement);
    var open = parseFloat(cs.getPropertyValue('--controls-open-mm')) || 107;
    var bar = parseFloat(cs.getPropertyValue('--controls-bar-mm')) || 22;
    var mm = (els.controls.dataset.keypad === 'bar') ? bar : open;
    return Math.min(mm * pxmm, CONTROLS_MAX_VH * global.innerHeight);
  }

  /* 口の上側が使っている高さ(mm)。
     目の行の高さは ねているときだけ変わる（しかも transition 中は測れない）ので、
     こちらも実測せず css/base.css の変数から計算する。
     ★base.css の --eyes-mm / --gap-mm / --lip-mm と、歯の高さ 7.6mm を変えたら
       ここも合わせること。 */
  var TEETH_MM = 7.6;

  function chromeHeight(pxmm) {
    var cs = getComputedStyle(document.documentElement);
    var eyes = parseFloat(cs.getPropertyValue('--eyes-mm')) || 30;
    var gap = parseFloat(cs.getPropertyValue('--gap-mm')) || 2;
    var lip = parseFloat(cs.getPropertyValue('--lip-mm')) || 1.5;
    return (eyes + gap + lip * 2 + TEETH_MM) * pxmm;
  }

  function fit(p, pxmm) {
    var pad = TRAY_PAD_MM * pxmm * 2;
    var stageH = els.stage.clientHeight;
    var trayH = stageH - controlsHeight(pxmm) - chromeHeight(pxmm);
    var availW = els.tray.clientWidth - pad;

    return {
      trayH: trayH,
      scale: Math.min(1, availW / (p.w * pxmm), (trayH - pad) / (p.h * pxmm))
    };
  }

  function render(mouthWasClosed) {
    clearPieces();
    if (!els.tray || amount <= 0) return;

    var pxmm = CT.calibrate.pxPerMm();
    var availWmm = els.tray.clientWidth / pxmm - TRAY_PAD_MM * 2;
    var bd = CT.money.breakdown(amount, mode);
    var p = CT.layout.plan(bd, availWmm);
    if (!p.items.length) return;

    var f = fit(p, pxmm);
    lastScale = f.scale;
    lastTrayH = f.trayH;
    var unit = pxmm * f.scale;

    var ox = (els.tray.clientWidth - p.w * unit) / 2;
    var oy = (f.trayH - p.h * unit) / 2;
    // 口がひらききってから1枚ずつ出す
    var base = mouthWasClosed ? MOUTH_OPEN_MS : 40;

    var frag = document.createDocumentFragment();
    for (var i = 0; i < p.items.length; i++) {
      var it = p.items[i];
      var el = document.createElement('div');
      /* money--in は作った時点で付ける。
         requestAnimationFrame は画面が隠れている間は呼ばれないので、
         それ待ちにするとお金が出てこないことがある。
         ずらして出すのは animation-delay が担当。 */
      el.className = 'money money--in money--' + it.kind;
      var x = ox + it.x * unit, y = oy + it.y * unit;
      var w = it.w * unit, h = it.h * unit;
      el.style.left = x + 'px';
      el.style.top = y + 'px';
      el.style.width = w + 'px';
      el.style.height = h + 'px';
      el.style.zIndex = String(10 + i);
      el.style.animationDelay = (base + i * POP_STEP_MS) + 'ms';
      el.innerHTML = moneySvg(it.kind);
      el.__c = { x: x + w / 2, y: y + h / 2 };
      pieces.push(el);
      frag.appendChild(el);
    }
    els.tray.appendChild(frag);

    /* 出終わるころにアニメーションを外して確定させる（上記 .settled の保険）。
       setTimeout は画面が隠れていても（間引かれつつ）動くので、
       アニメーションが凍ってもお金は必ず見える状態になる。 */
    clearTimeout(settleTimer);
    settleTimer = setTimeout(function () {
      if (els.tray) els.tray.classList.add('settled');
    }, base + p.items.length * POP_STEP_MS + 400);
  }

  /* 画面回転・テンキーの開閉で並べ直す */
  function relayout() { if (state === 'input') render(false); }

  /* ---------- 食べる ---------- */

  function clearTimers() {
    for (var i = 0; i < timers.length; i++) clearTimeout(timers[i]);
    timers.length = 0;
  }
  function later(fn, ms) { timers.push(setTimeout(fn, ms)); }

  function eat() {
    if (state !== 'input' || !pieces.length) return false;
    clearTimers();
    setState('eating');
    CT.keypad.setKeypad('bar');
    CT.audio.sfx.fanfare();
    CT.audio.say('waai');

    var n = pieces.length;
    var cx = els.tray.clientWidth / 2;
    var cy = (lastTrayH || els.tray.clientHeight) * 0.5;

    pieces.forEach(function (el, i) {
      later(function () {
        CT.audio.sfx.suck(i % 6);
        var dx = cx - el.__c.x, dy = cy - el.__c.y;
        // 出てくるアニメーションを外し、今の見た目を保ったまま吸い込みへ移る
        el.classList.remove('money--in');
        el.style.transform = 'none';
        el.style.opacity = '1';
        el.classList.add('money--eaten');
        void el.offsetWidth;
        el.style.transform = 'translate(' + dx + 'px,' + dy + 'px) scale(0) rotate(180deg)';
        el.style.opacity = '0';
      }, 160 + i * SUCK_STEP_MS);
    });

    later(chew, 160 + n * SUCK_STEP_MS + SUCK_MS);
    return true;
  }

  function chew() {
    clearPieces();
    document.body.dataset.chew = '1';
    for (var i = 0; i < CHEW_TIMES; i++) {
      (function (i) { later(function () { CT.audio.sfx.chew(i); }, i * CHEW_MS); })(i);
    }
    later(thanks, CHEW_TIMES * CHEW_MS + 120);
  }

  function thanks() {
    delete document.body.dataset.chew;
    setState('thanks');
    CT.audio.sfx.open();
    later(function () { CT.audio.say('arigatou'); }, 360);
    later(function () {
      amount = 0;
      setState('sleep');
      onFinish();
    }, THANKS_MS);
  }

  global.CT = global.CT || {};
  global.CT.monster = {
    init: init, setAmount: setAmount, getAmount: getAmount,
    setMode: setMode, getMode: getMode, toggleMode: toggleMode, peek: peek,
    getState: getState, render: render, relayout: relayout, eat: eat,
    lastScale: function () { return lastScale; },
    lastTrayH: function () { return lastTrayH; }
  };
})(this);
