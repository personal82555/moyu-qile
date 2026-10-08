
const { JunqiBoard } = require('../app/js/junqi.js');
const j = new JunqiBoard('flip');
// 手工摆明棋：红 s9 在 (9,0), 蓝 jq 在 (0,0)
for (let r=0;r<10;r++) for (let c=0;c<6;c++){ j.cells[r][c]=null; j.shown[r][c]=false; }
j.cells[9][0] = { kind:'s9', owner:'r' }; j.shown[9][0]=true;
j.cells[0][0] = { kind:'jq', owner:'b' }; j.shown[0][0]=true;
j.turn = 0;
console.log('canMove 红9,0→8,0:', j.canMove([9,0],[8,0]));
let steps = 0, pos = 9;
while (pos > 0) { j.movePiece([pos,0],[pos-1,0]); pos--; steps++; }
console.log('走子步数:', steps, '| winner:', j.winner(), '(期望 r)');
