const { JunqiBoard } = require('../app/js/junqi.js');
const j = new JunqiBoard();
console.log('开局winner:', j.winner());
j.flip(0,0); console.log('翻后turn:', j.turn);
