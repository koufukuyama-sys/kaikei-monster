#!/bin/bash
# Macでローカルサーバを立て、iPadから開くURLを表示する。
# 停止は Ctrl-C。
set -euo pipefail
cd "$(dirname "$0")"
PORT="${1:-8000}"
IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo '')"

echo "かいけいモンスター"
echo "----------------------------------------"
echo "  Mac:  http://localhost:${PORT}/"
if [ -n "$IP" ]; then
  echo "  iPad: http://${IP}:${PORT}/      <- 同じWi-Fiにつないで Safari で開く"
else
  echo "  iPad: Wi-Fi未接続のためIPを取得できませんでした"
fi
echo "  テスト: http://localhost:${PORT}/test/money.test.html"
echo "----------------------------------------"
# キャッシュ無効の開発用サーバ（古いJS/CSSを掴まないようにするため）
exec python3 tools/devserver.py "$PORT" .
