"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateUrl = validateUrl;
exports.validateComfyUIWorkflow = validateComfyUIWorkflow;
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
        workflow = JSON.parse(workflowJson);
    }
    catch (error) {
        return {
            valid: false,
            error: `Invalid JSON: ${error.message}`,
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