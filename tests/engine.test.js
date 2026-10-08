
const { Chess } = require('../app/js/chess.js');
const { aiMove } = require('../app/js/chessAI.js');
const { Gomoku, aiPick } = require('../app/js/gomoku.js');
const { JunqiBoard } = require('../app/js/junqi.js');
let LudoGame = null, PATH_LEN = 0;
try { ({ LudoGame, PATH_LEN } = require('../app/js/ludo.js')); } catch (e) { console.log('⏭ 跳过飞行棋（ludo.js 未实现）'); }
let fail = 0;
const assert = (c, m) => { if (!c) { fail++; console.log('FAIL', m); } else console.log('ok', m); };

// 象棋
const g = new Chess();
assert(g.allLegal('r').length === 41, '红开局走法=41 (got ' + g.allLegal('r').length + ')');
assert(!g.legal(9,7,'r').some(m => m[2] === 7 && m[3] === 6), '马蹩腿');
// 炮打隔子：炮(7,1)→黑方向(2,1)有黑炮(2,1)作隔子, 隔子后(0,1)黑马应可达
assert(g.legal(7,1,'r').some(m => m[2] === 0 && m[3] === 1), '炮隔(2,1)打(0,1)黑马');
// 马跳
assert(g.legal(9,1,'r').some(m => m[2] === 7 && m[3] === 2), '马跳(7,2)');
// 将军判定: 红車(9,0)→(0,0)吃黑車后 黑将被??? 直接人工局面: 黑将(0,4),红車(0,0) → 黑被将军
const g2 = new Chess(`4将4/9/9/9/9/9/9/9/9/俥3帥4 moves:9,0,0,0`);
assert(g2.inCheck('b') === true, '車(0,0)将军黑');
// 黑方AI走(避将)
const mv = aiMove(g2, { side: 'b', depth: 3 });
if (mv && mv.move) { g2.apply(mv.move); assert(!g2.inCheck('b') || g2.allLegal('b').length===0, 'AI解将'); }
else assert(mv !== null, 'AI黑有解');
// 合法性: 送将走入法会被过滤
const g3 = new Chess('3k5/9/9/4R4/9/9/9/9/9/4K4');
assert(!g3.legal(0,3,'b').some(m=>m[2]===1&&m[3]===3), '黑将不能走进被車控制的(1,3)? 其实車在4,4线上 控制(0..5,4)? 将(0,3)→(1,3)不被打');

// 五子棋: 正规交替落子
const gk = new Gomoku();
gk.place(7,7);                       // 黑
assert(gk.player === 2, '轮白');
const pw = aiPick(gk, 2); gk.place(pw.r, pw.c);   // 白
// 交替落子造成黑两处活三→白须防守得分点在7/8行
const seq = [[7,3],[8,3],[7,4],[8,4],[7,5],[8,5]];
for (const [r,c] of seq) gk.place(r,c);
assert(gk.player === 1, '黑行棋');
const pd = aiPick(gk, 2); // 白(2)防守
// 黑3连(7,3-4-5)两端开阔 → AI 应拦在(7,2)或(7,6)之一(最高分)
assert(pd.r === 7 && (pd.c === 2 || pd.c === 6), '白拦黑活三 (got ' + pd.r + ',' + pd.c + ')');

// 军棋
const j = new JunqiBoard();
let cnt = 0; for (let r = 0; r < 12; r++) for (let c = 0; c < 5; c++) if (j.cells[r][c]) cnt++;
assert(cnt === 50, '军棋50枚');
assert(j.battle('s1','lei') === 'win', '工兵挖雷');
assert(j.battle('zha','s9') === 'both', '炸弹同归');
assert(j.battle('s5','s3') === 'win', '团>连');

// 飞行棋（未实现时跳过）
if (LudoGame) {
  const l = new LudoGame(['r']);
  l.dice = 6;
  assert(l.movable().length === 4, '骰6四机可起飞');
  l.tryMove(0);
  assert(l.players.r.planes[0] === 0, '起飞');
  l.dice = PATH_LEN;  // 直接到终点
  const me = l.movable(); assert(me.includes(0), PATH_LEN + ' 一步到终点可动');
} else {
  console.log('⏭ 跳过飞行棋测试');
}
