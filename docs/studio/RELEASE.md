# 发布说明 · 3D 世界地图垂直切片（M4 发布候选）

| 项 | 内容 |
|---|---|
| 版本 | 3D 世界地图垂直切片（分支 `claude/great-davinci-1q0q45`，基于检查点 `534a7da`） |
| 角色 | release-engineer |
| 调用的 skill | `threejs-qa-release`（含 `references/release-checks.md`） |
| 日期 | 2026-10-01 |
| 结论 | **可以发布候选。** 生产构建通过、调试钩子默认关闭、three 独立分包且不阻塞首屏、两个平台的部署配置一致。遗留 7 个 P3 缺陷与若干沙箱测不到的项，全部列在第 6 节，没有 P0 / P1。 |

闸门对照（`docs/studio/PIPELINE.md` M4）：生产构建通过 ✅ · 调试钩子默认关闭 ✅ · 3D 代码分包不阻塞首屏 ✅。

---

## 1. 构建结果

在仓库根目录实际执行（Node 22、Vite 6.4.3）：

```
npm run typecheck   → tsc --noEmit，0 错误，退出码 0
npm run build       → vite build，1796 个模块，6.33 s，退出码 0
```

产物（`vite build` 原样输出，gzip 为 Vite 估算；另用 `gzip -9` 复核，差异 < 2 KB）：

| 产物 | 原始 | gzip | 预算（简报 7.2） | 结果 | 何时加载 |
|---|---|---|---|---|---|
| `dist/index.html` | 8.43 KB | 3.75 KB | — | — | 首屏 |
| `assets/index-*.js`（入口：React、界面、成长逻辑） | **381.38 KB** | **118.67 KB** | ≤ 520 KB / ≤ 165 KB | ✅ 余量 27% / 28% | 首屏 |
| `assets/index-*.css`（Tailwind 构建时编译） | 66.45 KB | 11.60 KB | ≤ 80 KB / ≤ 18 KB | ✅ | 首屏 |
| `assets/WorldMap-*.js`（three r180 + 场景） | **644.12 KB** | **181.57 KB** | ≤ 650 KB / ≤ 190 KB | ✅ 余量仅 0.9% / 4.4% | 进入主界面且 WebGL2 可用时 |
| `assets/MapBoard-*.js`（Leaflet + react-leaflet） | 161.91 KB | 48.69 KB | — | — | WebGL2 不可用或手动切 2D 时 |
| `assets/MapBoard-*.css` | 15.04 KB | 6.38 KB | — | — | 同上 |

Rollup 的「chunks larger than 500 kB」提示指向 `WorldMap` chunk，是预期内的：它不在首屏，且在预算之内。

`dist/` 共 22 MB，其中 19 MB 是 `public/` 原样拷贝的静态资产（48 张立绘、10 段艾琳娜语音、`hero-landing.jpg` 509 KB、`world-hero.jpg` 385 KB）。它们不影响 JS 体积，但两张横幅图未压缩（见 6.3）。

### 1.1 three 是否独立分包、首屏是否被阻塞

| 检查 | 方法 | 结果 |
|---|---|---|
| three 只在 3D chunk | `grep -o WebGLRenderer dist/assets/*.js \| wc -l` | `WorldMap-*.js` 32 处；`index-*.js` **0** 处；`MapBoard-*.js` 0 处 ✅ |
| Leaflet 不在入口 | 同上 grep `leaflet` | 仅 `MapBoard-*.js` 命中（108 处）✅ |
| 源码边界 | `grep -rln "from 'three" --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=docs --exclude-dir=.claude .` | 只命中 `components/world/scene/` 下 12 个文件 ✅（QA-R1-16 要求的排除项已加） |
| `index.html` 不引用 3D chunk | 读 `dist/index.html` | 只有 `index-*.js` 的 `<script type="module">` 与 `index-*.css`；没有 `WorldMap` / `MapBoard` 的 script 或 `modulepreload` ✅ |
| 新玩家首屏不下载 3D | Playwright 新 context 打开同意页（M4-FIRST） | 请求列表里的 JS 只有 `/assets/index-C7rBvSN0.js` ✅ |
| 首屏之外的第三方请求 | 生产页从首屏跑到 3D 世界，统计请求主机 | 只有 `127.0.0.1:4177` 与 `fonts.googleapis.com`。`index.html` 里残留的 `importmap`（aistudiocdn.com）没有触发任何请求（见 6.3） |
| 前端没有密钥 | grep `sk-` / JWT 形态 / `process.env` / `import.meta.env` | 全部 0 命中。`index-*.js` 里唯一出现的 `MINIMAX_API_KEY` 字样是给玩家看的提示文案「还没配置 MINIMAX_API_KEY。」（`hooks/useElenaAgent.ts:99`），不是值 ✅ |

---

## 2. 调试钩子只在 `?debug=1` 下挂载

**读代码：**

- `components/world/scene/debug.ts:29-36` `debugEnabled()` 严格比较 `URLSearchParams.get('debug') === '1'`；`:38` 不满足时 `installDebugHooks()` 直接返回空的卸载函数，`window.render_game_to_text` 与 `window.__world` 根本不会被赋值。
- `components/world/scene/WorldMap.tsx:76` 在挂载 effect 里 `installDebugHooks(engine)`，`:77-80` 清理函数先 `uninstall()` 再 `engine.dispose()`——切 2D 或卸载时钩子随之移除。`debug.ts:51-54` 只删除属于自己的那一份，StrictMode 双挂载也不会误删。
- 没有其他地方写这两个全局（全仓库 grep `__world|render_game_to_text` 只命中 `debug.ts` 与 `beacons.ts` 的一条注释）。

**Playwright 实测**（`vite preview --port 4177` 上的生产构建，无头 Chromium + SwiftShader，脚本 `scratchpad/qa-tools/m4-release.mjs`，结果 `scratchpad/release/release-checks-*.json`，截图 `scratchpad/qa-shots/m4-release/`）：

| 用例 | 结果 |
|---|---|
| M4-GATE-none：不带参数进入 3D 世界，等 12 s | `typeof window.render_game_to_text === 'undefined'`、`typeof window.__world === 'undefined'`，画布存在 ✅ |
| M4-GATE-debug=0 / debug=true：两个近似值 | 同样不挂载 ✅ |
| M4-DEBUG-mounted：`?debug=1` | 两者存在，`render_game_to_text()` 可 `JSON.parse` ✅ |
| M4-DEBUG-contractC | `mode`、`camera{position,target,tilt,heading,zoom}`、`focusedQuestId`、`activeQuestId`、`beacons[{id,screen{x,y},onScreen}]`（13 根）、`player{screen,onScreen}`、`renderer{drawCalls,triangles,geometries,textures,fps,…}` 全部在 ✅ |
| M4-DEBUG-api | `__world.tapBeacon / focusQuest / setHour / recenter / stats` 均为函数（另有扩展 `setView`）✅ |
| M4-DEBUG-tapBeacon | `tapBeacon('q1')` → `focusedQuestId === 'q1'`，聚焦卡片出现 ✅ |
| M4-TOGGLE-hooksRemoved：`?debug=1` 下点世界控件「2D」 | `.leaflet-container` 出现后两者都被删除、3D 画布已移除 ✅（切换耗时 16.8 s，软件渲染下 `forceContextLoss` 的已知开销，见 QA-R1-12） |
| M4-NOGL-fallback2d：`--disable-webgl` 浏览器 | 直接进 2D，提示「此设备不支持 WebGL2，已使用 2D 地图」，**未请求** `WorldMap` chunk ✅ |
| 控制台 | 以上所有 context：pageerror 0、非环境噪音的 console.error 0（噪音只有 Google 字体证书 1 条） |

合计 19 / 19 通过。

---

## 3. 渲染读数（沙箱证据，fps 不作结论）

读 `render_game_to_text().renderer` 与 `__world.stats()`。沙箱是 4 核，`detectTier()` 会把桌面也判为低档，所以桌面高档用 `?tier=high` 强制读取。

| 视角 | tier | dpr | drawCalls | triangles | geometries | textures | textureMB | shadowMap | postPasses | 预算（简报 M3-01 / M3-02） |
|---|---|---|---|---|---|---|---|---|---|---|
| 桌面 1440×900 默认（判为低档） | low | 1 | 27 | 194,020 | 27 | 3 | 9 | 1024 | 0 | — |
| 桌面 1440×900 `?tier=high` | high | 1 | 28 | 410,540（live 250,730） | 27 | 3 | 36 | 2048 | 0 | ≤ 160 / ≤ 500k / ≤ 150 / ≤ 32 / ≤ 128 ✅ |
| 手机 390×844 @3x | low | 1.5 | 28 | 194,028 | 27 | 3 | 9 | 1024 | 0 | ≤ 100 / ≤ 250k / ≤ 120 / ≤ 16 / ≤ 32 ✅ |

SwiftShader 下 fps 为 0.4–1，与真机无关；真机帧率与发热列为 **UNVERIFIED**（第 6.2 节给出真机读法）。

---

## 4. 部署配置：Vercel 与 Cloudflare 一致性

| 项 | Cloudflare Pages | Vercel | 一致？ |
|---|---|---|---|
| 构建 | 项目设置：`npm run build` → `dist` | `vercel.json`：`framework: vite`、`buildCommand: npm run build`、`outputDirectory: dist` | ✅ |
| 适配层 | `functions/api/chat.ts`、`functions/api/tts.ts`（`onRequestPost`） | `api/chat.ts`、`api/tts.ts`（Web 标准 `export async function POST(request)`） | ✅ 都只接 POST |
| handler | `server/chat.ts` `handleChat`、`server/ai.ts` `handleTts` | 同一份 | ✅ |
| 错误出口 | `errorResponse(err)` | 同 | ✅ |
| 环境变量 | `context.env` 直接透传（8 个 MiniMax / ALLOWED_ORIGINS 变量 + 可选 `RATE_LIMIT_KV`） | `envFromProcess()` 从 `process.env` 逐个取同样 8 个 | ✅ 字段集相同；Vercel 无 `RATE_LIMIT_KV`，按代码设计退化为内存限流 |
| 客户端 IP | `CF-Connecting-IP` | 退回 `X-Forwarded-For`（`server/security.ts:81-87`） | ✅ 两边都覆盖 |
| 互不干扰 | `api/` 不在 `dist`，不会被当静态文件 | `functions/` 被 Vercel 忽略 | ✅ |
| 服务端依赖图 | `server/*` → `lib/elena.ts`、`lib/agent/tool-schema.ts`；不引 React / three | 同 | ✅ |
| 密钥 | 只在平台环境变量；`.gitignore` 排除 `.env*`、`.dev.vars` | 同 | ✅ |

**部署步骤**

- Cloudflare Pages：连仓库 → 构建命令 `npm run build`、输出 `dist` → 环境变量按 README 表配置，`NODE_VERSION=22` → 可选绑定 KV 到 `RATE_LIMIT_KV`。
- Vercel：导入仓库即可（`vercel.json` 已就位）→ Project Settings → Environment Variables 配置 `MINIMAX_API_KEY`（Sensitive）与 `ALLOWED_ORIGINS`，**Production 与 Preview 都要配**。
- 预览环境的两条硬要求（已写进 README）：没有 `MINIMAX_API_KEY` 时艾琳娜对话与实时语音不可用（界面提示「还没配置 MINIMAX_API_KEY」，固定台词的预生成语音仍可播）；`ALLOWED_ORIGINS` 是精确匹配，预览域名不在其中会得到 `ORIGIN_DENIED`。

**README 本次更新**（`README.md`）：标题段改为 3D 世界的玩法循环并链接本文件；架构图加入 Three.js 3D 世界、Leaflet 回退、`api/*.ts` Vercel 适配层；美术方向一句改为「立绘 2D、世界 3D 程序化」；`npm run assets` 改为可选（资产已入库）；`ALLOWED_ORIGINS` 行补充精确匹配与预览域名；新增「3D 世界与 2D 回退」一节（分包、WebGL2 预检、回退原因、手动切换、接取路径、画质档位、`?debug=1` 钩子）；「类型检查与构建」补 `npm run preview`、Tailwind 构建时编译与三块 chunk 的说明；「部署」拆成 Cloudflare Pages 与 Vercel 两小节，删掉「换 Vercel 要重写适配层」的过时说法；「本地档案」补成长字段与 `settleQuest`；「已知问题」链接本文件并加两条；「目录」补 `api/`、`lib/progression.ts`、`components/world/**`、`docs/studio/`。

---

## 5. 本版本内容摘要（给测试者的背景）

- 3D 世界：`components/world/scene/**`，程序化曼哈顿 + 周边、三座桥、地标、昼夜；玩家 GPS 位置是角色，13 个委托是光柱；Pokémon GO 式轨道相机（俯仰 35°–70°、旋转、缩放）。
- 2D 回退：WebGL2 不可用、初始化失败、上下文丢失、分包加载失败 → Leaflet `MapBoard`；也可手动切换。
- 玩法缺口已补：`lib/progression.ts` 的 `settleQuest()` 按委托的 `rewardGold` / `trustPoints` 结算，魔素与贡献随之增长，执照「推荐」条件（trustScore > 110）可以达成；委托从 3 个扩到 13 个，18 个职业都至少被 2 个委托点名。
- 接取仍只有一条路：所有入口 → `App.tsx` `handleAccept` → 艾琳娜「契约签署完成」。

---

## 6. 已知问题与风险

### 6.1 QA 未关闭的缺陷（M3 回归最终一轮，全部 P3，无 P0 / P1）

| ID | 严重度 | 区域 | 问题 | 建议 |
|---|---|---|---|---|
| QA-R2-01 | P3 | ui | 觉醒「转生鉴定书」确认卡：姓名 / 种族 / 职业文字压在浅色立绘上，渐变遮罩只在底部变暗。`components/VerificationModal.tsx:406` | **已修复**：遮罩改为 `from-slate-950 via-slate-950/60 to-slate-950/5`，盖到卡片中部的文字区 |
| QA-R2-02 | P3 | ui | 无定位 / 不在纽约时，世界控件常驻的「回到我」提示框盖住默认视角里 q5 光柱的图标（仅视觉；`.wui-note` 是 `pointer-events:none`，光柱仍可点） | 提示框移到控件上方或改为图标 + 悬停文案 |
| QA-R2-03 | P3 | ui | 切到英文后，证明提交面板（`ProofSubmission`）文案仍是中文 | 补齐英文串 |
| QA-R1-11 | P3 | ui | 手机 390×844 上结算卡片盖住画面中心的玩家与 celebrate 演出上半部分 | 手机上把卡片贴到 TopHud 之下，或结算时镜头目标下移 |
| QA-R1-12 | P3 | integration | 切 2D / 上下文丢失回退时 `dispose()` 同步 `forceContextLoss`，软件渲染下主线程阻塞 13–17 s（本轮实测 16.8 s）。真机应为毫秒级，**待真机确认** | 先让 2D 画出来再异步归还上下文 |
| QA-R1-13 | P3 | other | 艾琳娜立绘资产缺失（`public/assets/elena/*.jpg` 不存在）；契约终端占位把原始路径当文字显示（`components/BountyBoard.tsx:99`） | 占位只保留图标与名字；资产生成 API 未配置属既有限制 |
| QA-R1-15 | P3 | integration | 进行中的委托不跨刷新保存（`activeQuestId` / `startTime` 只在 React state），刷新或被系统回收后需重新接取 | 把进行中状态落到 `localStorage` 存档 |
| QA-R1-16 | P3 | other | M2-02 的验证命令按字面执行会命中 docs 与 vendored skill 模板 | 已在本文件 1.1 节用排除 `docs/`、`.claude/` 的命令复核，产品本身满足要求 |

**发布后追加修复**（觉醒第 2 步「转生抽选」）：「重新转生」原先跟随立绘在滚动区内，极矮视口（1000×546）下被滚动区下缘裁掉一半、看起来像被主按钮压住；现与「就是这个我」并排钉在底部、都不进滚动区，矮视口（≤640px）下副标题隐藏、标题缩一号。QA 的 `qa-r2-awaken-sizes.mjs` 在 11 种视口下 33/33 通过。

### 6.2 沙箱测不到、需要真机 / 真环境确认的项（UNVERIFIED）

| 项 | 为什么测不到 | 怎么验 |
|---|---|---|
| 真实 GPU 帧率与发热 | SwiftShader 软件渲染，fps 0.4–1 无参考价值 | 真机打开 `?debug=1`，控制台 `JSON.parse(render_game_to_text()).renderer.fps`，步行 10 分钟观察发热；低档上限 30 fps 是刻意的 |
| 真机 GPS | 沙箱只能注入固定坐标 | 在曼哈顿实地走到任一委托 200 m 内，看 HUD 距离与「已确认到场」；楼群里定位超时时告知条应在信号恢复后消失（QA-R1-04 已修） |
| 真机触控手感 | 无头浏览器的触控是合成事件 | 单指拖动旋转 / 平移、双指捏合缩放与扭转、轻触光柱不误触发拖动 |
| 艾琳娜对话与实时语音 | 沙箱没有 `MINIMAX_API_KEY`，`/api/*` 一律报错 | 配好 key 与 `ALLOWED_ORIGINS` 的预览环境里，打开契约终端听问候、在对话里让她接一个委托 |
| Vercel Functions 的流式 SSE（`/api/chat`） | 沙箱没有 Vercel 运行时 | 预览部署里看艾琳娜是否逐字出现而不是整段一次吐出 |
| Cloudflare Pages Functions 实际打包 | 同上 | Pages 预览分支里 `/api/tts` 返回 JSON 而不是 HTML |
| 2D 回退底图 | Carto 瓦片在沙箱被拦，2D 是空白底图 | 真环境里 Leaflet 底图应正常显示 |
| 上下文丢失恢复 | 软件渲染下 `loseContext` 本身要十几秒 | 手机切后台再回来、或 `__world` 不可用时看是否自动切 2D 并允许点「3D」重试 |

### 6.3 发布工程师本轮新发现的风险（非阻断）

| 项 | 影响 | 建议 |
|---|---|---|
| `index.html:196-207` 残留 AI Studio 的 `importmap`（指向 `aistudiocdn.com` 的 react / leaflet / lucide），会原样进入 `dist/index.html` | Vite 打包后没有裸模块说明符，实测**没有任何请求**打到该 CDN；但它是无用的第三方引用，CSP 审计时会被问到 | 下个版本删除 |
| `WorldMap` chunk 644.12 KB，距 650 KB 原始体积预算只剩 0.9% | 任何再往场景里加 three/examples 的工具都会超预算 | 新增前先看 `vite build` 输出；需要时把预算调整写进简报 |
| `hero-landing.jpg` 509 KB、`world-hero.jpg` 385 KB 未压缩 | 同意页 / 觉醒页首屏多下载约 0.9 MB | 转 WebP 或压到 ≤ 150 KB |
| 字体依赖 Google Fonts（`fonts.googleapis.com`） | 中国大陆或弱网下首屏字体回退为系统字体（`display=swap`，不阻塞） | 自托管 Cinzel / Noto Serif SC 子集 |
| 到场校验在客户端（`components/ProofSubmission.tsx` 用 `distanceMeters ≤ 200`） | 改过的客户端可刷分；`?debug=1` 不会放宽这条，但桌面模拟定位可以 | PRIVACY.md / README 已声明；奖励发放移到服务端前不要接真实激励 |
| mock 数据的配图引用 Unsplash（`constants.ts` 3 处） | 第三方图片请求 | 接真实数据时替换 |
| `.gitignore` 没排除 `.vercel/` | 本地用 `vercel` CLI 链接项目后会生成 `.vercel/project.json` | 加一行 `.vercel/` |

---

## 7. 测试指引（5–8 步试玩路径）

**准备**

- 线上：打开预览 / 正式地址。本地：`npm run build && npm run preview`，访问 http://localhost:4173（`npm run dev` 走的是 dev server，发布验证请用 preview）。
- 桌面浏览器模拟定位（Chrome / Edge）：DevTools → 右上「⋮」→ More tools → **Sensors** → Location 选 *Other…*，填纬度 `40.7580`、经度 `-73.9855`（时代广场，也是委托 q1 的坐标）。Firefox：`about:config` 把 `geo.provider.network.url` 设为 `data:application/json,{"location":{"lat":40.7580,"lng":-73.9855},"accuracy":15}`。要测「不在纽约」就填上海 `31.23, 121.47`。
- 重来一遍：个人档案 → 「清除本设备数据」，或在控制台 `localStorage.removeItem('aethelgard:session:v1')` 后刷新。

**路径**

1. **同意页**：勾选「账号与档案」与「精确位置」，点「我已阅读并同意所勾选的项目」。此时请求列表里不应出现 `WorldMap-*.js`。
2. **觉醒**：起名 → 转生抽选（可以重抽）→ 选职业 → 「转生鉴定书」确认。（已知 QA-R2-01：抽到浅色立绘时文字可读性差。）
3. **进入 3D 世界**：看到羊皮纸加载画面后进入开场镜头；等镜头落定。拖动旋转、滚轮 / 双指缩放、右下世界控件：「2D」切换、视角重置、「回到我」。没有定位或不在纽约时「回到我」禁用并有提示。
4. **聚焦与接取**：点任一光柱 → 聚焦卡片显示距离、等级门槛、职业加成与奖励 → 「承接契约」。应听到 / 看到艾琳娜「契约签署完成」，光柱出冲击波，顶部出现进行中委托的 HUD。等级不足（q9 以上）或已有进行中委托时卡片会写明原因且不能接。
5. **到场与结算**：把模拟定位设到委托 200 m 内（q1 时代广场 `40.7580, -73.9855`；q5 中央车站 `40.7527, -73.9772`；q4 图书馆 `40.7532, -73.9822`）→ HUD 点 **SUBMIT** → 上传任意图片 → 评定 → 结算卡片逐项计数：金币、信任、魔素、贡献；升级时世界里有庆祝演出。顶栏等级 / 经验条 / 金币 / 信任随之变化。刷新页面：成长保留，进行中的委托不保留（QA-R1-15）。
6. **契约终端与艾琳娜**：右下「契約終端」看委托列表与她的问候；左下气泡打开对话。需要环境配好 `MINIMAX_API_KEY` 与 `ALLOWED_ORIGINS`，否则显示「还没配置 MINIMAX_API_KEY」或 `ORIGIN_DENIED`——这是配置问题，不是缺陷。
7. **2D 回退**：世界控件点「2D」→ Leaflet 地图，同一批委托变成图钉，弹窗里也能承接；再点「3D」回来。强制回退：Chrome 启动参数 `--disable-webgl`（或 chrome://flags 关闭 WebGL）后进入主界面，应直接是 2D 并提示「此设备不支持 WebGL2，已使用 2D 地图」。
8. **调试钩子（可选）**：URL 加 `?debug=1`（例如 `/?debug=1&tier=high`），控制台：
   ```js
   JSON.parse(render_game_to_text()).renderer   // drawCalls / triangles / textures / fps / tier / dpr
   __world.stats()                              // 另含 buildMs 与城市统计
   __world.setHour(22)                          // 固定到夜景；setHour(null) 恢复跟随本地时间
   __world.tapBeacon('q1')                      // 等同点击光柱
   __world.recenter()
   ```
   不带 `?debug=1` 时这两个全局必须不存在；切到 2D 后也必须消失。`?tier=high|low` 只改画质档位，不改玩法。

**环境噪音（不是缺陷）**：Google 字体证书失败回退系统字体；沙箱 / 内网里 Carto 瓦片被拦则 2D 底图空白；没有 MiniMax key 时 `/api/*` 报错。

---

## 8. 证据文件

- 构建日志：本文件第 1 节（与 `scratchpad/qa-r2/build.log` 一致，同一 commit）
- Playwright 脚本：`scratchpad/qa-tools/m4-release.mjs`、`m4-hosts.mjs`
- 结果：`scratchpad/release/release-checks-gate_debug_first.json`、`release-checks-high_mobile_toggle_nogl.json`、`run-1.log`、`run-2.log`
- 截图：`scratchpad/qa-shots/m4-release/`（`desktop-nodebug-world.png`、`desktop-debug-world.png`、`desktop-debug-focus.png`、`desktop-high-debug-world.png`、`mobile-debug-world.png`、`desktop-2d-after-toggle.png`、`desktop-nowebgl-2d.png`、`desktop-consent-first.png`）
- QA 最终一轮：`scratchpad/qa-tools/qa-r2-out/`、`scratchpad/qa-shots/m3-qa-r2/`

（`scratchpad` = `/tmp/claude-0/-home-user-yijie-juexing/afd9be0c-d4b8-5c23-84c9-b9b289413d95/scratchpad`，不在仓库内。）
