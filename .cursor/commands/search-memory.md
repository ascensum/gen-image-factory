# Search memory (ai-memory semantic search)

Run the ai-memory search CLI and return results to the user. Use the **user's message** (everything they typed after `/search-memory`) as the query and optional flags.

## What to do

1. **Parse the user's message** after `/search-memory`:
   - First token(s) = search query (required). If the user wrote extra words, treat them as optional flags (see below).
   - Optional flags (if present): `--collection <name>`, `--limit <n>`, `--intent <how|what|why>`, `--type <type>`.

2. **Run the ai-memory search CLI** from the **project root** with this environment and command:

   - **Environment:**  
     `AI_MEMORY_INSTALL_DIR="$HOME/.ai-memory"`  
     `AI_MEMORY_PROJECT_ID="gen-image-factory"`  
     `QDRANT_HOST="localhost"`  
     `QDRANT_PORT="26350"`  
     `EMBEDDING_HOST="localhost"`  
     `EMBEDDING_PORT="28080"`

   - **Command:**  
     `python3 "$HOME/.ai-memory/scripts/memory/search_cli.py" "<query>" [options]`  
     Use the user's query as `<query>`. Add `--collection code-patterns|conventions|discussions|all`, `--limit N`, `--intent how|what|why` only if the user specified them.

3. **Show the command output** (stdout) to the user as the search result. If the command fails, report the error and suggest checking `/memory-status`.

## Collections

- **code-patterns** – implementations, code snippets
- **conventions** – ADRs, rules, standards
- **discussions** – session summaries, decisions
- **all** (default) – search all three

## Examples

- User: `/search-memory job execution status` → run with query `job execution status`
- User: `/search-memory frozen files ADR-001 --collection conventions --limit 5` → run with that query and options
