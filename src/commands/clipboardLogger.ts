import * as vscode from 'vscode';
import { runPythonScript, logToOutput } from '../python/runner';
import { getConfigPath } from '../config';
import { FileTracker } from '../trackers/fileTracker';

let clipboardInterval: NodeJS.Timeout | undefined;
let lastClipboardContent: string = '';
let statusBarItem: vscode.StatusBarItem | undefined;

export async function logFromClipboardCommand() {
    const content = await vscode.env.clipboard.readText();
    if (!content) {
        vscode.window.showInformationMessage("Clipboard is empty.");
        return;
    }

    // Always process as reasoning (raw or JSON)
    await processReasoning(content);
}

export function toggleClipboardWatcherCommand() {
    if (clipboardInterval) {
        // Stop watching
        clearInterval(clipboardInterval);
        clipboardInterval = undefined;
        if (statusBarItem) {
            statusBarItem.hide();
        }
        vscode.window.showInformationMessage("Reasoning Clipboard Watcher: OFF");
        logToOutput("Clipboard Watcher stopped.");
    } else {
        // Start watching
        vscode.env.clipboard.readText().then(async text => {
            lastClipboardContent = text;

            // If clipboard has content, process it immediately?
            // Maybe user just copied it.
            if (text && text.trim().length > 0) {
                logToOutput("Watcher started. Processing initial clipboard content...");
                await processReasoning(text);
            }

            clipboardInterval = setInterval(checkClipboard, 1000);

            if (!statusBarItem) {
                statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
                statusBarItem.command = 'reasoning-logger.toggleClipboardWatcher';
            }
            statusBarItem.text = "$(eye) Reasoning Watcher: ON";
            statusBarItem.show();

            vscode.window.showInformationMessage("Reasoning Clipboard Watcher: ON");
        });
    }
}

async function checkClipboard() {
    const content = await vscode.env.clipboard.readText();
    if (content && content !== lastClipboardContent) {
        lastClipboardContent = content;
        logToOutput(`Clipboard changed. Length: ${content.length}`);
        await processReasoning(content);
    }
}

async function processReasoning(text: string) {
    try {
        let reasoning = text;
        let diff = "";
        let repairRef = "[]";
        let file = "unknown";

        // 1. Try to parse as JSON (Legacy/Strict Mode)
        try {
            const json = JSON.parse(text);
            if (json.diff && json.reasoning) {
                reasoning = json.reasoning;
                diff = json.diff;
                repairRef = JSON.stringify(json.repair_ref || []);
                file = json.file || file;
                logToOutput("Detected JSON format.");
            }
        } catch (e) {
            // Not JSON, treat as Raw Text
            // Smart Parsing: Look for code blocks for diff?
            // User asked for "Smart Parsing" earlier, but then switched to "File Watcher".
            // If we have a File Watcher, we prefer the REAL diff from the file.
            // But if the text contains a code block, maybe we still want to capture it?
            // Let's stick to the "File Watcher" plan primarily.
        }

        // 2. Determine File
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            file = vscode.workspace.asRelativePath(editor.document.uri);
        }

        // 3. Check FileTracker for existing entry
        let entryId: number | undefined;
        if (editor) {
            const tracker = FileTracker.getInstance();
            const lastId = tracker.getLastEntryId(editor.document.uri.fsPath);
            if (lastId) {
                // Is it recent? (Logic handled by Tracker state, but we can double check if needed)
                // We assume if tracker has it, it's valid to update.
                entryId = lastId;
                logToOutput(`Found existing WIP Entry #${entryId} for ${file}. Attaching reasoning.`);
            }
        }

        const args = [
            '--file', file,
            '--reasoning', reasoning,
            '--repair-ref', repairRef
        ];

        if (diff) {
            args.push('--diff', diff);
        }

        if (entryId) {
            args.push('--id', entryId.toString());
        }

        const result = await runPythonScript('save_entry.py', args);

        if (result.success) {
            try {
                const output = JSON.parse(result.output || '{}');
                if (output.success) {
                    const finalId = output.id;
                    vscode.window.showInformationMessage(`Reasoning logged (ID: ${finalId})`);
                    logToOutput(`Successfully logged reasoning ID: ${finalId}`);

                    // 4. Seal the entry in Tracker
                    if (editor) {
                        FileTracker.getInstance().markEntryAsSealed(editor.document.uri.fsPath, finalId);
                    }
                } else {
                    vscode.window.showErrorMessage(`Failed to save reasoning: ${output.error}`);
                    logToOutput(`Failed to save reasoning: ${output.error}`);
                }
            } catch (e) {
                logToOutput(`Failed to parse save output: ${result.output}`);
            }
        } else {
            logToOutput(`Script execution failed: ${result.error}`);
        }
    } catch (e) {
        console.error(e);
        logToOutput(`Error processing reasoning: ${e}`);
    }
}
