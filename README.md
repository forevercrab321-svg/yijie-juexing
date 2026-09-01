# 异界觉醒 · 转生·艾塞尔加德公会

把纽约真实地图套上异世界设定的社区互助原型：实名觉醒 → 面部解析生成专属形象 → 在地图上接取悬赏 → 到现场提交证明。公会长「艾琳娜」由 MiniMax T2A 提供语音。

## 架构

```
浏览器
  ├── React 19 + Vite + Leaflet
  └── services/api.ts ──POST /api/*──┐
                                      │  （浏览器侧不持有任何 API key）
                          ┌───────────┴───────────┐
                          │                       │
              vite.config.ts dev 中间件      functions/api/*.ts
                    （本地开发）           （Cloudflare Pages Functions）
                          │                       │
                          └────── server/ai.ts ───┘
                                （唯一持有 MINIMAX_API_KEY 的地方）
                                          │
                                    /v1/t2a_v2
                                  艾琳娜语音 (speech-2.6-hd)
```

**运行时只剩语音一个模型调用。** 玩家相貌从 `public/assets/avatars/` 随机抽取，是现成的图片文件——应用不采集摄像头、不处理生物特征、不向任何模型发送用户数据。

固定台词的语音已预生成到 `public/audio/elena/`，连 TTS 都不会在这些场景触发；只有含动态内容的语音才走 `/api/tts`。

本地与生产共用 `server/ai.ts` 里的同一份 handler，不会出现"本地能跑、线上行为不一样"。

所有 AI 调用统一走 MiniMax，计入同一份 token plan。美术风格统一为 **2D 插画**。

## 本地运行

**前置**：Node.js 22+

1. 安装依赖
   ```bash
   npm install
   ```

2. 配置环境变量
   ```bash
   cp .env.example .env.local
   ```
   在 `.env.local` 中填入 `MINIMAX_API_KEY`（MiniMax 控制台 → 账号管理 → API Keys）。

   > **不要**给任何变量加 `VITE_` 前缀，也不要在 `vite.config.ts` 里用 `define` 注入它们——那会把密钥明文编译进前端 bundle。

3. 生成静态资产（**首次必须执行一次**）
   ```bash
   npm run assets
   ```
   用 MiniMax 生成 8 张静态图与艾琳娜的固定语音，输出到 `public/assets/` 与 `public/audio/elena/`。
   已存在的文件会被跳过，不会重复烧额度；要重做加 `-- --force`。

4. 启动
   ```bash
   npm run dev
   ```
   访问 http://localhost:3000 。`/api/*` 由 dev 中间件在同一进程内处理，无需另开服务。

## 环境变量

| 变量 | 必填 | 说明 |
|---|---|---|
| `MINIMAX_API_KEY` | 是 | MiniMax API key。生产环境设为 Secret 类型。 |
| `ALLOWED_ORIGINS` | 生产必填 | 逗号分隔的正式域名。**留空会放行 localhost**。 |
| `MINIMAX_GROUP_ID` | 否 | Chat Completions 不需要；T2A 在部分区域要求。配置后会作为查询参数附加到 `/v1/t2a_v2`。 |
| `MINIMAX_BASE_URL` | 否 | 默认全球站 `https://api.minimax.io`（美国/海外 token plan 用这个）。美西低延迟节点 `https://api-uw.minimax.io`，中国大陆账号 `https://api.minimaxi.chat`。**区域端点只影响延迟，不构成数据驻留承诺**，见 PRIVACY.md 4.3。 |
| `MINIMAX_TTS_VOICE_ID` | 否 | 默认 `Chinese (Mandarin)_Lyrical_Voice`。换音色不需要改代码。 |

## 类型检查与构建

```bash
npm run typecheck
```

```bash
npm run build
```

## 部署（Cloudflare Pages）

构建命令 `npm run build`，输出目录 `dist`，`functions/` 会被自动识别为 Pages Functions。在 Pages 项目设置中配置上表的环境变量。

可选：绑定一个 KV 命名空间到 `RATE_LIMIT_KV`，让限流跨实例生效。未绑定时退化为单实例内存计数，多实例部署下会漏算。

换用 Vercel / Netlify 时，只需把 `functions/api/*.ts` 的三行适配层重写为对应平台的签名，`server/` 目录无需改动。

## 接入 MiniMax 时的三个坑

代码里已经处理了，改动这块时别退回去：

1. **HTTP 200 不代表成功。** 鉴权失败（1004）、限流（1002）、余额不足都会以 200 + `base_resp.status_code != 0` 返回。只看 `res.ok` 会拿到一个没有音频的"成功"响应。见 `assertUpstreamOk()`。
2. **T2A 返回 hex 编码音频**，不是 base64。服务端转成 base64 再下发，否则传输体积翻倍。见 `hexToBase64()`。
3. **Chat Completions 不支持 `response_format` / JSON schema。** 输出约束只能写在 prompt 里，回复可能裹着 ` ```json ` 围栏或带前后说明文字。见 `extractJson()` 的逐层降级解析。
4. **图像生成的 `image_urls` 24 小时后失效**（仅 `scripts/build-assets.ts` 用到）。脚本用 `response_format: "base64"` 直接落盘，不依赖那个链接。

## 安全与合规

密钥处理、同意机制、数据留存，以及**尚未闭合的风险与上线检查清单**，见 [PRIVACY.md](PRIVACY.md)。

上线前至少确认这几条：

- `ALLOWED_ORIGINS` 已设为正式域名
- 任务到场校验目前仍在客户端判定，可被改过的客户端绕过——奖励发放需要移到服务端才算闭合
- **人脸数据交给第三方，且对方公开条款在存储地点、训练用途、留存期限上均为空白**，需法务评估或改走"去掉面部分析"的降级路径（PRIVACY.md 4.3）

## 艾琳娜

角色设定、台词、立绘提示词全部集中在 [lib/elena.ts](lib/elena.ts)，那是她唯一的定义来源：

- `ELENA_PERSONA` —— 语气基调、立绘提示词、**能做的事与不做的事**。语音和形象共用这一份设定，保证"听起来的她"和"看起来的她"是同一个人。
- `ELENA_LINES` —— 全部固定台词，每条一个稳定 id。

改台词或改形象后重跑 `npm run assets`（立绘用固定 seed，便于迭代时保持形象连续性）。

运行时优先播放 `public/audio/elena/{id}.mp3`，**零延迟、零额度消耗**；文件缺失时自动退回实时合成，不会静音。只有含动态内容的台词才走实时 TTS。

未来换成 3D 模型时，`ELENA_PERSONA.visualPrompt` 就是建模的角色设定依据。

## 角色：相貌随机，职业自选

- **相貌**由转生抽选随机决定，可以无限重抽（[lib/avatar.ts](lib/avatar.ts)）。立绘是 `public/assets/avatars/` 下现成的图片，抽中哪张就是哪张。想调整每个种族的立绘数量，改 `VARIANTS_PER_RACE` 并按序号补图即可。
- **职业**由玩家自己选（`Profession` 枚举 + `PROFESSION_CONFIG`）。每个职业都标注了**现实中对应的能力**——这是「真实 + 游戏」的接缝：游戏里是身份，线下活动里决定你能承担什么角色。职业同时决定 Pro 执照申请里的专长领域，不必重复填写。

图片规格与替换方式见 [public/assets/README.md](public/assets/README.md)。

## 本地档案

用户的代号、等级、金币与**专属卡通形象**存在 `localStorage`（`aethelgard:session:v1`）。形象只生成一次就固定下来 —— 既保证每次打开都是同一个自己，也不会重复烧额度。

清除入口在「个人档案 → 清除本设备数据」，这是用户撤回同意的出口，不要移除或隐藏。

## 已知问题

- mock 数据里的配图（任务卡片、公会横幅、动态流）仍引用 Unsplash。它们属于示例数据，接真实数据时会一并替换。

## 目录

```
server/          平台无关的服务端 handler（唯一接触 API key 的地方）
functions/api/   Cloudflare Pages Functions 适配层
services/        前端 API 客户端
lib/             证件号处理、地理计算
components/      UI 组件
```
