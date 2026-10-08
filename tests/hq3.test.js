
const { JunqiBoard } = require('../app/js/junqi.js');
const j = new JunqiBoard();
const blocked = ['0,1','0,4','9,1','9,4','2,1','2,4','3,2','3,3','4,1','4,4','7,1','7,4','6,2','6,3','5,1','5,4'];
let bad = 0, total = 0;
for (let r=0;r<10;r++) for (let c=0;c<6;c++) {
  if (j.cells[r][c]) { total++; if (blocked.includes(r+','+c)) bad++; }
}
console.log('总子:', total, '(应44) · 特殊格被占:', bad, '(应0)');
console.log('winner:', j.winner());
