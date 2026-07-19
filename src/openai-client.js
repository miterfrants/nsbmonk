import OpenAI from 'openai';

let client;

// 延遲初始化:第一次用到時才建立,避免沒設金鑰就無法啟動 server
export function getOpenAI() {
  if (client) return client;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('缺少 OPENAI_API_KEY,請在 .env 設定 OpenAI 金鑰');
  }
  client = new OpenAI({ apiKey });
  return client;
}

export { OpenAI };
