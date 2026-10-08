const http = require('http');
http.createServer((req, res) => {
  let b = ''; req.on('data', d => b += d);
  req.on('end', () => {
    const j = JSON.parse(b || '{}');
    const tag = String(j.model || '');
    res.setHeader('Content-Type', 'application/json');
    if (tag === 'good') return res.end(JSON.stringify({ choices: [{ message: { content: '连接成功' }, finish_reason: 'stop' }] }));
    if (tag === 'badkey') return res.end(JSON.stringify({ error: { message: 'Invalid token (401)' } }));
    if (tag === 'badmodel') { res.statusCode = 404; return res.end(JSON.stringify({ error: { message: 'model not found' } })); }
    if (tag === 'think') return res.end(JSON.stringify({ choices: [{ message: { content: '', reasoning_content: '连接成功' }, finish_reason: 'stop' }] }));
    res.end(JSON.stringify({ choices: [{ message: { content: '' }, finish_reason: 'length' }] }));
  });
}).listen(7096, () => console.log('mock2 up'));
