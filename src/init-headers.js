import 'dotenv/config';
import { ensureHeaders, HEADERS } from './sheets.js';

// 手動初始化試算表表頭:npm run init-headers
try {
  const wrote = await ensureHeaders();
  if (wrote) {
    console.log(`✅ 已寫入表頭:${HEADERS.join(' | ')}`);
  } else {
    console.log('ℹ️  表頭已存在,無需處理');
  }
} catch (err) {
  console.error('❌ 初始化失敗:', err.message);
  process.exit(1);
}
