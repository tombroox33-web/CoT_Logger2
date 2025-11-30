import * as vscode from 'vscode';
import * as fs from 'fs';
import { getConfigPath, loadConfig } from '../config';
import { runPythonScript } from '../python/runner';

export async function configureCommand() {
    const configPath = getConfigPath();
    if (!configPath) {
        vscode.window.showErrorMessage("Could not locate reasoning-logger.json in workspace root.");
        return;
    }

    const config = loadConfig();

    const items: vscode.QuickPickItem[] = [
        {
            label: "Toggle Embeddings",
            description: `Current: ${config.enableEmbeddings ? 'Enabled' : 'Disabled'}`,
            detail: "Enable semantic search (requires sentence-transformers)"
        },
        {
            label: "Open Config File",
            description: "Edit reasoning-logger.json directly"
        }
    ];

    const selection = await vscode.window.showQuickPick(items, {
        placeHolder: "Configure Reasoning Logger"
    });

    if (!selection) {
        return;
    }

    if (selection.label === "Toggle Embeddings") {
        const newStatus = !config.enableEmbeddings;

        if (newStatus) {
            // Check if sentence-transformers is installed
            const result = await runPythonScript('check_embeddings.py', []);
            if (result.success && result.output) {
                try {
                    const response = JSON.parse(result.output);
                    if (!response.installed) {
                        const install = await vscode.window.showWarningMessage(
                            "sentence-transformers is not installed. Semantic search will not work.",
                            "Install Now", "Enable Anyway"
                        );

                        if (install === "Install Now") {
                            const term = vscode.window.createTerminal("Reasoning Logger Setup");
                            term.show();
                            term.sendText("pip install sentence-transformers");
                        } else if (install !== "Enable Anyway") {
                            return; // Cancel toggle
                        }
                    }
                } catch (e) {
                    console.error("Failed to parse check_embeddings response", e);
                }
            }
        }

        config.enableEmbeddings = newStatus;
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        vscode.window.showInformationMessage(`Embeddings ${config.enableEmbeddings ? 'enabled' : 'disabled'}. Reload window to apply changes to Sidebar.`);
    } else if (selection.label === "Open Config File") {
        const doc = await vscode.workspace.openTextDocument(configPath);
        await vscode.window.showTextDocument(doc);
    }
}
