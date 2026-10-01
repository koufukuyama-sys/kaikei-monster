/* layout.js — 実寸(mm)でお金をトレイに並べる計算。
   ここでは一切DOMを触らず、mm単位の配置プランだけを返す。 */
(function (global) {
  'use strict';

  /* 日本の通貨の実寸。ここは事実なので変更しないこと。
     10円玉(23.5mm)が50円玉(21.0mm)・100円玉(22.6mm)より大きい、という
     大小関係こそが「金額感」を体で覚えるための肝。 */
  var SIZE_MM = {
    bill1000: { w: 150, h: 76 },
    coin500:  { d: 26.5 },
    coin100:  { d: 22.6 },
    coin50:   { d: 21.0, hole: 4.0 },
    coin10:   { d: 23.5 },
    coin5:    { d: 22.0, hole: 5.0 },
    coin1:    { d: 20.0 }
  };

  /* 「位」ごとに1行。ユーザーの分解ルール
       千の位 = お札 / 百の位 = 500・100玉 / 十の位 = 50・10玉 / 一の位 = 5・1玉
     とそろえてある。
     （スタイルガイドのモックは「金種ごとに1行」だったが、1円・5円が増えると
       まとめるモードが最大6行になり、こまかいモードより縦に伸びて
       「まとめたのに大きく縮む」という逆転が起きるため、位ごとにまとめている） */
  var GROUPS = [
    ['bill1000'],
    ['coin500', 'coin100'],
    ['coin50', 'coin10'],
    ['coin5', 'coin1']
  ];

  var GAP_MM = 1.5;          // 同じ行のお金どうしの隙間
  var GROUP_GAP_MM = 2.5;    // 位どうしの隙間
  var BILL_OFFSET_MM = 26.0; // お札を重ねるときの縦ずらし量（下の札が見える幅）

  function sizeOf(kind) {
    var s = SIZE_MM[kind];
    return s.d ? { w: s.d, h: s.d } : { w: s.w, h: s.h };
  }

  /* n枚を rows 行に均等に割る（9枚を2行なら 6+3 ではなく 5+4）。
     スタイルガイドの「行は枚数を均等に割ると見た目が安定する」に従う。 */
  function splitRows(n, perRow) {
    var rows = Math.max(1, Math.ceil(n / perRow));
    var base = Math.floor(n / rows);
    var extra = n % rows;
    var out = [];
    for (var i = 0; i < rows; i++) out.push(base + (i < extra ? 1 : 0));
    return out;
  }

  // 1つの位に並べる玉の列を作る（500円1枚 + 100円4枚 → [500,100,100,100,100]）
  function expand(bd, kinds) {
    var out = [];
    for (var i = 0; i < kinds.length; i++) {
      for (var n = bd[kinds[i]] || 0; n > 0; n--) out.push(kinds[i]);
    }
    return out;
  }

  /**
   * 金種の内訳 → mm単位の配置プラン。
   * @param {object} bd CT.money.breakdown() の戻り値
   * @param {number} availWmm トレイの横幅(mm)。1行に並べられる枚数の上限を決めるのに使う
   * @returns {{w:number,h:number,items:Array<{kind,x,y,w,h,index}>}} 原点は内容の左上
   */
  function plan(bd, availWmm) {
    var g, i, r, c;

    /* --- 1パス目: 各位の行構成と、必要な横幅 contentW を決める --- */
    var groups = [];
    var contentW = 0;

    var nBill = bd.bill1000 || 0;
    if (nBill > 0) contentW = Math.max(contentW, SIZE_MM.bill1000.w);

    for (g = 1; g < GROUPS.length; g++) {
      var list = expand(bd, GROUPS[g]);
      if (!list.length) continue;

      // 行の高さ・間隔は、その位で一番大きい玉に合わせる
      var dMax = 0;
      for (i = 0; i < list.length; i++) dMax = Math.max(dMax, SIZE_MM[list[i]].d);

      var perRow = Math.max(1, Math.floor((availWmm + GAP_MM) / (dMax + GAP_MM)));
      var rows = splitRows(list.length, perRow);
      var widest = Math.max.apply(null, rows);
      contentW = Math.max(contentW, widest * dMax + (widest - 1) * GAP_MM);

      groups.push({ list: list, dMax: dMax, rows: rows });
    }
    if (contentW === 0) return { w: 0, h: 0, items: [] };

    /* --- 2パス目: contentW の中で中央寄せして置いていく --- */
    var items = [];
    var y = 0;

    for (var b = 0; b < nBill; b++) {
      items.push({
        kind: 'bill1000',
        x: (contentW - SIZE_MM.bill1000.w) / 2,
        y: y + b * BILL_OFFSET_MM,
        w: SIZE_MM.bill1000.w,
        h: SIZE_MM.bill1000.h,
        index: items.length
      });
    }
    if (nBill > 0) y += SIZE_MM.bill1000.h + BILL_OFFSET_MM * (nBill - 1) + GROUP_GAP_MM;

    for (g = 0; g < groups.length; g++) {
      var grp = groups[g];
      var cell = grp.dMax + GAP_MM;
      var k = 0;
      for (r = 0; r < grp.rows.length; r++) {
        var inRow = grp.rows[r];
        var rowW = inRow * grp.dMax + (inRow - 1) * GAP_MM;
        for (c = 0; c < inRow; c++, k++) {
          var kind = grp.list[k];
          var d = SIZE_MM[kind].d;
          items.push({
            kind: kind,
            // セルの中で中央寄せ（同じ行に大きさの違う玉が混ざってもきれいに並ぶ）
            x: (contentW - rowW) / 2 + c * cell + (grp.dMax - d) / 2,
            y: y + r * cell + (grp.dMax - d) / 2,
            w: d,
            h: d,
            index: items.length
          });
        }
      }
      y += grp.rows.length * grp.dMax + (grp.rows.length - 1) * GAP_MM + GROUP_GAP_MM;
    }

    return { w: contentW, h: Math.max(0, y - GROUP_GAP_MM), items: items };
  }

  global.CT = global.CT || {};
  global.CT.layout = {
    SIZE_MM: SIZE_MM, GROUPS: GROUPS, GAP_MM: GAP_MM,
    GROUP_GAP_MM: GROUP_GAP_MM, BILL_OFFSET_MM: BILL_OFFSET_MM,
    sizeOf: sizeOf, plan: plan, splitRows: splitRows
  };
})(this);
