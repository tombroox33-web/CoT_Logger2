import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export interface Config {
    enableEmbeddings: boolean;
    embedderModel: string;
    dbPath: string;
}

export const DEFAULT_CONFIG: Config = {
    enableEmbeddings: false,
    embedderModel: "all-MiniLM-L6-v2",
    dbPath: "reasoning_logs.db"
};

export function getConfigPath(): string | undefined {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        return undefined;
    }
    return path.join(workspaceFolders[0].uri.fsPath, 'reasoning-logger.json');
}

export function loadConfig(): Config {
    const configPath = getConfigPath();
    if (!configPath || !fs.existsSync(configPath)) {
        return DEFAULT_CONFIG;
    }

    try {
        const fileContent = fs.readFileSync(configPath, 'utf8');
        const userConfig = JSON.parse(fileContent);
        return { ...DEFAULT_CONFIG, ...userConfig };
    } catch (error) {
        console.error('Error loading reasoning-logger.json:', error);
        return DEFAULT_CONFIG;
    }
}
