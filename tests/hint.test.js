
const http = require('http');
const srv = http.createServer((req, res) => {
  let b = ''; req.on('data', d => b += d);
  req.on('end', () => {
    res.writeHead(200, {'Content-Type':'application/json'});
    res.end(JSON.stringify({ choices: [{ message: { content: '建议炮二平五，中路压制。' } }] }));
  });
});
srv.listen(7321, '0.0.0.0', async () => {
  const payload = JSON.stringify({ baseUrl: 'http://172.17.0.1:7321/v1', apiKey: 'test', model: 'mock', prompt: '象棋开局' });
  const rq = http.request({ host: '127.0.0.1', port: 7025, path: '/api/ai-hint', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } }, rs => {
    let o = ''; rs.on('data', d => o += d);
    rs.on('end', () => { console.log('hint:', o); srv.close(); process.exit(0); });
  });
  rq.write(payload); rq.end();
});
setTimeout(() => process.exit(1), 12000);
