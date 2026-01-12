/**
 * Tests for execution mode detector
 */

import { detectExecutionMode, hasBinaryData, getDetectionLog, DetectionResult } from '../nodes/executionModeDetector';
import type { INodeExecutionData } from 'n8n-workflow';

describe('executionModeDetector', () => {
  describe('detectExecutionMode', () => {
    it('should detect tool mode from AI Agent context', () => {
      const inputData: INodeExecutionData[] = [
        {
          json: {
            aiAgentContext: { conversationId: 'test-123' }
          }
        }
      ];

      const result = detectExecutionMode(inputData);

      expect(result.mode).toBe('tool');
      expect(result.source).toBe('input-data');
      expect(result.reason).toContain('AI Agent');
    });

    it('should detect tool mode from conversationId marker', () => {
      const inputData: INodeExecutionData[] = [
        {
          json: {
            conversationId: 'conv-456'
          }
        }
      ];

      const result = detectExecutionMode(inputData);

      expect(result.mode).toBe('tool');
      expect(result.source).toBe('input-data');
    });

    it('should detect tool mode from toolCallId marker', () => {
      const inputData: INodeExecutionData[] = [
        {
          json: {
            toolCallId: 'tool-789'
          }
        }
      ];

      const result = detectExecutionMode(inputData);

      expect(result.mode).toBe('tool');
    });

    it('should detect tool mode from isToolCall marker', () => {
      const inputData: INodeExecutionData[] = [
        {
          json: {
            isToolCall: true
          }
        }
      ];

      const result = detectExecutionMode(inputData);

      expect(result.mode).toBe('tool');
    });

    it('should detect tool mode from n8n context', () => {
      const inputData: INodeExecutionData[] = [
        {
          json: {}
        }
      ];

      const mockContext = { mode: 'tool' };

      const result = detectExecutionMode(inputData, mockContext);

      expect(result.mode).toBe('tool');
      expect(result.source).toBe('context');
    });

    it('should default to action mode when no markers present', () => {
      const inputData: INodeExecutionData[] = [
        {
          json: {
            someOtherField: 'value'
          }
        }
      ];

      const result = detectExecutionMode(inputData);

      expect(result.mode).toBe('action');
      expect(result.source).toBe('default');
    });

    it('should default to action mode for empty input data', () => {
      const inputData: INodeExecutionData[] = [];

      const result = detectExecutionMode(inputData);

      expect(result.mode).toBe('action');
      expect(result.source).toBe('default');
    });

    it('should default to action mode when json is null', () => {
      const inputData: INodeExecutionData[] = [
        {
          json: null as any
        }
      ];

      const result = detectExecutionMode(inputData);

      expect(result.mode).toBe('action');
    });
  });

  describe('hasBinaryData', () => {
    it('should return true when binary data exists', () => {
      const inputData: INodeExecutionData[] = [
        {
          json: {},
          binary: {
            data: {
              data: 'base64data',
              mimeType: 'image/png',
              fileName: 'test.png'
            }
          }
        }
      ];

      const result = hasBinaryData(inputData);

      expect(result).toBe(true);
    });

    it('should return false when no binary data', () => {
      const inputData: INodeExecutionData[] = [
        {
          json: {}
        }
      ];

      const result = hasBinaryData(inputData);

      expect(result).toBe(false);
    });

    it('should return false for empty input', () => {
      const inputData: INodeExecutionData[] = [];

      const result = hasBinaryData(inputData);

      expect(result).toBe(false);
    });

    it('should return false when binary object is empty', () => {
      const inputData: INodeExecutionData[] = [
        {
          json: {},
          binary: {}
        }
      ];

      const result = hasBinaryData(inputData);

      expect(result).toBe(false);
    });
  });

  describe('getDetectionLog', () => {
    it('should include all required fields', () => {
      const inputData: INodeExecutionData[] = [
        {
          json: { test: 'value' },
          binary: {
            data: {
              data: 'base64',
              mimeType: 'image/png'
            }
          }
        }
      ];

      const detection: DetectionResult = {
        mode: 'action',
        reason: 'Default action mode',
        source: 'default'
      };

      const log = getDetectionLog(detection, inputData);

      expect(log).toHaveProperty('mode');
      expect(log).toHaveProperty('reason');
      expect(log).toHaveProperty('source');
      expect(log).toHaveProperty('hasBinaryData');
      expect(log).toHaveProperty('hasInputData');
    });

    it('should correctly report binary data presence', () => {
      const inputData: INodeExecutionData[] = [
        {
          json: { test: 'value' },
          binary: {
            data: {
              data: 'base64',
              mimeType: 'image/png'
            }
          }
        }
      ];

      const detection: DetectionResult = {
        mode: 'action',
        reason: 'Default action mode',
        source: 'default'
      };

      const log = getDetectionLog(detection, inputData);

      expect(log.hasBinaryData).toBe(true);
    });

    it('should correctly report input data presence', () => {
      const inputData: INodeExecutionData[] = [
        {
          json: { test: 'value' }
        }
      ];

      const detection: DetectionResult = {
        mode: 'action',
        reason: 'Default action mode',
        source: 'default'
      };

      const log = getDetectionLog(detection, inputData);

      expect(log.hasInputData).toBe(true);
    });
  });
});
