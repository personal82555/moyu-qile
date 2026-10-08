// 军棋（陆战棋）· 翻棋玩法引擎 — 标准棋盘 12行 × 5列（每方 6行 × 5列 = 30 位）
// 位类型：兵站(23/方) 行营(圆, 5/方, 不可被攻击) 大本营(2/方, 进入后不可移动)
// 铁路：横向 r∈{2,5,6,9} 贯通；纵向 c∈{0,4} 贯通；山界仅在 c∈{0,2,4} 三处连通
// 棋子等级：司令9 军长8 师长7 旅长6 团长5 营长4 连长3 排长2 工兵1（地雷不可动，炸弹同归于尽，军旗被扛即负）
const KINDS = ['s9','s8','s7','s6','s5','s4','s3','s2','s1','lei','zha','jq'];
const KIND_LBL = { s9:'司令', s8:'军长', s7:'师长', s6:'旅长', s5:'团长', s4:'营长', s3:'连长', s2:'排长', s1:'工兵', lei:'地雷', zha:'炸弹', jq:'军旗' };
const KIND_RANK = { s9:9, s8:8, s7:7, s6:6, s5:5, s4:4, s3:3, s2:2, s1:1, lei:0, zha:0, jq:0 };
// 行营与大棚营坐标（0-indexed: 蓝方 0-5 行在上, 红方 6-11 行在下）
const CAMP_LIST = [[2,1],[2,3],[3,2],[4,1],[4,3],[7,1],[7,3],[8,2],[9,1],[9,3]];
const HQ_LIST = [[0,1],[0,3],[11,1],[11,3]];
const RAIL_ROWS = [2,5,6,9];
const RAIL_COLS = [0,4];
const FRONT_COLS = [0,2,4];          // 山界三处通口
class JunqiBoard {
  constructor(mode) {
    this.R = 12; this.C = 5;
    this.cells = [];   // {kind, owner, faceDown} | null
    this.shown = [];   // 是否已翻开
    this.turn = 0;     // 0=红(先) 1=蓝
    this.mode = mode || 'flip';
    this.flagTaken = null;
    this._hist = [];
    this.init();
  }
  isCamp(r, c) { return CAMP_LIST.some(([a, b]) => a === r && b === c); }
  isHQ(r, c) { return HQ_LIST.some(([a, b]) => a === r && b === c); }
  inB(r, c) { return r >= 0 && r < this.R && c >= 0 && c < this.C; }
  static perSide() {
    // 每方 25 枚
    const list = [];
    const add = (k, n) => { for (let i = 0; i < n; i++) list.push(k); };
    add('s9',1); add('s8',1); add('s7',2); add('s6',2); add('s5',2); add('s4',2);
    add('s3',3); add('s2',3); add('s1',3); add('lei',3); add('zha',2); add('jq',1);
    return list;
  }
  init() {
    const all = JunqiBoard.perSide().concat(JunqiBoard.perSide());   // 50 枚 = 50 个非行营位
    for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = all[i]; all[i] = all[j]; all[j] = t; }
    this.cells = []; this.shown = []; this.turn = 0; this.flagTaken = null; this._hist = [];
    let k = 0;
    for (let r = 0; r < this.R; r++) {
      this.cells[r] = []; this.shown[r] = [];
      for (let c = 0; c < this.C; c++) {
        if (this.isCamp(r, c)) { this.cells[r][c] = null; this.shown[r][c] = false; }
        else { this.cells[r][c] = { kind: all[k++], owner: null, faceDown: true }; this.shown[r][c] = false; }
      }
    }
  }
  turnOwner() { return this.turn === 0 ? 'r' : 'b'; }
  canMove(from, to) {
    const [fr, fc] = from, [tr, tc] = to;
    if (!this.inB(tr, tc) || !this.inB(fr, fc)) return false;
    const fp = this.cells[fr][fc], tp = this.cells[tr][tc];
    if (!fp) return false;
    if (fp.owner !== this.turnOwner()) return false;
    if (fp.kind === 'lei' || fp.kind === 'jq') return false;      // 地雷/军旗 不可移动
    if (this.isHQ(fr, fc)) return false;                          // 大本营内棋子不可移动
    if (tr === fr && tc === fc) return false;
    if (tp && !this.shown[tr][tc]) return false;                  // 不可吃暗棋（先翻）
    if (tp && tp.owner === this.turnOwner()) return false;        // 不可吃己方
    if (this.isCamp(tr, tc) && tp) return false;                  // 行营内的棋子不可被攻击（空行营可以进入并能走出来）
    const dr = tr - fr, dc = tc - fc;
    const straight = (dr === 0 || dc === 0);
    // 山界：跨前线（r5↔r6）只在 c∈{0,2,4} 通
    if (Math.abs(dr) === 1 && fc === tc && ((fr === 5 && tr === 6) || (fr === 6 && tr === 5)) && FRONT_COLS.indexOf(fc) < 0) return false;
    // 步长判定：工兵沿铁路可直行任意格（路径无阻）；其余 1 步
    if (straight) {
      const dist = Math.abs(dr) + Math.abs(dc);
      const onRail = (fr === tr && RAIL_ROWS.indexOf(fr) >= 0) || (fc === tc && RAIL_COLS.indexOf(fc) >= 0);
      const maxStep = (fp.kind === 's1' && onRail) ? 99 : 1;
      if (dist > maxStep) return false;
      if (dist > 1) {   // 路径检查（工兵铁路直行）
        if (dr === 0) { for (let c2 = Math.min(fc, tc) + 1; c2 < Math.max(fc, tc); c2++) if (this.cells[fr][c2]) return false; }
        else { for (let r2 = Math.min(fr, tr) + 1; r2 < Math.max(fr, tr); r2++) if (this.cells[r2][fc]) return false; }
      }
      return true;
    }
    // 斜行：仅限行营的斜向相邻（行营与四角兵站相连）
    if (Math.abs(dr) === 1 && Math.abs(dc) === 1) {
      const c1 = this.isCamp(fr, fc), c2 = this.isCamp(tr, tc);
      if (!c1 && !c2) return false;
      const dist = 1;   // 单步斜行
      return dist === 1;
    }
    return false;
  }
  flip(r, c) {
    if (!this.inB(r, c) || !this.cells[r][c] || this.shown[r][c]) return null;
    this.shown[r][c] = true; this.cells[r][c].owner = this.turnOwner();
    this._hist.push({ type: 'flip', r, c, prevTurn: this.turn });
    this.turn = 1 - this.turn;
    return this.cells[r][c];
  }
  undoLast() {
    const last = this._hist.pop();
    if (!last) return false;
    if (last.type === 'flip') {
      this.shown[last.r][last.c] = false;
      if (this.cells[last.r][last.c]) this.cells[last.r][last.c].owner = null;
    } else {
      this.cells[last.fr][last.fc] = last.fp;
      this.cells[last.tr][last.tc] = last.tp;
      this.flagTaken = last.flagBefore;
      if (last.shownFrom !== undefined) this.shown[last.fr][last.fc] = last.shownFrom;
      if (last.shownTo !== undefined) this.shown[last.tr][last.tc] = last.shownTo;
    }
    this.turn = last.prevTurn;
    return true;
  }
  battle(a, d) {           // a=攻方 kind, d=守方 kind → 'win'|'lose'|'both'
    if (a === 'zha' || d === 'zha') return 'both';
    if (d === 'lei') return a === 's1' ? 'win' : 'both';
    if (d === 'jq') return 'win';
    const ra = KIND_RANK[a], rd = KIND_RANK[d];
    return ra > rd ? 'win' : (ra < rd ? 'lose' : 'both');
  }
  movePiece(from, to) {
    if (!this.canMove(from, to)) return { ok: false };
    const [fr, fc] = from, [tr, tc] = to;
    const fp = this.cells[fr][fc], tp = this.cells[tr][tc];
    const prevFlag = this.flagTaken;
    // 记录目标格/源格的"已翻开"状态，供悔棋精确还原
    const shownFrom = this.shown[fr][fc], shownTo = this.shown[tr][tc];
    let rec;
    if (!tp) { this.cells[tr][tc] = fp; this.cells[fr][fc] = null; rec = { type:'move', fp, tp:null, fr, fc, tr, tc, prevTurn:this.turn, flagBefore:prevFlag, shownFrom, shownTo }; }
    else {
      const res = this.battle(fp.kind, tp.kind);
      if (res === 'win') { if (tp.kind === 'jq') this.flagTaken = tp.owner; this.cells[tr][tc] = fp; this.cells[fr][fc] = null; }
      else if (res === 'lose') { if (fp.kind === 'jq') this.flagTaken = fp.owner; this.cells[fr][fc] = null; }
      else { this.cells[tr][tc] = null; this.cells[fr][fc] = null; }
      rec = { type:'move', fp, tp, fr, fc, tr, tc, prevTurn:this.turn, flagBefore:prevFlag, shownFrom, shownTo };
    }
    // 走进去的棋子必然是已翻开的 → 目标格标记为已翻开（否则行营/大本营里的棋子会被画成暗牌）
    if (this.cells[tr][tc]) this.shown[tr][tc] = true;
    this.shown[fr][fc] = false;
    this._hist.push(rec);
    this.turn = 1 - this.turn;
    return { ok: true };
  }
  alive(side) {
    for (let r = 0; r < this.R; r++) for (let c = 0; c < this.C; c++) {
      const p = this.cells[r][c];
      if (p && p.owner === side && p.kind !== 'lei' && p.kind !== 'jq') return true;
    }
    return false;
  }
  hasFlip() {
    for (let r = 0; r < this.R; r++) for (let c = 0; c < this.C; c++) if (this.cells[r][c] && !this.shown[r][c]) return true;
    return false;
  }
  winner() {
    if (this.flagTaken) return this.flagTaken === 'r' ? 'b' : 'r';
    // 无暗棋可翻 且 无子可走 → 判负
    if (this.hasFlip()) return null;
    let canAct = false;
    for (let r = 0; r < this.R && !canAct; r++) for (let c = 0; c < this.C && !canAct; c++) {
      const p = this.cells[r][c];
      if (p && p.owner === this.turnOwner() && p.kind !== 'lei' && p.kind !== 'jq') {
        for (const [dr, dc] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]) {
          if (this.canMove([r, c], [r + dr, c + dc])) { canAct = true; break; }
        }
      }
    }
    if (canAct) return null;
    return !this.alive('r') ? 'b' : (!this.alive('b') ? 'r' : (this.turnOwner() === 'r' ? 'b' : 'r'));
  }
  serialize() { return { R: this.R, C: this.C, cells: this.cells, shown: this.shown, turn: this.turn, mode: this.mode }; }
  static restore(o) { const j = new JunqiBoard(o.mode); j.R = o.R; j.C = o.C; j.cells = o.cells; j.shown = o.shown; j.turn = o.turn; return j; }
}
if (typeof module !== 'undefined') module.exports = { JunqiBoard, KINDS, KIND_LBL, KIND_RANK, CAMP_LIST, HQ_LIST, RAIL_ROWS, RAIL_COLS };
