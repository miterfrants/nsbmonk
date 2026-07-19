// 透過 Brevo 交易型郵件 API 寄送 magic link
const BREVO_API = 'https://api.brevo.com/v3/smtp/email';

export async function sendMagicLink(email, link) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) throw new Error('缺少 BREVO_API_KEY,請在 .env 設定');

  const senderEmail = process.env.SENDER_EMAIL;
  if (!senderEmail) throw new Error('缺少 SENDER_EMAIL(需為 Brevo 已驗證的寄件者)');

  const sender = {
    email: senderEmail,
    name: process.env.SENDER_NAME || '語音記帳',
  };

  const html = `
    <div style="font-family:-apple-system,'Noto Sans TC',sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#5b4a42">
      <h2 style="margin:0 0 12px">🐷 語音記帳 登入連結</h2>
      <p style="line-height:1.7;color:#6b5249">點下面的按鈕就能登入(連結 15 分鐘內有效、只能用一次):</p>
      <p style="text-align:center;margin:28px 0">
        <a href="${link}" style="display:inline-block;background:#3cc49b;color:#fff;text-decoration:none;padding:14px 28px;border-radius:14px;font-weight:600">登入語音記帳</a>
      </p>
      <p style="font-size:12px;color:#a8938a;line-height:1.6">如果不是你本人要求登入,請忽略這封信。<br>連結:${link}</p>
    </div>`;

  const res = await fetch(BREVO_API, {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      sender,
      to: [{ email }],
      subject: '你的語音記帳登入連結 🐷',
      htmlContent: html,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Brevo 寄信失敗 (${res.status}): ${detail}`);
  }
}
