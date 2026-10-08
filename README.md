# 🐟 摸鱼棋乐（moyu-qile）

> 益智 · 摸鱼 · 小憩 —— 象棋 / 五子棋 / 军棋（陆战棋翻棋）三合一网页棋类游戏，纯 Node.js 自研，无外部依赖，Docker 一键部署。

浏览器打开就能玩，**手机 / 平板 / 电脑**都适配：不需要装 App、不需要注册账号、局域网零延迟、数据全部留在自己家里。

![games](https://img.shields.io/badge/games-%E8%B1%A1%E6%A3%8B%20%7C%20%E4%BA%94%E5%AD%90%E6%A3%8B%20%7C%20%E5%86%9B%E6%A3%8B-blue) ![node](https://img.shields.io/badge/node-%3E%3D20-green) ![license](https://img.shields.io/badge/license-MIT-lightgrey)

---

## ✨ 功能一览

| 功能 | 说明 |
|---|---|
| 🤖 **AI 对战** | 象棋（α-β 搜索，三档难度）、五子棋（攻防评分 + 前瞻堵四）、军棋（吃子优先评估） |
| 👥 **双人同屏** | 不需要联机、不需要第二个账号，一台设备两人轮流点 |
| 🎯 **残局挑战** | 象棋名局残局（马后炮 / 重炮将杀…）、五子棋三步杀、军棋三套明棋局面 |
| ↩ **悔棋** | 象棋/五子棋一次撤回"你 + AI"各一步；军棋支持完整回滚（含吃子、扛旗） |
| 💾 **存档 / 恢复** | 手动存档以「日期 + 时间」标识；**每 1 分钟自动存档并覆盖**（防丢局）；三个游戏各自独立文件 |
| ♻️ **刷新不丢局** | 局中自动快照，刷新后进入游戏会询问「是否继续上一局」 |
| 🏆 **战绩排行** | 每局自动记录胜负与用时，按游戏独立统计，可导出 JSON |
| ⏱ **倒计时** | 无 / 1 / 3 / 5 / 10 / 20 / 30 / 60 分钟，超时判负（双人模式像棋钟轮流计时） |
| 🚪 **离开提醒** | 对局未结束时点其他页面、刷新、关页都会先确认 |
| 🤖 **AI 教练** | 接入任意 OpenAI 兼容大模型，逐步给出行棋建议 |
| 📖 **玩法说明** | 每个游戏单独的规则页 + 完整使用说明页 |
| ⚙ **存档路径可配置** | 存档与战绩目录可在界面里修改，换目录自动迁移 |

## 🎮 三个游戏

<details><summary><b>♟️ 象棋</b>（AI / 双人 / 残局）</summary>

标准中国象棋规则：蹩马腿、塞象眼、炮隔山打、兵过河横走、将帅不可照面、将死与困毙判负。点己方棋子 → 绿圈标出可走位置 → 点目标格落子。
</details>

<details><summary><b>⚫ 五子棋</b>（AI / 双人 / 残局）</summary>

15×15 棋盘，五子连珠（横 / 竖 / 斜）即胜。困难档会计算对手活四、连四并封堵。
</details>

<details><summary><b>🚩 军棋 · 陆战棋翻棋</b>（AI / 双人 / 残局）</summary>

标准 5 列 × 12 行棋盘：每方 5 个行营（圆）、2 个大本营（方框）、46 个兵站，全盘 50 枚棋子背面朝上随机布阵。

- **翻棋定色**：轮到你就翻一张，翻到哪方颜色就执哪方（先翻者定色）
- **大小**：司令 › 军长 › 师长 › 旅长 › 团长 › 营长 › 连长 › 排长 › 工兵；同级同归于尽
- **特殊**：工兵挖地雷（唯一可吃雷）、炸弹与任何子同归于尽、军旗被吃即负
- **行营**：空营可进可出，**营内棋子不可被吃**（会自动套琥珀虚线环 + 标「营」）
- **大本营**：可摆子、可进入，但**进去后不能再移动**（标「本」）
- **铁路**：工兵可沿铁路直行任意格，其他子一次一步；山界仅两侧与中路三处可通；斜线仅行营与兵站之间
</details>

## 🚀 部署（Docker）

```bash
git clone https://github.com/personal82555/moyu-qile.git
cd moyu-qile
docker build -t moyu-qile:latest .
docker run -d --name moyu-qile --restart unless-stopped \
  -p 7025:7025 \
  -v "$PWD/data:/app/data" \
  moyu-qile:latest
```

打开 `http://<你的IP>:7025` 即可（手机同理）。

> **数据卷必须挂**：存档（`*-saves.json`）、战绩（`*-ranks.json`）与路径配置都在 `/app/data`，不挂卷重建容器会丢。

### 本地直跑（不用 Docker）

```bash
npm install
node server.js        # 端口可用 PORT 覆盖
```

## 📁 目录结构

```
server.js             # HTTP 静态服务 + WS 房间 + /api/{rank,save,config,fs,ai-hint}
app/index.html        # 单页应用（hash 路由，三个游戏视图）
app/about.html        # 使用说明页
app/css/style.css     # 样式（移动端适配）
app/js/chess.js       # 象棋规则引擎
app/js/chessAI.js     # 象棋搜索 AI
app/js/gomoku.js      # 五子棋引擎 + 评分 AI
app/js/junqi.js       # 军棋翻棋引擎（标准 12×5 棋盘 / 行营 / 大本营 / 铁路）
app/js/*_client.js    # 三个游戏的界面逻辑 + 存档钩子（GAMEHOOKS）
app/js/common.js      # 公共 UI：工具栏 / 存档 / 排行 / 倒计时 / 离开守卫 / AI 教练
data/                 # 运行时数据（存档、战绩、配置）—— 已 gitignore
tests/                # Node 单元测试
```

## 🧪 测试

```bash
node tests/engine.test.js      # 引擎回归
node tests/chess_state.test.js # 象棋局面序列化往返（存档正确性）
node tests/jq_rules.test.js    # 军棋规则（行营 / 大本营 / 铁路 / 山界）
node tests/jq_camp.test.js     # 军棋入营与营内免疫
node tests/jq_shown.test.js    # 军棋翻开状态同步
```

## 🔧 快捷方式

- 端口：`7025`（HTTP 与 WebSocket 同端口）
- AI 教练需要 OpenAI 兼容接口：`⚙ 模型设置` 里填 Base URL / Key / 模型名即可，不填不影响对局
- 存档目录默认 `<数据卷>/saves`，可在「💾 存档 → ⚙ 存档路径」里改

---

## 🎁 白嫖党专区 · 更多免费资源（推荐）

| 站点 | 地址 | 说明 |
|---|---|---|
| 88531 主站 | <https://www.88531.cn> | 软件工具与资源分享主站 |
| 在线文档 | <https://doc.88531.cn> | 安装配置与使用教程 |
| 资源合集 | <https://link3.cc/88531cn> | 全部项目入口与工具合集 |
| 免费 AI KEY | <https://ai.88531.cn> | OpenAI 兼容大模型网关（AI 教练后端） |
| 资享博客 | <https://personal82555.github.io> | 软件与工具分享博客 |
| 网盘资源导航 | <https://github.com/personal82555/mrfx-resource-hub> | 全网网盘资源集合 |

## 📄 License

MIT © 2026 摸鱼棋乐
