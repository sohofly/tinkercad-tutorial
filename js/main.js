import { Stage, SHAPES, ABORT } from './scene.js';
import { Director } from './director.js';
import { FEATURES, CATS } from './demos.js';
import { playPlan, sanitizePlan, SAMPLES } from './plan.js';
import { analyzePhotos, shrinkImage } from './ai.js';
import { FICON, SICON } from './icons.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* 無法使用 */ } } };

/* ---------- 模擬視窗（仿 Tinkercad 介面，僅供觀看） ---------- */
const SWATCH = ['#e8432f', '#f39a1e', '#f2c512', '#2fa35b', '#1aa3a0', '#2f86d6', '#8e5bd0', '#e2457d', '#7b4b2a', '#ffffff', '#555555'];
function viewportHTML() {
  const tb = (id, label) => `<button data-tb="${id}" title="${label}" tabindex="-1">${FICON[id] || FICON.copy}<span>${label}</span></button>`;
  return `
  <div class="gl"></div>
  <div class="tc-toolbar">
    <div class="tb-group">${tb('copy', '複製')}${tb('paste', '貼上')}${tb('duplicate', '複製並重複')}${tb('del', '刪除')}<i class="sep"></i>${tb('undo', '復原')}${tb('redo', '重做')}</div>
    <div class="tb-group">${tb('group', '群組')}${tb('ungroup', '取消群組')}${tb('align', '對齊')}${tb('mirror', '鏡射')}</div>
    <div class="tb-group tb-right">${tb('workplane', '工作平面')}${tb('ruler', '尺規')}</div>
  </div>
  <div class="viewcube"><div class="cube">
    <div class="f f-front">前</div><div class="f f-back">後</div><div class="f f-right">右</div>
    <div class="f f-left">左</div><div class="f f-top">上</div><div class="f f-bottom">下</div></div></div>
  <div class="view-btns"><button data-v="home" tabindex="-1">⌂</button><button data-v="fit" tabindex="-1">⛶</button><button tabindex="-1">＋</button><button tabindex="-1">－</button></div>
  <div class="inspector">
    <div class="ins-head"><span class="ins-name">形狀</span></div>
    <div class="ins-row">
      <button data-ins="solid" tabindex="-1"><span class="ins-color"></span>實心</button>
      <button data-ins="hole" tabindex="-1"><span class="ins-hole"></span>挖空</button>
    </div>
    <div class="swatches">${SWATCH.map(c => `<i data-c="${c}" style="background:${c}"></i>`).join('')}</div>
  </div>
  <div class="shape-panel"><div class="sp-title">基本形狀</div><div class="sp-grid">
    ${Object.entries(SHAPES).map(([k, v]) => `<div class="tile" data-shape="${k}">${SICON[k](v.color)}<span>${v.name}</span></div>`).join('')}
  </div></div>
  <div class="overlay"></div>`;
}

function makePlayer(root) {
  const area = $('.stage-area', root);
  area.innerHTML = viewportHTML();
  const stage = new Stage(area);
  const ctrl = $('.controls', root);
  const pauseBtn = $('[data-c=pause]', ctrl);
  const setPaused = p => { stage.tl.paused = p; pauseBtn.innerHTML = (p ? FICON.play : FICON.pause) + `<span>${p ? '繼續' : '暫停'}</span>`; };
  pauseBtn.onclick = () => setPaused(!stage.tl.paused);
  $$('[data-speed]', ctrl).forEach(b => b.onclick = () => { stage.tl.speed = +b.dataset.speed; $$('[data-speed]', ctrl).forEach(x => x.classList.toggle('on', x === b)); });
  $('[data-c=replay]', ctrl).innerHTML = FICON.replay + '<span>重播</span>';
  const cap = $('.caption', ctrl);
  let runId = 0;
  return {
    stage,
    caption(t) { cap.innerHTML = t; },
    async run(fn, hooks) {
      const id = ++runId;
      stage.reset(); setPaused(false); root.classList.remove('ended');
      const D = new Director(stage, hooks);
      try { await fn(D); if (id === runId) { root.classList.add('ended'); hooks.end && hooks.end(); } }
      catch (e) { if (e !== ABORT) { console.error(e); cap.textContent = '動畫發生錯誤：' + e.message; } }
    },
    onReplay(f) { $('[data-c=replay]', ctrl).onclick = f; },
  };
}

/* ---------- 分頁 ---------- */
function showTab(name) {
  $$('.tab').forEach(t => t.classList.toggle('on', t.dataset.tab === name));
  $$('.page').forEach(p => p.hidden = p.id !== 'page-' + name);
}
$$('.tab').forEach(t => t.onclick = () => showTab(t.dataset.tab));

/* ---------- 功能示範 ---------- */
const P1 = makePlayer($('#player-demo'));
const list = $('#feature-list');
list.innerHTML = CATS.map(c => `<h3>${c}</h3><div class="fgrid">${FEATURES.filter(f => f.cat === c).map(f => `
  <button class="feat" data-id="${f.id}"><span class="ficon">${FICON[f.id]}</span><b>${f.name}</b><small>${esc(f.key)}</small></button>`).join('')}</div>`).join('');
let current = null;
function playFeature(id, scroll) {
  const f = FEATURES.find(x => x.id === id) || FEATURES[0];
  current = f;
  $$('.feat').forEach(b => b.classList.toggle('on', b.dataset.id === f.id));
  $('#info').innerHTML = `
    <div class="info-head"><span class="ficon big">${FICON[f.id]}</span><div><h2>${f.name}</h2><span class="kbd-badge">${esc(f.key)}</span></div></div>
    <p class="desc">${esc(f.desc)}</p>
    <h4>操作步驟</h4><ol class="steps">${f.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>
    <h4>小提醒</h4><ul class="tips">${f.tips.map(s => `<li>${esc(s)}</li>`).join('')}</ul>`;
  try { history.replaceState(null, '', '#' + f.id); } catch { /* ignore */ }
  if (scroll && window.innerWidth < 900) $('#player-demo').scrollIntoView({ behavior: 'smooth' });
  P1.caption(`<b>${f.name}</b>　準備示範…`);
  P1.run(D => f.run(D), {
    step(i) {
      $$('#info .steps li').forEach((li, k) => { li.classList.toggle('on', k === i); li.classList.toggle('done', k < i); });
      if (f.steps[i]) P1.caption(`<span class="stepno">${i + 1}/${f.steps.length}</span>${esc(f.steps[i])}`);
    },
    end() { P1.caption(`<b>${f.name}</b> 示範完成，按「重播」再看一次，或點左側其他功能。`); $$('#info .steps li').forEach(li => { li.classList.remove('on'); li.classList.add('done'); }); },
  });
}
list.onclick = e => { const b = e.target.closest('.feat'); if (b) playFeature(b.dataset.id, true); };
P1.onReplay(() => playFeature(current.id));

/* ---------- 照片 → AI 建議 ---------- */
const P2 = makePlayer($('#player-ai'));
let photos = []; // {file, url}
let plan = null;
const thumbs = $('#thumbs'), fileIn = $('#file-in');
function renderThumbs() {
  thumbs.innerHTML = photos.map((p, i) => `<figure><img src="${p.url}" alt="照片 ${i + 1}"><button data-rm="${i}" title="移除">×</button></figure>`).join('') +
    (photos.length < 3 ? `<label class="add" for="file-in">${FICON.upload}<span>${photos.length ? '再加一張' : '上傳照片'}</span><small>${photos.length}/3</small></label>` : '');
  $('#btn-analyze').disabled = !photos.length;
}
function addFiles(files) {
  for (const f of files) { if (!f.type.startsWith('image/') || photos.length >= 3) continue; photos.push({ file: f, url: URL.createObjectURL(f) }); }
  renderThumbs();
}
fileIn.onchange = () => { addFiles(fileIn.files); fileIn.value = ''; };
thumbs.onclick = e => { const b = e.target.closest('[data-rm]'); if (b) { URL.revokeObjectURL(photos[+b.dataset.rm].url); photos.splice(+b.dataset.rm, 1); renderThumbs(); } };
const dz = $('#dropzone');
['dragenter', 'dragover'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('drag'); }));
['dragleave', 'drop'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove('drag'); }));
dz.addEventListener('drop', e => addFiles(e.dataTransfer.files));
renderThumbs();

const keyIn = $('#api-key'), remember = $('#remember'), modelIn = $('#model');
keyIn.value = store.get('tc_openai_key') || ''; remember.checked = !!keyIn.value;
modelIn.value = store.get('tc_openai_model') || 'gpt-4o-mini';
const saveKey = () => { store.set('tc_openai_key', remember.checked && keyIn.value ? keyIn.value.trim() : null); store.set('tc_openai_model', modelIn.value.trim() || null); };
remember.onchange = saveKey; keyIn.onchange = saveKey; modelIn.onchange = saveKey;
$('#toggle-key').onclick = () => { keyIn.type = keyIn.type === 'password' ? 'text' : 'password'; };

const status = $('#ai-status');
function setStatus(html, cls = '') { status.className = 'status ' + cls; status.innerHTML = html; }

$('#btn-analyze').onclick = async () => {
  const btn = $('#btn-analyze'); btn.disabled = true; saveKey();
  setStatus('<span class="spin"></span>AI 正在觀察照片並規劃建模步驟…（約 10~40 秒）', 'busy');
  try {
    const images = await Promise.all(photos.map(p => shrinkImage(p.file)));
    const raw = await analyzePhotos({ key: keyIn.value, model: modelIn.value.trim(), images, note: $('#note').value.trim() });
    plan = sanitizePlan(raw);
    setStatus(`完成！AI 辨識為「${esc(plan.object)}」，下方開始播放建模模擬。`, 'ok');
    showPlan();
  } catch (e) { console.error(e); setStatus('⚠ ' + esc(e.message || e), 'err'); }
  finally { btn.disabled = !photos.length; }
};
$('#samples').innerHTML = SAMPLES.map((s, i) => `<button data-sample="${i}">${s.object}</button>`).join('');
$('#samples').onclick = e => { const b = e.target.closest('[data-sample]'); if (!b) return; plan = sanitizePlan(SAMPLES[+b.dataset.sample]); setStatus(`範例：${esc(plan.object)}（不需 API 金鑰）`, 'ok'); showPlan(); };

function showPlan() {
  const r = $('#ai-result'); r.hidden = false;
  $('#ai-empty').hidden = true;
  r.innerHTML = `
    <div class="res-head"><h2>${esc(plan.object)}</h2>${plan.difficulty ? `<span class="kbd-badge">${esc(plan.difficulty)}</span>` : ''}</div>
    <p class="desc">${esc(plan.summary)}</p>
    <h4>建議使用的操作功能 <small>（點選可看該功能的示範）</small></h4>
    <div class="op-list">${plan.operations.map(o => { const f = FEATURES.find(x => x.id === o.id); return `<button class="op" data-op="${o.id}"><span class="ficon">${FICON[o.id]}</span><span><b>${f.name}</b><small>${esc(o.reason)}</small></span></button>`; }).join('')}</div>
    <h4>建模步驟</h4>
    <ol class="steps plan-steps">${plan.steps.map(s => `<li><span class="op-tag">${FEATURES.find(x => x.id === s.op).name}</span>${esc(s.text)}</li>`).join('')}<li class="final">檢查並完成模型</li></ol>
    <h4>零件清單 <small>（單位 mm）</small></h4>
    <div class="tbl-wrap"><table class="parts"><thead><tr><th>#</th><th>零件</th><th>形狀</th><th>長×寬×高</th><th>位置 X,Y,Z</th><th>旋轉</th></tr></thead><tbody>
    ${plan.parts.map((p, i) => `<tr><td>${i}</td><td><i class="dot ${p.hole ? 'hole' : ''}" style="${p.hole ? '' : 'background:' + p.color}"></i>${esc(p.name)}</td><td>${SHAPES[p.shape].name}${p.hole ? '（挖空）' : ''}</td><td>${p.size.map(v => +v.toFixed(1)).join('×')}</td><td>${p.position.map(v => +v.toFixed(1)).join(', ')}</td><td>${p.rotation.some(v => v) ? p.rotation.map(v => +v.toFixed(0)).join(', ') : '—'}</td></tr>`).join('')}
    </tbody></table></div>`;
  $('#player-ai').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  runPlan();
}
function runPlan() {
  if (!plan) return;
  const n = plan.steps.length;
  P2.caption(`<b>${esc(plan.object)}</b>　開始建模模擬…`);
  P2.run(D => playPlan(D, plan, {
    step(i) {
      $$('#ai-result .plan-steps li').forEach((li, k) => { li.classList.toggle('on', k === i); li.classList.toggle('done', k < i); });
      P2.caption(i < n ? `<span class="stepno">${i + 1}/${n}</span>${esc(plan.steps[i].text)}` : '補齊細節並檢查模型…');
    },
  }), { end() { P2.caption(`「${esc(plan.object)}」建模模擬完成！`); } });
}
P2.onReplay(runPlan);
$('#ai-result').addEventListener('click', e => { const b = e.target.closest('[data-op]'); if (b) { showTab('demo'); playFeature(b.dataset.op, true); window.scrollTo({ top: 0, behavior: 'smooth' }); } });

/* ---------- 啟動 ---------- */
const start = (location.hash || '').slice(1);
if (start === 'ai') { showTab('ai'); playFeature('shapes'); } else playFeature(FEATURES.some(f => f.id === start) ? start : 'shapes');
