// 军棋前端 — SVG 真实线图棋盘（铁路双线/公路/两国前线，卡片背面"军棋"）
var jq = null, jqSel = null;
var jqAiBusy = false;
var jqTimer = null;
function jqLevel() { const el = document.getElementById('diff'); return el ? el.value : 'normal'; }
function jq2P() { try { return localStorage.getItem('fnos_mode') === '2p'; } catch (e) { return false; } }
function boot_junqi_solo() {
  jq = new JunqiBoard('flip');
  jqSel = null; jqAiBusy = false; gameStartTs = Date.now();
  jq._steps = 0;
  if (window.applyTimer) { applyTimer(); resetTimer('r'); }
  render_junqi();
  const lbl = { easy: '简单', normal: '普通', hard: '困难' }[jqLevel()];
  if (jq2P()) setStatus('junqi-st', '双人同屏 · 红方（你）先翻，红蓝轮流');
  else setStatus('junqi-st', '难度：' + lbl + ' · 轮到你（红方）翻第一枚');
}
const FACE = { s9:'司令', s8:'军长', s7:'师长', s6:'旅长', s5:'团长', s4:'营长', s3:'连长', s2:'排长', s1:'工兵', lei:'地雷', zha:'炸弹', jq:'军旗' };
function junqiOver(w) {
  jqSel = null;
  render_junqi();
  const durTxt = fmtDur(gameDurationSec());
  let steps = 0;
  try { steps = (jq.movesRecord || []).length; } catch (e) {}
  setStatus('junqi-st', w === 'r' ? '🎉 红方胜！' : '蓝方胜');
  if (w === 'r') { recordGame({ game: 'junqi', result: 'win', dur: durTxt, steps: steps }); gameResultPopup(true, '🏆 红方胜！', '扛获蓝军旗或全歼蓝方 · 用时 ' + durTxt); }
  else { recordGame({ game: 'junqi', result: 'lose', dur: durTxt, steps: steps }); gameResultPopup(false, '💔 蓝方胜', '军旗被扛或无子可动 · 用时 ' + durTxt); }
}
function render_junqi() {
  const el = document.getElementById('game-canvas');
  if (!el) return;
  // ===== 标准陆战棋棋盘：5列 × 12行（蓝方上 0-5 行、红方下 6-11 行），中缝为山界 =====
  const CS = 46, GAP = 7, PAD = 20, FRONT = 44;
  const R = jq.R, C = jq.C;
  const W = PAD * 2 + C * CS + (C - 1) * GAP;
  const halfH = 5 * (CS + GAP) + CS;
  const H = PAD * 2 + halfH * 2 + FRONT;
  const px = (c) => PAD + c * (CS + GAP) + CS / 2;
  const py = (r) => (r <= 5)
      ? PAD + r * (CS + GAP) + CS / 2
      : PAD + halfH + FRONT + (r - 6) * (CS + GAP) + CS / 2;
  var jqBG = 'white';   // 背景选择功能已移除，固定白底
  const bgFill   = ({ white: '#fffdf8', wood: '#f0e2c4', dark: '#22303f', blue: '#123055' })[jqBG] || '#fffdf8';
  const lineCol  = ({ white: '#222',    wood: '#8b5a2b', dark: '#cfd8e3', blue: '#9dc0e8' })[jqBG] || '#222';
  const fieldFill= ({ white: '#ffffff', wood: '#f8f1de', dark: '#2c3e50', blue: '#1b3d6b' })[jqBG] || '#fff';
  const faint    = ({ white: 'rgba(0,0,0,0.45)', wood: 'rgba(120,70,20,0.55)', dark: 'rgba(255,255,255,0.4)', blue: 'rgba(230,240,255,0.45)' })[jqBG] || 'rgba(0,0,0,0.45)';
  let s = `<svg id="junqi-b" viewBox="0 0 ${W} ${H}" style="touch-action:manipulation;width:auto;max-width:100%;max-height:calc(100vh - 190px);display:block;margin:0 auto">`;
  s += `<rect x="0" y="0" width="${W}" height="${H}" fill="${bgFill}" rx="10"/>`;
  const isCamp = (r, c) => CAMP_LIST.some(([a, b]) => a === r && b === c);
  const isHQ = (r, c) => HQ_LIST.some(([a, b]) => a === r && b === c);
  const crossFront = (r1, r2, c) => ((r1 === 5 && r2 === 6) || (r1 === 6 && r2 === 5)) && FRONT_COLS.indexOf(c) < 0;

  // ---- 公路（细线）：同半场内正交相邻 ----
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    if (c + 1 < C) {
      const x1 = px(c) + CS / 2, x2 = px(c + 1) - CS / 2, y = py(r);
      s += `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="${lineCol}" stroke-width="1" opacity="0.55"/>`;
    }
    if (r + 1 < R && !crossFront(r, r + 1, c)) {
      const y1 = py(r) + CS / 2, y2 = py(r + 1) - CS / 2, x = px(c);
      s += `<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" stroke="${lineCol}" stroke-width="1" opacity="0.55"/>`;
    }
  }
  // ---- 行营斜线（连四角兵站，形成经典的菱形/Rose 图案，仅局部） ----
  for (const [r, c] of CAMP_LIST) {
    const x = px(c), y = py(r);
    [[1,1],[1,-1],[-1,1],[-1,-1]].forEach(([dr, dc]) => {
      const rr = r + dr, cc = c + dc;
      if (rr < 0 || rr >= R || cc < 0 || cc >= C) return;
      if (crossFront(r, rr, c)) return;
      s += `<line x1="${x}" y1="${y}" x2="${px(cc)}" y2="${py(rr)}" stroke="${lineCol}" stroke-width="1" opacity="0.55"/>`;
    });
  }
  // ---- 铁路（双线 + 白色虚线中心 + 横枕） ----
  const rail = (x1, y1, x2, y2) => {
    const horiz = Math.abs(y2 - y1) < 0.01;
    const d = 3.2;
    if (horiz) {
      s += `<line x1="${x1}" y1="${y1 - d}" x2="${x2}" y2="${y2 - d}" stroke="${lineCol}" stroke-width="2.6"/>`;
      s += `<line x1="${x1}" y1="${y1 + d}" x2="${x2}" y2="${y2 + d}" stroke="${lineCol}" stroke-width="2.6"/>`;
      s += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#fff" stroke-width="1.6" stroke-dasharray="7,5"/>`;
    } else {
      s += `<line x1="${x1 - d}" y1="${y1}" x2="${x2 - d}" y2="${y2}" stroke="${lineCol}" stroke-width="2.6"/>`;
      s += `<line x1="${x1 + d}" y1="${y1}" x2="${x2 + d}" y2="${y2}" stroke="${lineCol}" stroke-width="2.6"/>`;
      s += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#fff" stroke-width="1.6" stroke-dasharray="7,5"/>`;
    }
  };
  // 横向铁路 r∈{2,5,6,9} 通贯全宽
  for (const r of RAIL_ROWS) rail(px(0) - CS / 2 + 2, py(r), px(C - 1) + CS / 2 - 2, py(r));
  // 纵向铁路 c∈{0,4} 各自半场贯通
  for (const c of RAIL_COLS) {
    rail(px(c), py(0) - CS / 2 + 2, px(c), py(5) + CS / 2 - 2);
    rail(px(c), py(6) - CS / 2 + 2, px(c), py(11) + CS / 2 - 2);
  }
  // 山界三处铁路通口（c=0,2,4）
  for (const c of FRONT_COLS) rail(px(c), py(5) + CS / 2, px(c), py(6) - CS / 2);

  // ---- 山界带 ----
  const yMidTop = py(5) + CS / 2 + 3, yMidBot = py(6) - CS / 2 - 3;
  s += `<line x1="${PAD - 10}" y1="${yMidTop}" x2="${W - PAD + 10}" y2="${yMidTop}" stroke="${lineCol}" stroke-width="1" stroke-dasharray="4,4" opacity="0.6"/>`;
  s += `<line x1="${PAD - 10}" y1="${yMidBot}" x2="${W - PAD + 10}" y2="${yMidBot}" stroke="${lineCol}" stroke-width="1" stroke-dasharray="4,4" opacity="0.6"/>`;
  s += `<text x="${PAD + 30}" y="${(yMidTop + yMidBot) / 2 + 4}" font-size="12" fill="#b03a3a" font-family="Kaiti, serif" opacity="0.9">山</text>`;
  s += `<text x="${PAD + 58}" y="${(yMidTop + yMidBot) / 2 + 4}" font-size="12" fill="#b03a3a" font-family="Kaiti, serif" opacity="0.9">界</text>`;
  s += `<text x="${W - PAD - 30}" y="${(yMidTop + yMidBot) / 2 + 4}" font-size="11" fill="${faint}" font-family="Kaiti, serif" text-anchor="end">前线（仅两侧与中路可通）</text>`;

  // ---- 棋位 ----
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    const x = px(c), y = py(r);
    if (isCamp(r, c)) {
      // 行营：圆 + 内 X
      s += `<circle cx="${x}" cy="${y}" r="${CS / 2 - 3}" fill="${fieldFill}" stroke="${lineCol}" stroke-width="1.8"/>`;
      const RX = (CS / 2 - 12) / 1.414;
      s += `<line x1="${x - RX}" y1="${y - RX}" x2="${x + RX}" y2="${y + RX}" stroke="${lineCol}" stroke-width="1.2" opacity="0.75"/>`;
      s += `<line x1="${x - RX}" y1="${y + RX}" x2="${x + RX}" y2="${y - RX}" stroke="${lineCol}" stroke-width="1.2" opacity="0.75"/>`;
      s += `<text x="${x}" y="${y + CS * 0.09}" font-size="10" fill="${faint}" font-family="Kaiti, serif" text-anchor="middle" style="pointer-events:none">行营</text>`;
    } else if (isHQ(r, c)) {
      s += `<rect x="${x - CS / 2 + 2}" y="${y - CS / 2 + 2}" width="${CS - 4}" height="${CS - 4}" rx="5" fill="${fieldFill}" stroke="${lineCol}" stroke-width="1.8"/>`;
      s += `<rect x="${x - CS / 2 + 6}" y="${y - CS / 2 + 6}" width="${CS - 12}" height="${CS - 12}" rx="3" fill="none" stroke="${lineCol}" stroke-width="1" opacity="0.6"/>`;
      s += `<text x="${x}" y="${y + CS * 0.09}" font-size="10.5" fill="${faint}" font-family="Kaiti, serif" text-anchor="middle" style="pointer-events:none">大本营</text>`;
    } else {
      s += `<rect x="${x - CS / 2 + 3}" y="${y - CS / 2 + 3}" width="${CS - 6}" height="${CS - 6}" rx="4" fill="${fieldFill}" stroke="${lineCol}" stroke-width="1.1" opacity="0.95"/>`;
      s += `<text x="${x}" y="${y + CS * 0.09}" font-size="9.5" fill="${faint}" font-family="Kaiti, serif" text-anchor="middle" style="pointer-events:none">兵站</text>`;
    }
  }
  // ---- 棋子 ----
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    const p = jq.cells[r][c];
    const x = px(c), y = py(r);
    if (!p) { s += `<rect x="${x - CS/2}" y="${y - CS/2}" width="${CS}" height="${CS}" fill="transparent" onclick="jqClick(${r},${c})" style="cursor:pointer"/>`; continue; }
    const S = CS - 10;                       // 棋子边长
    const isOpen = jq.shown[r][c] || (p && p.owner);   // 有归属=已翻开，防止暗牌样式盖住军衔
    if (!isOpen) {
      const gid = 'gu' + r + '_' + c;
      s += `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3d5c99"/><stop offset="1" stop-color="#22355e"/></linearGradient></defs>`;
      s += `<rect x="${x - S/2}" y="${y - S/2}" width="${S}" height="${S}" rx="7" fill="url(#${gid})" stroke="#16294a" stroke-width="1.8"/>`;
      s += `<rect x="${x - S/2 + 3}" y="${y - S/2 + 3}" width="${S - 6}" height="${S - 6}" rx="5" fill="none" stroke="#ffd964" stroke-width="0.9" opacity="0.75"/>`;
      const cx5 = x, cy5 = y - S * 0.15, R5 = S * 0.17;
      let pts = [];
      for (let i = 0; i <= 5; i++) {
        const a1 = -Math.PI / 2 + i * 2 * Math.PI / 5, a2 = a1 + Math.PI / 5;
        pts.push((cx5 + R5 * Math.cos(a1)).toFixed(1) + ',' + (cy5 + R5 * Math.sin(a1)).toFixed(1));
        pts.push((cx5 + R5 * 0.42 * Math.cos(a2)).toFixed(1) + ',' + (cy5 + R5 * 0.42 * Math.sin(a2)).toFixed(1));
      }
      s += `<polygon points="${pts.join(' ')}" fill="#fff" style="pointer-events:none"/>`;
      s += `<text x="${x}" y="${y + S*0.31}" font-size="${S*0.26}" fill="#ffe9a8" font-family="Kaiti, serif" font-weight="bold" text-anchor="middle" style="pointer-events:none">军棋</text>`;
    } else {
      const isRed = p.owner === 'r';
      const gid = 'gp' + r + '_' + c;
      const top = isRed ? '#fff8ea' : '#2f4f80', bot = isRed ? '#f0d3b4' : '#1a2e52';
      const col = isRed ? '#b0181c' : '#ffd964', bcol = isRed ? '#8e1a1a' : '#0d1b36';
      s += `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bot}"/></linearGradient></defs>`;
      s += `<rect x="${x - S/2}" y="${y - S/2}" width="${S}" height="${S}" rx="7" fill="url(#${gid})" stroke="${bcol}" stroke-width="2"/>`;
      s += `<rect x="${x - S/2 + 3}" y="${y - S/2 + 3}" width="${S - 6}" height="${S - 6}" rx="5" fill="none" stroke="${col}" stroke-width="0.9" opacity="0.8"/>`;
      const k = FACE[p.kind];
      const yTop = y - S * 0.14, yBase = y + S * 0.02, yBot = y + S * 0.20;
      if (k.length === 2) {
        s += `<text x="${x}" y="${yTop}" font-size="${S*0.40}" font-family="Kaiti, STKaiti, serif" font-weight="bold" fill="${col}" text-anchor="middle" dominant-baseline="middle" style="pointer-events:none">${k[0]}</text>`;
        s += `<text x="${x}" y="${yBot}" font-size="${S*0.40}" font-family="Kaiti, STKaiti, serif" font-weight="bold" fill="${col}" text-anchor="middle" dominant-baseline="middle" style="pointer-events:none">${k[1]}</text>`;
      } else {
        s += `<text x="${x}" y="${yBase}" font-size="${S*0.52}" font-family="Kaiti, STKaiti, serif" font-weight="bold" fill="${col}" text-anchor="middle" dominant-baseline="middle" style="pointer-events:none">${k}</text>`;
      }
    }
    // 入营标记：棋子压在营格上时，仍能看出它站在行营（受保护）/ 大本营（不可移动）
    if (isCamp(r, c)) {
      s += `<circle cx="${x}" cy="${y}" r="${CS/2 - 1.5}" fill="none" stroke="#f59e0b" stroke-width="2.2" stroke-dasharray="5,3"/>`;
      s += `<text x="${x - CS/2 + 3}" y="${y - CS/2 + 9}" font-size="9" fill="#f59e0b" font-family="Kaiti, serif" font-weight="bold" style="pointer-events:none">营</text>`;
    } else if (isHQ(r, c)) {
      s += `<rect x="${x - CS/2 + 1}" y="${y - CS/2 + 1}" width="${CS - 2}" height="${CS - 2}" rx="9" fill="none" stroke="#7f8c8d" stroke-width="2" stroke-dasharray="4,3"/>`;
      s += `<text x="${x - CS/2 + 3}" y="${y - CS/2 + 9}" font-size="9" fill="#7f8c8d" font-family="Kaiti, serif" font-weight="bold" style="pointer-events:none">本</text>`;
    }
    if (jqSel && jqSel[0] === r && jqSel[1] === c) s += `<rect x="${x - CS/2 + 1}" y="${y - CS/2 + 1}" width="${CS - 2}" height="${CS - 2}" rx="9" fill="none" stroke="#ff9800" stroke-width="3"/>`;
    s += `<rect x="${x - CS/2}" y="${y - CS/2}" width="${CS}" height="${CS}" fill="transparent" onclick="jqClick(${r},${c})" style="cursor:pointer"/>`;
  }
  s += '</svg>';
  el.innerHTML = s;
}
function jqClick(r, c) {
  if (!jq || jqAiBusy) return;
  const p = jq.cells[r][c];
  if (p && !jq.shown[r][c]) { jq.flip(r, c); }
  else if (jqSel) {
    const res = jq.movePiece(jqSel, [r, c]);
    if (!res.ok && jq.cells[r][c] && jq.shown[r][c] && jq.cells[r][c].owner === 'r') { jqSel = [r, c]; render_junqi(); return; }
    jqSel = null;
  } else if (p && jq.shown[r][c] && p.owner === 'r') {
    jqSel = [r, c]; render_junqi(); setStatus('junqi-st', '已选 ' + FACE[p.kind] + ' · 点相邻格移动/吃子');
    return;
  }
  jqSel = null;
  render_junqi();
  junqiAfter();
}
function junqiAfter() {
  const w = jq.winner();
  if (w) return junqiOver(w);
  swapTimer();
  if (window.autoSnapshot) autoSnapshot();
  if (jq2P()) {
    setStatus('junqi-st', '双人同屏 · 轮到 ' + (jq.turnOwner() === 'r' ? '红方' : '蓝方'));
    if (window.autoCoachIfOn) autoCoachIfOn();
    return;
  }
  if (jq.turnOwner() === 'b') {
    setStatus('junqi-st', '蓝方 AI 行动中…'); jqAiBusy = true;
    if (jqTimer) { clearTimeout(jqTimer); jqTimer = null; }
    jqTimer = setTimeout(() => { jqAiBusy = false; jqTimer = null; try { jqAiTurn(); } catch (e) { setStatus('junqi-st', 'AI 出错，已交回你走：' + e.message); } }, 120);
  } else setStatus('junqi-st', '轮到你（红方）');
}
function jqAiTurn() {
  const w0 = jq.winner(); if (w0) return junqiOver(w0);
  if (jq.turnOwner() !== 'b') { setStatus('junqi-st', '轮到你（红方）'); return; }
  const lvl = jqLevel();
  const flips = [], moves = [];
  for (let r = 0; r < jq.R; r++) for (let c = 0; c < jq.C; c++) {
    const p = jq.cells[r][c];
    if (p && !jq.shown[r][c]) flips.push([r, c]);
    else if (p && jq.shown[r][c] && p.owner === 'b') {
      [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]].forEach(([dr,dc]) => { const tr=r+dr,tc=c+dc; if (jq.canMove([r,c],[tr,tc])) moves.push([[r,c],[tr,tc]]); });
    }
  }
  const doFlip = () => jq.flip(...flips[Math.floor(Math.random() * flips.length)]);
  const doMove = () => { const p = moves[Math.floor(Math.random() * moves.length)]; jq.movePiece(p[0], p[1]); };
  if (lvl === 'easy') {
    if (flips.length && (Math.random() < 0.6 || !moves.length)) doFlip(); else if (moves.length) doMove(); else if (flips.length) doFlip(); else jq.turn = 1 - jq.turn;
  } else {
    const scored = moves.map(([f, t]) => {
      const tp = jq.cells[t[0]][t[1]];
      let sc = 0;
      if (tp) {
        const res = jq.battle(jq.cells[f[0]][f[1]].kind, tp.kind);
        if (res === 'win') sc = tp.kind === 'jq' ? 1000 : KIND_RANK[tp.kind] * 10 + 10;
        else if (res === 'both') sc = KIND_RANK[tp.kind] * 5 - KIND_RANK[jq.cells[f[0]][f[1]].kind] * 5;
        else sc = -20;
      } else sc = 1;
      return { f, t, sc };
    }).sort((a, b) => b.sc - a.sc);
    const myMove = scored[0];
    if (myMove && myMove.sc > 5) { jq.movePiece(myMove.f, myMove.t); }
    else if (flips.length && (moves.length === 0 || Math.random() < (lvl === 'hard' ? 0.5 : 0.6))) doFlip();
    else if (moves.length) doMove();
    else if (flips.length) doFlip();
    else jq.turn = 1 - jq.turn;
  }
  jqSel = null;
  render_junqi();
  const w = jq.winner();
  if (w) return junqiOver(w);
  setStatus('junqi-st', '轮到你（红方）');
  swapTimer();
  if (window.autoCoachIfOn) autoCoachIfOn();
}
window.junqiUndo = function() {
  if (jqTimer) { clearTimeout(jqTimer); jqTimer = null; }
  jqAiBusy = false;
  const twoP = (function(){ try { return localStorage.getItem('fnos_mode') === '2p'; } catch (e) { return false; } })();
  let n = 0;
  if (twoP) { if (jq.undoLast()) n = 1; }
  else {
    if (jq.undoLast()) n++;                 // 撤 AI 一步
    if (jq.turnOwner() !== 'r' || n === 1) { if (jq.undoLast()) n++; }  // 再撤我方一步
    let guard = 0;
    while (jq.turnOwner() !== 'r' && jq._hist && jq._hist.length && guard++ < 4) { if (!jq.undoLast()) break; }
  }
  jqSel = null;
  render_junqi();
  setStatus('junqi-st', n ? ('已悔棋（' + n + ' 步）· ' + (jq.turnOwner() === 'r' ? '轮到你（红方）' : '轮到蓝方')) : '没有可悔的棋');
};

// —— 存档 / 恢复 ——
window.GAMEHOOKS = window.GAMEHOOKS || {};
GAMEHOOKS.junqi = {
  reviewPrompt: function () {
    const hist = (jq && jq._hist) ? jq._hist : [];
    const steps = hist.slice(-12).map(x => (x.type === 'flip' ? '翻子' : '走子/吃子') + '(' + x.r + ',' + x.c + ')' + (x.tr != null ? '→(' + x.tr + ',' + x.tc + ')' : '')).join('；');
    const res = jq && jq.flagTaken ? ('军旗被' + (jq.flagTaken === 'r' ? '蓝方' : '红方') + '吃掉') : '结束';
    return '【军棋（陆战棋翻棋）复盘】结果：' + res + '。总步数：' + (hist.length) + '。\n最后几步：' + (steps || '无') + '\n请点评开局翻子节奏、行营抢占与吃子取舍。';
  },

  started: function () { return !!jq; },
  inProgress: function () { return !!(jq && (jq._hist || []).length > 0 && !jq.winner() && !window.__gameOver); },
  serialize: function () {
  if (!jq) return null;
  const sel = curGameSelects();
  return {
    game: 'junqi', label: '军棋', mode: jq2P() ? '双人同屏' : '人机',
    diff: jqLevel(), timer: sel.timer,
    state: jq.serialize(), hist: jq._hist || [], flagTaken: jq.flagTaken || null,
    steps: (jq._hist || []).length,
    elapsed: Math.max(0, Math.floor((Date.now() - (gameStartTs || Date.now())) / 1000))
  };
},
  restore: function (sv) {
  try {
    if (jqTimer) { clearTimeout(jqTimer); jqTimer = null; }
    jqAiBusy = false; jqSel = null;
    jq = JunqiBoard.restore(sv.state);
    jq._hist = sv.hist || []; jq.flagTaken = sv.flagTaken || null;
    try { localStorage.setItem('fnos_mode', sv.mode === '双人同屏' ? '2p' : 'ai'); } catch (e) {}
    const d1 = document.getElementById('diff'); if (d1 && sv.diff) d1.value = sv.diff;
    const t1 = document.getElementById('timer');
    if (t1 && sv.timer != null) { t1.value = String(sv.timer); applyTimer(); }
    gameStartTs = Date.now() - (sv.elapsed || 0) * 1000;
    render_junqi(); swapTimer();
    const w = jq.winner();
    if (w) { junqiOver(w); return true; }
    if (!jq2P() && jq.turnOwner() === 'b') { setStatus('junqi-st', '已恢复存档 · 蓝方 AI 行动中…'); junqiAfter(); }
    else setStatus('junqi-st', '已恢复存档 · ' + (sv.mode || '') + ' · ' + (jq.turnOwner() === 'r' ? '轮到你（红方）' : '轮到蓝方'));
    return true;
  } catch (e) { alert('恢复失败：' + e.message); return false; }
  } };

window.boot_junqi_solo = boot_junqi_solo;

// ---- 残局（明棋）：双方各 25 子按标准陆战棋布阵（23兵站 + 2大本营），全部翻开，红先 ----
function junqiPuzzleLayout(mode) {
  let list = ['jq','lei','lei','lei','zha','zha','s1','s1','s1','s2','s2','s2','s3','s3','s3',
              's4','s4','s5','s5','s6','s6','s7','s7','s8','s9'];   // 25 枚（后→前）
  if (mode === 'mineFirst')  list = ['lei','lei','lei','zha','zha','s1','s1','s1','jq','s2','s2','s2','s3','s3','s3','s4','s4','s5','s5','s6','s6','s7','s7','s8','s9'];
  if (mode === 'boomMode')   list = ['zha','zha','jq','lei','lei','lei','s1','s1','s1','s2','s2','s2','s3','s3','s3','s4','s4','s5','s5','s6','s6','s7','s7','s8','s9'];
  const isC = (r, c) => CAMP_LIST.some(([a, b]) => a === r && b === c);
  const isH = (r, c) => HQ_LIST.some(([a, b]) => a === r && b === c);
  const slots = (side) => {
    const rows = side === 'b' ? [0, 1, 2, 3, 4, 5] : [11, 10, 9, 8, 7, 6];
    const out = side === 'b' ? [[0, 1], [0, 3]] : [[11, 1], [11, 3]];   // 大本营先放（军旗入营）
    for (const r of rows) for (let c = 0; c < 5; c++) if (!isC(r, c) && !isH(r, c)) out.push([r, c]);
    return out;
  };
  return { list, blue: slots('b'), red: slots('r') };
}
window.loadJunqiPuzzle = function(pz) {
  if (jqTimer) { clearTimeout(jqTimer); jqTimer = null; }
  jqAiBusy = false;
  jq = new JunqiBoard('flip');
  const mode = pz.mineFirst ? 'mineFirst' : (pz.boomMode ? 'boomMode' : 'open');
  const L = junqiPuzzleLayout(mode);
  for (let r = 0; r < jq.R; r++) for (let c = 0; c < jq.C; c++) { jq.cells[r][c] = null; jq.shown[r][c] = false; }
  const put = (cells, pieces, owner) => {
    for (let i = 0; i < cells.length; i++) {
      const [r, c] = cells[i];
      jq.cells[r][c] = { kind: pieces[i], owner: owner, faceDown: false };
      jq.shown[r][c] = true;
    }
  };
  put(L.blue, L.list.slice(), 'b');
  put(L.red, L.list.slice(), 'r');
  jq._hist = []; jq.flagTaken = null; jq.turn = 0;
  jqSel = null;
  gameStartTs = Date.now();
  render_junqi();
  setStatus('junqi-st', '残局『' + pz.name + '』· ' + pz.tip + ' · 轮到你（红方）');
};

function setJqBG(v) {
  try { localStorage.setItem('fnos_jq_bg', v); } catch (e) {}
  render_junqi();
}
window.setJqBG = setJqBG;
window.loadJunqiPuzzle = window.loadJunqiPuzzle || function() {};
