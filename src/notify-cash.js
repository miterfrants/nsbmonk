// 手動觸發一次現金通知(測試用)
//   npm run notify-cash            → 讀試算表並實際推播
//   npm run notify-cash -- --dry   → 只印出訊息,不推播
import 'dotenv/config';
import { buildCashMessage, sendCashNotification } from './cash-notify.js';

const dry = process.argv.includes('--dry') || process.argv.includes('--dry-run');

try {
  if (dry) {
    console.log('[dry-run]', await buildCashMessage());
  } else {
    console.log('已推播:', await sendCashNotification());
  }
} catch (err) {
  console.error('❌', err.message);
  process.exit(1);
}
