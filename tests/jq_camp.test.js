
const { JunqiBoard, CAMP_LIST } = require('../app/js/junqi.js');
const j = new JunqiBoard();
for (let r=0;r<12;r++) for (let c=0;c<5;c++){ j.cells[r][c]=null; j.shown[r][c]=false; }
const put=(r,c,kind,owner)=>{ j.cells[r][c]={kind,owner,faceDown:false}; j.shown[r][c]=true; };
j.turn = 0;                                  // 红方行棋
// 行营 (2,1) 为空 → 红子上方的 (3,1)? 用正交/斜向相邻验证
put(1,1,'s5','r');
console.log('进入空行营(2,1) 正交[1,1]→[2,1]:', j.canMove([1,1],[2,1]) ? 'pass' : 'FAIL');
// 从行营走出来
j.cells[2][1] = { kind:'s5', owner:'r', faceDown:false }; j.shown[2][1] = true; j.cells[1][1] = null;
console.log('从行营走出来[2,1]→[3,1]:', j.canMove([2,1],[3,1]) ? 'pass' : 'FAIL');
console.log('从行营斜走出来[2,1]→[3,2]:', j.canMove([2,1],[3,2]) ? 'pass' : 'FAIL');
// 斜向进入行营：(3,2) 是行营（空）→ 从 (2,2) 斜走到 (3,2)
j.cells[2][1] = null; j.shown[2][1] = false;
put(2,2,'s6','r');
console.log('斜向进入空行营[2,2]→[3,2]:', j.canMove([2,2],[3,2]) ? 'pass' : 'FAIL');
// 不可攻击行营内的敌子
put(1,3,'s9','b');  // 蓝子在? 用行营(2,3)
for (let r=0;r<12;r++) for (let c=0;c<5;c++){ if (j.isCamp(r,c)) continue; j.cells[r][c]=null; j.shown[r][c]=false; }
put(2,3,'s9','b');   // 蓝子在行营(2,3)
put(1,3,'s5','r');   // 红子在其上邻
console.log('攻击行营内敌子(应false):', j.canMove([1,3],[2,3]) === false ? 'pass' : 'FAIL');
// 大本营仍不可进入/不可移动
put(11,1,'s7','r');
console.log('大本营内子不可动(应false):', j.canMove([11,1],[10,1]) === false ? 'pass' : 'FAIL');
console.log('行营数:', CAMP_LIST.length);
