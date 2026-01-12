/**
 * Tests for Parameter Type Handler
 */

import { ParameterTypeHandler, TypeHandlerConfig } from '../nodes/processors/ParameterTypeHandler';
import { NodeOperationError } from 'n8n-workflow';
import { Logger } from '../nodes/logger';
import { ImageProcessor } from '../nodes/processors/ImageProcessor';

describe('ParameterTypeHandler', () => {
  let typeHandler: ParameterTypeHandler;
  let mockLogger: Logger;
  let mockImageProcessor: jest.Mocked<ImageProcessor>;

  const createMockLogger = (): Logger => {
    const logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as unknown as Logger;
    (logger as any).child = jest.fn(() => logger);
    return logger;
  };

  beforeEach(() => {
    mockLogger = createMockLogger();

    mockImageProcessor = {
      processFromUrl: jest.fn(),
      processFromBinary: jest.fn(),
    } as unknown as jest.Mocked<ImageProcessor>;

    const config: TypeHandlerConfig = {
      executeFunctions: {
        getNode: jest.fn().mockReturnValue({ id: 'test' }),
      } as unknown as import('n8n-workflow').IExecuteFunctions,
      logger: mockLogger,
      imageProcessor: mockImageProcessor,
    };

    typeHandler = new ParameterTypeHandler(config);
    jest.clearAllMocks();
  });

  describe('normalizeBoolean', () => {
    it('should handle boolean true', () => {
      expect(typeHandler.normalizeBoolean(true)).toBe(true);
    });

    it('should handle boolean false', () => {
      expect(typeHandler.normalizeBoolean(false)).toBe(false);
    });

    it('should handle string "true"', () => {
      expect(typeHandler.normalizeBoolean('true')).toBe(true);
    });

    it('should handle string "false"', () => {
      expect(typeHandler.normalizeBoolean('false')).toBe(false);
    });

    it('should handle string "TRUE" (case insensitive)', () => {
      expect(typeHandler.normalizeBoolean('TRUE')).toBe(true);
    });

    it('should handle string "False" (case insensitive)', () => {
      expect(typeHandler.normalizeBoolean('False')).toBe(false);
    });

    it('should return false for any other string value', () => {
      expect(typeHandler.normalizeBoolean('yes')).toBe(false);
      expect(typeHandler.normalizeBoolean('1')).toBe(false);
      expect(typeHandler.normalizeBoolean('0')).toBe(false);
      expect(typeHandler.normalizeBoolean('')).toBe(false);
    });

    it('should return false for null', () => {
      expect(typeHandler.normalizeBoolean(null as unknown as string)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(typeHandler.normalizeBoolean(undefined as unknown as string)).toBe(false);
    });
  });

  describe('processText', () => {
    it('should return the value', () => {
      expect(typeHandler.processText('hello')).toBe('hello');
    });

    it('should return empty string for undefined', () => {
      expect(typeHandler.processText(undefined as unknown as string)).toBe('');
    });

    it('should return empty string for empty string', () => {
      expect(typeHandler.processText('')).toBe('');
    });
  });

  describe('processNumber', () => {
    it('should return the value', () => {
      expect(typeHandler.processNumber(42)).toBe(42);
    });

    it('should return 0 for undefined', () => {
      expect(typeHandler.processNumber(undefined as unknown as number)).toBe(0);
    });

    it('should return 0 for null', () => {
      expect(typeHandler.processNumber(null as unknown as number)).toBe(0);
    });
  });

  describe('processBoolean', () => {
    it('should use normalizeBoolean', () => {
      expect(typeHandler.processBoolean(true)).toBe(true);
      expect(typeHandler.processBoolean('true')).toBe(true);
      expect(typeHandler.processBoolean('false')).toBe(false);
      expect(typeHandler.processBoolean(false)).toBe(false);
    });
  });

  describe('processByType', () => {
    const mockConfig = {
      type: 'text',
      nodeId: '6',
      paramName: 'text',
      value: 'test prompt',
      numberValue: 0,
      booleanValue: false,
      imageSource: 'url',
      imageUrl: '',
      index: 0,
      uploadImage: jest.fn(),
      timeout: 60,
    };

    it('should process text type', async () => {
      const result = await typeHandler.processByType({
        ...mockConfig,
        type: 'text',
      });

      expect(result).toBe('test prompt');
    });

    it('should process number type', async () => {
      const result = await typeHandler.processByType({
        ...mockConfig,
        type: 'number',
        numberValue: 123,
      });

      expect(result).toBe(123);
    });

    it('should process boolean type', async () => {
      const result = await typeHandler.processByType({
        ...mockConfig,
        type: 'boolean',
        booleanValue: 'true',
      });

      expect(result).toBe(true);
    });

    it('should throw error for unknown type', async () => {
      await expect(typeHandler.processByType({
        ...mockConfig,
        type: 'unknown' as any,
      })).rejects.toThrow(NodeOperationError);

      await expect(typeHandler.processByType({
        ...mockConfig,
        type: 'unknown' as any,
      })).rejects.toThrow('Unknown type');
    });
  });
});
