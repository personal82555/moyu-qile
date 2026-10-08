
const WebSocket = require('ws');
const ws = new WebSocket('ws://127.0.0.1:7099/ws');
ws.on('open', () => {
  ws.send(JSON.stringify({a:'create', game:'chess'}));
});
ws.on('message', d => {
  const m = JSON.parse(d);
  console.log('msg:', m.t, JSON.stringify(m).slice(0,200));
  if (m.t === 'created') { ws.send(JSON.stringify({a:'join', id: m.id})); }
  if (m.t === 'joined') { console.log('side:', m.d.side); process.exit(0); }
  if (m.t === 'err') process.exit(1);
});
setTimeout(()=>{console.log('timeout'); process.exit(1)}, 8000);
