#!/bin/bash

# Commit message emoji policy enforcement
# Fails if the commit message contains emojis

set -euo pipefail

MSG_FILE="$1"

if [ ! -f "$MSG_FILE" ]; then
  echo "[ERROR] commit message file not found: $MSG_FILE"
  exit 1
fi

MSG_CONTENT=$(cat "$MSG_FILE")

# Node-based emoji detection (works cross-platform, handles Extended_Pictographic)
if command -v node >/dev/null 2>&1; then
  node -e 'const fs=require("fs");const m=fs.readFileSync(process.argv[1],"utf8");try{const r=/[\p{Extended_Pictographic}\p{Emoji_Presentation}]/u; if(r.test(m)){process.exit(2)} }catch(e){const r2=/[\u203C-\u3299\u2122\u00A9\u00AE\u2194-\u21AA\u231A-\u27BF\u2B05-\u2B55\u1F000-\u1FAFF]/; if(r2.test(m)){process.exit(2)} }' "$MSG_FILE" || RC=$?; RC=${RC:-0}; if [ "$RC" -eq 2 ]; then echo "[ERROR] Emojis are not allowed in commit messages."; exit 1; fi
fi

exit 0


