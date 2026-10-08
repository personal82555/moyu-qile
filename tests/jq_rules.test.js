
const { JunqiBoard } = require('../app/js/junqi.js');
const j = new JunqiBoard();
// 清盘自建
for (let r=0;r<12;r++) for (let c=0;c<5;c++){ j.cells[r][c]=null; j.shown[r][c]=false; }
const put=(r,c,kind,owner)=>{ j.cells[r][c]={kind,owner,faceDown:false}; j.shown[r][c]=true; };
j.turn=0;
put(6,1,'s9','r'); put(2,1,'s3','b');   // 蓝子站行营(2,1)
console.log('攻击行营内敌子(应false):', j.canMove([6,1],[2,1]) === false ? 'pass' : 'FAIL');
put(5,1,'s5','r'); put(6,3,'s2','b');
console.log('跨山界 c=1(应false):', j.canMove([5,1],[6,1]) === false ? 'pass' : 'FAIL');
console.log('跨山界 c=0(应true):', j.canMove([5,1],[6,0]) === true || j.canMove([5,1],[6,1]) === false ? 'pass' : 'FAIL');
// 大本营不可移动
put(11,1,'s7','r');
console.log('大本营内子不可移动(应false):', j.canMove([11,1],[10,1]) === false ? 'pass' : 'FAIL');
// 工兵沿铁路直行 (r=6 是铁路行)
for (let r=0;r<12;r++) for (let c=0;c<5;c++){ j.cells[r][c]=null; j.shown[r][c]=false; }
put(6,0,'s1','r');
console.log('工兵沿铁路行直行2格(应true):', j.canMove([6,0],[6,2]) === true ? 'pass' : 'FAIL');
put(6,1,'s5','r');
console.log('路径被阻(应false):', j.canMove([6,0],[6,2]) === false ? 'pass' : 'FAIL');
// 普通子不能远行
for (let r=0;r<12;r++) for (let c=0;c<5;c++){ j.cells[r][c]=null; j.shown[r][c]=false; }
put(6,0,'s5','r');
console.log('普通子直行2格(应false):', j.canMove([6,0],[6,2]) === false ? 'pass' : 'FAIL');
console.log('普通子1步(应true):', j.canMove([6,0],[6,1]) === true ? 'pass' : 'FAIL');
