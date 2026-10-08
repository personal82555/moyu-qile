
const { Chess } = require('../app/js/chess.js');
const g = new Chess();
console.log('黑卒t:', g.B[3][4].t, '· 黑卒(3,4)走法:', g.legal(3,4,'b').length);
console.log('黑方总走法:', g.allLegal('b').length);
const bad = [];
for (let r=0;r<10;r++)for(let c=0;c<9;c++){ const p=g.B[r][c]; if(p && !['将','士','相','马','车','炮','兵'].includes(p.t)) bad.push(p.t); }
console.log('未归一化类型:', bad.length ? bad.join(',') : '无');
