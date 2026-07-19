import { getOpenAI } from './openai-client.js';

const MODEL = process.env.PARSE_MODEL || 'gpt-4o-mini';

// 取得今天日期(本地時區)YYYY-MM-DD
function today() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * 把一句口語記帳內容,用 GPT 解析成結構化欄位
 * @param {string} text 例如「今天午餐買便當 120 元」「發薪水五萬」
 * @returns {Promise<{date:string,item:string,amount:number,type:'收入'|'支出'}>}
 */
export async function parseExpense(text) {
  const day = today();

  const res = await getOpenAI().chat.completions.create({
    model: MODEL,
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          `你是記帳助理。把使用者的口語記帳內容解析成 JSON,只能回 JSON,不要任何多餘文字。\n` +
          `欄位定義:\n` +
          `- date: 日期,格式 YYYY-MM-DD。若使用者沒明確說日期,就用今天 ${day}。「昨天」「前天」「上週X」等請依今天推算。\n` +
          `- item: 項目的簡短名稱(字串)。\n` +
          `- type: 「收入」或「支出」。薪水、獎金、發票中獎、賣東西、收到錢等是收入;買東西、吃飯、繳費等花錢的是支出。無法判斷時填「支出」。\n` +
          `- amount: 金額,正的純數字(新台幣),不要含貨幣符號或正負號。無法判斷時填 0。`,
      },
      { role: 'user', content: text },
    ],
  });

  let data;
  try {
    data = JSON.parse(res.choices[0].message.content);
  } catch {
    data = {};
  }

  // 正規化 / 補預設值,避免欄位缺漏
  return {
    date: data.date || day,
    item: data.item || text,
    amount: Math.abs(Number(data.amount)) || 0,
    type: data.type === '收入' ? '收入' : '支出',
  };
}
