// 把模擬動畫錄成影片下載
// 優先：分頁擷取 + 裁切到播放器（完整保留游標、工具列、說明文字）
// 備案：自行合成 3D 畫面、游標、標籤、按鍵提示與字幕到畫布再錄影（手機或不支援分頁擷取時）

const MIMES = ['video/mp4;codecs=avc1.42E01E', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
const pickMime = () => (window.MediaRecorder ? MIMES.find(m => MediaRecorder.isTypeSupported(m)) || '' : '');
export const canRecord = () => !!(window.MediaRecorder && HTMLCanvasElement.prototype.captureStream);

function save(blob, name) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 60000);
}

async function tabStream(target) {
  if (!navigator.mediaDevices?.getDisplayMedia || !window.CropTarget) return null;
  const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: false, preferCurrentTab: true, selfBrowserSurface: 'include', surfaceSwitching: 'exclude' });
  const [track] = stream.getVideoTracks();
  try { await track.cropTo(await CropTarget.fromElement(target)); }
  catch { stream.getTracks().forEach(t => t.stop()); throw new Error('請在分享視窗中選擇「這個分頁」，才能只錄下動畫區域'); }
  return { stream, stop() { stream.getTracks().forEach(t => t.stop()); } };
}

// 合成：3D 畫布 + 覆蓋層（游標、標籤、按鍵）+ 底部字幕
function compositeStream(area, captionEl) {
  const gl = area.querySelector('.gl canvas'), ov = area.querySelector('.overlay');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const r0 = area.getBoundingClientRect();
  const capH = 56;
  const cv = document.createElement('canvas'); cv.width = Math.round(r0.width * dpr); cv.height = Math.round((r0.height + capH) * dpr);
  const ctx = cv.getContext('2d');
  let on = true;
  const rr = (x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); };
  const draw = () => {
    if (!on) return;
    const R = area.getBoundingClientRect();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#e9eef4'; ctx.fillRect(0, 0, R.width, R.height + capH);
    ctx.drawImage(gl, 0, 0, R.width, R.height);
    // 標籤與按鍵提示
    ov.querySelectorAll('.lbl, .key-hint.show, .marquee').forEach(el => {
      const b = el.getBoundingClientRect(), x = b.left - R.left, y = b.top - R.top, cs = getComputedStyle(el);
      if (el.classList.contains('marquee')) { ctx.fillStyle = 'rgba(22,115,214,.1)'; ctx.fillRect(x, y, b.width, b.height); ctx.setLineDash([5, 4]); ctx.strokeStyle = '#1673d6'; ctx.strokeRect(x, y, b.width, b.height); ctx.setLineDash([]); return; }
      if (el.classList.contains('key-hint')) {
        rr(x, y, b.width, b.height, 12); ctx.fillStyle = 'rgba(20,30,45,.85)'; ctx.fill();
        let kx = x + 12;
        el.querySelectorAll('kbd, b').forEach(k => {
          const kb = k.getBoundingClientRect(); kx = kb.left - R.left;
          if (k.tagName === 'KBD') { rr(kx, kb.top - R.top, kb.width, kb.height, 7); ctx.fillStyle = '#f3f6f9'; ctx.fill(); ctx.fillStyle = '#1d2733'; }
          else ctx.fillStyle = '#fff';
          ctx.font = 'bold 15px "Noto Sans TC", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(k.textContent, kx + kb.width / 2, kb.top - R.top + kb.height / 2);
        });
        ctx.textAlign = 'left'; return;
      }
      const bg = cs.backgroundColor;
      if (bg && bg !== 'rgba(0, 0, 0, 0)') { rr(x, y, b.width, b.height, parseFloat(cs.borderTopLeftRadius) || 4); ctx.fillStyle = bg; ctx.fill(); if (parseFloat(cs.borderTopWidth)) { ctx.strokeStyle = cs.borderTopColor; ctx.lineWidth = parseFloat(cs.borderTopWidth); ctx.stroke(); } }
      if (el.textContent) { ctx.fillStyle = cs.color; ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(el.textContent, x + b.width / 2, y + b.height / 2 + 1); ctx.textAlign = 'left'; }
    });
    // 游標
    const cur = ov.querySelector('.fake-cursor svg').getBoundingClientRect();
    const s = cur.width / 24; ctx.save(); ctx.translate(cur.left - R.left, cur.top - R.top); ctx.scale(s, s);
    const p = new Path2D('M3 2l7.5 19 2.6-7.6L21 10.8z'); ctx.lineJoin = 'round'; ctx.lineWidth = 1.6; ctx.strokeStyle = '#fff'; ctx.fillStyle = '#111'; ctx.fill(p); ctx.stroke(p); ctx.restore();
    // 字幕
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, R.height, R.width, capH);
    ctx.fillStyle = '#1d2733'; ctx.font = 'bold 18px "Noto Sans TC", sans-serif'; ctx.textBaseline = 'middle';
    ctx.fillText([...captionEl.childNodes].map(n => n.textContent.trim()).filter(Boolean).join('　').slice(0, 60), 16, R.height + capH / 2);
    requestAnimationFrame(draw);
  };
  draw();
  const stream = cv.captureStream(30);
  return { stream, stop() { on = false; stream.getTracks().forEach(t => t.stop()); } };
}

// 錄影：先取得畫面串流 → 從頭重播動畫 → 播完自動停止並下載
export async function recordAnimation({ cropTarget, area, captionEl, replay, waitEnd, filename, onStatus }) {
  const mime = pickMime();
  if (!mime) throw new Error('這個瀏覽器不支援錄影，請改用電腦版 Chrome 或 Edge');
  let src = null, mode = 'tab';
  try { src = await tabStream(cropTarget); }
  catch (e) {
    if (e.name === 'NotAllowedError' || e.name === 'AbortError') throw new Error('已取消錄影');
    if (String(e.message).includes('這個分頁')) throw e;
    src = null; // 不支援分頁擷取 → 改用相容模式
  }
  if (!src) { src = compositeStream(area, captionEl); mode = 'canvas'; }
  const chunks = [];
  const rec = new MediaRecorder(src.stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 });
  rec.ondataavailable = e => e.data.size && chunks.push(e.data);
  const stopped = new Promise(r => { rec.onstop = r; });
  let userStop = false;
  src.stream.getVideoTracks()[0].addEventListener('ended', () => { userStop = true; if (rec.state !== 'inactive') rec.stop(); });
  rec.start(500);
  onStatus && onStatus(mode);
  const ended = waitEnd();
  replay();
  await Promise.race([ended, stopped]);
  await new Promise(r => setTimeout(r, 900));
  if (rec.state !== 'inactive') rec.stop();
  await stopped; src.stop();
  if (!chunks.length) throw new Error('沒有錄到畫面');
  const ext = mime.includes('mp4') ? 'mp4' : 'webm';
  save(new Blob(chunks, { type: mime.split(';')[0] }), `${filename}.${ext}`);
  return { ext, userStop };
}
export { save as saveBlob };
