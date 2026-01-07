import { ValidationResult } from './types';
export declare function safeJsonParse(jsonString: string, context?: string): any;
/**
 * Validate if a string is a valid HTTP/HTTPS URL
 */
export declare function validateUrl(url: string): boolean;
/**
 * Validate if a JSON string is a valid ComfyUI API format workflow
 */
export declare function validateComfyUIWorkflow(workflowJson: string): ValidationResult;
//# sourceMappingURL=validation.d.ts.map