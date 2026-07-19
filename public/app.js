const loginEl = document.getElementById('login');
const stageEl = document.getElementById('stage');
const reviewEl = document.getElementById('review');
const doneEl = document.getElementById('done');

const loginForm = document.getElementById('loginForm');
const emailInput = document.getElementById('email');
const loginBtn = document.getElementById('loginBtn');
const loginHint = document.getElementById('loginHint');

const micBtn = document.getElementById('mic');
const statusEl = document.getElementById('status');

const bubbleEl = document.getElementById('bubble');
const fType = document.getElementById('f-type');
const fItem = document.getElementById('f-item');
const fAmount = document.getElementById('f-amount');
const fDate = document.getElementById('f-date');

const retryBtn = document.getElementById('retry');
const confirmBtn = document.getElementById('confirm');
const doneSub = document.getElementById('doneSub');

let mediaRecorder = null;
let chunks = [];
let stream = null;

function setStatus(msg, state) {
  statusEl.textContent = msg || '';
  if (state) statusEl.setAttribute('data-state', state);
  else statusEl.removeAttribute('data-state');
}

function show(section) {
  for (const el of [loginEl, stageEl, reviewEl, doneEl]) {
    el.classList.toggle('hide', el !== section);
  }
}

function resetToMic() {
  show(stageEl);
  setStatus('');
}

// ── 啟動:檢查登入狀態 ─────────────────────────────────────
async function boot() {
  // 處理 magic link 導回的提示
  const params = new URLSearchParams(location.search);
  if (params.get('login') === 'expired') {
    setLoginHint('連結已失效或用過了,請重新索取 🥲', 'err');
  }
  if (params.has('login')) {
    history.replaceState(null, '', location.pathname); // 清掉網址參數
  }

  try {
    const res = await fetch('/api/auth/me');
    if (res.ok) {
      resetToMic();
    } else {
      show(loginEl);
    }
  } catch {
    show(loginEl);
  }
}

function setLoginHint(msg, state) {
  loginHint.textContent = msg;
  loginHint.className = 'login__hint' + (state ? ' ' + state : '');
}

// ── 登入:寄 magic link ────────────────────────────────────
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = emailInput.value.trim();
  if (!email) return;
  loginBtn.disabled = true;
  loginBtn.textContent = '寄送中…';
  try {
    const res = await fetch('/api/auth/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || '寄送失敗');
    setLoginHint('信寄出囉,去收信點連結就能登入 📮', 'ok');
  } catch (err) {
    setLoginHint(err.message, 'err');
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = '寄送登入連結';
  }
});

// ── 錄音 ──────────────────────────────────────────────────
async function startRecording() {
  if (mediaRecorder && mediaRecorder.state === 'recording') return;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    setStatus('要開麥克風權限才能聽你說喔 🥺', 'err');
    return;
  }
  chunks = [];
  mediaRecorder = new MediaRecorder(stream);
  mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
  mediaRecorder.onstop = () => {
    const blob = new Blob(chunks, { type: 'audio/webm' });
    stream.getTracks().forEach((t) => t.stop());
    if (blob.size > 0) sendAudio(blob);
  };
  mediaRecorder.start();
  micBtn.classList.add('recording');
  setStatus('我在聽…放開就好 👂', 'rec');
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.stop();
  if (micBtn.classList.contains('recording')) {
    micBtn.classList.remove('recording');
    setStatus('辨識中… 🤔', 'busy');
  }
}

// ── 辨識(不寫入,回傳結果讓使用者確認)──────────────────────
async function sendAudio(blob) {
  setStatus('辨識中… 🤔', 'busy');
  const form = new FormData();
  form.append('audio', blob, 'recording.webm');
  try {
    const res = await fetch('/api/record', { method: 'POST', body: form });
    if (res.status === 401) return show(loginEl);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || '出錯了');
    fillReview(json);
  } catch (err) {
    setStatus(err.message + ' 再試一次吧', 'err');
  }
}

// ── 收入/支出切換 ─────────────────────────────────────────
function getType() {
  const active = fType.querySelector('.type-toggle__btn.active');
  return active?.dataset.type === '收入' ? '收入' : '支出';
}
function setType(type) {
  for (const btn of fType.querySelectorAll('.type-toggle__btn')) {
    btn.classList.toggle('active', btn.dataset.type === type);
  }
}
fType.addEventListener('click', (e) => {
  const btn = e.target.closest('.type-toggle__btn');
  if (btn) setType(btn.dataset.type);
});

function fillReview({ transcript, data }) {
  bubbleEl.textContent = transcript || '';
  setType(data.type === '收入' ? '收入' : '支出');
  fItem.value = data.item || '';
  fAmount.value = data.amount || 0;
  fDate.value = data.date || '';
  show(reviewEl);
}

// ── 確認才真正寫入 Google Sheet ──────────────────────────────
async function confirmEntry() {
  const data = {
    type: getType(),
    item: fItem.value.trim(),
    amount: Number(fAmount.value) || 0,
    date: fDate.value,
  };
  if (!data.item && !data.amount) {
    fItem.focus();
    return;
  }
  confirmBtn.disabled = true;
  confirmBtn.textContent = '記帳中…';
  try {
    const res = await fetch('/api/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data }),
    });
    if (res.status === 401) return show(loginEl);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || '寫入失敗');
    const sign = data.type === '收入' ? '+' : '−';
    doneSub.textContent = `${data.item}　${sign}$${Number(data.amount).toLocaleString('zh-TW')}`;
    show(doneEl);
    setTimeout(resetToMic, 1800);
  } catch (err) {
    alert('記帳失敗:' + err.message);
  } finally {
    confirmBtn.disabled = false;
    confirmBtn.textContent = '確認記帳 ✓';
  }
}

// ── 事件 ──────────────────────────────────────────────────
micBtn.addEventListener('mousedown', startRecording);
micBtn.addEventListener('mouseup', stopRecording);
micBtn.addEventListener('mouseleave', stopRecording);
micBtn.addEventListener('touchstart', (e) => { e.preventDefault(); startRecording(); });
micBtn.addEventListener('touchend', (e) => { e.preventDefault(); stopRecording(); });

retryBtn.addEventListener('click', resetToMic);
confirmBtn.addEventListener('click', confirmEntry);

boot();
