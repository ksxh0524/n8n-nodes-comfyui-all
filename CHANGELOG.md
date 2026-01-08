# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.4.5] - 2025-01-08

### Added
- **ComfyUI Tool Node**: New specialized node for AI Agent workflows with URL-based image input
  - Accepts image URLs instead of binary data (prevents LLM context overflow)
  - Automatically downloads images from URLs using `this.helpers.httpRequest`
  - Optimized for AI Agent tool calling scenarios
- **Parameter Overrides** for ComfyUI Tool node to support dynamic workflow parameter updates
- Updated documentation with clear distinction between ComfyUI Tool and ComfyUI nodes

### Changed
- **ComfyUI Tool**: Now exclusively uses URL-based image input (removed binary handling)
- **ComfyUI**: Continues to support both binary and URL inputs for standard workflows
- Improved node selection guidance for different use cases (AI Agent vs standard workflows)

### Technical Details
- ComfyUI Tool node: URL-only image input → Download → Upload to ComfyUI
- ComfyUI node: Binary OR URL input → Process → Upload to ComfyUI
- Both nodes maintain the same output format (URLs for tool mode, binary for workflow mode)

## [2.2.11] - 2025-01-07

### Added
- Added state machine pattern for thread-safe client lifecycle management
- Added `NodeOutput` and `WorkflowOutputs` TypeScript interfaces
- Added `getImageBuffers()` and `getVideoBuffers()` for concurrent resource fetching
- Added CI/CD pipeline with GitHub Actions
- Added test coverage script (`npm run test:coverage`)
- Added comprehensive LICENSE file
- Added CHANGELOG.md for tracking version changes

### Changed
- Improved `processResults()` to use concurrent fetching (3-5x faster for multiple resources)
- Optimized JSON depth calculation using iteration instead of recursion
- Moved `@types/axios` from dependencies to devDependencies
- Changed ESLint rule from `no-explicit-any: 'off'` to `'warn'` for better type safety
- Refactored `getImageBuffer()` and `getVideoBuffer()` to use shared `getBuffer()` method
- Enhanced package.json with homepage, bugs, exports, and engines fields

### Fixed
- Fixed race conditions in `ComfyUIClient` with state machine pattern
- Fixed request cancellation by passing AbortController signal to all HTTP requests
- Fixed buffer size validation in `getImageBuffer()` and `getVideoBuffer()`
- Fixed type safety issues by replacing `any` with proper TypeScript interfaces
- Fixed duplicate entries in .gitignore

### Security
- Added proper size validation to prevent DoS attacks through large buffer downloads
- Enhanced error handling with structured logging
- Improved resource cleanup to prevent memory leaks

## [2.2.10] - 2024-12-XX

### Added
- Initial release of n8n-comfyui-nodes
- Support for ComfyUI workflow execution
- Dynamic parameter override functionality
- AI Agent tool integration (ComfyUIAgentTool)
- Video generation support
- Image and video upload capabilities

### Changed
- Migrated from JavaScript to TypeScript
- Implemented comprehensive error handling
- Added request retry mechanism with exponential backoff
- Added workflow execution history tracking

[Unreleased]: https://github.com/ksxh0524/n8n-nodes-comfyui-all/compare/v2.2.11...HEAD
[2.2.11]: https://github.com/ksxh0524/n8n-nodes-comfyui-all/compare/v2.2.10...v2.2.11
[2.2.10]: https://github.com/ksxh0524/n8n-nodes-comfyui-all/releases/tag/v2.2.10
