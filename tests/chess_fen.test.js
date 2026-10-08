
const { Chess } = require('../app/js/chess.js');
const a = new Chess();
const fen1 = a.toFen();
console.log('初始 FEN:', fen1);
console.log('含 undefined:', fen1.includes('undefined') ? 'FAIL' : 'pass');
const b = new Chess(fen1);
let diff = 0;
for (let r=0;r<10;r++) for (let c=0;c<9;c++){
  const x=a.B[r][c], y=b.B[r][c];
  if (!x && !y) continue;
  if (!x || !y || x.t!==y.t || x.s!==y.s) { diff++; if (diff<4) console.log('  差异', r, c, JSON.stringify(x), JSON.stringify(y)); }
}
console.log('往返后棋子差异:', diff, diff===0?'pass':'FAIL');
// 带走法往返（保存/恢复场景）
const c2 = new Chess();
const mv = c2.allLegal('r')[0]; c2.apply(mv);
const f2 = c2.full();
const c3 = new Chess(f2);
console.log('带 moves 往返 手数:', c3.moves.length, '| 局面一致:', c3.toFen() === c2.toFen() ? 'pass' : 'FAIL');
console.log('轮到红方:', c3.redTurn, '(走1手后应 false)', c3.redTurn === false ? 'pass' : 'FAIL');
// 残局 FEN 仍可解析
const pz = new Chess('3将4/9/9/9/9/9/4砲4/9/9/4帥4');
let n=0; for (let r=0;r<10;r++) for (let c=0;c<9;c++) if (pz.B[r][c]) n++;
console.log('残局FEN子数:', n, '(期望3)', n===3?'pass':'FAIL');
