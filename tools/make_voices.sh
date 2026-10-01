#!/bin/bash
# 怪獣の声を Mac の音声合成（Kyoko）で作る。
# 1回だけ実行すればよい。成果物 assets/voice/*.m4a はリポジトリに同梱する。
# 自分や家族の声に差し替えたい場合は、同じファイル名の m4a を置くだけでよい。
set -euo pipefail
cd "$(dirname "$0")/.."
OUT="assets/voice"
mkdir -p "$OUT"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

gen() {  # gen <出力名> <しゃべる文字列>
  local name="$1"
  local text="$2"
  say -v Kyoko -r 170 -o "$TMP/$name.aiff" "$text"
  afconvert -f m4af -d aac -b 64000 "$TMP/$name.aiff" "$OUT/$name.m4a"
  echo "  ${OUT}/${name}.m4a  <- ${text}"
}

echo "声を生成します（say -v Kyoko）..."
gen waai     "わーい"
gen arigatou "おかいけい、ありがとう"
echo "できました。js/audio.js が playbackRate で少し高くして怪獣っぽく鳴らします。"
