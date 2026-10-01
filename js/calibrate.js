/* calibrate.js — 画面の「1mm が何px か」を決める。
   CSSの mm 単位は 96dpi 前提の名目値で、iPadの実寸とは一致しない
   （iPadは実測 約5.2 CSSpx/mm、CSS規定は 3.78）。
   そのため既知のiPad解像度から推定し、最後は本物の500円玉で較正する。 */
(function (global) {
  'use strict';

  var KEY = 'ct.pxPerMm';
  var CAL_COIN = 'coin500';   // 較正に使う硬貨
  var CAL_COIN_MM = 26.5;

  /* 画面のCSSピクセル解像度 → 画面対角のインチ数。
     iPadはどの機種もおよそ 5.2 px/mm に落ち着くが、miniだけ大きく違う。 */
  var DIAGONAL_INCH = {
    '768x1024': 9.7,
    '810x1080': 10.2,
    '820x1180': 10.9,
    '834x1112': 10.5,
    '834x1194': 11.0,
    '744x1133': 8.3,
    '1024x1366': 12.9,
    '1032x1376': 13.0
  };

  function guess() {
    var w = Math.min(screen.width, screen.height);
    var h = Math.max(screen.width, screen.height);
    var inch = DIAGONAL_INCH[w + 'x' + h];
    if (inch) return Math.sqrt(w * w + h * h) / (inch * 25.4);
    // 未知のタッチ端末はiPad相当、それ以外はCSS既定(96dpi)
    var touch = (navigator.maxTouchPoints || 0) > 0;
    return touch ? 5.2 : 96 / 25.4;
  }

  function read() {
    try {
      var v = parseFloat(localStorage.getItem(KEY));
      if (isFinite(v) && v >= 2 && v <= 12) return v;
    } catch (e) { /* プライベートブラウズ等。無視して推定値を使う */ }
    return guess();
  }

  var current = read();

  function pxPerMm() { return current; }

  function set(v) {
    current = Math.max(2, Math.min(12, v));
    try { localStorage.setItem(KEY, String(current)); } catch (e) {}
    apply();
    return current;
  }

  function reset() {
    try { localStorage.removeItem(KEY); } catch (e) {}
    current = guess();
    apply();
    return current;
  }

  function isCalibrated() {
    try { return localStorage.getItem(KEY) != null; } catch (e) { return false; }
  }

  // CSSからも使えるように --px-per-mm / --mm を公開する
  function apply() {
    var s = document.documentElement.style;
    s.setProperty('--px-per-mm', String(current));
    s.setProperty('--mm', current + 'px');
  }

  global.CT = global.CT || {};
  global.CT.calibrate = {
    CAL_COIN: CAL_COIN, CAL_COIN_MM: CAL_COIN_MM,
    pxPerMm: pxPerMm, set: set, reset: reset, guess: guess,
    isCalibrated: isCalibrated, apply: apply
  };
})(this);
