# 🎙️ 語音記帳 → Google Spreadsheet

對著麥克風講「午餐買咖啡 120 元」,自動辨識、拆成欄位,寫進你的 Google 試算表。

## 架構

```
瀏覽器錄音 ──► Node/Express ──► Whisper(語音轉文字)
                              └► GPT-4o-mini(拆成 日期/項目/金額/分類/備註)
                              └► Google Sheets API(Service Account)寫入一列
```

欄位:`日期 | 項目 | 金額 | 分類 | 備註`

---

## 設定步驟

### 1. 安裝套件

```bash
npm install
```

### 2. OpenAI 金鑰

到 https://platform.openai.com/api-keys 建立一把金鑰。

### 3. Google Service Account(寫試算表用)

1. 進 https://console.cloud.google.com/ → 建立或選一個專案
2. 「API 和服務」→ 啟用 **Google Sheets API**
3. 「憑證」→ 建立憑證 → **服務帳戶** → 建好後進入該帳戶 → 「金鑰」→ 新增金鑰 → **JSON**
4. 下載的 JSON 改名為 `service-account.json`,放到專案根目錄
5. 打開那個 JSON,複製裡面的 `client_email`(長得像 `xxx@xxx.iam.gserviceaccount.com`)
6. **開啟你的 Google 試算表 → 右上「共用」→ 把那個 email 加為「編輯者」**(這步沒做會寫不進去)

### 4. 設定 `.env`

```bash
cp .env.example .env
```

編輯 `.env`,填入:

- `OPENAI_API_KEY`:第 2 步的金鑰
- `SPREADSHEET_ID`:試算表網址 `https://docs.google.com/spreadsheets/d/【這段】/edit` 中間那段
- `SHEET_NAME`:要寫入的分頁名稱(預設 `記帳`,請確認試算表有這個分頁)

### 5. (選用)寫入表頭

```bash
npm run init-headers
```

第一次記帳時也會自動補表頭,這步只是手動先建。

### 6. 啟動

```bash
npm start        # 或 npm run dev(存檔自動重啟)
```

打開 http://localhost:3000 ,**按住**麥克風按鈕說話,放開即記帳。

---

## 注意事項

- **麥克風權限**:瀏覽器只在 `localhost` 或 **HTTPS** 下才允許錄音。手機上要用,需透過 HTTPS(例如 ngrok 或部署到有 SSL 的主機)。
- **費用**:Whisper 約 $0.006/分鐘、GPT-4o-mini 解析每筆不到 $0.001。個人使用每月通常台幣幾十元內。
- 不想用語音時,網頁下方可直接打字記帳。

## API

| 路由 | 說明 |
|------|------|
| `POST /api/record` | multipart,欄位 `audio`(音檔)→ 辨識並記帳 |
| `POST /api/text` | JSON `{ "text": "午餐 120" }` → 解析並記帳 |
