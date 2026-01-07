import { ComfyUIWorkflow, WorkflowOptions } from './types';
/**
 * Build a text-to-image workflow
 */
export declare function buildTextToImageWorkflow(prompt: string, negativePrompt: string | undefined, options?: WorkflowOptions): ComfyUIWorkflow;
/**
 * Build an image-to-image workflow
 */
export declare function buildImageToImageWorkflow(prompt: string, negativePrompt: string | undefined, image: string, options?: WorkflowOptions): ComfyUIWorkflow;
/**
 * Build an image edit workflow
 */
export declare function buildImageEditWorkflow(prompt: string, negativePrompt: string | undefined, image: string, options?: WorkflowOptions): ComfyUIWorkflow;
/**
 * Build a text-to-video workflow
 */
export declare function buildTextToVideoWorkflow(prompt: string, negativePrompt: string | undefined, options?: WorkflowOptions): ComfyUIWorkflow;
/**
 * Build an image-to-video workflow
 */
export declare function buildImageToVideoWorkflow(prompt: string, negativePrompt: string | undefined, image: string, options?: WorkflowOptions): ComfyUIWorkflow;
//# sourceMappingURL=workflow-builder.d.ts.map