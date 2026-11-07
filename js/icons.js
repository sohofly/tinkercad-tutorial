// 介面圖示（SVG）
const s = (d, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ${extra}>${d}</svg>`;

export const FICON = {
  shapes: s('<path d="M3 8l5-3 5 3v6l-5 3-5-3z"/><path d="M3 8l5 3 5-3M8 11v6"/><circle cx="17.5" cy="15.5" r="3.5"/>'),
  move: s('<path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/>'),
  lift: s('<path d="M12 2l-3 5h6z" fill="currentColor"/><rect x="6" y="11" width="12" height="7" rx="1"/><path d="M4 22h16" stroke-dasharray="2 2"/>'),
  drop: s('<rect x="7" y="3" width="10" height="7" rx="1"/><path d="M12 12v6M9 15l3 3 3-3M3 21h18"/>'),
  rotate: s('<path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4v5h-5"/>'),
  scale: s('<rect x="4" y="10" width="10" height="10" rx="1"/><path d="M13 4h7v7M20 4l-8 8"/>'),
  hole: s('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9l6-6M3 15L15 3M3 21L21 3M9 21l12-12M15 21l6-6"/>'),
  color: s('<path d="M12 3a9 9 0 1 0 0 18c1.4 0 2-1 2-2 0-1.6-1.6-1.6-1.6-3 0-1 .8-1.6 1.8-1.6H17a4 4 0 0 0 4-4C21 6.5 17 3 12 3z"/><circle cx="7.5" cy="11" r="1.2" fill="currentColor"/><circle cx="10" cy="7" r="1.2" fill="currentColor"/><circle cx="15" cy="7" r="1.2" fill="currentColor"/>'),
  group: s('<rect x="3" y="3" width="11" height="11" rx="1"/><rect x="10" y="10" width="11" height="11" rx="1" fill="currentColor" fill-opacity=".25"/>'),
  ungroup: s('<rect x="2" y="2" width="9" height="9" rx="1"/><rect x="13" y="13" width="9" height="9" rx="1"/><path d="M14 4h6v6M10 20H4v-6" stroke-dasharray="2 2"/>'),
  align: s('<path d="M4 3v18"/><rect x="7" y="5" width="12" height="5" rx="1"/><rect x="7" y="14" width="8" height="5" rx="1"/>'),
  mirror: s('<path d="M12 3v18" stroke-dasharray="2 2"/><path d="M9 6L3 18h6z"/><path d="M15 6l6 12h-6z" fill="currentColor" fill-opacity=".25"/>'),
  duplicate: s('<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/><path d="M14.5 12v6M11.5 15h6"/>'),
  workplane: s('<path d="M2 16l6-8h14l-6 8z"/><path d="M5 12h14M11 8l-3 8M17 8l-3 8"/>'),
  ruler: s('<path d="M3 3h5v13h13v5H3z"/><path d="M3 7h2M3 11h2M3 15h2M12 21v-2M16 21v-2"/>'),
  view: s('<path d="M12 2l8.5 5v10L12 22l-8.5-5V7z"/><path d="M12 12l8.5-5M12 12v10M12 12L3.5 7"/>'),
  copy: s('<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M5 16H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v1"/>'),
  paste: s('<rect x="5" y="4" width="14" height="18" rx="2"/><path d="M9 2h6v4H9z"/>'),
  del: s('<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14"/>'),
  undo: s('<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>'),
  redo: s('<path d="M15 14l5-5-5-5"/><path d="M20 9H9a5 5 0 0 0 0 10h3"/>'),
  play: s('<path d="M7 4l13 8-13 8z" fill="currentColor"/>'),
  pause: s('<path d="M7 4h3v16H7zM14 4h3v16h-3z" fill="currentColor"/>'),
  replay: s('<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>'),
  upload: s('<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>'),
  spark: s('<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>'),
};

// 形狀面板小圖示
const iso = (c, body) => `<svg viewBox="0 0 40 40">${body.replaceAll('C', c)}</svg>`;
export const SICON = {
  box: c => iso(c, '<path d="M20 6l13 7v14l-13 7-13-7V13z" fill="C"/><path d="M20 20l13-7v14l-13 7z" fill="#000" opacity=".22"/><path d="M20 20L7 13v14l13 7z" fill="#000" opacity=".08"/><path d="M7 13l13-7 13 7-13 7z" fill="#fff" opacity=".18"/>'),
  cylinder: c => iso(c, '<path d="M8 10v20a12 5 0 0 0 24 0V10z" fill="C"/><path d="M20 15v20a12 5 0 0 0 12-5V10z" fill="#000" opacity=".18"/><ellipse cx="20" cy="10" rx="12" ry="5" fill="C"/><ellipse cx="20" cy="10" rx="12" ry="5" fill="#fff" opacity=".25"/>'),
  sphere: c => iso(c, '<circle cx="20" cy="20" r="14" fill="C"/><circle cx="24" cy="24" r="12" fill="#000" opacity=".15"/><circle cx="15" cy="14" r="5" fill="#fff" opacity=".35"/>'),
  cone: c => iso(c, '<path d="M20 4L8 30a12 5 0 0 0 24 0z" fill="C"/><path d="M20 4l12 26a12 5 0 0 1-12 5z" fill="#000" opacity=".2"/>'),
  roof: c => iso(c, '<path d="M14 8l-10 22h22L36 18 26 8z" fill="C"/><path d="M26 8l10 10v-0l-10 12z" fill="#000" opacity=".22"/><path d="M14 8h12l-10 22H4z" fill="#fff" opacity=".1"/>'),
  wedge: c => iso(c, '<path d="M6 8v24h28z" fill="C"/><path d="M6 8l28 24H6z" fill="#fff" opacity=".12"/><path d="M6 32h28l-6-4H10z" fill="#000" opacity=".2"/>'),
  pyramid: c => iso(c, '<path d="M20 4L5 30l15 6 15-6z" fill="C"/><path d="M20 4l15 26-15 6z" fill="#000" opacity=".22"/>'),
  halfsphere: c => iso(c, '<path d="M6 26a14 14 0 0 1 28 0z" fill="C"/><ellipse cx="20" cy="26" rx="14" ry="4" fill="C"/><ellipse cx="20" cy="26" rx="14" ry="4" fill="#000" opacity=".2"/><circle cx="15" cy="18" r="3.5" fill="#fff" opacity=".3"/>'),
  torus: c => iso(c, '<ellipse cx="20" cy="20" rx="16" ry="9" fill="C"/><ellipse cx="20" cy="18.5" rx="7" ry="3.4" fill="#fff"/><ellipse cx="20" cy="22" rx="16" ry="7" fill="none" stroke="#000" opacity=".15" stroke-width="2"/>'),
  tube: c => iso(c, '<path d="M8 10v20a12 5 0 0 0 24 0V10z" fill="C"/><path d="M20 15v20a12 5 0 0 0 12-5V10z" fill="#000" opacity=".18"/><ellipse cx="20" cy="10" rx="12" ry="5" fill="C"/><ellipse cx="20" cy="10" rx="8" ry="3.2" fill="#fff"/>'),
};
