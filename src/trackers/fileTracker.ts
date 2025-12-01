import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { runPythonScript, logToOutput } from '../python/runner';

interface FileState {
    lastEntryId?: number;
    originalContent: string;
    hasReasoning: boolean;
    lastSaveTime: number;
}

export class FileTracker {
    private static instance: FileTracker;
    private fileStates: Map<string, FileState> = new Map();
    private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
    private tempDir: string;

    private constructor() {
        this.tempDir = path.join(os.tmpdir(), 'reasoning-logger-diffs');
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }
    }

    public static getInstance(): FileTracker {
        if (!FileTracker.instance) {
            FileTracker.instance = new FileTracker();
        }
        return FileTracker.instance;
    }

    public startWatching(context: vscode.ExtensionContext) {
        // Initialize state for active editor
        if (vscode.window.activeTextEditor) {
            this.initializeFileState(vscode.window.activeTextEditor.document);
        }

        // Watch for opens
        context.subscriptions.push(
            vscode.workspace.onDidOpenTextDocument(doc => {
                this.initializeFileState(doc);
            })
        );

        // Watch for saves
        context.subscriptions.push(
            vscode.workspace.onDidSaveTextDocument(doc => {
                this.handleFileSave(doc);
            })
        );

        logToOutput("FileTracker started.");
    }

    private initializeFileState(doc: vscode.TextDocument) {
        if (doc.uri.scheme !== 'file') return;

        const filePath = doc.uri.fsPath;
        if (!this.fileStates.has(filePath)) {
            this.fileStates.set(filePath, {
                originalContent: doc.getText(),
                hasReasoning: false,
                lastSaveTime: Date.now()
            });
        }
    }

    private handleFileSave(doc: vscode.TextDocument) {
        if (doc.uri.scheme !== 'file') return;

        const filePath = doc.uri.fsPath;

        // Clear existing timer
        if (this.debounceTimers.has(filePath)) {
            clearTimeout(this.debounceTimers.get(filePath));
        }

        // Set new timer (Debounce 1s)
        const timer = setTimeout(() => {
            this.processSave(doc);
        }, 1000);

        this.debounceTimers.set(filePath, timer);
    }

    private async processSave(doc: vscode.TextDocument) {
        const filePath = doc.uri.fsPath;
        let state = this.fileStates.get(filePath);

        if (!state) {
            // Should have been initialized, but just in case
            state = {
                originalContent: doc.getText(), // If missed init, baseline is NOW (so no diff yet)
                hasReasoning: false,
                lastSaveTime: Date.now()
            };
            this.fileStates.set(filePath, state);
            return; // No diff to save yet if we just init
        }

        // 1. Write original content to temp file
        const tempOldPath = path.join(this.tempDir, `old_${path.basename(filePath)}`);
        fs.writeFileSync(tempOldPath, state.originalContent);

        // 2. Compute Diff
        const diffResult = await runPythonScript('compute_diff.py', [
            tempOldPath,
            filePath,
            vscode.workspace.asRelativePath(filePath)
        ]);

        // Cleanup temp
        fs.unlinkSync(tempOldPath);

        if (!diffResult.success) {
            logToOutput(`Failed to compute diff: ${diffResult.error}`);
            return;
        }

        const diff = diffResult.output || '';
        if (!diff.trim()) {
            return; // No changes
        }

        // 3. Save/Update Entry
        const args = [
            '--file', vscode.workspace.asRelativePath(filePath),
            '--diff', diff
        ];

        // Decision: Update or Create?
        if (state.lastEntryId && !state.hasReasoning) {
            // Update existing "WIP" entry
            args.push('--id', state.lastEntryId.toString());
            logToOutput(`Updating WIP Entry #${state.lastEntryId} for ${path.basename(filePath)}`);
        } else {
            // Create new entry
            logToOutput(`Creating NEW Entry for ${path.basename(filePath)}`);
        }

        const saveResult = await runPythonScript('save_entry.py', args);

        if (saveResult.success) {
            try {
                const output = JSON.parse(saveResult.output || '{}');
                if (output.success) {
                    // Update state
                    state.lastEntryId = output.id;
                    state.lastSaveTime = Date.now();
                    // Note: We do NOT update originalContent here. 
                    // We want the diff to accumulate relative to the START of this unit of work.
                    // originalContent only updates when we "Seal" the entry (add reasoning).
                } else {
                    logToOutput(`Failed to save entry: ${output.error}`);
                }
            } catch (e) {
                logToOutput(`Error parsing save output: ${e}`);
            }
        } else {
            logToOutput(`Save script failed: ${saveResult.error}`);
        }
    }

    public getLastEntryId(filePath: string): number | undefined {
        return this.fileStates.get(filePath)?.lastEntryId;
    }

    public markEntryAsSealed(filePath: string, entryId: number) {
        const state = this.fileStates.get(filePath);
        if (state && state.lastEntryId === entryId) {
            state.hasReasoning = true;

            // Reset baseline! 
            // The next save should be relative to NOW (the sealed state).
            // We need to read the file from disk to get current content.
            try {
                const content = fs.readFileSync(filePath, 'utf-8');
                state.originalContent = content;
                logToOutput(`Entry #${entryId} sealed. Baseline reset for ${path.basename(filePath)}.`);
            } catch (e) {
                logToOutput(`Failed to reset baseline for ${filePath}: ${e}`);
            }
        }
    }
}
