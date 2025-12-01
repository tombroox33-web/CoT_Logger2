import * as vscode from 'vscode';
import { validateAgentOutput, AgentOutput } from '../validation/schema';
import { runPythonScript } from '../python/runner';

export async function logReasoningCommand() {
    const input = await vscode.window.showInputBox({
        prompt: "Paste Agent Output JSON",
        placeHolder: '{"diff": "...", "reasoning": "...", "repair_ref": []}',
        ignoreFocusOut: true
    });

    if (!input) {
        return;
    }

    let json: any;
    try {
        json = JSON.parse(input);
    } catch (e) {
        const selection = await vscode.window.showErrorMessage(
            "Invalid JSON format. Save as raw text?",
            "Yes", "No"
        );
        if (selection === "Yes") {
            await saveRaw(input);
        }
        return;
    }

    const validation = validateAgentOutput(json);
    if (!validation.valid) {
        const selection = await vscode.window.showErrorMessage(
            `Validation Error: ${validation.error}. Save as raw text?`,
            "Yes", "No"
        );
        if (selection === "Yes") {
            await saveRaw(input);
        }
        return;
    }

    const agentOutput = json as AgentOutput;

    // Determine file: use provided file or active editor
    let file = agentOutput.file;
    if (!file) {
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor) {
            file = vscode.workspace.asRelativePath(activeEditor.document.uri);
        } else {
            file = "unknown";
        }
    }

    const args = [
        '--file', file,
        '--diff', agentOutput.diff,
        '--reasoning', agentOutput.reasoning,
        '--repair-ref', JSON.stringify(agentOutput.repair_ref)
    ];

    const result = await runPythonScript('save_entry.py', args);

    if (result.success && result.output) {
        try {
            const outputJson = JSON.parse(result.output);
            if (outputJson.success) {
                vscode.window.showInformationMessage(`Reasoning logged (ID: ${outputJson.id})`);
            } else {
                vscode.window.showErrorMessage(`Error saving log: ${outputJson.error}`);
            }
        } catch (e) {
            vscode.window.showErrorMessage(`Error parsing script output: ${result.output}`);
        }
    } else {
        vscode.window.showErrorMessage(`Script execution failed: ${result.error}`);
    }
}

async function saveRaw(text: string) {
    // Determine file for raw save
    let file = "unknown";
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor) {
        file = vscode.workspace.asRelativePath(activeEditor.document.uri);
    }

    // Use save_entry.py with just reasoning (and file)
    const args = [
        '--file', file,
        '--reasoning', text,
        '--diff', '', // Empty diff
        '--repair-ref', '[]'
    ];

    const result = await runPythonScript('save_entry.py', args);
    if (result.success && result.output) {
        try {
            const outputJson = JSON.parse(result.output);
            if (outputJson.success) {
                vscode.window.showInformationMessage(`Raw reasoning logged (ID: ${outputJson.id}).`);
            } else {
                vscode.window.showErrorMessage(`Error saving raw log: ${outputJson.error}`);
            }
        } catch (e) {
            vscode.window.showErrorMessage(`Error parsing script output: ${result.output}`);
        }
    } else {
        vscode.window.showErrorMessage(`Script execution failed: ${result.error}`);
    }
}
