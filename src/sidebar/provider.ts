import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { runPythonScript } from '../python/runner';
import { loadConfig } from '../config';

export class ReasoningLogProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'reasoningLogger.sidebar';
    private _view?: vscode.WebviewView;

    constructor(
        private readonly _extensionUri: vscode.Uri,
    ) { }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                this._extensionUri
            ]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // Send initial config to webview
        const config = loadConfig();
        webviewView.webview.postMessage({
            command: 'initialize',
            config: { enableEmbeddings: config.enableEmbeddings }
        });

        webviewView.webview.onDidReceiveMessage(async data => {
            switch (data.command) {
                case 'searchKeyword':
                    await this.performSearch(data.query, 'keyword');
                    break;
                case 'searchSemantic':
                    await this.performSearch(data.query, 'semantic');
                    break;
                case 'openRepairRef':
                    await this.fetchRepairRef(data.id);
                    break;
            }
        });
    }

    private async performSearch(query: string, mode: 'keyword' | 'semantic') {
        if (!this._view) { return; }

        this._view.webview.postMessage({ command: 'searchStarted' });

        let scriptName = 'query_reasoning_json.py';
        if (mode === 'semantic') {
            scriptName = 'query_reasoning_semantic.py';
        }

        const result = await runPythonScript(scriptName, ['--query', query]);

        if (result.success && result.output) {
            try {
                const response = JSON.parse(result.output);
                if (response.success) {
                    this._view.webview.postMessage({
                        command: 'searchResults',
                        results: response.results
                    });
                } else {
                    this._view.webview.postMessage({
                        command: 'searchError',
                        error: response.error
                    });
                }
            } catch (e) {
                this._view.webview.postMessage({
                    command: 'searchError',
                    error: "Failed to parse search results"
                });
            }
        } else {
            this._view.webview.postMessage({
                command: 'searchError',
                error: result.error || "Search script failed"
            });
        }
    }

    private async fetchRepairRef(id: number) {
        if (!this._view) { return; }

        const result = await runPythonScript('get_reasoning_by_id.py', ['--id', id.toString()]);

        if (result.success && result.output) {
            try {
                const response = JSON.parse(result.output);
                if (response.success) {
                    this._view.webview.postMessage({
                        command: 'repairRefResult',
                        result: response.result
                    });
                } else {
                    vscode.window.showErrorMessage(`Repair Ref #${id} not found.`);
                }
            } catch (e) {
                console.error("Failed to parse get_by_id response", e);
            }
        } else {
            vscode.window.showErrorMessage(`Failed to fetch Repair Ref #${id}: ${result.error}`);
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        const htmlPath = path.join(this._extensionUri.fsPath, 'src', 'sidebar', 'webview.html');
        let htmlContent = fs.readFileSync(htmlPath, 'utf8');
        return htmlContent;
    }
}
