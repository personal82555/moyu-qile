
const { Chess } = require('../app/js/chess.js');
const a = new Chess();
for (let i=0;i<4;i++){ const side = a.redTurn ? 'r' : 'b'; const ms = a.allLegal(side); a.apply(ms[Math.floor(Math.random()*ms.length)]); }
const f = a.full();
const b = new Chess(f);
console.log('4手后 moves:', b.moves.length, '| redTurn:', b.redTurn, '| 原始 redTurn:', a.redTurn, b.redTurn===a.redTurn?'pass':'FAIL');
console.log('局面一致:', b.toFen()===a.toFen() ? 'pass':'FAIL');
// 黑方（AI）走子能力
const ms = b.allLegal('b');
console.log('黑方合法手数:', ms.length, ms.length>0?'pass':'FAIL');
