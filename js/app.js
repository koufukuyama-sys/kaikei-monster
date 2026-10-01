/* app.js — 全体の結線。DOM取得、イベント、較正画面、画面を消さない設定、Service Worker。 */
(function (global) {
  'use strict';

  function $(id) { return document.getElementById(id); }

  var els = {};

  function boot() {
    els = {
      stage: $('stage'),
      monster: $('monster'),
      tray: $('tray'),
      mouth: $('mouth'),
      modeLabel: $('mode-label'),
      controls: $('controls'),
      keypad: $('keypad'),
      amount: $('amount'),
      amountValue: $('amount-value'),
      ok: $('ok'),
      eyes: $('eyes'),
      hotspot: $('corner-hotspot'),
      cal: $('calibrate'),
      calCoin: $('cal-coin'),
      calSlider: $('cal-slider'),
      calReadout: $('cal-readout'),
      calReset: $('cal-reset'),
      calClose: $('cal-close')
    };

    CT.calibrate.apply();

    CT.audio.registerVoice('waai', 'assets/voice/waai.m4a');
    CT.audio.registerVoice('arigatou', 'assets/voice/arigatou.m4a');

    CT.monster.init({
      stage: els.stage,
      controls: els.controls,
      tray: els.tray,
      modeLabel: els.modeLabel,
      onFinish: function () { CT.keypad.reset(); }
    });

    CT.keypad.init({
      controls: els.controls,
      keypad: els.keypad,
      amount: els.amount,
      amountValue: els.amountValue,
      onChange: function (amount) { CT.monster.setAmount(amount); },
      // テンキーが畳まれる/開くと口の広さが変わるので、お金を並べ直す
      onKeypad: function () { CT.monster.relayout(); }
    });

    // 目をタップ -> こまかい / まとめる の切り替え
    els.eyes.addEventListener('click', function (e) {
      if (!e.target.closest('.eye')) return;
      CT.audio.unlock();
      CT.monster.toggleMode();
    });

    // OK -> 怪獣が食べる
    els.ok.addEventListener('click', function () {
      CT.audio.unlock();
      CT.monster.eat();
    });

    // 最初のタッチで音を起こす（iOSは操作前に音が出せない）
    ['pointerdown', 'touchstart'].forEach(function (ev) {
      document.addEventListener(ev, function once() {
        CT.audio.unlock();
        document.removeEventListener(ev, once);
      }, { passive: true });
    });

    setupCalibration();
    setupViewportGuards();
    keepScreenAwake();
    registerServiceWorker();

    // 画面サイズが変わったら並べ直す
    var t = null;
    global.addEventListener('resize', function () {
      clearTimeout(t);
      t = setTimeout(function () { CT.monster.relayout(); }, 150);
    });
    if (global.visualViewport) {
      global.visualViewport.addEventListener('resize', function () {
        clearTimeout(t);
        t = setTimeout(function () { CT.monster.relayout(); }, 150);
      });
    }
  }

  /* ---------- 実寸の較正（右上を2秒長押しで開く） ---------- */

  function setupCalibration() {
    var timer = null;

    function start() {
      clearTimeout(timer);
      timer = setTimeout(openCal, 2000);
    }
    function cancel() { clearTimeout(timer); }

    els.hotspot.addEventListener('pointerdown', start);
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) {
      els.hotspot.addEventListener(ev, cancel);
    });

    els.calSlider.addEventListener('input', function () {
      CT.calibrate.set(parseFloat(els.calSlider.value));
      drawCalCoin();
    });
    els.calReset.addEventListener('click', function () {
      els.calSlider.value = String(CT.calibrate.reset());
      drawCalCoin();
    });
    els.calClose.addEventListener('click', closeCal);
  }

  function openCal() {
    CT.audio.setEnabled(false);   // 設定中は効果音を鳴らさない
    els.calSlider.value = String(CT.calibrate.pxPerMm());
    drawCalCoin();
    els.cal.hidden = false;
  }

  function closeCal() {
    els.cal.hidden = true;
    CT.audio.setEnabled(true);
    CT.monster.relayout();
  }

  function drawCalCoin() {
    var mm = CT.calibrate.CAL_COIN_MM;
    var px = mm * CT.calibrate.pxPerMm();
    els.calCoin.style.width = px + 'px';
    els.calCoin.style.height = px + 'px';
    els.calReadout.textContent = CT.calibrate.pxPerMm().toFixed(2) + ' px/mm';
  }

  /* ---------- iPadで遊ぶための細工 ---------- */

  function setupViewportGuards() {
    // ダブルタップによる拡大を止める
    var lastTouch = 0;
    document.addEventListener('touchend', function (e) {
      var now = Date.now();
      if (now - lastTouch < 350) e.preventDefault();
      lastTouch = now;
    }, { passive: false });

    // ピンチ拡大を止める
    document.addEventListener('gesturestart', function (e) { e.preventDefault(); });

    // 画面の上下バウンスを止める
    document.addEventListener('touchmove', function (e) {
      if (els.cal && !els.cal.hidden) return;   // 較正画面の中だけはスクロール可
      if (e.touches.length > 1) e.preventDefault();
    }, { passive: false });

    document.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  }

  function keepScreenAwake() {
    if (!navigator.wakeLock) return;
    var lock = null;
    function acquire() {
      navigator.wakeLock.request('screen').then(function (l) { lock = l; }).catch(function () {});
    }
    acquire();
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible' && !lock) acquire();
    });
  }

  /* Service Worker（オフライン起動）は HTTPS のときだけ有効にする。
     ローカル開発（http://localhost, http://192.168.x.x）で有効にすると、
     キャッシュ優先のせいで編集した JS/CSS が反映されず必ずハマるため。
     本番の GitHub Pages は HTTPS なので、iPadでの「ホーム画面に追加」＋
     オフライン起動はそちらで効く。 */
  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;

    if (location.protocol !== 'https:') {
      navigator.serviceWorker.getRegistrations().then(function (rs) {
        rs.forEach(function (r) { r.unregister(); });
      }).catch(function () {});
      if (global.caches && caches.keys) {
        caches.keys().then(function (ks) { ks.forEach(function (k) { caches.delete(k); }); })
          .catch(function () {});
      }
      return;
    }
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(this);
