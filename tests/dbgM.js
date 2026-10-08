
const { Chess } = require('/vol1/1000/HD1/docker/fnos-games/app/js/chess.js');
const g = new Chess();
const kinds = new Set();
for (let r=0;r<10;r++) for (let c=0;c<9;c++) if (g.B[r][c]) kinds.add(g.B[r][c].t);
console.log([...kinds].join(' '));
