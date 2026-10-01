# 异界觉醒 · 转生·艾塞尔加德公会

把纽约真实地图套上异世界设定的社区互助原型：觉醒建档 → 在 3D 风格化纽约里接取委托 → 真实 GPS 到场 → 提交证明结算。公会长「艾琳娜」是可对话的 AI NPC（MiniMax 对话 + 语音），只管委托。

本版本（3D 世界地图垂直切片）的构建、包体、已知问题与测试指引见 [docs/studio/RELEASE.md](docs/studio/RELEASE.md)。

## 架构

```
浏览器
  ├── React 19 + Vite 6 + Tailwind（构建时编译）
  │     ├── components/world/scene/   Three.js 3D 世界（React.lazy 独立分包，three 只在这里）
  │     └── components/MapBoard.tsx   Leaflet 2D 回退（同样按需加载）
  └── services/api.ts ──POST /api/*──┐
                                      │  （浏览器侧不持有任何 API key）
                ┌─────────────────────┼─────────────────────┐
                │                     │                     │
    vite.config.ts dev 中间件   functions/api/*.ts        api/*.ts
          （本地开发）        （Cloudflare Pages      （Vercel Functions）
                │               Functions）                │
                └──────── server/ai.ts · server/chat.ts ───┘
                                （唯一持有 MINIMAX_API_KEY 的地方）
                                          │
                          /v1/t2a_v2          chat completions
                        艾琳娜语音 (2.8-hd)    艾琳娜的大脑 (stream + tools)
```

**运行时有两个模型调用：对话与语音。** 玩家相貌从 `public/assets/avatars/` 随机抽取，是现成的图片文件——应用不采集摄像头、不处理生物特征、不向任何模型发送用户数据。

固定台词的语音已预生成到 `public/audio/elena/`，连 TTS 都不会在这些场景触发；只有含动态内容的语音才走 `/api/tts`。

本地与生产共用 `server/ai.ts` 里的同一份 handler，不会出现"本地能跑、线上行为不一样"。

所有 AI 调用统一走 MiniMax，计入同一份 token plan。立绘与界面是 **2D 插画**，世界地图是**程序化生成的 3D 风格化纽约**（大地色系，参照《旷野之息》），没有任何外部 3D 资产或贴图请求。

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

3. 生成静态资产（可选——仓库已带立绘、横幅与艾琳娜的固定语音，直接跑不需要这一步）
   ```bash
   npm run assets
   ```
   用 MiniMax 重新生成静态图与艾琳娜的固定语音，输出到 `public/assets/` 与 `public/audio/elena/`。
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
| `ALLOWED_ORIGINS` | 生产必填 | 逗号分隔的正式域名，**精确匹配 origin**（含协议，不支持通配符）。**留空会放行 localhost**。预览环境（Vercel Preview、Pages 的分支预览）也要把预览域名加进来，否则艾琳娜会收到 `ORIGIN_DENIED`。 |
| `MINIMAX_GROUP_ID` | 否 | Chat Completions 不需要；T2A 在部分区域要求。配置后会作为查询参数附加到 `/v1/t2a_v2`。 |
| `MINIMAX_BASE_URL` | 否 | 默认全球站 `https://api.minimax.io`（美国/海外 token plan 用这个）。美西低延迟节点 `https://api-uw.minimax.io`，中国大陆账号 `https://api.minimaxi.chat`。**区域端点只影响延迟，不构成数据驻留承诺**，见 PRIVACY.md 4.3。 |
| `MINIMAX_TTS_VOICE_ID` | 否 | 默认 `Chinese (Mandarin)_Lyrical_Voice`。换音色不需要改代码。 |
| `MINIMAX_TTS_MODEL` | 否 | 默认 `speech-2.8-hd`（2.6 系列已列为 Legacy）。 |
| `MINIMAX_CHAT_MODEL` | 否 | 对话模型，默认 `MiniMax-M2.7`。**必须与账号实际开通的模型对上。** |
| `MINIMAX_CHAT_PATH` | 否 | 默认 `/v1/text/chatcompletion_v2`。收到 `AI_CHAT_PATH_INVALID` 就换 `/v1/chat/completions`。 |

## 3D 世界与 2D 回退

主界面默认是 Three.js（r180）渲染的 3D 纽约：玩家的真实 GPS 位置是世界里的角色，每个委托是立在真实坐标上的光柱，相机可拖动旋转、俯仰、缩放。

- **分包**：`components/world/scene/**` 是唯一允许 `import 'three'` 的地方，App 用 `React.lazy` 加载它。同意页、觉醒页不会请求这个分包；`dist/index.html` 里也没有它的 `<script>` 或 `modulepreload`。
- **WebGL2 预检**：three r180 只支持 WebGL2。挂载前先探测，不可用就直接进 2D，3D 分包根本不会下载。
- **回退**：运行中初始化失败、上下文丢失、分包加载失败都会调用 `onFallback(reason)`，App 切回 Leaflet 的 `MapBoard`，并在世界控件旁写明原因。上下文丢失这类瞬时故障允许再点一次「3D」重试。
- **手动切换**：右下世界控件的「2D / 3D」按钮。选择不跨刷新记忆。
- **接取只有一条路**：点光柱只打开聚焦卡片，卡片上的「承接契约」走 `App.tsx` 的 `handleAccept`，由艾琳娜确认（「契约签署完成」）。契约终端、公会紧急委托、艾琳娜的工具接取都走同一条路径。
- **画质档位**：手机或 ≤ 4 核判为低档（DPR ≤ 1.5、阴影 1024、30 fps 上限），桌面高档（DPR ≤ 2、阴影 2048、MSAA）。两档都不开后处理。URL 加 `?tier=high|low` 可强制。
- **调试钩子**：只在 URL 带 `?debug=1` 时挂载，生产默认关闭。`window.render_game_to_text()` 返回 JSON 字符串（相机、光柱与玩家的屏幕坐标、draw call / 三角形 / 纹理读数），`window.__world` 提供 `tapBeacon(id)`、`focusQuest(id)`、`setHour(h)`、`recenter()`、`stats()`。`WorldMap` 卸载（切 2D）时随之移除。

2D 地图的底图瓦片来自 Carto CDN，3D 世界不请求任何瓦片或外部资产。

## 类型检查与构建

```bash
npm run typecheck
npm run build
npm run preview   # 在 http://localhost:4173 预览 dist/，发布前测的应该是它而不是 dev server
```

Tailwind 已改为**构建时编译**（`tailwind.config.js` + `postcss.config.js`，入口 `index.css`），不再依赖 Play CDN。构建产物分三块：入口 chunk（React、界面、成长逻辑）、`WorldMap-*.js`（three + 场景，约 180 KB gzip，按需）、`MapBoard-*.js`（Leaflet，约 49 KB gzip，按需）。Rollup 对 `WorldMap` chunk 的「大于 500 kB」提示是预期内的——它不在首屏加载。各 chunk 的实测体积与预算见 [docs/studio/RELEASE.md](docs/studio/RELEASE.md)。

## 部署

两个平台共用同一份 `server/` handler，只有适配层不同；环境变量都是上表那几个。

### Cloudflare Pages

构建命令 `npm run build`，输出目录 `dist`，`functions/` 会被自动识别为 Pages Functions（`functions/api/chat.ts`、`functions/api/tts.ts`）。在 Pages 项目设置中配置环境变量，并把 `NODE_VERSION` 设为 `22`。

可选：绑定一个 KV 命名空间到 `RATE_LIMIT_KV`，让限流跨实例生效。未绑定时退化为单实例内存计数，多实例部署下会漏算。

### Vercel

仓库根目录的 `vercel.json` 已声明 `framework: vite`、`buildCommand: npm run build`、`outputDirectory: dist`；`api/chat.ts` 与 `api/tts.ts` 是 Vercel Functions 适配层（Web 标准签名 `export async function POST(request: Request)`），导入 GitHub 仓库即可部署，不需要额外配置。

- 在 Project Settings → Environment Variables 里配置 `MINIMAX_API_KEY`（Sensitive）与 `ALLOWED_ORIGINS`，**Production 与 Preview 两个环境都要配**：预览部署没有 key 时艾琳娜会提示「还没配置 MINIMAX_API_KEY」；没有把预览域名写进 `ALLOWED_ORIGINS` 时她会收到 `ORIGIN_DENIED`。预览域名建议用固定的分支别名（`https://<project>-git-<branch>-<team>.vercel.app`）而不是每次都变的部署 URL。
- Vercel 没有 KV 绑定，限流固定为单实例内存计数。
- `functions/` 目录在 Vercel 上会被忽略，`api/` 在 Cloudflare 上不会进入 `dist`，两边互不干扰。

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

她是一个**能即兴对话、并且能动手接委托的 NPC**，不只是按钮触发的固定台词。
对话架构、怎么给她定性格、怎么接本地语音输入，见 [docs/elena-agent.md](docs/elena-agent.md)。

- **性格**在 `ELENA_PERSONALITY`，一个普通对象，改完刷新即生效，不必重跑脚本。
- **边界**在 `ELENA_SCOPE`，与性格分开放——她**只管委托**：发布、讲解、
  确认还在不在、**确认接取**。所有委托的接取都经她之手。委托之外的事她不碰。
- **语音输入**是 `lib/agent/stt.ts` 里的一个插槽，目前为空。不接任何云端 ASR，
  由本地开源引擎在浏览器里完成，音频不出设备。

角色设定、台词、立绘提示词、性格与系统提示词全部集中在 [lib/elena.ts](lib/elena.ts)，那是她唯一的定义来源：

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

用户的代号、等级、魔素（经验）、金币、信任值、公会贡献、已完成委托与**专属卡通形象**存在 `localStorage`（`aethelgard:session:v1`）。形象只生成一次就固定下来 —— 既保证每次打开都是同一个自己，也不会重复烧额度。成长数值由 `lib/progression.ts` 的 `settleQuest()` 结算，按委托自己的 `rewardGold` / `trustPoints` 发放；旧档案会在读取时由 `normalizeProgress()` 补齐新字段。

清除入口在「个人档案 → 清除本设备数据」，这是用户撤回同意的出口，不要移除或隐藏。

## 已知问题

完整清单（含 QA 未关闭的缺陷、沙箱测不到的项）见 [docs/studio/RELEASE.md](docs/studio/RELEASE.md)。

- mock 数据里的配图（任务卡片、公会横幅、动态流）仍引用 Unsplash。它们属于示例数据，接真实数据时会一并替换。
- 艾琳娜的立绘（`public/assets/elena/*.jpg`）尚未产出，界面里是占位。
- 进行中的委托只在内存里，刷新页面后要重新接取（成长与已完成记录会保留）。

## 目录

```
server/                  平台无关的服务端 handler（唯一接触 API key 的地方）
functions/api/           Cloudflare Pages Functions 适配层
api/                     Vercel Functions 适配层
services/                前端 API 客户端
lib/agent/               艾琳娜的工具定义、工具执行、对话状态、本地语音插槽
lib/progression.ts       等级曲线、结算（settleQuest）、接取门槛
lib/                     证件号处理、地理计算、本地档案
components/world/scene/  Three.js 3D 世界（唯一允许 import three 的地方；worldEvents.ts 零依赖）
components/world/ui/     世界界面：TopHud、WorldControls、QuestFocusCard、SettlementToast
components/              其余 UI 组件（MapBoard 为 2D 回退）
docs/studio/             工作室流程、简报、交接与发布说明
```
