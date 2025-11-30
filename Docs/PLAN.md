# Reasoning Logger Extension - Implementation Plan

## Overview
This plan outlines the stepwise development of the Reasoning Logger VS Code extension, organized into 5 phases as defined in TASK.md.

---

## Milestone 1: Phase 0 - Foundations

### Goal
Establish the basic extension structure, configuration system, and sidebar UI skeleton.

### Steps

1. **Scaffold extension with Yeoman**
   - Run `yo code` to create TypeScript extension
   - Extension name: `reasoning-logger`
   - Enable webview for sidebar UI
   - Configure for VS Code API version compatibility

2. **Create configuration system**
   - Define `reasoning-logger.json` config file schema (see SCHEMA.json)
   - Implement config reader in extension
   - Default values:
     - `enableEmbeddings: false`
     - `embedderModel: "all-MiniLM-L6-v2"`
     - `dbPath: "reasoning_logs.db"`

3. **Set up Python environment requirements**
   - Document Python 3.8+ requirement
   - Create `requirements.txt`:
     - `sentence-transformers`
     - No additional dependencies (SQLite is built-in)

4. **Create sidebar webview skeleton**
   - Register webview view provider
   - Create basic HTML/CSS/JS for sidebar
   - Implement message passing between extension and webview
   - UI elements:
     - Search mode toggle (Keyword/Semantic)
     - Search input field
     - Results pane (empty initially)

5. **Initialize SQLite database**
   - Create Python script: `scripts/init_db.py`
   - Table schema: `reasoning` (see SCHEMA.json DatabaseSchema)
   - Run on extension activation if DB doesn't exist

### Deliverables
- ✅ Working extension scaffold
- ✅ Config file system
- ✅ Sidebar UI (non-functional search)
- ✅ Empty SQLite database initialized

---

## Milestone 2: Phase 1 - Ingestion and Persistence

### Goal
Implement the data capture and storage pipeline.

### Steps

1. **Create save_reasoning.py script**
   - Accept CLI arguments: `--file`, `--diff`, `--reasoning`, `--repair-ref`
   - Parse `repair_ref` as JSON array
   - Insert row into `reasoning` table
   - If `enableEmbeddings` is true:
     - Load sentence-transformers model
     - Encode `reasoning` text to vector
     - Store as BLOB (float32 bytes)
     - Store `embedder_name`
   - Return success/error status

2. **Implement JSON validation**
   - Create validation function in extension
   - Check required fields: `diff`, `reasoning`, `repair_ref`
   - Validate `repair_ref` is array of integers
   - Return detailed error messages for invalid inputs

3. **Create logging command**
   - Register command: `reasoning-logger.logReasoning`
   - Accept JSON input (manual paste for v1)
   - Validate JSON against schema
   - Determine `file` from active editor or JSON metadata
   - Call `save_reasoning.py` via child process
   - Show success/error notification

4. **Implement fallback logging**
   - On JSON parse failure, offer to save raw text
   - Create optional `reasoning_raw` table:
     - `id INTEGER PRIMARY KEY`
     - `raw_text TEXT`
     - `timestamp REAL`
   - Script: `scripts/save_raw.py`

5. **Add error handling and notifications**
   - Python script errors → VS Code error notification
   - DB write failures → log to Output channel
   - Invalid JSON → show validation errors with hints

### Deliverables
- ✅ Functional save pipeline
- ✅ JSON validation with helpful errors
- ✅ Fallback raw text capture
- ✅ Unit tests for save_reasoning.py

---

## Milestone 3: Phase 2 - Keyword Search UI

### Goal
Enable keyword-based search and display results in sidebar.

### Steps

1. **Create query_reasoning_json.py script**
   - Accept CLI argument: `--query` (search term)
   - Execute SQLite LIKE query on `reasoning` and `file` fields
   - Return JSON array with fields: `id`, `file`, `reasoning`, `repair_ref`, `timestamp`, `diff`
   - Limit to top 50 results (configurable)

2. **Implement search command in extension**
   - Listen to webview message: `searchKeyword`
   - Call `query_reasoning_json.py` with search term
   - Parse JSON response
   - Send results back to webview

3. **Render results in sidebar**
   - Display compact result cards:
     - File name (clickable to open file)
     - Reasoning snippet (truncated if long)
     - Timestamp (human-readable)
     - Repair refs as clickable badges
   - Implement "Show Diff" expandable section per result

4. **Add pagination (optional for v1)**
   - Simple "Load More" button
   - Or "Top N" selector (10, 25, 50, 100)

5. **Add copy-to-clipboard buttons**
   - Copy reasoning text
   - Copy diff
   - Copy full entry as JSON

### Deliverables
- ✅ Keyword search functional
- ✅ Results rendered in sidebar
- ✅ Clickable file links
- ✅ Copy buttons

---

## Milestone 4: Phase 3 - Semantic Search Integration

### Goal
Add vector-based semantic search capability.

### Steps

1. **Update database schema**
   - Ensure `embedding BLOB` and `embedder_name TEXT` fields exist
   - Migration script if needed (check existing DB)

2. **Create query_reasoning_semantic.py script**
   - Accept CLI argument: `--query` (natural language)
   - Load sentence-transformers model (same as save)
   - Encode query to vector
   - Fetch all embeddings from DB
   - Compute cosine similarity
   - Return top N results sorted by similarity score
   - Include similarity score in JSON response

3. **Add semantic search toggle in sidebar**
   - Radio buttons or dropdown: Keyword | Semantic
   - Show/hide based on `enableEmbeddings` config
   - If embeddings disabled, show info message

4. **Implement semantic search command**
   - Listen to webview message: `searchSemantic`
   - Call `query_reasoning_semantic.py`
   - Parse and send results to webview
   - Display similarity scores in results

5. **Performance optimization**
   - Cache loaded model in Python (persistent process?)
   - Warn if query takes >500ms
   - Consider limiting corpus size for brute-force similarity

### Deliverables
- ✅ Semantic search functional
- ✅ Toggle between search modes
- ✅ Similarity scores displayed
- ✅ Acceptable latency (<500ms for small corpora)

---

## Milestone 5: Phase 4 - Repair Lineage Navigation

### Goal
Enable exploration of repair chains via clickable repair_ref links.

### Steps

1. **Create get_reasoning_by_id.py script**
   - Accept CLI argument: `--id` (integer)
   - Fetch single entry by ID
   - Return JSON object or null if not found

2. **Implement repair_ref click handler**
   - Make repair_ref badges clickable in webview
   - Send message to extension: `openRepairRef` with ID
   - Call `get_reasoning_by_id.py`
   - Display result in modal or inline panel

3. **Add navigation history**
   - Track navigation stack in webview state
   - "Back" button to return to previous view
   - Breadcrumb trail (optional)

4. **Handle missing IDs gracefully**
   - Show "Entry not found" message
   - Offer to return to search results

5. **Visual lineage indicator**
   - Highlight current entry in lineage chain
   - Show "Referenced by" count (optional, requires reverse lookup)

### Deliverables
- ✅ Clickable repair_ref links
- ✅ Modal/panel display for referenced entries
- ✅ Back navigation
- ✅ Graceful handling of missing IDs

---

## Milestone 6: Phase 5 - Reliability and UX Polish

### Goal
Harden the extension with validation, error handling, and configuration UI.

### Steps

1. **Strict JSON schema validation**
   - Use JSON schema validator library
   - Provide actionable error hints (e.g., "Missing required field: repair_ref")
   - Link to schema documentation

2. **Fallback raw capture UI**
   - If validation fails, show "Save as raw?" prompt
   - Store in `reasoning_raw` table
   - Provide manual recovery workflow

3. **Configuration UI**
   - Command: `reasoning-logger.configure`
   - Quick-pick menu:
     - Toggle embeddings on/off
     - Set DB path (file picker)
     - Set embedder model (input box)
   - Update `reasoning-logger.json` on save

4. **Timestamp formatting**
   - Store as Unix epoch in DB
   - Display as human-readable in UI (e.g., "2 hours ago", "Nov 30, 2025 10:30 PM")
   - Tooltip with full timestamp

5. **Telemetry and debugging**
   - Create Output channel: "Reasoning Logger"
   - Log all Python script calls and responses
   - Log errors with stack traces
   - Configurable log level (info, debug, error)

6. **Extension settings in VS Code**
   - Integrate with VS Code settings UI
   - Settings:
     - `reasoningLogger.enableEmbeddings`
     - `reasoningLogger.dbPath`
     - `reasoningLogger.embedderModel`
   - Sync with `reasoning-logger.json`

### Deliverables
- ✅ Robust error handling
- ✅ Configuration UI
- ✅ Human-readable timestamps
- ✅ Debug logging to Output channel
- ✅ VS Code settings integration

---

## Python Scripts Summary

### Core Scripts (in `scripts/` directory)

1. **init_db.py**
   - Creates SQLite database with `reasoning` table
   - Optionally creates `reasoning_raw` table

2. **save_reasoning.py**
   - Args: `--file`, `--diff`, `--reasoning`, `--repair-ref`, `--config`
   - Inserts entry with optional embedding
   - Returns JSON: `{"success": true, "id": 123}` or `{"success": false, "error": "..."}`

3. **save_raw.py**
   - Args: `--text`, `--config`
   - Saves raw text to fallback table

4. **query_reasoning_json.py**
   - Args: `--query`, `--limit`, `--config`
   - Returns JSON array of matching entries

5. **query_reasoning_semantic.py**
   - Args: `--query`, `--limit`, `--config`
   - Returns JSON array with similarity scores

6. **get_reasoning_by_id.py**
   - Args: `--id`, `--config`
   - Returns single entry JSON or null

### Script Conventions
- All scripts accept `--config` pointing to `reasoning-logger.json`
- All scripts output JSON to stdout
- Errors written to stderr
- Exit code 0 for success, non-zero for errors

---

## Extension Commands

1. **reasoning-logger.logReasoning**
   - Opens input box for JSON paste
   - Validates and saves to DB

2. **reasoning-logger.configure**
   - Opens configuration quick-pick menu

3. **reasoning-logger.openSidebar**
   - Focuses the Reasoning Logger sidebar

4. **reasoning-logger.clearDatabase** (optional, for testing)
   - Prompts for confirmation
   - Deletes all entries from DB

---

## Testing Strategy

### Unit Tests (Python)
- Test each script independently with mock DB
- Validate JSON parsing and schema compliance
- Test embedding generation and retrieval
- Test edge cases (empty repair_ref, malformed JSON)

### Integration Tests (Extension)
- Mock Python script responses
- Test webview message passing
- Test command registration and execution
- Test error paths (DB missing, Python not found)

### Manual Testing Scenarios
1. Save valid JSON entry → verify in DB
2. Save with embeddings enabled → verify vector stored
3. Keyword search → verify results
4. Semantic search → verify similarity ranking
5. Click repair_ref → verify navigation
6. Invalid JSON → verify error message
7. Toggle embeddings off → verify search still works
8. Multi-file diff → verify file field handling

---

## File Structure

```
reasoning-logger/
├── src/
│   ├── extension.ts          # Main extension entry point
│   ├── config.ts              # Config file reader/writer
│   ├── commands/
│   │   ├── logReasoning.ts    # Log command implementation
│   │   └── configure.ts       # Config UI command
│   ├── sidebar/
│   │   ├── provider.ts        # Webview view provider
│   │   └── webview.html       # Sidebar UI
│   ├── validation/
│   │   └── schema.ts          # JSON schema validator
│   └── python/
│       └── runner.ts          # Python script executor
├── scripts/
│   ├── init_db.py
│   ├── save_reasoning.py
│   ├── save_raw.py
│   ├── query_reasoning_json.py
│   ├── query_reasoning_semantic.py
│   └── get_reasoning_by_id.py
├── requirements.txt
├── reasoning-logger.json      # Default config (template)
├── package.json               # Extension manifest
└── README.md
```

---

## Acceptance Criteria (from TASK.md)

- [x] Ingestion: Extension reliably parses valid JSON agent outputs; saves entries with optional embeddings
- [x] Search: Sidebar performs keyword and semantic searches; returns correct entries
- [x] Lineage: Clickable repair_ref links resolve to referenced entries; handles empty or invalid gracefully
- [x] Performance: Save operation <300ms without embeddings; <800ms with embeddings for small entries
- [x] Durability: DB survives extension reloads; schema migration safe if fields added later

---

## Risks and Mitigations

1. **Python not available in environment**
   - Mitigation: Check for Python on activation; show setup instructions if missing

2. **Sentence-transformers model download delay**
   - Mitigation: First-run setup wizard; cache model locally

3. **Large diff storage**
   - Mitigation: Consider compression for diffs >10KB (future)

4. **Embedding model version drift**
   - Mitigation: Store `embedder_name`; provide re-embedding migration script

5. **SQLite locking in multi-workspace scenarios**
   - Mitigation: Use WAL mode; document single-workspace limitation for v1

---

## Future Extensions (Deferred)

- Multi-file diff support with `entry_files` join table
- Approximate nearest neighbor (FAISS) for large corpora
- Syntax-highlighted diff viewer in webview
- Export/import functionality for sharing logs
- Planner review panel with reasoning summaries
- Confidence scores and test run metadata
- Integration with CI/CD for automated logging

---

## Coder Instructions

When implementing:
1. Follow the phase order strictly (0 → 1 → 2 → 3 → 4 → 5)
2. Reference SCHEMA.json for all data contracts
3. Log progress in CODELOG.md
4. Write unit tests alongside implementation
5. Use TypeScript strict mode
6. Follow VS Code extension best practices
7. Keep Python scripts simple and single-purpose
8. Document all public APIs and commands

---

## Reviewer Instructions

When testing:
1. Verify each phase's deliverables before approving next phase
2. Test both happy paths and error scenarios
3. Check performance benchmarks (save <300ms, query <500ms)
4. Validate JSON schema compliance
5. Test in Codespaces environment
6. Document findings in REVIEW.md
7. Flag any deviations from TASK.md requirements

---

**Planner sign-off**: This plan is ready for Coder implementation. All milestones, scripts, and data contracts are defined. Proceed with Phase 0.
---

## Milestone 7: Phase 6 - Post-Review Fixes

### Goal
Address critical and high-priority issues identified during code review (see REVIEW.md).

### Critical Fixes (Required for Compilation)

1. **Fix TypeScript Configuration**
   - **File**: `tsconfig.json`
   - **Issue**: Node_modules type conflicts prevent clean compilation
   - **Action**: Add `"skipLibCheck": true` to compilerOptions
   - **Impact**: Allows extension to compile without node_modules errors
   - **Priority**: CRITICAL - Must be fixed before testing

### High Priority Enhancements

2. **Add Config Awareness to Webview**
   - **Files**: `src/sidebar/provider.ts`, `src/sidebar/webview.html`
   - **Issue**: Semantic search toggle shown even when embeddings disabled
   - **Action**: 
     - Pass `enableEmbeddings` config to webview on initialization
     - Conditionally disable semantic radio button if embeddings off
     - Show info message when disabled
   - **Implementation**:
     ```typescript
     // In provider.ts resolveWebviewView():
     const config = loadConfig();
     webviewView.webview.postMessage({
         command: 'initialize',
         config: { enableEmbeddings: config.enableEmbeddings }
     });
     ```
     ```javascript
     // In webview.html:
     window.addEventListener('message', event => {
         if (event.data.command === 'initialize') {
             const semanticRadio = document.querySelector('input[value="semantic"]');
             if (!event.data.config.enableEmbeddings) {
                 semanticRadio.disabled = true;
                 semanticRadio.parentElement.title = 
                     'Enable embeddings in configuration to use semantic search';
             }
         }
     });
     ```
   - **Priority**: HIGH - Improves UX significantly

3. **Add Python Availability Check**
   - **File**: `src/extension.ts`
   - **Issue**: If Python missing, DB init fails silently
   - **Action**: Check Python availability on activation
   - **Implementation**:
     ```typescript
     // In activate() before DB init:
     const pythonCheck = await runPythonScript('--version', []);
     if (!pythonCheck.success) {
         vscode.window.showErrorMessage(
             'Reasoning Logger requires Python. Please install Python 3.8+ and add to PATH.',
             'Learn More'
         ).then(selection => {
             if (selection === 'Learn More') {
                 vscode.env.openExternal(vscode.Uri.parse('https://www.python.org/downloads/'));
             }
         });
         outputChannel.appendLine('Python not found in PATH');
         return; // Early exit from activation
     }
     ```
   - **Note**: Modify `runPythonScript` to accept direct `python` commands
   - **Priority**: HIGH - Prevents silent failures

### Medium Priority Enhancements

4. **Add Sentence-Transformers Check (Optional)**
   - **File**: `src/commands/configure.ts`
   - **Issue**: Embeddings can be enabled without sentence-transformers installed
   - **Action**: When toggling embeddings on, verify sentence-transformers availability
   - **Implementation**:
     ```typescript
     if (selection.label === "Toggle Embeddings" && !config.enableEmbeddings) {
         // Check if sentence-transformers is installed
         const result = await runPythonScript('check_embeddings.py', []);
         // If not installed, offer to show setup instructions
     }
     ```
   - **Create**: `scripts/check_embeddings.py` that imports sentence_transformers
   - **Priority**: MEDIUM - Nice-to-have setup validation

5. **Improve Semantic Search Error Messages**
   - **File**: `scripts/query_reasoning_semantic.py`
   - **Issue**: Generic error when embeddings disabled
   - **Action**: Add specific error message
   - **Implementation**:
     ```python
     if not config.get('enableEmbeddings', False):
         print(json.dumps({
             "success": False, 
             "error": "Embeddings not enabled. Use 'Configure Reasoning Logger' command to enable semantic search."
         }))
         return
     ```
   - **Priority**: MEDIUM - Better user guidance

### Low Priority (Future Improvements)

6. **Remove Auto-Generated Activation Event**
   - **File**: `package.json`
   - **Current**: `"activationEvents": ["onView:reasoningLogger.sidebar"]`
   - **Action**: Remove (auto-generated by VSCode for webview views)
   - **Priority**: LOW - No functional impact

7. **Add Performance Logging**
   - **Files**: `scripts/save_reasoning.py`, `scripts/query_reasoning_*.py`
   - **Action**: Log execution time to help verify <300ms/<800ms acceptance criteria
   - **Implementation**: Add time.time() measurements and output
   - **Priority**: LOW - Testing/benchmarking aid

### Deliverables (Phase 6)

- ✅ Extension compiles without errors **COMPLETE**
- ✅ Python availability checked on activation **COMPLETE**
- ✅ Webview respects embeddings configuration **COMPLETE**
- ✅ Better error messages for common setup issues **COMPLETE**
- ✅ User-friendly setup experience **COMPLETE**
- ✅ Sentence-transformers check in configure command **COMPLETE**

**Phase 6 Status**: All deliverables completed and verified by Reviewer.

---

## Testing Strategy for Post-Review Fixes

### Manual Tests After Fixes

1. **Compilation Test**
   - Run `npm run compile`
   - Verify no TypeScript errors
   - Check `out/` directory has compiled .js files

2. **Python Check Test**
   - Temporarily rename `python` to test failure case
   - Load extension → Should show helpful error
   - Restore python → Should initialize normally

3. **Embeddings Config Test**
   - Set `enableEmbeddings: false` in reasoning-logger.json
   - Open sidebar → Semantic toggle should be disabled
   - Enable embeddings via Configure command
   - Reload → Semantic toggle should be enabled

4. **Full Workflow Test**
   - Log valid JSON reasoning
   - Verify entry in DB
   - Search with keyword
   - (If embeddings enabled) Search semantically
   - Click repair_ref link
   - Navigate back

---

**Planner sign-off**: This plan is ready for Coder implementation. All milestones, scripts, and data contracts are defined. Proceed with Phase 0.
