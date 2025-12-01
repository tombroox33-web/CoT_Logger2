import * as vscode from 'vscode';
import { ReasoningLogProvider } from './sidebar/provider';
import { logReasoningCommand } from './commands/logReasoning';
import { configureCommand } from './commands/configure';
import { runPythonScript, setOutputChannel, setExtensionPath } from './python/runner';
import { logFromClipboardCommand, toggleClipboardWatcherCommand } from './commands/clipboardLogger';
import { FileTracker } from './trackers/fileTracker';

export async function activate(context: vscode.ExtensionContext) {
	const outputChannel = vscode.window.createOutputChannel("Reasoning Logger");
	setOutputChannel(outputChannel);
	setExtensionPath(context.extensionPath);
	outputChannel.appendLine('Reasoning Logger is activating...');

	// Start File Tracker
	FileTracker.getInstance().startWatching(context);

	// Check for Python availability
	const pythonCheck = await runPythonScript('--version', []);
	if (!pythonCheck.success) {
		const message = 'Reasoning Logger requires Python. Please install Python 3.8+ and add to PATH.';
		outputChannel.appendLine(`Python check failed: ${pythonCheck.error}`);
		vscode.window.showErrorMessage(message, 'Learn More').then(selection => {
			if (selection === 'Learn More') {
				vscode.env.openExternal(vscode.Uri.parse('https://www.python.org/downloads/'));
			}
		});
		return; // Early exit
	}

	// Initialize DB
	runPythonScript('init_db.py', []).then(result => {
		if (!result.success) {
			outputChannel.appendLine(`Failed to initialize DB: ${result.error}`);
			vscode.window.showErrorMessage(`Reasoning Logger DB Init Failed: ${result.error}`);
		} else {
			outputChannel.appendLine(`DB Initialized: ${result.output}`);
		}
	});

	const provider = new ReasoningLogProvider(context.extensionUri);

	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(ReasoningLogProvider.viewType, provider)
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('reasoning-logger.logReasoning', () => logReasoningCommand())
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('reasoning-logger.configure', () => configureCommand())
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('reasoning-logger.logFromClipboard', () => logFromClipboardCommand())
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('reasoning-logger.toggleClipboardWatcher', () => toggleClipboardWatcherCommand())
	);
}

export function deactivate() { }
