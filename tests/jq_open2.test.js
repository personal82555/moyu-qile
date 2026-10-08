
const { JunqiBoard } = require('../app/js/junqi.js');
const j = new JunqiBoard();
let flips=0; for (let r=0;r<12;r++) for (let c=0;c<5;c++) if (j.cells[r][c] && !j.shown[r][c]) flips++;
console.log('开局可翻:', flips, '(应50)');
console.log('winner:', j.winner(), '(应 null)');
