
const { Chess } = require('../app/js/chess.js');
function round(n){
  const a = new Chess();
  for (let i=0;i<n;i++){ const side=a.redTurn?'r':'b'; const ms=a.allLegal(side); if(!ms.length) break; a.apply(ms[Math.floor(Math.random()*ms.length)]); }
  const b = Chess.fromState(a.toFen(), a.moves, a.redTurn);
  let d=0; for(let r=0;r<10;r++)for(let c=0;c<9;c++){const x=a.B[r][c],y=b.B[r][c]; if((x&&!y)||(!x&&y)||(x&&y&&(x.t!==y.t||x.s!==y.s))) d++;}
  return {n, d, m: a.moves.length, m2: b.moves.length, t: a.redTurn===b.redTurn, f: a.toFen()===b.toFen()};
}
let allok = true;
for (const n of [1,2,3,5,8]) { const r = round(n); const ok = r.d===0 && r.m===r.m2 && r.t && r.f; if(!ok) allok=false; console.log(n+'手:', JSON.stringify(r), ok?'pass':'FAIL'); }
// 残局恢复
const pz = new Chess('3将4/9/9/9/9/9/4砲4/9/9/4帥4');
const ms = pz.allLegal('r'); pz.apply(ms[0]);
const rc = Chess.fromState(pz.toFen(), pz.moves, pz.redTurn);
console.log('残局恢复 子数:', (function(){let n=0;for(let r=0;r<10;r++)for(let c=0;c<9;c++) if(rc.B[r][c])n++;return n})(), '| moves:', rc.moves.length);
console.log(allok ? '全部通过' : '有失败');
