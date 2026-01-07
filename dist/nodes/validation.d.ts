import { ValidationResult, NetworkAddressInfo } from './types';
/**
 * Validate if a string is a valid HTTP/HTTPS URL
 */
export declare function validateUrl(url: string): boolean;
/**
 * Check if a URL points to a private network address (SSRF protection)
 * Note: localhost/127.0.0.1 is allowed for local development
 */
export declare function isPrivateNetworkAddress(url: string): boolean;
/**
 * Get network address information for a URL
 */
export declare function getNetworkAddressInfo(url: string): NetworkAddressInfo;
/**
 * Validate and sanitize image input (check size if base64)
 */
export declare function validateImageInput(image: string): ValidationResult;
/**
 * Validate if a JSON string is a valid ComfyUI API format workflow
 */
export declare function validateComfyUIWorkflow(workflowJson: string): ValidationResult;
//# sourceMappingURL=validation.d.ts.map