// 象棋 AI：α-β 剪枝 + 简单评估（子力+位置）
const VAL = { 车: 900, 马: 350, 相: 120, 士: 120, 将: 100000, 炮: 350, 兵: 80 };
function evalBoard(g, forSide) {
  let sc = 0;
  for (let r = 0; r < 10; r++) for (let c = 0; c < 9; c++) { const p = g.B[r][c]; if (!p) continue;
    let v = VAL[p.t] || (p.t === '兵' ? 80 : 0);
    // 兵过河加成、位置微调
    if (p.t === '兵') { const crossed = p.s === 'r' ? r <= 4 : r >= 5; if (crossed) v += 60; if (c >= 2 && c <= 6) v += 10; }
    if (p.t === '炮' || p.t === '马') { const mid = (r >= 2 && r <= 7); if (mid) v += 15; }
    sc += p.s === forSide ? v : -v;
  }
  return sc;
}
function orderMoves(g, moves) {
  return moves.slice().sort((a, b) => {
    const ca = g.B[a[2]][a[3]] ? (VAL[g.B[a[2]][a[3]].t] || 0) : 0;
    const cb = g.B[b[2]][b[3]] ? (VAL[g.B[b[2]][b[3]].t] || 0) : 0;
    return cb - ca;
  });
}
function search(g, depth, alpha, beta, side) { // side: 'r'/'b' — 返回评分（相对 side）
  const opp = side === 'r' ? 'b' : 'r';
  if (g.findK(side) === null) return -1000000;
  if (g.findK(opp) === null) return 1000000;
  if (depth === 0) {
    const ms = g.allLegal(side);
    if (ms.length === 0) { // 困毙/被将死
      return g.inCheck(side) ? -1000000 : 0; // 简化：困毙判负（兼顾长将规则例外——此处从紧）
    }
    return evalBoard(g, side);
  }
  const moves = g.allLegal(side);
  if (moves.length === 0) return g.inCheck(side) ? -1000000 : 0;
  let best = -Infinity;
  for (const m of orderMoves(g, moves)) {
    const save = g.B[m[2]][m[3]], fp = g.B[m[0]][m[1]];
    g.B[m[2]][m[3]] = fp; g.B[m[0]][m[1]] = null; g.moves.push(m); g.redTurn = !g.redTurn;
    const sc = -search(g, depth - 1, -beta, -alpha, opp);
    g.redTurn = !g.redTurn; g.moves.pop(); g.B[m[0]][m[1]] = fp; g.B[m[2]][m[3]] = save;
    if (sc > best) best = sc;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}
// aiMove(game,{side:'r'|'b',depth}) → {move, score}
function aiMove(g, opt) {
  const side = opt.side || (g.redTurn ? 'r' : 'b');
  const opp = side === 'r' ? 'b' : 'r';
  const depth = opt.depth || 3;
  const moves = g.allLegal(side);
  if (!moves.length) return null;
  let best = null, bestSc = -Infinity;
  if (opt.randomTop) {
    // 轻度随机——EASY 级别
    const scored = moves.map(m => {
      const save = g.B[m[2]][m[3]], fp = g.B[m[0]][m[1]];
      g.B[m[2]][m[3]] = fp; g.B[m[0]][m[1]] = null; g.moves.push(m); g.redTurn = !g.redTurn;
      const sc = evalBoard(g, side) + Math.floor(Math.random() * 120);
      g.redTurn = !g.redTurn; g.moves.pop(); g.B[m[0]][m[1]] = fp; g.B[m[2]][m[3]] = save;
      return { m, sc };
    }).sort((a, b) => b.sc - a.sc);
    return scored[0].m;
  }
  for (const m of orderMoves(g, moves)) {
    const save = g.B[m[2]][m[3]], fp = g.B[m[0]][m[1]];
    g.B[m[2]][m[3]] = fp; g.B[m[0]][m[1]] = null; g.moves.push(m); g.redTurn = !g.redTurn;
    const sc = -search(g, depth - 1, -Infinity, Infinity, opp);
    g.redTurn = !g.redTurn; g.moves.pop(); g.B[m[0]][m[1]] = fp; g.B[m[2]][m[3]] = save;
    if (sc > bestSc) { bestSc = sc; best = m; }
  }
  return { move: best, score: bestSc };
}
if (typeof module !== 'undefined') module.exports = { aiMove, evalBoard };
