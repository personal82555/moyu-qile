// 公共 UI：游戏局容器（棋盘居左，右侧工具栏：悔棋/重新开始）+ 状态栏
var currentRouteKey = 'chess';
const GAME_NAMES = { chess: '象棋', gomoku: '五子棋', junqi: '军棋' };
function ensureGameShell(key) {
  currentRouteKey = key;
  window.__gameOver = false;
  const app = document.getElementById('view');
  app.innerHTML = `<section class="lobby game-shell">
    <div id="statusline" class="status-banner"><span id="status-text"></span><span id="timer-badge" style="float:right"></span></div>
    <div class="game-head" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:10px">
      <h2 style="margin:0;font-size:18px">${GAME_NAMES[key]}</h2>
      <span style="flex:1"></span>
      <button class="btn" onclick="gameUndo()" style="padding:7px 11px;font-size:13px">↩ 悔棋</button>
      <button class="btn primary" onclick="gameRestart()" style="padding:7px 11px;font-size:13px">⟳ 重新开始</button>
      <button class="btn" onclick="showPuzzles()" style="padding:7px 11px;font-size:13px">🎯 残局</button>
      <button class="btn" onclick="showRanks()" style="padding:7px 11px;font-size:13px">🏆 排行</button>
      <button class="btn" onclick="showSaves()" style="padding:7px 11px;font-size:13px">💾 存档</button>
      <div class="diff-box" style="padding:5px 9px">
        <label for="timer" style="font-size:12px">⏱ 倒计时</label>
        <select id="timer" onchange="applyTimer()" style="font-size:13px">
          <option value="0">无</option>
          <option value="60">1分钟</option>
          <option value="180">3分钟</option>
          <option value="300">5分钟</option>
          <option value="600">10分钟</option>
          <option value="1200" selected>20分钟</option>
          <option value="1800">30分钟</option>
          <option value="3600">60分钟</option>
        </select>
      </div>
      <div class="diff-box" style="padding:5px 9px">
        <label for="diff" style="font-size:12px">难度</label>
        <select id="diff" onchange="gameRestart()" style="font-size:13px">
          <option value="easy">简单</option>
          <option value="normal" selected>普通</option>
          <option value="hard">困难</option>
        </select>
      </div>
      <button class="btn" onclick="toggleAuto()" id="auto-btn" style="padding:7px 11px;font-size:13px">☰ 每步自动提示</button>
      <button class="btn" onclick="aiCoach()" id="ai-coach-btn" style="padding:7px 11px;font-size:13px">🤖 AI 教我走</button>
      <button class="btn" onclick="aiSettings()" style="padding:7px 11px;font-size:13px">⚙ 模型设置</button>
      <button class="btn" onclick="showRules()" style="padding:7px 11px;font-size:13px">📖 玩法</button>
      <a class="btn" href="#/${key}" style="text-decoration:none;padding:7px 11px;font-size:13px">← 返回</a>
    </div>
    <div class="msg" id="msg"></div>
    <div id="ai-hint" class="ai-hintbox" style="display:none"></div>
    <div id="game-canvas"></div>
  </section>`;
}
function gameUndo() {
  const k = currentRouteKey;
  if (k === 'chess' && window.chessUndo) window.chessUndo();
  if (k === 'gomoku' && window.gomokuUndo) window.gomokuUndo();
  if (k === 'junqi' && window.junqiUndo) window.junqiUndo();
}
function gameRestart() {
  window.__gameOver = false;
  if (window.clearAutoSnapshot) clearAutoSnapshot();
  if (window.clearAutoSaveRecord) clearAutoSaveRecord();
  const m = document.getElementById('result-modal'); if (m) m.remove();
  const h = document.getElementById('ai-hint'); if (h) { h.style.display = 'none'; }
  if (window['boot_' + currentRouteKey + '_solo']) window['boot_' + currentRouteKey + '_solo']();
}
function setStatus(_id, text) {
  const el = document.getElementById('status-text') || document.getElementById('statusline') || document.getElementById('msg');
  if (el) el.innerText = text;
}
function $(id) { return document.getElementById(id); }

// —— 对局计时 + 战绩记录 ——
var gameStartTs = null;
function gameStarted() { gameStartTs = Date.now(); }
function gameDurationSec() { return gameStartTs ? Math.round((Date.now() - gameStartTs) / 1000) : 0; }
function fmtDur(sec) { const m = Math.floor(sec / 60), s2 = sec % 60; return m ? (m + '分' + s2 + '秒') : (s2 + '秒'); }
function recordGame(o) {
  o.dur = o.durTxt || fmtDur(gameDurationSec());
  o.mode = localStorage.getItem('fnos_mode') === '2p' ? '双人' : '人机';
  fetch('/api/rank', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(o) }).catch(() => {});
}

// —— AI 教练 ——
function getAICfg() {
  try { return JSON.parse(localStorage.getItem('fnos_ai_cfg') || '{}'); } catch (e) { return {}; }
}
function saveAICfg(cfg) { localStorage.setItem('fnos_ai_cfg', JSON.stringify(cfg)); }
function aiSettings() {
  const cfg = getAICfg();
  const app = document.getElementById('view');
  let box = document.getElementById('ai-set');
  if (box) box.remove();
  box = document.createElement('div');
  box.id = 'ai-set';
  box.className = 'ai-box';
  box.innerHTML = `<div class="ai-inner">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap">
      <b>接入自己的大模型（OpenAI 兼容）</b>
      <a href="https://ai.88531.cn" target="_blank" class="btn primary" style="text-decoration:none;font-size:13px">🔑 免费 获取KEY</a>
    </div>
    <input id="ai-url" placeholder="Base URL 例：https://ai.88531.cn/v1" value="${cfg.baseUrl || 'https://ai.88531.cn/v1'}">
    <input id="ai-key" placeholder="API Key（在 ai.88531.cn 获取）" value="${cfg.apiKey || ''}">
    <input id="ai-model" placeholder="模型名 例：deepseek-v4.1-flash" value="${cfg.model || 'deepseek-v4.1-flash'}">
    <div><button class="btn primary" onclick="aiSave()">保存并启用</button>
    <button class="btn" onclick="document.getElementById('ai-set').remove()">关闭</button></div>
  </div>`;
  app.prepend(box);
}
function aiSave() {
  saveAICfg({ baseUrl: document.getElementById('ai-url').value.trim(), apiKey: document.getElementById('ai-key').value.trim(), model: document.getElementById('ai-model').value.trim() });
  const b = document.getElementById('ai-set'); if (b) b.remove();
  gameRestart();
}
function aiBoardDesc() {
  const k = currentRouteKey;
  if (k === 'chess' && cg) {
    const lines = ['象棋当前局面（行 1=黑方底线, 行 10=红方底线, 列从左到右 a-i）：'];
    for (let r = 0; r < 10; r++) {
      const row = [];
      for (let c = 0; c < 9; c++) {
        const p = cg.B[r][c];
        if (p) row.push(String.fromCharCode(97 + c) + (10 - r) + ':' + (p.s === 'r' ? '红' : '黑') + DISP[p.s][p.t]);
      }
      lines.push(row.join(' '));
    }
    lines.push('轮到 ' + (cg.redTurn ? '红方(你)' : '黑方(AI)'));
    return lines.join('\n');
  }
  if (k === 'gomoku' && gk) {
    const lines = ['五子棋 15x15（列 a-o，行 1-15，行1在上）：'];
    for (let r = 0; r < 15; r++) {
      let s = '';
      for (let c = 0; c < 15; c++) s += gk.B[r][c] === 0 ? '.' : (gk.B[r][c] === 1 ? 'X' : 'O');
      lines.push((r + 1) + ' ' + s.split('').join(' '));
    }
    lines.push('X=黑(你) O=白(AI) 轮到 ' + (gk.player === 1 ? '黑(你)' : '白(AI)'));
    return lines.join('\n');
  }
  if (k === 'junqi' && jq) {
    const lines = ['军棋翻棋局面（10行x6列；"军棋"=未翻开的暗牌，其余为已翻明）：'];
    for (let r = 0; r < jq.R; r++) {
      const row = [];
      for (let c = 0; c < jq.C; c++) {
        const p = jq.cells[r][c];
        if (!p) row.push('空');
        else if (!jq.shown[r][c]) row.push('暗');
        else row.push((p.owner === 'r' ? '红' : '蓝') + FACE[p.kind]);
      }
      lines.push((r + 1) + ': ' + row.join(' '));
    }
    lines.push('轮到 ' + (jq.turnOwner() === 'r' ? '红方(你)' : '蓝方(AI)'));
    lines.push('等级: 司令>军长>师长>旅长>团长>营长>连长>排长>工兵；工兵可挖雷，炸弹与任何子同归，将对方军旗扛回即胜');
    return lines.join('\n');
  }
  return '';
}
function aiHint() { return document.getElementById('ai-hint'); }
async function aiCoach() {
  const cfg = getAICfg();
  if (!cfg.baseUrl || !cfg.model) { aiSettings(); return; }
  const box = aiHint();
  if (box) { box.style.display = 'block'; box.innerText = 'AI 教练思考中…'; }
  const btn = document.getElementById('ai-coach-btn');
  if (btn) { btn.disabled = true; btn.innerText = '🤖 思考中…'; }
  try {
    const resp = await fetch('/api/ai-hint', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ baseUrl: cfg.baseUrl, apiKey: cfg.apiKey, model: cfg.model, prompt: aiBoardDesc() }) });
    const j = await resp.json();
    if (box) box.innerText = '💡 AI 教练：' + (j.hint || ('出错了：' + j.error));
  } catch (e) {
    if (box) box.innerText = '💡 AI 教练连接失败：' + e.message;
  }
  if (btn) { btn.disabled = false; btn.innerText = '🤖 AI 教我走'; }
}

function toggleAuto() {
  const on = localStorage.getItem('fnos_ai_auto') !== '1';
  localStorage.setItem('fnos_ai_auto', on ? '1' : '0');
  updateAutoBtn();
  if (on) aiCoach(); else { const b = aiHint(); if (b) { b.style.display = 'none'; } }
}
function updateAutoBtn() {
  const on = localStorage.getItem('fnos_ai_auto') === '1';
  const b = document.getElementById('auto-btn');
  if (b) { b.innerText = on ? '☑ 每步自动提示' : '☰ 每步自动提示'; b.classList.toggle('primary', on); }
}
function autoCoachIfOn() {
  if (localStorage.getItem('fnos_ai_auto') === '1') { const cfg = getAICfg(); if (cfg.baseUrl && cfg.model) aiCoach(); }
}

window.__gameOver = false;   // 本局是否已结束（结束/认输/超时后不再拦截离开）
function gameResultPopup(won, title, detail) {
  window.__gameOver = true;
  if (window.clearAutoSnapshot) clearAutoSnapshot();
  if (window.clearAutoSaveRecord) clearAutoSaveRecord();
  let box = document.getElementById('result-modal');
  if (box) box.remove();
  box = document.createElement('div');
  box.id = 'result-modal';
  box.className = 'ai-box';
  box.innerHTML = `<div class="ai-inner" style="text-align:center">
    <div style="font-size:52px">${won ? '🏆' : '💔'}</div>
    <div style="font-size:22px;font-weight:bold;margin:6px 0">${title}</div>
    ${detail ? `<div style="color:#666;margin-bottom:10px">${detail}</div>` : ''}
    <div><button class="btn primary" onclick="gameRestart()">⟳ 再来一局</button>
    <button class="btn" onclick="document.getElementById('result-modal').remove()">关闭</button></div>
  </div>`;
  document.getElementById('view').prepend(box);
}

// —— 残局库 ——
const PUZZLES = {
  chess: [
    { name: '马后炮·绝杀', fen: '3将4/9/9/9/4傌4/9/4砲4/9/9/4帥4 moves:', tip: '红先：马后炮杀' },
    { name: '重炮·将',     fen: '3将4/9/9/9/9/9/4砲4/9/9/4帥4 moves:', tip: '红先：双炮重线' },
    { name: '双车胁士',    fen: '3将4/4士4/9/9/9/9/9/4俥4/4俥4/4帥4 moves:', tip: '红先：双车抢士' },
    { name: '海底捞月',    fen: '3将4/4士4/9/9/9/9/9/9/4砲4/4帥4 moves:', tip: '红先：炮打底士' },
    { name: '卧槽马',      fen: '9/9/9/9/9/9/9/9/4傌4/3K4 moves:', tip: '红先：马挂角杀' },
    { name: '铁门栓',      fen: '3ak4/9/4b4/9/9/9/4C4/9/9/4K4 moves:', tip: '红先：炮镇中路' },
    { name: '一马双将',    fen: '3k5/9/9/9/4a4/9/4H4/9/9/4K4 moves:', tip: '红先：马后炮位' },
    { name: '闷宫',        fen: '3k5/9/9/9/9/9/9/4C4/4C4/4K4 moves:', tip: '红先：双炮闷杀' },
  ],
  gomoku: [
    { name: '活三冲四·三步杀', seq: [[7,7],[7,8],[8,6],[8,9],[6,5],[6,9],[7,6]], tip: '黑先：连冲取胜' },
    { name: '四三杀', seq: [[7,7],[8,8],[7,6],[6,6],[7,8],[7,5],[7,9],[6,7]], tip: '黑先：四三胜' },
    { name: '双活三攻杀', seq: [[7,7],[7,8],[8,6],[8,9],[6,5],[9,6]], tip: '黑先：双三必胜' },
    { name: '长连禁手挑战', seq: [[7,7],[7,8],[7,6],[7,5],[7,4],[8,9]], tip: '黑先避开禁手取胜' },
    { name: '斜线冲刺', seq: [[7,7],[8,7],[6,6],[9,7],[5,5],[10,7]], tip: '黑先斜线连五' },
    { name: '四子僵局', seq: [[7,7],[8,8],[7,6],[6,6],[7,8],[8,6],[7,5],[6,7]], tip: '黑先破僵局' },
  ],
  junqi: [
    { name: '明棋·单兵突破', open: true, tip: '全明棋，红先吃旗' },
    { name: '明棋·雷区排雷', open: true, mineFirst: true, tip: '全明棋，先挖雷再突破' },
    { name: '明棋·炸弹阵', open: true, boomMode: true, tip: '全明棋，善用炸弹同归' },
  ]
};
var previewPz = null;
function showPuzzles() {
  let box = document.getElementById('pz-modal');
  if (box) box.remove();
  box = document.createElement('div');
  box.id = 'pz-modal'; box.className = 'ai-box';
  const list = (PUZZLES[currentRouteKey] || []).map((pz, i) =>
    `<div style="display:flex;gap:10px;align-items:center;padding:10px;border:1px solid #eee;border-radius:8px">
      <span style="flex:1"><b>${pz.name}</b><br><span style="color:#888;font-size:12px">${pz.tip}</span></span>
      <button class="btn" onclick="previewPuzzle(${i})">👁 预览</button>
      <button class="btn primary" onclick="playPuzzle(${i})">开始</button>
    </div>`).join('');
  box.innerHTML = `<div class="ai-inner" style="width:min(92vw, 440px)">
    <b>🎯 选择残局</b>
    <div style="max-height:50vh;overflow:auto;display:flex;flex-direction:column;gap:8px">${list || '<div style="color:#888">该游戏暂无残局</div>'}</div>
    <div id="pz-preview" class="ai-hintbox" style="display:none;max-height:40vh;overflow:auto"></div>
    <div><button class="btn" onclick="document.getElementById('pz-modal').remove()">关闭</button></div>
  </div>`;
  document.getElementById('view').prepend(box);
}
function previewPuzzle(i) {
  const pz = PUZZLES[currentRouteKey][i];
  if (!pz) return;
  previewPz = { index: i, pz };
  const pv = document.getElementById('pz-preview');
  if (!pv) return;
  pv.style.display = 'block';
  let html = '<b>👁 预览：' + pz.name + '</b><br><small style="color:#888">' + pz.tip + '</small><br><br>';
  html += '<div style="font-family:monospace;font-size:13px;line-height:1.5;background:#fafafa;border-radius:6px;padding:8px;white-space:pre-wrap">' + puzzleText(pz) + '</div>';
  pv.innerHTML = html;
}
function puzzleText(pz) {
  if (currentRouteKey === 'chess' && pz.fen) {
    // 展示棋盘字符画
    const rows = pz.fen.split(' ')[0].split('/');
    const names = { '将':'将','士':'士','相':'相','马':'马','马':'马','俥':'车','砲':'炮','兵':'兵','帥':'帅','仕':'士','象':'象','傌':'马','車':'车' };
    let out = '';
    rows.forEach(r => {
      let line = '';
      for (const ch of r) {
        if (/[0-9]/.test(ch)) { for (let i = 0; i < +ch; i++) line += '　'; }
        else line += ch + ' ';
      }
      out += line + '\n';
    });
    return out;
  }
  if (currentRouteKey === 'gomoku' && pz.seq) {
    const N = 15;
    const B = Array.from({ length: N }, () => Array(N).fill(0));
    let p = 1;
    (pz.seq || []).forEach(([r, c]) => { B[r][c] = p; p = p === 1 ? 2 : 1; });
    let out = '   ' + Array.from({length:N},(_,i)=>String.fromCharCode(97+i)).join('') + '\n';
    B.forEach((row, i) => out += String(i+1).padStart(2) + ' ' + row.map(v => v === 0 ? '.' : (v === 1 ? 'X' : 'O')).join('') + '\n');
    return out;
  }
  return pz.tip || '';
}
function playPuzzle(i) {
  const pz = PUZZLES[currentRouteKey][i];
  if (!pz) return;
  previewPz = null;
  const b = document.getElementById('pz-modal'); if (b) b.remove();
  if (currentRouteKey === 'chess' && window.loadChessPuzzle) window.loadChessPuzzle(pz);
  if (currentRouteKey === 'gomoku' && window.loadGomokuPuzzle) window.loadGomokuPuzzle(pz);
  if (currentRouteKey === 'junqi' && window.loadJunqiPuzzle) window.loadJunqiPuzzle(pz);
}
function loadPuzzle(i) { playPuzzle(i); }  // 兼容旧调用

var _rankAll = null;
function showRanks() {
  const key = curGameKey();
  fetch('/api/rank?game=' + encodeURIComponent(key)).then(r => r.json()).then(o => {
    _rankAll = { game: key, file: (o && o.file) || '', games: (o && o.games) || [] };
    renderRanks();
  }).catch(e => alert('读取战绩失败：' + e.message));
}
function renderRanks() {
  let box = document.getElementById('rank-modal');
  if (box) box.remove();
  box = document.createElement('div');
  box.id = 'rank-modal'; box.className = 'ai-box';
  const o = _rankAll || { games: [] };
  const names = { chess: '♟️ 象棋', gomoku: '⚫ 五子棋', junqi: '🚩 军棋' };
  const key = o.game || curGameKey();
  const list = (o.games || []).slice(0, 200);
  const wins = list.filter(x => x.result === 'win').length;
  const loses = list.filter(x => x.result === 'lose').length;
  let html = '<b>🏆 ' + (names[key] || '') + ' 战绩排行</b>';
  html += '<div style="color:#888;font-size:13px;margin-top:4px">本游戏战绩单独统计保存（共 ' + list.length + ' 局 · 胜 ' + wins + ' · 负 ' + loses + '），与其他游戏互不混合</div>';
  if (o.file) html += '<div style="font-size:12px;color:#888;margin-top:4px">数据文件：<code style="color:#1e6ef0">' + o.file + '</code></div>';
  html += '<div style="margin:8px 0"><button class="btn" style="padding:5px 11px;font-size:13px" onclick="exportRanks()">⬇ 导出 JSON</button></div>';
  html += '<div style="max-height:52vh;overflow:auto"><table><tr><th>时间</th><th>模式</th><th>结果</th><th>用时</th><th>手数</th></tr>';
  list.forEach(rec => {
    const d = new Date(rec.ts);
    const isl = (d.getMonth() + 1) + '-' + d.getDate() + ' ' + p2(d.getHours()) + ':' + p2(d.getMinutes());
    const icon = rec.result === 'win' ? '<span style="color:#2a7">胜</span>' : rec.result === 'lose' ? '<span style="color:#c33">负</span>' : '平';
    const durTxt = rec.durTxt || (typeof rec.dur === 'number' ? rec.dur + '秒' : (rec.dur || ''));
    html += '<tr><td style="white-space:nowrap">' + isl + '</td><td>' + (rec.mode || '') + '</td><td>' + icon + '</td><td>' + durTxt + '</td><td>' + (rec.steps != null ? rec.steps : '') + '</td></tr>';
  });
  if (!list.length) html += '<tr><td colspan="5" style="color:#888;padding:10px">本游戏还没有战绩，下完一局就会自动记录</td></tr>';
  html += '</table></div>';
  html += '<div style="margin-top:10px"><button class="btn" id="rank-close">关闭</button></div>';
  box.innerHTML = '<div class="ai-inner" style="width:min(96vw,600px)">' + html + '</div>';
  document.getElementById('view').prepend(box);
  bindRankClose();
}
function exportRanks() {
  try {
    const o = _rankAll || {};
    const key = o.game || curGameKey();
    const data = o.games || [];
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), game: key, games: data }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = key + '-ranks-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  } catch (e) { alert('导出失败：' + e.message); }
}
window.exportRanks = exportRanks;
window.showRanks = showRanks;

// rank-modal 关闭 Gary 绑定 fetch 结束后 addEventListener
function bindRankClose() { const b = document.getElementById('rank-close'); if (b) b.onclick = () => { const m = document.getElementById('rank-modal'); if (m) m.remove(); }; }

// —— 玩法说明（每个游戏自己的介绍，点「📖 玩法」查看） ——
const GAME_RULES = {
  chess: {
    name: '♟️ 象棋',
    intro: '红先黑后，轮流走子。把对方的「将/帅」将死（无处可逃）即胜；本方无棋可走（困毙）也判负。',
    sections: [
      ['怎么走子', [
        '车：直线任意格（不能翻山）',
        '马：走「日」字，被挡住马腿不能走',
        '相/象：走「田」字，塞象眼不能走，不能过河',
        '士/仕：九宫格内斜走一步',
        '将/帅：九宫格内直走一步，且双方不能「照面」',
        '炮：走直线，吃子必须隔一个子（翻山打）',
        '兵/卒：向前一步，过河后还能左右走'
      ]],
      ['操作方式', [
        '点自己的棋子 → 出现绿圈（可走位置）→ 再点要去的点',
        '吃子时会提示「吃子」，被将军会提示「将军！」',
        '「↩ 悔棋」撤回上一回合（人机模式一次撤你和 AI 各一步）'
      ]],
      ['可以玩什么', [
        '人机对战：难度可选 简单 / 普通 / 困难',
        '双人同屏：和旁边的人一台手机轮流走，不用联机',
        '残局挑战：点「🎯 残局」选一局，先看摆位再开始（如马后炮、重炮将杀）',
        '存档：随时点「💾 存档」保存，换设备/明天再来点「恢复」继续',
        'AI 教练：「🤖 AI 教我走」让 AI 给建议，「☰ 每步自动提示」每一步自动提示',
        '倒计时：可设 1~60 分钟，超时判负；「🏆 排行」看战绩与用时'
      ]]
    ]
  },
  gomoku: {
    name: '⚫ 五子棋',
    intro: '黑先白后，轮流在交叉点落子。谁先连成 5 子（横 / 竖 / 斜）谁胜。',
    sections: [
      ['怎么下', [
        '点棋盘交叉点落子，落子后不能移动、不能吃子',
        '你执黑先走，AI 执白',
        '连成 5 子（含 5 子以上）即胜，棋盘下满为平局'
      ]],
      ['操作方式', [
        '点交叉点即落子；最后落子会有红点标记',
        '「↩ 悔棋」撤回你和 AI 各一手；残局局面不会被撤掉'
      ]],
      ['可以玩什么', [
        '人机对战：简单（随手）/ 普通 / 困难（会堵你的活四、连四）',
        '双人同屏：两人轮流点，不用联机',
        '残局挑战：活三冲四、双四杀等预置局面，练杀法',
        '存档 / 排行 / 倒计时 / AI 教练 与象棋一致'
      ]]
    ]
  },
  junqi: {
    name: '🚩 军棋（陆战棋 · 翻棋）',
    intro: '开局双方 50 枚棋子全部背面朝上，随机布满兵站。轮流翻子或走子，翻到的颜色就是你的阵营（先翻者定色）。军旗被吃或对方无子可动即胜。',
    sections: [
      ['棋子大小（大吃小）', [
        '司令 > 军长 > 师长 > 旅长 > 团长 > 营长 > 连长 > 排长 > 工兵',
        '同等级相遇：同归于尽（双方都拿掉）',
        '地雷：不能移动；只有工兵能挖掉它，其他棋子碰上去会被炸掉',
        '炸弹：与任何棋子相遇都同归于尽',
        '军旗：被对方吃到即输（军棋不能移动）'
      ]],
      ['棋盘要点', [
        '行营（圆圈）：棋子进营后不可被吃（空营可以走进、也可以走出来）',
        '大本营（四角方框）：棋子进入后不能再移动',
        '铁路（双线）：工兵可沿铁路直行任意格，其他棋子一次走一步',
        '山界（中间横带）：只有两侧与中路三处可以通行',
        '斜线：只有行营与四角兵站之间可以斜走'
      ]],
      ['操作方式', [
        '点背面棋子 = 翻开（翻到红/蓝就归你）',
        '点自己的明棋 → 再点相邻目标格移动或吃子',
        '吃子失败会提示（你被吃或同归于尽）'
      ]],
      ['可以玩什么', [
        '人机对战：蓝方由 AI 行动（会吃子、会抢行营）',
        '双人同屏：两人轮流翻/走，一台手机',
        '残局挑战：明棋局面（单兵突破 / 雷区排雷 / 炸弹阵）',
        '存档 / 排行 / 倒计时 都支持，随时中断随时续'
      ]]
    ]
  }
};
function showRules() {
  const key = curGameKey();
  const r = GAME_RULES[key] || GAME_RULES.chess;
  let box = document.getElementById('rules-modal');
  if (box) box.remove();
  box = document.createElement('div');
  box.id = 'rules-modal'; box.className = 'ai-box';
  let html = '<b>' + r.name + ' · 玩法说明</b>';
  html += '<div style="color:#555;margin:8px 0;line-height:1.6">' + r.intro + '</div>';
  r.sections.forEach(([t, items]) => {
    html += '<div style="margin-top:10px"><b style="color:#1e6ef0">▎' + t + '</b><ul style="margin:6px 0 0 18px;padding:0;line-height:1.75;color:#333">';
    items.forEach(x => { html += '<li>' + x + '</li>'; });
    html += '</ul></div>';
  });
  html += '<div style="margin-top:14px"><a class="btn" href="/about.html" target="_blank" style="text-decoration:none;padding:7px 12px">📖 完整使用说明</a> '
       + '<button class="btn" onclick="document.getElementById(\'rules-modal\').remove()" style="padding:7px 12px">关闭</button></div>';
  box.innerHTML = '<div class="ai-inner" style="width:min(94vw,560px);max-height:82vh;overflow:auto">' + html + '</div>';
  document.getElementById('view').prepend(box);
}
window.showRules = showRules;

// —— 离开守卫：对局未结束就点其他链接/刷新/关页时提示 ——
function gameInProgress() {
  if (window.__gameOver) return false;
  const h = (window.GAMEHOOKS || {})[curGameKey()];
  if (!h) return false;
  let moved = false;
  try { moved = (typeof h.inProgress === 'function') ? !!h.inProgress() : false; } catch (e) {}
  if (moved) return true;
  // 尚未落子/翻子，但已是"计时对局"（设了倒计时并已在棋盘上待了一会儿）也算进行中
  try {
    const on = (typeof timerSetting === 'function') && timerSetting() > 0;
    const alive = (typeof h.started === 'function') ? !!h.started() : false;
    const dwell = Date.now() - (window.gameStartTs || Date.now());
    if (on && alive && dwell > 4000) return true;
  } catch (e) {}
  return false;
}
// —— 自动存档：对局进行中每 60 秒覆盖保存到服务端（防止丢局） ——
var _autoSaveTimer = null, _autoSaveLast = 0;
function autoSaveNow(force) {
  try {
    if (window.__gameOver) return false;
    const key = curGameKey();
    const h = (window.GAMEHOOKS || {})[key];
    if (!h || typeof h.serialize !== 'function') return false;
    if (!gameInProgress() && !force) return false;
    const sv = h.serialize();
    if (!sv) return false;
    sv.id = 'auto-' + key;
    sv.auto = true;
    sv.label = sv.label || key;
    sv.savedAt = Date.now();
    _autoSaveLast = Date.now();
    fetch('/api/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sv) })
      .then(r => r.json()).then(res => {
        if (res && res.ok) {
          const badge = document.getElementById('timer-badge');
          if (badge && !badge.dataset.auto) badge.dataset.auto = '1';
        }
      }).catch(() => {});
    return true;
  } catch (e) { return false; }
}
window.autoSaveNow = autoSaveNow;
function autoSaveTick() { if (gameInProgress()) autoSaveNow(); }
function startAutoSave() {
  if (_autoSaveTimer) return;
  _autoSaveTimer = setInterval(autoSaveTick, 60000);   // 每 1 分钟
  // 切到后台/离开页面前也补一次
  document.addEventListener('visibilitychange', function () { if (document.hidden) autoSaveNow(); });
  window.addEventListener('pagehide', function () { autoSaveNow(); });
}
window.startAutoSave = startAutoSave;
function clearAutoSaveRecord(key) {
  const g = key || curGameKey();
  try { fetch('/api/save?game=' + encodeURIComponent(g) + '&id=' + encodeURIComponent('auto-' + g), { method: 'DELETE' }); } catch (e) {}
}
window.clearAutoSaveRecord = clearAutoSaveRecord;

// —— 局中自动快照：刷新/误关都不丢局（开局时询问是否继续） ——
function autoSnapshot() {
  try {
    const key = curGameKey();
    const h = (window.GAMEHOOKS || {})[key];
    if (!h || typeof h.serialize !== 'function') return;
    if (window.__gameOver) { localStorage.removeItem('fnos_resume_' + key); return; }
    const sv = h.serialize();
    if (!sv) return;
    const steps = sv.steps || 0;
    const timerOn = (typeof timerSetting === 'function') && timerSetting() > 0;
    if (steps > 0 || timerOn) { sv.savedAt = Date.now(); localStorage.setItem('fnos_resume_' + key, JSON.stringify(sv)); }
  } catch (e) {}
}
window.autoSnapshot = autoSnapshot;
function clearAutoSnapshot(key) { try { localStorage.removeItem('fnos_resume_' + (key || curGameKey())); } catch (e) {} }
window.clearAutoSnapshot = clearAutoSnapshot;
function checkAutoResume(key) {
  let raw = null;
  try { raw = localStorage.getItem('fnos_resume_' + key); } catch (e) {}
  if (!raw) return false;
  let sv = null;
  try { sv = JSON.parse(raw); } catch (e) { clearAutoSnapshot(key); return false; }
  if (!sv || !sv.steps && !sv.timer) { clearAutoSnapshot(key); return false; }
  setTimeout(function () {
    const ok = window.confirm('检测到上一局『' + (sv.label || '') + '』还没下完（' + (sv.steps || 0) + ' 手/子，'
      + new Date(sv.savedAt || Date.now()).toLocaleString() + '）\n\n点「确定」继续这一局，点「取消」重新开一局。');
    const h = (window.GAMEHOOKS || {})[key];
    if (ok && h && typeof h.restore === 'function') { h.restore(sv); }
    else clearAutoSnapshot(key);
  }, 120);
  return true;
}
window.checkAutoResume = checkAutoResume;

var _leaveGuardBound = false;
function bindLeaveGuard() {
  if (_leaveGuardBound) return;
  _leaveGuardBound = true;
  // 1) 点击链接（导航 / 返回 / 外链）
  document.addEventListener('click', function (ev) {
    let a = ev.target;
    while (a && a !== document && !(a.tagName === 'A' && a.getAttribute('href'))) a = a.parentNode;
    if (!a || a === document) return;
    const href = a.getAttribute('href') || '';
    if (!href || href.charAt(0) === '#' && (href === '#' || href === location.hash)) return;
    if (/^(javascript:|mailto:|tel:)/i.test(href)) return;
    // 新窗口/新标签打开、下载类链接：不会离开当前对局，不拦截
    const target = (a.getAttribute('target') || '').toLowerCase();
    if (target && target !== '_self') return;
    if (a.hasAttribute('download')) return;
    if (!gameInProgress()) return;
    if (!window.confirm('当前棋局还没结束，确定要离开吗？\n\n提示：可以先点上面的「存档」把进度存下来，下次在「恢复」里继续（游戏每分钟也会自动存档一次）。')) {
      ev.preventDefault(); ev.stopPropagation();
    }
  }, true);
  // 2) 刷新/关闭（浏览器原生提示）
  window.addEventListener('beforeunload', function (e) {
    if (!gameInProgress()) return;
    e.preventDefault();
    e.returnValue = '当前棋局还没结束，确定离开吗？';
    return e.returnValue;
  });
  // 3) 键盘刷新：F5 / Ctrl+R / Cmd+R（部分浏览器不弹原生提示，这里自己拦）
  window.addEventListener('keydown', function (e) {
    const k = (e.key || '').toLowerCase();
    const isReload = k === 'f5' || ((e.ctrlKey || e.metaKey) && k === 'r');
    if (!isReload) return;
    if (!gameInProgress()) return;
    if (!window.confirm('当前棋局还没结束，确定要刷新吗？\n\n（刷新后进入游戏时会问你要不要继续这一局）')) {
      e.preventDefault(); e.stopPropagation();
    }
  }, true);
}
window.gameInProgress = gameInProgress; window.bindLeaveGuard = bindLeaveGuard;

// —— 存档系统（服务端 data/saves.json，日期时间标识，可恢复继续） ——
var _savesCache = [];
var _spMsg = '';
function p2(n) { return String(n).padStart(2, '0'); }
function fmtDT(ts) {
  const d = new Date(ts);
  return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()) + ' ' + p2(d.getHours()) + ':' + p2(d.getMinutes()) + ':' + p2(d.getSeconds());
}
function curGameKey() { const h = (location.hash || '').replace('#/', ''); return h.replace('-solo', '') || 'lobby'; }
function curGameSelects() {
  const d = document.getElementById('diff'), t = document.getElementById('timer');
  return { diff: d ? d.value : 'normal', timer: t ? t.value : '0' };
}
function gameSaveNow() {
  const h = (window.GAMEHOOKS || {})[curGameKey()];
  if (!h || typeof h.serialize !== 'function') { alert('当前页面暂不支持存档'); return; }
  let sv;
  try { sv = h.serialize(); } catch (e) { alert('存档失败：' + e.message); return; }
  if (!sv) { alert('暂无可存档的棋局'); return; }
  const sel = curGameSelects();
  sv.diff = sv.diff || sel.diff; sv.timer = sv.timer != null ? sv.timer : sel.timer;
  sv.savedAt = Date.now();
  fetch('/api/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sv) })
    .then(r => r.json()).then(res => {
      if (res && res.ok) {
        const st = document.getElementById('status-text');
        if (st) st.innerText = '💾 已存档：' + fmtDT(res.ts) + '（点「💾 存档」可恢复）';
        showSaves();
      } else alert('存档失败：' + ((res && res.error) || '未知错误'));
    }).catch(e => alert('存档失败：' + e.message));
}
window.gameSaveNow = gameSaveNow;
var _saveMeta = { game: '', file: '', dir: '' };
function showSaves() {
  const g = curGameKey();
  fetch('/api/save?game=' + encodeURIComponent(g)).then(r => r.json()).then(o => {
    _savesCache = (o && o.saves) || [];
    _saveMeta = { game: g, file: (o && o.file) || '', dir: '' };
    renderSaves();
  }).catch(e => alert('读取存档失败：' + e.message));
}
window.showSaves = showSaves;
function renderSaves() {
  let box = document.getElementById('save-modal');
  if (box) box.remove();
  box = document.createElement('div');
  box.id = 'save-modal'; box.className = 'ai-box';
  const names = { chess: '♟️ 象棋', gomoku: '⚫ 五子棋', junqi: '🚩 军棋' };
  const cur = curGameKey();
  let html = '<b>💾 ' + (names[cur] || '') + ' 存档</b><br><small style="color:#888">各游戏存档独立存放，以「日期 + 时间」标识，点「恢复」即可接着下</small>';
  if (_saveMeta.file) html += '<div style="font-size:12px;color:#888;margin-top:4px">本游戏存档文件：<code style="color:#1e6ef0">' + _saveMeta.file + '</code></div>';
  html += '<div style="margin:8px 0"><button class="btn" onclick="gameSaveNow()" style="padding:8px 14px">💾 保存当前进度</button>'
       + ' <button class="btn" onclick="toggleSavePath()" style="padding:8px 12px">⚙ 存档路径</button></div>';
  html += '<div id="save-path-box" style="display:none;background:#f7f9fc;border:1px solid #dde5f0;border-radius:8px;padding:10px;margin-bottom:8px">'
       + '<div style="font-size:13px;color:#555">存档目录：<code id="sp-cur" style="color:#1e6ef0">…</code></div>'
       + '<div id="sp-files" style="font-size:12px;color:#888;margin-top:4px">各游戏独立文件：chess-saves.json / gomoku-saves.json / junqi-saves.json</div>'
       + '<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;align-items:center">'
       + '<input id="sp-dir" placeholder="/app/data/saves" style="flex:1 1 200px;min-width:160px;padding:6px 8px;border:1px solid #cfd8e3;border-radius:6px;font-size:13px">'
       + '<button class="btn" onclick="applySaveDir()" style="padding:6px 12px">保存目录</button>'
       + '<button class="btn" onclick="savePathPreset(\'/app/data/saves\')" style="padding:6px 10px">默认</button>'
       + '<button class="btn" onclick="savePathPreset(\'/app/data/saves/backup\')" style="padding:6px 10px">备份目录</button>'
       + '</div>'
       + '<div id="sp-tip" style="font-size:12px;color:#888;margin-top:6px">容器内 /app 目录已挂载到主机 /vol1/1000/HD1/docker/fnos-games/data；每个游戏各写一个文件，互不混淆</div>'
       + '<div id="sp-browse" style="margin-top:8px;font-size:12px"></div></div>';
  if (!_savesCache.length) {
    html += '<div style="color:#888;padding:10px 0">本游戏还没有存档</div>';
  } else {
    html += '<div style="max-height:52vh;overflow:auto"><table><tr><th>存档时间</th><th>游戏</th><th>模式</th><th>难度</th><th>进度</th><th>操作</th></tr>';
    _savesCache.forEach(rec => {
      const mine = rec.game === cur;
      const diffTxt = ({ easy: '简单', normal: '普通', hard: '困难' })[rec.diff] || rec.diff || '';
      const prog = rec.game === 'chess' ? (rec.steps || 0) + ' 手'
                 : rec.game === 'gomoku' ? (rec.steps || 0) + ' 子'
                 : (rec.steps || 0) + ' 步';
      const isAuto = !!rec.auto || String(rec.id || '').indexOf('auto-') === 0;
      html += '<tr' + (isAuto ? ' style="background:#fff8e6"' : (mine ? ' style="background:#f2f7ff"' : '')) + '>'
        + '<td style="white-space:nowrap">' + fmtDT(rec.ts) + (isAuto ? ' <span style="color:#b8860b">⏱ 自动</span>' : '') + '</td>'
        + '<td>' + (names[rec.game] || rec.game) + '</td>'
        + '<td>' + (rec.mode || '') + '</td>'
        + '<td>' + diffTxt + '</td>'
        + '<td>' + prog + '</td>'
        + '<td style="white-space:nowrap">'
        + '<button class="btn" style="padding:4px 9px;font-size:12px" onclick="restoreSave(\'' + rec.id + '\')">恢复</button> '
        + '<button class="btn" style="padding:4px 9px;font-size:12px" onclick="deleteSave(\'' + rec.id + '\')">删除</button>'
        + '</td></tr>';
    });
    html += '</table></div>';
  }
  html += '<div style="margin-top:10px"><button class="btn" id="save-close">关闭</button></div>';
  box.innerHTML = '<div class="ai-inner" style="width:min(96vw,640px)">' + html + '</div>';
  document.getElementById('view').prepend(box);
  const cb = document.getElementById('save-close');
  if (cb) cb.onclick = () => { const m = document.getElementById('save-modal'); if (m) m.remove(); };
  if (_spMsg) {   // 路径设置成功后的提示与面板保持打开
    const tip = document.getElementById('sp-tip');
    if (tip) tip.innerHTML = '<b style="color:#2a7">✅ ' + _spMsg + '</b>';
    const b = document.getElementById('save-path-box');
    if (b) b.style.display = 'block';
    loadSavePathUI();
    _spMsg = '';
  }
}
// —— 存档路径设置 ——
function toggleSavePath() {
  const b = document.getElementById('save-path-box');
  if (!b) return;
  b.style.display = (b.style.display === 'none' || !b.style.display) ? 'block' : 'none';
  if (b.style.display === 'block') loadSavePathUI();
}
function loadSavePathUI(dir) {
  fetch('/api/config').then(r => r.json()).then(cfg => {
    const cur = document.getElementById('sp-cur');
    if (cur) cur.innerText = (cfg && cfg.saveDir) || '(未设置)';
    const dEl = document.getElementById('sp-dir');
    if (dEl && !dir) dEl.value = (cfg && cfg.saveDir) || '/app/data/saves';
    if (dir && dEl) dEl.value = dir;
    const fs2 = document.getElementById('sp-files');
    if (fs2 && cfg && cfg.files) fs2.innerHTML = '各游戏独立文件：' + cfg.files.map(f => f.file.split('/').pop() + '（' + f.count + ' 条）').join(' · ');
    browseSaveDir(dir || (dEl ? dEl.value : '/app/data/saves'));
  }).catch(e => alert('读取存档设置失败：' + e.message));
}
function browseSaveDir(dir) {
  fetch('/api/fs?dir=' + encodeURIComponent(dir)).then(r => r.json()).then(o => {
    const box = document.getElementById('sp-browse');
    if (!box) return;
    const de = document.getElementById('sp-dir');
    if (de && o.dir) de.value = o.dir;
    let h = '<div style="color:#888;margin-bottom:4px">目录：' + (o.dir || '') + ' ' +
      '<a href="javascript:void(0)" onclick="browseSaveDir(\'' + (o.parent || '/app') + '\')" style="color:#1e6ef0">↑ 上级</a>' +
      (o.error ? ' <span style="color:#c33">（' + o.error + '）</span>' : '') + '</div>';
    if ((o.dirs || []).length) h += '<div>子目录：' + o.dirs.map(x => '<a href="javascript:void(0)" onclick="browseSaveDir(\'' + (o.dir + '/' + x) + '\')" style="margin-right:8px;color:#1e6ef0">📁 ' + x + '</a>').join('') + '</div>';
    if ((o.files || []).length) h += '<div style="margin-top:4px">此目录存档文件：' + o.files.map(x => '<span style="margin-right:8px;color:#555">📄 ' + x + '</span>').join('') + '</div>';
    box.innerHTML = h;
  }).catch(e => {});
}
function savePathPreset(dir) { const de = document.getElementById('sp-dir'); if (de) de.value = dir; browseSaveDir(dir); }
function applySaveDir() {
  const dEl = document.getElementById('sp-dir');
  const dir = (dEl ? dEl.value : '').trim().replace(/\/+$/, '');
  if (!dir) { alert('请填写存档目录'); return; }
  fetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ saveDir: dir, migrate: true }) })
    .then(r => r.json()).then(res => {
      if (!res || !res.ok) { alert('设置失败：' + ((res && res.error) || '未知错误')); return; }
      const cnt = res.counts || {};
      _spMsg = '存档目录已改为 ' + res.saveDir + '，旧目录存档已迁移（象棋 ' + (cnt.chess || 0) + ' 条 · 五子棋 ' + (cnt.gomoku || 0) + ' 条 · 军棋 ' + (cnt.junqi || 0) + ' 条）';
      _savesCache = []; showSaves();
    }).catch(e => alert('设置失败：' + e.message));
}
window.toggleSavePath = toggleSavePath; window.applySaveDir = applySaveDir;
window.savePathPreset = savePathPreset; window.browseSaveDir = browseSaveDir;
window.loadSavePathUI = loadSavePathUI; window.showSaves = showSaves;

function closeSaveModal() { const m = document.getElementById('save-modal'); if (m) m.remove(); }
function restoreSave(id) {
  const rec = _savesCache.find(x => x.id === id);
  if (!rec) { alert('存档已不存在'); return; }
  closeSaveModal();
  const h = (window.GAMEHOOKS || {})[rec.game];
  if (rec.game === curGameKey() && h && typeof h.restore === 'function') {
    const ok = h.restore(rec);
    if (!ok) alert('恢复失败');
    return;
  }
  try { sessionStorage.setItem('fnos_pending_restore', JSON.stringify(rec)); } catch (e) {}
  location.hash = '#/' + rec.game + '-solo';
}
window.restoreSave = restoreSave;
function deleteSave(id) {
  fetch('/api/save?game=' + encodeURIComponent(curGameKey()) + '&id=' + encodeURIComponent(id), { method: 'DELETE' })
    .then(r => r.json()).then(() => { _savesCache = _savesCache.filter(x => x.id !== id); renderSaves(); })
    .catch(e => alert('删除失败：' + e.message));
}
window.deleteSave = deleteSave;
/** 各游戏 boot 末尾调用：若刚从别的游戏跳来恢复存档，则自动载入 */
function checkPendingRestore(key) {
  let raw = null;
  try { raw = sessionStorage.getItem('fnos_pending_restore'); } catch (e) {}
  if (!raw) return false;
  try { sessionStorage.removeItem('fnos_pending_restore'); } catch (e) {}
  let rec = null;
  try { rec = JSON.parse(raw); } catch (e) { return false; }
  if (!rec || rec.game !== key) return false;
  setTimeout(() => {
    try {
      const h = (window.GAMEHOOKS || {})[rec.game];
      if (h && typeof h.restore === 'function') h.restore(rec);
    } catch (e) {}
  }, 40);
  return true;
}
window.checkPendingRestore = checkPendingRestore;

// —— 倒计时系统 ——
var timerTotal = 1200, timerLeft = 1200, timerSide = 'r', timerHalted = true, timerInterval = null;
function timerSetting() { const el = document.getElementById('timer'); return el ? +el.value : 0; }
function applyTimer() {
  timerTotal = timerSetting();
  resetTimer('r');
}
function resetTimer(side) {
  clearInterval(timerInterval);
  timerSide = side; timerLeft = timerTotal;
  updateTimerUI();
  if (timerTotal > 0) {
    timerHalted = false;
    timerInterval = setInterval(tickTimer, 1000);
  } else timerHalted = true;
}
function haltTimer() { timerHalted = true; clearInterval(timerInterval); updateTimerUI(); }
function swapTimer() {
  if (timerTotal <= 0) return;
  timerSide = timerSide === 'r' ? 'b' : 'r';
  timerLeft = timerTotal;
  updateTimerUI();
}
function tickTimer() {
  if (timerHalted) return;
  timerLeft--;
  updateTimerUI();
  if (timerLeft <= 0) {
    clearInterval(timerInterval);
    onTimeout();
  }
}
function updateTimerUI() {
  const el = document.getElementById('timer-badge');
  if (!el) return;
  const m = Math.floor(Math.max(0,timerLeft) / 60), s2 = Math.max(0,timerLeft) % 60;
  if (timerTotal <= 0) { el.innerText = ''; return; }
  const who = (localStorage.getItem('fnos_mode') === '2p') ? (timerSide === 'r' ? '（红方）' : (currentRouteKey === 'gomoku' ? '（白棋）' : '（蓝方）')) : '（你）';
  const danger = timerLeft <= 10 ? 'color:#ff4d4d;font-weight:bold' : '';
  el.innerHTML = ' <span style="' + danger + '">⏱ ' + m + ':' + String(s2).padStart(2,'0') + who + '</span>';
}
/** 超时回调 — 各游戏挂 window.onGameTimeout */
function onTimeout() {
  haltTimer();
  if (localStorage.getItem('fnos_mode') === '2p') {
    const loser = timerSide === 'r' ? '红方' : '蓝/黑方';
    recordGame({ game: currentRouteKey, result: timerSide === 'r' ? 'lose' : 'win', durTxt: '超时', steps: 0 });
    gameResultPopup(false, '⏰ 超时判负', loser + '超时，游戏结束');
  } else {
    recordGame({ game: currentRouteKey, result: 'lose', durTxt: '超时', steps: 0 });
    gameResultPopup(false, '⏰ 超时判负', '你超时了（' + Math.floor(timerTotal/60) + '分钟已用完）');
  }
}
function timerBadge() {
  if (timerTotal <= 0 || timerHalted) return '';
  const m = Math.floor(timerLeft / 60), s2 = timerLeft % 60;
  const who = (localStorage.getItem('fnos_mode') === '2p') ? (timerSide === 'r' ? '（红方）' : (currentRouteKey === 'gomoku' ? '（白棋）' : '（蓝方）')) : '（你）';
  return ' ⏱ ' + m + ':' + String(s2).padStart(2,'0') + who;
}
// statusline 文本包装：setStatus 时附带时间
// (timer badge 是独立 span, 不需 wrap)
