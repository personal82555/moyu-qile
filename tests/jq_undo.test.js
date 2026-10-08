
const { JunqiBoard } = require('../app/js/junqi.js');
const j = new JunqiBoard();
j.flip(1,1);
const owner1 = j.turn;
j.flip(8,1);
const owner2 = j.turn;
const ok1 = j.undoLast();
console.log('undo 2nd: ok=', ok1, 'turn回=', JSON.stringify(j.turn), '应=', owner2);
console.log('1,1 shown:', j.shown[1][1], '(需true)');
j.undoLast();
console.log('undo 1st后 shown(1,1):', j.shown[1][1], '(需false) turn:', j.turn);
// move+undo
j.flip(2,2); j.flip(7,2);
const c1 = j.cells[2][2], c2 = j.cells[7][2];
j.movePiece([2,2],[2,3]);  // 直邻不可能? canMove 横向 1格可以 (无铁路限制) — dr=0? (2,2)→(2,3) 是 dc=1 → dx=1 是横向一步 ✓
const moved = j.cells[2][3];
console.log('moved kind:', moved && moved.kind, '原格空?', !j.cells[2][2]);
j.undoLast();
console.log('undo后 (2,2)=', j.cells[2][2] && j.cells[2][2].kind, ' (2,3)=', j.cells[2][3]);
