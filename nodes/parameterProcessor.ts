/**
 * Parameter Processor V2 - Refactored version with modular design
 *
 * This is the main coordinator that delegates to specialized processors:
 * - ImageProcessor: Handles image parameters (URL and binary)
 * - ParameterTypeHandler: Handles different parameter types
 *
 * Based on feishu-lark's modular architecture approach
 */

import { IExecuteFunctions, NodeOperationError } from 'n8n-workflow';
import { NodeParameterConfig, Workflow } from './types';
import { safeJsonParse } from './validation';
import { Logger } from './logger';
import { ImageProcessor } from './processors/ImageProcessor';
import { ParameterTypeHandler } from './processors/ParameterTypeHandler';

export interface ParameterProcessorConfig {
  executeFunctions: IExecuteFunctions;
  logger: Logger;
  isToolMode?: boolean;
}

/**
 * Configuration object for processing node parameters
 * Replaces multiple parameters with a single config object
 */
export interface ProcessParametersConfig {
  nodeParametersInput: { nodeParameter?: NodeParameterConfig[] };
  workflow: Workflow;
  uploadImage: (buffer: Buffer, filename: string) => Promise<string>;
  timeout: number;
}

/**
 * Main parameter processor that coordinates all parameter processing
 */
export class ParameterProcessor {
  private executeFunctions: IExecuteFunctions;
  private logger: Logger;
  private isToolMode: boolean;
  private imageProcessor: ImageProcessor;
  private typeHandler: ParameterTypeHandler;

  constructor(config: ParameterProcessorConfig) {
    this.executeFunctions = config.executeFunctions;
    this.logger = config.logger;
    this.isToolMode = config.isToolMode ?? false;

    // Initialize specialized processors
    this.imageProcessor = new ImageProcessor({
      executeFunctions: this.executeFunctions,
      logger: this.logger,
      isToolMode: this.isToolMode,
    });

    this.typeHandler = new ParameterTypeHandler({
      executeFunctions: this.executeFunctions,
      logger: this.logger,
      imageProcessor: this.imageProcessor,
    });
  }

  /**
   * Process multiple node parameters and apply them to the workflow
   *
   * @param config - Configuration object containing all processing parameters
   */
  async processNodeParameters(config: ProcessParametersConfig): Promise<void> {
    const { nodeParametersInput, workflow, uploadImage, timeout } = config;

    if (!nodeParametersInput?.nodeParameter || !Array.isArray(nodeParametersInput.nodeParameter)) {
      this.logger.debug('No node parameters to process');
      return;
    }

    this.logger.debug(`Processing ${nodeParametersInput.nodeParameter.length} node parameter overrides`);

    for (const [index, paramConfig] of nodeParametersInput.nodeParameter.entries()) {
      await this.processSingleParameter(paramConfig, index, workflow, uploadImage, timeout);
    }

    this.logger.debug('Completed processing all node parameters');
  }

  /**
   * Process a single node parameter configuration
   */
  private async processSingleParameter(
    config: NodeParameterConfig,
    index: number,
    workflow: Workflow,
    uploadImage: (buffer: Buffer, filename: string) => Promise<string>,
    timeout: number
  ): Promise<void> {
    const {
      nodeId,
      parameterMode = 'single',
      parametersJson,
      paramName,
      type = 'text',
      imageSource = 'binary',
      value = '',
      numberValue = 0,
      booleanValue = 'false',
      imageUrl = '',
    } = config;

    // Validate node exists in workflow
    this.validateNodeExists(nodeId, index, workflow);

    // Ensure inputs object exists
    if (!workflow[nodeId].inputs) {
      workflow[nodeId].inputs = {};
    }

    // Process based on parameter mode
    if (parameterMode === 'multiple' && parametersJson) {
      await this.processMultipleParameters(nodeId, parametersJson, index, workflow);
    } else if (parameterMode === 'single' && paramName) {
      await this.processSingleParameterMode({
        nodeId,
        paramName,
        type,
        value,
        numberValue,
        booleanValue,
        imageSource,
        imageUrl,
        index,
        workflow,
        uploadImage,
        timeout,
      });
    } else {
      throw new NodeOperationError(
        this.executeFunctions.getNode(),
        `Node Parameters ${index + 1}: Invalid configuration. For Multiple Parameters mode, provide Parameters JSON. For Single Parameter mode, provide Parameter Name and Value.`
      );
    }
  }

  /**
   * Validate that a node exists in the workflow
   */
  private validateNodeExists(nodeId: string, index: number, workflow: Workflow): void {
    if (!nodeId) {
      throw new NodeOperationError(
        this.executeFunctions.getNode(),
        `Node Parameters ${index + 1} is missing Node ID.`
      );
    }

    if (!workflow[nodeId]) {
      throw new NodeOperationError(
        this.executeFunctions.getNode(),
        `Node ID "${nodeId}" not found in workflow. Please check your workflow JSON.`
      );
    }
  }

  /**
   * Process multiple parameters from JSON with type validation
   */
  private async processMultipleParameters(
    nodeId: string,
    parametersJson: string,
    index: number,
    workflow: Workflow
  ): Promise<void> {
    let parameters: Record<string, unknown>;

    try {
      parameters = safeJsonParse(parametersJson, `Node Parameters ${index + 1}`) as Record<string, unknown>;
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      throw new NodeOperationError(this.executeFunctions.getNode(), `Node Parameters ${index + 1}: ${errorMsg}`);
    }

    if (typeof parameters !== 'object' || parameters === null) {
      throw new NodeOperationError(
        this.executeFunctions.getNode(),
        `Node Parameters ${index + 1}: Parameters must be a JSON object`
      );
    }

    // Validate parameter types
    this.validateParameterTypes(parameters, nodeId, index);

    this.logger.debug(`Applying multiple parameters to node ${nodeId}`, { parameters });

    // Apply all parameters to the workflow node
    for (const [key, val] of Object.entries(parameters)) {
      workflow[nodeId].inputs[key] = val;
    }
  }

  /**
   * Validate types of parameters
   * Ensures only safe types are passed to ComfyUI
   */
  private validateParameterTypes(
    parameters: Record<string, unknown>,
    nodeId: string,
    index: number
  ): void {
    const allowedTypes = ['string', 'number', 'boolean', 'object', 'bigint'];

    for (const [key, value] of Object.entries(parameters)) {
      const type = typeof value;

      // Reject undefined and function types
      if (type === 'undefined' || type === 'function' || type === 'symbol') {
        throw new NodeOperationError(
          this.executeFunctions.getNode(),
          `Node Parameters ${index + 1}: Invalid parameter type "${type}" for "${key}". ` +
          `Allowed types: ${allowedTypes.join(', ')}`
        );
      }

      // Warn about object types (might be intentional, but log it)
      if (type === 'object' && value !== null && !Array.isArray(value)) {
        this.logger.warn(`Parameter "${key}" in node "${nodeId}" is an object - ensure this is intentional`);
      }
    }
  }

  /**
   * Process single parameter based on its type
   */
  private async processSingleParameterMode(config: {
    nodeId: string;
    paramName: string;
    type: string;
    value: string;
    numberValue: number;
    booleanValue: string | boolean;
    imageSource: string;
    imageUrl: string;
    index: number;
    workflow: Workflow;
    uploadImage: (buffer: Buffer, filename: string) => Promise<string>;
    timeout: number;
  }): Promise<void> {
    const {
      nodeId,
      paramName,
      type,
      value,
      numberValue,
      booleanValue,
      imageSource,
      imageUrl,
      index,
      workflow,
      uploadImage,
      timeout,
    } = config;

    if (!type) {
      throw new NodeOperationError(
        this.executeFunctions.getNode(),
        `Node Parameters ${index + 1}: Type is required for single parameter mode.`
      );
    }

    // Delegate to type handler
    const parsedValue = await this.typeHandler.processByType({
      type,
      nodeId,
      paramName,
      value,
      numberValue,
      booleanValue,
      imageSource,
      imageUrl,
      index,
      uploadImage,
      timeout,
    });

    // Apply to workflow
    workflow[nodeId].inputs[paramName] = parsedValue;

    this.logger.debug(`Applied single parameter to node ${nodeId}`, {
      paramName,
      value: parsedValue
    });
  }
}

// Export the new version as default for backward compatibility
export { ParameterProcessor as default };
