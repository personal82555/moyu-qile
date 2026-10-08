
const { JunqiBoard, CAMP_LIST, HQ_LIST } = require('../app/js/junqi.js');
const j = new JunqiBoard();
let cells=0, camp=0, hq=0;
for (let r=0;r<12;r++) for (let c=0;c<5;c++){ const p=j.cells[r][c]; if(p){cells++; if(j.isCamp(r,c))camp++; if(j.isHQ(r,c))hq++;} }
console.log('棋子总数:', cells, '(期望50) | 行营被占:', camp, '(期望0) | 大本营被占:', hq, '(期望4)');
console.log('行营数:', CAMP_LIST.length, '大本营数:', HQ_LIST.length);
console.log('开局 winner:', j.winner());
console.log('翻手可翻:', j.hasFlip());
// 翻一枚
j.flip(3,3);
console.log('翻后 shown(3,3):', j.shown[3][3], '| turn:', j.turn);
j.undoLast();
console.log('悔棋后 shown(3,3):', j.shown[3][3], '| turn:', j.turn);
