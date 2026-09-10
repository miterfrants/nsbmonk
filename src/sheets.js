import { google } from 'googleapis';

const SHEET_NAME = process.env.SHEET_NAME || '記帳';
// 類型放 D 欄,讓既有的三欄舊資料不會錯位;E、F 欄為累計欄(公式)
export const HEADERS = ['日期', '項目', '金額', '類型', '餘額'];
// 每筆記帳後要塞「=上一列同欄 + 本列C」公式的欄位
export const BALANCE_COLS = ['E', 'F'];

let sheetsClient;

// 建立(並快取)Google Sheets API client
function getClient() {
  if (sheetsClient) return sheetsClient;

  const auth = new google.auth.GoogleAuth({
    keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY || './service-account.json',
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  sheetsClient = google.sheets({ version: 'v4', auth });
  return sheetsClient;
}

function spreadsheetId() {
  const id = process.env.SPREADSHEET_ID;
  if (!id) throw new Error('缺少 SPREADSHEET_ID,請在 .env 設定試算表 ID');
  return id;
}

/**
 * 確保第一列有表頭;若工作表是空的就寫入表頭,
 * 舊版三欄表頭(缺「類型」)則補上 D1
 */
export async function ensureHeaders() {
  const sheets = getClient();
  const id = spreadsheetId();

  const { data } = await sheets.spreadsheets.values.get({
    spreadsheetId: id,
    range: `${SHEET_NAME}!A1:E1`,
  });

  if (!data.values || data.values.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: id,
      range: `${SHEET_NAME}!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [HEADERS] },
    });
    return true; // 有寫入表頭
  }

  // 舊版表頭缺 D1「類型」或 E1「餘額」則補上(只補空的,不覆蓋既有文字)
  const row = data.values[0];
  const patches = [];
  if (!row[3]) patches.push({ range: `${SHEET_NAME}!D1`, values: [['類型']] });
  if (!row[4]) patches.push({ range: `${SHEET_NAME}!E1`, values: [['餘額']] });
  if (patches.length) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: id,
      requestBody: { valueInputOption: 'USER_ENTERED', data: patches },
    });
  }
  return false;
}

/**
 * 從 append 回傳的 updatedRange(例:`'記帳'!A223:D223`)取出列號
 * @returns {number|null}
 */
export function rowNumberFromRange(range) {
  const m = /!\$?[A-Z]+\$?(\d+)/.exec(range || '');
  return m ? Number(m[1]) : null;
}

/**
 * 累計公式:上一列同欄 + 本列金額(第 2 列沒有上一列,直接等於金額)
 * 例:col='E', rowNum=223 → `=E222+C223`
 */
export function balanceFormula(col, rowNum) {
  return rowNum <= 2 ? `=C${rowNum}` : `=${col}${rowNum - 1}+C${rowNum}`;
}

/**
 * 新增一筆記帳到試算表最後一列,並在 E、F 欄塞入累計公式
 * 金額帶正負號:收入為正、支出為負
 * @param {{date:string,item:string,amount:number,type:'收入'|'支出'}} row
 * @returns {Promise<number|null>} 寫入的列號
 */
export async function appendRow(row) {
  const sheets = getClient();
  const id = spreadsheetId();

  const signed = row.type === '收入' ? Math.abs(row.amount) : -Math.abs(row.amount);
  const values = [[row.date, row.item, signed, row.type]];

  const { data } = await sheets.spreadsheets.values.append({
    spreadsheetId: id,
    range: `${SHEET_NAME}!A:D`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values },
  });

  // 拿到剛寫入的列號,再補 E、F 欄公式(公式需要知道自己在第幾列,無法一次 append)
  const rowNum = rowNumberFromRange(data.updates?.updatedRange);
  if (!rowNum) {
    console.warn('[sheets] 無法從回傳取得列號,略過累計公式:', data.updates?.updatedRange);
    return null;
  }

  const first = BALANCE_COLS[0];
  const last = BALANCE_COLS[BALANCE_COLS.length - 1];
  await sheets.spreadsheets.values.update({
    spreadsheetId: id,
    range: `${SHEET_NAME}!${first}${rowNum}:${last}${rowNum}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [BALANCE_COLS.map((col) => balanceFormula(col, rowNum))] },
  });
  return rowNum;
}

/**
 * 讀取指定範圍(例:`總覽!B2` 或 `記帳!F:F`),回傳最後一個非空白的儲存格值。
 * 單一儲存格就是該格的值;整欄則是該欄最後一筆有值的格子(適合「累計餘額」欄)。
 * 預設取原始值(數字就是 number,不受儲存格顯示格式影響),方便自行格式化。
 * @param {string} range A1 表示法,需含分頁名稱
 * @param {{formatted?: boolean}} [opts] formatted=true 則回傳顯示格式的字串
 * @returns {Promise<string|number|null>}
 */
export async function readLastValue(range, { formatted = false } = {}) {
  const sheets = getClient();
  const { data } = await sheets.spreadsheets.values.get({
    spreadsheetId: spreadsheetId(),
    range,
    valueRenderOption: formatted ? 'FORMATTED_VALUE' : 'UNFORMATTED_VALUE',
  });
  const cells = (data.values || []).flat().filter((v) => v !== '' && v != null);
  return cells.length ? cells[cells.length - 1] : null;
}
