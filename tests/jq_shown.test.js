
const { JunqiBoard, CAMP_LIST } = require('../app/js/junqi.js');
const j = new JunqiBoard();
for (let r=0;r<12;r++) for (let c=0;c<5;c++){ j.cells[r][c]=null; j.shown[r][c]=false; }
const put=(r,c,k,o)=>{ j.cells[r][c]={kind:k,owner:o,faceDown:false}; j.shown[r][c]=true; };
j.turn = 0;
put(6,0,'s6','r');                       // 红旅长
const into = j.canMove([6,0],[7,1]);      // 斜向入营(7,1)
j.movePiece([6,0],[7,1]);
console.log('入营可行:', into);
console.log('营格 shown（应 true）:', j.shown[7][1], j.shown[7][1] === true ? 'pass' : 'FAIL');
console.log('营格棋子:', j.cells[7][1] && j.cells[7][1].kind);
console.log('源格 shown（应 false）:', j.shown[6][0], j.shown[6][0] === false ? 'pass' : 'FAIL');
j.undoLast();
console.log('悔棋后 营格 shown（应 false）:', j.shown[7][1], j.shown[7][1] === false ? 'pass' : 'FAIL');
console.log('悔棋后 源格棋子:', j.cells[6][0] && j.cells[6][0].kind, '| 营格:', j.cells[7][1]);
// 进大本营同样
put(10,1,'s8','r');
j.movePiece([10,1],[11,1]);
console.log('大本营 shown（应 true）:', j.shown[11][1], j.shown[11][1] === true ? 'pass' : 'FAIL');
// 吃子后目标格 shown
for (let r=0;r<12;r++) for (let c=0;c<5;c++){ j.cells[r][c]=null; j.shown[r][c]=false; }
j.turn = 0;
put(6,1,'s9','r'); put(6,2,'s3','b');
j.movePiece([6,1],[6,2]);
console.log('吃掉后 目标格 shown（应 true）:', j.shown[6][2], j.shown[6][2] === true ? 'pass' : 'FAIL', '| 子:', j.cells[6][2] && j.cells[6][2].kind);
