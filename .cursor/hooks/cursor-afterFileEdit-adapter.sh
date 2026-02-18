#!/usr/bin/env bash
# Cursor afterFileEdit → Claude PostToolUse adapter
# Transforms Cursor's afterFileEdit event to Claude Code's PostToolUse format

set -eo pipefail  # Removed -u flag to avoid issues with Cursor's environment

# Logging helper (stderr to avoid interfering with stdout)
log_error() {
  echo "[cursor-afterFileEdit-adapter] ERROR: $1" >&2
}

log_info() {
  echo "[cursor-afterFileEdit-adapter] INFO: $1" >&2
}

# Read Cursor's afterFileEdit JSON from stdin
INPUT=$(cat)

# Extract file_path from Cursor format: {"file_path": "..."}
FILE_PATH=$(echo "$INPUT" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('file_path', ''))")

if [ -z "$FILE_PATH" ]; then
  log_error "No file_path found in input JSON"
  exit 1
fi

# Transform to Claude's PostToolUse format
# ai-memory expects: {"tool_name": "Write", "tool_input": {"path": "...", "content": "...", "file_path": "..."}, ...}
# SECURITY: Use sys.argv instead of string interpolation to prevent shell injection
CWD=$(pwd)
SESSION_ID="cursor-$(date +%s)"

# Read file content for ai-memory
if [ -f "$FILE_PATH" ]; then
  FILE_CONTENT=$(cat "$FILE_PATH")
else
  FILE_CONTENT=""
fi

CLAUDE_FORMAT=$(python3 -c "import json, sys; print(json.dumps({
    'tool_name': 'Write',
    'tool_input': {
        'path': sys.argv[1],
        'file_path': sys.argv[1],
        'content': sys.argv[4]
    },
    'cwd': sys.argv[2],
    'session_id': sys.argv[3],
    'tool_response': {'filePath': sys.argv[1]}
}))" "$FILE_PATH" "$CWD" "$SESSION_ID" "$FILE_CONTENT")

if [ $? -ne 0 ]; then
  log_error "Failed to transform to Claude format"
  exit 0  # Graceful degradation - don't block file operations
fi

# Call ai-memory's PostToolUse hook
if [ ! -f ".claude/hooks/scripts/post_tool_capture.py" ]; then
  log_error "ai-memory hook script not found at .claude/hooks/scripts/post_tool_capture.py"
  exit 0  # Graceful degradation - don't block file operations
fi

# Set required environment variables for ai-memory
export AI_MEMORY_PROJECT_ID="gen-image-factory"
export AI_MEMORY_INSTALL_DIR="$HOME/.ai-memory"
export QDRANT_HOST="localhost"
export QDRANT_PORT="26350"
export EMBEDDING_HOST="localhost"
export EMBEDDING_PORT="28080"

# Check if file is documentation (.md, .yml) - bypass ImplementationFilter
FILE_EXT="${FILE_PATH##*.}"
if [[ "$FILE_EXT" == "md" ]] || [[ "$FILE_EXT" == "yml" ]] || [[ "$FILE_EXT" == "yaml" ]]; then
  # Use direct storage script that bypasses filter for documentation
  set +e
  HOOK_OUTPUT=$(echo "$CLAUDE_FORMAT" | /opt/homebrew/opt/python@3.12/bin/python3.12 "$HOME/.ai-memory/.claude/hooks/scripts/store_doc_direct.py" 2>&1)
  HOOK_EXIT=$?
  set -e
else
  # Use standard ai-memory hook for code files
  set +e
  HOOK_OUTPUT=$(echo "$CLAUDE_FORMAT" | /opt/homebrew/opt/python@3.12/bin/python3.12 .claude/hooks/scripts/post_tool_capture.py 2>&1)
  HOOK_EXIT=$?
  set -e
fi

# If hook failed, log error but continue gracefully
if [ $HOOK_EXIT -ne 0 ]; then
  log_error "ai-memory hook failed (exit $HOOK_EXIT), but continuing (graceful degradation)"
  echo "$HOOK_OUTPUT" >&2  # Show error details to stderr
  exit 0  # Don't block file operations if memory capture fails
fi

# Hook succeeded - emit minimal JSON so Cursor accepts "valid response" (avoids "no output" warning)
log_info "Memory captured for $FILE_PATH"
printf '%s\n' '{}'
exit 0
