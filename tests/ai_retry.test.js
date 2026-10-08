// 用「容器里的真实 /api/ai-hint」+ 抽取 app/js/common.js 里真实发布的 askAI/CN_RE 代码，
// 验证「模型只回英文时自动补问中文」的逻辑（需要 mock：node tests/mock_ai3.js）
const fs = require('fs');
const path = require('path');
const http = require('http');

function ping(port) {
  return new Promise(res => {
    const r = http.get({ host: '127.0.0.1', port, path: '/', timeout: 900 }, () => res(true));
    r.on('error', () => res(false));
    r.on('timeout', () => { r.destroy(); res(false); });
  });
}

(async () => {
  if (!(await ping(7025)) || !(await ping(7094))) {
    console.log('⏭ 跳过 ai_retry.test.js：需要容器 7025 与 mock 7094 在线（先 `node tests/mock_ai3.js`）');
    process.exit(0);
  }
  const SRC = fs.readFileSync(path.join(__dirname, '..', 'app', 'js', 'common.js'), 'utf8');
  const i = SRC.indexOf('const CN_RE');
  const j = SRC.indexOf('async function aiCoach');
  if (i < 0 || j < 0) { console.error('未找到 askAI 代码块'); process.exit(1); }

  const calls = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, opt) => {
    const b = JSON.parse(opt.body);
    calls.push({ prompt: b.prompt, task: b.task, persona: b.persona });
    return realFetch('http://127.0.0.1:7025' + url, opt);
  };

  const code = SRC.slice(i, j);
  const factory = new Function('return (async () => { ' + code + ' return { askAI, CN_RE }; })()');
  const { askAI, CN_RE } = await factory();
  const cfg = { baseUrl: 'http://192.168.68.19:7094/v1', apiKey: 'sk-x', model: 'english-only', persona: 'default' };

  // A) 模型首答只给英文 → 应自动补问一次"必须中文"并拿到中文
  calls.length = 0;
  const r = await askAI(cfg, { baseUrl: cfg.baseUrl, apiKey: cfg.apiKey, model: cfg.model, persona: 'default', task: 'hint', prompt: '【象棋局面】红方在下方…' });
  const aCalls = calls.length;
  const aRetry = /务必用简体中文/.test(calls[1] ? calls[1].prompt : '');
  const aCn = CN_RE.test(r.hint || '') && !/cannons|board/i.test(r.hint || '');
  console.log('A) 英文首答 → 最终显示：', r.hint);
  console.log('   调用次数:', aCalls, '| 第 2 次带中文强约束:', aRetry, '| 结果为中文:', aCn);

  // B) 提问里已带强约束（模型直接回中文）→ 只调用 1 次
  calls.length = 0;
  const r2 = await askAI(cfg, { baseUrl: cfg.baseUrl, apiKey: cfg.apiKey, model: 'english-only', persona: 'default', task: 'review', prompt: '【象棋复盘】…务必用简体中文…' });
  const bCalls = calls.length;
  console.log('B) 中文首答 → 调用次数:', bCalls, '| 结果:', r2.hint);

  const ok = aCalls === 2 && aRetry && aCn && bCalls === 1;
  console.log(ok ? '\n✅ 通过：英文回答会自动重试成中文，中文回答不多问' : '\n❌ 未通过');
  process.exit(ok ? 0 : 1);
})();
