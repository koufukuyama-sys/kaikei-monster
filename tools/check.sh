#!/bin/bash
# js/*.js と sw.js の構文チェック。
# このMacの node は壊れている（icu4c）ため、macOS内蔵の JavaScriptCore を使う。
set -uo pipefail
cd "$(dirname "$0")/.."
fail=0
for f in js/*.js sw.js; do
  msg=$(osascript -l JavaScript -e "
    ObjC.import('Foundation');
    var s = \$.NSString.stringWithContentsOfFileEncodingError('$PWD/$f', \$.NSUTF8StringEncoding, null).js;
    try { new Function(s); 'OK' } catch (e) { 'ERR ' + e.message }")
  if [ "$msg" = "OK" ]; then echo "  OK   $f"; else echo "  NG   $f : $msg"; fail=1; fi
done
exit $fail
