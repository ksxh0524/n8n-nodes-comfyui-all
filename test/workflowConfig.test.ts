import { getWorkflowTemplate, DEFAULT_WORKFLOW_TEMPLATE } from '../nodes/workflowConfig';
import { WorkflowConfig } from '../nodes/types';

describe('getWorkflowTemplate', () => {
  it('should return default workflow template when no config provided', () => {
    const template = getWorkflowTemplate();
    expect(template).toEqual(DEFAULT_WORKFLOW_TEMPLATE);
  });

  it('should return default workflow template when config is empty', () => {
    const config: WorkflowConfig = {};
    const template = getWorkflowTemplate(config);
    expect(template).toEqual(DEFAULT_WORKFLOW_TEMPLATE);
  });

  it('should return custom template when provided', () => {
    const customTemplate: any = {
      '1': {
        inputs: { text: 'test' },
        class_type: 'CLIPTextEncode',
      },
    };

    const config: WorkflowConfig = {
      template: customTemplate,
    };

    const template = getWorkflowTemplate(config);
    expect(template).toEqual(customTemplate);
  });

  it('should parse custom template from JSON string', () => {
    const customJson = JSON.stringify({
      '1': {
        inputs: { text: 'test' },
        class_type: 'CLIPTextEncode',
      },
    });

    const config: WorkflowConfig = {
      customTemplate: customJson,
    };

    const template = getWorkflowTemplate(config);
    expect(template['1'].inputs.text).toBe('test');
    expect(template['1'].class_type).toBe('CLIPTextEncode');
  });

  it('should fall back to default template when custom JSON is invalid', () => {
    const config: WorkflowConfig = {
      customTemplate: 'invalid json',
    };

    const template = getWorkflowTemplate(config);
    expect(template).toEqual(DEFAULT_WORKFLOW_TEMPLATE);
  });

  it('should prioritize customTemplate over template', () => {
    const customTemplate: any = {
      '1': {
        inputs: { text: 'from template' },
        class_type: 'CLIPTextEncode',
      },
    };

    const customJson = JSON.stringify({
      '2': {
        inputs: { text: 'from json' },
        class_type: 'CLIPTextEncode',
      },
    });

    const config: WorkflowConfig = {
      template: customTemplate,
      customTemplate: customJson,
    };

    const template = getWorkflowTemplate(config);
    expect(template['2']).toBeDefined();
    expect(template['1']).toBeUndefined();
  });
});