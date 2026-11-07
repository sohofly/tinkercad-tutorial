// 16 項 Tinkercad 功能的示範腳本
import { THREE } from './scene.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const tc2w = (x, y, z) => V(x, z, -y); // Tinkercad 座標 → 三維場景

export const CATS = ['基礎操作', '變形調整', '組合建模', '輔助工具'];

export const FEATURES = [
  {
    id: 'shapes', name: '放置基本形狀', cat: '基礎操作', key: '拖曳',
    desc: '從右側「基本形狀」面板把方塊、圓柱、屋頂、球體等拖到藍色工作平面上，是所有 3D 建模的起點。',
    steps: ['在右側形狀面板找到「方塊」', '按住滑鼠拖曳到工作平面再放開', '依序放入圓柱、屋頂、球體', '形狀會自動貼齊工作平面（底部 Z = 0）'],
    tips: ['形狀預設為 20 × 20 × 20 mm', '面板上方的下拉選單可切換更多形狀庫'],
    async run(D) {
      const S = D.S;
      D.step(0); await D.wait(300);
      D.step(1); await D.spawn('box', [-45, 10, 0]);
      D.step(2); await D.spawn('cylinder', [-12, -15, 0]);
      await D.spawn('roof', [20, 15, 0]);
      await D.spawn('sphere', [50, -12, 0]);
      D.step(3);
      await D.pick(S.objects[3], { dims: true });
      await D.wait(1400);
    },
  },
  {
    id: 'move', name: '移動物件', cat: '基礎操作', key: '拖曳 / 方向鍵',
    desc: '點選物件後直接在工作平面上拖曳；需要精準時用方向鍵微調，每按一下移動 1 mm（預設格點），按住 Shift 一次 10 mm。',
    steps: ['點一下物件將它選取', '按住物件拖曳到新位置', '按方向鍵微調（每次 1 mm）', 'Shift + 方向鍵一次移動 10 mm'],
    tips: ['右下角「貼齊格點」可改成 0.1、0.5、1 mm 等', '拖曳時會顯示與原位置的距離'],
    async run(D) {
      const S = D.S, b = S.add('box', { pos: [-30, 0, 0] });
      await D.wait(300);
      D.step(0); await D.pick(b);
      D.step(1);
      const from = b.pos.slice();
      S.label('mv', null, () => b.top.clone().add(V(0, 12, 0)), 'dim', () => `X ${(b.pos[0] - from[0]).toFixed(0)}　Y ${(b.pos[1] - from[1]).toFixed(0)}`);
      await D.dragObj(b, () => S.anim(b, { pos: [10, 25, 0] }, 1200));
      S.unlabel('mv'); await D.wait(300);
      D.step(2);
      for (let i = 0; i < 5; i++) { S.keys(['→']); await S.anim(b, { pos: [b.pos[0] + 1, b.pos[1], 0] }, 160); await D.wait(220); }
      S.label('mv2', '每按一下 → 1 mm', () => b.top.clone().add(V(0, 12, 0)), 'note');
      await D.wait(900); S.unlabel('mv2');
      D.step(3);
      for (let i = 0; i < 3; i++) { S.keys(['Shift', '+', '↓']); await S.anim(b, { pos: [b.pos[0], b.pos[1] - 10, 0] }, 300); await D.wait(350); }
      S.label('mv3', 'Shift + ↓ 每次 10 mm', () => b.top.clone().add(V(0, 12, 0)), 'note');
      await D.wait(1300); D.clearKeys();
    },
  },
  {
    id: 'lift', name: '抬升高度', cat: '基礎操作', key: '黑色錐形把手 / Ctrl+↑',
    desc: '選取物件後，上方的黑色圓錐把手可以把物件往上抬，讓它離開工作平面，常用來疊放零件。',
    steps: ['選取物件，找到頂端上方的黑色圓錐', '按住圓錐往上拖曳，數字顯示離地高度', '也可用 Ctrl + ↑ / ↓ 每次 1 mm 調整'],
    tips: ['抬升後陰影會留在原地，方便判斷位置', '想放回地面可按 D 鍵'],
    async run(D) {
      const S = D.S, b = S.add('cylinder', { pos: [0, 0, 0] });
      await D.wait(300);
      D.step(0); await D.pick(b); await D.wait(400);
      D.step(1);
      S.label('h', null, () => b.center.clone().add(V(-24, 0, 0)), 'dim', () => `${b.pos[2].toFixed(2)}`);
      await D.drag('lift', () => S.anim(b, { pos: [0, 0, 30] }, 1400));
      await D.wait(500);
      D.step(2);
      for (let i = 0; i < 5; i++) { S.keys(['Ctrl', '+', '↑']); await S.anim(b, { pos: [0, 0, b.pos[2] + 1] }, 160); await D.wait(240); }
      await D.wait(900); D.clearKeys(); S.unlabel('h');
    },
  },
  {
    id: 'drop', name: '放到平面 (D)', cat: '基礎操作', key: 'D',
    desc: '物件懸空時，選取它再按鍵盤 D，物件會立刻落到工作平面上，確保列印時貼合底部。',
    steps: ['懸空的物件無法順利 3D 列印', '選取懸空的物件', '按下鍵盤 D', '物件貼齊工作平面'],
    tips: ['群組前記得檢查每個零件是否有落地或互相接觸'],
    async run(D) {
      const S = D.S, b = S.add('sphere', { pos: [-20, 0, 35] }), c = S.add('box', { pos: [25, 0, 22], size: [24, 24, 16] });
      S.label('warn', '懸空中！', () => b.top.clone().add(V(0, 10, 0)), 'note warn');
      D.step(0); await D.wait(1300); S.unlabel('warn');
      D.step(1); await D.pick(b);
      D.step(2); S.keys(['D']); await D.wait(400);
      D.step(3);
      await S.anim(b, { pos: [-20, 0, 0] }, 500);
      await S.anim(b, { pos: [-20, 0, 4] }, 160); await S.anim(b, { pos: [-20, 0, 0] }, 160);
      await D.wait(600); D.clearKeys();
      await D.pick(c); S.keys(['D']); await D.wait(300);
      await S.anim(c, { pos: [25, 0, 0] }, 500);
      await D.wait(1200); D.clearKeys();
    },
  },
  {
    id: 'rotate', name: '旋轉', cat: '變形調整', key: '彎曲箭頭',
    desc: '選取物件後，周圍會出現三個彎曲箭頭，分別繞 X、Y、Z 軸旋轉。拖曳時出現量角器，沿內圈拖曳每 22.5° 吸附一次。',
    steps: ['選取物件，找到彎曲箭頭', '拖曳地面上的箭頭：繞 Z 軸水平旋轉', '量角器顯示角度（例如 45°）', '拖曳側邊箭頭：讓物件翻轉站立'],
    tips: ['在量角器外圈拖曳可每 1° 精細調整', '旋轉不會改變物件尺寸'],
    async run(D) {
      const S = D.S, r = S.add('roof', { pos: [0, 0, 0], size: [40, 20, 20] });
      await D.wait(300);
      D.step(0); await D.pick(r); await D.wait(400);
      D.step(1);
      let pr;
      await D.drag('rz', async () => {
        pr = D.protractor(r, 'z'); D.step(2);
        await S.tl.tween(1500, t => { r.rot[2] = 45 * t; r.apply(); pr.update(r.rot[2]); });
      });
      await D.wait(700); pr.remove();
      D.step(3);
      await D.drag('rx', async () => {
        pr = D.protractor(r, 'x');
        await S.tl.tween(1500, t => { r.rot[0] = 90 * t; r.apply(); pr.update(r.rot[0]); });
      });
      await D.wait(900); pr.remove();
    },
  },
  {
    id: 'scale', name: '調整尺寸', cat: '變形調整', key: '白色控制點 / Shift',
    desc: '底部四角的白色控制點調整長與寬，頂端白點調整高度；按住 Shift 拖曳可等比例縮放，也能直接點數字輸入精確尺寸。',
    steps: ['選取物件，出現白色控制點與尺寸', '拖曳角落控制點：改變長、寬', '拖曳頂端控制點：改變高度', '按住 Shift 拖曳角落：等比例縮放', '點選尺寸數字，直接輸入 50'],
    tips: ['單位為 mm', 'Alt + 拖曳可從中心對稱縮放'],
    async run(D) {
      const S = D.S, b = S.add('box', { pos: [-10, 5, 0] });
      await D.wait(300);
      D.step(0); await D.pick(b, { dims: true }); await D.wait(500);
      D.step(1); await D.drag('c2', () => S.anim(b, { size: [40, 30, 20], pos: [0, 0, 0] }, 1300));
      D.step(2); await D.drag('top', () => S.anim(b, { size: [40, 30, 36] }, 1100));
      D.step(3); S.keys(['Shift', '+', '拖曳']);
      await D.drag('c2', () => S.anim(b, { size: [52, 39, 46.8], pos: [6, -4.5, 0] }, 1200));
      D.clearKeys(); await D.wait(300);
      D.step(4);
      const L = S.labels.get('dimL');
      await S.cursorTo(L.el, 600); await S.click(L.el);
      const ed = S.label('edit', '', L.pos, 'dim editing');
      for (const t of ['', '5', '50']) { ed.textContent = t; await D.wait(380); }
      S.keys(['Enter']); await D.wait(300);
      S.unlabel('edit');
      await S.anim(b, { size: [50, 39, 46.8], pos: [5, -4.5, 0] }, 500);
      await D.wait(1200); D.clearKeys();
    },
  },
  {
    id: 'hole', name: '實心 / 挖空', cat: '組合建模', key: '檢查器',
    desc: '每個形狀都可以是「實心」或「挖空」。挖空物件顯示為灰色斜紋，和實心物件群組後就會從中扣除，做出洞或凹槽。',
    steps: ['放一個圓柱在方塊上', '選取圓柱，右上角出現檢查器', '點「挖空」，圓柱變成灰色斜紋', '和方塊一起群組，洞就挖好了'],
    tips: ['挖空物件要穿過或接觸實心物件才會有效', '想做杯子：大圓柱實心 + 小圓柱挖空'],
    async run(D) {
      const S = D.S, b = S.add('box', { pos: [0, 0, 0], size: [50, 50, 20] });
      await D.wait(300);
      D.step(0); const c = await D.spawn('cylinder', [0, 0, 0], { size: [20, 20, 30] });
      D.step(1); await D.pick(c); await D.wait(500);
      D.step(2); await D.clickEl(D.q('.inspector [data-ins=hole]')); c.setHole(true); D.inspector(c);
      await D.wait(1200);
      D.step(3); await D.marquee([b, c]);
      await D.clickEl(D.btn('group')); S.keys(['Ctrl', '+', 'G']);
      S.select(null); const g = S.group([b, c]); S.select(g);
      await S.camTo({ el: 55, dist: 200 }, 900);
      await D.wait(1500); D.clearKeys();
    },
  },
  {
    id: 'color', name: '顏色設定', cat: '變形調整', key: '檢查器',
    desc: '在檢查器點選色塊即可更換顏色。群組後若開啟「多色」，各零件會保留自己的顏色。',
    steps: ['選取物件', '點檢查器的顏色方塊', '從色盤中挑選新顏色', '顏色立即套用到物件上'],
    tips: ['顏色只影響畫面顯示，3D 列印顏色取決於線材'],
    async run(D) {
      const S = D.S, b = S.add('cylinder', { pos: [0, 0, 0], size: [36, 36, 30] });
      await D.wait(300);
      D.step(0); await D.pick(b);
      D.step(1); const ins = D.q('.inspector'); await D.clickEl(ins.querySelector('.ins-color'));
      ins.classList.add('palette'); await D.wait(300);
      D.step(2);
      for (const c of ['#2f86d6', '#2fa35b', '#8e5bd0', '#e8432f']) {
        const sw = ins.querySelector(`.swatches [data-c="${c}"]`);
        await D.clickEl(sw, 500); D.step(3);
        const from = new THREE.Color(b.color), to = new THREE.Color(c);
        await S.tl.tween(300, t => b.mesh.material.color.copy(from.clone().lerp(to, t)));
        b.color = c; D.inspector(b); await D.wait(500);
      }
      ins.classList.remove('palette'); await D.wait(800);
    },
  },
  {
    id: 'group', name: '群組', cat: '組合建模', key: 'Ctrl + G',
    desc: '框選多個物件後按「群組」，實心物件會合併成一體，挖空物件會被扣除，是 Tinkercad 建模最核心的功能。',
    steps: ['準備：實心方塊 + 兩個挖空圓柱', '拖曳滑鼠框選全部物件', '點工具列「群組」或按 Ctrl + G', '挖空處被扣除，成為一個新物件'],
    tips: ['群組後仍可取消群組再修改', '群組後可在檢查器選「多色」保留各零件顏色，或統一成一種顏色'],
    async run(D) {
      const S = D.S;
      const b = S.add('box', { pos: [0, 0, 0], size: [60, 40, 20] });
      const h1 = S.add('cylinder', { pos: [-15, 0, -2], size: [14, 14, 26], hole: true });
      const h2 = S.add('box', { pos: [15, 0, 10], size: [16, 50, 12], hole: true });
      D.step(0); await D.wait(1300);
      D.step(1); await D.marquee([b, h1, h2]);
      D.step(2); await D.clickEl(D.btn('group')); S.keys(['Ctrl', '+', 'G']); await D.wait(300);
      S.select(null);
      await Promise.all([S.fade(h1, 0, 400), S.fade(h2, 0, 400)]);
      D.step(3); const g = S.group([b, h1, h2]); S.select(g); D.inspector(g);
      await S.camTo({ az: 25, el: 50, dist: 220 }, 1000);
      await S.camTo({ az: -40 }, 1600);
      await D.wait(800); D.clearKeys();
    },
  },
  {
    id: 'ungroup', name: '取消群組', cat: '組合建模', key: 'Ctrl + Shift + G',
    desc: '選取已群組的物件按「取消群組」，就能把零件拆回原本的形狀與挖空，繼續修改。',
    steps: ['選取群組後的物件', '點工具列「取消群組」或 Ctrl + Shift + G', '零件恢復成獨立的實心與挖空', '可以個別修改後再重新群組'],
    tips: ['群組可以多層巢狀，取消時一次拆一層'],
    async run(D) {
      const S = D.S;
      const b = S.add('cylinder', { pos: [0, 0, 0], size: [50, 50, 30] });
      const h = S.add('cylinder', { pos: [0, 0, 4], size: [40, 40, 30], hole: true });
      const g = S.group([b, h]);
      await D.wait(500);
      D.step(0); await D.pick(g);
      D.step(1); await D.clickEl(D.btn('ungroup')); S.keys(['Ctrl', '+', 'Shift', '+', 'G']);
      S.select(null); S.ungroup(g); D.inspector(null);
      D.step(2); await D.wait(600);
      await D.pick(h);
      await S.anim(h, { pos: [0, 0, 40] }, 900);
      D.step(3); await D.wait(500);
      await D.drag('c2', () => S.anim(h, { size: [30, 30, 30] }, 800));
      await S.anim(h, { pos: [0, 0, 4] }, 800);
      await D.wait(1000); D.clearKeys();
    },
  },
  {
    id: 'align', name: '對齊', cat: '組合建模', key: 'L',
    desc: '選取多個物件後按「對齊」，四周出現黑色圓點，點選圓點即可讓物件靠左、置中、靠右或上下對齊。',
    steps: ['框選要對齊的物件', '點工具列「對齊」或按 L', '出現對齊圓點（滑過可預覽）', '點中間的圓點：物件置中對齊'],
    tips: ['先點某個物件當作「基準」，其他物件會對齊它'],
    async run(D) {
      const S = D.S;
      const a = S.add('box', { pos: [-35, 20, 0] }), b = S.add('cylinder', { pos: [0, -15, 0], size: [20, 20, 30] }), c = S.add('pyramid', { pos: [35, 5, 0] });
      await D.wait(400);
      D.step(0); await D.marquee([a, b, c]);
      D.step(1); await D.clickEl(D.btn('align')); S.keys(['L']);
      D.step(2);
      const B = () => S.selBox();
      const dots = [];
      const mk = (k, fn) => { dots.push(k); return S.label(k, '', fn, 'align-dot'); };
      mk('ay0', () => { const b = B(); return V(b.max.x + 10, 0, b.max.z); });
      const mid = mk('ay1', () => { const b = B(); return V(b.max.x + 10, 0, (b.min.z + b.max.z) / 2); });
      mk('ay2', () => { const b = B(); return V(b.max.x + 10, 0, b.min.z); });
      mk('ax0', () => { const b = B(); return V(b.min.x, 0, b.max.z + 10); });
      mk('ax1', () => { const b = B(); return V((b.min.x + b.max.x) / 2, 0, b.max.z + 10); });
      mk('ax2', () => { const b = B(); return V(b.max.x, 0, b.max.z + 10); });
      await D.wait(700);
      D.step(3); await S.cursorTo(mid, 700); mid.classList.add('on'); await S.click();
      await Promise.all([a, b, c].map(o => S.anim(o, { pos: [o.pos[0], 0, 0] }, 800)));
      await D.wait(1300); dots.forEach(k => S.unlabel(k)); D.clearKeys();
    },
  },
  {
    id: 'mirror', name: '鏡射', cat: '變形調整', key: 'M',
    desc: '選取物件按「鏡射」，三個方向會出現雙箭頭，點選箭頭就能把物件沿該方向左右或上下翻轉。',
    steps: ['選取不對稱的物件（例如楔形）', '點工具列「鏡射」或按 M', '出現三組雙箭頭', '點左右方向的箭頭：物件水平翻轉'],
    tips: ['做左右對稱的零件：複製一份再鏡射'],
    async run(D) {
      const S = D.S, w = S.add('wedge', { pos: [0, 0, 0], size: [40, 20, 24] });
      await D.wait(300);
      D.step(0); await D.pick(w);
      D.step(1); await D.clickEl(D.btn('mirror')); S.keys(['M']);
      S.select(w, { corners: false, top: false, lift: false, rotate: false });
      D.step(2);
      const B = () => S.selBox();
      const ax = D.arrowsLabel('mx', () => { const b = B(); return V((b.min.x + b.max.x) / 2, b.min.y, b.max.z + 12); }, '⇆');
      D.arrowsLabel('my', () => { const b = B(); return V(b.max.x + 12, b.min.y, (b.min.z + b.max.z) / 2); }, '⇅');
      D.arrowsLabel('mz', () => { const b = B(); return V(b.max.x + 8, (b.min.y + b.max.y) / 2, b.max.z + 8); }, '⇕');
      await D.wait(700);
      D.step(3); await S.cursorTo(ax, 650); ax.classList.add('on'); await S.click();
      await S.anim(w, { mir: [-1, 1, 1] }, 900);
      await D.wait(1300); ['mx', 'my', 'mz'].forEach(k => S.unlabel(k)); D.clearKeys();
    },
  },
  {
    id: 'duplicate', name: '複製並重複', cat: '組合建模', key: 'Ctrl + D',
    desc: '「複製並重複」(Ctrl + D) 會在原處產生副本並記住你接下來的移動，再按一次就自動以相同間距排列，適合做規律圖樣。',
    steps: ['選取圓柱', '按 Ctrl + D 產生副本（在原位置）', '把副本往右拖 25 mm', '再按 Ctrl + D，自動以相同間距重複'],
    tips: ['移動 + 旋轉也會被記住，可做成環狀排列'],
    async run(D) {
      const S = D.S, o = { size: [16, 16, 24] };
      const c0 = S.add('cylinder', { ...o, pos: [-60, 0, 0] });
      await D.wait(300);
      D.step(0); await D.pick(c0);
      D.step(1); await D.clickEl(D.btn('duplicate')); S.keys(['Ctrl', '+', 'D']);
      let c = S.add('cylinder', { ...o, pos: [-60, 0, 0] }); S.select(c);
      S.label('cp', '副本', () => c.top.clone().add(V(0, 9, 0)), 'note'); await D.wait(700);
      D.step(2); await D.dragObj(c, () => S.anim(c, { pos: [-35, 0, 0] }, 900)); S.unlabel('cp');
      D.step(3);
      for (let i = 2; i <= 5; i++) {
        S.keys(['Ctrl', '+', 'D']); await S.click(D.btn('duplicate'));
        const n = S.add('cylinder', { ...o, pos: c.pos.slice(), opacity: 0.2 });
        S.select(n); await Promise.all([S.anim(n, { pos: [-60 + 25 * i, 0, 0], opacity: 1 }, 450)]);
        c = n; await D.wait(250);
      }
      await D.wait(1200); D.clearKeys();
    },
  },
  {
    id: 'workplane', name: '工作平面', cat: '輔助工具', key: 'W',
    desc: '「工作平面」工具可把橘色的臨時平面貼到任何物件表面，之後放的形狀就會直接長在那個面上，斜面、側面都適用。',
    steps: ['點右上角「工作平面」或按 W', '移到方塊側面，出現橘色平面', '點一下確認，新形狀會貼在側面上', '再按一次工作平面並點空白處，回到原平面'],
    tips: ['在斜面上放零件時特別好用'],
    async run(D) {
      const S = D.S, b = S.add('box', { pos: [0, 0, 0], size: [40, 40, 30] });
      await S.camTo({ az: 55, el: 25, dist: 240 }, 600);
      D.step(0); await D.clickEl(D.btn('workplane')); S.keys(['W']);
      D.step(1);
      const wp = new THREE.Group();
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshBasicMaterial({ color: 0xff9b3d, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
      const gr = new THREE.GridHelper(80, 8, 0xd2691e, 0xe8913f); gr.rotation.x = Math.PI / 2;
      wp.add(pl, gr); wp.rotation.y = Math.PI / 2; wp.position.set(20.3, 15, 0); wp.scale.setScalar(0.01);
      S.fx.add(wp);
      await S.cursorTo(V(20, 15, 0), 800);
      await S.tl.tween(500, t => wp.scale.setScalar(Math.max(0.01, t * 0.6)));
      D.step(2); await S.click();
      await S.tl.tween(400, t => wp.scale.setScalar(0.6 + 0.4 * t));
      S.workplane.visible = false;
      const tile = D.tile('cylinder'); await S.cursorTo(tile, 700); tile.classList.add('hl'); await S.click(tile);
      const c = S.add('cylinder', { pos: [32, 0, 3], size: [24, 24, 24], rot: [0, 90, 0], opacity: 0 });
      c.pos = [32, 0, 3]; c.apply();
      await Promise.all([S.cursorTo(() => c.center, 600), S.fade(c, 1, 500)]);
      tile.classList.remove('hl');
      await S.camTo({ az: 70, el: 30 }, 900);
      D.step(3); await D.clickEl(D.btn('workplane'));
      await S.cursorTo(V(-60, 0, 60), 600); await S.click();
      S.fx.remove(wp); S.workplane.visible = true;
      await D.wait(1300); D.clearKeys();
    },
  },
  {
    id: 'ruler', name: '尺規', cat: '輔助工具', key: 'R',
    desc: '「尺規」放到工作平面後，選取任何物件都會顯示它與尺規原點的距離和尺寸，可直接點數字修改位置。',
    steps: ['點右上角「尺規」或按 R', '把尺規放到物件左前方', '選取物件，顯示距離與尺寸', '點距離數字可精確移動物件'],
    tips: ['尺規原點可放在任何位置，量測更方便'],
    async run(D) {
      const S = D.S, c = S.add('cylinder', { pos: [10, 15, 0], size: [30, 30, 24] });
      await D.wait(300);
      D.step(0); await D.clickEl(D.btn('ruler')); S.keys(['R']);
      D.step(1);
      const r = new THREE.Group(), m = new THREE.MeshBasicMaterial({ color: 0xfafafa }), e = new THREE.LineBasicMaterial({ color: 0x333333 });
      const arm = (len, horiz) => { const g = new THREE.BoxGeometry(horiz ? len : 6, 0.6, horiz ? 6 : len); const me = new THREE.Mesh(g, m); me.add(new THREE.LineSegments(new THREE.EdgesGeometry(g), e)); me.position.set(horiz ? len / 2 : 0, 0.3, horiz ? 0 : -len / 2); return me; };
      r.add(arm(110, true), arm(110, false));
      const ticks = []; for (let i = 10; i <= 100; i += 10) ticks.push(V(i, 0.7, 3), V(i, 0.7, -3), V(-3, 0.7, -i), V(3, 0.7, -i));
      r.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(ticks), e));
      const O = tc2w(-40, -30, 0); r.position.copy(O); r.visible = false; S.fx.add(r);
      await S.cursorTo(O, 800); r.visible = true; await S.click();
      D.step(2); await D.pick(c, { corners: true, rotate: false, lift: false });
      const box = () => c.box();
      S.label('rx', null, () => V((O.x + box().min.x) / 2, 0.5, O.z + 9), 'dim ruler', () => (box().min.x - O.x).toFixed(2));
      S.label('ry', null, () => V(O.x - 9, 0.5, (O.z + box().max.z) / 2), 'dim ruler', () => (O.z - box().max.z).toFixed(2));
      S.label('rl', null, () => V(c.center.x, 0.5, box().max.z + 10), 'dim', () => (box().max.x - box().min.x).toFixed(2));
      S.label('rh', null, () => V(box().max.x + 9, c.center.y, c.center.z), 'dim', () => (box().max.y - box().min.y).toFixed(2));
      await D.wait(1200);
      D.step(3);
      const L = S.labels.get('rx'); await S.cursorTo(L.el, 600); await S.click(L.el);
      const ed = S.label('edit', '', L.pos, 'dim editing');
      for (const t of ['', '6', '60']) { ed.textContent = t; await D.wait(380); }
      S.keys(['Enter']); S.unlabel('edit');
      await S.anim(c, { pos: [35, 15, 0] }, 700);
      await D.wait(1500); D.clearKeys();
    },
  },
  {
    id: 'view', name: '視角控制', cat: '輔助工具', key: '右鍵拖曳 / 滾輪 / F',
    desc: '左上角的視角方塊可切換上、前、右等標準視角；右鍵拖曳旋轉、滾輪縮放、Shift + 右鍵平移，按 F 讓選取物件置中。',
    steps: ['點視角方塊「上」：俯視圖', '點「前」：正視圖', '右鍵拖曳：環繞旋轉', '滾輪：放大縮小', '按 F 或「適合畫面」：讓物件置中'],
    tips: ['首頁按鈕可回到預設視角', '正交視圖適合檢查對齊'],
    async run(D) {
      const S = D.S;
      S.add('box', { pos: [0, 0, 0], size: [40, 30, 24] });
      S.add('roof', { pos: [0, 0, 24], size: [40, 30, 18] });
      const door = S.add('box', { pos: [0, -14, 0], size: [10, 4, 14], color: '#7b4b2a' });
      await D.wait(400);
      D.step(0); await D.clickEl(D.q('.viewcube .f-top')); await S.camTo({ az: 0, el: 89.9 }, 1000); await D.wait(600);
      D.step(1); await D.clickEl(D.q('.viewcube .f-front')); await S.camTo({ az: 0, el: 2 }, 1000); await D.wait(600);
      D.step(2); S.keys(['滑鼠右鍵', '+', '拖曳']);
      await S.cursorTo({ x: S.w * 0.35, y: S.h * 0.55 }, 400); S.press(true);
      const sx = S.cur.x;
      await S.tl.tween(2000, t => { S.cam.az = -150 * t; S.cam.el = 2 + 30 * t; S.cur.x = sx + 240 * t; });
      S.press(false); D.clearKeys();
      D.step(3); S.keys(['滾輪']); await S.camTo({ dist: 140 }, 900); await S.camTo({ dist: 320 }, 900); D.clearKeys();
      D.step(4); await D.pick(door); S.keys(['F']); await D.clickEl(D.q('.view-btns [data-v=fit]'));
      await S.camTo({ dist: 120, target: door.center, az: 20, el: 25 }, 1100);
      await D.wait(1200); D.clearKeys();
      await D.clickEl(D.q('.view-btns [data-v=home]'));
      await S.camTo({ az: 32, el: 32, dist: 270, target: V(0, 10, 0) }, 900);
    },
  },
];
