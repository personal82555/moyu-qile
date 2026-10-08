
const http = require('http');
http.createServer((req, res) => {
  let b = ''; req.on('data', d => b += d);
  req.on('end', () => {
    const body = JSON.parse(b || '{}');
    const tag = String(body.model || '');
    res.setHeader('Content-Type', 'application/json');
    if (tag === 'normal')    return res.end(JSON.stringify({ choices: [{ message: { content: '建议炮二平五，控制中路。' }, finish_reason: 'stop' }] }));
    if (tag === 'reasoning') return res.end(JSON.stringify({ choices: [{ message: { content: '', reasoning_content: '马八进七，抢先挺兵。' }, finish_reason: 'stop' }] }));
    if (tag === 'array')     return res.end(JSON.stringify({ choices: [{ message: { content: [{ type: 'text', text: '车一平二，出车抢先。' }] } }] }));
    if (tag === 'empty')     return res.end(JSON.stringify({ choices: [{ message: { content: '' }, finish_reason: 'length' }] }));
    if (tag === 'err')       return res.end(JSON.stringify({ error: { message: 'Invalid token (401)' } }));
    if (tag === 'html')      return res.end('<html>502 Bad Gateway</html>');
  });
}).listen(7098, () => console.log('mock up'));
