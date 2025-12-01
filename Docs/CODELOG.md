# Coder Log

## Phase 0: Foundations

- [x] Scaffold extension with `yo code`
- [x] Create `reasoning-logger.json` config schema
- [x] Create `requirements.txt`
- [x] Create sidebar webview skeleton
- [x] Initialize SQLite database script `scripts/init_db.py`

## Phase 1: Ingestion and Persistence

- [x] Create `save_reasoning.py` script
- [x] Implement JSON validation in extension
- [x] Create logging command `reasoning-logger.logReasoning`
- [x] Implement fallback logging `scripts/save_raw.py`
- [x] Add error handling and notifications

## Phase 2: Keyword Search UI

- [x] Create `query_reasoning_json.py` script
- [x] Implement search command in extension (provider)
- [x] Render results in sidebar
- [x] Add copy-to-clipboard buttons

## Phase 3: Semantic Search Integration

- [x] Create `query_reasoning_semantic.py` script
- [x] Add semantic search toggle in sidebar (UI done)
- [x] Implement semantic search command (provider done)
- [x] Performance optimization (deferred)

## Phase 4: Repair Lineage Navigation

- [x] Create `get_reasoning_by_id.py` script
- [x] Implement repair_ref click handler in webview
- [x] Add navigation history (Back button)
- [x] Handle missing IDs gracefully

## Phase 5: Reliability and UX Polish

- [x] Strict JSON schema validation (Done)
- [x] Fallback raw capture UI (Done)
- [x] Configuration UI (Done)
- [x] Timestamp formatting (Done)
- [x] Telemetry and debugging (Output Channel implemented)

## Phase 6: Post-Review Fixes

- [x] Fix TypeScript configuration (`skipLibCheck: true`)
- [x] Add config awareness to Webview
- [x] Add Python availability check
- [x] Add Sentence-Transformers check
- [x] Improve semantic search error messages
- [x] Remove auto-generated activation event
- [ ] Add performance logging (Deferred to future)

## Phase 7: Manual Testing Fixes

- [x] Fix "Extension path not found" error (Explicit path passing)
- [x] Fix "Could not locate config" error (Graceful handling)
- [x] Fix database path resolution (Scripts now resolve relative to config dir, not CWD)
