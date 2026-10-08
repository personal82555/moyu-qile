// 五子棋：核心引擎 + AI 评分
const N = 15;
const EMPTY = 0;
class Gomoku {
  constructor() { this.N = N; this.B = Array.from({ length: N }, () => Array(N).fill(0)); this.seq = []; this.player = 1; this.over = false; this.win5 = null; }
  inB(r, c) { return r >= 0 && r < N && c >= 0 && c < N; }
  place(r, c) {
    if (this.over || !this.inB(r, c) || this.B[r][c] !== 0) return false;
    this.B[r][c] = this.player; this.seq.push([r, c]);
    const win = this.checkWin(r, c, this.player);
    if (win) { this.over = true; this.win5 = win; }
    else if (this.seq.length === N * N) this.over = true;
    else this.player = this.player === 1 ? 2 : 1;
    return true;
  }
  /** 返回连五的位置数组 [[r,c]x5]。若刚好形成五连，返回这些点，否则 null */
  checkWin(r, c, p) {
    const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
    for (const [dr, dc] of dirs) {
      const cells = [[r, c]];
      for (const sgn of [1, -1]) {
        let rr = r + sgn * dr, cc = c + sgn * dc;
        while (this.inB(rr, cc) && this.B[rr][cc] === p) { cells.push([rr, cc]); rr += sgn * dr; cc += sgn * dc; }
      }
      if (cells.length >= 5) return cells.slice(0, 5);
    }
    return null;
  }
  undo() { if (!this.seq.length || this.over) return false; const [r, c] = this.seq.pop(); this.B[r][c] = 0; this.player = this.player === 1 ? 2 : 1; return true; }
  full() { return { n: this.N, b: this.B, seq: this.seq, player: this.player, over: this.over, win5: this.win5 }; }
  static restore(o) { const g = new Gomoku(); g.B = o.b; g.seq = o.seq || []; g.player = o.player || 1; g.over = !!o.over; g.win5 = o.win5 || null; return g; }
}
// —— AI ——
// 简洁评分：对每个空点，计算对黑白任一方落子后形成的 "连子形状" 分值
const SHAPES = { 1: 10, 2: 100, 3: 1200, 4: 15000, 5: 1000000 };
function lineScore(cnt, open) { // cnt: 连子数, open: 端点空位 0/1/2
  if (cnt >= 5) return SHAPES[5];
  let s = SHAPES[cnt] || 0;
  if (open === 2) s *= 1.8; else if (open === 1) s *= 1; else s *= 0.25;
  return s;
}
function scorePoint(g, r, c, p) {
  if (!g.inB(r, c) || g.B[r][c] !== 0) return 0;
  let total = 0;
  for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
    let cnt = 1, open = 0;
    // 朝两个方向延伸，统计连续同色 + 端点（考虑一个空档的跳连简化为不处理）
    for (const sgn of [1, -1]) {
      let rr = r + sgn * dr, cc = c + sgn * dc;
      while (g.inB(rr, cc) && g.B[rr][cc] === p) { cnt++; rr += sgn * dr; cc += sgn * dc; }
      if (g.inB(rr, cc) && g.B[rr][cc] === 0) open++;
    }
    total += lineScore(cnt, open);
  }
  return total;
}
function aiPick(g, me) {
  const opp = me === 1 ? 2 : 1;
  const cands = [];
  for (let r = 0; r < g.N; r++) for (let c = 0; c < g.N; c++) {
    if (g.B[r][c] !== 0) continue;
    // 只考虑已有邻居的点
    let nearEmpty = true;
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) { const rr = r + dr, cc = c + dc; if (g.inB(rr, cc) && g.B[rr][cc] !== 0) nearEmpty = false; }
    if (nearEmpty && g.seq.length > 0) continue;
    const aa = scorePoint(g, r, c, me); // 进攻
    const dd = scorePoint(g, r, c, opp); // 防守
    cands.push({ r, c, sc: aa * 1.1 + dd });
  }
  if (!cands.length) return { r: 7, c: 7 };
  cands.sort((a, b) => b.sc - a.sc);
  const easy = Math.random() < 0.15;
  const pick = easy ? cands[Math.min(cands.length - 1, Math.floor(Math.random() * 5))] : cands[0];
  return { r: pick.r, c: pick.c };
}
if (typeof module !== 'undefined') module.exports = { Gomoku, aiPick, scorePoint, N };
