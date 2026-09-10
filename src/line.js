// LINE Messaging API:推播訊息給所有加入官方帳號好友的人
// 文件:https://developers.line.biz/en/reference/messaging-api/#send-broadcast-message
const BROADCAST_API = 'https://api.line.me/v2/bot/message/broadcast';

export function isLineConfigured() {
  return Boolean(process.env.LINE_CHANNEL_ACCESS_TOKEN);
}

/**
 * 廣播一則純文字訊息給所有好友
 * @param {string} text
 */
export async function broadcastText(text) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) throw new Error('缺少 LINE_CHANNEL_ACCESS_TOKEN,請在 .env 設定');

  const res = await fetch(BROADCAST_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ messages: [{ type: 'text', text }] }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`LINE 推播失敗 (${res.status}): ${detail}`);
  }
}
