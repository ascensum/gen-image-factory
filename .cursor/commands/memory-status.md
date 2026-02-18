# Memory status (ai-memory health check)

Run the ai-memory status CLI and show the user the system health and collection statistics. No query or arguments are required.

## What to do

1. **Run the ai-memory status CLI** from the **project root** with this environment:

   - **Environment:**  
     `AI_MEMORY_INSTALL_DIR="$HOME/.ai-memory"`  
     `AI_MEMORY_PROJECT_ID="gen-image-factory"`  
     `QDRANT_HOST="localhost"`  
     `QDRANT_PORT="26350"`  
     `EMBEDDING_HOST="localhost"`  
     `EMBEDDING_PORT="28080"`

   - **Command:**  
     `python3 "$HOME/.ai-memory/scripts/memory/memory_status.py"`

2. **Show the command output** (stdout) to the user. If the command fails, report the error (e.g. Qdrant or embedding service unavailable).

## When to use

- User asks for memory system health, collection counts, or whether ai-memory is working.
- Before or after `/search-memory` to verify the system is up.
