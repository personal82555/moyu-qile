// 服务端：静态资源 + WebSocket 房间（象棋/五子棋/军棋/飞行棋）
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const { Chess } = require('./app/js/chess.js');
const { aiMove } = require('./app/js/chessAI.js');
const { Gomoku, aiPick } = require('./app/js/gomoku.js');
const { JunqiBoard, KIND_LBL } = require('./app/js/junqi.js');
const PORT = process.env.PORT || 7025;
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon' };
const APP = path.join(__dirname, 'app');

// —— 排行榜存储 ——
const DATA = path.join(__dirname, 'data');
if (!fs.existsSync(DATA)) fs.mkdirSync(DATA, { recursive: true });
// —— 存档存储（各游戏独立文件；目录可由用户设置） ——
const CONFIG_FILE = path.join(DATA, 'config.json');
const GAMES = ['chess', 'gomoku', 'junqi'];
const DEFAULT_SAVE_DIR = path.join(DATA, 'saves');
function loadConfig() { try { return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); } catch (e) { return {}; } }
function writeConfig(c) { try { fs.writeFileSync(CONFIG_FILE, JSON.stringify(c, null, 2)); } catch (e) {} }
function saveDir() {
  const c = loadConfig();
  let raw = c && c.saveDir ? String(c.saveDir).trim() : '';
  if (!raw && c && c.savePath) raw = path.dirname(String(c.savePath));   // 兼容旧配置（单文件）
  return raw ? path.resolve(raw) : DEFAULT_SAVE_DIR;
}
function saveFileFor(game) { return path.join(saveDir(), game + '-saves.json'); }
function readGameSaves(game) {
  try { const o = JSON.parse(fs.readFileSync(saveFileFor(game), 'utf8')); return Array.isArray(o.saves) ? o.saves : []; }
  catch (e) { return []; }
}
function writeGameSaves(game, arr) {
  const fp = saveFileFor(game);
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  fs.writeFileSync(fp, JSON.stringify({ game, saves: arr }, null, 2));
}
// —— 排行榜存储（与存档同目录、按游戏分文件，持久化） ——
function rankFileFor(game) { return path.join(saveDir(), game + '-ranks.json'); }
function readRanksFor(game) {
  try { const o = JSON.parse(fs.readFileSync(rankFileFor(game), 'utf8')); return Array.isArray(o.games) ? o.games : []; }
  catch (e) { return []; }
}
function rankKey(x) {
  return x.id || (x.game + '|' + x.ts + '|' + (x.result || '') + '|' + (x.dur || x.durTxt || '') + '|' + (x.steps || ''));
}
function normalizeRanks(arr) {
  const seen = {}; const out = [];
  (arr || []).forEach(x => { const k = rankKey(x); if (seen[k]) return; seen[k] = 1; out.push(x); });
  return out.sort((a, b) => b.ts - a.ts).slice(0, 500);
}
function writeRanksFor(game, arr) {
  const fp = rankFileFor(game);
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  fs.writeFileSync(fp, JSON.stringify({ game, games: normalizeRanks(arr) }, null, 2));
}
function allRanks() {
  const out = [];
  GAMES.forEach(g => readRanksFor(g).forEach(x => out.push(x)));
  return out.sort((a, b) => b.ts - a.ts);
}
function countAll() {
  const out = {};
  GAMES.forEach(g => { out[g] = readGameSaves(g).length; });
  return out;
}
// 旧版单文件（data/saves.json）一次性拆分到各游戏独立文件
function splitLegacyFile(fp) {
  try {
    const o = JSON.parse(fs.readFileSync(fp, 'utf8'));
    GAMES.forEach(g => {
      const mine = (o.saves || []).filter(x => x.game === g);
      if (!mine.length) return;
      const cur = readGameSaves(g);
      const ids = new Set(cur.map(x => x.id));
      mine.forEach(x => { if (!ids.has(x.id)) cur.push(x); });
      writeGameSaves(g, cur.sort((a, b) => b.ts - a.ts));
    });
    fs.renameSync(fp, fp + '.migrated');
  } catch (e) {}
}
function migrateLegacyFile() {
  try {
    const legacyCfg = loadConfig();
    if (legacyCfg && legacyCfg.savePath) {   // 旧配置：把文件目录作为存档目录
      const d0 = path.dirname(path.resolve(legacyCfg.savePath));
      const c2 = { saveDir: d0 }; writeConfig(c2);
      const fp = path.resolve(legacyCfg.savePath);
      if (fs.existsSync(fp)) splitLegacyFile(fp);
    }
  } catch (e) {}
  // 默认位置的历史单文件（无论是否用过旧配置都要迁）
  try {
    const legacy = path.join(DATA, 'saves.json');
    if (fs.existsSync(legacy)) splitLegacyFile(legacy);
  } catch (e) {}
  // 旧排行榜单文件 data/ranks.json → 按游戏拆分
  try {
    const legacyRank = path.join(DATA, 'ranks.json');
    if (fs.existsSync(legacyRank)) {
      const o = JSON.parse(fs.readFileSync(legacyRank, 'utf8'));
      GAMES.forEach(g => {
        const mine = (o.games || []).filter(x => x.game === g);
        if (!mine.length) return;
        const cur = readRanksFor(g);
        mine.forEach(x => cur.push(x));
        cur.sort((a, b) => b.ts - a.ts);
        writeRanksFor(g, cur.slice(0, 500));
      });
      fs.renameSync(legacyRank, legacyRank + '.migrated');
    }
  } catch (e) {}
}
migrateLegacyFile();
GAMES.forEach(g => { try { writeRanksFor(g, readRanksFor(g)); } catch (e) {} });   // 启动时去重规范化

// 允许写入的根目录（容器内只有 /app 数据卷会被持久化）
function allowPath(p2) {
  const r = path.resolve(p2);
  return r === '/app' || r.startsWith('/app/');
}
function ensureSaveFile(fp) {
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  if (!fs.existsSync(fp)) fs.writeFileSync(fp, JSON.stringify({ saves: [] }, null, 2));
}
const CTJ = { 'Content-Type': 'application/json; charset=utf-8' };

async function aiHintAPI(req, res, body) {
  try {
    const { baseUrl, apiKey, model, prompt } = JSON.parse(body);
    if (!baseUrl || !model || !prompt) { res.writeHead(400, CTJ); return res.end(JSON.stringify({ error: '缺少 baseUrl/model/prompt' })); }
    const url = baseUrl.replace(/\/$/, '') + '/chat/completions';
    const payload = {
      model,
      stream: false,
      messages: [
        { role: 'system', content: '你是一位中文棋类教练。用户给出棋局描述，请用一句话（50字以内）直接告诉用户下一步怎么走，指出具体位置和理由。只输出建议本身，不要输出思考过程、不要客套。' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 512,
      temperature: 0.6
    };
    const u = new URL(url);
    const mod = u.protocol === 'https:' ? require('https') : require('http');
    const opts = { method: 'POST', hostname: u.hostname, port: u.port || (u.protocol === 'https:' ? 443 : 80), path: u.pathname + u.search,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(apiKey ? { Authorization: 'Bearer ' + apiKey } : {}) }, timeout: 45000 };
    // 从各家返回里尽力取出正文：content / reasoning_content / text / 数组形式
    const pickText = (j) => {
      const ch = (j && j.choices && j.choices[0]) || {};
      const m = ch.message || {};
      const cand = [
        typeof m.content === 'string' ? m.content : '',
        Array.isArray(m.content) ? m.content.map(x => (x && (x.text || x.content)) || '').join('') : '',
        typeof m.reasoning_content === 'string' ? m.reasoning_content : '',
        typeof m.reasoning === 'string' ? m.reasoning : '',
        typeof ch.text === 'string' ? ch.text : '',
        typeof j.output_text === 'string' ? j.output_text : ''
      ].map(x => (x || '').trim()).filter(Boolean);
      return { text: cand[0] || '', finish: ch.finish_reason || '', raw: cand };
    };
    await new Promise((resolve) => {
      const rq = mod.request(opts, rs => {
        let buf = '';
        rs.on('data', d2 => buf += d2);
        rs.on('end', () => {
          let j = null;
          try { j = JSON.parse(buf); } catch (e) {
            // 返回体不是 JSON（可能是 SSE / HTML 错误页）
            res.writeHead(502, CTJ);
            return res.end(JSON.stringify({ error: '模型返回非JSON（HTTP ' + rs.statusCode + '）：' + String(buf).replace(/\s+/g, ' ').slice(0, 200) })), resolve();
          }
          if (j && j.error) {
            res.writeHead(502, CTJ);
            return res.end(JSON.stringify({ error: '模型接口报错：' + (j.error.message || JSON.stringify(j.error)).slice(0, 200) })), resolve();
          }
          const got = pickText(j);
          if (got.text) {
            res.writeHead(200, CTJ);
            return res.end(JSON.stringify({ hint: got.text.slice(0, 200) })), resolve();
          }
          // 没有任何正文：把原始返回摘要回传，便于定位（如 token 用尽 / 空回复 / 被内容策略拦截）
          const brief = JSON.stringify(j).slice(0, 260);
          const why = got.finish === 'length' ? '（输出达到长度上限，正文为空）' : '';
          res.writeHead(502, CTJ);
          res.end(JSON.stringify({ error: '模型没有返回正文' + why + '。原始返回：' + brief }));
          resolve();
        });
      });
      rq.on('error', e => { res.writeHead(502, CTJ); res.end(JSON.stringify({ error: '连接模型失败: ' + e.message + '（请检查 Base URL 是否能从服务器访问）' })); resolve(); });
      rq.on('timeout', () => { rq.destroy(); res.writeHead(504, CTJ); res.end(JSON.stringify({ error: '模型响应超时（45 秒）' })); resolve(); });
      rq.write(JSON.stringify(payload));
      rq.end();
    });
  } catch (e) { res.writeHead(500, CTJ); res.end(JSON.stringify({ error: e.message })); }
}

const server = http.createServer((req, res) => {
  let u = decodeURIComponent(req.url.split('?')[0]);
  if (u === '/api/ai-hint') {
    let body = '';
    req.on('data', d2 => body += d2);
    req.on('end', () => aiHintAPI(req, res, body));
    return;
  }
  if (u === '/api/config') {
    if (req.method === 'GET') {
      res.writeHead(200, CTJ);
      return res.end(JSON.stringify({
        saveDir: saveDir(), defaultDir: DEFAULT_SAVE_DIR, allowedRoot: '/app',
        files: GAMES.map(g => ({ game: g, file: saveFileFor(g), exists: fs.existsSync(saveFileFor(g)), count: readGameSaves(g).length }))
      }));
    }
    if (req.method === 'POST') {
      let body = '';
      req.on('data', d2 => body += d2);
      req.on('end', () => {
        try {
          const r2 = JSON.parse(body || '{}');
          let raw = String(r2.saveDir || r2.savePath || '').trim();
          if (!raw) throw new Error('目录不能为空');
          let dir = path.resolve(raw);
          if (fs.existsSync(dir) && fs.statSync(dir).isFile()) dir = path.dirname(dir);   // 传了文件则取其目录
          if (!allowPath(dir)) throw new Error('为安全起见，只允许使用 /app 目录下的路径（该目录已挂载到主机）');
          const oldDir = saveDir();
          fs.mkdirSync(dir, { recursive: true });
          const c = loadConfig();
          c.saveDir = dir; delete c.savePath; writeConfig(c);
          // 迁移：把旧目录里各游戏的存档合并进新目录（按 id 去重），默认开启
          if (r2.migrate !== false && oldDir !== dir) {
            GAMES.forEach(g => {
              const from = path.join(oldDir, g + '-saves.json');
              if (!fs.existsSync(from)) return;
              try {
                const src = JSON.parse(fs.readFileSync(from, 'utf8'));
                const cur = readGameSaves(g);
                const ids = new Set(cur.map(x => x.id));
                (src.saves || []).forEach(x => { if (!ids.has(x.id)) cur.push(x); });
                writeGameSaves(g, cur.sort((a, b) => b.ts - a.ts));
              } catch (e) {}
            });
          }
          // 排行文件一并迁移
          if (r2.migrate !== false && oldDir !== dir) {
            GAMES.forEach(g => {
              const from = path.join(oldDir, g + '-ranks.json');
              if (!fs.existsSync(from)) return;
              try {
                const src = JSON.parse(fs.readFileSync(from, 'utf8'));
                const cur = readRanksFor(g);
                (src.games || []).forEach(x => cur.push(x));
                cur.sort((a, b) => b.ts - a.ts);
                writeRanksFor(g, cur.slice(0, 500));
              } catch (e) {}
            });
          }
          GAMES.forEach(g => { const fp = saveFileFor(g); if (!fs.existsSync(fp)) writeGameSaves(g, []); });
          res.writeHead(200, CTJ);
          res.end(JSON.stringify({ ok: true, saveDir: dir, oldDir, counts: countAll(), files: GAMES.map(g => saveFileFor(g)) }));
        } catch (e) { res.writeHead(400, CTJ); res.end(JSON.stringify({ error: e.message })); }
      });
      return;
    }
  }
  if (u === '/api/fs') {
    const q = new URL(req.url, 'http://x').searchParams;
    const dir = path.resolve(q.get('dir') || '/app/data');
    if (!allowPath(dir)) { res.writeHead(403, CTJ); return res.end(JSON.stringify({ error: '只允许浏览 /app 目录' })); }
    try {
      const ents = fs.readdirSync(dir, { withFileTypes: true });
      const dirs = ents.filter(e => e.isDirectory()).map(e => e.name).sort();
      const files = ents.filter(e => e.isFile() && /\.json$/i.test(e.name)).map(e => e.name).sort();
      res.writeHead(200, CTJ);
      return res.end(JSON.stringify({ dir, parent: path.dirname(dir), dirs, files, root: '/app' }));
    } catch (e) { res.writeHead(200, CTJ); return res.end(JSON.stringify({ dir, parent: path.dirname(dir), dirs: [], files: [], error: e.message })); }
  }
  if (u === '/api/save') {
    const q = new URL(req.url, 'http://x').searchParams;
    const game = String(q.get('game') || '');
    if (req.method === 'GET') {
      if (game && GAMES.indexOf(game) >= 0) {
        const arr = readGameSaves(game).sort((a, b) => b.ts - a.ts);
        res.writeHead(200, CTJ);
        return res.end(JSON.stringify({ game, file: saveFileFor(game), saves: arr }));
      }
      // 不带 game：返回各游戏汇总（仅计数，便于概览）
      res.writeHead(200, CTJ);
      return res.end(JSON.stringify({ dir: saveDir(), counts: countAll(), files: GAMES.map(g => saveFileFor(g)) }));
    }
    if (req.method === 'DELETE' || (req.method === 'POST' && q.get('del'))) {
      const id = q.get('id') || '';
      if (GAMES.indexOf(game) < 0) { res.writeHead(400, CTJ); return res.end(JSON.stringify({ error: '缺少 game 参数' })); }
      const arr = readGameSaves(game);
      const n0 = arr.length;
      const left = arr.filter(x => x.id !== id);
      writeGameSaves(game, left);
      res.writeHead(200, CTJ);
      return res.end(JSON.stringify({ ok: true, removed: n0 - left.length, count: left.length }));
    }
    if (req.method === 'POST') {
      let body = '';
      req.on('data', d2 => body += d2);
      req.on('end', () => {
        try {
          const rec = JSON.parse(body);
          const g = String(rec.game || '');
          if (GAMES.indexOf(g) < 0) throw new Error('未知游戏：' + g);
          const arr = readGameSaves(g);
          rec.id = rec.id || ('s' + Date.now() + Math.floor(Math.random() * 1000));
          rec.ts = Date.now();
          const idx = arr.findIndex(x => x.id === rec.id);
          if (idx >= 0) arr[idx] = rec; else arr.push(rec);
          const trimmed = arr.sort((x, y) => y.ts - x.ts).slice(0, 100);
          writeGameSaves(g, trimmed);
          res.writeHead(200, CTJ);
          res.end(JSON.stringify({ ok: true, id: rec.id, ts: rec.ts, game: g, file: saveFileFor(g), count: trimmed.length }));
        } catch (e) { res.writeHead(400, CTJ); res.end(JSON.stringify({ error: e.message })); }
      });
      return;
    }
  }
  if (u === '/api/rank') {
    const q = new URL(req.url, 'http://x').searchParams;
    const game = String(q.get('game') || '');
    if (req.method === 'GET') {
      if (game && GAMES.indexOf(game) >= 0) {
        res.writeHead(200, CTJ);
        return res.end(JSON.stringify({ game, file: rankFileFor(game), games: readRanksFor(game) }));
      }
      res.writeHead(200, CTJ);
      return res.end(JSON.stringify({
        games: allRanks(),
        counts: (() => { const c = {}; GAMES.forEach(g => c[g] = readRanksFor(g).length); return c; })(),
        files: GAMES.map(g => ({ game: g, file: rankFileFor(g), count: readRanksFor(g).length })),
        dir: saveDir()
      }));
    }
    if (req.method === 'POST') {
      let body = '';
      req.on('data', d2 => body += d2);
      req.on('end', () => {
        try {
          const rec = JSON.parse(body);
          const g = GAMES.indexOf(String(rec.game || '')) >= 0 ? rec.game : 'chess';
          const arr = readRanksFor(g);
          rec.ts = Date.now();
          rec.id = rec.id || ('r' + rec.ts + Math.floor(Math.random() * 1000));
          arr.push(rec);
          const trimmed = arr.sort((a, b) => b.ts - a.ts).slice(0, 500);
          writeRanksFor(g, trimmed);
          res.writeHead(200, CTJ);
          res.end(JSON.stringify({ ok: true, game: g, count: trimmed.length, file: rankFileFor(g) }));
        } catch (e) { res.writeHead(400, CTJ); res.end(JSON.stringify({ error: e.message })); }
      });
      return;
    }
    if (req.method === 'DELETE') {
      const g = String(q.get('game') || '');
      const id = q.get('id') || '';
      if (GAMES.indexOf(g) < 0) { res.writeHead(400, CTJ); return res.end(JSON.stringify({ error: '缺少 game' })); }
      const arr = readRanksFor(g).filter(x => String(x.ts) !== id && x.id !== id);
      writeRanksFor(g, arr);
      res.writeHead(200, CTJ);
      return res.end(JSON.stringify({ ok: true, count: arr.length }));
    }
  }
  if (u === '/') u = '/index.html';
  const fp = path.normalize(path.join(APP, u));
  if (!fp.startsWith(APP)) { res.writeHead(403); return res.end('forbidden'); }
  fs.readFile(fp, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(buf);
  });
});

// —— 房间管理 ——
const rooms = new Map();       // id → room
let roomSeq = Math.floor(Math.random() * 9000) + 1000;

function newRoom(game) {
  const id = String(roomSeq++);
  const room = { id, game, clients: [], state: null, host: null };
  if (game === 'chess') room.state = { g: new Chess(), names: { b: '蓝方等待中', r: '红方等待中' }, aiSide: null, aiDepth: 3 };
  else if (game === 'gomoku') room.state = { g: new Gomoku(), names: ['黑方等待中','白方等待中'], aiSide: 0 };
  else if (game === 'junqi') room.state = { g: new JunqiBoard('flip'), names: ['红方等待中','蓝方等待中'], aiSide: null };
  else if (game === 'ludo') room.state = { g: new LudoGame(), seat: {} };
  rooms.set(id, room);
  return room;
}
function snapshot(room) {
  const s = room.state;
  if (room.game === 'chess') return { board: s.g.B, redTurn: s.g.redTurn, moves: s.g.moves, over: !!s.g.winner, winner: s.g.winner, names: s.names, aiSide: s.aiSide, aiDepth: s.aiDepth, check: s.g.inCheck(s.g.redTurn ? 'r' : 'b') };
  if (room.game === 'gomoku') return { g: s.g.full(), names: s.names, aiSide: s.aiSide };
  if (room.game === 'junqi') return { j: s.g.serialize(), names: s.names, aiSide: s.aiSide };
  if (room.game === 'ludo') return { l: s.g.serialize(), seat: s.seat };
  return {};
}

function broadcast(room) {
  const snap = snapshot(room);
  room.clients.forEach(cl => {
    snap.you = cl.side;
    snap.seat = cl.side === 'ludo' ? undefined : cl.side;
    try { cl.ws.send(JSON.stringify({ t: 'state', d: snap, roomId: room.id, game: room.game })); } catch (e) {}
  });
}

const wss = new WebSocketServer({ path: '/ws', noServer: true });
server.on('upgrade', (req, socket, head) => { if (req.url === '/ws') { wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req)); } });

wss.on('connection', (ws) => {
  ws.room = null; ws.side = null;
  ws.on('message', buf => {
    let msg; try { msg = JSON.parse(buf); } catch (e) { return; }
    handle(ws, msg).catch(e => { try { ws.send(JSON.stringify({ t: 'err', e: e.message })); } catch (x) {} });
  });
  ws.on('close', () => {
    if (!ws.room) return;
    const i = ws.room.clients.indexOf(ws); if (i >= 0) ws.room.clients.splice(i, 1);
    if (ws.room.game === 'ludo' && ws.side && ws.room.state.seat[ws.side]) ws.room.state.seat[ws.side].online = false;
    else if (ws.side && ws.room.state.names && typeof ws.side === 'string' && ws.room.state.names[ws.side]) ws.room.state.names[ws.side] += '（已掉线）';
    broadcast(ws.room);
  });
});

async function handle(ws, msg) {
  const a = msg.a;
  if (a === 'list') {
    const out = [];
    rooms.forEach(r => out.push({ id: r.id, game: r.game, players: r.clients.length, snapshot: null }));
    return ws.send(JSON.stringify({ t: 'list', d: out.filter(r => r.players < 4) }));
  }
  if (a === 'create') {
    const room = newRoom(msg.game);
    rooms.set(room.id, room);
    return ws.send(JSON.stringify({ t: 'created', id: room.id, game: msg.game }));
  }
  if (a === 'join') {
    const room = rooms.get(msg.id);
    if (!room) return ws.send(JSON.stringify({ t: 'err', e: '房间不存在' }));
    if (room.clients.length >= 4) return ws.send(JSON.stringify({ t: 'err', e: '房间已满' }));
    ws.room = room; room.clients.push(ws);
    // 分配位置
    if (room.game === 'ludo') {
      const colors = ['r','y','b','g'].filter(c => !room.state.seat[c] || !room.state.seat[c].online);
      const pick = room.clients.filter(c => c !== ws).map(c => c.side).filter(c => c);
      ws.side = colors[0] || 'spectator';
      room.state.seat[ws.side] = { online: true, ai: room.state.seat[ws.side] ? room.state.seat[ws.side].ai : 0 };
      room.state.g.AI_LEVEL[ws.side] = room.state.seat[ws.side].ai;
    } else {
      const sides = room.game === 'gomoku' ? [0, 1] : ['r', 'b'];
      if (room.game === 'gomoku') {
        // state.names 是数组，用 side 序号
        const taken = room.clients.filter(c => c !== ws && typeof c.side === 'number').map(c => c.side);
        ws.side = taken.includes(0) ? 1 : 0;
        room.state.names[ws.side] = (ws.side === 0 ? '黑方 ' : '白方 ') + '玩家';
      } else {
        const taken = room.clients.filter(c => c !== ws && typeof c.side === 'string' && room.game !== 'ludo').map(c => c.side);
        ws.side = taken.includes('r') ? 'b' : 'r';
        room.state.names[ws.side] = (ws.side === 'r' ? '红方 ' : '蓝方 ') + '玩家';
      }
    }
    ws.send(JSON.stringify({ t: 'joined', d: { id: room.id, game: room.game, side: ws.side } }));
    if (room.clients.length >= 2 && !room.started) room.started = true;
    broadcast(room);
    return;
  }
  if (a === 'spectate') {
    const room = rooms.get(msg.id);
    if (!room) return ws.send(JSON.stringify({ t: 'err', e: '房间不存在' }));
    ws.room = room; ws.side = null; room.clients.push(ws);
    ws.send(JSON.stringify({ t: 'joined', d: { id: room.id, game: room.game, side: null } }));
    broadcast(room);
    return;
  }
  if (!ws.room) return;
  const room = ws.room, s = room.state;
  if (a === 'aiLevel' && room.game === 'ludo') {
    const side = msg.side; const v = +msg.v || 0;
    if (room.state.seat[side] && room.clients.find(c => c.side === side)) return; // 有真人就别改
    s.g.AI_LEVEL[side] = v;
    return broadcast(room);
  }
  if (a === 'addAI' && room.game === 'ludo') {
    for (const c of s.g.colors) {
      if (!room.state.seat[c] || !room.clients.find(cl => cl.side === c)) { s.g.AI_LEVEL[c] = s.g.AI_LEVEL[c] || 1; room.state.seat[c] = room.state.seat[c] || {}; room.state.seat[c].ai = 1; break; }
    }
    return broadcast(room);
  }
  if (a === 'setAI' && room.game !== 'ludo') {
    // 对战双方之一换为电脑
    s.aiSide = msg.side; s.aiDepth = +msg.d || 3;
    return broadcast(room);
  }
  if (a === 'clearAI' && room.game !== 'ludo') { s.aiSide = null; return broadcast(room); }

  const play = (moveFn) => { const r = moveFn(); broadcast(room); return r; };

  if (room.game === 'chess') {
    if (a === 'move') {
      const m = msg.m; if (s.g.own(m[0], m[1], s.g.redTurn ? 'r' : 'b')) { s.g.apply(s.g.legal(m[0], m[1]).find(x => x[2] === m[2] && x[3] === m[3]) || m); }
      aiChessTurn(room);
      return play(null);
    }
    if (a === 'undo') { if (s.g.moves.length) { s.g.moves.pop(); for (let k = 0; k < 2; k++) { const m = s.g.moves.pop() || null; /* not tracked board history → restore from moves? We'd need history stack */ } } }
    if (a === 'new') { s.g = new Chess(); return play(null); }
    return;
  }
  if (room.game === 'gomoku') {
    if (a === 'place') { s.g.place(msg.r, msg.c); aiGomokuTurn(room); return play(null); }
    if (a === 'new') { s.g = new Gomoku(); return play(null); }
    return;
  }
  if (room.game === 'junqi') {
    if (a === 'act') {
      if (msg.kind === 'flip') { s.g.flip(msg.r, msg.c); }
      else if (msg.kind === 'move') { s.g.movePiece([msg.fr, msg.fc], [msg.tr, msg.tc]); }
      aiJunqiTurn(room);
      return play(null);
    }
    if (a === 'new') { s.g = new JunqiBoard('flip'); return play(null); }
    return;
  }
  if (room.game === 'ludo') {
    if (a === 'roll') { s.g.roll(); broadcast(room); ludoAiLoop(room); return; }
    if (a === 'move') {
      s.g.tryMove(msg.i);
      broadcast(room);
      ludoAiLoop(room);
      // 若随骰而来 extraTurn，玩家再掷
      return;
    }
    if (a === 'pass') { s.g.nextTurn(); broadcast(room); ludoAiLoop(room); return; }
    if (a === 'new') { s.g = new LudoGame(s.g.colors, s.g.mode); room.state.seat = {}; return play(null); }
    return;
  }
}

function aiChessTurn(room) {
  const s = room.state;
  if (!s.aiSide) return;
  if (s.g.redTurn !== (s.aiSide === 'r')) return;
  const r = aiMove(s.g, { side: s.aiSide, depth: s.aiDepth || 3 });
  if (r && r.move) {
    const m = Array.isArray(r) ? r : r.move;
    s.g.apply(s.g.legal(m[0], m[1]).find(x => x[2] === m[2] && x[3] === m[3]) || m);
  }
}

function aiGomokuTurn(room) {
  const s = room.state;
  if (s.aiSide == null) return;
  if (s.g.over) return;
  if (s.g.player !== (s.aiSide === 0 ? 1 : 2)) return;
  const p = aiPick(s.g, s.g.player);
  s.g.place(p.r, p.c);
}

function aiJunqiTurn(room) {
  const s = room.state; if (!s.aiSide) return;
  const g = s.g;
  const aiOwner = s.aiSide; // 'r'/'b'
  if (g.turnOwner() !== aiOwner) return;
  // 简单 AI：随机尝试翻子（优先）或移动
  const flips = [];
  const moves = [];
  for (let r = 0; r < g.R; r++) for (let c = 0; c < g.C; c++) {
    if (g.cells[r][c] && !g.shown[r][c]) flips.push([r, c]);
    else if (g.cells[r][c] && g.cells[r][c].owner === aiOwner) {
      [[1,0],[-1,0],[0,1],[0,-1]].forEach(([dr,dc]) => { const tr=r+dr, tc=c+dc; if (g.canMove([r,c],[tr,tc])) moves.push([[r,c],[tr,tc]]); });
    }
  }
  // 检查仍可行动的子（canMove 会转 turn？不,canMove只读）
  if (Math.random() < 0.6 && flips.length) { g.flip(...flips[Math.floor(Math.random() * flips.length)]); return; }
  if (moves.length) { const pick = moves[Math.floor(Math.random() * moves.length)]; g.movePiece(pick[0], pick[1]); }
}

async function ludoAiLoop(room) {
  const g = room.state.g;
  let guard = 0;
  while (guard++ < 40) {
    if (g.winner) break;
    const cur = g.cur;
    const seat = room.state.seat[cur];
    const onlineHuman = seat && seat.online;
    if (onlineHuman) break;
    const isAi = seat && seat.ai;
    if (!isAi) {
      // 无人就座的颜色转 AI 自动（保底不卡死）
      if (g.dice != null) { const mx = g.movable(); if (!mx.length) g.nextTurn(); }
      break;
    }
    const r = g.aiAct();
    if (r && r.voided) { continue; }
    broadcast(room);
    if (g.dice != null) break; // 该 AI 掷完等待……若 ai 实际 movable，继续
    if (r && (r.extraTurn || (r.events && r.events.includes('finish')))) continue;
    if (r && r.extraTon) continue;
    break;
  }
  broadcast(room);
}

server.listen(PORT, () => console.log('games-server listening on ' + PORT));
