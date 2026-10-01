/* money.js — 金額から「払い方（金種の内訳）」を計算する純ロジック。
   DOMにも音にも依存しないので test/money.test.html から単体で検証できる。 */
(function (global) {
  'use strict';

  // 口の中に並べる順番（上から）
  var ORDER = ['bill1000', 'coin500', 'coin100', 'coin50', 'coin10', 'coin5', 'coin1'];

  var VALUE = {
    bill1000: 1000,
    coin500: 500,
    coin100: 100,
    coin50: 50,
    coin10: 10,
    coin5: 5,
    coin1: 1
  };

  var LABEL = {
    bill1000: '1000えんさつ',
    coin500: '500えんだま',
    coin100: '100えんだま',
    coin50: '50えんだま',
    coin10: '10えんだま',
    coin5: '5えんだま',
    coin1: '1えんだま'
  };

  var MAX_AMOUNT = 2999;   // 千の位は2まで、ほかの位は9まで
  var MAX_DIGITS = 4;

  /**
   * 金額 → 金種の枚数。
   * 位ごとに独立して分解する（繰り上がりはしない）:
   *   千の位 … 1000円札。どちらのモードでも分解しない
   *   百の位 … まとめる: 500円玉＋100円玉 / こまかい: 100円玉だけ
   *   十の位 … まとめる: 50円玉＋10円玉  / こまかい: 10円玉だけ
   *   一の位 … まとめる: 5円玉＋1円玉    / こまかい: 1円玉だけ
   * @param {number} amount 0〜2999
   * @param {'fine'|'coarse'} mode 'fine'=こまかい（既定） 'coarse'=まとめる
   */
  function breakdown(amount, mode) {
    var a = Math.max(0, Math.min(MAX_AMOUNT, Math.floor(amount)));

    var t = Math.floor(a / 1000);          // 千の位
    var h = Math.floor((a % 1000) / 100);  // 百の位
    var d = Math.floor((a % 100) / 10);    // 十の位
    var o = a % 10;                        // 一の位

    var r = {
      bill1000: t,
      coin500: 0, coin100: 0,
      coin50: 0, coin10: 0,
      coin5: 0, coin1: 0
    };

    if (mode === 'coarse') {
      r.coin500 = Math.floor(h / 5); r.coin100 = h % 5;
      r.coin50 = Math.floor(d / 5);  r.coin10 = d % 5;
      r.coin5 = Math.floor(o / 5);   r.coin1 = o % 5;
    } else {
      r.coin100 = h;
      r.coin10 = d;
      r.coin1 = o;
    }
    return r;
  }

  function total(b) {
    var sum = 0;
    for (var i = 0; i < ORDER.length; i++) sum += (b[ORDER[i]] || 0) * VALUE[ORDER[i]];
    return sum;
  }

  function count(b) {
    var n = 0;
    for (var i = 0; i < ORDER.length; i++) n += (b[ORDER[i]] || 0);
    return n;
  }

  global.CT = global.CT || {};
  global.CT.money = {
    ORDER: ORDER, VALUE: VALUE, LABEL: LABEL,
    MAX_AMOUNT: MAX_AMOUNT, MAX_DIGITS: MAX_DIGITS,
    breakdown: breakdown, total: total, count: count
  };
})(this);
