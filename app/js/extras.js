/* ==============================================================================
   摸鱼棋乐 · 扩展功能包（extras.js）
   ──────────────────────────────────────────────────────────────────────────────
   8 项功能，全部「本地能用」为底线，接入大模型后自动增强：
     1) 📉 实时"这步亏了"提示 —— 本地引擎算分（象棋 α-β / 五子棋威胁分 / 军棋风险）
     2) 📅 每日一题 + 🧩 AI 出新残局 —— 本地题库兜底；AI 出的局面必须通过本地校验
     3) 📊 棋风画像与弱点报告 —— 本地统计；可选 AI 润色成报告
     4) 🪄 自适应难度陪练 —— 纯本地（三连败降档 / 三连胜升档）
     5) 🖼 战绩分享海报 —— Canvas 本机生成，零依赖
     6) 🔍 军棋记牌推理 —— 纯本地推算剩余暗牌子力
     7) 💬 对手嘴炮 —— 本地金句库兜底；有模型时由模型生成
     8) 📖 开局库讲解 —— 本地开局库；可选 AI 再讲解
   没有填模型：以上 1/2(本地题库)/3(本地统计)/4/5/6/7(本地金句)/8 全部可用。
   ============================================================================ */
(function () {
  'use strict';
  const EX = {};
  window.EXTRAS = EX;

  /* ---------------------------------------------------------------- 存储 / 小工具 */
  const LS = {
    get(k, d) { try { const v = localStorage.getItem('fnos_x_' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('fnos_x_' + k, JSON.stringify(v)); } catch (e) { } }
  };
  const CN = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
  const SIMP = { r: { '将': '帅', '士': '仕', '相': '相', '马': '马', '车': '车', '炮': '炮', '兵': '兵' },
                 b: { '将': '将', '士': '士', '相': '象', '马': '马', '车': '车', '炮': '炮', '兵': '卒' } };
  const CN_NUM = { 1: '1', 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9' };
  EX.on = LS.get('on', { step: true, auto: false, taunt: false });
  function saveOn() { LS.set('on', EX.on); }

  function el(id) { return document.getElementById(id); }
  function curKey() { return (typeof curGameKey === 'function') ? curGameKey() : ((location.hash || '').replace('#/', '').replace('-solo', '') || 'lobby'); }
  function aicfg() { return (typeof getAICfg === 'function') ? (getAICfg() || {}) : {}; }
  function hasModel() { const c = aicfg(); return !!(c.baseUrl && c.model); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m])); }

  function toast(msg, ms) {
    let t = el('ex-toast');
    if (!t) { t = document.createElement('div'); t.id = 'ex-toast';
      t.style.cssText = 'position:fixed;left:50%;bottom:26px;transform:translateX(-50%);background:rgba(30,34,45,.94);color:#fff;padding:10px 18px;border-radius:22px;font-size:14px;z-index:99999;max-width:88vw;text-align:center;box-shadow:0 6px 22px rgba(0,0,0,.28)';
      document.body.appendChild(t); }
    t.textContent = msg; t.style.display = 'block';
    clearTimeout(t._h); t._h = setTimeout(() => { t.style.display = 'none'; }, ms || 2600);
  }
  EX.toast = toast;

  function modal(title, html, opts) {
    const old = el('ex-modal'); if (old) old.remove();
    opts = opts || {};
    const d = document.createElement('div');
    d.id = 'ex-modal'; d.className = 'ai-box';
    d.innerHTML = '<div class="ai-inner" style="text-align:left;max-width:700px">'
      + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">'
      + '<h3 style="margin:0;font-size:18px">' + title + '</h3><span style="flex:1"></span>'
      + (opts.extraBtn ? opts.extraBtn : '')
      + '<button class="btn" style="padding:6px 12px" onclick="document.getElementById(\'ex-modal\').remove()">关闭</button></div>'
      + '<div id="ex-body" style="font-size:14px;line-height:1.85;color:#333;max-height:66vh;overflow:auto">' + html + '</div></div>';
    const hosts = ['view', 'app'].map(el).filter(Boolean);
    (hosts[0] || document.body).prepend(d);
    return d;
  }
  EX.modal = modal;

  /* ============================================================================
     1) 实时"这步亏了"提示
     ========================================================================== */
  let preEval = null, preBest = null, preGom = null, lastJqMove = null;

  /** 把引擎走法翻成"人话"：左起第2列的炮往前3格 / 吃掉对方的马 */
  function moveCN(g, m) {
    if (!g || !m) return '';
    const p = g.B[m[0]][m[1]]; if (!p) return '';
    const name = (SIMP[p.s] || {})[p.t] || p.t;
    const cap = g.B[m[2]][m[3]];
    const dcol = m[3] - m[1], drow = m[2] - m[0];
    const fwd = p.s === 'r' ? -drow : drow;              // 正数=向对方前进
    const where = (m[1] === 0 ? '最左列' : m[1] === 8 ? '最右列' : m[1] === 4 ? '中路' : '左起第' + CN_NUM[m[1] + 1] + '列');
    const from = '在' + where + (p.s === 'r' ? '、从红方底线往上第' + (10 - m[0]) + '行' : '、从黑方底线往下第' + (m[0] + 1) + '行');
    let act;
    if (dcol === 0) act = fwd > 0 ? '往前（向' + (p.s === 'r' ? '黑方' : '红方') + '）走' + Math.abs(fwd) + '格' : '往后退' + Math.abs(fwd) + '格';
    else if (drow === 0) act = '往' + (dcol > 0 ? '右' : '左') + '走' + Math.abs(dcol) + '格';
    else act = '斜着走到' + (m[2] === 0 ? '最上面一行' : m[2] === 9 ? '最下面一行' : '第' + (p.s === 'r' ? (10 - m[2]) + '行' : (m[2] + 1) + '行'));
    return name + from + '，' + act + (cap ? '，吃掉对方的' + ((SIMP[cap.s] || {})[cap.t] || cap.t) : '');
  }
  EX.moveCN = moveCN;

  /** 玩家落子前调用：记下"最优下法"与当时的分值 */
  EX.markPre = function (key) {
    preEval = preBest = preGom = lastJqMove = null;
    try {
      if (key === 'chess' && typeof cg !== 'undefined' && cg && typeof aiMove === 'function') {
        const r = aiMove(cg, { side: 'r', depth: 2 });
        if (r) { preEval = r.score; preBest = r.move; }
      } else if (key === 'gomoku' && typeof gk !== 'undefined' && gk) {
        preGom = gomokuBestFor(gk, 1);
      } else if (key === 'junqi' && typeof jq !== 'undefined' && jq) {
        lastJqMove = true;
      }
    } catch (e) { preEval = null; preBest = null; preGom = null; }
  };

  function gomokuBestFor(g, me) {
    const opp = me === 1 ? 2 : 1;
    let best = null;
    for (let r = 0; r < g.N; r++) for (let c = 0; c < g.N; c++) {
      if (g.B[r][c] !== 0) continue;
      if (g.seq.length > 0 && !nearStone(g, r, c, 2)) continue;
      const sc = scorePoint(g, r, c, me) * 1.1 + scorePoint(g, r, c, opp);
      if (!best || sc > best.sc) best = { r, c, sc, own: scorePoint(g, r, c, me) };
    }
    return best;
  }
  function nearStone(g, r, c) {
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
      const rr = r + dr, cc = c + dc;
      if (rr >= 0 && rr < g.N && cc >= 0 && cc < g.N && g.B[rr][cc] !== 0) return true;
    }
    return false;
  }
  function gomokuThreat(g, me) {          // 对方（me）目前在某个空点能拿到的最高分
    let best = 0, at = null;
    for (let r = 0; r < g.N; r++) for (let c = 0; c < g.N; c++) {
      if (g.B[r][c] !== 0) continue;
      if (!nearStone(g, r, c)) continue;
      const sc = scorePoint(g, r, c, me);
      if (sc > best) { best = sc; at = { r, c }; }
    }
    return { score: best, at };
  }

  /** 玩家落子后调用：给出"这步亏了吗"的本地点评 */
  EX.stepReview = function (key) {
    try {
      if (!EX.on.step) return;
      let msg = null, kind = 'warn';
      if (key === 'chess' && typeof cg !== 'undefined' && cg && typeof aiMove === 'function') {
        if (preEval == null) return;
        const me = cg.redTurn ? 'b' : 'r';               // 玩家刚走完，轮到对手
        const r = aiMove(cg, { side: me, depth: 2 });
        const post = r ? -r.score : preEval;
        const loss = preEval - post;
        if (loss >= 120) {
          const unit = loss >= 700 ? '≈ 一个车' : loss >= 300 ? '≈ 一个马或炮' : '≈ 一个兵';
          msg = '⚠️ 这步亏了约 ' + Math.round(loss) + ' 分（' + unit + '）';
          if (preBest) msg += '。更好的下法：' + moveCN(cg, preBest);
        } else if (loss <= -80) {
          kind = 'good'; msg = '👍 好棋！这步比引擎的首选还强 ' + Math.round(-loss) + ' 分';
        }
      } else if (key === 'gomoku' && typeof gk !== 'undefined' && gk && typeof scorePoint === 'function') {
        const opp = { score: 0, at: null };
        const t = gomokuThreat(gk, 2);
        opp.score = t.score; opp.at = t.at;
        if (opp.score >= 1000000) { msg = '💀 对方下一步就能连成五子，必须马上堵！'; }
        else if (opp.score >= 20000) { msg = '⚠️ 没堵住：对方下一步能做成"活四"（两头都空），下一手基本必输'; }
        else if (opp.score >= 15000) { msg = '⚠️ 对方形成了"冲四"，必须立刻堵住'; }
        else if (preGom && preGom.own >= 1200 && opp.at && preGom.own > 0) {
          const playedOwn = 0;   // 手数有限，只在明显时提示
          if (preGom.own >= 1200 && opp.score < 1200) {
            msg = '💡 更好的一手在 第' + (preGom.r + 1) + '行第' + (preGom.c + 1) + '列，那里你能做成活三以上';
          }
        }
      } else if (key === 'junqi' && typeof jq !== 'undefined' && jq) {
        msg = junqiRisk();
      }
      const box = ensureStepBox();
      if (!msg) { if (box) box.style.display = 'none'; return; }
      if (box) {
        box.style.display = 'block';
        box.style.background = kind === 'good' ? '#f0fbf3' : '#fff7ed';
        box.style.borderColor = kind === 'good' ? '#bfe7cc' : '#f6d9b0';
        box.style.color = kind === 'good' ? '#1e7a45' : '#a35a13';
        box.innerHTML = msg;
      }
    } catch (e) { }
  };

  function ensureStepBox() {
    let b = el('step-hint');
    if (b) return b;
    const host = el('view');
    if (!host) return null;
    b = document.createElement('div');
    b.id = 'step-hint';
    b.style.cssText = 'display:none;margin:10px auto;max-width:820px;padding:9px 13px;border:1px solid #f6d9b0;border-radius:9px;font-size:14px;line-height:1.65;background:#fff7ed';
    host.prepend(b);
    return b;
  }

  /** 军棋：刚走完的棋子是否暴露在敌方已翻开的强子火力下 */
  function jqCouldReach(fr, fc, tr, tc, kind, j) {
    if (!j.inB(tr, tc)) return false;
    const dr = tr - fr, dc = tc - fc;
    if (dr === 0 && dc === 0) return false;
    const straight = (dr === 0 || dc === 0);
    if (straight) {
      const dist = Math.abs(dr) + Math.abs(dc);
      const onRail = (fr === tr && RAIL_ROWS.indexOf(fr) >= 0) || (fc === tc && RAIL_COLS.indexOf(fc) >= 0);
      const maxStep = (kind === 's1' && onRail) ? 99 : 1;
      if (dist > maxStep) return false;
      if (Math.abs(dr) === 1 && fc === tc && ((fr === 5 && tr === 6) || (fr === 6 && tr === 5)) && FRONT_COLS.indexOf(fc) < 0) return false;
      if (dist > 1) {
        if (dr === 0) { for (let c2 = Math.min(fc, tc) + 1; c2 < Math.max(fc, tc); c2++) if (j.cells[fr][c2]) return false; }
        else { for (let r2 = Math.min(fr, tr) + 1; r2 < Math.max(fr, tr); r2++) if (j.cells[r2][fc]) return false; }
      }
      return true;
    }
    if (Math.abs(dr) === 1 && Math.abs(dc) === 1) return j.isCamp(fr, fc) || j.isCamp(tr, tc);
    return false;
  }
  function junqiRisk() {
    try {
      const h = jq._hist[jq._hist.length - 1];
      if (!h || h.type !== 'move' || !h.tr) return null;
      const target = h.tr, targetC = h.tc;
      const mine = jq.cells[target] ? jq.cells[target] : h.fp;
      if (!mine) return null;
      const myKind = mine.kind, myFace = (window.FACE || {})[myKind] || KIND_LBL[myKind] || myKind;
      const threats = [];
      for (let r = 0; r < jq.R; r++) for (let c = 0; c < jq.C; c++) {
        const p = jq.cells[r][c];
        if (!p || !jq.shown[r][c] || p.owner !== 'b' || r === target && c === targetC) continue;
        if (p.kind === 'lei' || p.kind === 'jq') continue;
        if (!jqCouldReach(r, c, target, targetC, p.kind, jq)) continue;
        const res = jq.battle(p.kind, myKind);
        if (res === 'win' || res === 'both') threats.push(KIND_LBL[p.kind] || p.kind);
      }
      if (!threats.length) return null;
      const inCamp = jq.isCamp(target, targetC);
      return '⚠️ 风险提示：旁边已翻开的【' + threats.slice(0, 3).join('、') + '】下一手能打到你的【' + myFace + '】'
        + (inCamp ? '（你在行营里，行营内的子不会被吃，安全）' : '，考虑退到行营或让别的子顶上');
    } catch (e) { return null; }
  }

  /* ============================================================================
     2) 每日一题 + AI 出新残局
     ========================================================================== */
  function pool(key) { return (typeof PUZZLES !== 'undefined' && PUZZLES[key]) ? PUZZLES[key] : []; }
  function dayIndex() {
    const now = new Date(Date.now() + 8 * 3600 * 1000);            // 北京时间
    const base = Date.UTC(2026, 0, 1);
    const cur = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    return Math.floor((cur - base) / 86400000);
  }
  function todayStr() { const n = new Date(Date.now() + 8 * 3600 * 1000); return n.toISOString().slice(0, 10); }
  function dailyRecord() { return LS.get('daily', {}); }
  function streak() {
    const rec = dailyRecord(); let n = 0;
    const d = new Date(Date.now() + 8 * 3600 * 1000);
    for (; ;) {
      const k = d.toISOString().slice(0, 10);
      if (rec[k] && rec[k].done) { n++; d.setUTCDate(d.getUTCDate() - 1); } else break;
      if (n > 3650) break;
    }
    return n;
  }
  EX.dailyIndex = function () { const p = pool(curKey()); return p.length ? (dayIndex() % p.length) : -1; };
  EX.startDaily = function () {
    const k = curKey(), p = pool(k), i = EX.dailyIndex();
    if (!p.length || i < 0) { toast('本游戏暂无每日一题'); return; }
    LS.set('dailyActive', { key: k, idx: i, date: todayStr(), t0: Date.now() });
    const m = el('ex-modal'); if (m) m.remove();
    if (typeof playPuzzle === 'function') playPuzzle(i);
  };
  /** 一局结束（且是每日一题）时评级 + 打卡 */
  function dailyFinish(won) {
    const act = LS.get('dailyActive', null);
    if (!act || act.date !== todayStr() || act.key !== curKey()) return null;
    LS.set('dailyActive', null);
    const sec = Math.round((Date.now() - act.t0) / 1000);
    if (!won) return { rating: '未过关', sec };
    const rating = sec <= 25 ? 'S' : sec <= 50 ? 'A' : sec <= 100 ? 'B' : 'C';
    const rec = dailyRecord(); rec[act.date] = { done: true, rating, sec, game: act.key };
    LS.set('daily', rec);
    return { rating, sec, streak: streak() };
  }
  EX.finishDaily = dailyFinish;
  EX.daily = function () {
    const k = curKey(), p = pool(k), i = EX.dailyIndex();
    const rec = dailyRecord(), today = rec[todayStr()];
    const st = streak();
    const names = { chess: '象棋', gomoku: '五子棋', junqi: '军棋' };
    let html = '';
    if (!p.length) {
      html = '<p>本游戏暂无每日题库。</p>';
    } else {
      const pz = p[i];
      html += '<div style="padding:12px;border:1px solid #dde5f0;border-radius:10px;background:#f7f9fc">'
        + '<div style="font-size:16px;font-weight:bold">📅 ' + todayStr() + ' · ' + (names[k] || k) + '每日一题</div>'
        + '<div style="margin-top:6px">题名：<b>' + esc(pz.name) + '</b></div>'
        + (pz.tip ? '<div style="color:#666">提示：' + esc(pz.tip) + '</div>' : '')
        + '<div style="margin-top:8px">' + (today && today.done
          ? '今日已过关 · 评级 <b style="color:#1e8f4a">' + today.rating + '</b> · 用时 ' + today.sec + ' 秒'
          : '今日还没过关') + '</div>'
        + '<div style="margin-top:4px;color:#a35a13">🔥 连续打卡：<b>' + st + '</b> 天</div>'
        + '<div style="margin-top:10px"><button class="btn primary" onclick="EXTRAS.startDaily()">开始挑战</button></div>'
        + '</div>';
      html += '<p style="color:#666;margin-top:12px">规则：用最少的手数/时间完成，越快评级越高（S ≤25 秒 · A ≤50 秒 · B ≤100 秒 · C 其他）。过关后自动记连续打卡。</p>';
    }
    html += '<hr style="border:none;border-top:1px solid #eee;margin:14px 0">';
    html += '<div style="font-weight:bold;margin-bottom:6px">🧩 AI 出新残局' + (hasModel() ? '（已接入模型）' : '（未填模型，用本地题库）') + '</div>';
    html += '<div style="color:#666;font-size:13px;margin-bottom:8px">'
      + (k === 'junqi' ? '军棋为随机翻棋，没有固定残局，直接重开一局即可。'
        : '让模型现场出一道残局，生成后会<strong>在本地校验合法性</strong>（象棋要求"红先一步杀"能被程序验证出来，五子棋要求"黑先一步成五"），校验不过就回退本地题库。')
      + '</div>';
    if (k !== 'junqi') html += '<button class="btn" onclick="EXTRAS.aiPuzzle()">🤖 让 AI 出一题</button>';
    modal('📅 每日一题 / 残局挑战', html);
  };

  EX.aiPuzzle = async function () {
    const k = curKey();
    if (!hasModel()) { toast('未填模型：已使用本地题库，去「⚙ 模型设置」填模型后可用 AI 出题'); return; }
    const box = el('ex-body');
    if (box) box.insertAdjacentHTML('beforeend', '<div id="ai-pz-out" style="margin-top:10px;color:#666">🤖 AI 正在出题…</div>');
    const out = () => el('ai-pz-out');
    try {
      const cfg = aicfg();
      let prompt, task;
      if (k === 'chess') {
        prompt = '请出一道中国象棋"红先一步杀"的小残局，用标准象棋 FEN 表示（10 行 9 列，从黑方底线到红方底线，行内用数字表示连续空格；请使用标准字母：红方 RNBAKCP、黑方 rnbakcp，例如 "4k4/9/4P4/9/9/R8/9/9/9/4K4"）。'
          + '要求：黑方只有一个"将"和至多一个"士"，红方有 2~3 个子且恰好存在一步将死黑方的走法。只输出 JSON，形如 {"fen":"3k5/9/9/9/9/9/9/9/9/4K4","name":"题目名","tip":"提示一句话"}，不要解释。';
      } else {
        prompt = '请出一道五子棋"黑先一步成五"的小残局：15×15 棋盘，给出已有棋子坐标（黑先、黑白交替落子，序号为奇数的是黑棋）。'
          + '要求黑方恰好存在一个空点可以立刻连成五子，且当前黑方还没成五。只输出 JSON，形如 {"seq":[[7,7],[7,8],[8,7],[8,8],[6,7]],"name":"题目名","tip":"提示一句话"}，坐标从 0 开始、格式 [行,列]，不要解释。';
      }
      const j = await askAI(cfg, { baseUrl: cfg.baseUrl, apiKey: cfg.apiKey, model: cfg.model, persona: 'default', task: 'puzzle', prompt });
      if (!j || !j.hint) { if (out()) out().innerHTML = '❌ 模型没有返回内容：' + ((j && j.error) || '未知错误') + '<br>已回退本地题库。'; return; }
      const txt = j.hint.replace(/```json|```/g, '').trim();
      const m = txt.match(/\{[\s\S]*\}/);
      if (!m) { if (out()) out().innerHTML = '❌ AI 返回的不是 JSON，已回退本地题库。<br><span style="color:#999">原文：' + esc(txt.slice(0, 160)) + '</span>'; return; }
      let obj;
      try { obj = JSON.parse(m[0]); } catch (e) { if (out()) out().innerHTML = '❌ AI 返回的 JSON 解析失败，已回退本地题库。'; return; }
      const v = (k === 'chess') ? verifyChessPuzzle(obj) : verifyGomokuPuzzle(obj);
      if (!v.ok) { if (out()) out().innerHTML = '❌ AI 出的局面没通过本地校验：' + esc(v.why) + '<br>已回退本地题库（校验是为了保证题一定解得出来）。'; return; }
      const pz = { name: (obj.name || 'AI 出题') + '（AI）', tip: obj.tip || '', fen: obj.fen, seq: obj.seq, ai: true };
      const fake = LS.get('aiPuzzles', {});
      (fake[k] = fake[k] || []).push(pz); LS.set('aiPuzzles', fake);
      const idx = pool(k).length + fake[k].length - 1;
      EX._aiPool = { key: k, list: fake[k] };
      if (out()) out().innerHTML = '✅ AI 出的题通过了本地校验（' + esc(v.why) + '）：<b>' + esc(pz.name) + '</b>';
      toast('AI 出题成功，正在开始');
      EX.startAIPuzzle(pz);
    } catch (e) {
      if (out()) out().innerHTML = '❌ 出题失败：' + esc(e.message);
    }
  };

  EX.startAIPuzzle = function (pz) {
    const m = el('ex-modal'); if (m) m.remove();
    const k = curKey();
    LS.set('dailyActive', { key: k, idx: -1, date: todayStr(), t0: Date.now(), ai: pz });
    if (k === 'chess' && typeof cg !== 'undefined' && typeof route === 'function') {
      location.hash = '#/chess-solo';
      setTimeout(() => { try { cg = new Chess(pz.fen); cg._startFen = pz.fen.split(' moves:')[0]; sel = null; render_chess(); setStatus('chess-st', 'AI 出的残局：' + pz.name); } catch (e) { toast('加载失败'); } }, 260);
    } else if (k === 'gomoku' && typeof gk !== 'undefined') {
      location.hash = '#/gomoku-solo';
      setTimeout(() => { try {
        gk = new Gomoku();
        let p = 1;
        (pz.seq || []).forEach(([r, c]) => { gk.B[r][c] = p; gk.seq.push([r, c]); p = p === 1 ? 2 : 1; });
        gk.player = 1; gk._baseline = gk.seq.slice();
        render_gomoku(); setStatus('gok-st', 'AI 出的残局：' + pz.name + ' · 你执黑先走');
      } catch (e) { toast('加载失败'); } }, 260);
    }
  };

  /** 标准拉丁 FEN（rnbakcp/RNBAKCP）→ 本引擎的中文字形 FEN */
  function latinFen(fen) {
    const M = { K: '帥', A: '仕', B: '相', N: '傌', R: '俥', C: '砲', P: '兵',
                k: '将', a: '士', b: '象', n: '馬', r: '車', c: '炮', p: '卒' };
    return String(fen).replace(/[KABNRCPkabnrcp]/g, ch => M[ch] || ch);
  }
  EX.latinFen = latinFen;

  /** 象棋：必须是合法局面，且红方存在一步"将死黑方"的走法 */
  function verifyChessPuzzle(o) {
    try {
      if (!o || typeof o.fen !== 'string' || !o.fen.includes('/')) return { ok: false, why: 'FEN 缺失' };
      const fen = latinFen(o.fen.split(' moves:')[0].trim());
      const g = new Chess(fen);
      const rows = fen.split('/');
      if (rows.length !== 10) return { ok: false, why: '棋盘行数不是 10 行' };
      if (!g.findK('r') || !g.findK('b')) return { ok: false, why: '缺少将/帅' };
      let reds = 0, blacks = 0;
      for (let r = 0; r < 10; r++) for (let c = 0; c < 9; c++) { const p = g.B[r][c]; if (p) { if (p.s === 'r') reds++; else blacks++; } }
      if (reds < 2 || reds > 6) return { ok: false, why: '红方子力数量不合适（' + reds + ' 个）' };
      if (blacks > 3) return { ok: false, why: '黑方子力太多（' + blacks + ' 个）' };
      if (g.inCheck('b')) return { ok: false, why: '初始局面黑方已被将军（不合法）' };
      const mine = g.allLegal('r');
      if (!mine.length) return { ok: false, why: '红方无棋可走' };
      // 找一步真正的"杀"：走完后黑方没棋可走（被将死/无子可动），或黑将直接被吃
      for (const m of mine) {
        const save = g.B[m[2]][m[3]], fp = g.B[m[0]][m[1]];
        g.B[m[2]][m[3]] = fp; g.B[m[0]][m[1]] = null; g.redTurn = !g.redTurn;
        const mate = (g.findK('b') === null) || (g.allLegal('b').length === 0);
        g.redTurn = !g.redTurn; g.B[m[0]][m[1]] = fp; g.B[m[2]][m[3]] = save;
        if (mate) return { ok: true, why: '确实存在一步杀（走后黑方无棋可走）' };
      }
      return { ok: false, why: '没有找到一步杀的走法' };
    } catch (e) { return { ok: false, why: '局面解析失败' }; }
  }
  /** 五子棋：坐标合法、无重复、黑方存在一步成五的点 */
  function verifyGomokuPuzzle(o) {
    try {
      const seq = o && o.seq;
      if (!Array.isArray(seq) || seq.length < 4 || seq.length > 40) return { ok: false, why: '棋子数量不合适' };
      const B = Array.from({ length: 15 }, () => Array(15).fill(0));
      let p = 1;
      for (const pt of seq) {
        if (!Array.isArray(pt) || pt.length !== 2) return { ok: false, why: '坐标格式错误' };
        const r = +pt[0], c = +pt[1];
        if (!(r >= 0 && r < 15 && c >= 0 && c < 15)) return { ok: false, why: '坐标越界' };
        if (B[r][c] !== 0) return { ok: false, why: '同一格下了两次' };
        B[r][c] = p; p = p === 1 ? 2 : 1;
      }
      const g = function (r, c) { return (r >= 0 && r < 15 && c >= 0 && c < 15) ? B[r][c] : -1; };
      const win5 = (r, c, who) => {
        for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
          let n = 1;
          for (const s of [1, -1]) { let rr = r + s * dr, cc = c + s * dc; while (g(rr, cc) === who) { n++; rr += s * dr; cc += s * dc; } }
          if (n >= 5) return true;
        }
        return false;
      };
      for (let r = 0; r < 15; r++) for (let c = 0; c < 15; c++) if (B[r][c] === 1 && win5(r, c, 1)) return { ok: false, why: '黑方已经连成五子了（题目就没意义了）' };
      let wins = 0;
      for (let r = 0; r < 15; r++) for (let c = 0; c < 15; c++) if (B[r][c] === 0) { B[r][c] = 1; if (win5(r, c, 1)) wins++; B[r][c] = 0; }
      if (wins === 0) return { ok: false, why: '黑方没有一步成五的点' };
      if (wins > 8) return { ok: false, why: '一步成五的点太多（题目太简单）' };
      return { ok: true, why: '黑方确实有 ' + wins + ' 个一步成五的点' };
    } catch (e) { return { ok: false, why: '摆放解析失败' }; }
  }
  EX.verifyChessPuzzle = verifyChessPuzzle;
  EX.verifyGomokuPuzzle = verifyGomokuPuzzle;

  /* ============================================================================
     3) 棋风画像与弱点报告
     ========================================================================== */
  function avg(a) { return a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0; }
  EX.style = async function () {
    let all = [];
    try { const r = await fetch('/api/rank'); const j = await r.json(); all = (j.games || []); } catch (e) { }
    const names = { chess: '象棋', gomoku: '五子棋', junqi: '军棋' };
    const byGame = {};
    for (const rec of all) { const g = rec.game || 'chess'; (byGame[g] = byGame[g] || []).push(rec); }
    let html = '';
    const insights = [];
    const durOf = rec => { const t = String(rec.durTxt || rec.dur || '0'); const m = t.match(/(\d+)\s*分/), s = t.match(/(\d+)\s*秒/); return (m ? +m[1] * 60 : 0) + (s ? +s[1] : 0); };
    for (const g of ['chess', 'gomoku', 'junqi']) {
      const list = byGame[g] || [];
      if (!list.length) { html += '<div style="color:#999;margin-top:8px">' + names[g] + '：还没有对局记录</div>'; continue; }
      const win = list.filter(x => x.result === 'win').length;
      const lose = list.filter(x => x.result === 'lose').length;
      const rate = list.length ? Math.round(win / list.length * 100) : 0;
      const dursW = list.filter(x => x.result === 'win').map(durOf).filter(x => x > 0);
      const dursL = list.filter(x => x.result === 'lose').map(durOf).filter(x => x > 0);
      html += '<div style="margin-top:10px;padding:10px 12px;border:1px solid #dde5f0;border-radius:9px;background:#f7f9fc">'
        + '<b>' + names[g] + '</b> · 共 ' + list.length + ' 局 · 胜 ' + win + ' / 负 ' + lose + ' · 胜率 <b style="color:' + (rate >= 50 ? '#1e8f4a' : '#c33') + '">' + rate + '%</b>'
        + (dursW.length ? '<br>赢的时候平均用时 ' + Math.round(avg(dursW)) + ' 秒' : '')
        + (dursL.length ? '｜输的时候平均用时 ' + Math.round(avg(dursL)) + ' 秒' : '')
        + '</div>';
      // 弱点推断（全部基于真实记录）
      if (list.length >= 5 && rate < 45) insights.push(names[g] + '胜率只有 ' + rate + '%，建议先用「简单」难度练手，或用「AI 教我走」每步跟着走');
      if (dursW.length >= 3 && dursL.length >= 3 && avg(dursL) < avg(dursW) * 0.65) insights.push(names[g] + '：输的局明显下得更快（' + Math.round(avg(dursL)) + ' 秒 vs ' + Math.round(avg(dursW)) + ' 秒）→ 你输在"太急"，多想 5 秒再落子');
      const streakNow = (() => { let n = 0; for (const rec of list.slice().sort((a, b) => (b.ts || 0) - (a.ts || 0))) { if (rec.result === 'win') n++; else break; } return n; })();
      if (streakNow >= 3) insights.push('🔥 ' + names[g] + '正在 ' + streakNow + ' 连胜，可以试着把难度调高一档');
    }
    const total = all.length, wins = all.filter(x => x.result === 'win').length;
    html = '<div style="font-size:15px">总对局 <b>' + total + '</b> 局 · 总胜率 <b>' + (total ? Math.round(wins / total * 100) : 0) + '%</b> · 🔥 每日一题连续打卡 <b>' + streak() + '</b> 天</div>' + html;
    if (insights.length) html += '<div style="margin-top:12px;padding:10px 12px;background:#fff7ed;border:1px solid #f6d9b0;border-radius:9px"><b>🩺 你的弱点（本地分析）</b><br>' + insights.map(x => '· ' + esc(x)).join('<br>') + '</div>';
    else html += '<div style="margin-top:12px;color:#666">数据还不够，多打几局就能看出弱点了（≥5 局开始给建议）。</div>';
    html += '<div style="margin-top:12px"><button class="btn" onclick="EXTRAS.aiStyle()">🤖 让 AI 写详细报告' + (hasModel() ? '' : '（需先填模型）') + '</button></div><div id="ai-style-out" style="margin-top:8px;color:#555"></div>';
    modal('📊 我的棋风与弱点', html);
  };

  EX.aiStyle = async function () {
    const out = el('ai-style-out');
    if (!hasModel()) { if (out) out.innerHTML = '⚠️ 还没填模型：去「⚙ 模型设置」填 Base URL / KEY / 模型名（有免费 KEY），或先看上面的本地分析。'; return; }
    if (out) out.innerHTML = '🤖 正在生成…';
    try {
      const r = await fetch('/api/rank'); const j = await r.json();
      const all = j.games || [];
      const brief = ['chess', 'gomoku', 'junqi'].map(g => {
        const l = all.filter(x => x.game === g);
        const w = l.filter(x => x.result === 'win').length;
        return ({ chess: '象棋', gomoku: '五子棋', junqi: '军棋' })[g] + '：' + l.length + ' 局，胜 ' + w + ' 负 ' + (l.length - w);
      }).join('；');
      const cfg = aicfg();
      const res = await askAI(cfg, { baseUrl: cfg.baseUrl, apiKey: cfg.apiKey, model: cfg.model, persona: cfg.persona || 'default', task: 'review',
        prompt: '【棋风报告】以下是这位玩家的真实战绩：' + brief + '。请用 5 行以内的中文，指出他最大的两个弱点，并给出两条立刻能用的改进方法。要点具体（例如"五子棋要先堵活三"），不要说套话。' });
      if (out) out.innerHTML = '<div style="white-space:pre-wrap;padding:10px 12px;background:#f7f9fc;border:1px solid #dde5f0;border-radius:8px">🧠 ' + esc(res.hint || ('失败：' + res.error)) + '</div>';
    } catch (e) { if (out) out.innerHTML = '失败：' + esc(e.message); }
  };

  /* ============================================================================
     4) 自适应难度陪练
     ========================================================================== */
  const LEVELS = ['easy', 'normal', 'hard'];
  const LEVEL_CN = { easy: '简单', normal: '普通', hard: '困难' };
  function autoState() { return LS.get('auto', {}); }
  EX.autoState = autoState;
  EX.recordLevel = function (key, won) {
    if (!EX.on.auto) return null;
    const st = autoState();
    const s = st[key] = st[key] || { level: 1, hist: [] };
    s.hist.push(won ? 1 : 0); s.hist = s.hist.slice(-5);
    let change = null;
    const last3 = s.hist.slice(-3);
    if (last3.length === 3 && last3.every(x => x === 0) && s.level > 0) { s.level--; change = { dir: -1, level: s.level }; s.hist = []; }
    else if (last3.length === 3 && last3.every(x => x === 1) && s.level < 2) { s.level++; change = { dir: 1, level: s.level }; s.hist = []; }
    LS.set('auto', st);
    if (change) {
      toast((change.dir > 0 ? '🪄 三连胜！难度自动升到「' : '🪄 三连败，难度自动降到「') + LEVEL_CN[LEVELS[change.level]] + '」');
      const sel = el('diff');
      if (sel && !el('result-modal')) { sel.value = LEVELS[change.level]; }
    }
    return change;
  };
  /** 进入游戏界面时套用自适应难度（不改用户手动设置过的档位之外的逻辑） */
  EX.applyAutoLevel = function (key) {
    if (!EX.on.auto) return;
    const st = autoState(), s = st[key];
    const sel = el('diff');
    if (!s || !sel) return;
    if (LEVELS[s.level] && sel.value !== LEVELS[s.level] && !window.__gameOver) sel.value = LEVELS[s.level];
  };

  /* ============================================================================
     5) 战绩分享海报（Canvas 本机生成）
     ========================================================================== */
  /* ================= 战绩海报（文字可自定义 · 实时预览 · 可存为默认） ================= */
  function posterDefaults(info, saved) {
    saved = saved || LS.get('posterText', {});
    info = info || {};
    return {
      title: info.title || (info.won ? '🏆 胜利' : '💔 惜败'),
      detail: info.detail || '',
      quote: info.quote || saved.quote || pickQuip(info.won ? 'win' : 'lose'),
      foot: saved.foot || '免费在线玩 · 象棋 / 五子棋 / 军棋',
      links: saved.links || '🌐 www.88531.cn    📖 doc.88531.cn',
      src: saved.src || '⭐ 开源地址 github.com/personal82555/moyu-qile',
      sign: saved.sign || (todayStr() + ' · 摸鱼棋乐（手机/电脑都能玩）')
    };
  }
  function fitText(x, text, maxW, maxSize, minSize, weight) {
    let size = maxSize || 40;
    const set = () => { x.font = (weight || 'bold ') + size + 'px sans-serif'; };
    set();
    while (size > (minSize || 14) && x.measureText(text).width > maxW) { size -= 2; set(); }
    return size;
  }

  EX.poster = function (info) {
    info = info || window.__lastGameInfo || {};
    EX._cv = document.createElement('canvas'); EX._cv.width = 800; EX._cv.height = 1150;
    EX._posterInfo = info;
    EX._p = posterDefaults(info);
    const F = [
      ['title', '结果标题', '🏆 红方胜！'],
      ['detail', '副标题', '你斩杀黑将 · 用时 3分12秒'],
      ['quote', '金句', '这步棋，我记下了'],
      ['foot', '底部宣传语', '免费在线玩 · 象棋 / 五子棋 / 军棋'],
      ['links', '网址行', '🌐 www.88531.cn    📖 doc.88531.cn'],
      ['src', '开源地址行', '⭐ 开源地址 github.com/personal82555/moyu-qile'],
      ['sign', '落款行', todayStr() + ' · 摸鱼棋乐']
    ];
    const fields = F.map(([k, label, ph]) =>
      '<div style="display:flex;align-items:center;gap:7px;margin-bottom:7px">'
      + '<label style="width:76px;font-size:12px;color:#666;flex:none">' + label + '</label>'
      + '<input id="pf-' + k + '" style="flex:1;font-size:13px;padding:6px 8px;border:1px solid #dbe3ef;border-radius:7px" '
      + 'value="' + esc(EX._p[k]).replace(/"/g, '&quot;') + '" placeholder="' + esc(ph) + '" '
      + 'oninput="EXTRAS.pEdit(\'' + k + '\', this.value)"></div>').join('');

    const old = el('ex-modal'); if (old) old.remove();
    const d = document.createElement('div');
    d.id = 'ex-modal'; d.className = 'ai-box';
    d.innerHTML = '<div class="ai-inner" style="text-align:center;max-width:600px">'
      + '<h3 style="margin:0 0 10px">🖼 战绩海报（文字可改）</h3>'
      + '<img id="ex-poster-img" style="width:100%;max-width:400px;border-radius:12px;box-shadow:0 6px 20px rgba(0,0,0,.25)">'
      + '<div style="text-align:left;margin-top:12px;padding:11px 12px;background:#f7f9fc;border:1px solid #dde5f0;border-radius:10px">'
      + '<div style="font-weight:bold;margin-bottom:8px">✏️ 自定义海报文字 <span style="font-weight:normal;color:#888;font-size:12px">（边打字边预览；数据列"手数/用时/难度"取自本局真实战绩，不可改）</span></div>'
      + fields
      + '<div style="display:flex;gap:7px;flex-wrap:wrap;margin-top:9px">'
      + '<button class="btn" onclick="EXTRAS.quoteAgain()">💬 换一句金句</button>'
      + '<button class="btn" onclick="EXTRAS.pSave()">💾 存为我的默认</button>'
      + '<button class="btn" onclick="EXTRAS.pReset()">↩ 恢复默认</button>'
      + '</div>'
      + '<div id="pf-hint" style="font-size:12px;color:#666;margin-top:7px"></div>'
      + '</div>'
      + '<div style="margin-top:12px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap">'
      + '<button class="btn primary" onclick="EXTRAS.downloadPoster()">⬇ 保存图片</button>'
      + '<button class="btn" onclick="EXTRAS.copyResult()">📋 复制文字战绩</button>'
      + '<button class="btn" onclick="document.getElementById(\'ex-modal\').remove()">关闭</button></div>'
      + '<div style="font-size:12px;color:#999;margin-top:8px">海报带站点推广信息，发朋友圈/群聊即可引流。</div></div>';
    (el('view') || document.body).prepend(d);
    el('ex-poster-img').src = EX.renderPosterCanvas(info, EX._p);
  };

  EX.pEdit = function (k, v) {
    if (!EX._p) return;
    EX._p[k] = v;
    const img = el('ex-poster-img');
    if (img) img.src = EX.renderPosterCanvas(EX._posterInfo, EX._p);
    const hint = el('pf-hint');
    if (hint) hint.textContent = '已修改（未保存到默认值）';
  };
  EX.pSave = function () {
    if (!EX._p) return;
    // 只持久化"中性文字"（金句/底部四行）；标题与副标题跟随本局胜负，避免下次显示错的胜负
    LS.set('posterText', { quote: EX._p.quote, foot: EX._p.foot, links: EX._p.links, src: EX._p.src, sign: EX._p.sign });
    const hint = el('pf-hint');
    if (hint) hint.textContent = '✅ 已存为你的默认文字（下次打开海报自动沿用）';
    toast('已保存为默认文字');
  };
  EX.pReset = function () {
    if (!EX._p) return;
    const saved = {};
    LS.set('posterText', saved);
    EX._p = posterDefaults(EX._posterInfo, saved);
    for (const k of ['title', 'detail', 'quote', 'foot', 'links', 'src', 'sign']) {
      const input = el('pf-' + k);
      if (input) input.value = EX._p[k];
    }
    const img = el('ex-poster-img'); if (img) img.src = EX.renderPosterCanvas(EX._posterInfo, EX._p);
    const hint = el('pf-hint'); if (hint) hint.textContent = '已恢复默认文字（并清空已存的默认值）';
  };

  EX.renderPosterCanvas = function (info, P) {
    P = P || posterDefaults(info);
    info = info || {};
    const W = 800, H = 1150;
    const cv = EX._cv; const x = cv.getContext('2d');
    x.clearRect(0, 0, W, H);
    const gd = x.createLinearGradient(0, 0, W, H);
    gd.addColorStop(0, '#1b2a4a'); gd.addColorStop(.5, '#243b63'); gd.addColorStop(1, '#2f5d8a');
    x.fillStyle = gd; x.fillRect(0, 0, W, H);
    x.fillStyle = 'rgba(255,255,255,.06)';
    for (let i = 0; i < 9; i++) { x.beginPath(); x.arc(70 + i * 90, 120 + (i % 3) * 180, 58, 0, Math.PI * 2); x.fill(); }
    const names = { chess: '象棋', gomoku: '五子棋', junqi: '军棋' };
    x.textAlign = 'center';
    // 品牌行
    x.fillStyle = '#ffd964';
    fitText(x, '摸鱼棋乐 · ' + (names[info.game] || '对局'), W - 160, 40, 20, 'bold ');
    x.fillText('摸鱼棋乐 · ' + (names[info.game] || '对局'), W / 2, 110);
    // 结果标题（用户可改，超长自动缩字）
    x.fillStyle = '#fff';
    fitText(x, P.title, W - 120, 92, 30, 'bold ');
    x.fillText(P.title, W / 2, 300);
    // 副标题
    if (P.detail) { x.fillStyle = '#cfe0f5'; fitText(x, P.detail, W - 110, 30, 16, ''); x.fillText(P.detail, W / 2, 360); }
    // 数据卡片（真实战绩，不参与自定义）
    const stats = info.stats || [];
    let y = 450;
    if (stats.length) {
      x.fillStyle = 'rgba(255,255,255,.10)';
      x.fillRect(70, y - 60, W - 140, 92 * Math.ceil(stats.length / 2));
      stats.forEach((s2, i) => {
        const cx = i % 2 === 0 ? W / 2 - 180 : W / 2 + 180;
        const cy = y + Math.floor(i / 2) * 92;
        x.textAlign = 'center';
        x.fillStyle = '#ffd964'; fitText(x, String(s2[1]), 300, 34, 16, 'bold '); x.fillText(String(s2[1]), cx, cy);
        x.fillStyle = '#cfe0f5'; fitText(x, String(s2[0]), 300, 22, 13, ''); x.fillText(String(s2[0]), cx, cy + 30);
      });
      y = y + Math.ceil(stats.length / 2) * 92 + 50;
    } else { y = 470; }
    // 金句（自动换行）
    if (P.quote) {
      x.font = 'italic 27px sans-serif'; x.fillStyle = '#ffe9a8'; x.textAlign = 'center';
      const chars = ('“' + P.quote + '”').split(''); let line = '', yy = y;
      for (const ch of chars) {
        if (x.measureText(line + ch).width > W - 180) { x.fillText(line, W / 2, yy); line = ch; yy += 38; }
        else line += ch;
      }
      x.fillText(line, W / 2, yy);
    }
    // 底部（全部可自定义，超长自动缩字）
    x.textAlign = 'center';
    if (P.foot) { x.fillStyle = '#dbe7f7'; fitText(x, P.foot, W - 90, 26, 14, ''); x.fillText(P.foot, W / 2, H - 200); }
    if (P.links) { x.fillStyle = '#ffd964'; fitText(x, P.links, W - 90, 28, 14, 'bold '); x.fillText(P.links, W / 2, H - 150); }
    if (P.src) { x.fillStyle = '#cfe0f5'; fitText(x, P.src, W - 90, 24, 13, ''); x.fillText(P.src, W / 2, H - 104); }
    if (P.sign) { x.fillStyle = 'rgba(255,255,255,.55)'; fitText(x, P.sign, W - 90, 22, 12, ''); x.fillText(P.sign, W / 2, H - 56); }
    return cv.toDataURL('image/png');
  };
  EX.downloadPoster = function () {
    try {
      const a = document.createElement('a');
      a.href = EX._cv.toDataURL('image/png');
      a.download = '摸鱼棋乐战绩-' + todayStr() + '.png';
      document.body.appendChild(a); a.click(); a.remove();
      toast('海报已保存到下载目录');
    } catch (e) { toast('保存失败：' + e.message); }
  };
  EX.copyResult = function () {
    const i = EX._posterInfo || {};
    const P = EX._p || posterDefaults(i);
    const t = (P.quote || '') + '  我在《摸鱼棋乐》' + ({ chess: '象棋', gomoku: '五子棋', junqi: '军棋' }[i.game] || '') + '拿到 ' + (i.title || '') + '！'
      + (i.stats || []).map(s => s[0] + '：' + s[1]).join('，') + '。来 www.88531.cn 挑战我～';
    try { navigator.clipboard.writeText(t); toast('文字战绩已复制'); } catch (e) { toast(t); }
  };
  EX.quoteAgain = function () {
    const info = EX._posterInfo || {};
    const names = { chess: '象棋', gomoku: '五子棋', junqi: '军棋' };
    const setQ = (q) => {
      if (EX._p) { EX._p.quote = q; }
      const inp = el('pf-quote'); if (inp) inp.value = q;
      const img = el('ex-poster-img'); if (img) img.src = EX.renderPosterCanvas(info, EX._p || posterDefaults(info));
      const hint = el('pf-hint'); if (hint) hint.textContent = '金句已更新（点「存为我的默认」可记住）';
    };
    if (!hasModel()) { setQ(pickQuip(info.won ? 'win' : 'lose')); return; }
    const hint = el('pf-hint'); if (hint) hint.textContent = '🤖 正在想一句…';
    const cfg = aicfg();
    askAI(cfg, { baseUrl: cfg.baseUrl, apiKey: cfg.apiKey, model: cfg.model, persona: cfg.persona || 'savage', task: 'taunt',
      prompt: '我刚在' + (names[info.game] || '棋类') + '里' + (info.won ? '赢了' : '输了') + '，请给我一句 20 字以内、适合发朋友圈的中文金句（有趣、不低俗）。' })
      .then(r => setQ(r.hint || pickQuip(info.won ? 'win' : 'lose')))
      .catch(() => setQ(pickQuip(info.won ? 'win' : 'lose')));
  };
  EX.quoteFor = function (won) { return pickQuip(won ? 'win' : 'lose'); };

  /* ============================================================================
     6) 军棋记牌推理
     ========================================================================== */
  EX.junqiCount = function () {
    if (curKey() !== 'junqi' || typeof jq === 'undefined' || !jq) { toast('记牌推理只在军棋对局中使用'); return; }
    const poolAll = {};
    JunqiBoard.perSide().forEach(k => poolAll[k] = (poolAll[k] || 0) + 2);
    const seen = {};
    for (let r = 0; r < jq.R; r++) for (let c = 0; c < jq.C; c++) {
      const p = jq.cells[r][c];
      if (p && jq.shown[r][c]) seen[p.kind] = (seen[p.kind] || 0) + 1;
    }
    const rows = [];
    for (const k of KINDS) {
      const tot = poolAll[k] || 0, sn = seen[k] || 0;
      rows.push('<tr><td style="padding:3px 10px">' + (KIND_LBL[k] || k) + '</td><td style="padding:3px 10px;text-align:center">' + tot + '</td>'
        + '<td style="padding:3px 10px;text-align:center">' + sn + '</td>'
        + '<td style="padding:3px 10px;text-align:center;font-weight:bold;color:' + (tot - sn > 0 ? '#c33' : '#999') + '">' + (tot - sn) + '</td></tr>');
    }
    let hidden = 0;
    for (let r = 0; r < jq.R; r++) for (let c = 0; c < jq.C; c++) if (jq.cells[r][c] && !jq.shown[r][c]) hidden++;
    const remainBig = ['s9', 's8', 's7', 'zha'].filter(k => (poolAll[k] - (seen[k] || 0)) > 0)
      .map(k => (KIND_LBL[k] || k) + ' 还有 ' + (poolAll[k] - (seen[k] || 0)) + ' 张');
    let html = '<div>还剩 <b>' + hidden + '</b> 张暗牌（双方谁翻到算谁的）。下表是全部 50 枚棋子的"已出现 / 还剩"：</div>';
    html += '<table style="margin-top:8px;border-collapse:collapse;border:1px solid #e3e8f0"><tr style="background:#f2f6fc">'
      + '<th style="padding:5px 10px">军衔</th><th style="padding:5px 10px">总数</th><th style="padding:5px 10px">已出现</th><th style="padding:5px 10px">还剩</th></tr>'
      + rows.join('') + '</table>';
    html += '<div style="margin-top:10px;padding:10px 12px;background:#fff7ed;border:1px solid #f6d9b0;border-radius:8px">'
      + '<b>推理要点</b><br>'
      + '· 暗牌里还可能藏着重子：' + (remainBig.join('、') || '（大子基本都露面了）') + '<br>'
      + '· 一张暗牌可能是上述任何"还剩"的棋子（概率均等），所以别盲目用大军长去撞暗牌<br>'
      + '· 想探牌就用<b>工兵</b>或<b>排长/连长</b>去翻或去吃（亏了也不心疼）<br>'
      + '· 已翻开的敌方<b>司令</b>无解的子力差：只有<b>炸弹</b>能同归于尽，或用地雷守株待兔<br>'
      + '· 行营里的棋子安全（不可被攻击），被追的子躲进行营最稳</div>';
    const mine = { r: 0, b: 0 };
    for (let r = 0; r < jq.R; r++) for (let c = 0; c < jq.C; c++) {
      const p = jq.cells[r][c];
      if (p && jq.shown[r][c] && p.owner) mine[p.owner]++;
    }
    html += '<div style="margin-top:8px;color:#666">场上已翻开：红方（你） ' + mine.r + ' 枚 · 蓝方 ' + mine.b + ' 枚</div>';
    modal('🔍 军棋记牌推理', html);
  };

  /* ============================================================================
     7) 对手嘴炮（本地金句库兜底）
     ========================================================================== */
  const QUIPS = {
    aiEat: ['这子我先收下了，谢谢招待～', '哎哟，送子观音？', '你这一步，我等着呢', '吃！别怪我不客气', '不好意思，收个利息'],
    playerEat: ['你运气不错嘛', '这子我记下了……', '行，让你一子', '别得意，好戏在后面', '哼，算你狠'],
    aiMove: ['轮到我了，看好了', '你这样下去要输哦', '我走这一步，你猜为什么？', '稳一点，别急', '这一手，你解得开吗'],
    check: ['将军！快想办法', '将军了，别慌，慢慢想', '看招——将军！', '这一将，你躲哪儿？'],
    aiWin: ['承让承让，再来一局？', '这局我收下了，不服再来', '谢谢陪练，你进步了（一点点）', '赢了～下次让你一手'],
    playerWin: ['……你赢了，是我大意', '厉害，这局你下得好', '服了，再来一局我要赢回来', '好棋！我心服口服'],
    idle: ['摸鱼一时爽，一直摸鱼一直爽', '再来一局？我还没热身呢']
  };
  function pickQuip(kind) { const a = QUIPS[kind] || QUIPS.idle; return a[Math.floor(Math.random() * a.length)]; }
  EX.pickQuip = pickQuip;

  let tauntN = 0, tauntTs = 0;
  /** 场景：aiEat/playerEat/aiMove/check/aiWin/playerWin */
  EX.taunt = function (kind, extra) {
    if (!EX.on.taunt) return;
    tauntN++;
    const now = Date.now();
    if (now - tauntTs < 6000) return;                 // 限频：最少间隔 6 秒
    if (tauntN % 2 === 0 && kind === 'aiMove') return; // 普通走子隔一次说一句，避免刷屏
    tauntTs = now;
    const box = ensureTauntBox();
    if (box) { box.style.display = 'block'; box.innerText = '💬 …'; }
    if (!hasModel()) { const q = pickQuip(kind); if (box) box.innerText = '💬 ' + q; return; }
    const cfg = aicfg();
    const names = { chess: '象棋', gomoku: '五子棋', junqi: '军棋' };
    const desc = { aiEat: 'AI 刚吃掉玩家的一个子', playerEat: '玩家刚吃掉 AI 的一个子', aiMove: 'AI 刚走了一步', check: 'AI 将军了', aiWin: 'AI 赢了这局', playerWin: '玩家赢了这局' };
    askAI(cfg, { baseUrl: cfg.baseUrl, apiKey: cfg.apiKey, model: cfg.model, persona: 'savage', task: 'taunt',
      prompt: '你在和玩家下' + (names[curKey()] || '棋') + '，' + (desc[kind] || '刚走了一步') + (extra ? '（' + extra + '）' : '') + '。用 15 字以内的一句中文调侃一下（有趣、不低俗、不骂人）。' })
      .then(r => { if (box) box.innerText = '💬 ' + (r.hint || pickQuip(kind)); })
      .catch(() => { if (box) box.innerText = '💬 ' + pickQuip(kind); });
  };
  function ensureTauntBox() {
    let b = el('taunt-box');
    if (b) return b;
    const host = el('view'); if (!host) return null;
    b = document.createElement('div');
    b.id = 'taunt-box';
    b.style.cssText = 'display:none;margin:8px auto;max-width:820px;padding:8px 13px;border-radius:14px 14px 14px 4px;background:#eef4ff;border:1px solid #cfdcf3;color:#2a4a7a;font-size:14px';
    host.prepend(b);
    return b;
  }

  /* ============================================================================
     8) 开局库讲解
     ========================================================================== */
  const OPENINGS = {
    chess: [
      { name: '中炮（炮二平五）', idea: '把炮摆到中路，直接威胁对方的"将"，是最流行、最好上手的开局。', steps: '炮从右路摆到中路 → 马护兵 → 车出直路', trap: '注意对方用"屏风马"守住中路，别急着用炮换子。', first: [7, 7, 7, 4] },
      { name: '仙人指路（兵七进一）', idea: '先挺一个兵，试探对方怎么布阵，自己保留变化。', steps: '兵向前一步 → 看对方应对 → 再决定出马还是架炮', trap: '别一路猛推兵，兵过河后没了保护容易被吃。', first: [6, 2, 5, 2] },
      { name: '起马局（马八进七）', idea: '先出马，稳。马是"八面威风"的子，早点活动起来。', steps: '左侧马向里跳一格（走到炮的前面）→ 车护马 → 找机会踩对方中兵', trap: '马别乱跳到边路，容易"马跳边，必被牵"。', first: [9, 1, 7, 2] },
      { name: '飞相局（相七进五）', idea: '先把相飞起来，守得稳，等对方先出手。', steps: '左相飞到中路 → 车出直路 → 马跳出', trap: '太保守容易被压着打，注意及时反击。', first: [9, 2, 7, 4] },
      { name: '士角炮（炮八平六）', idea: '炮放到士角，护住中路又留出车路，变化细腻。', steps: '左炮平移到士角 → 马跳出 → 车过河', trap: '对方若用"过宫炮"抢中路，要提前防。', first: [7, 1, 7, 3] },
      { name: '边兵局（兵九进一）', idea: '先动边兵，把局面拉散，适合喜欢慢慢磨的人。', steps: '边兵向前 → 车从边路亮出 → 慢慢蚕食', trap: '边兵价值低，别为了它丢中心控制。', first: [6, 0, 5, 0] }
    ],
    gomoku: [
      { name: '天元开局（中心点）', idea: '第一手下正中心，向四个方向都能发展，理论最强。', steps: '黑先占中心 → 跟着对方的棋做"活二活三"', trap: '别只顾进攻不防守：对方做出"活三"必须马上堵。' },
      { name: '花月 / 浦月（斜线开局）', idea: '沿斜线做二连，容易形成双三，进攻性强。', steps: '中心 → 斜线连二 → 再拐成双三', trap: '斜线容易被对方"反斜"挡住，注意留后手。' },
      { name: '寒星（直二开局）', idea: '直线连二，变化多但比较稳。', steps: '中心 → 直线上连二 → 看对方方向再定攻防', trap: '直线容易被双面封堵，别一路死连。' },
      { name: '防守要点', idea: '五子棋七成赢在防守：先看对方有没有"活三/冲四"。', steps: '对方活三 → 立刻堵一头（堵活四方向）→ 再想自己的进攻', trap: '只在对方"冲四"时才堵就晚了：活三就要处理。' }
    ],
    junqi: [
      { name: '先翻后动（开局稳健）', idea: '开局别急着走子，先翻几个明牌摸清对方的子力分布。', steps: '先翻远离敌方司令的角落 → 有子力优势再推进', trap: '翻得太多会送给对方强子，控制在 3~5 张。' },
      { name: '抢行营（安全区）', idea: '行营里的棋子不会被吃，把子躲进去就等于多了一条命。', steps: '把暴露的大子先进行营 → 用小兵/工兵在外试探', trap: '行营里最多 1 枚子，别把司令永远堵在里面不动。' },
      { name: '工兵探路', idea: '工兵等级最低，拿去翻牌、撞炸弹最划算。', steps: '工兵先动 → 沿铁路探路（工兵可沿铁路直行）', trap: '工兵撞到地雷会同归于尽，不算亏。' },
      { name: '保军旗与扛旗', idea: '赢的关键是扛走对方的军旗：把兵力往对方大本营压。', steps: '清掉护卫 → 用大子压到大本营 → 扛旗', trap: '自己的军旗被扛就输，大本营附近要留护卫。' }
    ]
  };
  EX.openings = function () {
    const k = curKey(), list = OPENINGS[k] || [];
    const names = { chess: '象棋', gomoku: '五子棋', junqi: '军棋' };
    let html = '<div style="color:#666">' + (names[k] || '') + '常用开局与思路（本地讲解，不用联网）：</div>';
    list.forEach((o, i) => {
      html += '<div style="margin-top:10px;padding:10px 12px;border:1px solid #dde5f0;border-radius:9px;background:#f7f9fc">'
        + '<b>' + (i + 1) + '. ' + esc(o.name) + '</b><br>'
        + '<span style="color:#333">' + esc(o.idea) + '</span><br>'
        + '<span style="color:#555">步骤：' + esc(o.steps) + '</span><br>'
        + '<span style="color:#a35a13">⚠️ ' + esc(o.trap) + '</span></div>';
    });
    html += '<div style="margin-top:12px"><button class="btn" onclick="EXTRAS.aiOpening()">🤖 让 AI 再讲讲' + (hasModel() ? '' : '（需先填模型）') + '</button></div>'
      + '<div id="ai-opening-out" style="margin-top:8px;color:#555"></div>';
    modal('📖 开局库讲解', html);
  };
  EX.aiOpening = async function () {
    const out = el('ai-opening-out');
    if (!hasModel()) { if (out) out.innerHTML = '⚠️ 未填模型：上面的本地讲解已经够用；填了模型可以让 AI 结合你的局面讲得更细。'; return; }
    const k = curKey(), names = { chess: '象棋', gomoku: '五子棋', junqi: '军棋' };
    if (out) out.innerHTML = '🤖 正在讲解…';
    const cfg = aicfg();
    const board = (typeof aiBoardDesc === 'function') ? aiBoardDesc().slice(0, 700) : '';
    const r = await askAI(cfg, { baseUrl: cfg.baseUrl, apiKey: cfg.apiKey, model: cfg.model, persona: cfg.persona || 'master', task: 'review',
      prompt: '【' + (names[k] || '') + '开局讲解】当前局面：' + board + '\n请用 3~4 句中文，讲清楚：我现在这个局面适合走什么开局思路、第一步该往哪走（说棋子中文名和左中右位置），以及要注意什么陷阱。' });
    if (out) out.innerHTML = '<div style="white-space:pre-wrap;padding:10px 12px;background:#f7f9fc;border:1px solid #dde5f0;border-radius:8px">🧠 ' + esc(r.hint || ('失败：' + r.error)) + '</div>';
  };

  /* ============================================================================
     总控面板：✨ 更多功能
     ========================================================================== */
  function tgl(id, label, on) {
    return '<label style="display:flex;align-items:center;gap:6px;padding:8px 10px;border:1px solid ' + (on ? '#bcd6ff' : '#e3e8f0') + ';border-radius:9px;background:' + (on ? '#f0f6ff' : '#fff') + ';cursor:pointer;font-size:13px">'
      + '<input type="checkbox" ' + (on ? 'checked' : '') + ' onchange="EXTRAS.setOn(\'' + id + '\', this.checked)"> ' + label + '</label>';
  }
  EX.setOn = function (id, v) {
    EX.on[id] = !!v; saveOn();
    const m = el('ex-modal'); if (m) m.remove(); EX.panel();
    toast((v ? '已开启：' : '已关闭：') + ({ step: '走法点评', auto: '自适应难度', taunt: '对手嘴炮' }[id] || id));
    if (id === 'step') { const b = el('step-hint'); if (!v && b) b.style.display = 'none'; }
    if (id === 'auto') EX.applyAutoLevel(curKey());
    if (id === 'taunt' && !v) { const b = el('taunt-box'); if (b) b.style.display = 'none'; }
  };
  EX.panel = function () {
    const k = curKey();
    const names = { chess: '象棋', gomoku: '五子棋', junqi: '军棋' };
    const html =
      '<div style="color:#666;margin-bottom:10px">当前：<b>' + (names[k] || '大厅') + '</b>　模型：' + (hasModel() ? '<b style="color:#1e8f4a">已接入</b>（AI 功能全开）' : '<b style="color:#a35a13">未接入</b>（以下功能仍全部可用，AI 相关会自动用本地内容兜底）') + '</div>'
      + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px">'
      + '<button class="btn" onclick="EXTRAS.daily()">📅 每日一题</button>'
      + '<button class="btn" onclick="EXTRAS.style()">📊 我的棋风</button>'
      + '<button class="btn" onclick="EXTRAS.openings()">📖 开局库讲解</button>'
      + '<button class="btn" onclick="EXTRAS.junqiCount()">🔍 记牌推理</button>'
      + '<button class="btn" onclick="EXTRAS.poster()">🖼 战绩海报</button>'
      + '<button class="btn" onclick="EXTRAS.posterLast()">🖼 上一局海报</button>'
      + '</div>'
      + '<div style="margin-top:14px;font-weight:bold">功能开关（本地实时生效）</div>'
      + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:8px;margin-top:8px">'
      + tgl('step', '📉 走法点评（这步亏了吗）', EX.on.step)
      + tgl('auto', '🪄 自适应难度（三连败降档）', EX.on.auto)
      + tgl('taunt', '💬 对手嘴炮', EX.on.taunt)
      + '</div>'
      + '<div style="margin-top:12px;color:#888;font-size:12px;line-height:1.7">'
      + '· 走法点评、自适应难度、记牌推理、开局库、海报、每日一题（本地题库）全部不需要模型，用本机计算/内置内容完成<br>'
      + '· 填了模型后：AI 出残局、AI 弱点报告、AI 金句、AI 嘴炮、AI 开局讲解自动解锁，出题/生成的内容都会先在本地校验合法才使用'
      + '</div>';
    modal('✨ 更多功能', html);
  };
  EX.posterLast = function () {
    if (!window.__lastGameInfo) { toast('还没有完成的对局，先打一局吧'); return; }
    EX.poster(window.__lastGameInfo);
  };

  /* ============================================================================
     对局结束总入口（由 common.js 的 gameResultPopup 调用）
     ========================================================================== */
  EX.onGameEnd = function (info) {
    try {
      info = info || {};
      const k = info.game || curKey();
      window.__lastGameInfo = info;
      if (!info.quote) info.quote = (typeof pickQuip === 'function') ? pickQuip(info.won ? 'win' : 'lose') : '';
      const _dr = dailyFinish(!!info.won);
      if (EX.on.auto && !info.twoP) EX.recordLevel(k, !!info.won);
      if (EX.on.taunt) EX.taunt(info.won ? 'playerWin' : 'aiWin');
      return _dr;
    } catch (e) { return null; }
  };

  /* 每次渲染游戏界面后套用自适应难度 */
  EX.afterShell = function (key) { try { EX.applyAutoLevel(key); } catch (e) { } };

})();
