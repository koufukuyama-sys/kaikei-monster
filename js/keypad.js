/* keypad.js — テンキーの入力モデルと表示、そしてテンキーの開閉。
   1円玉・5円玉があるので1円単位。入力できるのは4桁(0〜2999)。

   スタイルガイドの指定:
     ねているとき … テンキー全面（data-keypad="open"）
     入力中       … 細いバーに畳んで口を画面いっぱいにする（data-keypad="bar"）
     金額欄をタップでテンキーを再展開
   打っている最中に畳むと続きが打てないので、
   最後のキーから COLLAPSE_MS 経ってから畳む。 */
(function (global) {
  'use strict';

  var MAX_VALUE = 2999;     // 千の位は2まで、ほかの位は9まで
  var MAX_DIGITS = 4;
  var COLLAPSE_MS = 1800;   // 打ち終わったとみなすまでの時間

  var digits = '';
  var els = {};
  var onChange = function () {};
  var onKeypad = function () {};
  var collapseTimer = null;

  function value() { return parseInt(digits || '0', 10); }
  function amount() { return value(); }

  function press(d) {
    var next = digits + String(d);
    if (next.length > MAX_DIGITS || parseInt(next, 10) > MAX_VALUE) {
      CT.audio.sfx.reject();
      shake();
      scheduleCollapse();
      return false;
    }
    digits = next;
    CT.audio.sfx.key(Number(d));
    changed();
    return true;
  }

  function backspace() {
    if (!digits) { CT.audio.sfx.reject(); shake(); return false; }
    digits = digits.slice(0, -1);
    CT.audio.sfx.erase();
    changed();
    return true;
  }

  function clear(silent) {
    if (!digits) {
      if (!silent) { CT.audio.sfx.reject(); shake(); }
      return false;
    }
    digits = '';
    if (!silent) CT.audio.sfx.erase();
    changed();
    return true;
  }

  function reset() { digits = ''; changed(); }

  function shake() {
    if (!els.amount) return;
    els.amount.classList.remove('shake');
    void els.amount.offsetWidth;   // アニメーションを確実に再生させる
    els.amount.classList.add('shake');
  }

  function changed() {
    renderDisplay();
    onChange(amount());
    scheduleCollapse();
  }

  /* ---------- テンキーの開閉 ---------- */

  function keypadMode() { return els.controls ? els.controls.dataset.keypad : 'open'; }

  function setKeypad(mode) {
    if (!els.controls || els.controls.dataset.keypad === mode) return;
    els.controls.dataset.keypad = mode;
    onKeypad(mode);
  }

  function scheduleCollapse() {
    clearTimeout(collapseTimer);
    if (!digits) { setKeypad('open'); return; }
    collapseTimer = setTimeout(function () { setKeypad('bar'); }, COLLAPSE_MS);
  }

  /* 金額欄をタップしたときは「開く」だけ。
     開いているときに閉じると、数字を押したつもりでテンキーが消えて幼児が混乱する。 */
  function expandKeypad() {
    if (document.body.dataset.state === 'eating' || document.body.dataset.state === 'thanks') return;
    clearTimeout(collapseTimer);
    setKeypad('open');
  }

  /* ---------- 表示 ---------- */

  function renderDisplay() {
    els.amountValue.textContent = String(value());
    document.body.dataset.empty = digits ? '0' : '1';
  }

  function init(opts) {
    els = opts;
    onChange = opts.onChange || onChange;
    onKeypad = opts.onKeypad || onKeypad;

    els.keypad.addEventListener('click', function (e) {
      var btn = e.target.closest('.key');
      if (!btn) return;
      CT.audio.unlock();
      var k = btn.dataset.key;
      if (k === 'back') backspace();
      else if (k === 'clear') clear();
      else press(k);
    });

    // 金額欄をタップでテンキーを再展開（スタイルガイドの指定）
    els.amount.addEventListener('click', function () {
      CT.audio.unlock();
      expandKeypad();
    });

    // Macでの開発用。実機のiPadでは使わない。
    global.addEventListener('keydown', function (e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^[0-9]$/.test(e.key)) { CT.audio.unlock(); press(e.key); e.preventDefault(); }
      else if (e.key === 'Backspace') { backspace(); e.preventDefault(); }
      else if (e.key === 'Escape') { clear(); e.preventDefault(); }
    });

    renderDisplay();
  }

  global.CT = global.CT || {};
  global.CT.keypad = {
    MAX_VALUE: MAX_VALUE,
    init: init, press: press, backspace: backspace, clear: clear,
    reset: reset, value: value, amount: amount,
    keypadMode: keypadMode, setKeypad: setKeypad, expandKeypad: expandKeypad
  };
})(this);
