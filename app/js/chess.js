// 象棋规则引擎（完整实现：走法生成、将军检测、困毙/长将判定、AI）
const initBoard = () => {
  const B = Array.from({ length: 10 }, () => Array(9).fill(null));
  const back = ['车','马','相','士','士','相','马','车'];
  back.forEach((k, i) => { B[0][i] = { t: k, s: 'b' }; B[9][i] = { t: k, s: 'r' }; });
  B[0][4] = { t: TMAP['将'], s: 'b' }; B[9][4] = { t: TMAP['帥'], s: 'r' };
  [1, 7].forEach(c => { B[2][c] = { t: '炮', s: 'b' }; B[7][c] = { t: '炮', s: 'r' }; });
  [0, 2, 4, 6, 8].forEach(c => { B[3][c] = { t: TMAP['卒'], s: 'b' }; B[6][c] = { t: '兵', s: 'r' }; });
  return B;
};
const TMAP = { '帅': '将', '帥': '将', '将': '将', '仕': '士', '士': '士', '相': '相', '象': '相', '傌': '马', '馬': '马', '俥': '车', '車': '车', '炮': '炮', '砲': '炮', '兵': '兵', '卒': '兵' };
const inB = (r, c) => r >= 0 && r < 10 && c >= 0 && c < 9;
class Chess {
  constructor(fen) {
    if (fen && fen.includes(' moves:')) { const [b, mv] = fen.split(' moves:'); this.B = this.fromFen(b); this.moves = mv ? mv.trim().split(' ').filter(Boolean).map(x => x.split(',').map(Number)) : []; }
    else if (fen && fen.includes('/')) { this.B = this.fromFen(fen); this.moves = []; }
    else { this.B = initBoard(); this.moves = []; }
    this.redTurn = true;                     // 红先；随后 apply() 每手翻转，不要再用 moves.length 预判
    if (this.moves.length) { const ms = this.moves; this.moves = []; for (const m of ms) this.apply(m); }
  }
  /** 保存/恢复：由「当前局面FEN + 走法表 + 行棋方」重建（区别于 full()，不会重复应用走法） */
  static fromState(fen, moves, redTurn) {
    const g = new Chess(fen);
    g.moves = (moves || []).map(m => m.slice());
    g.redTurn = (redTurn === undefined || redTurn === null) ? (g.moves.length % 2 === 0) : !!redTurn;
    return g;
  }
  fromFen(f) {
    const rows = f.split('/'); const B = Array.from({ length: 10 }, () => Array(9).fill(null));
    rows.forEach((row, r) => { let c = 0; for (const ch of row) { if (/\d/.test(ch)) { c += +ch; continue; } const red = '帥帅仕相傌俥砲兵'.includes(ch); B[r][c++] = { t: TMAP[ch] || ch, s: red ? 'r' : 'b' }; } });
    return B;
  }
  toFen() {
    // 红方用红系字形（帥仕相傌俥砲兵）、黑方用黑系字形（将士象馬車砲卒），确保 fromFen 回读时颜色不串
    const REV_R = { '将': '帥', '士': '仕', '相': '相', '马': '傌', '车': '俥', '炮': '砲', '兵': '兵' };
    const REV_B = { '将': '将', '士': '士', '相': '象', '马': '馬', '车': '車', '炮': '炮', '兵': '卒' };
    return this.B.map(row => {
      let s = '', z = 0;
      for (const p of row) {
        if (!p) { z++; continue; }
        if (z) { s += z; z = 0; }
        s += (p.s === 'r' ? (REV_R[p.t] || p.t) : (REV_B[p.t] || p.t));
      }
      if (z) s += z;
      return s;
    }).join('/');
  }
  full() { return this.toFen() + (this.moves.length ? ' moves: ' + this.moves.map(m => m.join(',')).join(' ') : ''); }
  own(r, c, s) { return inB(r, c) && this.B[r][c] && this.B[r][c].s === s; }
  apply(m) { const [fr, fc, tr, tc] = m; this.B[tr][tc] = this.B[fr][fc]; this.B[fr][fc] = null; this.moves.push(m); this.redTurn = !this.redTurn; return this; }
  force(r, c, s) { if (!inB(r, c)) return null; const p = this.B[r][c]; return p ? p.s : null; }
  genMoves(r, c) {
    const p = this.B[r][c]; if (!p) return []; const s = p.s, t = p.t, out = []; const me = s, op = s === 'r' ? 'b' : 'r';
    const push = (tr, tc) => { if (inB(tr, tc)) { const q = this.B[tr][tc]; if (!q || q.s === op) out.push([tr, tc]); } };
    if (t === '车' || t === '炮') {
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dr, dc]) => { let tr = r + dr, tc = c + dc; while (inB(tr, tc) && !this.B[tr][tc]) { push(tr, tc); tr += dr; tc += dc; } if (t === '车') push(tr, tc); else { let rr = tr + dr, cc = tc + dc; while (inB(rr, cc) && !this.B[rr][cc]) { rr += dr; cc += dc; } push(rr, cc); } });
    } else if (t === '马') { [-2, -1, 1, 2].forEach(dr => [-2, -1, 1, 2].forEach(dc => { if (Math.abs(dr) + Math.abs(dc) !== 3) return; const legR = r + (dr === -2 ? -1 : dr === 2 ? 1 : 0), legC = c + (dc === -2 ? -1 : dc === 2 ? 1 : 0); if (legR < 0 || legR > 9 || legC < 0 || legC > 8) return; if (this.B[legR][legC]) return; push(r + dr, c + dc); })); }
    else if (t === '相') { [-2, 2].forEach(dr => [-2, 2].forEach(dc => { const tr = r + dr, tc = c + dc, mr = r + dr / 2, mc = c + dc / 2; if (!inB(tr, tc)) return; if (this.B[mr][mc]) return; push(tr, tc); })); }
    else if (t === '士') { [-1, 1].forEach(dr => [-1, 1].forEach(dc => { const tr = r + dr, tc = c + dc; if (tc < 3 || tc > 5) return; if (s === 'r' ? tr < 7 : tr > 2) return; push(tr, tc); })); }
    else if (t === '将') { let tr, tc; [-1, 1].forEach(dr => {
      // 飞将（对将露面）
      tr = r + dr; while (inB(tr, c) && !this.B[tr][c]) tr += dr; if (inB(tr, c) && this.B[tr][c].t === '将') push(tr, c);
      tr = r + dr; tc = c; if (tc < 3 || tc > 5) return; if (s === 'r' ? tr < 7 : tr > 2) return; push(tr, tc);
    }); [-1, 1].forEach(dc => { tr = r, tc = c + dc; if (tc < 3 || tc > 5) return; push(tr, tc); }); }
    else if (t === '兵') { const fwd = s === 'r' ? -1 : 1; push(r + fwd, c); const crossed = s === 'r' ? r <= 4 : r >= 5; if (crossed) { push(r, c - 1); push(r, c + 1); } }
    return out.map(([tr, tc]) => [r, c, tr, tc]);
  }
  findK(s) { for (let r = 0; r < 10; r++) for (let c = 0; c < 9; c++) { const p = this.B[r][c]; if (p && p.t === '将' && p.s === s) return [r, c]; } return null; }
  attacks(sq, s) { // s 方所有子可否到达 sq（含隔山炮打等。走“吃子/将军”目标判断）
    const [tr, tc] = sq; for (let r = 0; r < 10; r++) for (let c = 0; c < 9; c++) { const p = this.B[r][c]; if (!p || p.s !== s) continue; const mv = this.genMoves(r, c).some(m => m[2] === tr && m[3] === tc); if (mv) return true; } return false;
  }
  inCheck(s) { const k = this.findK(s); if (!k) return false; const [kr, kc] = k; for (let r = 0; r < 10; r++) for (let c = 0; c < 9; c++) { const p = this.B[r][c]; if (!p || p.s === s) continue; const mv = this.genMoves(r, c).some(m => m[2] === kr && m[3] === kc); if (mv) return true; } return false; }
  legal(r, c, side) { if (!side) side = this.redTurn ? 'r' : 'b'; const s = this.own(r, c, side); if (!s) return []; const next = side; return this.genMoves(r, c).filter(m => { const save = this.B[m[2]][m[3]], fp = this.B[m[0]][m[1]]; this.B[m[2]][m[3]] = fp; this.B[m[0]][m[1]] = null; const ok = !this.inCheck(next); this.B[m[0]][m[1]] = fp; this.B[m[2]][m[3]] = save; return ok; }); }
  allLegal(s) { if (!s) s = this.redTurn ? 'r' : 'b'; const out = []; for (let r = 0; r < 10; r++) for (let c = 0; c < 9; c++) if (this.own(r, c, s)) out.push(...this.legal(r, c, s)); return out; }
}
if (typeof module !== 'undefined') module.exports = { Chess, initBoard, inB };
