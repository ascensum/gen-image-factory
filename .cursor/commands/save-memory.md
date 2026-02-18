# Save memory (manual session save to ai-memory)

Save the current session summary to the ai-memory **discussions** collection. Use this when the user wants to checkpoint the conversation (e.g. before ending the session or after a major milestone).

## What to do

1. **Parse the user's message** after `/save-memory`:
   - Optional: any text after `/save-memory` is a **note** to attach to the session summary (e.g. "Completed auth feature").

2. **Run the ai-memory manual save script** from the **project root** with this environment and command:

   - **Environment:**  
     `AI_MEMORY_INSTALL_DIR="$HOME/.ai-memory"`  
     `AI_MEMORY_PROJECT_ID="gen-image-factory"`  
     `QDRANT_HOST="localhost"`  
     `QDRANT_PORT="26350"`  
     `EMBEDDING_HOST="localhost"`  
     `EMBEDDING_PORT="28080"`

   - **Command:**  
     `python3 "$HOME/.ai-memory/.claude/hooks/scripts/manual_save_memory.py" [note]`  
     If the user provided a note (text after `/save-memory`), pass it as a single argument (e.g. `"Completed auth feature"`). Otherwise run with no extra arguments.

3. **Show the command output** to the user. If the command fails, report the error and suggest checking `/memory-status`.

## When to use

- User explicitly runs `/save-memory` or asks to "save session" or "checkpoint conversation".
- Do not run automatically on every message; only when the user requests a save.
