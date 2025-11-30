export interface AgentOutput {
    diff: string;
    reasoning: string;
    repair_ref: number[];
    file?: string;
}

export interface ValidationResult {
    valid: boolean;
    error?: string;
}

export function validateAgentOutput(json: any): ValidationResult {
    if (!json) {
        return { valid: false, error: "Input is empty" };
    }

    if (typeof json.diff !== 'string') {
        return { valid: false, error: "Missing or invalid field: 'diff' must be a string" };
    }

    if (typeof json.reasoning !== 'string') {
        return { valid: false, error: "Missing or invalid field: 'reasoning' must be a string" };
    }

    if (!Array.isArray(json.repair_ref)) {
        return { valid: false, error: "Missing or invalid field: 'repair_ref' must be an array of numbers" };
    }

    if (!json.repair_ref.every((id: any) => typeof id === 'number')) {
        return { valid: false, error: "Invalid field: 'repair_ref' must contain only numbers" };
    }

    return { valid: true };
}
