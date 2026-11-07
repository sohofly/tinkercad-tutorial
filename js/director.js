// 導演：把「游標移動、點擊、拖曳、按鍵」組合成可讀的示範動作
import { THREE } from './scene.js';
const D2R = Math.PI / 180;

export class Director {
  constructor(stage, hooks = {}) { this.S = stage; this.hooks = hooks; }
  get tl() { return this.S.tl; }
  wait(ms) { return this.S.tl.wait(ms); }
  step(i, text) { this.hooks.step && this.hooks.step(i, text); }
  q(s) { return this.S.host.querySelector(s); }
  btn(id) { return this.q(`[data-tb="${id}"]`); }
  tile(s) { return this.q(`.shape-panel [data-shape="${s}"]`) || this.q('.shape-panel [data-shape="box"]'); }

  async clickEl(el, ms = 650) { await this.S.cursorTo(el, ms); await this.S.click(el); }
  async clickAt(v, ms = 650) { await this.S.cursorTo(v, ms); await this.S.click(); }
  async keys(list, ms = 900) { this.S.keys(list); await this.wait(ms); }
  clearKeys() { this.S.keys(null); }

  // 從右側「基本形狀」面板拖曳一個形狀到工作平面
  async spawn(shape, pos, o = {}) {
    const S = this.S, tile = this.tile(shape);
    await S.cursorTo(tile, 600); tile.classList.add('hl'); await S.click(tile); S.press(true);
    const start = [Math.min(92, pos[0] + 40), Math.max(-90, pos[1] - 20), 0];
    const p = S.add(shape, { ...o, pos: start, opacity: 0 });
    await Promise.all([S.cursorTo(() => p.top, 380), S.fade(p, 1, 380)]);
    S.follow(() => p.top);
    await S.anim(p, { pos: [pos[0], pos[1], pos[2] || 0] }, 850);
    S.unfollow(); S.press(false); tile.classList.remove('hl');
    return p;
  }
  // 點選物件，顯示把手與檢查器
  async pick(objs, opt = {}, ms = 550) {
    const arr = [].concat(objs);
    await this.S.cursorTo(() => arr[0].center, ms); await this.S.click();
    this.S.select(arr, opt); this.inspector(arr.length === 1 ? arr[0] : null);
  }
  deselect() { this.S.select(null); this.inspector(null); }
  inspector(obj) {
    const el = this.q('.inspector'); if (!el) return;
    if (!obj) { el.classList.remove('show'); return; }
    el.classList.add('show');
    el.querySelector('.ins-name').textContent = obj.isGroup ? '群組' : obj.name;
    el.querySelector('[data-ins=solid]').classList.toggle('on', !obj.hole);
    el.querySelector('[data-ins=hole]').classList.toggle('on', !!obj.hole);
    el.querySelector('.ins-color').style.background = obj.hole ? 'repeating-linear-gradient(45deg,#c9ced6 0 5px,#8f97a3 5px 9px)' : obj.color;
  }
  // 拖曳把手：游標移到把手、按下、跟隨把手直到動畫結束
  async drag(handle, animFn, opts = {}) {
    const S = this.S;
    await S.cursorTo(() => S.handlePos(handle), opts.ms || 600);
    S.press(true); await this.wait(160);
    S.follow(() => S.handlePos(handle));
    await animFn();
    S.unfollow(); S.press(false); await this.wait(160);
  }
  // 拖曳物件本體
  async dragObj(obj, animFn) {
    const S = this.S;
    await S.cursorTo(() => obj.top, 550); S.press(true); await this.wait(140);
    S.follow(() => obj.top); await animFn(); S.unfollow(); S.press(false); await this.wait(140);
  }
  screenBox(objs) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const o of objs) {
      const b = o.box();
      for (let i = 0; i < 8; i++) {
        const v = new THREE.Vector3(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z);
        const p = this.S.toScreen(v); x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y);
      }
    }
    return { x0: x0 - 22, y0: y0 - 22, x1: x1 + 22, y1: y1 + 22 };
  }
  // 框選
  async marquee(objs, opt = {}) {
    const S = this.S, b = this.screenBox(objs);
    await S.cursorTo({ x: b.x0, y: b.y0 }, 650);
    S.press(true);
    const m = document.createElement('div'); m.className = 'marquee'; S.overlay.appendChild(m);
    await S.tl.tween(900, t => {
      const x = b.x0 + (b.x1 - b.x0) * t, y = b.y0 + (b.y1 - b.y0) * t;
      S.cur.x = x; S.cur.y = y;
      Object.assign(m.style, { left: b.x0 + 'px', top: b.y0 + 'px', width: (x - b.x0) + 'px', height: (y - b.y0) + 'px' });
    });
    S.press(false); m.remove();
    S.select(objs, opt); this.inspector(null);
    await this.wait(250);
  }
  // 量角器（旋轉時出現）
  protractor(obj, axis = 'z') {
    const S = this.S, g = new THREE.Group(), b = obj.box(), sz = b.getSize(new THREE.Vector3());
    const R = Math.max(sz.x, sz.y, sz.z) * 0.8 + 10;
    g.add(new THREE.Mesh(new THREE.RingGeometry(R * 0.78, R, 96), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false })));
    const tickPts = [];
    for (let i = 0; i < 16; i++) { const a = i * 22.5 * D2R, r1 = i % 4 === 0 ? R * 0.62 : R * 0.7; tickPts.push(new THREE.Vector3(Math.cos(a) * r1, Math.sin(a) * r1, 0), new THREE.Vector3(Math.cos(a) * R * 0.78, Math.sin(a) * R * 0.78, 0)); }
    g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(tickPts), new THREE.LineBasicMaterial({ color: 0x222222 })));
    const secMat = new THREE.MeshBasicMaterial({ color: 0x2b8be8, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false });
    let sec = null;
    if (axis === 'z') g.rotation.x = -Math.PI / 2;
    if (axis === 'x') g.rotation.y = Math.PI / 2;
    g.position.copy(obj.center);
    S.fx.add(g);
    const lblPos = () => new THREE.Vector3(R * 1.12, 0, 0).applyEuler(g.rotation).add(g.position);
    let cur = 0;
    S.label('ang', null, lblPos, 'dim ang', () => `${Math.round(cur)}°`);
    return {
      update(deg) {
        cur = deg;
        if (sec) { g.remove(sec); sec.geometry.dispose(); }
        sec = new THREE.Mesh(new THREE.RingGeometry(R * 0.2, R * 0.78, 48, 1, deg >= 0 ? 0 : deg * D2R, Math.abs(deg * D2R) || 0.0001), secMat);
        g.add(sec);
      },
      remove() { S.fx.remove(g); S.unlabel('ang'); },
    };
  }
  // 方向雙箭頭（鏡射用）
  arrowsLabel(key, posFn, text = '⇄') { return this.S.label(key, text, posFn, 'mirror-arrow'); }
}
