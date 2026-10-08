// 直接抽取 app/js/common.js 里真实发布的 askAI/CN_RE 代码，用真后端(容器 7025)验证"英文自动重试中文"逻辑
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'app', 'js', 'common.js'), 'utf8');

const i = SRC.indexOf('const CN_RE');
const j = SRC.indexOf('async function aiCoach');
if (i < 0 || j < 0) { console.error('未找到 askAI 代码块'); process.exit(1); }
const code = SRC.slice(i, j);

const calls = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, opt) => {
  const b = JSON.parse(opt.body);
  calls.push({ url: String(url), prompt: b.prompt, task: b.task, persona: b.persona });
  // 转发给容器里真正的 /api/ai-hint
  return realFetch('http://127.0.0.1:7025' + url, opt);
};

const sandbox = {};
const fn = new Function('return (async () => { ' + code + ' return { askAI, CN_RE }; })()');
(async () => {
  const { askAI, CN_RE } = await fn();
  const cfg = { baseUrl: 'http://192.168.68.19:7094/v1', apiKey: 'sk-x', model: 'english-only', persona: 'default' };

  // 场景 A：模型只会说英文 → 应自动补问一次并拿到中文
  calls.length = 0;
  const r = await askAI(cfg, { baseUrl: cfg.baseUrl, apiKey: cfg.apiKey, model: cfg.model, persona: 'default', task: 'hint', prompt: '【象棋局面】红方在下方…' });
  console.log('A) 提示 →', r.hint);
  console.log('   A 调用次数:', calls.length, '| 第2次带中文强约束:', calls.length === 2 && /务必用简体中文/.test(calls[1].prompt));
  console.log('   A 结果是否中文:', CN_RE.test(r.hint || '') && !/cannons|board/i.test(r.hint || ''));

  // 场景 B：模型首答就是中文 → 应只调用一次
  calls.length = 0;
  const r2 = await askAI(cfg, { baseUrl: cfg.baseUrl, apiKey: cfg.apiKey, model: 'english-only', persona: 'default', task: 'review', prompt: '【象棋复盘】…务必用简体中文…' });
  console.log('B) 复盘 →', r2.hint);
  console.log('   B 调用次数(应为1):', calls.length);

  const ok = calls.length === 1 && CN_RE.test(r.hint || '') && !/cannons/i.test(r.hint || '');
  console.log(ok ? '\n✅ 通过：英文回答会自动重试成中文，中文回答不多问' : '\n❌ 未通过');
  process.exit(ok ? 0 : 1);
})();
