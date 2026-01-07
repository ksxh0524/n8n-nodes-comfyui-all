"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ComfyUi = void 0;
const n8n_workflow_1 = require("n8n-workflow");
const ComfyUiClient_1 = require("../ComfyUiClient");
const validation_1 = require("../validation");
const constants_1 = require("../constants");
const logger_1 = require("../logger");
const logger = (0, logger_1.createLogger)('ComfyUi');
class ComfyUi {
    constructor() {
        this.description = {
            displayName: 'ComfyUI',
            name: 'comfyUi',
            icon: 'file:comfyui.svg',
            iconColor: '#FF6B6B',
            group: ['transform'],
            version: [1],
            defaultVersion: 1,
            description: 'Generate images, videos, and more using ComfyUI.',
            defaults: {
                name: 'ComfyUI',
            },
            usableAsTool: true,
            inputs: ['main'],
            outputs: ['main'],
            properties: [
                {
                    displayName: 'ComfyUI URL',
                    name: 'comfyUiUrl',
                    type: 'string',
                    required: true,
                    default: 'http://127.0.0.1:8188',
                    description: 'URL of ComfyUI server',
                },
                {
                    displayName: 'Action',
                    name: 'action',
                    type: 'options',
                    required: true,
                    default: 'textToAny',
                    options: [
                        {
                            name: 'TextToAny',
                            value: 'textToAny',
                            action: 'Generate images videos and more from text',
                        },
                        {
                            name: 'ImagesToAny',
                            value: 'imagesToAny',
                            action: 'Generate images videos and more from images',
                        },
                    ],
                },
                {
                    displayName: 'Workflow JSON',
                    name: 'workflowJson',
                    type: 'string',
                    typeOptions: {
                        rows: 20,
                    },
                    required: true,
                    default: '',
                    description: 'Paste your ComfyUI workflow JSON (API Format). In ComfyUI: 1. Design your workflow 2. Click "Save (API Format)" to export 3. Copy generated JSON 4. Paste it here. Tip: Configure all parameters directly in JSON (prompts, resolution, sampling parameters, frames, etc.).',
                    placeholder: 'Paste your ComfyUI workflow JSON...\n\n{\n  "3": {\n    "inputs": {\n      "seed": 123456789,\n      "steps": 20,\n      ...\n    },\n    "class_type": "KSampler"\n  }\n}',
                    hint: 'Copy API Format workflow from ComfyUI and paste it here. You can edit all parameters directly in JSON.',
                    displayOptions: {
                        show: {
                            action: ['textToAny', 'imagesToAny'],
                        },
                    },
                },
                {
                    displayName: 'Timeout (Seconds)',
                    name: 'timeout',
                    type: 'number',
                    default: 300,
                    description: 'Maximum time to wait for workflow execution (in seconds). Default: 300 (5 minutes).',
                    minValue: 10,
                    maxValue: 3600,
                },
                {
                    displayName: 'Output Binary Key',
                    name: 'outputBinaryKey',
                    type: 'string',
                    default: 'data',
                    description: 'Property name for the first output binary data (e.g., "data", "image", "output")',
                    placeholder: 'data',
                },
                {
                    displayName: 'Node Parameters',
                    name: 'nodeParameters',
                    type: 'fixedCollection',
                    typeOptions: {
                        multipleValues: true,
                        sortable: true,
                    },
                    description: 'Override parameters for a node. Click the arrow icon (▼) on each parameter item to collapse/expand it.',
                    displayOptions: {
                        show: {
                            action: ['textToAny', 'imagesToAny'],
                        },
                    },
                    default: {},
                    options: [
                        {
                            displayName: 'Node Parameter',
                            name: 'nodeParameter',
                            values: [
                                {
                                    displayName: 'Node ID',
                                    name: 'nodeId',
                                    type: 'string',
                                    default: '',
                                    description: 'The node ID in your workflow (e.g., \'13\', \'3\', \'6\')',
                                    placeholder: '13',
                                    required: true,
                                },
                                {
                                    displayName: 'Parameter Mode',
                                    name: 'parameterMode',
                                    type: 'options',
                                    default: 'single',
                                    description: 'Choose how to configure parameters',
                                    options: [
                                        {
                                            name: 'Single Parameter',
                                            value: 'single',
                                            description: 'Configure one parameter at a time',
                                        },
                                        {
                                            name: 'Multiple Parameters',
                                            value: 'multiple',
                                            description: 'Configure multiple parameters at once using JSON',
                                        },
                                    ]
                                },
                                {
                                    displayName: 'Parameter Name',
                                    name: 'paramName',
                                    type: 'string',
                                    default: '',
                                    description: 'The parameter name to override (e.g., \'text\', \'seed\', \'steps\', \'width\'). Use this for single parameter mode.',
                                    placeholder: 'width',
                                    displayOptions: {
                                        show: {
                                            parameterMode: ['single'],
                                        },
                                    },
                                },
                                {
                                    displayName: 'Parameters JSON',
                                    name: 'parametersJson',
                                    type: 'string',
                                    typeOptions: {
                                        rows: 10,
                                    },
                                    default: '',
                                    description: 'JSON object containing all parameters for this node. Example: {\'width\': 1024, \'height\': 1024, \'batch_size\': 1}. Use this to configure multiple parameters at once.',
                                    placeholder: '{\n  \'width\': 1024,\n  \'height\': 1024,\n  \'batch_size\': 1\n}',
                                    displayOptions: {
                                        show: {
                                            parameterMode: ['multiple'],
                                        },
                                    },
                                },
                                {
                                    displayName: 'Type',
                                    name: 'type',
                                    type: 'options',
                                    default: 'text',
                                    description: 'Data type of parameter (for single parameter mode)',
                                    options: [
                                        {
                                            name: 'Text',
                                            value: 'text',
                                            description: 'String/text value',
                                        },
                                        {
                                            name: 'Number',
                                            value: 'number',
                                            description: 'Numeric value',
                                        },
                                        {
                                            name: 'Boolean',
                                            value: 'boolean',
                                            description: 'True/False',
                                        },
                                        {
                                            name: 'Image',
                                            value: 'image',
                                            description: 'Image file (from binary data or URL)',
                                        },
                                    ],
                                    displayOptions: {
                                        show: {
                                            parameterMode: ['single'],
                                        },
                                    },
                                },
                                {
                                    displayName: 'Image Input Type',
                                    name: 'imageSource',
                                    type: 'options',
                                    default: 'binary',
                                    description: 'How to input the image',
                                    options: [
                                        {
                                            name: 'Binary',
                                            value: 'binary',
                                            description: 'Use binary data from input',
                                        },
                                        {
                                            name: 'URL',
                                            value: 'url',
                                            description: 'Download from URL',
                                        },
                                    ],
                                    displayOptions: {
                                        show: {
                                            parameterMode: ['single'],
                                            type: ['image'],
                                        },
                                    },
                                },
                                {
                                    displayName: 'Image URL',
                                    name: 'imageUrl',
                                    type: 'string',
                                    default: '',
                                    description: 'URL of the image to download and upload to ComfyUI',
                                    placeholder: 'https://example.com/image.png',
                                    displayOptions: {
                                        show: {
                                            parameterMode: ['single'],
                                            type: ['image'],
                                            imageSource: ['url'],
                                        },
                                    },
                                    hint: 'Enter the URL of the image to use',
                                },
                                {
                                    displayName: 'Value',
                                    name: 'value',
                                    type: 'string',
                                    default: '',
                                    description: 'The value to set',
                                    placeholder: 'Enter text...',
                                    displayOptions: {
                                        show: {
                                            parameterMode: ['single'],
                                            type: ['text'],
                                        },
                                    },
                                },
                                {
                                    displayName: 'Value',
                                    name: 'value',
                                    type: 'string',
                                    default: '',
                                    description: 'Binary property name from input data (e.g., "data", "image", "file")',
                                    placeholder: 'data',
                                    displayOptions: {
                                        show: {
                                            parameterMode: ['single'],
                                            type: ['image'],
                                            imageSource: ['binary'],
                                        },
                                    },
                                    hint: 'Enter the binary property name to use as input',
                                },
                                {
                                    displayName: 'Value',
                                    name: 'numberValue',
                                    type: 'number',
                                    default: 0,
                                    description: 'The numeric value to set',
                                    placeholder: 'Enter number...',
                                    displayOptions: {
                                        show: {
                                            parameterMode: ['single'],
                                            type: ['number'],
                                        },
                                    },
                                },
                                {
                                    displayName: 'Value',
                                    name: 'booleanValue',
                                    type: 'options',
                                    default: 'false',
                                    description: 'The boolean value to set',
                                    options: [
                                        {
                                            name: 'True',
                                            value: 'true',
                                            description: 'Enable/set to true',
                                        },
                                        {
                                            name: 'False',
                                            value: 'false',
                                            description: 'Disable/set to false',
                                        },
                                    ],
                                    displayOptions: {
                                        show: {
                                            parameterMode: ['single'],
                                            type: ['boolean'],
                                        },
                                    },
                                },
                            ],
                        },
                    ],
                },
            ],
        };
    }
    async execute() {
        const comfyUiUrl = this.getNodeParameter('comfyUiUrl', 0);
        const workflowJson = this.getNodeParameter('workflowJson', 0);
        const timeout = this.getNodeParameter('timeout', 0);
        const action = this.getNodeParameter('action', 0);
        const outputBinaryKey = this.getNodeParameter('outputBinaryKey', 0) || 'data';
        if (!(0, validation_1.validateUrl)(comfyUiUrl)) {
            throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Invalid ComfyUI URL. Must be a valid HTTP/HTTPS URL.');
        }
        if (action === 'imagesToAny') {
            const inputData = this.getInputData(0);
            if (!inputData || !inputData[0] || !inputData[0].binary || Object.keys(inputData[0].binary).length === 0) {
                throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'ImagesToAny action requires an image input. Please connect a node that outputs binary image data.');
            }
        }
        const workflowValidation = (0, validation_1.validateComfyUIWorkflow)(workflowJson);
        if (!workflowValidation.valid) {
            throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Invalid ComfyUI workflow: ${workflowValidation.error}. Please ensure you export your workflow in API format from ComfyUI.`);
        }
        let workflow;
        try {
            workflow = JSON.parse(workflowJson);
        }
        catch (error) {
            throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Failed to parse workflow JSON: ${error}. Please ensure the JSON is valid.`);
        }
        const client = new ComfyUiClient_1.ComfyUIClient({
            baseUrl: comfyUiUrl,
            timeout: timeout * 1000,
            helpers: this.helpers,
        });
        logger.info('Starting ComfyUI workflow execution', { url: comfyUiUrl, timeout, action });
        try {
            const nodeParametersInput = this.getNodeParameter('nodeParameters', 0);
            if (nodeParametersInput && nodeParametersInput.nodeParameter && Array.isArray(nodeParametersInput.nodeParameter)) {
                logger.debug(`Processing ${nodeParametersInput.nodeParameter.length} node parameter overrides`);
                for (let i = 0; i < nodeParametersInput.nodeParameter.length; i++) {
                    const nodeParamConfig = nodeParametersInput.nodeParameter[i];
                    const nodeId = nodeParamConfig.nodeId;
                    const parameterMode = nodeParamConfig.parameterMode || 'single';
                    const parametersJson = nodeParamConfig.parametersJson;
                    const paramName = nodeParamConfig.paramName;
                    const type = nodeParamConfig.type || 'text';
                    const imageSource = nodeParamConfig.imageSource || 'binary';
                    // Get the appropriate value based on type
                    const value = nodeParamConfig.value || '';
                    const numberValue = nodeParamConfig.numberValue;
                    const booleanValue = nodeParamConfig.booleanValue;
                    const imageUrl = nodeParamConfig.imageUrl || '';
                    if (!nodeId) {
                        throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Node Parameters ${i + 1} is missing Node ID.`);
                    }
                    if (!workflow[nodeId]) {
                        throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Node ID "${nodeId}" not found in workflow. Please check your workflow JSON.`);
                    }
                    if (!workflow[nodeId].inputs) {
                        workflow[nodeId].inputs = {};
                    }
                    if (parameterMode === 'multiple' && parametersJson) {
                        let parameters;
                        try {
                            parameters = JSON.parse(parametersJson);
                        }
                        catch (error) {
                            throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Node Parameters ${i + 1}: Invalid JSON in parameters field: ${error}`);
                        }
                        if (typeof parameters !== 'object' || parameters === null) {
                            throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Node Parameters ${i + 1}: Parameters must be a JSON object`);
                        }
                        logger.debug(`Applying multiple parameters to node ${nodeId}`, { parameters });
                        for (const [paramName, value] of Object.entries(parameters)) {
                            workflow[nodeId].inputs[paramName] = value;
                        }
                    }
                    else if (parameterMode === 'single' && paramName) {
                        if (!type) {
                            throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Node Parameters ${i + 1}: Type is required for single parameter mode.`);
                        }
                        let parsedValue;
                        switch (type) {
                            case 'text':
                                parsedValue = value || '';
                                workflow[nodeId].inputs[paramName] = parsedValue;
                                break;
                            case 'number':
                                parsedValue = numberValue !== undefined ? numberValue : 0;
                                workflow[nodeId].inputs[paramName] = parsedValue;
                                break;
                            case 'boolean':
                                parsedValue = booleanValue === 'true' || booleanValue === true;
                                workflow[nodeId].inputs[paramName] = parsedValue;
                                break;
                            case 'image':
                                logger.info(`Processing image parameter for node ${nodeId}`, { paramName, imageSource, imageUrl: imageUrl || 'N/A', value: value || 'N/A' });
                                if (imageSource === 'url') {
                                    // Download image from URL
                                    if (!imageUrl) {
                                        throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Node Parameters ${i + 1}: Image URL is required when Image Source is set to URL.`);
                                    }
                                    // Validate URL
                                    if (!(0, validation_1.validateUrl)(imageUrl)) {
                                        throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Node Parameters ${i + 1}: Invalid image URL "${imageUrl}". Must be a valid HTTP/HTTPS URL.`);
                                    }
                                    // Check if this is a ComfyUI URL (from the same server)
                                    const isComfyUIUrl = imageUrl.includes(comfyUiUrl) || imageUrl.includes('/view?filename=');
                                    if (isComfyUIUrl) {
                                        // This is a ComfyUI URL, extract filename directly
                                        logger.info(`Detected ComfyUI URL, extracting filename directly`, { url: imageUrl, paramName });
                                        try {
                                            const urlObj = new URL(imageUrl);
                                            const filename = urlObj.searchParams.get('filename');
                                            if (!filename) {
                                                throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Node Parameters ${i + 1}: Could not extract filename from ComfyUI URL "${imageUrl}". The URL must contain a "filename" parameter.`);
                                            }
                                            // Use the filename directly
                                            parsedValue = filename;
                                            workflow[nodeId].inputs[paramName] = parsedValue;
                                            logger.info(`Successfully extracted ComfyUI filename`, { paramName, filename });
                                        }
                                        catch (error) {
                                            throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Node Parameters ${i + 1}: Failed to parse ComfyUI URL "${imageUrl}": ${error.message}`);
                                        }
                                    }
                                    else {
                                        // External URL, need to download and upload
                                        logger.info(`Downloading image from external URL`, { url: imageUrl, paramName });
                                        try {
                                            const imageResponse = await this.helpers.httpRequest({
                                                method: 'GET',
                                                url: imageUrl,
                                                encoding: 'arraybuffer',
                                                timeout: timeout * 1000,
                                                headers: {
                                                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                                                    'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                                                    'Accept-Language': 'en-US,en;q=0.9',
                                                },
                                            });
                                            if (!imageResponse || !Buffer.isBuffer(imageResponse)) {
                                                throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Node Parameters ${i + 1}: Failed to download image from URL "${imageUrl}". The server did not return valid image data. Please check the URL and try again.`);
                                            }
                                            const imageBuffer = Buffer.from(imageResponse);
                                            // Check if buffer is empty
                                            if (imageBuffer.length === 0) {
                                                throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Node Parameters ${i + 1}: Downloaded image from URL "${imageUrl}" is empty. Please check the URL and try again.`);
                                            }
                                            logger.info(`Successfully downloaded image`, { size: imageBuffer.length, url: imageUrl });
                                            // Extract filename from URL or generate default
                                            let filename = imageUrl.split('/').pop() || `download_${Date.now()}.png`;
                                            if (filename.includes('?')) {
                                                filename = filename.split('?')[0];
                                            }
                                            if (!filename.match(/\.(png|jpg|jpeg|webp|gif|bmp)$/i)) {
                                                filename = `download_${Date.now()}.png`;
                                            }
                                            logger.info(`Uploading image to ComfyUI`, { filename, size: imageBuffer.length });
                                            // Upload to ComfyUI and get the filename
                                            const uploadedFilename = await client.uploadImage(imageBuffer, filename);
                                            // Set the parameter value to the uploaded filename
                                            parsedValue = uploadedFilename;
                                            workflow[nodeId].inputs[paramName] = parsedValue;
                                            logger.info(`Successfully uploaded image to ComfyUI`, { paramName, filename: uploadedFilename });
                                        }
                                        catch (error) {
                                            if (error instanceof n8n_workflow_1.NodeOperationError) {
                                                throw error;
                                            }
                                            // Provide more helpful error message
                                            const statusCode = error.response?.statusCode || error.statusCode;
                                            const statusMessage = error.response?.statusMessage || error.statusMessage;
                                            let errorMessage = `Node Parameters ${i + 1}: Failed to download image from URL "${imageUrl}"`;
                                            if (statusCode) {
                                                errorMessage += ` (HTTP ${statusCode} ${statusMessage || ''})`;
                                            }
                                            errorMessage += `. ${error.message}`;
                                            // Add helpful hints
                                            if (statusCode === 403) {
                                                errorMessage += ' Note: The URL may require authentication or block automated access. Try downloading the image manually and using Binary mode instead.';
                                            }
                                            else if (statusCode === 404) {
                                                errorMessage += ' Note: The URL may be incorrect or the image may have been removed.';
                                            }
                                            else if (statusCode === 400) {
                                                errorMessage += ' Note: The URL may be malformed or the server may be rejecting the request. Try using a different URL or download the image manually and use Binary mode.';
                                            }
                                            throw new n8n_workflow_1.NodeOperationError(this.getNode(), errorMessage);
                                        }
                                    }
                                }
                                else {
                                    // Get input binary data
                                    logger.info(`Getting binary data from input`, { binaryProperty: value || 'data', paramName });
                                    const inputData = this.getInputData(0);
                                    const binaryPropertyName = value || 'data';
                                    if (!inputData || !inputData[0] || !inputData[0].binary || !inputData[0].binary[binaryPropertyName]) {
                                        const availableKeys = inputData && inputData[0] && inputData[0].binary ? Object.keys(inputData[0].binary).join(', ') : 'none';
                                        throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Node Parameters ${i + 1}: Binary property "${binaryPropertyName}" not found in input data. Available binary properties: ${availableKeys}. Please check the input node configuration.`);
                                    }
                                    const binaryData = inputData[0].binary[binaryPropertyName];
                                    // Validate binary data
                                    if (!binaryData.data || typeof binaryData.data !== 'string') {
                                        throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Node Parameters ${i + 1}: Invalid binary data for property "${binaryPropertyName}". The data field is missing or not a string.`);
                                    }
                                    const buffer = Buffer.from(binaryData.data, 'base64');
                                    // Validate buffer
                                    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
                                        throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Node Parameters ${i + 1}: Failed to decode binary data for property "${binaryPropertyName}". The data may be corrupted. Buffer length: ${buffer.length}`);
                                    }
                                    const filename = binaryData.fileName || `upload_${Date.now()}.${binaryData.mimeType.split('/')[1] || 'png'}`;
                                    logger.info(`Uploading binary data to ComfyUI`, { filename, size: buffer.length, mimeType: binaryData.mimeType, paramName });
                                    // Upload to ComfyUI and get the filename
                                    const uploadedFilename = await client.uploadImage(buffer, filename);
                                    // Set the parameter value to the uploaded filename
                                    parsedValue = uploadedFilename;
                                    workflow[nodeId].inputs[paramName] = parsedValue;
                                    logger.info(`Successfully uploaded binary data`, { paramName, filename: uploadedFilename });
                                }
                                break;
                            default:
                                throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Node Parameters ${i + 1}: Unknown type "${type}"`);
                        }
                        logger.debug(`Applying single parameter to node ${nodeId}`, { paramName, value: parsedValue });
                    }
                    else {
                        throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Node Parameters ${i + 1}: For Multiple Parameters mode, provide Parameters JSON. For Single Parameter mode, provide Parameter Name and Value.`);
                    }
                }
            }
            logger.info('Executing ComfyUI workflow', { nodeCount: Object.keys(workflow).length, comfyUiUrl });
            const result = await client.executeWorkflow(workflow);
            if (!result.success) {
                logger.error('Workflow execution failed', result.error);
                throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Failed to execute workflow: ${result.error}`);
            }
            const { json, binary } = await processResults(result, client, comfyUiUrl, outputBinaryKey);
            logger.info('Workflow execution completed successfully', {
                imageCount: json.imageCount,
                videoCount: json.videoCount,
            });
            // Binary data is already included in the json object
            // No need for additional processing here
            return [this.helpers.constructExecutionMetaData([{ json, binary }], { itemData: { item: 0 } })];
        }
        catch (error) {
            logger.error('Error during workflow execution', error);
            throw error;
        }
        finally {
            client.destroy();
            logger.debug('Client destroyed');
        }
    }
}
exports.ComfyUi = ComfyUi;
async function processResults(result, client, comfyUiUrl, outputBinaryKey = 'data') {
    const jsonData = {
        success: true,
    };
    if (result.output) {
        jsonData.data = result.output;
    }
    // Add image URLs for AI Agent compatibility
    if (result.images && result.images.length > 0) {
        jsonData.images = result.images;
        jsonData.imageUrls = result.images.map(img => `${comfyUiUrl}${img}`);
    }
    // Add video URLs for AI Agent compatibility
    if (result.videos && result.videos.length > 0) {
        jsonData.videos = result.videos;
        jsonData.videoUrls = result.videos.map(vid => `${comfyUiUrl}${vid}`);
    }
    const binaryData = {};
    if (result.images && result.images.length > 0) {
        for (let i = 0; i < result.images.length; i++) {
            const imagePath = result.images[i];
            const imageBuffer = await client.getImageBuffer(imagePath);
            const filenameMatch = imagePath.match(/filename=([^&]+)/);
            const filename = filenameMatch ? filenameMatch[1] : `image_${i}`;
            let ext = 'png';
            const extMatch = filename.match(/\.([^.]+)$/);
            if (extMatch) {
                ext = extMatch[1].toLowerCase();
            }
            if (!extMatch && imagePath.includes('type=')) {
                const typeMatch = imagePath.match(/type=([^&]+)/);
                if (typeMatch) {
                    const type = typeMatch[1].toLowerCase();
                    const mimeMap = {
                        'input': 'png',
                        'output': 'png',
                        'temp': 'png',
                    };
                    ext = mimeMap[type] || 'png';
                }
            }
            const mimeType = constants_1.IMAGE_MIME_TYPES[ext] || 'image/png';
            const binaryKey = i === 0 ? outputBinaryKey : `image_${i}`;
            binaryData[binaryKey] = {
                data: imageBuffer.toString('base64'),
                mimeType: mimeType,
                fileName: filename,
            };
        }
        jsonData.imageCount = result.images.length;
    }
    if (result.videos && result.videos.length > 0) {
        for (let i = 0; i < result.videos.length; i++) {
            const videoPath = result.videos[i];
            const typeMatch = videoPath.match(/type=([^&]+)/);
            let videoType = 'mp4';
            if (typeMatch) {
                videoType = typeMatch[1].toLowerCase();
            }
            const filenameMatch = videoPath.match(/filename=([^&]+)/);
            let filename = filenameMatch ? filenameMatch[1] : `video_${i}.mp4`;
            const extMatch = filename.match(/\.([^.]+)$/);
            if (extMatch) {
                videoType = extMatch[1].toLowerCase();
            }
            else {
                filename = `${filename}.${videoType}`;
            }
            const mimeType = constants_1.VIDEO_MIME_TYPES[videoType] || 'video/mp4';
            const videoBuffer = await client.getVideoBuffer(videoPath);
            // If there are no images, make first video outputBinaryKey for preview
            // If there are images, all videos use video_0, video_1, etc.
            const hasImages = result.images && result.images.length > 0;
            const binaryKey = (!hasImages && i === 0) ? outputBinaryKey : `video_${i}`;
            binaryData[binaryKey] = {
                data: videoBuffer.toString('base64'),
                mimeType: mimeType,
                fileName: filename,
            };
        }
        jsonData.videoCount = result.videos.length;
    }
    return {
        json: jsonData,
        binary: binaryData,
    };
}
//# sourceMappingURL=ComfyUi.node.js.map