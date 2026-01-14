/**
 * Integration tests for ComfyUIClient
 */

import { ComfyUIClient } from '../nodes/ComfyUiClient';
import { Logger } from '../nodes/logger';
import { VALIDATION } from '../nodes/constants';

describe('ComfyUIClient Integration Tests', () => {
  let client: ComfyUIClient;
  let mockLogger: Logger;
  let mockHelpers: any;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as unknown as Logger;

    mockHelpers = {
      httpRequest: jest.fn(),
    };

    client = new ComfyUIClient({
      baseUrl: 'http://localhost:8188',
      timeout: 30000,
      helpers: mockHelpers,
      logger: mockLogger,
    });
  });

  afterEach(() => {
    client.destroy();
    jest.clearAllMocks();
  });

  describe('Client Lifecycle', () => {
    it('should initialize with correct configuration', () => {
      expect(client).toBeDefined();
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Client initialized'));
    });

    it('should destroy client and clean up resources', () => {
      client.destroy();
      expect(client['isClientDestroyed']()).toBe(true);
    });

    it('should prevent requests after destruction', async () => {
      client.destroy();
      const result = await client.executeWorkflow({
        '3': {
          inputs: {},
          class_type: 'KSampler',
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('destroyed');
    });
  });

  describe('Workflow Execution', () => {
    it('should execute workflow successfully', async () => {
      mockHelpers.httpRequest.mockResolvedValueOnce({
        prompt_id: 'test-prompt-123',
      });

      mockHelpers.httpRequest.mockResolvedValueOnce({
        'test-prompt-123': {
          status: {
            completed: true,
            status_str: 'success',
          },
          outputs: {
            '9': {
              images: [
                {
                  filename: 'test_image.png',
                  subfolder: '',
                  type: 'output',
                },
              ],
            },
          },
        },
      });

      const workflow = {
        '3': {
          inputs: {
            seed: 123456789,
            steps: 20,
          },
          class_type: 'KSampler',
        },
      };

      const result = await client.executeWorkflow(workflow);

      expect(result.success).toBe(true);
      expect(result.images).toHaveLength(1);
      expect(result.images?.[0]).toContain('test_image.png');
    });

    it('should handle workflow execution timeout', async () => {
      mockHelpers.httpRequest.mockResolvedValueOnce({
        prompt_id: 'test-prompt-123',
      });

      mockHelpers.httpRequest.mockResolvedValue({
        'test-prompt-123': {
          status: {
            completed: false,
            status_str: 'executing',
          },
        },
      });

      const workflow = {
        '3': {
          inputs: {},
          class_type: 'KSampler',
        },
      };

      const result = await client.executeWorkflow(workflow);

      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    });

    it('should handle concurrent request prevention', async () => {
      mockHelpers.httpRequest.mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => resolve({ prompt_id: 'test' }), 1000);
        });
      });

      const workflow = {
        '3': {
          inputs: {},
          class_type: 'KSampler',
        },
      };

      const promise1 = client.executeWorkflow(workflow);
      const promise2 = client.executeWorkflow(workflow);

      const result1 = await promise1;
      const result2 = await promise2;

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(false);
      expect(result2.error).toContain('in progress');
    });
  });

  describe('Retry Logic', () => {
    it('should retry failed requests with exponential backoff', async () => {
      let attemptCount = 0;
      mockHelpers.httpRequest.mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 3) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve({ prompt_id: 'test' });
      });

      mockHelpers.httpRequest.mockResolvedValueOnce({
        'test': {
          status: { completed: true },
          outputs: {},
        },
      });

      const workflow = {
        '3': {
          inputs: {},
          class_type: 'KSampler',
        },
      };

      const result = await client.executeWorkflow(workflow);

      expect(attemptCount).toBe(3);
      expect(result.success).toBe(true);
    });

    it('should stop retrying after max attempts', async () => {
      mockHelpers.httpRequest.mockRejectedValue(new Error('Persistent error'));

      const workflow = {
        '3': {
          inputs: {},
          class_type: 'KSampler',
        },
      };

      const result = await client.executeWorkflow(workflow);

      expect(result.success).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });

  describe('Image Upload', () => {
    it('should upload image successfully', async () => {
      mockHelpers.httpRequest.mockResolvedValue({
        name: 'uploaded_image.png',
      });

      const imageBuffer = Buffer.from('test image data');
      const filename = await client.uploadImage(imageBuffer, 'test.png');

      expect(filename).toBe('uploaded_image.png');
      expect(mockHelpers.httpRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          url: 'http://localhost:8188/upload/image',
        })
      );
    });

    it('should validate image size', async () => {
      const maxSize = VALIDATION.MAX_IMAGE_SIZE_MB * 1024 * 1024;
      const largeBuffer = Buffer.alloc(maxSize + 1);

      await expect(client.uploadImage(largeBuffer, 'large.png')).rejects.toThrow('exceeds maximum');
    });

    it('should validate buffer type', async () => {
      await expect(client.uploadImage('not a buffer' as any, 'test.png')).rejects.toThrow('Invalid file data');
    });
  });

  describe('Error Handling', () => {
    it('should handle HTTP errors gracefully', async () => {
      const httpError = new Error('HTTP request failed');
      (httpError as any).response = {
        statusCode: 500,
        statusMessage: 'Internal Server Error',
      };

      mockHelpers.httpRequest.mockRejectedValue(httpError);

      const workflow = {
        '3': {
          inputs: {},
          class_type: 'KSampler',
        },
      };

      const result = await client.executeWorkflow(workflow);

      expect(result.success).toBe(false);
      expect(result.error).toContain('500');
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle malformed responses', async () => {
      mockHelpers.httpRequest.mockResolvedValueOnce({
        prompt_id: 'test',
      });

      mockHelpers.httpRequest.mockResolvedValueOnce({});

      const workflow = {
        '3': {
          inputs: {},
          class_type: 'KSampler',
        },
      };

      const result = await client.executeWorkflow(workflow);

      expect(result.success).toBe(true);
      expect(result.images).toEqual([]);
    });
  });

  describe('Memory Management', () => {
    it('should process results with buffer tracking', async () => {
      mockHelpers.httpRequest.mockResolvedValueOnce({
        prompt_id: 'test',
      });

      mockHelpers.httpRequest.mockResolvedValueOnce({
        'test': {
          status: { completed: true },
          outputs: {
            '9': {
              images: [
                { filename: 'image1.png', subfolder: '', type: 'output' },
                { filename: 'image2.png', subfolder: '', type: 'output' },
              ],
            },
          },
        },
      });

      mockHelpers.httpRequest.mockResolvedValueOnce(Buffer.from('fake image data'));
      mockHelpers.httpRequest.mockResolvedValueOnce(Buffer.from('fake image data'));

      const workflow = {
        '3': {
          inputs: {},
          class_type: 'KSampler',
        },
      };

      const result = await client.executeWorkflow(workflow);
      const processed = await client.processResults(result, 'data');

      expect(processed.json.imageCount).toBe(2);
      expect(processed.binary.data).toBeDefined();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Buffer tracking statistics')
      );
    });

    it('should enforce memory limits', async () => {
      const largeBuffer = Buffer.alloc(VALIDATION.MAX_TOTAL_IMAGE_MEMORY_MB * 1024 * 1024 + 1);

      mockHelpers.httpRequest.mockResolvedValueOnce({
        prompt_id: 'test',
      });

      mockHelpers.httpRequest.mockResolvedValueOnce({
        'test': {
          status: { completed: true },
          outputs: {
            '9': {
              images: [{ filename: 'large.png', subfolder: '', type: 'output' }],
            },
          },
        },
      });

      mockHelpers.httpRequest.mockResolvedValueOnce(largeBuffer);

      const workflow = {
        '3': {
          inputs: {},
          class_type: 'KSampler',
        },
      };

      const result = await client.executeWorkflow(workflow);

      await expect(client.processResults(result, 'data')).rejects.toThrow('Memory limit exceeded');
    });
  });

  describe('Health Check', () => {
    it('should return healthy when server is accessible', async () => {
      mockHelpers.httpRequest.mockResolvedValue({});

      const health = await client.healthCheck();

      expect(health.healthy).toBe(true);
      expect(health.message).toContain('accessible');
    });

    it('should return unhealthy when server is not accessible', async () => {
      mockHelpers.httpRequest.mockRejectedValue(new Error('Connection refused'));

      const health = await client.healthCheck();

      expect(health.healthy).toBe(false);
      expect(health.message).toContain('not accessible');
    });
  });
});
