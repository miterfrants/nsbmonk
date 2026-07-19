import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { sendMagicLink } from './mailer.js';

const COOKIE_NAME = 'vl_session';
const MAGIC_TTL_SEC = 15 * 60; // magic link 有效 15 分鐘
const SESSION_TTL_DAYS = Number(process.env.JWT_TTL_DAYS || 30);

function secret() {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('缺少 JWT_SECRET,請在 .env 設定一段隨機字串');
  return s;
}

// ── allowlist ────────────────────────────────────────────────
export function allowedEmails() {
  return (process.env.ALLOWED_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}
export function isAllowed(email) {
  return allowedEmails().includes(String(email || '').trim().toLowerCase());
}

// ── 一次性 magic token 暫存(記憶體;server 重啟即失效)──────────
const pending = new Map(); // jti -> 到期毫秒
function gcPending() {
  const now = Date.now();
  for (const [jti, exp] of pending) if (exp < now) pending.delete(jti);
}

/**
 * 索取 magic link:email 在 allowlist 才寄信
 * @returns {Promise<boolean>} 是否真的寄出(不在清單回 false)
 */
export async function requestMagicLink(email, appUrl) {
  const e = String(email || '').trim().toLowerCase();
  if (!isAllowed(e)) return false; // 靜默,不洩漏清單

  const jti = crypto.randomUUID();
  pending.set(jti, Date.now() + MAGIC_TTL_SEC * 1000);

  const token = jwt.sign({ email: e, purpose: 'magic', jti }, secret(), {
    expiresIn: MAGIC_TTL_SEC,
  });
  const link = `${appUrl}/api/auth/verify?token=${encodeURIComponent(token)}`;
  await sendMagicLink(e, link);
  return true;
}

/**
 * 驗證 magic token,通過回傳 email,否則 null。驗證成功即作廢(一次性)
 */
export function verifyMagicToken(token) {
  let payload;
  try {
    payload = jwt.verify(token, secret());
  } catch {
    return null;
  }
  if (payload.purpose !== 'magic' || !payload.jti) return null;

  gcPending();
  if (!pending.has(payload.jti)) return null; // 已用過、過期或 server 重啟過
  pending.delete(payload.jti); // 一次性:用掉就移除

  if (!isAllowed(payload.email)) return null;
  return payload.email;
}

// ── session cookie ───────────────────────────────────────────
export function issueSession(res, email) {
  const token = jwt.sign({ email, purpose: 'session' }, secret(), {
    expiresIn: `${SESSION_TTL_DAYS}d`,
  });
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

export function clearSession(res) {
  res.clearCookie(COOKIE_NAME, { path: '/' });
}

// 從 cookie 取得已登入的 email,沒登入回 null
export function getUser(req) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return null;
  try {
    const p = jwt.verify(token, secret());
    if (p.purpose !== 'session' || !isAllowed(p.email)) return null;
    return p.email;
  } catch {
    return null;
  }
}

// 保護路由的 middleware
export function requireAuth(req, res, next) {
  const email = getUser(req);
  if (!email) return res.status(401).json({ error: '請先登入' });
  req.userEmail = email;
  next();
}
