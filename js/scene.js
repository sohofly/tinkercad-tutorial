// Tinkercad 風格 3D 舞台：工作平面、物件、選取把手、游標、標籤、動畫時間軸
import * as THREE from 'three';
import { Brush, Evaluator, ADDITION, SUBTRACTION } from 'three-bvh-csg';

const D2R = Math.PI / 180;
export const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const lerp = (a, b, t) => a + (b - a) * t;

/* ---------------- 形狀定義 ---------------- */
export const SHAPES = {
  box:        { name: '方塊',   color: '#e8432f', size: [20, 20, 20] },
  cylinder:   { name: '圓柱',   color: '#f39a1e', size: [20, 20, 20] },
  sphere:     { name: '球體',   color: '#2f86d6', size: [20, 20, 20] },
  cone:       { name: '圓錐',   color: '#8e5bd0', size: [20, 20, 20] },
  roof:       { name: '屋頂',   color: '#2fa35b', size: [20, 20, 20] },
  wedge:      { name: '楔形',   color: '#1aa3a0', size: [20, 20, 20] },
  pyramid:    { name: '金字塔', color: '#f2c512', size: [20, 20, 20] },
  halfsphere: { name: '半球',   color: '#e2457d', size: [20, 20, 10] },
  torus:      { name: '圓環',   color: '#18b39b', size: [40, 40, 10] },
  tube:       { name: '管',     color: '#ff7a2b', size: [20, 20, 20] },
};

function normalize(g) {
  g.computeBoundingBox();
  const b = g.boundingBox, c = new THREE.Vector3(), s = new THREE.Vector3();
  b.getCenter(c); b.getSize(s);
  g.translate(-c.x, -c.y, -c.z);
  g.scale(1 / (s.x || 1), 1 / (s.y || 1), 1 / (s.z || 1));
  g.computeVertexNormals();
  if (!g.attributes.uv) {
    const n = g.attributes.position.count;
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  }
  return g;
}
function prism(points) {
  const sh = new THREE.Shape(points.map(p => new THREE.Vector2(p[0], p[1])));
  const g = new THREE.ExtrudeGeometry(sh, { depth: 1, bevelEnabled: false });
  return g;
}
const geoCache = {};
export function getGeo(shape, top = 0) {
  top = shape === 'cone' ? Math.max(0, Math.min(0.95, +top || 0)) : 0;
  const key = shape + (top ? ':' + top.toFixed(2) : '');
  if (geoCache[key]) return geoCache[key];
  let g;
  switch (shape) {
    case 'cylinder': g = new THREE.CylinderGeometry(0.5, 0.5, 1, 48); break;
    case 'sphere': g = new THREE.SphereGeometry(0.5, 40, 24); break;
    case 'cone': g = top ? new THREE.CylinderGeometry(0.5 * top, 0.5, 1, 48) : new THREE.ConeGeometry(0.5, 1, 48); break;
    case 'roof': g = prism([[-0.5, -0.5], [0.5, -0.5], [0, 0.5]]); break;
    case 'wedge': g = prism([[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5]]); break;
    case 'pyramid': g = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4); g.rotateY(Math.PI / 4); break;
    case 'halfsphere': {
      const pts = [new THREE.Vector2(0, 0)];
      for (let i = 0; i <= 24; i++) { const a = (i / 24) * Math.PI / 2; pts.push(new THREE.Vector2(Math.cos(a) * 0.5, Math.sin(a) * 0.5)); }
      g = new THREE.LatheGeometry(pts, 48); break;
    }
    case 'torus': g = new THREE.TorusGeometry(0.375, 0.125, 20, 56); g.rotateX(Math.PI / 2); break;
    case 'tube': {
      const outer = new THREE.Shape(); outer.absarc(0, 0, 0.5, 0, Math.PI * 2, false);
      const hole = new THREE.Path(); hole.absarc(0, 0, 0.36, 0, Math.PI * 2, true);
      outer.holes.push(hole);
      g = new THREE.ExtrudeGeometry(outer, { depth: 1, bevelEnabled: false, curveSegments: 48 });
      g.rotateX(-Math.PI / 2); break;
    }
    default: g = new THREE.BoxGeometry(1, 1, 1);
  }
  if (g.index) g = g.toNonIndexed();
  if (top) { // 截頭圓錐：底部直徑固定為 1，維持外框 1×1×1
    g.computeBoundingBox(); const b = g.boundingBox; g.translate(0, -(b.min.y + b.max.y) / 2, 0); g.computeVertexNormals();
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    geoCache[key] = g; return g;
  }
  geoCache[key] = normalize(g);
  return geoCache[key];
}

/* ---------------- 挖空條紋材質 ---------------- */
let holeTex = null;
function getHoleTex() {
  if (holeTex) return holeTex;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d');
  x.fillStyle = '#c9ced6'; x.fillRect(0, 0, 64, 64);
  x.strokeStyle = '#8f97a3'; x.lineWidth = 9;
  for (let i = -64; i < 128; i += 22) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 64, 64); x.stroke(); }
  holeTex = new THREE.CanvasTexture(c);
  holeTex.wrapS = holeTex.wrapT = THREE.RepeatWrapping; holeTex.repeat.set(3, 3);
  holeTex.colorSpace = THREE.SRGBColorSpace;
  return holeTex;
}

/* ---------------- 物件 ---------------- */
// Tinkercad 座標：x 向右、y 向後、z 向上；pos = [中心x, 中心y, 底部z]，單位 mm
export class Part {
  constructor(stage, shape, o = {}) {
    this.stage = stage; this.shape = SHAPES[shape] ? shape : 'box';
    const def = SHAPES[this.shape];
    this.size = (o.size || def.size).slice();
    this.pos = (o.pos || [0, 0, 0]).slice();
    this.rot = (o.rot || [0, 0, 0]).slice();
    this.mir = [1, 1, 1];
    this.color = o.color || def.color;
    this.hole = !!o.hole;
    this.opacity = o.opacity ?? 1;
    this.name = o.name || def.name;
    this.topR = o.top || 0;
    this.mesh = new THREE.Mesh(getGeo(this.shape, this.topR), null);
    this.mesh.castShadow = true; this.mesh.receiveShadow = true;
    this.updateMat();
    stage.root.add(this.mesh);
    this.apply();
  }
  updateMat() {
    if (this.mesh.material) this.mesh.material.dispose();
    if (this.hole) {
      this.mesh.material = new THREE.MeshStandardMaterial({ map: getHoleTex(), transparent: true, opacity: 0.62 * this.opacity, roughness: 0.8, depthWrite: false });
      this.mesh.castShadow = false;
    } else {
      this.mesh.material = new THREE.MeshStandardMaterial({ color: this.color, roughness: 0.5, metalness: 0.02, transparent: this.opacity < 1, opacity: this.opacity });
      this.mesh.castShadow = true;
    }
  }
  setOpacity(v) {
    this.opacity = v; const m = this.mesh.material;
    m.transparent = this.hole || v < 1; m.opacity = this.hole ? 0.62 * v : v; m.depthWrite = !this.hole && v > 0.98;
  }
  setColor(c) { this.color = c; if (!this.hole) this.mesh.material.color.set(c); }
  setHole(h) { this.hole = h; this.updateMat(); }
  apply() {
    const [sx, sy, sz] = this.size, [px, py, pz] = this.pos, [rx, ry, rz] = this.rot;
    this.mesh.scale.set(Math.max(sx, 0.01) * this.mir[0], Math.max(sz, 0.01) * this.mir[2], Math.max(sy, 0.01) * this.mir[1]);
    this.mesh.position.set(px, pz + sz / 2, -py);
    this.mesh.rotation.set(rx * D2R, rz * D2R, -ry * D2R, 'YXZ');
  }
  get top() { return new THREE.Vector3(this.pos[0], this.pos[2] + this.size[2], -this.pos[1]); }
  get center() { return new THREE.Vector3(this.pos[0], this.pos[2] + this.size[2] / 2, -this.pos[1]); }
  box() { return new THREE.Box3().setFromObject(this.mesh); }
  remove() { this.stage.root.remove(this.mesh); this.mesh.material.dispose(); }
}

// 群組後的物件（以 CSG 計算實心與挖空）
export class GroupObj {
  constructor(stage, members, color) {
    this.stage = stage; this.members = members; this.opacity = 1;
    this.isGroup = true;
    const solids = members.filter(m => !m.hole), holes = members.filter(m => m.hole);
    const ev = new Evaluator(); ev.attributes = ['position', 'normal']; ev.useGroups = true;
    const mats = new Map();
    const matFor = c => { c = c || '#e8432f'; if (!mats.has(c)) mats.set(c, new THREE.MeshStandardMaterial({ color: c, roughness: 0.5 })); return mats.get(c); };
    const base = color || (solids[0] ? solids[0].color : '#e8432f');
    const multi = !color; // 未指定顏色時保留各零件顏色（多色群組）
    let res = null;
    for (const s of solids) { const b = toBrush(s, matFor(multi ? s.color : base)); res = res ? ev.evaluate(res, b, ADDITION) : b; }
    if (!res) res = toBrush(members[0], matFor(base));
    for (const h of holes) res = ev.evaluate(res, toBrush(h, matFor(base)), SUBTRACTION);
    const geo = res.geometry.clone(); geo.computeVertexNormals();
    const material = Array.isArray(res.material) ? res.material : [res.material];
    this.mesh = new THREE.Mesh(geo, Array.isArray(res.material) ? material : material[0]);
    this.mats = material;
    this.mesh.castShadow = true; this.mesh.receiveShadow = true;
    stage.root.add(this.mesh);
    this.color = base;
  }
  setOpacity(v) { this.opacity = v; this.mats.forEach(m => { m.transparent = v < 1; m.opacity = v; m.depthWrite = v > 0.98; }); }
  setColor(c) { this.color = c; this.mats.forEach(m => m.color.set(c)); }
  box() { return new THREE.Box3().setFromObject(this.mesh); }
  get top() { const b = this.box(); const c = b.getCenter(new THREE.Vector3()); c.y = b.max.y; return c; }
  get center() { return this.box().getCenter(new THREE.Vector3()); }
  remove() { this.stage.root.remove(this.mesh); this.mesh.geometry.dispose(); this.mats.forEach(m => m.dispose()); }
}
function toBrush(p, mat) {
  p.mesh.updateMatrixWorld(true);
  let g = p.mesh.geometry.clone();
  g.applyMatrix4(p.mesh.matrixWorld);
  if (p.mesh.matrixWorld.determinant() < 0) {
    const pos = g.attributes.position.array;
    for (let i = 0; i < pos.length; i += 9) for (let k = 0; k < 3; k++) { const t = pos[i + 3 + k]; pos[i + 3 + k] = pos[i + 6 + k]; pos[i + 6 + k] = t; }
    g.computeVertexNormals();
  }
  const b = new Brush(g, mat); b.updateMatrixWorld(); return b;
}

/* ---------------- 時間軸（可暫停、變速、中止） ---------------- */
export class Timeline {
  constructor() { this.time = 0; this.speed = 1; this.paused = false; this.items = []; this.gen = 0; }
  update(dtMs) {
    if (this.paused) return;
    this.time += dtMs * this.speed;
    const done = [];
    for (const it of this.items) {
      const t = it.dur <= 0 ? 1 : Math.min(1, (this.time - it.start) / it.dur);
      if (it.fn) it.fn(it.ease ? ease(t) : t);
      if (t >= 1) done.push(it);
    }
    if (done.length) { this.items = this.items.filter(i => !done.includes(i)); done.forEach(i => i.resolve()); }
  }
  tween(dur, fn, useEase = true) {
    const gen = this.gen;
    return new Promise((resolve, reject) => {
      this.items.push({ start: this.time, dur, fn, ease: useEase, resolve: () => (gen === this.gen ? resolve() : reject(ABORT)) });
    });
  }
  wait(ms) { return this.tween(ms, null); }
  abort() { this.gen++; const its = this.items; this.items = []; its.forEach(i => i.resolve()); }
}
export const ABORT = new Error('abort');

/* ---------------- 舞台 ---------------- */
export class Stage {
  constructor(host) {
    this.host = host; // .viewport 元素
    this.tl = new Timeline();
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.querySelector('.gl').appendChild(this.renderer.domElement);
    this.overlay = host.querySelector('.overlay');
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, 1, 1, 3000);
    this.cam = { az: 32, el: 32, dist: 270, target: new THREE.Vector3(0, 10, 0) };
    this.root = new THREE.Group(); this.scene.add(this.root);
    this.fx = new THREE.Group(); this.scene.add(this.fx);
    this.labels = new Map();
    this.buildWorld();
    this.buildCursor();
    this.sel = null;
    this.objects = [];
    this.followFn = null;
    this.last = performance.now();
    new ResizeObserver(() => this.resize()).observe(host);
    this.resize();
    const loop = now => { const dt = Math.min(64, now - this.last); this.last = now; this.frame(dt); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }
  buildWorld() {
    const s = this.scene;
    s.add(new THREE.HemisphereLight(0xffffff, 0xb9c7d6, 1.25));
    const d = new THREE.DirectionalLight(0xffffff, 1.6);
    d.position.set(80, 220, 140); d.castShadow = true;
    d.shadow.mapSize.set(2048, 2048);
    Object.assign(d.shadow.camera, { left: -160, right: 160, top: 160, bottom: -160, near: 10, far: 600 });
    d.shadow.bias = -0.0005; d.shadow.normalBias = 0.6; s.add(d);
    const fill = new THREE.DirectionalLight(0xffffff, 0.45); fill.position.set(-150, 80, -60); s.add(fill);
    // 工作平面
    const wp = new THREE.Group(); this.workplane = wp;
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: 0xc4dcf2, roughness: 0.95 }));
    plane.rotation.x = -Math.PI / 2; plane.receiveShadow = true; wp.add(plane);
    const g1 = new THREE.GridHelper(200, 40, 0x9fc2e3, 0x9fc2e3); g1.position.y = 0.05; wp.add(g1);
    const g2 = new THREE.GridHelper(200, 4, 0x5f97cc, 0x5f97cc); g2.position.y = 0.08; wp.add(g2);
    const edge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(200, 0.1, 200)), new THREE.LineBasicMaterial({ color: 0x3c7fc0 }));
    wp.add(edge);
    s.add(wp);
  }
  buildCursor() {
    const c = document.createElement('div'); c.className = 'fake-cursor';
    c.innerHTML = '<svg viewBox="0 0 24 24" width="26" height="26"><path d="M3 2l7.5 19 2.6-7.6L21 10.8z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg><span class="ripple"></span>';
    this.overlay.appendChild(c); this.cursorEl = c;
    this.cur = { x: -40, y: -40 };
    this.keysEl = document.createElement('div'); this.keysEl.className = 'key-hint'; this.overlay.appendChild(this.keysEl);
  }
  resize() {
    const r = this.host.querySelector('.gl').getBoundingClientRect();
    if (!r.width) return;
    this.w = r.width; this.h = r.height;
    this.renderer.setSize(r.width, r.height, false);
    this.camera.aspect = r.width / r.height; this.camera.updateProjectionMatrix();
  }
  get visible() { return this.host.offsetParent !== null; }
  updateCamera() {
    const { az, el, dist, target } = this.cam;
    const a = az * D2R, e = el * D2R;
    this.camera.position.set(target.x + dist * Math.cos(e) * Math.sin(a), target.y + dist * Math.sin(e), target.z + dist * Math.cos(e) * Math.cos(a));
    this.camera.up.set(0, 1, 0);
    if (el > 89) this.camera.up.set(-Math.sin(a), 0, -Math.cos(a));
    this.camera.lookAt(target);
    const cube = this.host.querySelector('.viewcube .cube');
    if (cube) cube.style.transform = `rotateX(${-el}deg) rotateY(${-az}deg)`;
  }
  frame(dt) {
    this.tl.update(dt);
    if (!this.visible) return;
    if (this.w !== this.host.querySelector('.gl').clientWidth) this.resize();
    this.updateCamera();
    this.updateSelection();
    if (this.followFn) { const p = this.toScreen(this.followFn()); this.cur.x = p.x; this.cur.y = p.y; }
    this.cursorEl.style.transform = `translate(${this.cur.x - 3}px, ${this.cur.y - 2}px)`;
    for (const [, L] of this.labels) {
      const p = this.toScreen(typeof L.pos === 'function' ? L.pos() : L.pos);
      L.el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`;
      if (L.text) { const t = L.text(); if (t !== L.lastText) { L.el.textContent = t; L.lastText = t; } }
    }
    this.renderer.render(this.scene, this.camera);
  }
  toScreen(v) {
    const p = v.clone().project(this.camera);
    return { x: (p.x * 0.5 + 0.5) * this.w, y: (-p.y * 0.5 + 0.5) * this.h };
  }
  elScreen(el) {
    const r = el.getBoundingClientRect(), o = this.overlay.getBoundingClientRect();
    return { x: r.left - o.left + r.width / 2, y: r.top - o.top + r.height / 2 };
  }

  /* ---- 物件 ---- */
  add(shape, o) { const p = new Part(this, shape, o); this.objects.push(p); return p; }
  removeObj(o) { o.remove(); this.objects = this.objects.filter(x => x !== o); if (this.sel && this.sel.objs.includes(o)) this.select(null); }
  group(members, color) {
    const g = new GroupObj(this, members, color);
    members.forEach(m => { m.mesh.visible = false; });
    this.objects = this.objects.filter(x => !members.includes(x)); this.objects.push(g);
    return g;
  }
  ungroup(g) {
    g.members.forEach(m => { m.mesh.visible = true; this.objects.push(m); });
    this.removeObj(g); return g.members;
  }
  anim(part, to, ms = 800) {
    const from = { size: part.size.slice(), pos: part.pos.slice(), rot: part.rot.slice(), mir: part.mir.slice(), opacity: part.opacity };
    return this.tl.tween(ms, t => {
      for (const k of ['size', 'pos', 'rot', 'mir']) if (to[k]) for (let i = 0; i < 3; i++) part[k][i] = lerp(from[k][i], to[k][i], t);
      if (to.opacity !== undefined) part.setOpacity(lerp(from.opacity, to.opacity, t));
      if (part.apply) part.apply();
    });
  }
  fade(obj, to, ms = 400) { const f = obj.opacity; return this.tl.tween(ms, t => obj.setOpacity(lerp(f, to, t))); }
  moveMesh(obj, delta, ms = 700) { // 移動群組物件（直接位移 mesh）
    const f = obj.mesh.position.clone();
    return this.tl.tween(ms, t => obj.mesh.position.set(f.x + delta.x * t, f.y + delta.y * t, f.z + delta.z * t));
  }

  /* ---- 選取把手 ---- */
  select(objs, opt = {}) {
    if (this.sel) { this.fx.remove(this.sel.g); this.sel.labels.forEach(k => this.unlabel(k)); }
    this.sel = null;
    if (!objs) return;
    objs = Array.isArray(objs) ? objs : [objs];
    const o = Object.assign({ corners: true, top: true, lift: true, rotate: true, dims: false }, opt);
    const g = new THREE.Group();
    const lineMat = new THREE.LineBasicMaterial({ color: 0x2b8be8 });
    const boxLine = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), lineMat); g.add(boxLine);
    const whiteM = new THREE.MeshBasicMaterial({ color: 0xffffff }), blackM = new THREE.MeshBasicMaterial({ color: 0x1b1b1b });
    const hg = new THREE.BoxGeometry(1, 1, 1);
    const corners = [];
    if (o.corners) for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(hg, whiteM); const e = new THREE.LineSegments(new THREE.EdgesGeometry(hg), new THREE.LineBasicMaterial({ color: 0x333333 })); m.add(e); corners.push(m); g.add(m); }
    let topH = null, lift = null; const rots = [];
    if (o.top) { topH = new THREE.Mesh(hg, whiteM); topH.add(new THREE.LineSegments(new THREE.EdgesGeometry(hg), new THREE.LineBasicMaterial({ color: 0x333333 }))); g.add(topH); }
    if (o.lift) { lift = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1, 20), blackM); g.add(lift); }
    if (o.rotate) for (let i = 0; i < 3; i++) {
      const r = new THREE.Mesh(new THREE.TorusGeometry(1, 0.06, 6, 30, Math.PI / 2.4), blackM);
      const head = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.36, 12), blackM);
      head.position.set(Math.cos(Math.PI / 2.4), Math.sin(Math.PI / 2.4), 0); head.rotation.z = Math.PI / 2.4;
      r.add(head); rots.push(r); g.add(r);
    }
    this.fx.add(g);
    this.sel = { objs, g, boxLine, corners, topH, lift, rots, labels: [], opt: o };
    if (o.dims) {
      const b = () => this.selBox();
      const fmt = v => v.toFixed(2);
      this.label('dimL', null, () => { const B = b(); return new THREE.Vector3((B.min.x + B.max.x) / 2, B.min.y, B.max.z + 9); }, 'dim', () => fmt(b().max.x - b().min.x));
      this.label('dimW', null, () => { const B = b(); return new THREE.Vector3(B.max.x + 9, B.min.y, (B.min.z + B.max.z) / 2); }, 'dim', () => fmt(b().max.z - b().min.z));
      this.label('dimH', null, () => { const B = b(); return new THREE.Vector3(B.max.x + 6, (B.min.y + B.max.y) / 2, B.max.z + 6); }, 'dim', () => fmt(b().max.y - b().min.y));
      this.sel.labels.push('dimL', 'dimW', 'dimH');
    }
  }
  selBox() {
    const B = new THREE.Box3();
    this.sel.objs.forEach(o => { if (o.mesh.visible) B.union(o.box()); });
    if (B.isEmpty()) B.set(new THREE.Vector3(), new THREE.Vector3(1, 1, 1));
    return B;
  }
  updateSelection() {
    const S = this.sel; if (!S) return;
    const B = this.selBox(), c = B.getCenter(new THREE.Vector3()), s = B.getSize(new THREE.Vector3());
    S.boxLine.position.copy(c); S.boxLine.scale.set(s.x + 0.4, s.y + 0.4, s.z + 0.4);
    const hs = Math.max(2, this.cam.dist / 110);
    const cs = [[B.min.x, B.min.z], [B.max.x, B.min.z], [B.max.x, B.max.z], [B.min.x, B.max.z]];
    S.corners.forEach((m, i) => { m.position.set(cs[i][0], B.min.y, cs[i][1]); m.scale.setScalar(hs); });
    if (S.topH) { S.topH.position.set(c.x, B.max.y, c.z); S.topH.scale.setScalar(hs); }
    if (S.lift) { S.lift.position.set(c.x, B.max.y + hs * 4, c.z); S.lift.scale.set(hs * 1.3, hs * 2, hs * 1.3); }
    if (S.rots.length) {
      const r = hs * 2.6;
      // 繞 Z（水平面）
      S.rots[0].position.set(B.min.x - hs * 2, B.min.y + 0.5, B.max.z + hs * 2); S.rots[0].rotation.set(-Math.PI / 2, 0, Math.PI / 2 + 0.35); S.rots[0].scale.setScalar(r);
      // 繞 X
      S.rots[1].position.set(c.x - s.x * 0.15, B.max.y + hs * 1.5, B.max.z + hs * 1.6); S.rots[1].rotation.set(0, Math.PI / 2, 0.2); S.rots[1].scale.setScalar(r);
      // 繞 Y
      S.rots[2].position.set(B.max.x + hs * 1.6, B.max.y + hs * 1.5, c.z + s.z * 0.15); S.rots[2].rotation.set(0, 0, 0.2); S.rots[2].scale.setScalar(r);
    }
  }
  handlePos(which) { // 回傳把手的世界座標（給游標用）
    const S = this.sel; if (!S) return new THREE.Vector3();
    const map = { c0: S.corners[0], c1: S.corners[1], c2: S.corners[2], c3: S.corners[3], top: S.topH, lift: S.lift, rz: S.rots[0], rx: S.rots[1], ry: S.rots[2] };
    const m = map[which]; if (!m) return this.selBox().getCenter(new THREE.Vector3());
    const v = new THREE.Vector3(); m.getWorldPosition(v);
    if (which[0] === 'r') { const r = m.scale.x; v.add(new THREE.Vector3(Math.cos(0.65) * r, Math.sin(0.65) * r, 0).applyEuler(m.rotation)); }
    return v;
  }

  /* ---- 標籤 / 游標 / 按鍵 ---- */
  label(key, text, pos, cls = '', textFn = null) {
    this.unlabel(key);
    const el = document.createElement('div'); el.className = 'lbl ' + cls; if (text) el.innerHTML = text;
    this.overlay.appendChild(el);
    this.labels.set(key, { el, pos, text: textFn });
    return el;
  }
  unlabel(key) { const L = this.labels.get(key); if (L) { L.el.remove(); this.labels.delete(key); } }
  cursorTo(target, ms = 700) {
    this.followFn = null;
    const sx = this.cur.x, sy = this.cur.y;
    const tgt = () => (target instanceof THREE.Vector3 ? this.toScreen(target) : typeof target === 'function' ? this.toScreen(target()) : target.getBoundingClientRect ? this.elScreen(target) : target);
    return this.tl.tween(ms, t => { const p = tgt(); this.cur.x = lerp(sx, p.x, t); this.cur.y = lerp(sy, p.y, t); });
  }
  follow(fn) { this.followFn = fn; }
  unfollow() { this.followFn = null; }
  async click(el) {
    this.cursorEl.classList.remove('clicking'); void this.cursorEl.offsetWidth; this.cursorEl.classList.add('clicking');
    if (el) { el.classList.add('pressed'); }
    await this.tl.wait(260);
    if (el) el.classList.remove('pressed');
  }
  press(on) { this.cursorEl.classList.toggle('down', on); }
  keys(list) {
    if (!list || !list.length) { this.keysEl.classList.remove('show'); return; }
    this.keysEl.innerHTML = list.map(k => (k === '+' ? '<b>+</b>' : `<kbd>${k}</kbd>`)).join('');
    this.keysEl.classList.add('show');
  }
  async camTo(to, ms = 1000) {
    const f = { az: this.cam.az, el: this.cam.el, dist: this.cam.dist, target: this.cam.target.clone() };
    let daz = (to.az ?? f.az) - f.az; if (daz > 180) daz -= 360; if (daz < -180) daz += 360;
    await this.tl.tween(ms, t => {
      this.cam.az = f.az + daz * t;
      this.cam.el = lerp(f.el, to.el ?? f.el, t);
      this.cam.dist = lerp(f.dist, to.dist ?? f.dist, t);
      if (to.target) this.cam.target.lerpVectors(f.target, to.target, t);
    });
  }
  clearFx() { while (this.fx.children.length) this.fx.remove(this.fx.children[0]); }
  reset() {
    this.tl.abort(); this.tl.paused = false;
    this.select(null);
    this.objects.forEach(o => o.remove()); this.objects = [];
    while (this.root.children.length) this.root.remove(this.root.children[0]);
    this.clearFx();
    for (const k of [...this.labels.keys()]) this.unlabel(k);
    this.keys(null); this.followFn = null; this.press(false);
    this.workplane.visible = true;
    this.cam = { az: 32, el: 32, dist: 270, target: new THREE.Vector3(0, 10, 0) };
    this.host.querySelectorAll('.pressed,.hl').forEach(e => e.classList.remove('pressed', 'hl'));
    const insp = this.host.querySelector('.inspector'); if (insp) insp.classList.remove('show');
    this.cur = { x: this.w * 0.55 || 300, y: this.h * 0.8 || 300 };
  }
}

/* ---------------- 預覽截圖（給 AI 自我檢查用） ---------------- */
// plan.parts 以 Tinkercad 座標表示；輸出一張含「正面 / 右側 / 斜角 / 俯視」四格的 JPEG
export function snapshotPlan(parts, cell = 360) {
  const W = cell * 2, H = cell * 2;
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(cell, cell, false); renderer.setPixelRatio(1); renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0xf4f7fb);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb9c7d6, 1.3));
  const dl = new THREE.DirectionalLight(0xffffff, 1.4); dl.position.set(80, 200, 140); scene.add(dl);
  const grid = new THREE.GridHelper(200, 20, 0x9fb7cf, 0xc9d7e4); scene.add(grid);
  const root = new THREE.Group(); scene.add(root);
  const fake = { root };
  const objs = parts.map(p => new Part(fake, p.shape, { size: p.size, pos: p.position, rot: p.rotation, color: p.color, hole: p.hole, top: p.top }));
  const box = new THREE.Box3(); objs.forEach(o => box.union(o.box()));
  const c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
  // 座標軸提示（放在模型左前方）：紅 +x(右)、綠 +y(後)、藍 +z(上)
  const L = Math.max(12, Math.max(sz.x, sz.z) * 0.25), O = new THREE.Vector3(box.min.x - L * 0.6, 0.2, box.max.z + L * 0.6);
  const ax = (dir, col) => scene.add(new THREE.ArrowHelper(dir, O, L, col, L * 0.25, L * 0.15));
  ax(new THREE.Vector3(1, 0, 0), 0xe53935); ax(new THREE.Vector3(0, 0, -1), 0x43a047); ax(new THREE.Vector3(0, 1, 0), 0x1e63d6);
  const R = Math.max(sz.x, sz.y, sz.z, 30) * 1.25 + L * 1.6;
  const cam = new THREE.OrthographicCamera(-R / 2 * 1.1, R / 2 * 1.1, R / 2 * 1.1, -R / 2 * 1.1, 1, 2000);
  const views = [['正面 front (看向 +y)', [0, 0, 1]], ['右側 right (看向 -x)', [1, 0, 0]], ['斜角 iso', [0.6, 0.55, 0.6]], ['俯視 top', [0, 1, 0.0001]]];
  const out = document.createElement('canvas'); out.width = W; out.height = H; const ctx = out.getContext('2d');
  views.forEach(([name, d], i) => {
    const v = new THREE.Vector3(...d).normalize();
    cam.position.copy(c).addScaledVector(v, 600); cam.up.set(0, 1, 0); if (d[1] > 0.99) cam.up.set(0, 0, -1);
    cam.lookAt(c); cam.updateProjectionMatrix();
    renderer.render(scene, cam);
    const x = (i % 2) * cell, y = Math.floor(i / 2) * cell;
    ctx.drawImage(renderer.domElement, x, y);
    ctx.strokeStyle = '#999'; ctx.strokeRect(x + 0.5, y + 0.5, cell - 1, cell - 1);
    ctx.fillStyle = '#111'; ctx.font = 'bold 16px sans-serif'; ctx.fillText(name, x + 8, y + 22);
  });
  objs.forEach(o => o.mesh.material.dispose()); renderer.dispose();
  return out.toDataURL('image/jpeg', 0.85);
}

/* ---------------- 匯出 STL（Z 軸朝上，單位 mm） ---------------- */
export function exportSTL(objects) {
  const toZup = new THREE.Matrix4().makeRotationX(Math.PI / 2);
  const tris = [];
  for (const o of objects) {
    if (!o.mesh.visible || o.hole) continue;
    o.mesh.updateMatrixWorld(true);
    let g = o.mesh.geometry.index ? o.mesh.geometry.toNonIndexed() : o.mesh.geometry.clone();
    const m = toZup.clone().multiply(o.mesh.matrixWorld);
    g.applyMatrix4(m);
    const flip = m.determinant() < 0, p = g.attributes.position.array;
    for (let i = 0; i < p.length; i += 9) tris.push(flip ? [p[i], p[i + 1], p[i + 2], p[i + 6], p[i + 7], p[i + 8], p[i + 3], p[i + 4], p[i + 5]] : Array.from(p.slice(i, i + 9)));
    g.dispose();
  }
  const buf = new ArrayBuffer(84 + tris.length * 50), dv = new DataView(buf);
  const head = 'Tinkercad tutorial export'; for (let i = 0; i < head.length; i++) dv.setUint8(i, head.charCodeAt(i));
  dv.setUint32(80, tris.length, true);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), cc = new THREE.Vector3(), n = new THREE.Vector3();
  tris.forEach((t, k) => {
    let off = 84 + k * 50;
    a.set(t[0], t[1], t[2]); b.set(t[3], t[4], t[5]); cc.set(t[6], t[7], t[8]);
    n.subVectors(cc, b).cross(a.clone().sub(b)).normalize();
    for (const v of [n.x, n.y, n.z, ...t]) { dv.setFloat32(off, v || 0, true); off += 4; }
    dv.setUint16(off, 0, true);
  });
  return new Blob([buf], { type: 'model/stl' });
}
export { THREE };
