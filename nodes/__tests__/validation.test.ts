/**
 * Unit tests for validation functions
 */

import {
  validateUrl,
  isPrivateNetworkAddress,
  validateComfyUIWorkflow,
  validateImageInput,
} from '../validation';

describe('Validation', () => {
  describe('validateUrl', () => {
    it('should validate valid HTTP URLs', () => {
      expect(validateUrl('http://example.com')).toBe(true);
      expect(validateUrl('http://localhost:8188')).toBe(true);
      expect(validateUrl('https://example.com')).toBe(true);
    });

    it('should reject invalid URLs', () => {
      expect(validateUrl('not-a-url')).toBe(false);
      expect(validateUrl('ftp://example.com')).toBe(false);
      expect(validateUrl('')).toBe(false);
    });
  });

  describe('isPrivateNetworkAddress', () => {
    it('should detect private network addresses', () => {
      expect(isPrivateNetworkAddress('http://127.0.0.1:8188')).toBe(true);
      expect(isPrivateNetworkAddress('http://10.0.0.1')).toBe(true);
      expect(isPrivateNetworkAddress('http://192.168.1.1')).toBe(true);
      expect(isPrivateNetworkAddress('http://172.16.0.1')).toBe(true);
      expect(isPrivateNetworkAddress('http://localhost:8188')).toBe(true);
    });

    it('should allow public addresses', () => {
      expect(isPrivateNetworkAddress('http://example.com')).toBe(false);
      expect(isPrivateNetworkAddress('https://api.example.com')).toBe(false);
    });
  });

  describe('validateComfyUIWorkflow', () => {
    it('should validate valid workflow JSON', () => {
      const validWorkflow = {
        '3': {
          inputs: {
            seed: 123456,
            steps: 20,
          },
          class_type: 'KSampler',
        },
      };

      const result = validateComfyUIWorkflow(JSON.stringify(validWorkflow));
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject empty workflow', () => {
      const result = validateComfyUIWorkflow('');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject invalid JSON', () => {
      const result = validateComfyUIWorkflow('{invalid json}');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid JSON');
    });

    it('should reject workflow without nodes', () => {
      const result = validateComfyUIWorkflow('{}');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('at least one node');
    });

    it('should reject workflow with invalid node structure', () => {
      const invalidWorkflow = {
        '3': {
          inputs: 'should be object',
        },
      };

      const result = validateComfyUIWorkflow(JSON.stringify(invalidWorkflow));
      expect(result.valid).toBe(false);
      expect(result.error).toContain('class_type');
    });
  });

  describe('validateImageInput', () => {
    it('should validate valid base64 image', () => {
      const validImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

      const result = validateImageInput(validImage);
      expect(result.valid).toBe(true);
    });

    it('should reject empty image', () => {
      const result = validateImageInput('');
      expect(result.valid).toBe(false);
    });

    it('should reject oversized images', () => {
      // Create a large base64 string (> 50MB)
      const largeData = 'A'.repeat(50 * 1024 * 1024 * 4 / 3);
      const largeImage = `data:image/png;base64,${largeData}`;

      const result = validateImageInput(largeImage);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('too large');
    });

    it('should accept image URL', () => {
      const result = validateImageInput('http://example.com/image.png');
      expect(result.valid).toBe(true);
    });
  });
});
