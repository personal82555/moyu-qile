
const { Chess } = require('../app/js/chess.js');
const fens = [
  '3k5/9/9/5H3/9/9/5C3/9/9/4K4',
  '3k5/9/9/9/9/9/4C4/9/9/3CK4',
  '3k5/4a4/9/9/9/9/9/4R4/4R4/5K3',
  '3k5/4a4/9/9/9/9/9/9/4C4/4K4',
];
for (const f of fens) {
  try {
    const g = new Chess(f);
    console.log('OK  红方走法数:', g.allLegal('r').length);
  } catch (e) { console.log('FAIL:', f, e.message); }
}
