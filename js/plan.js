// 依 AI（或範例）建模計畫，自動產生 Tinkercad 操作模擬動畫
import { SHAPES, THREE } from './scene.js';
import { FEATURES } from './demos.js';

export const OP_IDS = FEATURES.map(f => f.id);
const num = (v, d = 0) => (Number.isFinite(+v) ? +v : d);
const vec3 = (a, d) => (Array.isArray(a) && a.length >= 3 ? [num(a[0], d[0]), num(a[1], d[1]), num(a[2], d[2])] : d.slice());
const hex = c => (/^#[0-9a-f]{6}$/i.test(c || '') ? c : null);

export function sanitizePlan(raw) {
  const p = typeof raw === 'string' ? JSON.parse(raw) : raw;
  const parts = (Array.isArray(p.parts) ? p.parts : []).slice(0, 16).map((x, i) => {
    const shape = SHAPES[x.shape] ? x.shape : 'box';
    const size = vec3(x.size, SHAPES[shape].size).map(v => Math.min(200, Math.max(1, Math.abs(v))));
    // AI 使用「中心點 center」較不易出錯；內部轉成 Tinkercad 的「底部 z」
    const position = Array.isArray(x.center) ? (c => [c[0], c[1], c[2] - size[2] / 2])(vec3(x.center, [0, 0, size[2] / 2])) : vec3(x.position, [0, 0, 0]);
    const top = shape === 'cone' ? Math.max(0, Math.min(0.95, num(x.top, 0))) : 0;
    return { name: String(x.name || SHAPES[shape].name).slice(0, 20), shape, top, hole: !!x.hole, color: hex(x.color) || SHAPES[shape].color, size, position, rotation: vec3(x.rotation, [0, 0, 0]) };
  });
  // 整體貼齊工作平面（最低點 z = 0），避免 AI 給的高度整體浮空或穿入地面
  const minZ = Math.min(...parts.filter(q => !q.hole).map(q => q.position[2] + q.size[2] / 2 - halfHeight(q)));
  if (Number.isFinite(minZ) && Math.abs(minZ) > 0.5) parts.forEach(q => { q.position[2] -= minZ; });
  if (!parts.length) throw new Error('AI 回傳的建模計畫沒有任何零件');
  // 整體太大就等比例縮小到工作平面內
  let ext = 0;
  parts.forEach(q => { ext = Math.max(ext, Math.abs(q.position[0]) + q.size[0] / 2, Math.abs(q.position[1]) + q.size[1] / 2, q.position[2] + q.size[2]); });
  if (ext > 95) { const k = 95 / ext; parts.forEach(q => { q.size = q.size.map(v => v * k); q.position = q.position.map(v => v * k); }); }
  const valid = new Set(OP_IDS);
  const opMap = new Map();
  (Array.isArray(p.operations) ? p.operations : []).filter(o => valid.has(o.id)).forEach(o => {
    const r = String(o.reason || ''); if (opMap.has(o.id)) { const e = opMap.get(o.id); if (r && !e.reason.includes(r)) e.reason += '；' + r; } else opMap.set(o.id, { id: o.id, reason: r });
  });
  const operations = [...opMap.values()];
  let steps = (Array.isArray(p.steps) ? p.steps : []).filter(s => valid.has(s.op)).map(s => ({ op: s.op, parts: (Array.isArray(s.parts) ? s.parts : []).map(n => num(n, -1)).filter(n => n >= 0 && n < parts.length), text: String(s.text || '') }));
  if (!steps.length) steps = autoSteps(parts);
  // 每個挖空零件都要出現在某個「挖空」步驟
  const holeParts = parts.map((q, i) => (q.hole ? i : -1)).filter(i => i >= 0);
  const covered = new Set(steps.filter(s => s.op === 'hole').flatMap(s => s.parts));
  const missing = holeParts.filter(i => !covered.has(i));
  if (missing.length) { const gi = steps.findIndex(s => s.op === 'group'); const hs = { op: 'hole', parts: missing, text: '把要挖掉的零件設為挖空' }; gi >= 0 ? steps.splice(gi, 0, hs) : steps.push(hs); }
  const ops = new Set(operations.map(o => o.id));
  steps.forEach(s => { if (!ops.has(s.op)) { ops.add(s.op); operations.push({ id: s.op, reason: s.text }); } });
  return { object: String(p.object || '模型'), observation: String(p.observation || ''), summary: String(p.summary || ''), difficulty: String(p.difficulty || ''), operations, parts, steps };
}

// 旋轉後零件在 z 方向的半高（用來把模型貼齊地面）
function halfHeight(q) {
  const e = new THREE.Euler(q.rotation[0] * Math.PI / 180, q.rotation[2] * Math.PI / 180, -q.rotation[1] * Math.PI / 180, 'YXZ');
  const m = new THREE.Matrix4().makeRotationFromEuler(e).elements; // three: x, y(上), z
  const [sx, sy, sz] = [q.size[0], q.size[2], q.size[1]];
  return (Math.abs(m[1]) * sx + Math.abs(m[5]) * sy + Math.abs(m[9]) * sz) / 2;
}
// 轉回 AI 使用的中心點格式（自我檢查時回傳給 AI）
export function toAIJson(plan) {
  return JSON.stringify({ object: plan.object, observation: plan.observation, summary: plan.summary, difficulty: plan.difficulty, operations: plan.operations,
    parts: plan.parts.map(q => ({ name: q.name, shape: q.shape, ...(q.top ? { top: q.top } : {}), hole: q.hole, color: q.color, size: q.size.map(r1), center: [r1(q.position[0]), r1(q.position[1]), r1(q.position[2] + q.size[2] / 2)], rotation: q.rotation.map(r1) })),
    steps: plan.steps });
}
const r1 = v => Math.round(v * 10) / 10;

function autoSteps(parts) {
  const all = parts.map((_, i) => i), holes = all.filter(i => parts[i].hole);
  const s = [{ op: 'shapes', parts: all, text: '從形狀面板拖入所有需要的形狀' }, { op: 'scale', parts: all, text: '調整每個形狀的長寬高' }, { op: 'move', parts: all, text: '把零件移動到正確位置' }];
  if (holes.length) s.push({ op: 'hole', parts: holes, text: '把需要挖掉的零件設為挖空' });
  s.push({ op: 'group', parts: all, text: '框選全部零件並群組' });
  return s;
}

export async function playPlan(D, plan, hooks = {}) {
  const S = D.S, P = plan.parts;
  const st = P.map(() => ({ obj: null, size: false, rot: false, z: false, xy: false, hole: false, color: false, grouped: false }));
  let lastGroup = null;
  // 視角
  let ext = 60; P.forEach(q => { ext = Math.max(ext, Math.abs(q.position[0]) + q.size[0], Math.abs(q.position[1]) + q.size[1], q.position[2] + q.size[2]); });
  await S.camTo({ dist: Math.max(250, ext * 3.6), target: new THREE.Vector3(10, Math.min(40, ext * 0.3), 0) }, 500);
  // 哪些零件之後會有「移動 / 顏色」步驟：沒有的話就直接放在最終位置、使用最終顏色
  const willMove = new Set(), willColor = new Set();
  plan.steps.forEach(s => {
    if (['move', 'align'].includes(s.op)) s.parts.forEach(i => willMove.add(i));
    if (s.op === 'duplicate') s.parts.slice(1).forEach(i => willMove.add(i));
    if (s.op === 'color') s.parts.forEach(i => willColor.add(i));
  });

  const final = i => P[i];
  const stage = i => { const f = final(i); return [Math.max(-80, Math.min(80, f.position[0] + 28)), Math.max(-80, Math.min(80, f.position[1] - 22)), 0]; };
  const curPos = i => { const s = st[i], f = final(i); return [s.xy ? f.position[0] : st[i].obj.pos[0], s.xy ? f.position[1] : st[i].obj.pos[1], s.z ? f.position[2] : st[i].obj.pos[2]]; };
  async function ensure(i) {
    if (st[i].obj) return st[i].obj;
    const f = final(i);
    const direct = !willMove.has(i);
    const o = await D.spawn(f.shape, direct ? [f.position[0], f.position[1], 0] : stage(i), { name: f.name, top: f.top, color: willColor.has(i) ? undefined : f.color });
    st[i].obj = o; if (direct) st[i].xy = true; if (!willColor.has(i)) st[i].color = true; return o;
  }
  const live = list => list.filter(i => !st[i].grouped);
  async function setSize(i, fast) { const o = await ensure(i); if (st[i].size) return; st[i].size = true; const f = final(i); if (fast) return S.anim(o, { size: f.size }, 450); await D.pick(o, { dims: true }); await D.drag('c2', () => S.anim(o, { size: [f.size[0], f.size[1], o.size[2]] }, 800)); if (Math.abs(o.size[2] - f.size[2]) > 0.5) await D.drag('top', () => S.anim(o, { size: f.size }, 700)); }
  async function setRot(i, fast) { const o = await ensure(i); if (st[i].rot) return; st[i].rot = true; const f = final(i); if (f.rotation.every(v => Math.abs(v) < 0.5)) return; if (fast) return S.anim(o, { rot: f.rotation }, 450); await D.pick(o); await D.drag('rz', async () => { const ax = Math.abs(f.rotation[0]) > 0.5 ? 'x' : Math.abs(f.rotation[1]) > 0.5 ? 'y' : 'z'; const pr = D.protractor(o, ax); const k = ax === 'x' ? 0 : ax === 'y' ? 1 : 2; const r0 = o.rot.slice(); await S.tl.tween(1000, t => { for (let j = 0; j < 3; j++) o.rot[j] = r0[j] + (f.rotation[j] - r0[j]) * t; o.apply(); pr.update(o.rot[k]); }); await D.wait(300); pr.remove(); }); }
  async function setZ(i, fast, drop) { const o = await ensure(i); if (st[i].z) return; st[i].z = true; const f = final(i); if (Math.abs(o.pos[2] - f.position[2]) < 0.3) return; if (fast) return S.anim(o, { pos: [o.pos[0], o.pos[1], f.position[2]] }, 450); await D.pick(o); if (drop) { S.keys(['D']); await S.anim(o, { pos: [o.pos[0], o.pos[1], f.position[2]] }, 500); D.clearKeys(); return; } S.label('h', null, () => o.center.clone().add(new THREE.Vector3(-o.size[0] / 2 - 14, 0, 0)), 'dim', () => o.pos[2].toFixed(2)); await D.drag('lift', () => S.anim(o, { pos: [o.pos[0], o.pos[1], f.position[2]] }, 900)); S.unlabel('h'); }
  async function setXY(i, fast) { const o = await ensure(i); if (st[i].xy) return; st[i].xy = true; const f = final(i); const to = [f.position[0], f.position[1], o.pos[2]]; if (fast) return S.anim(o, { pos: to }, 450); await D.pick(o); await D.dragObj(o, () => S.anim(o, { pos: to }, 900)); }
  async function setHole(i, fast) { const o = await ensure(i); if (st[i].hole) return; st[i].hole = true; const f = final(i); if (!f.hole) return; if (!fast) { await D.pick(o); await D.clickEl(D.q('.inspector [data-ins=hole]')); } o.setHole(true); D.inspector(fast ? null : o); }
  async function setColor(i, fast) { const o = await ensure(i); if (st[i].color) return; st[i].color = true; const f = final(i); if (f.hole) return; if (!fast) { await D.pick(o); await D.clickEl(D.q('.inspector .ins-color'), 500); } o.setColor(f.color); D.inspector(fast ? null : o); }
  async function finalize(i, fast = true) { if (st[i].grouped) return; await ensure(i); await setSize(i, fast); await setRot(i, fast); await setZ(i, fast); await setXY(i, fast); await setHole(i, fast); await setColor(i, fast); }

  for (let k = 0; k < plan.steps.length; k++) {
    const s = plan.steps[k]; hooks.step && hooks.step(k);
    let list = live(s.parts.length ? s.parts : P.map((_, i) => i));
    switch (s.op) {
      case 'shapes': for (const i of list) await ensure(i); break;
      case 'scale': for (const i of list) await setSize(i, false); break;
      case 'rotate': for (const i of list) await setRot(i, false); break;
      case 'lift': for (const i of list) await setZ(i, false); break;
      case 'drop': for (const i of list) await setZ(i, false, true); break;
      case 'move': for (const i of list) { await setXY(i, false); await setZ(i, true); } break;
      case 'hole': for (const i of list) await setHole(i, false); break;
      case 'color': for (const i of list) await setColor(i, false); break;
      case 'duplicate': {
        const [src, ...copies] = list; if (src === undefined) break;
        await finalize(src, true); const so = st[src].obj; await D.pick(so);
        for (const i of copies) {
          if (st[i].obj) continue;
          await D.clickEl(D.btn('duplicate'), 450); S.keys(['Ctrl', '+', 'D']);
          const f = final(i);
          const o = S.add(f.shape, { pos: so.pos.slice(), size: so.size.slice(), rot: so.rot.slice(), color: so.color, hole: so.hole, name: f.name, top: f.top });
          st[i].obj = o; S.select(o);
          await D.dragObj(o, () => S.anim(o, { pos: f.position, size: f.size, rot: f.rotation }, 800));
          Object.assign(st[i], { size: true, rot: true, z: true, xy: true });
          await setHole(i, true); await setColor(i, true);
        }
        D.clearKeys(); break;
      }
      case 'mirror': {
        for (const i of list) await finalize(i, true);
        const objs = list.map(i => st[i].obj); if (!objs.length) break;
        if (objs.length > 1) await D.marquee(objs); else await D.pick(objs[0]);
        await D.clickEl(D.btn('mirror')); S.keys(['M']);
        await Promise.all(objs.map(o => S.anim(o, { mir: [-o.mir[0], 1, 1] }, 800)));
        D.clearKeys(); break;
      }
      case 'align': {
        for (const i of list) { await ensure(i); await setSize(i, true); await setRot(i, true); await setZ(i, true); }
        const objs = list.map(i => st[i].obj);
        if (objs.length > 1) await D.marquee(objs); else if (objs[0]) await D.pick(objs[0]);
        await D.clickEl(D.btn('align')); S.keys(['L']);
        await Promise.all(list.map(i => { st[i].xy = true; return S.anim(st[i].obj, { pos: final(i).position }, 900); }));
        D.clearKeys(); break;
      }
      case 'group': {
        for (const i of list) await finalize(i, true);
        list = list.filter(i => st[i].obj);
        if (list.length < 2) break;
        const objs = list.map(i => st[i].obj);
        await D.marquee(objs);
        await D.clickEl(D.btn('group')); S.keys(['Ctrl', '+', 'G']);
        S.select(null);
        await Promise.all(objs.filter(o => o.hole).map(o => S.fade(o, 0, 350)));
        lastGroup = S.group(objs); list.forEach(i => { st[i].grouped = true; });
        S.select(lastGroup); D.inspector(lastGroup); await D.wait(500); D.clearKeys(); break;
      }
      case 'ungroup': if (lastGroup) { await D.pick(lastGroup); S.keys(['Ctrl', '+', 'Shift', '+', 'G']); await D.wait(800); D.clearKeys(); } break;
      case 'workplane': {
        const i = list[0]; if (i === undefined) break; const o = await ensure(i); await finalize(i, true);
        await D.clickEl(D.btn('workplane')); S.keys(['W']);
        const b = o.box(), wp = new THREE.Mesh(new THREE.PlaneGeometry(b.max.x - b.min.x + 30, b.max.z - b.min.z + 30), new THREE.MeshBasicMaterial({ color: 0xff9b3d, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
        wp.rotation.x = -Math.PI / 2; wp.position.set((b.min.x + b.max.x) / 2, b.max.y + 0.3, (b.min.z + b.max.z) / 2); S.fx.add(wp);
        await D.clickAt(wp.position.clone(), 600); await D.wait(1200); S.fx.remove(wp); D.clearKeys(); break;
      }
      case 'ruler': {
        const i = list[0]; await D.clickEl(D.btn('ruler')); S.keys(['R']);
        if (i !== undefined) { await finalize(i, true); await D.pick(st[i].obj, { dims: true }); }
        await D.wait(1400); D.clearKeys(); break;
      }
      case 'view': {
        await D.clickEl(D.q('.viewcube .f-top')); await S.camTo({ el: 89.9, az: 0 }, 800); await D.wait(500);
        await D.clickEl(D.q('.viewcube .f-front')); await S.camTo({ el: 3, az: 0 }, 800); await D.wait(500);
        await S.camTo({ el: 32, az: 32 }, 800); break;
      }
    }
    await D.wait(250);
  }
  // 收尾：補齊未完成的參數；若有挖空且尚未群組，自動群組
  hooks.step && hooks.step(plan.steps.length);
  for (let i = 0; i < P.length; i++) await finalize(i, true);
  const rest = P.map((_, i) => i).filter(i => !st[i].grouped && st[i].obj);
  if (rest.some(i => P[i].hole) && rest.length > 1) {
    const objs = rest.map(i => st[i].obj);
    await D.marquee(objs); await D.clickEl(D.btn('group')); S.keys(['Ctrl', '+', 'G']);
    S.select(null); await Promise.all(objs.filter(o => o.hole).map(o => S.fade(o, 0, 350)));
    S.group(objs); D.clearKeys();
  }
  S.select(null); D.inspector(null);
  await S.cursorTo({ x: S.w - 40, y: S.h - 40 }, 500);
  await S.camTo({ az: S.cam.az - 300 }, 6000);
}

/* ---------------- 離線範例 ---------------- */
export const SAMPLES = [
  {
    object: '筆筒', summary: '圓柱外殼加上略小的挖空圓柱，底部保留 4 mm 厚度，群組後就是筆筒。', difficulty: '入門',
    operations: [{ id: 'shapes', reason: '放入兩個圓柱' }, { id: 'scale', reason: '設定外徑 60 mm、高 90 mm' }, { id: 'hole', reason: '內部圓柱設為挖空' }, { id: 'lift', reason: '內圓柱抬高 4 mm 保留底部' }, { id: 'align', reason: '兩圓柱置中對齊' }, { id: 'group', reason: '群組挖出筆筒空間' }],
    parts: [
      { name: '外殼', shape: 'cylinder', color: '#2f86d6', size: [60, 60, 90], position: [0, 0, 0], rotation: [0, 0, 0] },
      { name: '內部空間', shape: 'cylinder', hole: true, size: [52, 52, 90], position: [0, 0, 4], rotation: [0, 0, 0] },
    ],
    steps: [
      { op: 'shapes', parts: [0, 1], text: '拖入兩個圓柱' }, { op: 'scale', parts: [0, 1], text: '外圓柱 60×60×90、內圓柱 52×52×90' },
      { op: 'hole', parts: [1], text: '把內圓柱設為挖空' }, { op: 'lift', parts: [1], text: '內圓柱抬升 4 mm 當底部厚度' },
      { op: 'align', parts: [0, 1], text: '兩個圓柱置中對齊' }, { op: 'group', parts: [0, 1], text: '框選後群組，完成筆筒' },
    ],
  },
  {
    object: '馬克杯', summary: '杯身用圓柱挖空，杯耳用圓環旋轉 90° 後接在側面。', difficulty: '初級',
    operations: [{ id: 'shapes', reason: '圓柱與圓環' }, { id: 'scale', reason: '設定杯身與杯耳尺寸' }, { id: 'rotate', reason: '圓環立起來當杯耳' }, { id: 'move', reason: '杯耳移到杯身側面' }, { id: 'hole', reason: '杯內挖空' }, { id: 'group', reason: '合成一個杯子' }],
    parts: [
      { name: '杯身', shape: 'cylinder', color: '#e8432f', size: [56, 56, 70], position: [0, 0, 0], rotation: [0, 0, 0] },
      { name: '杯內', shape: 'cylinder', hole: true, size: [48, 48, 70], position: [0, 0, 5], rotation: [0, 0, 0] },
      { name: '杯耳', shape: 'torus', color: '#e8432f', size: [36, 36, 8], position: [30, 0, 17], rotation: [90, 0, 0] },
    ],
    steps: [
      { op: 'shapes', parts: [0, 1, 2], text: '拖入兩個圓柱和一個圓環' }, { op: 'scale', parts: [0, 1, 2], text: '設定杯身、杯內與杯耳尺寸' },
      { op: 'rotate', parts: [2], text: '圓環繞 X 軸旋轉 90° 立起來' }, { op: 'move', parts: [2], text: '杯耳移到杯身右側並抬高' },
      { op: 'hole', parts: [1], text: '杯內圓柱設為挖空並抬高 5 mm' }, { op: 'move', parts: [1], text: '杯內與杯身置中' },
      { op: 'group', parts: [0, 1, 2], text: '全部群組，完成馬克杯' },
    ],
  },
  {
    object: '小房子', summary: '方塊當牆、屋頂形狀當屋頂，門窗用挖空方塊。', difficulty: '初級',
    operations: [{ id: 'shapes', reason: '方塊與屋頂' }, { id: 'scale', reason: '調整牆與屋頂大小' }, { id: 'lift', reason: '屋頂抬到牆上方' }, { id: 'hole', reason: '門窗挖空' }, { id: 'duplicate', reason: '複製第二扇窗' }, { id: 'group', reason: '合成房子' }],
    parts: [
      { name: '牆', shape: 'box', color: '#f2c512', size: [60, 40, 36], position: [0, 0, 0], rotation: [0, 0, 0] },
      { name: '屋頂', shape: 'roof', color: '#e8432f', size: [66, 46, 24], position: [0, 0, 36], rotation: [0, 0, 0] },
      { name: '門', shape: 'box', hole: true, size: [12, 10, 22], position: [0, -19, 0], rotation: [0, 0, 0] },
      { name: '左窗', shape: 'box', hole: true, size: [10, 10, 10], position: [-18, -19, 16], rotation: [0, 0, 0] },
      { name: '右窗', shape: 'box', hole: true, size: [10, 10, 10], position: [18, -19, 16], rotation: [0, 0, 0] },
    ],
    steps: [
      { op: 'shapes', parts: [0, 1], text: '拖入方塊與屋頂' }, { op: 'scale', parts: [0, 1], text: '牆 60×40×36、屋頂 66×46×24' },
      { op: 'lift', parts: [1], text: '屋頂抬升 36 mm 放到牆上' }, { op: 'move', parts: [1], text: '屋頂與牆置中' },
      { op: 'shapes', parts: [2, 3], text: '拖入門和窗的方塊' }, { op: 'hole', parts: [2, 3], text: '門窗設為挖空' },
      { op: 'move', parts: [2, 3], text: '門窗移到正面牆上' }, { op: 'duplicate', parts: [3, 4], text: 'Ctrl+D 複製窗戶到右邊' },
      { op: 'group', parts: [0, 1, 2, 3, 4], text: '全部群組，挖出門窗' },
    ],
  },
];
