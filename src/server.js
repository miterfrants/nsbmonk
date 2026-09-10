import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import cookieParser from 'cookie-parser';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { transcribe } from './transcribe.js';
import { parseExpense } from './parse.js';
import { appendRow, ensureHeaders } from './sheets.js';
import { startCashNotifyScheduler } from './cash-notify.js';
import {
  requestMagicLink,
  verifyMagicToken,
  issueSession,
  clearSession,
  getUser,
  requireAuth,
} from './auth.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
app.set('trust proxy', 1); // 信任 nginx 轉發的 X-Forwarded-* (取得正確 protocol)
app.use(cookieParser());
app.use(express.json());
app.use(express.static(join(__dirname, '..', 'public')));

// 音檔上傳:存在記憶體即可,Whisper 上限 25MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

// 組出對外的網址(優先用 .env 的 APP_URL,否則依請求推斷)
function appUrl(req) {
  return process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
}

// ── 驗證相關 ────────────────────────────────────────────────
// 索取 magic link(不論 email 是否在清單,都回相同訊息,避免列舉)
app.post('/api/auth/request', async (req, res) => {
  try {
    await requestMagicLink(req.body?.email, appUrl(req));
    res.json({ ok: true, message: '若此 email 在允許清單中,登入連結已寄出,請去收信 📮' });
  } catch (err) {
    console.error('[auth/request]', err);
    res.status(500).json({ error: '寄送失敗,請稍後再試' });
  }
});

// 點 magic link:驗證 → 發 cookie → 轉回首頁
app.get('/api/auth/verify', (req, res) => {
  const email = verifyMagicToken(req.query.token);
  if (!email) return res.redirect('/?login=expired');
  issueSession(res, email);
  res.redirect('/?login=ok');
});

// 查目前登入狀態(前端用來決定顯示登入畫面或記帳畫面)
app.get('/api/auth/me', (req, res) => {
  const email = getUser(req);
  if (!email) return res.status(401).json({ error: '未登入' });
  res.json({ email });
});

app.post('/api/auth/logout', (req, res) => {
  clearSession(res);
  res.json({ ok: true });
});

// ── 記帳(需登入)────────────────────────────────────────────
// 步驟一:語音 → 文字 → 解析欄位。⚠️ 不寫入,只回傳給前端確認
app.post('/api/record', requireAuth, upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: '沒有收到音檔' });
    const text = await transcribe(req.file.buffer, req.file.mimetype);
    if (!text) return res.status(400).json({ error: '沒有辨識到內容,請再說一次' });
    const data = await parseExpense(text);
    res.json({ transcript: text, data });
  } catch (err) {
    console.error('[record]', err);
    res.status(500).json({ error: err.message });
  }
});

// 步驟二:使用者按「確認」後才真正寫入 Google Sheet
app.post('/api/confirm', requireAuth, async (req, res) => {
  try {
    const d = req.body?.data || req.body || {};
    if (!d.item && !d.amount) {
      return res.status(400).json({ error: '資料不完整,無法記帳' });
    }
    const row = {
      date: String(d.date || '').trim(),
      item: String(d.item || '').trim(),
      amount: Math.abs(Number(d.amount)) || 0,
      type: d.type === '收入' ? '收入' : '支出',
    };
    await ensureHeaders();
    await appendRow(row);
    res.json({ ok: true, data: row });
  } catch (err) {
    console.error('[confirm]', err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ 語音記帳服務啟動:http://localhost:${PORT}`);
  startCashNotifyScheduler();
});
