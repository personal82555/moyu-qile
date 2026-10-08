const http = require('http');
http.createServer((req, res) => {
  let b = ''; req.on('data', d => b += d);
  req.on('end', () => {
    const j = JSON.parse(b || '{}');
    const sys = (j.messages || []).filter(m => m.role === 'system').map(m => m.content).join(' ');
    const user = (j.messages || []).filter(m => m.role === 'user').map(m => m.content).join(' ');
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ choices: [{ message: { content: 'SYSTEM=' + sys.slice(0, 60) + ' || MAXTOK=' + j.max_tokens + ' || USER=' + user.slice(0, 40) }, finish_reason: 'stop' }] }));
  });
}).listen(7097, () => console.log('echo up'));
