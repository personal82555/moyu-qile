
const { JunqiBoard } = require('../app/js/junqi.js');
const j = new JunqiBoard();
console.log('before flip (2,2):', j.cells[2][2]);
j.flip(2,2);
console.log('after flip (2,2):', j.cells[2][2]);
j.flip(7,2);
console.log('after flip(7,2) (2,2)=', j.cells[2][2].kind, j.cells[2][2].owner);
// move
const fp = j.cells[2][2];
const ok = j.movePiece([2,2],[2,3]);
console.log('move ok:', ok.ok, '| (2,2)=', j.cells[2][2], '| (2,3)=', j.cells[2][3]);
j.undoLast();
console.log('undo → (2,2)=', j.cells[2][2], '| (2,3)=', j.cells[2][3]);
