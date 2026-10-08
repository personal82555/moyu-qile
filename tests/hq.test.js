
const { JunqiBoard } = require('../app/js/junqi.js');
const j = new JunqiBoard();
let hq = 0, cnt = 0;
const HQ = [[0,1],[0,4],[9,1],[9,4]];
for (let r=0;r<10;r++) for (let c=0;c<6;c++) {
  if (j.cells[r][c]) cnt++;
  if (HQ.some(([rr,cc])=>rr===r&&cc===c) && j.cells[r][c]) hq++;
}
console.log('总子:', cnt, '(应50) · HQ 被占:', hq, '(应0)');
// 军旗不在 HQ 也没关系 (翻棋随机)。开 winner 察
console.log('开局 winner:', j.winner());
