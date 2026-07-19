import { getOpenAI, OpenAI } from './openai-client.js';

const MODEL = process.env.WHISPER_MODEL || 'whisper-1';

// MIME type 對應到 Whisper 認得的副檔名
function extFromMime(mimetype = '') {
  if (mimetype.includes('webm')) return 'webm';
  if (mimetype.includes('mp4') || mimetype.includes('m4a')) return 'm4a';
  if (mimetype.includes('ogg')) return 'ogg';
  if (mimetype.includes('wav')) return 'wav';
  if (mimetype.includes('mpeg') || mimetype.includes('mp3')) return 'mp3';
  return 'webm';
}

/**
 * 把音檔 buffer 透過 Whisper 轉成文字
 * @param {Buffer} buffer 音檔內容
 * @param {string} mimetype 例如 audio/webm
 * @returns {Promise<string>} 辨識出的文字
 */
export async function transcribe(buffer, mimetype) {
  const ext = extFromMime(mimetype);
  const file = await OpenAI.toFile(buffer, `audio.${ext}`, { type: mimetype });

  const res = await getOpenAI().audio.transcriptions.create({
    file,
    model: MODEL,
    language: 'zh', // 提示為中文,提升辨識準確度
  });

  return (res.text || '').trim();
}
