import * as cp from 'child_process';
import * as path from 'path';
import * as vscode from 'vscode';
import { getConfigPath } from '../config';

export interface PythonResult {
    success: boolean;
    output?: string;
    error?: string;
}

let outputChannel: vscode.OutputChannel | undefined;
let _extensionPath: string | undefined;

export function setOutputChannel(channel: vscode.OutputChannel) {
    outputChannel = channel;
}

export function setExtensionPath(path: string) {
    _extensionPath = path;
}

export async function runPythonScript(scriptNameOrCommand: string, args: string[]): Promise<PythonResult> {
    // Allow running direct python commands (e.g. --version) if scriptName starts with --
    // Otherwise assume it's a script in the scripts/ directory
    let pythonArgs: string[] = [];

    if (scriptNameOrCommand.startsWith('--')) {
        pythonArgs = [scriptNameOrCommand, ...args];
    } else {
        if (!_extensionPath) {
            return { success: false, error: "Extension path not set. Call setExtensionPath() first." };
        }
        const scriptPath = path.join(_extensionPath, 'scripts', scriptNameOrCommand);
        const configPath = getConfigPath();

        pythonArgs = [scriptPath, ...args];
        if (configPath) {
            pythonArgs.push('--config', configPath);
        }
    }

    if (outputChannel) {
        outputChannel.appendLine(`Running python: ${pythonArgs.join(' ')}`);
    }

    return new Promise((resolve) => {
        // Assume 'python' is in PATH.
        const pythonProcess = cp.spawn('python', pythonArgs);

        let stdout = '';
        let stderr = '';

        pythonProcess.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        pythonProcess.on('close', (code) => {
            if (outputChannel) {
                outputChannel.appendLine(`Exited with code ${code}`);
                if (stderr) outputChannel.appendLine(`Stderr: ${stderr}`);
                if (stdout) outputChannel.appendLine(`Stdout: ${stdout}`);
            }

            if (code === 0) {
                resolve({ success: true, output: stdout.trim() });
            } else {
                resolve({ success: false, error: stderr || stdout || `Exited with code ${code}` });
            }
        });

        pythonProcess.on('error', (err) => {
            if (outputChannel) {
                outputChannel.appendLine(`Failed to start python: ${err.message}`);
            }
            resolve({ success: false, error: `Failed to start python: ${err.message}` });
        });
    });
}
