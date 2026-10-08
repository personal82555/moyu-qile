// 模拟"只会说英文"的模型：第一次回英文，追问"必须中文"后才回中文
const http = require('http');
let calls = 0;
http.createServer((req, res) => {
  let b = ''; req.on('data', d => b += d);
  req.on('end', () => {
    const j = JSON.parse(b || '{}');
    const user = ((j.messages || []).find(m => m.role === 'user') || {}).content || '';
    const sys = ((j.messages || []).find(m => m.role === 'system') || {}).content || '';
    calls++;
    console.log('--- call', calls, '| system 含中文约束:', sys.includes('不得出现英文单词'), '| user 含重试标记:', user.includes('务必用简体中文'));
    res.setHeader('Content-Type', 'application/json');
    const english = 'The board seems to be mid-game but pieces are on starting positions. Black cannons on b8 and h8, red cannons on b3.';
    const chinese = '建议：炮二平五先架中炮，把对方的将门锁住；你右翼的车还没出动，下一步记得亮车抢占肋道，别贪吃边卒。';
    res.end(JSON.stringify({ choices: [{ message: { content: user.includes('务必用简体中文') ? chinese : english }, finish_reason: 'stop' }] }));
  });
}).listen(7094, () => console.log('mock3 up on 7094'));
