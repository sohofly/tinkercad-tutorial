// 密碼保護的 API 金鑰：金鑰以「密碼」加密（PBKDF2-SHA256 + AES-GCM）存在 config.js，
// 網站公開也只看得到亂碼；輸入正確密碼才會在瀏覽器內解開。可設定多組密碼（例如老師、各班）。
const enc = new TextEncoder(), dec = new TextDecoder();
export const ITER = 600000;
const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

let cfgP = null;
export function loadConfig() {
  if (!cfgP) cfgP = import('../config.js?v=' + Date.now()).then(m => m.default || { locks: [] }).catch(() => ({ locks: [] }));
  return cfgP;
}

async function derive(pw, salt, iter) {
  const base = await crypto.subtle.importKey('raw', enc.encode(pw.normalize('NFKC')), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

// 成功回傳 { apiKey, label }，失敗回傳 null
export async function unlock(pw) {
  const { locks = [] } = await loadConfig();
  for (const L of locks) {
    try {
      const k = await derive(pw, unb64(L.salt), L.iter || ITER);
      const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(L.iv) }, k, unb64(L.data));
      return { apiKey: dec.decode(pt), label: L.label || '' };
    } catch { /* 不是這組 */ }
  }
  return null;
}

export async function makeLock(apiKey, pw, label, iter = ITER) {
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const k = await derive(pw, salt, iter);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, enc.encode(apiKey.trim()));
  return { label, iter, salt: b64(salt), iv: b64(iv), data: b64(ct) };
}

export function configText(locks) {
  return `// 由 admin.html 產生：OpenAI API 金鑰已用密碼加密，沒有密碼無法解開。\n// 更換密碼或金鑰：開啟 admin.html 重新產生，再上傳覆蓋此檔。\nexport default ${JSON.stringify({ updated: new Date().toISOString().slice(0, 10), locks }, null, 2)};\n`;
}

// 好記又夠長的隨機密碼，例如 bota-rinuke-58
export function randomPassword() {
  const C = 'bcdfghjkmnprstvz', V = 'aeiou', r = n => crypto.getRandomValues(new Uint32Array(1))[0] % n;
  const syl = () => C[r(C.length)] + V[r(V.length)];
  return `${syl()}${syl()}-${syl()}${syl()}${syl()}-${String(r(90) + 10)}`;
}
