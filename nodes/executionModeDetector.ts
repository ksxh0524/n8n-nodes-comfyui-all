/**
 * Execution Mode Detector - Simplified mode detection for ComfyUI node
 *
 * Based on feishu-lark architecture, this uses a simplified declarative approach
 * rather than complex multi-dimensional scoring.
 *
 * Key principle: Rely on n8n's built-in `usableAsTool: true` framework
 * and only perform minimal essential detection.
 */

import type { INodeExecutionData } from 'n8n-workflow';

/**
 * Execution mode options
 */
export type ExecutionMode = 'tool' | 'workflow';

/**
 * Detection result - simplified version without complex scoring
 */
export interface DetectionResult {
  mode: ExecutionMode;
  reason: string;
}

/**
 * Check if the execution is from an AI Agent
 * This is the only essential check needed - n8n handles the rest
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

  // Check for AI Agent context markers
  return 'aiAgentContext' in json ||
         'conversationId' in json ||
         'toolCallId' in json ||
         'isToolCall' in json;
}

/**
 * Detect execution mode - Simplified version
 *
 * Priority:
 * 1. AI Agent markers → Tool mode (for AI Agent consumption)
 * 2. Otherwise → Workflow mode (for regular workflow execution)
 *
 * @param inputData - Input data from n8n
 * @returns Detection result with mode and reason
 */
export function detectExecutionMode(inputData: INodeExecutionData[]): DetectionResult {
  // Primary check: AI Agent call
  if (isFromAiAgent(inputData)) {
    return {
      mode: 'tool',
      reason: '检测到 AI Agent 调用，使用 Tool 模式（返回 URL）',
    };
  }

  // Default: Workflow mode
  return {
    mode: 'workflow',
    reason: '默认 Workflow 模式（返回完整二进制数据）',
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
    hasBinaryData: hasBinaryData(inputData),
    hasInputData: !!(inputData[0]?.json && Object.keys(inputData[0].json).length > 0),
  };
}
