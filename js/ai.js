// 透過 OpenAI API 分析照片，產生 Tinkercad 建模建議（JSON）
import { FEATURES } from './demos.js';
import { SHAPES } from './scene.js';

const OPS = FEATURES.map(f => `${f.id}：${f.name}`).join('\n');
const SH = Object.entries(SHAPES).map(([k, v]) => `${k}（${v.name}）`).join('、');

const SYSTEM = `你是國中小生活科技課的 Tinkercad 3D 建模老師。使用者會上傳同一個物品的 1~3 張照片（可能不同角度）。
請辨識物品，並用「最少、最適合學生」的 Tinkercad 基本形狀與操作，規劃一個簡化但形似的 3D 模型。

只能使用以下形狀 shape：${SH}
只能使用以下操作 id：
${OPS}

座標系統（Tinkercad，單位 mm）：x 向右、y 向後（遠離觀看者）、z 向上；工作平面約 200×200。
- size = [長(x), 寬(y), 高(z)]，未旋轉前的外框尺寸
- position = [中心 x, 中心 y, 底部 z]；放在地面時底部 z = 0
- rotation = [繞 X, 繞 Y, 繞 Z] 角度（度）
- hole = true 表示挖空物件（灰色斜紋，群組後會被扣除）
- 模型整體控制在 120 mm 以內、零件 2~10 個，挖空零件要確實穿入實心零件
- color 用 #RRGGBB，盡量接近照片中的顏色

steps 是學生要依序執行的操作，每步只用一個 op，parts 為零件索引（從 0 開始），text 用繁體中文、一句話、具體寫出數值。
建議流程：shapes → scale → rotate/lift/move/align → hole → duplicate/mirror（若有對稱或重複零件）→ color → group。
若用 duplicate，parts 的第一個是來源零件，其餘是複製出來的零件。

只輸出 JSON，格式：
{
 "object": "物品名稱",
 "summary": "建模思路，2~3 句",
 "difficulty": "入門|初級|中級",
 "operations": [{"id":"操作id","reason":"為什麼需要這個操作（具體）"}],
 "parts": [{"name":"零件名","shape":"形狀","hole":false,"color":"#RRGGBB","size":[x,y,z],"position":[x,y,z],"rotation":[0,0,0]}],
 "steps": [{"op":"操作id","parts":[0],"text":"步驟說明"}]
}`;

// 縮小圖片以節省 token
export function shrinkImage(file, max = 1024) {
  return new Promise((resolve, reject) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url); resolve(c.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('無法讀取圖片：' + file.name)); };
    img.src = url;
  });
}

export async function analyzePhotos({ key, model, images, note }) {
  if (!key) throw new Error('請先輸入 OpenAI API 金鑰');
  if (!images.length) throw new Error('請至少上傳一張照片');
  const content = [{ type: 'text', text: `這是同一個物品的 ${images.length} 張照片。${note ? '補充說明：' + note : ''}請依規則輸出 JSON。` }];
  images.forEach(u => content.push({ type: 'image_url', image_url: { url: u, detail: 'auto' } }));
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key.trim() },
    body: JSON.stringify({ model: model || 'gpt-4o-mini', response_format: { type: 'json_object' }, messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content }] }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || res.statusText;
    if (res.status === 401) throw new Error('API 金鑰無效或已過期（401）');
    if (res.status === 429) throw new Error('額度不足或請求過於頻繁（429）：' + msg);
    throw new Error(`OpenAI 錯誤 ${res.status}：${msg}`);
  }
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error('OpenAI 沒有回傳內容');
  try { return JSON.parse(text); } catch { const m = text.match(/\{[\s\S]*\}/); if (m) return JSON.parse(m[0]); throw new Error('AI 回傳格式無法解析'); }
}
