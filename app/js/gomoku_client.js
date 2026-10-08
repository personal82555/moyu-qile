// 五子棋前端（人机，SVG 画线棋盘）
var gk = null, aiBusy = false, aiTimer = null;
function gokLevel() { const el = document.getElementById('diff'); return el ? el.value : 'normal'; }
function gok2P() { try { return localStorage.getItem('fnos_mode') === '2p'; } catch (e) { return false; } }
function boot_gomoku_solo() {
  gk = new Gomoku();
  aiBusy = false; gameStartTs = Date.now();
  if (window.applyTimer) { applyTimer(); resetTimer('r'); }
  render_gomoku();
  const lbl = { easy: '简单', normal: '普通', hard: '困难' }[gokLevel()];
  if (gok2P()) setStatus('gok-st', '双人同屏 · 黑棋先行 · 轮流落子');
  else setStatus('gok-st', '难度：' + lbl + ' · 黑棋（你）先行 · 点交叉点落子');
}
function render_gomoku() {
  const el = document.getElementById('game-canvas');
  if (!el) return;
  const N = gk.N, S = 36;                    // 格大小
  const PAD = 20, SIZE = PAD * 2 + S * (N - 1);
  let html = `<svg id="gok-board" viewBox="0 0 ${SIZE} ${SIZE}" style="touch-action:manipulation;width:100%;max-width:520px;display:block;margin:auto">`;
  html += `<rect x="0" y="0" width="${SIZE}" height="${SIZE}" fill="#e8c187" rx="6"/>`;
  for (let i = 0; i < N; i++) {
    const p = PAD + i * S;
    html += `<line x1="${PAD}" y1="${p}" x2="${SIZE - PAD}" y2="${p}" stroke="#7a5230" stroke-width="1"/>`;
    html += `<line x1="${p}" y1="${PAD}" x2="${p}" y2="${SIZE - PAD}" stroke="#7a5230" stroke-width="1"/>`;
  }
  const stars = [3, 7, 11];
  stars.forEach(sr => stars.forEach(sc => { html += `<circle cx="${PAD + sc * S}" cy="${PAD + sr * S}" r="3" fill="#7a5230"/>`; }));
  gk.seq.forEach(([r, c]) => {
    const cx = PAD + c * S, cy = PAD + r * S;
    const isB = gk.B[r][c] === 1;
    const stroke = isB ? 'none' : '#999';
    const fill = isB ? '#111' : '#fff';
    let ring = '';
    if (gk.win5 && gk.win5.some(w => w[0] === r && w[1] === c)) ring = `<circle cx="${cx}" cy="${cy}" r="12" fill="none" stroke="#e03535" stroke-width="2"/>`;
    html += `<circle cx="${cx}" cy="${cy}" r="13" fill="${fill}" stroke="${stroke}" stroke-width="1"/>${ring}`;
  });
  const last = gk.seq.length ? gk.seq[gk.seq.length - 1] : null;
  if (last && !gk.over) {
    const cx = PAD + last[1] * S, cy = PAD + last[0] * S;
    html += `<circle cx="${cx}" cy="${cy}" r="4" fill="${gk.B[last[0]][last[1]] === 1 ? '#fff' : '#e03535'}"/>`;
  }
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    const cx = PAD + c * S, cy = PAD + r * S;
    html += `<rect x="${cx - S/2}" y="${cy - S/2}" width="${S}" height="${S}" fill="transparent" onclick="gokClick(${r},${c})" style="cursor:pointer"/>`;
  }
  html += '</svg>';
  el.innerHTML = html;
}
function gokClick(r, c) {
  if (!gk || gk.over || aiBusy) { if (aiBusy) setStatus('gok-st', '白方 AI 思考中…'); return; }
  if (window.EXTRAS) EXTRAS.markPre('gomoku');
  if (!gk.place(r, c)) return;
  render_gomoku();
  if (gokEnd()) return;
  if (window.EXTRAS) setTimeout(() => EXTRAS.stepReview('gomoku'), 0);
  swapTimer();
  if (gok2P()) { setStatus('gok-st', '轮到 ' + (gk.player === 1 ? '黑棋' : '白棋')); if (window.autoSnapshot) autoSnapshot(); if (window.autoCoachIfOn) autoCoachIfOn(); return; }
  aiBusy = true;
  setStatus('gok-st', '白方 AI 思考中…');
  aiTimer = setTimeout(() => {
   try {
    let p;
    if (gokLevel() === 'easy') {
      // 简单：随机落子（避开角落以及远离已有棋子的位置）
      const cs = [];
      for (let rr = 0; rr < gk.N; rr++) for (let cc = 0; cc < gk.N; cc++) if (gk.B[rr][cc] === 0) cs.push([rr, cc]);
      p = cs[Math.floor(Math.random() * cs.length)];
    } else {
      p = aiPick(gk, 2);
      if (gokLevel() === 'hard') {
        // 困难：两步前瞻——若对手下一手可在某点成五连/活四，必堵
        const opp = 1;
        let best = null, bestSc = -1;
        const cands = [];
        for (let rr = 0; rr < gk.N; rr++) for (let cc = 0; cc < gk.N; cc++) {
          if (gk.B[rr][cc] !== 0) continue;
          let near = false;
          for (let dr = -2; dr <= 2 && !near; dr++) for (let dc = -2; dc <= 2; dc++) { const r2 = rr+dr, c2 = cc+dc; if (r2>=0 && r2<gk.N && c2>=0 && c2<gk.N && gk.B[r2][c2] !== 0) { near = true; break; } }
          if (!near) continue;
          const atk = scorePoint(gk, rr, cc, 2);
          const def = scorePoint(gk, rr, cc, 1);
          cands.push({ rr, cc, sc: atk * 1.15 + def });
        }
        cands.sort((a, b) => b.sc - a.sc);
        // 前两候选取分最高者，且更重防守（困难较普通+防守权重）
        if (cands.length) p = { r: cands[0].rr, c: cands[0].cc };
      }
    }
    const placed = gk.place(p.r, p.c);
    if (!placed) {                       // AI 落子失败（点被占/盘满）→ 兜底再试一处
      let done = false;
      for (let r = 0; r < gk.N && !done; r++) for (let c = 0; c < gk.N && !done; c++) if (gk.B[r][c] === 0) { gk.place(r, c); done = true; }
    }
    if (gokEnd()) return;
    if (window.EXTRAS) EXTRAS.taunt('aiMove');
    setStatus('gok-st', '轮到你（黑棋）');
    render_gomoku();
    swapTimer();
    if (window.autoSnapshot) autoSnapshot();
    if (window.autoCoachIfOn) autoCoachIfOn();
   } catch (e) {
    setStatus('gok-st', 'AI 出错，已交回你走：' + e.message);
   } finally {
    aiBusy = false; aiTimer = null;
    render_gomoku();
   }
  }, 60);
}
function gokEnd() {
  if (!gk.over) return false;
  if (gk.win5) {
    const durTxt = fmtDur(gameDurationSec());
    const r = gk.win5[0][0], c = gk.win5[0][1];
    const blackWin = gk.B[r][c] === 1;
    setStatus('gok-st', '🎉 ' + (blackWin ? '黑方胜！' : '白方胜！'));
    if (blackWin) { recordGame({ game: 'gomoku', result: 'win', dur: durTxt, steps: gk.seq.length }); window.__lastResult = 'win';
  gameResultPopup(true, '🏆 黑方胜！', '五连达成 · 用时 ' + durTxt + ' · 共 ' + gk.seq.length + ' 手'); }
    else { recordGame({ game: 'gomoku', result: 'lose', dur: durTxt, steps: gk.seq.length }); window.__lastResult = 'lose';
  gameResultPopup(false, '💔 白方胜', 'AI 先连成五子 · 用时 ' + durTxt); }
  } else { setStatus('gok-st', '平局'); recordGame({ game: 'gomoku', result: 'draw', dur: fmtDur(gameDurationSec()), steps: gk.seq.length }); window.__lastResult = 'draw';
  gameResultPopup(null, '🤝 平局', ''); }
  return true;
}
window.gomokuUndo = function() {
  if (aiBusy) aiBusy = false;
  const base = gk._baseline || 0;
  if (gk.seq.length <= base) { setStatus('gok-st', '残局原局面，没有可悔的棋'); return; }
  const n = gk.player === 1 ? 2 : 1;
  let undone = 0;
  for (let i = 0; i < n; i++) {
    if (gk.seq.length <= base) break;   // 不拆残局摆位
    if (gk.undo()) undone++;
  }
  while (gk.seq.length > base && gk.player !== 1) { if (!gk.undo()) break; }
  render_gomoku();
  setStatus('gok-st', undone ? '已悔棋，轮到你（黑棋）' : '残局原局面，没有可悔的棋');
};

// —— 存档 / 恢复 ——
window.GAMEHOOKS = window.GAMEHOOKS || {};
GAMEHOOKS.gomoku = {
  reviewPrompt: function () {
    const seq = (gk && gk.seq) ? gk.seq : [];
    const last = seq.slice(-10).map((p, i) => '第' + (seq.length - Math.min(10, seq.length) + i + 1) + '子：(' + p[0] + ',' + p[1] + ')').join('；');
    const res = (window.__lastResult === 'win') ? '黑方（玩家）胜' : (window.__lastResult === 'lose' ? '白方（AI）胜' : '结束/平局');
    return '【五子棋复盘】结果：' + res + '。总落子：' + seq.length + ' 子（黑先）。\n最后几手：' + (last || '无') + '\n请点评关键失误与改进方向。';
  },

  started: function () { return !!gk; },
  inProgress: function () { return !!(gk && gk.seq.length > 0 && !gk.over && !window.__gameOver); },
  serialize: function () {
  if (!gk) return null;
  const sel = curGameSelects();
  return {
    game: 'gomoku', label: '五子棋', mode: gok2P() ? '双人同屏' : '人机',
    diff: gokLevel(), timer: sel.timer,
    seq: gk.seq.map(x => [x[0], x[1]]), baseline: gk._baseline || 0, over: !!gk.over,
    steps: gk.seq.length,
    elapsed: Math.max(0, Math.floor((Date.now() - (gameStartTs || Date.now())) / 1000))
  };
},
  restore: function (sv) {
  try {
    if (aiTimer) { clearTimeout(aiTimer); aiTimer = null; }
    aiBusy = false;
    gk = new Gomoku();
    (sv.seq || []).forEach(pp => gk.place(pp[0], pp[1]));
    gk._baseline = sv.baseline || 0;
    try { localStorage.setItem('fnos_mode', sv.mode === '双人同屏' ? '2p' : 'ai'); } catch (e) {}
    const d1 = document.getElementById('diff'); if (d1 && sv.diff) d1.value = sv.diff;
    const t1 = document.getElementById('timer');
    if (t1 && sv.timer != null) { t1.value = String(sv.timer); applyTimer(); }
    gameStartTs = Date.now() - (sv.elapsed || 0) * 1000;
    render_gomoku();
    if (!gk.over && gk.player !== 1 && !gok2P()) {   // 轮到白方（AI）→ 立即补一手
      for (let guard = 0; guard < 3 && gk.player !== 1 && !gk.over; guard++) {
        const pp = aiPick(gk, 2);
        if (!pp || !gk.place(pp.r, pp.c)) break;
      }
      render_gomoku();
    }
    swapTimer();
    if (gk.over) setStatus('gok-st', '已恢复存档 · 该局已结束');
    else setStatus('gok-st', '已恢复存档 · ' + (sv.mode || '') + ' · 轮到你（黑棋）');
    if (gk.over && window.gokEnd) gokEnd();
    return true;
  } catch (e) { alert('恢复失败：' + e.message); return false; }
  } };

window.boot_gomoku_solo = boot_gomoku_solo;

window.loadGomokuPuzzle = function(pz) {
  if (aiTimer) { clearTimeout(aiTimer); aiTimer = null; }
  aiBusy = false;
  gk = new Gomoku();
  gameStartTs = Date.now();
  for (const [r, c] of (pz.seq || [])) gk.place(r, c);
  gk._baseline = gk.seq.length;        // 残局固定摆位手数，不可悔
  // 若残局原本轮白（seq 奇数），先让 AI 走一步补齐轮次，保证 player == 1
  if (gk.player !== 1) {
    const p0 = aiPick(gk, 2);
    gk.place(p0.r, p0.c);
    gk._baseline = gk.seq.length;
  }
  aiBusy = false;
  render_gomoku();
  setStatus('gok-st', '残局『' + pz.name + '』· ' + pz.tip);
};
