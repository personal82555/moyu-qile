// 象棋前端 — SVG 真实线图棋盘（9x10路、九宫斜线、楚河汉界、炮/兵位标记）
var cg = null, sel = null, aiBusy = false, aiTimer = null;
const DISP = { r: { '将': '帥', '士': '仕', '相': '相', '马': '馬', '车': '車', '炮': '砲', '兵': '兵' },
               b: { '将': '將', '士': '士', '相': '象', '马': '馬', '车': '車', '炮': '砲', '兵': '卒' } };
// 棋子SVG（markirish/xiangqi 案例样式）: t+s → /img/文件名
var IMG = {
  r: { '将': 'rG', '士': 'rA', '相': 'rE', '马': 'rH', '车': 'rR', '炮': 'rC', '兵': 'rS', '卒': 'rS' },
  b: { '将': 'bG', '士': 'bA', '相': 'bE', '马': 'bH', '车': 'bR', '炮': 'bC', '兵': 'bS', '卒': 'bS' }
};

function chessLevel() { const el = document.getElementById('diff'); return el ? el.value : 'normal'; }
function isTwoP() { try { return localStorage.getItem('fnos_mode') === '2p'; } catch (e) { return false; } }
function twoPLabel() { return isTwoP() ? '（双人：' + (cg.redTurn ? '红方走' : '黑方走') + '）' : ''; }
function boot_chess_solo() {
  if (aiTimer) { clearTimeout(aiTimer); aiTimer = null; }
  aiBusy = false;
  cg = new Chess();
  cg._startFen = null;
  sel = null; aiBusy = false; gameStartTs = Date.now(); cg._steps0 = 0;
  if (window.applyTimer) applyTimer(); resetTimer('r');
  render_chess();
  const lbl = { easy: '简单', normal: '普通', hard: '困难' }[chessLevel()];
  if (isTwoP()) setStatus('chess-st', '双人同屏 · 红方先行 · 红黑轮流点击自己棋子');
  else setStatus('chess-st', '难度：' + lbl + ' · 红方（你）先行 · 点选棋子后点击目标格');
}
function checkEnd() {
  if (cg.findK('b') === null) { setStatus('chess-st', '🎉 斩杀黑将，红方胜！'); cg.over = true; recordGame({ game: 'chess', result: 'win', dur: fmtDur(gameDurationSec()), steps: cg.moves.length }); gameResultPopup(true, '🏆 红方胜！', '你斩杀黑将 · 用时 ' + fmtDur(gameDurationSec()) + ' · 共 ' + cg.moves.length + ' 步'); return true; }
  if (cg.findK('r') === null) { setStatus('chess-st', '黑方胜'); cg.over = true; recordGame({ game: 'chess', result: 'lose', dur: fmtDur(gameDurationSec()), steps: cg.moves.length }); gameResultPopup(false, '💔 黑方胜', '黑方吃掉了你的帥 · 用时 ' + fmtDur(gameDurationSec())); return true; }
  if (cg.allLegal(cg.redTurn ? 'r' : 'b').length === 0) {
    cg.over = true;
    const durTxt = fmtDur(gameDurationSec());
    if (cg.inCheck(cg.redTurn ? 'r' : 'b')) {
      setStatus('chess-st', (cg.redTurn ? '红方被绝杀，黑胜' : '黑方被绝杀，红胜'));
      if (cg.redTurn) { recordGame({ game: 'chess', result: 'lose', dur: durTxt, steps: cg.moves.length }); gameResultPopup(false, '💔 黑方胜', '绝杀：你的帅无路可走 · 用时 ' + durTxt); }
      else { recordGame({ game: 'chess', result: 'win', dur: durTxt, steps: cg.moves.length }); gameResultPopup(true, '🏆 红方胜！', '绝杀黑方 · 用时 ' + durTxt); }
    }
    else {
      setStatus('chess-st', '困毙：' + (cg.redTurn ? '红' : '黑') + '方无子可动');
      if (cg.redTurn) { recordGame({ game: 'chess', result: 'lose', dur: durTxt, steps: cg.moves.length }); gameResultPopup(false, '💔 黑方胜', '困毙：你无子可动 · 用时 ' + durTxt); }
      else { recordGame({ game: 'chess', result: 'win', dur: durTxt, steps: cg.moves.length }); gameResultPopup(true, '🏆 红方胜！', '黑方困毙 · 用时 ' + durTxt); }
    }
    return true;
  }
  return false;
}
function render_chess() {
  const el = document.getElementById('game-canvas');
  if (!el) return;
  const CS = 44, PAD = 30;
  const W = PAD * 2 + CS * 8, H = PAD * 2 + CS * 9;
  const px = (c) => PAD + c * CS, py = (r) => PAD + r * CS;
  let s = `<svg id="chess-b" viewBox="0 0 ${W} ${H}" style="touch-action:manipulation;width:100%;max-width:520px;display:block;margin:auto">`;
  s += `<rect x="0" y="0" width="${W}" height="${H}" fill="#302013" rx="8"/>`;
  s += `<rect x="${PAD-14}" y="${PAD-14}" width="${W - 2*(PAD-14)}" height="${H - 2*(PAD-14)}" fill="#ebe5e1" stroke="#000" stroke-width="2"/>`;
  for (let r = 0; r < 10; r++) s += `<line x1="${px(0)}" y1="${py(r)}" x2="${px(8)}" y2="${py(r)}" stroke="#3a3a3a" stroke-width="1.6"/>`;
  for (let c = 0; c < 9; c++) {
    s += `<line x1="${px(c)}" y1="${py(0)}" x2="${px(c)}" y2="${py(4)}" stroke="#3a3a3a" stroke-width="1.6"/>`;
    s += `<line x1="${px(c)}" y1="${py(5)}" x2="${px(c)}" y2="${py(9)}" stroke="#3a3a3a" stroke-width="1.6"/>`;
  }
  // 外框加粗
  s += `<rect x="${px(0)-4}" y="${py(0)-4}" width="${CS*8+8}" height="${CS*9+8}" fill="none" stroke="#3a3a3a" stroke-width="3"/>`;
  // 九宫斜线
  s += `<line x1="${px(3)}" y1="${py(0)}" x2="${px(5)}" y2="${py(2)}" stroke="#3a3a3a" stroke-width="1.2"/>`;
  s += `<line x1="${px(5)}" y1="${py(0)}" x2="${px(3)}" y2="${py(2)}" stroke="#3a3a3a" stroke-width="1.2"/>`;
  s += `<line x1="${px(3)}" y1="${py(9)}" x2="${px(5)}" y2="${py(7)}" stroke="#3a3a3a" stroke-width="1.2"/>`;
  s += `<line x1="${px(5)}" y1="${py(9)}" x2="${px(3)}" y2="${py(7)}" stroke="#3a3a3a" stroke-width="1.2"/>`;
  // 楚河汉界
  s += `<text x="${px(1.8)}" y="${py(4) + 26}" font-size="22" fill="#3a3a3a" font-family="Kaiti, serif" text-anchor="middle">楚 河</text>`;
  s += `<text x="${px(6.2)}" y="${py(4) + 26}" font-size="22" fill="#3a3a3a" font-family="Kaiti, serif" text-anchor="middle">漢 界</text>`;
  // 炮/兵位小折角
  const cross = (r, c) => {
    const x = px(c), y = py(r), g = 5, d = 13;
    if (c === 0) return `<path d="M ${x+g} ${y-g-d} h ${d*0.8} M ${x+g} ${y+g+d} l ${d*0.8} 0 M ${x+g} ${y-g} l ${d*0.6} 0 M ${x+g} ${y+g} l ${d*0.6} 0" stroke="#3a3a3a" stroke-width="1.1" fill="none"/>`;
    if (c === 8) return `<path d="M ${x-g} ${y-g-d} l ${-d*0.8} 0 M ${x-g} ${y+g+d} l ${-d*0.8} 0 M ${x-g} ${y-g} l ${-d*0.6} 0 M ${x-g} ${y+g} l ${-d*0.6} 0" stroke="#3a3a3a" stroke-width="1.1" fill="none"/>`;
    return `<path d="M ${x-g} ${y-g-d} h ${d*0.8} M ${x+g} ${y-g-d} h ${-d*0.8} M ${x-g} ${y+g+d} h ${d*0.8} M ${x+g} ${y+g+d} h ${-d*0.8} M ${x-g} ${y-g} h ${d*0.6} M ${x-g} ${y+g} h ${d*0.6} M ${x+g} ${y-g} h ${-d*0.6} M ${x+g} ${y+g} h ${-d*0.6}" stroke="#3a3a3a" stroke-width="1.1" fill="none"/>`;
  };
  [[2,1],[2,7],[7,1],[7,7]].forEach(([r,c]) => s += cross(r,c));
  for (const r of [3,6]) for (let c = 0; c < 9; c += 2) s += cross(r,c);
  // 最后一步 + 棋子 + 热区
  const last = cg.moves.length ? cg.moves[cg.moves.length - 1] : null;
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 9; c++) {
      const x = px(c), y = py(r);
      if (sel) {
        const ok2 = cg.legal(sel[0], sel[1]).some(m => m[2] === r && m[3] === c);
        if (ok2) {
          if (cg.B[r][c]) s += `<circle cx="${x}" cy="${y}" r="${CS*0.52}" fill="none" stroke="#2a8e2a" stroke-width="2.4"/>`;
          else s += `<circle cx="${x}" cy="${y}" r="7" fill="rgba(46,164,46,.8)"/>`;
        }
      }
      const p = cg.B[r][c];
      if (p) {
        let ring = '';
        if (last && last[0] === r && last[1] === c) ring = `<circle cx="${x}" cy="${y}" r="${CS*0.54}" fill="none" stroke="#f90" stroke-width="2.4"/>`;
        if (sel && sel[0] === r && sel[1] === c) ring = `<circle cx="${x}" cy="${y}" r="${CS*0.54}" fill="none" stroke="#2b7de0" stroke-width="3"/>`;
        const pimg = IMG[p.s][p.t] || 'rG';
        s += `${ring}<image href="/img/${pimg}.svg" x="${x - CS*0.5}" y="${y - CS*0.5}" width="${CS}" height="${CS}" style="pointer-events:none"/>`;
      }
      s += `<rect x="${x - CS/2}" y="${y - CS/2}" width="${CS}" height="${CS}" fill="transparent" onclick="chessClick(${r},${c})" style="cursor:pointer"/>`;
    }
  }
  s += '</svg>';
  el.innerHTML = s;
}
function chessClick(r, c) {
  if (!cg || cg.over || aiBusy) { if (aiBusy) setStatus('chess-st', '黑方 AI 思考中…'); return; }
  if (sel) {
    const mv = cg.legal(sel[0], sel[1]).find(m => m[2] === r && m[3] === c);
    if (mv) {
      const killed = cg.B[r][c];
      cg.apply(mv);
      sel = null;
      const chk = cg.inCheck(cg.redTurn ? 'r' : 'b');
      setStatus('chess-st', (cg.redTurn ? '红' : '黑') + '方行棋' + (chk ? ' · 将军!' : '') + (killed ? '（吃子）' : ''));
      render_chess();
      swapTimer();   // 红走完切黑
      if (window.autoSnapshot) autoSnapshot();
      maybeAI();
      return;
    }
  }
  const side = cg.redTurn ? 'r' : 'b';
  if (cg.own(r, c, side)) {
    if (sel && sel[0] === r && sel[1] === c) { sel = null; render_chess(); setStatus('chess-st', '已取消选择'); return; }
    sel = [r, c]; render_chess();
    setStatus('chess-st', '已选 ' + DISP[side][cg.B[r][c].t] + ' · 绿圈=可走位置');
  } else { sel = null; render_chess(); setStatus('chess-st', '轮到红方（点己方棋子）'); }
}
function maybeAI(isUndo) {
  if (checkEnd()) return;
  if (isTwoP()) {
    const chk = cg.inCheck(cg.redTurn ? 'r' : 'b');
    setStatus('chess-st', '双人同屏 · 轮到 ' + (cg.redTurn ? '红方' : '黑方') + (chk ? ' · 将军!' : ''));
    if (cg.moves.length && window.autoCoachIfOn) autoCoachIfOn();
    return;
  }
  if (!cg.redTurn) {
    aiBusy = true;
    setStatus('chess-st', '黑方 AI 思考中…');
    if (aiTimer) { clearTimeout(aiTimer); aiTimer = null; }
    aiTimer = setTimeout(() => {
     try {
      let m;
      if (chessLevel() === 'easy') {
        const all = cg.allLegal('b');
        m = all[Math.floor(Math.random() * all.length)];
      } else {
        const res = aiMove(cg, { side: 'b', depth: chessLevel() === 'hard' ? 4 : 3 });
        m = res && res.move;
      }
      if (m) {
        const legal = cg.legal(m[0], m[1], 'b');
        const mv = legal.find(x => x[2] === m[2] && x[3] === m[3]);
        if (mv) cg.apply(mv);
        else { const all = cg.allLegal('b'); if (all.length) cg.apply(all[Math.floor(Math.random() * all.length)]); }
      } else {
        const all = cg.allLegal('b');
        if (all.length) cg.apply(all[Math.floor(Math.random() * all.length)]);
      }
      if (checkEnd()) { render_chess(); return; }
      setStatus('chess-st', '轮到你（红方）');
      render_chess();
      if (isUndo) setStatus('chess-st', isUndo);
      swapTimer();   // AI走完切回红
      if (window.autoSnapshot) autoSnapshot();
      if (window.autoCoachIfOn) autoCoachIfOn();
     } catch (e) {
      setStatus('chess-st', 'AI 出错，已交回你走：' + e.message);
     } finally {
      aiBusy = false; aiTimer = null;
      render_chess();
     }
    }, 60);
  } else {
    setStatus('chess-st', '轮到你（红方）');
  }
}
window.chessUndo = function() {
  if (aiBusy) { aiBusy = false; }
  if (!cg || !cg.moves.length) { setStatus('chess-st', '没有可悔的棋'); return; }
  let target = 2;
  if (!cg.redTurn) target = 1;
  for (let i = 0; i < target; i++) { if (cg.moves.length) { cg.moves.pop(); redoFromMoves(); } }
  if (!cg.redTurn) { if (cg.moves.length) { cg.moves.pop(); redoFromMoves(); } }
  aiBusy = false; sel = null;
  render_chess();
  setStatus('chess-st', '已悔棋，轮到你');
};
function redoFromMoves() {
  // 从本局的起始盘面（残局=残局FEN；常规=初始盘）重放，而不是从初始盘重放
  const sf = cg._startFen || null;
  const wasPuzzle = cg._puzzle;
  const base = sf ? new Chess(sf) : new Chess();
  const ms = cg.moves.slice();
  base.moves = [];
  ms.forEach(m => base.apply(m));
  base._startFen = sf;          // 关键：保住残局起始盘面，否则再次悔棋会回到整盘初始局面
  base._puzzle = wasPuzzle;
  cg = base;
}

// —— 存档 / 恢复 ——
window.GAMEHOOKS = window.GAMEHOOKS || {};
GAMEHOOKS.chess = {
  reviewPrompt: function () {
    const res = cg && cg.moves.length
      ? (cg.inCheck ? '' : '') : '';
    let outcome = '本局结束';
    try { if (cg && !cg.allLegal(cg.redTurn ? 'r' : 'b').length) outcome = (cg.redTurn ? '红方' : '黑方') + '无棋可走（被将死/困毙）'; } catch (e) {}
    const last = (cg && cg.moves ? cg.moves.slice(-8) : []).map((m, i) => '第' + (cg.moves.length - Math.min(8, cg.moves.length) + i + 1) + '手：(' + m[0] + ',' + m[1] + ')→(' + m[2] + ',' + m[3] + ')').join('；');
    return '【象棋复盘】结果：' + outcome + '。总手数：' + (cg ? cg.moves.length : 0) + '。\n最后几手：' + (last || '无') + '\n' + (aiBoardDesc ? aiBoardDesc() : '') ;
  },

  started: function () { return !!cg; },
  inProgress: function () { return !!(cg && cg.moves.length > 0 && !cg.over && !window.__gameOver); },
  serialize: function () {
  if (!cg) return null;
  const sel = curGameSelects();
  return {
    game: 'chess', label: '象棋', mode: isTwoP() ? '双人同屏' : '人机',
    diff: chessLevel(), timer: sel.timer,
    fen: cg.toFen(), moves: cg.moves.map(m => [m[0], m[1], m[2], m[3]]), redTurn: !!cg.redTurn,
    startFen: cg._startFen || null, puzzle: !!cg._puzzle,
    steps: cg.moves.length,
    elapsed: Math.max(0, Math.floor((Date.now() - (gameStartTs || Date.now())) / 1000))
  };
},
  restore: function (sv) {
  try {
    if (aiTimer) { clearTimeout(aiTimer); aiTimer = null; }
    aiBusy = false; sel = null;
    cg = (sv.moves && Chess.fromState) ? Chess.fromState(sv.fen, sv.moves, sv.redTurn) : new Chess(sv.fen);
    cg._startFen = sv.startFen || null; cg._puzzle = !!sv.puzzle;
    try { localStorage.setItem('fnos_mode', sv.mode === '双人同屏' ? '2p' : 'ai'); } catch (e) {}
    const d1 = document.getElementById('diff'); if (d1 && sv.diff) d1.value = sv.diff;
    const t1 = document.getElementById('timer');
    if (t1 && sv.timer != null) { t1.value = String(sv.timer); applyTimer(); }
    gameStartTs = Date.now() - (sv.elapsed || 0) * 1000;
    render_chess(); swapTimer();
    setStatus('chess-st', '已恢复存档 · ' + (sv.mode || '') + ' · ' + (cg.redTurn ? '红方行棋' : '黑方行棋'));
    maybeAI();
    return true;
  } catch (e) { alert('恢复失败：' + e.message); return false; }
  } };

window.boot_chess_solo = boot_chess_solo;

window.loadChessPuzzle = function(pz) {
  if (aiTimer) { clearTimeout(aiTimer); aiTimer = null; }
  aiBusy = false;
  try {
    cg = new Chess(pz.fen);
    sel = null; aiBusy = false; gameStartTs = Date.now();
    cg._puzzle = true;
    cg._startFen = pz.fen;
    render_chess();
    setStatus('chess-st', '残局『' + pz.name + '』· ' + pz.tip);
  } catch (e) { setStatus('chess-st', '残局加载失败: ' + e.message); }
};
