# Project Task: Reasoning Logger Extension

## Goal
Build a VS Code extension (with Codespaces and Antigravity support) that logs AI reasoning events in a structured, durable format.

## Scope
- Capture reasoning events from multiple LLMs.
- Persist logs in JSON using the schema defined in SCHEMA.json.
- Provide ergonomic UI for viewing logs inside VS Code.
- Ensure compatibility with Codespaces and Antigravity environments.

## Roles
- Planner: Defines milestones, schema, and recipes.
- Coder: Implements extension code in src/.
- Reviewer: Tests extension, writes feedback in REVIEW.md.

## Workflow
1. Planner updates PLAN.md and SCHEMA.json.
2. Coder implements features based on PLAN.md.
3. Reviewer tests and records feedback in REVIEW.md.
4. All roles reference TASK.md for the overarching goal.

Detailed description:..

### Sidebar rendering of repair_ref links


## Project summary

You’re building a VS Code companion extension that captures AI coder and repair agent outputs (diffs + reasoning), persists them into SQLite with optional embeddings, and exposes a sidebar for keyword/semantic search with repair lineage links. The goal is durable, searchable intent memory and traceable repair lineage with minimal schema and an extendable, lightweight stack.

---

## Architecture and data flow

- **Logger extension:** Hooks into raw output, parses JSON contracts from agents, and forwards data to Python save scripts.
- **SQLite store:** Minimal schema with `id, file, diff, reasoning, timestamp, repair_ref, embedding(optional)`.
- **Embedding layer:** Sentence-transformers encode `reasoning` during save; vectors stored as BLOB for semantic search.
- **Sidebar UI:** Webview view that supports keyword/semantic search, renders results, and resolves `repair_ref` links.
- **Query scripts:** Keyword and semantic endpoints return JSON for the sidebar; single-ID fetch for lineage navigation.

---

## Data schema and contracts

- **SQLite table reasoning:**
  - **id:** INTEGER PRIMARY KEY
  - **file:** TEXT
  - **diff:** TEXT
  - **reasoning:** TEXT
  - **timestamp:** REAL
  - **repair_ref:** TEXT (JSON array string)
  - **embedding:** BLOB (optional)

- **Agent output (required JSON):**
  - **diff:** string (unified patch)
  - **reasoning:** string (concise explanation)
  - **repair_ref:** array of integers (can be empty)

- **Logger save contract:**
  - **Inputs:** file, diff, reasoning, repair_ref[]
  - **Actions:** insert row; if embeddings enabled, compute and store vector

---

## Extension features

- **Capture and persist:**
  - **Structured ingestion:** Accept JSON from agents; validate schema; forward to Python save.
  - **Auto-embeddings:** Optional toggle to compute/store embeddings.

- **Search and navigation:**
  - **Keyword search:** SQLite LIKE query, returns compact results.
  - **Semantic search:** Sentence-transformers cosine similarity across embedded vectors.
  - **Repair lineage links:** Clickable `repair_ref` IDs, fetch and display referenced entries.

- **Reliability safeguards:**
  - **JSON validation:** Reject invalid agent outputs; notify.
  - **Fallback logging:** Save raw text on parse failure for manual recovery.
  - **Versioning:** Store embedder model name to re-index if models change (optional field `embedder_name TEXT`).

---

## Detailed build plan with specs and requirements

### Phase 0 — Foundations

- **Requirements:**
  - **VS Code extension scaffolding:** Activation, commands, webview, message passing.
  - **Python runtime:** Accessible via `python` command.
  - **SQLite DB file:** `reasoning_logs.db` locally in workspace.
  - **Sentence-transformers:** Installed; model `all-MiniLM-L6-v2`.

- **Specs:**
  - **Config file:** `reasoning-logger.json`
    - **enableEmbeddings:** boolean
    - **embedderModel:** string default "all-MiniLM-L6-v2"
    - **dbPath:** string default "reasoning_logs.db"

- **Deliverables:**
  - Minimal extension with a sidebar containing query inputs and results pane.

### Phase 1 — Ingestion and persistence

- **Specs:**
  - **JSON ingestion:** Listen to agent output events (or manual paste for v1), parse JSON with fields `diff`, `reasoning`, `repair_ref`.
  - **File association:** Determine `file` from context or agent metadata; for multi-file diffs, store path of primary file or a comma-separated list (v1).
  - **Save script:** `save_reasoning.py` inserts row; computes embedding if enabled; stores `repair_ref` as JSON string.

- **Deliverables:**
  - Robust save path with error notifications.
  - Unit tests for JSON parsing and DB inserts.

### Phase 2 — Keyword search UI

- **Specs:**
  - **Query script:** `query_reasoning_json.py` returns JSON array with `id, file, reasoning, repair_ref[], timestamp`.
  - **Rendering:** Results shown in sidebar; compact per-entry block with a clickable repair_ref list.

- **Deliverables:**
  - Keyword search functional with pagination (optional simple “top N” first).
  - Copy-to-clipboard buttons (optional).

### Phase 3 — Semantic search integration

- **Specs:**
  - **DB field:** `embedding BLOB`, optional `embedder_name TEXT`.
  - **Save step:** Encode reasoning to vector; store as float32 bytes.
  - **Query script:** `query_reasoning_semantic.py` computes cosine similarity; returns top N entries JSON.

- **Deliverables:**
  - Sidebar toggle between Keyword and Semantic search.
  - Latency within acceptable bounds (<500 ms for small corpora; warn if longer).

### Phase 4 — Repair lineage navigation

- **Specs:**
  - **Link behavior:** Click `repair_ref` ID → request `get_reasoning_by_id.py` → display referenced entry in modal/inline panel.
  - **Back navigation:** Simple “back” button to return to previous results.

- **Deliverables:**
  - Smooth lineage exploration with minimal clicks.
  - Handles missing IDs gracefully (shows “not found”).

### Phase 5 — Reliability and UX polish

- **Specs:**
  - **Validation:** JSON schema check for agent outputs; error surface with actionable hints.
  - **Fallback capture:** If agent output is non-JSON, store as raw note with `reasoning_raw` table (optional).
  - **Config UI:** Quick-pick to enable/disable embeddings and set db path.
  - **Timestamps:** Human-readable in UI; raw epoch in DB.

- **Deliverables:**
  - Configurable behaviors; helpful error messages.
  - Basic telemetry log to Output channel for debugging.

---

## Acceptance criteria

- **Ingestion:** Extension reliably parses valid JSON agent outputs; saves entries with optional embeddings.
- **Search:** Sidebar performs keyword and semantic searches; returns correct entries.
- **Lineage:** Clickable `repair_ref` links resolve to referenced entries; handles empty or invalid gracefully.
- **Performance:** Save operation <300 ms without embeddings; <800 ms with embeddings for small entries.
- **Durability:** DB survives extension reloads; schema migration safe if fields added later.

---

## Testing strategy

- **Unit tests (Python):**
  - **Insert/select correctness:** Save and read round-trip.
  - **Embedding shape consistency:** Float32 size matches model output.
  - **JSON parsing robustness:** Handles empty `repair_ref`, malformed JSON gracefully.

- **Integration tests (Extension):**
  - **Webview messaging:** Search and openRef flows.
  - **Error paths:** Invalid JSON from agent; DB path missing.

- **Manual scenarios:**
  - **Multi-file diff:** Ensure `file` field strategy is sensible or note limitation.
  - **No embeddings:** Toggle off; search still functional.

---

## Risks and mitigations

- **Brittle agent outputs:** Mitigate with strict JSON contract and validation.
- **Embedding drift:** Store `embedder_name`; re-embed if model changes (future migration script).
- **Scaling:** SQLite + brute-force similarity is fine for hundreds to low thousands of entries; consider FAISS or in-DB vector extension later if needed.
- **Context ambiguity for `file`:** Encourage agents to include a `files` array; v1 store primary file; v2 support a join table `entry_files`.

---

## Future extensions (deferred)

- **Schema evolution:** Add `files` join table, `tests_run`, `confidence_score`, `unit_system`.
- **Vector index:** Move to approximate nearest neighbor for speed at scale.
- **Diff rendering:** Syntax-highlighted patch viewer in webview.
- **Planner hooks:** A review panel summarising recent reasoning with flags.

---

If you want, I can package this into a starter repository layout (extension src, Python scripts, config file, and a sample agent output) so you can drop it into your workspace and iterate immediately.
