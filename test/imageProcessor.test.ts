/**
 * Tests for Image Processor
 */

import { ImageProcessor, ImageProcessorConfig, ProcessFromUrlConfig, ProcessFromBinaryConfig } from '../nodes/processors/ImageProcessor';
import { NodeOperationError } from 'n8n-workflow';
import { Logger } from '../nodes/logger';

// Mock execute functions
const mockExecuteFunctions = {
  getNode: jest.fn().mockReturnValue({ id: 'test-node' }),
  helpers: {
    httpRequest: jest.fn(),
  },
} as unknown as import('n8n-workflow').IExecuteFunctions;

// Mock logger
const createMockLogger = (): Logger => {
  const logger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  } as unknown as Logger;
  // Add child method that returns a new mock logger
  (logger as any).child = jest.fn(() => logger);
  return logger;
};

describe('ImageProcessor', () => {
  let processor: ImageProcessor;
  let mockUploadImage: jest.Mock;
  let mockLogger: Logger;

  beforeEach(() => {
    mockUploadImage = jest.fn().mockResolvedValue('uploaded_filename.png');
    mockLogger = createMockLogger();

    const config: ImageProcessorConfig = {
      executeFunctions: mockExecuteFunctions,
      logger: mockLogger,
      isToolMode: false,
    };

    processor = new ImageProcessor(config);
    jest.clearAllMocks();
  });

  describe('processFromUrl', () => {
    const getBaseConfig = (): ProcessFromUrlConfig => ({
      paramName: 'image',
      imageUrl: 'https://example.com/image.png',
      index: 0,
      uploadImage: mockUploadImage,
      timeout: 60,
    });

    it('should successfully download and upload image from URL', async () => {
      const mockBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]); // PNG header

      (mockExecuteFunctions.helpers as any).httpRequest.mockResolvedValue(mockBuffer);

      const config = getBaseConfig();
      const result = await processor.processFromUrl(config);

      expect(result.filename).toBe('uploaded_filename.png');
      expect(result.size).toBe(mockBuffer.length);
      expect(mockUploadImage).toHaveBeenCalledWith(mockBuffer, expect.stringContaining('.png'));
    });

    it('should throw error if imageUrl is empty', async () => {
      const invalidConfig = { ...getBaseConfig(), imageUrl: '' };

      await expect(processor.processFromUrl(invalidConfig)).rejects.toThrow(NodeOperationError);
    });

    it('should throw error if imageUrl is not provided', async () => {
      const invalidConfig = { ...getBaseConfig(), imageUrl: undefined as unknown as string };

      await expect(processor.processFromUrl(invalidConfig)).rejects.toThrow(NodeOperationError);
    });

    it('should throw error if download fails', async () => {
      const failConfig = { ...getBaseConfig(), imageUrl: 'https://example.com/notfound.png' };

      (mockExecuteFunctions.helpers as any).httpRequest.mockRejectedValue({
        response: { statusCode: 404, statusMessage: 'Not Found' }
      });

      await expect(processor.processFromUrl(failConfig)).rejects.toThrow(NodeOperationError);
    });
  });

  describe('processFromBinary', () => {
    const getBaseConfig = (): ProcessFromBinaryConfig => ({
      paramName: 'image',
      binaryPropertyName: 'data',
      index: 0,
      uploadImage: mockUploadImage,
    });

    const mockInputData = {
      json: {},
      binary: {
        data: {
          data: Buffer.from('test-image-data').toString('base64'),
          mimeType: 'image/png',
          fileName: 'test.png'
        }
      }
    };

    beforeEach(() => {
      (mockExecuteFunctions as any).getInputData = jest.fn().mockReturnValue([mockInputData]);
    });

    it('should successfully process binary data', async () => {
      const config = getBaseConfig();
      const result = await processor.processFromBinary(config);

      expect(result.filename).toBeDefined();
      expect(result.size).toBeGreaterThan(0);
      expect(result.mimeType).toBe('image/png');
      expect(mockUploadImage).toHaveBeenCalled();
    });

    it('should throw error in tool mode', async () => {
      const toolModeLogger = createMockLogger();
      const toolModeConfig: ImageProcessorConfig = {
        executeFunctions: mockExecuteFunctions,
        logger: toolModeLogger,
        isToolMode: true, // Tool mode enabled
      };

      const toolModeProcessor = new ImageProcessor(toolModeConfig);

      const config = getBaseConfig();
      await expect(toolModeProcessor.processFromBinary(config)).rejects.toThrow(NodeOperationError);
      await expect(toolModeProcessor.processFromBinary(config)).rejects.toThrow('Binary file input is not supported in Tool mode');
    });

    it('should throw error if binary property not found', async () => {
      const invalidConfig = { ...getBaseConfig(), binaryPropertyName: 'nonexistent' };

      await expect(processor.processFromBinary(invalidConfig)).rejects.toThrow(NodeOperationError);
    });
  });

  describe('validation', () => {
    it('should validate external URL format', async () => {
      const invalidUrlConfig: ProcessFromUrlConfig = {
        paramName: 'image',
        imageUrl: 'not-a-valid-url', // Invalid URL format
        index: 0,
        uploadImage: mockUploadImage,
        timeout: 60,
      };

      await expect(processor.processFromUrl(invalidUrlConfig)).rejects.toThrow(NodeOperationError);
      await expect(processor.processFromUrl(invalidUrlConfig)).rejects.toThrow('Invalid file URL');
    });

    it('should validate downloaded image size', async () => {
      const largeBuffer = Buffer.alloc(600 * 1024 * 1024); // 600MB (exceeds 500MB limit)

      const largeFileConfig: ProcessFromUrlConfig = {
        paramName: 'image',
        imageUrl: 'https://example.com/huge.png',
        index: 0,
        uploadImage: mockUploadImage,
        timeout: 60,
      };

      (mockExecuteFunctions.helpers as any).httpRequest.mockResolvedValue(largeBuffer);

      // Note: File size limit is now 500MB to support both images and videos
      await expect(processor.processFromUrl(largeFileConfig)).rejects.toThrow(NodeOperationError);
    });
  });
});
