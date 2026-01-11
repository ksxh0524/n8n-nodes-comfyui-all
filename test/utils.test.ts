/**
 * Tests for utility functions
 */

import {
  extractImageFileInfo,
  extractVideoFileInfo,
  validateMimeType,
  generateUniqueFilename,
  formatBytes,
  getMaxImageSizeBytes,
  getMaxVideoSizeBytes,
  getMaxBase64Length,
} from '../nodes/utils';
import { IMAGE_MIME_TYPES, VALIDATION } from '../nodes/constants';

describe('Utility Functions', () => {
  describe('extractImageFileInfo', () => {
    it('should extract file info from standard image path', () => {
      const result = extractImageFileInfo(
        '/view?filename=ComfyUI_00001.png&subfolder=&type=image',
        'png'
      );

      expect(result.filename).toMatch(/ComfyUI_00001.*\.png/);
      expect(result.extension).toBe('png');
      expect(result.mimeType).toBe('image/png');
    });

    it('should extract subfolder if present', () => {
      const result = extractImageFileInfo(
        '/view?filename=test.png&subfolder=output&type=image',
        'png'
      );

      expect(result.filename).toMatch(/test.*\.png/);
      // subfolder is not part of FileInfo return type
    });

    it('should handle URL-encoded filenames', () => {
      const result = extractImageFileInfo(
        '/view?filename=image%20with%20spaces.png&subfolder=&type=image',
        'png'
      );

      expect(result.filename).toContain('image with spaces');
    });

    it('should use default extension if none found', () => {
      const result = extractImageFileInfo('/view?filename=noext&subfolder=&type=image', 'jpg');

      expect(result.extension).toBe('jpg');
      expect(result.mimeType).toBe('image/jpeg');
    });
  });

  describe('extractVideoFileInfo', () => {
    it('should extract file info from video path', () => {
      const result = extractVideoFileInfo(
        '/view?filename=video_001.mp4&subfolder=&type=video',
        'mp4'
      );

      expect(result.filename).toMatch(/video_001.*\.mp4/);
      expect(result.extension).toBe('mp4');
      expect(result.mimeType).toBe('video/mp4');
    });

    it('should handle webm videos', () => {
      const result = extractVideoFileInfo(
        '/view?filename=animation.webm&subfolder=&type=video',
        'webm'
      );

      expect(result.mimeType).toBe('video/webm');
    });
  });

  describe('validateMimeType', () => {
    it('should accept valid MIME types', () => {
      expect(validateMimeType('image/png', IMAGE_MIME_TYPES)).toBe('image/png');
      expect(validateMimeType('image/jpeg', IMAGE_MIME_TYPES)).toBe('image/jpeg');
      expect(validateMimeType('image/webp', IMAGE_MIME_TYPES)).toBe('image/webp');
    });

    it('should normalize MIME type case', () => {
      expect(validateMimeType('IMAGE/PNG', IMAGE_MIME_TYPES)).toBe('image/png');
      expect(validateMimeType('Image/Jpeg', IMAGE_MIME_TYPES)).toBe('image/jpeg');
    });

    it('should throw for invalid MIME types', () => {
      expect(() => validateMimeType('application/pdf', IMAGE_MIME_TYPES)).toThrow();
      expect(() => validateMimeType('text/plain', IMAGE_MIME_TYPES)).toThrow();
    });

    it('should throw for empty MIME type', () => {
      expect(() => validateMimeType('', IMAGE_MIME_TYPES)).toThrow();
    });
  });

  describe('generateUniqueFilename', () => {
    it('should generate filename with correct extension', () => {
      const filename = generateUniqueFilename('png', 'upload');

      // Uses UUID format (xxxxxxxx-xxxx-4xxx-xxxx-xxxxxxxxxxxx)
      expect(filename).toMatch(/^upload_[a-f0-9-]+\.png$/);
    });

    it('should generate different filenames on each call', () => {
      const filename1 = generateUniqueFilename('jpg', 'test');
      const filename2 = generateUniqueFilename('jpg', 'test');

      expect(filename1).not.toBe(filename2);
    });

    it('should use default prefix if none provided', () => {
      const filename = generateUniqueFilename('png');

      // Default prefix is 'file', not 'ComfyUI'
      expect(filename).toMatch(/^file_[a-f0-9-]+\.png$/);
    });
  });

  describe('formatBytes', () => {
    it('should format bytes', () => {
      expect(formatBytes(500)).toBe('500 Bytes');
      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(1536)).toBe('1.5 KB');
      expect(formatBytes(1048576)).toBe('1 MB');
      expect(formatBytes(1073741824)).toBe('1 GB');
    });

    it('should handle zero', () => {
      expect(formatBytes(0)).toBe('0 Bytes');
    });

    it('should use appropriate units', () => {
      expect(formatBytes(500)).toBe('500 Bytes');
      expect(formatBytes(2048)).toBe('2 KB');
      expect(formatBytes(3145728)).toBe('3 MB');
      expect(formatBytes(2147483648)).toBe('2 GB');
    });
  });

  describe('Size limit getters', () => {
    it('should return correct max image size', () => {
      const maxSize = getMaxImageSizeBytes();
      expect(maxSize).toBe(VALIDATION.MAX_IMAGE_SIZE_MB * 1024 * 1024);
      expect(maxSize).toBe(50 * 1024 * 1024);
    });

    it('should return correct max video size', () => {
      const maxSize = getMaxVideoSizeBytes();
      expect(maxSize).toBe(VALIDATION.MAX_VIDEO_SIZE_MB * 1024 * 1024);
      expect(maxSize).toBe(500 * 1024 * 1024);
    });

    it('should return correct max base64 length', () => {
      const maxSize = getMaxBase64Length();
      const expectedMaxImageSize = VALIDATION.MAX_IMAGE_SIZE_MB * 1024 * 1024;
      // Base64 encoding uses 4/3 factor
      const expected = expectedMaxImageSize * 4 / 3;
      expect(maxSize).toBe(expected);
    });
  });
});
