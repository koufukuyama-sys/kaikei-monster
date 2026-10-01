/* calibrate.js — 画面の2つの「単位」を決める。

   --mm … 実寸の1mmが何pxか。**お金の絵だけ**に使う。
           CSSの mm 単位は 96dpi 前提の名目値でiPadの実寸と一致しないので、
           既知の解像度から推定し、最後は本物の500円玉で較正する。

   --u  … UIの寸法の単位（目・口・テンキー・文字など）。
           こちらを実寸mmにすると、画面が小さい端末（iPhoneは幅65mmほど）で
           目やボタンが画面からはみ出す。そこで「画面幅をiPad縦の158mm相当、
           画面高さを227mm相当とみなす」比率で、画面サイズに追従させる。
           iPad縦ではちょうど --u ≒ --mm になり、デザインどおりの見え方になる。 */
(function (global) {
  'use strict';

  var KEY = 'ct.pxPerMm';

  /* UI単位の基準。スタイルガイドの iPad 10.9インチ縦（158 x 227mm）。 */
  var UI_BASE_W_MM = 158;
  var UI_BASE_H_MM = 227;
  var CAL_COIN = 'coin500';   // 較正に使う硬貨
  var CAL_COIN_MM = 26.5;

  /* 画面のCSSピクセル解像度 → 画面対角のインチ数。
     iPadはどの機種もおよそ 5.2 px/mm に落ち着くが、miniだけ大きく違う。 */
  var DIAGONAL_INCH = {
    // iPad
    '768x1024': 9.7,
    '810x1080': 10.2,
    '820x1180': 10.9,
    '834x1112': 10.5,
    '834x1194': 11.0,
    '744x1133': 8.3,
    '1024x1366': 12.9,
    '1032x1376': 13.0,
    // iPhone（実寸で遊ぶ端末ではないが、推定値が近いほうが縮尺が自然になる）
    '320x568': 4.0,
    '375x667': 4.7,
    '375x812': 5.8,
    '390x844': 6.1,
    '393x852': 6.1,
    '402x874': 6.3,
    '414x896': 6.1,
    '428x926': 6.7,
    '430x932': 6.7,
    '440x956': 6.9
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

  /* UI単位。画面の短いほうに合わせるので、横向きでも破綻しない。 */
  function uiUnit() {
    return Math.min(
      (global.innerWidth || UI_BASE_W_MM) / UI_BASE_W_MM,
      (global.innerHeight || UI_BASE_H_MM) / UI_BASE_H_MM
    );
  }

  // CSSからも使えるように --px-per-mm / --mm / --u を公開する
  function apply() {
    var s = document.documentElement.style;
    s.setProperty('--px-per-mm', String(current));
    s.setProperty('--mm', current + 'px');
    s.setProperty('--u', uiUnit() + 'px');
  }

  global.CT = global.CT || {};
  global.CT.calibrate = {
    CAL_COIN: CAL_COIN, CAL_COIN_MM: CAL_COIN_MM,
    pxPerMm: pxPerMm, uiUnit: uiUnit, set: set, reset: reset, guess: guess,
    isCalibrated: isCalibrated, apply: apply
  };
})(this);
