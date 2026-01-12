/**
 * Execution Mode Detector - Enhanced multi-layer detection for ComfyUI node
 *
 * Detection Strategy (in priority order):
 * 1. Native n8n API: isToolExecution() (most reliable)
 * 2. Execution context mode: "chat" mode
 * 3. AI Agent metadata markers in input data
 * 4. Heuristics based on input characteristics
 * 5. Default to action mode
 *
 * This combines official n8n APIs with intelligent fallbacks
 */

import type { INodeExecutionData, IExecuteFunctions } from 'n8n-workflow';

/**
 * Execution mode options
 * - 'tool': Called by AI Agent, returns URLs only
 * - 'action': Regular workflow execution, returns full binary data
 */
export type ExecutionMode = 'tool' | 'action';

/**
 * Detection result with detailed reasoning
 */
export interface DetectionResult {
  mode: ExecutionMode;
  reason: string;
  source: 'n8n-api' | 'execution-context' | 'input-data' | 'heuristics' | 'default';
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Check if executed as AI Agent tool using n8n's native API
 * This is the MOST reliable method if available
 *
 * @param executeFunctions - n8n execute functions
 * @returns True if called as AI Agent tool
 */
function isToolExecutionByApi(executeFunctions: IExecuteFunctions): boolean {
  // Check if isToolExecution method exists and call it
  if (typeof executeFunctions.isToolExecution === 'function') {
    try {
      return executeFunctions.isToolExecution();
    } catch (error) {
      // Method exists but failed, fall through to other checks
      return false;
    }
  }
  return false;
}

/**
 * Check execution context for AI Agent indicators
 *
 * @param executeFunctions - n8n execute functions
 * @returns True if execution context indicates AI Agent
 */
function isToolExecutionByContext(executeFunctions: IExecuteFunctions): boolean {
  // Check execution mode
  if (typeof executeFunctions.getMode === 'function') {
    try {
      const mode = executeFunctions.getMode();
      // "chat" mode indicates AI Agent/Chat execution
      if (mode === 'chat') {
        return true;
      }
    } catch (error) {
      // Continue to other checks
    }
  }

  // Check execution context
  if (typeof executeFunctions.getExecutionContext === 'function') {
    try {
      const context = executeFunctions.getExecutionContext();
      if (context && 'source' in context && context.source === 'chat') {
        return true;
      }
    } catch (error) {
      // Continue to other checks
    }
  }

  return false;
}

/**
 * Check for AI Agent metadata markers in input data
 *
 * @param inputData - Input data from n8n
 * @returns True if AI Agent markers found
 */
function isFromAiAgentByMetadata(inputData: INodeExecutionData[]): boolean {
  if (!inputData || inputData.length === 0) {
    return false;
  }

  const json = inputData[0]?.json;
  if (!json) {
    return false;
  }

  // Check for AI Agent context markers
  return 'aiAgentContext' in json ||
         'conversationId' in json ||
         'toolCallId' in json ||
         'isToolCall' in json;
}

/**
 * Heuristic detection based on input characteristics
 * Uses pattern matching to guess execution mode
 *
 * @param inputData - Input data from n8n
 * @returns Detection result based on heuristics
 */
function detectByHeuristics(inputData: INodeExecutionData[]): DetectionResult | null {
  if (!inputData || inputData.length === 0) {
    return null;
  }

  const json = inputData[0]?.json;
  const binary = inputData[0]?.binary;

  // Tool mode indicators
  const toolIndicators = {
    hasUrl: json && 'imageUrl' in json,
    hasText: json && 'text' in json,
    hasPrompt: json && 'prompt' in json,
    noBinary: !binary || Object.keys(binary).length === 0,
    simpleStructure: json && Object.keys(json).length <= 5,
  };

  // Action mode indicators
  const actionIndicators = {
    hasBinary: binary && Object.keys(binary).length > 0,
    hasComplexData: json && Object.values(json).some(v =>
      typeof v === 'object' && v !== null && !Array.isArray(v)
    ),
    hasWorkflowData: json && ('workflow' in json || 'node' in json),
  };

  // Calculate scores
  let toolScore = 0;
  let actionScore = 0;

  if (toolIndicators.hasUrl) toolScore += 2;
  if (toolIndicators.hasText) toolScore += 1;
  if (toolIndicators.hasPrompt) toolScore += 1;
  if (toolIndicators.noBinary) toolScore += 1;
  if (toolIndicators.simpleStructure) toolScore += 1;

  if (actionIndicators.hasBinary) actionScore += 3;
  if (actionIndicators.hasComplexData) actionScore += 2;
  if (actionIndicators.hasWorkflowData) actionScore += 2;

  // Decision based on scores
  if (actionScore >= 3 || actionScore > toolScore) {
    return {
      mode: 'action',
      reason: `启发式检测：检测到工作流特征 (二进制数据: ${actionIndicators.hasBinary}, 复杂数据: ${actionIndicators.hasComplexData})`,
      source: 'heuristics',
      confidence: 'medium',
    };
  }

  if (toolScore >= 3 || toolScore > actionScore) {
    return {
      mode: 'tool',
      reason: `启发式检测：检测到 AI 工具特征 (URL输入: ${toolIndicators.hasUrl}, 无二进制: ${toolIndicators.noBinary})`,
      source: 'heuristics',
      confidence: 'medium',
    };
  }

  return null;
}

/**
 * Main detection function with multi-layer strategy
 *
 * @param inputData - Input data from n8n
 * @param executeFunctions - n8n execute functions (most reliable source)
 * @returns Detection result with mode, reason, source, and confidence
 */
export function detectExecutionMode(
  inputData: INodeExecutionData[],
  executeFunctions?: IExecuteFunctions
): DetectionResult {
  // Layer 1: Native n8n API (most reliable)
  if (executeFunctions) {
    if (isToolExecutionByApi(executeFunctions)) {
      return {
        mode: 'tool',
        reason: '检测到 AI Agent 工具调用 (n8n API: isToolExecution)',
        source: 'n8n-api',
        confidence: 'high',
      };
    }

    if (isToolExecutionByContext(executeFunctions)) {
      return {
        mode: 'tool',
        reason: '检测到 AI Agent 执行模式 (n8n context: chat mode)',
        source: 'execution-context',
        confidence: 'high',
      };
    }
  }

  // Layer 2: AI Agent metadata markers
  if (isFromAiAgentByMetadata(inputData)) {
    return {
      mode: 'tool',
      reason: '检测到 AI Agent 元数据标记',
      source: 'input-data',
      confidence: 'high',
    };
  }

  // Layer 3: Heuristics based on input characteristics
  const heuristicResult = detectByHeuristics(inputData);
  if (heuristicResult) {
    return heuristicResult;
  }

  // Layer 4: Default to action mode
  return {
    mode: 'action',
    reason: '默认 Action 模式（未检测到 AI Agent 特征）',
    source: 'default',
    confidence: 'low',
  };
}

/**
 * Check if binary data is present in input
 * Used for validation warnings
 *
 * @param inputData - Input data from n8n
 * @returns True if binary data is present
 */
export function hasBinaryData(inputData: INodeExecutionData[]): boolean {
  if (!inputData || inputData.length === 0) {
    return false;
  }

  return !!(inputData[0]?.binary && Object.keys(inputData[0].binary).length > 0);
}

/**
 * Get detection info for logging
 * Provides a simplified log output compared to the complex version
 *
 * @param result - Detection result
 * @param inputData - Input data for additional context
 * @returns Formatted log object
 */
export function getDetectionLog(result: DetectionResult, inputData: INodeExecutionData[]): Record<string, unknown> {
  return {
    mode: result.mode,
    reason: result.reason,
    source: result.source,
    confidence: result.confidence,
    hasBinaryData: hasBinaryData(inputData),
    hasInputData: !!(inputData[0]?.json && Object.keys(inputData[0].json).length > 0),
  };
}
