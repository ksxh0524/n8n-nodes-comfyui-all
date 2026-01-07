const FormData = require('form-data');
const fs = require('fs');
const axios = require('axios');

async function testUpload() {
  console.log('=== 测试上传图片到ComfyUI ===\n');

  // 创建测试PNG
  const pngBuffer = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
    0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE, 0x00, 0x00, 0x00,
    0x0C, 0x49, 0x44, 0x41, 0x54, 0x08, 0xD7, 0x63, 0xF8, 0xCF, 0xC0, 0x00,
    0x00, 0x03, 0x01, 0x01, 0x00, 0x18, 0xDD, 0x8D, 0xB4, 0x00, 0x00, 0x00,
    0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
  ]);

  console.log('1. 创建FormData...');
  const form = new FormData();
  form.append('image', pngBuffer, { filename: 'test_n8n_node.png' });
  form.append('overwrite', 'true');

  console.log('2. 发送到ComfyUI...');
  try {
    const response = await axios.post('http://127.0.0.1:8188/upload/image', form, {
      headers: {
        ...form.getHeaders(),
      },
      timeout: 10000
    });

    console.log('✅ 上传成功!');
    console.log('响应:', response.data);
    console.log('\n文件名:', response.data.name);

    console.log('\n3. 测试workflow执行...');
    const workflow = {
      "107": {
        "inputs": { "image": response.data.name },
        "class_type": "LoadImage"
      }
    };

    const promptResponse = await axios.post('http://127.0.0.1:8188/prompt', {
      prompt: workflow,
      client_id: 'test_n8n_client'
    });

    console.log('✅ Workflow执行成功!');
    console.log('Prompt ID:', promptResponse.data.prompt_id);

  } catch (error) {
    console.log('❌ 失败:', error.response?.data || error.message);
    if (error.response?.data) {
      console.log('详细错误:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testUpload();
