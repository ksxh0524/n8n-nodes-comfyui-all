"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.safeJsonParse = safeJsonParse;
exports.validateUrl = validateUrl;
exports.validateComfyUIWorkflow = validateComfyUIWorkflow;
const MAX_JSON_SIZE = 1 * 1024 * 1024;
const MAX_JSON_DEPTH = 100;
function getObjectDepth(obj, currentDepth = 1) {
    if (typeof obj !== 'object' || obj === null) {
        return currentDepth;
    }
    if (Array.isArray(obj)) {
        let maxDepth = currentDepth;
        for (const item of obj) {
            const depth = getObjectDepth(item, currentDepth + 1);
            if (depth > maxDepth) {
                maxDepth = depth;
            }
        }
        return maxDepth;
    }
    let maxDepth = currentDepth;
    for (const value of Object.values(obj)) {
        const depth = getObjectDepth(value, currentDepth + 1);
        if (depth > maxDepth) {
            maxDepth = depth;
        }
    }
    return maxDepth;
}
function safeJsonParse(jsonString, context = 'JSON') {
    if (typeof jsonString !== 'string') {
        throw new Error(`${context} must be a string`);
    }
    if (jsonString.length === 0) {
        throw new Error(`${context} is empty`);
    }
    if (jsonString.length > MAX_JSON_SIZE) {
        throw new Error(`${context} exceeds maximum size of ${MAX_JSON_SIZE / 1024 / 1024}MB (actual: ${(jsonString.length / 1024 / 1024).toFixed(2)}MB)`);
    }
    let parsed;
    try {
        parsed = JSON.parse(jsonString);
    }
    catch (error) {
        throw new Error(`${context} is invalid: ${error.message}`);
    }
    const depth = getObjectDepth(parsed);
    if (depth > MAX_JSON_DEPTH) {
        throw new Error(`${context} exceeds maximum depth of ${MAX_JSON_DEPTH} (actual: ${depth})`);
    }
    return parsed;
}
/**
 * Validate if a string is a valid HTTP/HTTPS URL
 */
function validateUrl(url) {
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    }
    catch {
        return false;
    }
}
/**
 * Validate if a JSON string is a valid ComfyUI API format workflow
 */
function validateComfyUIWorkflow(workflowJson) {
    if (!workflowJson || workflowJson.trim() === '') {
        return {
            valid: false,
            error: 'Workflow JSON is empty',
        };
    }
    let workflow;
    try {
        workflow = safeJsonParse(workflowJson, 'Workflow JSON');
    }
    catch (error) {
        return {
            valid: false,
            error: error.message,
        };
    }
    if (typeof workflow !== 'object' || workflow === null || Array.isArray(workflow)) {
        return {
            valid: false,
            error: 'Workflow must be an object with node IDs as keys',
        };
    }
    const nodeIds = Object.keys(workflow);
    if (nodeIds.length === 0) {
        return {
            valid: false,
            error: 'Workflow must contain at least one node',
        };
    }
    for (const nodeId of nodeIds) {
        const node = workflow[nodeId];
        if (typeof node !== 'object' || node === null) {
            return {
                valid: false,
                error: `Node ${nodeId} must be an object`,
            };
        }
        if (!node.class_type || typeof node.class_type !== 'string') {
            return {
                valid: false,
                error: `Node ${nodeId} must have a class_type property`,
            };
        }
        if (node.inputs !== undefined) {
            if (typeof node.inputs !== 'object' || node.inputs === null || Array.isArray(node.inputs)) {
                return {
                    valid: false,
                    error: `Node ${nodeId} inputs must be an object`,
                };
            }
        }
        if (node.widgets_values !== undefined) {
            if (!Array.isArray(node.widgets_values)) {
                return {
                    valid: false,
                    error: `Node ${nodeId} widgets_values must be an array`,
                };
            }
        }
    }
    return { valid: true };
}
//# sourceMappingURL=validation.js.map