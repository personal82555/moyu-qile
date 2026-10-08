
const { Chess } = require('../app/js/chess.js');
const c2 = new Chess();
const mv = c2.allLegal('r')[0]; c2.apply(mv);
const f2 = c2.full();
const c3 = new Chess(f2);
console.log('move:', JSON.stringify(mv));
console.log('原 FEN :', c2.toFen());
console.log('恢复FEN:', c3.toFen());
console.log('full   :', f2);
console.log('恢复 full:', c3.full());
let d=0; for(let r=0;r<10;r++)for(let c=0;c<9;c++){const x=c2.B[r][c],y=c3.B[r][c]; if((x&&!y)||(!x&&y)||(x&&y&&(x.t!==y.t||x.s!==y.s))){d++; if(d<5)console.log('  差异',r,c,JSON.stringify(x),JSON.stringify(y));}}
console.log('差异数:', d);
