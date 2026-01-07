/**
 * ComfyUI Workflow Parser
 * Parses API-format ComfyUI workflows and extracts configurable input parameters
 */
type NodePropertyType = 'string' | 'number' | 'boolean' | 'options' | 'any';
export interface WorkflowNode {
    inputs?: Record<string, any>;
    class_type: string;
    _meta?: Record<string, any>;
}
export interface ComfyUIWorkflow {
    [nodeId: string]: WorkflowNode;
}
export interface ParsedWorkflowInput {
    nodeId: string;
    nodeTitle: string;
    classType: string;
    parameterName: string;
    parameterType: NodePropertyType;
    defaultValue?: any;
    required: boolean;
    description?: string;
    options?: Array<{
        name: string;
        value: any;
    }>;
    isImage?: boolean;
    isText?: boolean;
    isNumber?: boolean;
    isSeed?: boolean;
}
export interface ParsedWorkflowResult {
    valid: boolean;
    error?: string;
    inputs: ParsedWorkflowInput[];
    workflow: ComfyUIWorkflow;
}
/**
 * Parse ComfyUI workflow and extract all configurable input parameters
 */
export declare function parseWorkflowInputs(workflowJson: string): ParsedWorkflowResult;
/**
 * Update workflow with user input values
 */
export declare function updateWorkflowWithInputs(workflow: ComfyUIWorkflow, inputValues: Record<string, unknown>): ComfyUIWorkflow;
/**
 * Generate node-friendly parameter name
 */
export declare function generateParameterKey(nodeId: string, paramName: string): string;
export {};
//# sourceMappingURL=workflow-parser.d.ts.map