// 云函数：ai-chat
// 对接 OpenAI 兼容接口（DeepSeek 协议），由小程序通过 wx.cloud.callFunction 调用
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

// API 配置
// 推荐：在云函数控制台「环境变量」配置 DEEPSEEK_API_KEY 和 DEEPSEEK_API_URL
// 兜底：直接填在下面（仅开发环境使用）
const FALLBACK_KEY = 'sk-phnsanwveQsqVMGYnVjFm3Kxx6jz4Q6LrWY82KXpIrYdLQRA';
const FALLBACK_URL = 'http://1.94.147.144:3360/v1/chat/completions';

const SYSTEM_PROMPT = `你是 FitKeep 的 AI 健身教练，专业、简洁、友好。
- 回答需要结构清晰、可操作
- 涉及训练动作时，给出 组数 × 次数 / 重量 / 组间休息 等具体建议
- 涉及饮食时，给出热量、蛋白质等量化建议
- 不要回答与健身/饮食/健康无关的问题
- 用中文回复，控制在 300 字以内`;

exports.main = async (event, context) => {
  const apiKey = process.env.DEEPSEEK_API_KEY || FALLBACK_KEY;
  const apiUrl = process.env.DEEPSEEK_API_URL || FALLBACK_URL;

  if (!apiKey) {
    return { success: false, error: '未配置 API Key' };
  }

  const messages = (event && event.messages) || [];
  const model = (event && event.model) || 'deepseek-chat';

  if (!Array.isArray(messages) || messages.length === 0) {
    return { success: false, error: 'messages 不能为空' };
  }

  const finalMessages = messages[0] && messages[0].role === 'system'
    ? messages
    : [{ role: 'system', content: SYSTEM_PROMPT }].concat(messages);

  try {
    const res = await callAPI(apiUrl, apiKey, {
      model: model,
      messages: finalMessages,
      temperature: 0.7,
      max_tokens: 1000,
      stream: false
    });
    if (res.error) {
      return { success: false, error: (res.error.message || res.error) + '' };
    }
    const choice = res.choices && res.choices[0];
    return {
      success: true,
      content: choice ? choice.message.content : '',
      usage: res.usage,
      model: res.model
    };
  } catch (err) {
    console.error('[ai-chat] 调用失败', err);
    return { success: false, error: err.message || 'AI 调用异常' };
  }
};

// 自动选择 http / https
function callAPI(apiUrl, apiKey, body) {
  return new Promise(function (resolve, reject) {
    const url = new URL(apiUrl);
    const isHttps = url.protocol === 'https:';
    const lib = isHttps ? require('https') : require('http');
    const data = JSON.stringify(body);
    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + (url.search || ''),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey,
        'Content-Length': Buffer.byteLength(data)
      },
      timeout: 30000
    };
    const req = lib.request(options, function (res) {
      let chunks = '';
      res.setEncoding('utf8');
      res.on('data', function (c) { chunks += c; });
      res.on('end', function () {
        try {
          resolve(JSON.parse(chunks));
        } catch (e) {
          reject(new Error('响应解析失败: ' + chunks.slice(0, 200)));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', function () {
      req.destroy(new Error('请求超时'));
    });
    req.write(data);
    req.end();
  });
}
