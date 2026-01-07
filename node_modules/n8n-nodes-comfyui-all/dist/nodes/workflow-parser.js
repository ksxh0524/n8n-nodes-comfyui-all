"use strict";
/**
 * ComfyUI Workflow Parser
 * Parses API-format ComfyUI workflows and extracts configurable input parameters
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseWorkflowInputs = parseWorkflowInputs;
exports.updateWorkflowWithInputs = updateWorkflowWithInputs;
exports.generateParameterKey = generateParameterKey;
const validation_1 = require("./validation");
/**
 * Node type configuration mapping
 * Defines how to handle different types of ComfyUI nodes
 */
const NODE_TYPE_CONFIGS = {
    LoadImage: {
        title: 'Image Input',
        inputs: {
            image: {
                type: 'string',
                required: true,
                isImage: true,
                description: 'Input image URL or base64 data',
            },
        },
    },
    KSampler: {
        title: 'Sampler Parameters',
        inputs: {
            seed: {
                type: 'number',
                required: false,
                isSeed: true,
                isNumber: true,
                description: 'Random seed (leave empty for auto-generate)',
            },
            steps: {
                type: 'number',
                required: false,
                isNumber: true,
                description: 'Sampling steps',
            },
            cfg: {
                type: 'number',
                required: false,
                isNumber: true,
                description: 'CFG strength',
            },
            sampler_name: {
                type: 'options',
                required: false,
                options: [
                    { name: 'Euler', value: 'euler' },
                    { name: 'Euler_ancestral', value: 'euler_ancestral' },
                    { name: 'Heun', value: 'heun' },
                    { name: 'Dpm_2', value: 'dpm_2' },
                    { name: 'Dpm_2_ancestral', value: 'dpm_2_ancestral' },
                    { name: 'Lms', value: 'lms' },
                    { name: 'Ddim', value: 'ddim' },
                    { name: 'Uni_pc', value: 'uni_pc' },
                ],
                description: 'Sampler type',
            },
            scheduler: {
                type: 'options',
                required: false,
                options: [
                    { name: 'Normal', value: 'normal' },
                    { name: 'Karras', value: 'karras' },
                    { name: 'Exponential', value: 'exponential' },
                    { name: 'Sgm_uniform', value: 'sgm_uniform' },
                    { name: 'Simple', value: 'simple' },
                    { name: 'Ddim_uniform', value: 'ddim_uniform' },
                ],
                description: 'Scheduler type',
            },
            denoise: {
                type: 'number',
                required: false,
                isNumber: true,
                description: 'Denoise strength (0-1)',
            },
        },
    },
    CheckpointLoaderSimple: {
        title: 'Model Loader',
        inputs: {
            ckpt_name: {
                type: 'string',
                required: false,
                description: 'Model filename (e.g., v1-5-pruned-emaonly.ckpt)',
            },
        },
    },
    LoraLoader: {
        title: 'LoRA Loader',
        inputs: {
            lora_name: {
                type: 'string',
                required: false,
                description: 'LoRA model filename',
            },
            strength_model: {
                type: 'number',
                required: false,
                isNumber: true,
                description: 'LoRA strength (model)',
            },
            strength_clip: {
                type: 'number',
                required: false,
                isNumber: true,
                description: 'LoRA strength (CLIP)',
            },
        },
    },
    CLIPTextEncode: {
        title: 'Text Encoding',
        inputs: {
            text: {
                type: 'string',
                required: true,
                isText: true,
                description: 'Text prompt',
            },
        },
    },
    EmptyLatentImage: {
        title: 'Latent Image Size',
        inputs: {
            width: {
                type: 'number',
                required: false,
                isNumber: true,
                description: 'Image width',
            },
            height: {
                type: 'number',
                required: false,
                isNumber: true,
                description: 'Image height',
            },
            batch_size: {
                type: 'number',
                required: false,
                isNumber: true,
                description: 'Batch size',
            },
        },
    },
    VAEEncode: {
        title: 'VAE Encode',
        inputs: {},
    },
    VAEDecode: {
        title: 'VAE Decode',
        inputs: {},
    },
    SaveImage: {
        title: 'Save Image',
        inputs: {
            filename_prefix: {
                type: 'string',
                required: false,
                description: 'Output filename prefix',
            },
        },
    },
};
/**
 * Parse ComfyUI workflow and extract all configurable input parameters
 */
function parseWorkflowInputs(workflowJson) {
    // First validate the workflow
    const validation = (0, validation_1.validateComfyUIWorkflow)(workflowJson);
    if (!validation.valid) {
        return {
            valid: false,
            error: validation.error,
            inputs: [],
            workflow: {},
        };
    }
    try {
        const workflow = JSON.parse(workflowJson);
        const inputs = [];
        // Iterate through all nodes
        for (const [nodeId, node] of Object.entries(workflow)) {
            const classType = node.class_type;
            const nodeConfig = NODE_TYPE_CONFIGS[classType];
            // If this node type has a configuration definition
            if (nodeConfig) {
                const nodeInputs = nodeConfig.inputs;
                // Iterate through node input parameters
                for (const [paramName, paramConfig] of Object.entries(nodeInputs)) {
                    const config = paramConfig;
                    // Check if this parameter is defined in the workflow
                    const hasInputValue = node.inputs &&
                        paramName in node.inputs &&
                        !Array.isArray(node.inputs[paramName]); // Exclude node connections [nodeId, slotIndex]
                    inputs.push({
                        nodeId,
                        nodeTitle: `${nodeConfig.title} (${nodeId})`,
                        classType,
                        parameterName: paramName,
                        parameterType: config.type,
                        defaultValue: hasInputValue ? node.inputs[paramName] : config.defaultValue,
                        required: config.required ?? false,
                        description: config.description,
                        options: config.options,
                        isImage: config.isImage ?? false,
                        isText: config.isText ?? false,
                        isNumber: config.isNumber ?? false,
                        isSeed: config.isSeed ?? false,
                    });
                }
            }
        }
        return {
            valid: true,
            inputs,
            workflow,
        };
    }
    catch (error) {
        return {
            valid: false,
            error: `Failed to parse workflow: ${error.message}`,
            inputs: [],
            workflow: {},
        };
    }
}
/**
 * Update workflow with user input values
 */
function updateWorkflowWithInputs(workflow, inputValues) {
    const updatedWorkflow = JSON.parse(JSON.stringify(workflow)); // Deep copy
    // inputValues format: "nodeId_parameterName" -> value
    for (const [key, value] of Object.entries(inputValues)) {
        const [nodeId, paramName] = key.split('_');
        const node = updatedWorkflow[nodeId];
        if (node && node.inputs !== undefined) {
            // Update if value is not empty
            if (value !== null && value !== undefined && value !== '') {
                node.inputs[paramName] = value;
            }
        }
    }
    return updatedWorkflow;
}
/**
 * Generate node-friendly parameter name
 */
function generateParameterKey(nodeId, paramName) {
    return `${nodeId}_${paramName}`;
}
//# sourceMappingURL=workflow-parser.js.map