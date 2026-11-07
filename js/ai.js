// 透過 OpenAI API 分析照片，產生 Tinkercad 建模建議（JSON），並可用 3D 預覽圖讓 AI 自我檢查修正
import { FEATURES } from './demos.js';
import { SHAPES } from './scene.js';

const OPS = FEATURES.map(f => `${f.id}：${f.name}`).join('\n');
const SH = Object.entries(SHAPES).map(([k, v]) => `${k}（${v.name}）`).join('、');

const SYSTEM = `你是國中小生活科技課的 Tinkercad 3D 建模老師。使用者會上傳同一個物品的 1~3 張照片或圖片（可能是不同角度，也可能是卡通插圖）。
請辨識物品，用「最少、最適合學生」的 Tinkercad 基本形狀與操作，規劃一個簡化但「外形、方向、比例都要像」的 3D 模型。
使用者的補充說明優先於你的判斷（例如要求省略某些部分、指定尺寸）。

【可用形狀 shape】${SH}
【可用操作 id】
${OPS}

【座標系統】Tinkercad，單位 mm：x 向右、y 向後（遠離觀看者）、z 向上；工作平面約 200×200。
- size = [x, y, z] 是「旋轉之前」的外框尺寸。圓柱、圓錐、管的 size = [直徑, 直徑, 軸長]
- center = [x, y, z] 是零件外框的中心點（旋轉以中心點為軸）
- rotation = [繞 X, 繞 Y, 繞 Z]（度）；hole = true 為挖空（群組後扣除）
- cone 可加 top（0~0.95）：頂部直徑 ÷ 底部直徑，0 是尖錐；杯子、燈罩、扯鈴的碗狀部分用 0.2~0.6 的截頭圓錐

【預設方向 — 非常重要】
- cylinder / cone / tube 的軸線沿 z 軸「直立」；cone 尖端（或較小的頂面）朝上 +z
- halfsphere 圓頂朝上；roof 屋脊沿 y 軸；wedge 高的一側在 -x；torus 平躺在地上
【旋轉對照表（cone 尖端 / halfsphere 圓頂 / 圓柱軸線 指向）】
- 指向 +x（右）：rotation [0, 90, 0]
- 指向 -x（左）：rotation [0, -90, 0]
- 指向 -y（前，朝觀看者）：rotation [90, 0, 0]
- 指向 +y（後）：rotation [-90, 0, 0]
- 指向下 -z：rotation [180, 0, 0]
例：橫躺、長 40、直徑 30、尖端朝右的圓錐 → shape "cone", size [30,30,40], rotation [0,90,0]
例：水平放置的啞鈴 → 兩顆球在左右，中間握把是 cylinder size [8,8,50] rotation [0,90,0]

【規劃要求】
1. 先在 observation 寫下觀察：物品由哪些部分組成、主軸是水平還是垂直、每個部分的形狀與「朝向」（尖端/開口/寬的一端朝哪裡）、左右是否對稱、各部分大約比例、要忽略照片中哪些東西。
2. 再依觀察產生 parts。零件 2~12 個，模型最大邊長約 60~120 mm（若使用者有指定尺寸就照做），零件之間要互相接觸或重疊，整體最低點放在地面 z = 0。
3. 對稱的零件用 duplicate + mirror 或 rotate 表達；需要旋轉的零件一定要有 rotate 步驟。
4. color 用 #RRGGBB，接近照片顏色。
5. steps 依序列出學生的操作，每步一個 op，parts 為零件索引（0 起算），text 用繁體中文一句話、寫出具體數值（尺寸、角度、位置）。
   建議順序：shapes → scale → rotate → move/lift/align → hole → duplicate/mirror → color → group。
   duplicate 的 parts 第一個是來源零件，其餘是複製出的零件。

只輸出 JSON：
{
 "object": "物品名稱",
 "observation": "觀察與結構分析（3~5 句）",
 "summary": "建模思路（2~3 句）",
 "difficulty": "入門|初級|中級",
 "operations": [{"id":"操作id","reason":"為什麼需要（具體，每個 id 只出現一次）"}],
 "parts": [{"name":"零件名","shape":"形狀","top":0,"hole":false,"color":"#RRGGBB","size":[x,y,z],"center":[x,y,z],"rotation":[0,0,0]}],
 "steps": [{"op":"操作id","parts":[0],"text":"步驟說明"}]
}`;

const REVIEW = `下面附上：(1) 使用者原本的照片；(2) 你上一版 JSON 在 Tinkercad 裡實際組出來的 3D 預覽圖（四格：正面、右側、斜角、俯視；模型左前方的箭頭 紅=+x 右、綠=+y 後、藍=+z 上；灰色斜紋是挖空零件）。
請像老師批改一樣仔細比對照片與預覽圖，逐項檢查：
- 每個零件的「朝向」是否正確（尖端/開口/寬的一端朝哪裡？是否應該橫躺而不是直立？請對照旋轉對照表）
- 整體比例、長寬高、零件大小關係
- 零件位置是否正確、有沒有互相接觸（不可懸空分離）
- 有沒有漏掉主要零件、或多出使用者要求省略的東西
在 observation 中先寫出你發現的問題，然後輸出「修正後的完整 JSON」（同樣格式，steps 也要配合修正，例如補上 rotate 步驟）。若完全正確也請原樣輸出。`;

// 縮小圖片以節省 token
export function shrinkImage(file, max = 1024) {
  return new Promise((resolve, reject) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); // 透明背景（PNG/WebP）補白
      x.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url); resolve(c.toDataURL('image/jpeg', 0.88));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('無法讀取圖片：' + file.name)); };
    img.src = url;
  });
}

async function chat({ key, model, messages }) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key.trim() },
    body: JSON.stringify({ model: model || 'gpt-5-mini', response_format: { type: 'json_object' }, messages }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || res.statusText;
    if (res.status === 401) throw new Error('API 金鑰無效或已過期（401）');
    if (res.status === 404) throw new Error(`找不到模型「${model}」或你的帳號無法使用（404）：${msg}`);
    if (res.status === 429) throw new Error('額度不足或請求過於頻繁（429）：' + msg);
    throw new Error(`OpenAI 錯誤 ${res.status}：${msg}`);
  }
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error('OpenAI 沒有回傳內容');
  try { return JSON.parse(text); } catch { const m = text.match(/\{[\s\S]*\}/); if (m) return JSON.parse(m[0]); throw new Error('AI 回傳格式無法解析'); }
}

const photoContent = (images, note, extra) => {
  const c = [{ type: 'text', text: `這是同一個物品的 ${images.length} 張照片/圖片。${note ? '使用者補充說明（務必遵守）：' + note : ''}${extra || '請依規則輸出 JSON。'}` }];
  images.forEach(u => c.push({ type: 'image_url', image_url: { url: u, detail: 'high' } }));
  return c;
};

export async function analyzePhotos({ key, model, images, note }) {
  if (!key) throw new Error('請先輸入 OpenAI API 金鑰');
  if (!images.length) throw new Error('請至少上傳一張照片');
  return chat({ key, model, messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: photoContent(images, note) }] });
}

// 自我檢查：把 3D 預覽圖給 AI 看，請它修正
export async function reviewPlan({ key, model, images, note, planJson, preview }) {
  const content = photoContent(images, note, '');
  content.push({ type: 'text', text: '你上一版的 JSON：\n' + planJson + '\n\n' + REVIEW });
  content.push({ type: 'image_url', image_url: { url: preview, detail: 'high' } });
  return chat({ key, model, messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content }] });
}
