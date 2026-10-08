
const { Chess } = require('../app/js/chess.js');
// 红帥黑将+红炮(4,4)+黑马(4,5)? 用汉字重写:
const fens = [
  // 马后炮: 红帥9,4; 黑将0,3; 红马8,4位置? 简化为炮、马摆好杀
  '3将4/9/9/9/4傌4/9/4砲4/9/9/4帥4 moves:',
  '3将4/9/9/9/9/9/4砲4/9/9/4帥4 moves:',
  '3将4/4士4/9/9/9/9/9/4俥4/4俥4/4帥4 moves:',
  '3将4/4士4/9/9/9/9/9/9/4砲4/4帥4 moves:',
];
for (const f of fens) {
  try {
    const g = new Chess(f);
    console.log('OK 红方走法:', g.allLegal('r').length);
  } catch (e) { console.log('FAIL:', f, e.message); }
}
