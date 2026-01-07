import { parseInput, updateWorkflow, findNodeByClassType } from '../agent-tools/ComfyUIAgentTool';
import { Workflow, ParsedParameters } from '../nodes/types';
import { DEFAULT_WORKFLOW_TEMPLATE } from '../nodes/workflowConfig';

describe('parseInput', () => {
  it('should parse simple prompt without parameters', () => {
    const result = parseInput('a beautiful sunset');
    expect(result.prompt).toBe('a beautiful sunset');
    expect(result.negative_prompt).toBe('ugly, blurry, low quality, distorted');
    expect(result.width).toBe(512);
    expect(result.height).toBe(512);
    expect(result.steps).toBe(20);
    expect(result.cfg).toBe(8);
  });

  it('should parse prompt with negative parameter', () => {
    const result = parseInput('a beautiful sunset negative: dark, gloomy');
    expect(result.prompt).toBe('a beautiful sunset');
    expect(result.negative_prompt).toBe('dark, gloomy');
  });

  it('should parse prompt with size parameter', () => {
    const result = parseInput('a beautiful sunset size: 1024x768');
    expect(result.prompt).toBe('a beautiful sunset');
    expect(result.width).toBe(1024);
    expect(result.height).toBe(768);
  });

  it('should parse prompt with steps parameter', () => {
    const result = parseInput('a beautiful sunset steps: 30');
    expect(result.prompt).toBe('a beautiful sunset');
    expect(result.steps).toBe(30);
  });

  it('should parse prompt with cfg parameter', () => {
    const result = parseInput('a beautiful sunset cfg: 12');
    expect(result.prompt).toBe('a beautiful sunset');
    expect(result.cfg).toBe(12);
  });

  it('should parse prompt with seed parameter', () => {
    const result = parseInput('a beautiful sunset seed: 123456');
    expect(result.prompt).toBe('a beautiful sunset');
    expect(result.seed).toBe(123456);
  });

  it('should parse prompt with multiple parameters', () => {
    const result = parseInput('a beautiful sunset size: 1024x768 steps: 30 cfg: 12 negative: dark, gloomy');
    expect(result.prompt).toBe('a beautiful sunset');
    expect(result.width).toBe(1024);
    expect(result.height).toBe(768);
    expect(result.steps).toBe(30);
    expect(result.cfg).toBe(12);
    expect(result.negative_prompt).toBe('dark, gloomy');
  });

  it('should handle empty prompt', () => {
    const result = parseInput('');
    expect(result.prompt).toBe('');
  });

  it('should handle Chinese commas', () => {
    const result = parseInput('a beautiful sunset，size: 1024x768');
    expect(result.prompt).toBe('a beautiful sunset');
    expect(result.width).toBe(1024);
    expect(result.height).toBe(768);
  });
});

describe('findNodeByClassType', () => {
  it('should find node by class type', () => {
    const nodeId = findNodeByClassType(DEFAULT_WORKFLOW_TEMPLATE, 'KSampler');
    expect(nodeId).toBe('3');
  });

  it('should return null for non-existent class type', () => {
    const nodeId = findNodeByClassType(DEFAULT_WORKFLOW_TEMPLATE, 'NonExistent');
    expect(nodeId).toBeNull();
  });

  it('should return null for empty workflow', () => {
    const nodeId = findNodeByClassType({}, 'KSampler');
    expect(nodeId).toBeNull();
  });
});

describe('updateWorkflow', () => {
  it('should update workflow with parameters', () => {
    const params: ParsedParameters = {
      prompt: 'a beautiful sunset',
      negative_prompt: 'dark, gloomy',
      width: 1024,
      height: 768,
      steps: 30,
      cfg: 12,
      seed: 123456,
    };

    const updatedWorkflow = updateWorkflow(DEFAULT_WORKFLOW_TEMPLATE, params);

    const clipTextEncodeNodes: string[] = [];
    for (const nodeId in updatedWorkflow) {
      if (updatedWorkflow[nodeId].class_type === 'CLIPTextEncode') {
        clipTextEncodeNodes.push(nodeId);
      }
    }

    expect(updatedWorkflow[clipTextEncodeNodes[0]].inputs.text).toBe('a beautiful sunset');
    expect(updatedWorkflow[clipTextEncodeNodes[1]].inputs.text).toBe('dark, gloomy');

    const latentNodeId = findNodeByClassType(updatedWorkflow, 'EmptyLatentImage');
    expect(updatedWorkflow[latentNodeId!].inputs.width).toBe(1024);
    expect(updatedWorkflow[latentNodeId!].inputs.height).toBe(768);

    const samplerNodeId = findNodeByClassType(updatedWorkflow, 'KSampler');
    expect(updatedWorkflow[samplerNodeId!].inputs.steps).toBe(30);
    expect(updatedWorkflow[samplerNodeId!].inputs.cfg).toBe(12);
    expect(updatedWorkflow[samplerNodeId!].inputs.seed).toBe(123456);
  });

  it('should not modify original workflow', () => {
    const params: ParsedParameters = {
      prompt: 'a beautiful sunset',
      negative_prompt: 'dark, gloomy',
      width: 1024,
      height: 768,
      steps: 30,
      cfg: 12,
      seed: 123456,
    };

    const originalText = DEFAULT_WORKFLOW_TEMPLATE['6'].inputs.text;
    updateWorkflow(DEFAULT_WORKFLOW_TEMPLATE, params);

    expect(DEFAULT_WORKFLOW_TEMPLATE['6'].inputs.text).toBe(originalText);
  });

  it('should handle workflow without CLIPTextEncode nodes', () => {
    const simpleWorkflow: Workflow = {
      '1': {
        inputs: { width: 512, height: 512 },
        class_type: 'EmptyLatentImage',
      },
    };

    const params: ParsedParameters = {
      prompt: 'test',
      negative_prompt: 'test negative',
      width: 1024,
      height: 768,
      steps: 20,
      cfg: 8,
      seed: 123,
    };

    const updatedWorkflow = updateWorkflow(simpleWorkflow, params);
    expect(updatedWorkflow['1'].inputs.width).toBe(1024);
    expect(updatedWorkflow['1'].inputs.height).toBe(768);
  });
});