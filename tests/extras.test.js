// 扩展功能本地逻辑测试（Node，无需浏览器）：残局校验 / 开局库合法性 / 走法中文描述
const path = require('path');
const D = path.join(__dirname, '..', 'app', 'js');
global.window = {};
global.localStorage = { getItem: () => null, setItem: () => { } };
require(path.join(D, 'chess.js'));
const { Chess } = require(path.join(D, 'chess.js'));
require(path.join(D, 'junqi.js'));
global.Chess = Chess;

// 载入 extras.js（其中纯逻辑函数挂到 window.EXTRAS）
const src = require('fs').readFileSync(path.join(D, 'extras.js'), 'utf8');
eval(src);
const EX = global.window.EXTRAS;

let pass = 0, fail = 0;
function t(name, cond, extra) { if (cond) { pass++; console.log('  ✅', name); } else { fail++; console.log('  ❌', name, extra || ''); } }

console.log('\n【1】象棋残局校验（AI 出的题必须真能一步杀）');
// 经典一步杀：黑将 0,4；红车 1,4 直接吃；再放个红帅
const mateCn = { fen: '4将4/9/4兵4/9/9/俥8/9/9/9/4帥4' };
t('中文字形的一步杀被接受', EX.verifyChessPuzzle(mateCn).ok, JSON.stringify(EX.verifyChessPuzzle(mateCn)));
const mateLatin = { fen: '4k4/9/4P4/9/9/R8/9/9/9/4K4' };
t('标准拉丁 FEN 的一步杀被接受（自动转换）', EX.verifyChessPuzzle(mateLatin).ok, JSON.stringify(EX.verifyChessPuzzle(mateLatin)));
t('黑方已被将军的非法局面被拒绝', !EX.verifyChessPuzzle({ fen: '4k4/9/9/9/9/9/9/9/4R4/4K4' }).ok);
t('有子但无一步杀的局面被拒绝', !EX.verifyChessPuzzle({ fen: '4将4/9/9/9/9/9/9/9/俥8/4帥4' }).ok);
t('无杀法的局面被拒绝', !EX.verifyChessPuzzle({ fen: '4k4/9/9/9/9/9/9/9/9/4K4' }).ok);
t('缺将/帅被拒绝', !EX.verifyChessPuzzle({ fen: '9/9/9/9/9/9/9/9/9/9' }).ok);
t('行数不对被拒绝', !EX.verifyChessPuzzle({ fen: '4k4/9/9/4K4' }).ok);
t('黑方子力过多的局面被拒绝', !EX.verifyChessPuzzle({ fen: '2r1k2r1/9/9/9/9/9/9/9/4C4/4K4' }).ok);

console.log('\n【2】五子棋残局校验（黑先必须存在一步成五）');
t('合法的"一步成五"被接受', EX.verifyGomokuPuzzle({ seq: [[7, 7], [8, 7], [7, 8], [8, 8], [7, 9], [8, 9], [7, 10], [9, 9]] }).ok);
t('黑方已连五的被拒绝', !EX.verifyGomokuPuzzle({ seq: [[7, 3], [8, 3], [7, 4], [8, 4], [7, 5], [8, 5], [7, 6], [8, 6], [7, 7]] }).ok);
t('没有成五点的被拒绝', !EX.verifyGomokuPuzzle({ seq: [[0, 0], [14, 14], [0, 14], [14, 0]] }).ok);
t('坐标越界被拒绝', !EX.verifyGomokuPuzzle({ seq: [[7, 7], [99, 7], [7, 8], [8, 8]] }).ok);

console.log('\n【3】开局库第一步在真实棋盘上必须合法');
const OP = { chess: [[7, 7, 7, 4, '中炮'], [6, 2, 5, 2, '仙人指路'], [9, 1, 7, 2, '起马局'], [9, 2, 7, 4, '飞相局'], [7, 1, 7, 3, '士角炮'], [6, 0, 5, 0, '边兵局']] };
for (const [fr, fc, tr, tc, nm] of OP.chess) {
  const g = new Chess();
  const legal = g.legal(fr, fc, 'r').some(m => m[2] === tr && m[3] === tc);
  const piece = g.B[fr][fc] ? g.B[fr][fc].t : '空';
  t(nm + '（' + piece + ' ' + fr + ',' + fc + '→' + tr + ',' + tc + '）合法', legal);
}

console.log('\n【4】走法中文描述（不能出现字母坐标）');
{
  const g = new Chess();
  const m = g.legal(7, 7, 'r').find(x => x[2] === 7 && x[3] === 4);
  const txt = EX.moveCN(g, m);
  t('描述为中文且无字母', /[一-龥]/.test(txt) && !/[a-i]\d/.test(txt), txt);
  console.log('    示例：', txt);
}
{
  const g = new Chess();
  const m = g.legal(9, 1, 'r').find(x => x[2] === 7 && x[3] === 2);
  t('马的中文描述非空', !!EX.moveCN(g, m), EX.moveCN(g, m));
  console.log('    示例：', EX.moveCN(g, m));
}
{
  // 吃子描述（红车吃黑将）
  const g = new Chess('4将4/9/4兵4/9/9/俥3卒4/9/9/9/4帥4');
  const txt = EX.moveCN(g, [5, 0, 5, 4]);
  t('吃子描述含"吃掉"且为中文', /吃掉/.test(txt) && /[一-龥]/.test(txt) && !/\bR\b|\bk\b/.test(txt), txt);
  console.log('    示例（吃子）：', txt);
}

console.log('\n【5】军棋记牌推理数据正确性（50 枚的标准分布）');
{
  const { perSide } = require(path.join(D, 'junqi.js')).JunqiBoard;
  const all = perSide().concat(perSide());
  const cnt = {};
  all.forEach(k => cnt[k] = (cnt[k] || 0) + 1);
  t('总数为 50', all.length === 50, String(all.length));
  t('司令 2 / 军长 2 / 师长 4 / 炸弹 4 / 军旗 2 / 地雷 6', cnt.s9 === 2 && cnt.s8 === 2 && cnt.s7 === 4 && cnt.zha === 4 && cnt.jq === 2 && cnt.lei === 6, JSON.stringify(cnt));
}

console.log('\n结果：通过 ' + pass + ' 项，失败 ' + fail + ' 项');
process.exit(fail ? 1 : 0);
