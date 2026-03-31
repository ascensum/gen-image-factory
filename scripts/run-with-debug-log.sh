#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 2 ]; then
  echo "Usage: $0 <log-prefix> <command...>"
  echo "Example: $0 electron-dev npm run electron:dev"
  exit 1
fi

prefix="$1"
shift

# Always write under the repo root (directory containing package.json), not whatever cwd happens to be.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
LOG_DIR="${REPO_ROOT}/debug-logs"
mkdir -p "${LOG_DIR}"
timestamp="$(date +"%Y%m%d-%H%M%S")"
log_file="${LOG_DIR}/${prefix}-${timestamp}.log"

echo ""
echo "======== debug log capture ========"
echo "Log file (absolute): ${log_file}"
echo "Tip: debug-logs/ is gitignored — use Finder or: open \"${LOG_DIR}\""
echo "===================================="
echo ""

# Pipe through tee. Note: when stdout is a pipe, npm may buffer; prefer invoking electron directly from package.json for :log scripts.
"$@" 2>&1 | tee "${log_file}"
