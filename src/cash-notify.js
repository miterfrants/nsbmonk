// 「現金餘額」LINE 通知:讀試算表 F 欄最後一格 → 廣播給所有好友
// 每天 GMT+8 00:00 與 12:00 各一次(由 startCashNotifyScheduler 排程)
import { readLastValue } from './sheets.js';
import { broadcastText, isLineConfigured } from './line.js';

const TZ_OFFSET_MS = 8 * 60 * 60 * 1000; // GMT+8,無日光節約時間
const INTERVAL_MS = 12 * 60 * 60 * 1000; // 每 12 小時:00:00、12:00

// 預設讀記帳分頁的 F 欄(累計餘額),取最後一個有值的格子
function cashRange() {
  return process.env.CASH_RANGE || `${process.env.SHEET_NAME || '記帳'}!F:F`;
}

/** 組出要送的訊息文字 */
export async function buildCashMessage() {
  const value = await readLastValue(cashRange());
  return `現金餘額 ${value ?? '(讀不到資料)'}`;
}

/** 讀試算表並推播一次 */
export async function sendCashNotification() {
  const text = await buildCashMessage();
  await broadcastText(text);
  return text;
}

/** 下一個 GMT+8 00:00 或 12:00 的時間戳(UTC ms) */
export function nextRunAt(now = Date.now()) {
  const local = now + TZ_OFFSET_MS;
  const next = (Math.floor(local / INTERVAL_MS) + 1) * INTERVAL_MS;
  return next - TZ_OFFSET_MS;
}

/**
 * 啟動排程。未設定 LINE token 就略過,不影響主服務。
 * 用 setTimeout 而非 setInterval,避免程序長時間執行後累積漂移。
 */
export function startCashNotifyScheduler() {
  if (!isLineConfigured()) {
    console.log('ℹ️  未設定 LINE_CHANNEL_ACCESS_TOKEN,略過現金通知排程');
    return;
  }

  const schedule = () => {
    const at = nextRunAt();
    const delay = at - Date.now();
    console.log(`⏰ 下次現金通知:${new Date(at).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}`);
    setTimeout(async () => {
      try {
        const text = await sendCashNotification();
        console.log('[cash-notify] 已推播:', text);
      } catch (err) {
        console.error('[cash-notify] 失敗:', err.message);
      }
      schedule();
    }, delay);
  };

  schedule();
}
