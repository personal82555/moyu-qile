
const { JunqiBoard } = require('../app/js/junqi.js');
const j = new JunqiBoard();
const CAMP = ['2,1','2,4','3,2','3,3','4,1','4,4','7,1','7,4','6,2','6,3','5,1','5,4'];
const HQ = ['0,1','0,4','9,1','9,4'];
let campOcc = 0, hqOcc = 0, total = 0;
for (let r=0;r<10;r++) for (let c=0;c<6;c++) {
  if (j.cells[r][c]) { total++;
    if (CAMP.includes(r+','+c)) campOcc++;
    if (HQ.includes(r+','+c)) hqOcc++;
  }
}
console.log('总子:', total, '(期望48) · 行营被占:', campOcc, '(期望0) · 大本营被占:', hqOcc, '(允许>0)');
console.log('winner:', j.winner());
