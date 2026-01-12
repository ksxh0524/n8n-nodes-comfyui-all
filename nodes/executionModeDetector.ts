/**
 * Execution Mode Detector - Simplified mode detection for ComfyUI node
 *
 * Based on feishu-lark architecture, this uses a simplified declarative approach
 * rather than complex multi-dimensional scoring.
 *
 * Key principle: Rely on n8n's built-in `usableAsTool: true` framework
 * and only perform minimal essential detection.
 *
 * Detection Priority:
 * 1. Check n8n context.mode (primary method if available)
 * 2. Check AI Agent context markers (fallback)
 * 3. Default to action mode
 */

import type { INodeExecutionData } from 'n8n-workflow';

/**
 * Execution mode options
 * - 'tool': Called by AI Agent, returns URLs only
 * - 'action': Regular workflow execution, returns full binary data
 */
export type ExecutionMode = 'tool' | 'action';

/**
 * Detection result - simplified version without complex scoring
 */
export interface DetectionResult {
  mode: ExecutionMode;
  reason: string;
  source: 'context' | 'input-data' | 'default';
}

/**
 * Check if the execution is from an AI Agent using n8n context
 * This is the primary and most reliable method
 *
 * @param context - n8n execution context (optional)
 * @returns True if called from AI Agent based on context
 */
function isFromAiAgentByContext(context: unknown): boolean {
  if (!context || typeof context !== 'object') {
    return false;
  }

  // Check for n8n's built-in mode detection
  const ctx = context as Record<string, unknown>;

  // n8n may provide context.mode in newer versions
  if (ctx.mode === 'tool' || ctx.mode === 'aiAgent') {
    return true;
  }

  // Check for AI Agent execution context
  if (ctx.aiAgentContext) {
    return true;
  }

  return false;
}

/**
 * Check if the execution is from an AI Agent using input data
 * This is a fallback method when context is not available
 *
 * @param inputData - Input data from n8n
 * @returns True if called from AI Agent
 */
function isFromAiAgent(inputData: INodeExecutionData[]): boolean {
  if (!inputData || inputData.length === 0) {
    return false;
  }

  const json = inputData[0]?.json;
  if (!json) {
    return false;
  }

  // Check for AI Agent context markers in input data
  return 'aiAgentContext' in json ||
         'conversationId' in json ||
         'toolCallId' in json ||
         'isToolCall' in json;
}

/**
 * Detect execution mode - Simplified version with fallback mechanism
 *
 * Priority:
 * 1. n8n context.mode → Tool mode (primary, most reliable)
 * 2. AI Agent markers in input data → Tool mode (fallback)
 * 3. Otherwise → Action mode (default)
 *
 * @param inputData - Input data from n8n
 * @param context - Optional n8n execution context
 * @returns Detection result with mode, reason, and source
 */
export function detectExecutionMode(
  inputData: INodeExecutionData[],
  context?: unknown
): DetectionResult {
  // Primary check: n8n context (most reliable)
  if (context && isFromAiAgentByContext(context)) {
    return {
      mode: 'tool',
      reason: '检测到 n8n AI Agent 上下文，使用 Tool 模式（返回 URL）',
      source: 'context',
    };
  }

  // Fallback check: AI Agent markers in input data
  if (isFromAiAgent(inputData)) {
    return {
      mode: 'tool',
      reason: '检测到 AI Agent 调用标记，使用 Tool 模式（返回 URL）',
      source: 'input-data',
    };
  }

  // Default: Action mode
  return {
    mode: 'action',
    reason: '默认 Action 模式（返回完整二进制数据）',
    source: 'default',
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
    hasBinaryData: hasBinaryData(inputData),
    hasInputData: !!(inputData[0]?.json && Object.keys(inputData[0].json).length > 0),
  };
}
