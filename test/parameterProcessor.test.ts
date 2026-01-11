/**
 * Tests for ParameterProcessor
 */

import { ParameterProcessor } from '../nodes/parameterProcessor';
import { Workflow } from '../nodes/types';
import { Logger } from '../nodes/logger';

// Mock implementations
const mockExecuteFunctions = {
  getNode: jest.fn().mockReturnValue({ name: 'TestNode' }),
  helpers: {
    httpRequest: jest.fn(),
  },
  getInputData: jest.fn(),
} as any;

// Create a mock logger - use type assertion to bypass private property check
const mockLogger = {
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
} as unknown as Logger;

describe('ParameterProcessor', () => {
  let processor: ParameterProcessor;

  beforeEach(() => {
    jest.clearAllMocks();
    processor = new ParameterProcessor({
      executeFunctions: mockExecuteFunctions,
      logger: mockLogger,
    });
  });

  describe('processTextParameter', () => {
    it('should return the value as is', () => {
      expect(processor.processTextParameter('test')).toBe('test');
      expect(processor.processTextParameter('')).toBe('');
    });
  });

  describe('processNumberParameter', () => {
    it('should return number values', () => {
      expect(processor.processNumberParameter(42)).toBe(42);
      expect(processor.processNumberParameter(0)).toBe(0);
      expect(processor.processNumberParameter(-10)).toBe(-10);
    });

    it('should return 0 for undefined', () => {
      expect(processor.processNumberParameter(undefined as any)).toBe(0);
    });
  });

  describe('processBooleanParameter', () => {
    it('should handle string boolean values', () => {
      expect(processor.processBooleanParameter('true')).toBe(true);
      expect(processor.processBooleanParameter('false')).toBe(false);
      // Function is case-sensitive - only lowercase 'true' returns true
      expect(processor.processBooleanParameter('TRUE')).toBe(false);
      expect(processor.processBooleanParameter('FALSE')).toBe(false);
    });

    it('should handle actual boolean values', () => {
      expect(processor.processBooleanParameter(true)).toBe(true);
      expect(processor.processBooleanParameter(false)).toBe(false);
    });

    it('should return false for other values', () => {
      expect(processor.processBooleanParameter('')).toBe(false);
      expect(processor.processBooleanParameter('yes')).toBe(false);
    });
  });

  describe('processNodeParameters', () => {
    let mockWorkflow: Workflow;
    let mockUploadImage: jest.Mock;

    beforeEach(() => {
      mockWorkflow = {
        '3': {
          inputs: {
            seed: 123456789,
          },
          class_type: 'KSampler',
        },
        '6': {
          inputs: {
            text: 'default text',
          },
          class_type: 'CLIPTextEncode',
        },
      };

      mockUploadImage = jest.fn().mockResolvedValue('uploaded_image.png');
    });

    it('should process single text parameter', async () => {
      const nodeParameters = {
        nodeParameter: [
          {
            nodeId: '6',
            parameterMode: 'single',
            paramName: 'text',
            type: 'text',
            value: 'new text prompt',
          },
        ],
      };

      await processor.processNodeParameters(
        nodeParameters as any,
        mockWorkflow,
        mockUploadImage,
        30000
      );

      expect(mockWorkflow['6'].inputs.text).toBe('new text prompt');
    });

    it('should process single number parameter', async () => {
      const nodeParameters = {
        nodeParameter: [
          {
            nodeId: '3',
            parameterMode: 'single',
            paramName: 'seed',
            type: 'number',
            numberValue: 999888777,
          },
        ],
      };

      await processor.processNodeParameters(
        nodeParameters as any,
        mockWorkflow,
        mockUploadImage,
        30000
      );

      expect(mockWorkflow['3'].inputs.seed).toBe(999888777);
    });

    it('should process single boolean parameter', async () => {
      mockWorkflow['10'] = {
        inputs: {},
        class_type: 'TestNode',
      };

      const nodeParameters = {
        nodeParameter: [
          {
            nodeId: '10',
            parameterMode: 'single',
            paramName: 'enabled',
            type: 'boolean',
            booleanValue: 'true',
          },
        ],
      };

      await processor.processNodeParameters(
        nodeParameters as any,
        mockWorkflow,
        mockUploadImage,
        30000
      );

      expect(mockWorkflow['10'].inputs.enabled).toBe(true);
    });

    it('should process multiple parameters from JSON', async () => {
      const nodeParameters = {
        nodeParameter: [
          {
            nodeId: '3',
            parameterMode: 'multiple',
            parametersJson: JSON.stringify({
              seed: 111111111,
              steps: 30,
              cfg: 7.5,
            }),
          },
        ],
      };

      await processor.processNodeParameters(
        nodeParameters as any,
        mockWorkflow,
        mockUploadImage,
        30000
      );

      expect(mockWorkflow['3'].inputs.seed).toBe(111111111);
      expect(mockWorkflow['3'].inputs.steps).toBe(30);
      expect(mockWorkflow['3'].inputs.cfg).toBe(7.5);
    });

    it('should throw error for missing node ID', async () => {
      const nodeParameters = {
        nodeParameter: [
          {
            nodeId: '',
            parameterMode: 'single',
            paramName: 'text',
            type: 'text',
            value: 'test',
          },
        ],
      };

      await expect(
        processor.processNodeParameters(
          nodeParameters as any,
          mockWorkflow,
          mockUploadImage,
          30000
        )
      ).rejects.toThrow();
    });

    it('should throw error for node not found in workflow', async () => {
      const nodeParameters = {
        nodeParameter: [
          {
            nodeId: '999',
            parameterMode: 'single',
            paramName: 'text',
            type: 'text',
            value: 'test',
          },
        ],
      };

      await expect(
        processor.processNodeParameters(
          nodeParameters as any,
          mockWorkflow,
          mockUploadImage,
          30000
        )
      ).rejects.toThrow('Node ID "999" not found in workflow');
    });

    it('should handle empty node parameters', async () => {
      await processor.processNodeParameters(
        {},
        mockWorkflow,
        mockUploadImage,
        30000
      );

      // Should not throw and workflow should be unchanged
      expect(mockWorkflow['3'].inputs.seed).toBe(123456789);
    });
  });
});
