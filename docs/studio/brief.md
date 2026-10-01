# 垂直切片简报 · 3D 世界地图

| 项 | 内容 |
|---|---|
| 版本 | v0.2「3D 世界地图垂直切片」 |
| 阶段 | M0 预制作 → M1 垂直切片生产（本简报是 M1 的唯一输入） |
| 负责人 | studio-director（调用 skill：threejs-game-director、gamestudio） |
| 日期 | 2026-10-01 |
| 依据 | `CLAUDE.md`、`docs/studio/PIPELINE.md`、`.claude/agents/*`、对 `App.tsx` / `MapBoard.tsx` / `types.ts` / `constants.ts` / `lib/geo.ts` / `lib/storage.ts` / `lib/agent/tools.ts` / `components/*` 的审计 |

固定接口契约 A–E 以工作流下发的原文为准，本简报**只补充、不改名、不删除**。所有补充字段都在第 6 节集中列出。

---

## 1. 一句话目标与设计支柱

**玩家幻想**：我所在的纽约，在另一个世界里醒了过来。我站在真实的街角，能看见光柱从需要帮助的地方升起；我走过去、帮上忙，公会会记住这件事。

**主情绪**：认出（这是我的城市）→ 惊奇（它被异界的光改写了）→ 掌控（镜头跟着手指走）→ 被需要（附近有一件适合我的真事）。

| 支柱 | 含义 | 本版本据此决定 |
|---|---|---|
| P1 真实的城市，异界的光 | 地理可认（岛形、两河、29° 街网、地标），渲染是大地色系的奇幻 | 程序化纽约 + 4 个地标；不接真实楼宇数据 |
| P2 委托就在身边，一眼看懂 | 光柱从任意角度都能读出：在哪、多远、急不急、适不适合我 | 光柱 + 聚焦卡片取代 Leaflet 弹窗 |
| P3 每一件善行都被记账 | 结算真实、可见、正确；信任与成长都会动 | `lib/progression.ts` 纯函数结算 + 结算演出 |
| P4 走出去，而不是盯着屏幕 | 3D 世界只是伴随地图，耗电和发热是一级约束 | 预算比 skill 的通用表更紧（第 7 节） |

**反支柱**（出现即判为缺陷）：霓虹 / 赛博朋克青紫 / 粗黑描边；屏幕内战斗或刷怪小游戏；新增任何数据采集或位置上传；假装精确（没有定位却显示距离、不在纽约却把角色放进城里）。

## 2. 核心循环契约

> 玩家在 3D 纽约里**拖动、缩放、点选委托光柱**，目的是**挑出一个够得着、适合自己的现实委托**。取舍来自三处：**距离、等级门槛、同一时间只能接一个**。接取由**艾琳娜确认**，到场提交证明后获得**金币、信任、经验、公会贡献**，并因此**升级、解锁执照资格**。如果不在现场（距离超过 200 m）或定位精度太差，提交会被拦下并**说明原因**，玩家可以重试。

| 时间尺度 | 内容 | 证据 |
|---|---|---|
| 秒级 | 转视角 → 看见光柱 → 点选 → 读卡片 → 决定接不接 | M2-06 … M2-09 |
| 一次会话 | 接一个委托 → 走过去 → 提交 → 结算演出 | M2-11、M2-12 |
| 长期 | 经验条与等级、信任分、执照资格、已完成委托不可重刷 | M2-10、M2-13、M3-20 |

## 3. 范围

### 3.1 做什么（In）

1. **3D 世界 `WorldMap`（契约 A）**：程序化风格化纽约，全部在本地生成，不发任何网络请求，也不用外部资产。
   - 曼哈顿岛轮廓、哈德逊河与东河水面。东岸（布鲁克林 / 皇后区）陆地铺到经度 -73.92，西岸铺到哈德逊河对岸边缘。
   - 街网顺时针偏约 29°。InstancedMesh 盒体建筑，中城与下城金融区两个高峰，中间（Village 一带）低矮。
   - 地标：时代广场广告牌、中央公园（绿地 + 实例化树木 + 水库）、布鲁克林大桥（双塔 + 桥面 + 拉索）、帝国大厦尖顶。
   - 屋顶灯笼与符文光；按本地时间计算昼夜，夜里窗户和灯笼会亮。
2. **委托光柱**：每个委托一根光柱，配底部光环与漂浮符文。紧急委托用 `--ember` 暖橙，普通委托用 `--gold`；两者在形状或动态上也要有区别（不能只靠颜色）。光柱不受雾影响。点击用射线拾取，命中半径照顾手指；拖动不触发点击。聚焦的光柱放大变亮；进行中的委托与玩家之间画一条发光路径（直线，不做街道寻路）。
3. **玩家角色**：放在真实 GPS 位置，带精度圈，可按 `userRace` 着色（在大地色系内）。没有定位或不在世界范围内时不放角色。
4. **相机**：Pokémon GO 式轨道相机，单指 / 左键拖动旋转，双指 / 滚轮缩放，俯仰角 35°–70°，默认正北朝上。焦点变化时缓动飞过去；有进行中的委托时同时框住玩家与目标。开场镜头 ≤ 2.5 s，任意按下立即交还控制。最大缩小时要能看见全部委托（作为发现委托的总览视角）。
5. **世界事件总线（契约 B）与调试钩子（契约 C）**。
6. **成长与结算（契约 D）**：`settleQuest` 纯函数；补齐金币、信任、经验、贡献的结算；已完成的委托不可重复结算；老档案迁移（`normalizeProgress`）。
7. **委托内容**：`INITIAL_QUESTS` 至少 12 个，18 个职业全覆盖，5 种类型都出现，坐标是真实纽约地点。
8. **界面组件（契约 E）**：`QuestFocusCard`、`WorldControls`、`TopHud`、`SettlementToast`。
9. **集成**：`React.lazy` 分包、WebGL 预检、`onFallback` 回退 2D、手动 2D/3D 切换、结算接线、叠层避让。

### 3.2 明确不做（Out）

| 不做 | 原因 |
|---|---|
| 真实楼宇 / 道路数据（OSM、矢量瓦片、真实楼高） | 需要网络与数据管线；本版本只证明「可认 + 好看 + 好用」 |
| 纬度 40.70–40.80 以外的细节（皇后区、布朗克斯、史坦顿岛、新泽西只铺低细节陆地边缘） | 委托都在这个范围内，砍掉不影响循环 |
| 外部生成资产（Tripo / Gemini / ElevenLabs：GLB、生成贴图、新音频） | 三个 key 都没有配置（CLAUDE.md） |
| 新增 npm 依赖 | 只用 `three` 与 `three/examples/jsm` |
| 服务端到场校验与奖励发放 | 交给待命的 network-engineer；本版本仍是客户端判定 |
| 多人同屏、其他玩家 | 同上 |
| 街道级导航 / 寻路 | 路径只是发光直线；需要导航时用现有的「MAPS」外链 |
| 改动艾琳娜（`lib/elena.ts`、`lib/agent/**`、`server/**`） | 她的接取工具会经 `onFocus` / `onAccept` 自动驱动 3D 世界，无需改动 |
| 改动存档键与版本（`lib/storage.ts`） | 改了会让所有老档案被当作「无存档」而丢失 |
| 生产环境的到场校验绕过（包括 `?debug=1`） | 等于开放刷分；测试者用浏览器的定位模拟 |
| 新组件的完整英文化 | 新文案以中文为主；`lang` 可作为可选 prop，不作为闸门 |
| 手动选择 2D 跨刷新记忆 | 低价值，留给后续版本 |

### 3.3 砍序（产能不足时从上往下砍；最后一行不可砍）

1. 漂浮符文的粒子细节 → 2. 种族着色 → 3. 夜景窗户的细节变化（保留按时间变化的光照色温）→ 4. Bloom 后处理（桌面档）→ 5. 东岸陆地的建筑（保留陆地面）→ 6. 布鲁克林大桥的拉索
**不可砍**：光柱与拾取、聚焦卡片、经艾琳娜接取、结算正确、2D 回退、调试钩子、存档兼容、性能预算。

## 4. 体验目标：进入世界后的前 30 秒

「前 30 秒」从主界面出现开始算：新玩家在觉醒流程结束后，老玩家在重新打开后。

| 时间 | 玩家看到 / 做到 | 应有的感受 | 对应要求 |
|---|---|---|---|
| 0–3 s | 世界风格的加载画面（羊皮纸底 + 金色符文），没有白闪；3D 分包在后台加载 | 安稳，不像网页卡住 | Suspense 加载画面 `world-loading` |
| 3–8 s | 开场镜头从高空落向自己的街角：岛形、两河、地标闪光，光照与现实时间一致；角色站在 GPS 位置，带精度圈 | **认出**：这是我的城市，但被改写了 | 开场镜头 ≤ 2.5 s，可打断（M3-15） |
| 8–15 s | 光柱在城市各处升起，最近的几根最醒目，紧急的是暖橙色；手指一拖镜头就跟着转，一捏就缩放 | **惊奇 + 掌控** | M2-04、M2-07、M3-09 |
| 15–25 s | 点最近的光柱 → 镜头滑过去 → 卡片升起：现实中要做什么、在哪、多远、奖励多少经验和金币、「适合你」 | **被需要**：附近有一件我做得到的真事 | M2-06、M2-09 |
| 25–30 s | 点「承接契约」→ 艾琳娜说「契约签署完成」→ 光柱冲击波 → 从我到目标亮起一条路 → 顶部出现进行中的委托 | 下一个目标清楚：走过去 | M2-08 |

**新手 30 秒自检**（ui-ux-audit 第 6 项，QA 在 M3 按 ✔ / △ / ✘ 判定）：知道主操作是点光柱 · 知道眼前目标是走到光柱处 · 知道成长怎么来（卡片上的奖励 + 顶部经验条）· 知道艾琳娜在哪 · 知道成功与失败的反馈是什么（结算演出 / 提交被拦的原因）。

**屏幕层级**（第一眼到第四眼）：★★★★★ 最近的光柱与自己的角色 → ★★★★ 聚焦卡片或进行中的委托 → ★★ 顶部档案（等级 / 经验）→ ★ 金币与信任数字。常驻 HUD 不得新增信息块：`TopHud` 取代旧的档案块，不是在旁边再加一块。

## 5. 关键设计约束（给 M1 各角色）

### 5.1 地理与世界范围
- 世界范围（玩家可被放置的范围）至少为纬度 40.695–40.805、经度 -74.03 – -73.92。**超出即判为「不在世界内」**：不放角色，相机以时代广场为中心，「回到我」禁用并说明「你目前不在纽约范围内」。**大多数测试者不在纽约**，这条必须做。
- 委托坐标（纬度 40.70–40.80、经度 -74.02 – -73.93）必须全部落在陆地上，用 `beacons[].onLand` 自证。
- 没有定位时，相机中心是时代广场 (40.7580, -73.9855)。

### 5.2 美术方向（CLAUDE.md，不可违背）
大地色系：暖褐、米黄、苔绿、陶土；低饱和、有色阴影、柔和边缘光，参照《旷野之息》。光柱和界面信号色只从 token 取：`--gold #c9a961`、`--gold-bright #e8cf94`、`--ember #c87a45`、`--verdigris #6d9b87`、`--parchment #ede4d3`。禁止青色、紫色发光，禁止霓虹。Bloom 若使用，阈值要高、强度要低，只给光柱、灯笼、广告牌用。

### 5.3 接取路径（产品设定：所有接取由艾琳娜确认）
- `QuestFocusCard.onAccept` → App 的 `handleAccept` → `acceptQuest`。只有这一条路径，不得另写接取逻辑。
- `worldEvents.emit({type:'pulse', questId})` 放在 **`acceptQuest` 内部**，这样艾琳娜通过工具接取（`silent: true`）时同样有演出。
- 2D 模式下，Leaflet 弹窗里的「承接契約」仍走 `handleAccept`。

### 5.4 结算与存档
- 提交证明的 `onConfirm` 改为 `settleQuest(user, activeQuest)` → `setUser(settlement.user)` → 显示 `SettlementToast`；`leveledUp` 为真时发出 `celebrate`。删除写死的 `level + 1` / `goldCoins + 100`。
- 等级**绝不下降**：`level = max(旧等级, levelFromMagicules(新经验))`。
- **老档案迁移**：现有档案里 `magicules` 恒为 0，而 `level` 可能已经 > 1（旧逻辑每次 +1）。读档时由 App 调用 `normalizeProgress(user)`，把 `magicules` 抬到 `magiculesForLevel(level)`，并补齐缺失字段。`lib/storage.ts` 的 `KEY` 与 `version: 1` 冻结。
- **防重刷**：`User` 新增可选字段 `completedQuestIds?: string[]`，由 `settleQuest` 追加；对已完成的委托再次结算返回零收益。App 把它与进行中的委托一起传给艾琳娜的 `ToolContext.closedQuestIds`（字段已存在），卡片据此禁用接取。

### 5.5 屏幕叠层（z-index 统一表，lead-engineer 按此集成）

| 层 | z | 位置 / 规则 |
|---|---|---|
| `WorldMap`（3D）/ `MapBoard`（2D） | 0 | 全屏；canvas 设 `touch-action: none`（body 是 `pan-x pan-y`，必须在 canvas 上覆盖） |
| `ActiveQuestHUD` | 900 | 顶部，`top: 5rem + safe-top`（现有） |
| `WorldControls` | 940 | 右侧竖排，位于契约终端按钮之上（建议 `bottom: 9.5rem + safe-bottom; right: 1rem`），不碰右上的公会 / 语言按钮 |
| 契约终端按钮 | 950 | 右下（现有）；**`QuestFocusCard` 打开时由 App 隐藏**（现在只在有进行中委托时隐藏） |
| 定位告知条 | 960 | 现有 |
| `TopHud` + 右上按钮组 | 1000 | 取代左上档案块 |
| `QuestFocusCard` | 1050 | 手机：底部抽屉，底边抬到艾琳娜入口之上（`bottom ≥ 7rem + safe-bottom`，因为入口在 z-2100、占左下 24–80 px × 48–104 px）；桌面：底部居中，`max-width ≈ 26rem` |
| `SettlementToast` | 1250 | 居中偏上；低于档案弹窗（1300） |
| `ProfileModal` / `ProMembershipModal` | 1300 / 1400 | 现有 |
| `BountyBoard` / `ElenaChat` | 2000 / 2100 | 现有，不动 |

已知的既有问题：无定位告知条（top 5.5rem）与 `ActiveQuestHUD`（top 5rem）同时出现时会重叠。由 lead-engineer 在集成时让二者纵向堆叠（P2）。

## 6. 契约补充（只加不改，M1 各角色必须实现）

### 6.1 world-engineer：调试钩子与统计口径
- **draw call 统计口径**：设置 `renderer.info.autoReset = false`，每帧开始时手动 `renderer.info.reset()`，整帧（含阴影 pass 与后处理）渲染完再读数。否则使用 EffectComposer 时，读到的只是最后一个全屏 pass（约 1 次），预算形同虚设。
- `render_game_to_text()` 在契约 C 的基础上**新增**以下字段：
  - `renderer.tier`：`'high' | 'low'`
  - `renderer.dpr`
  - `renderer.postPasses`：render 与 output 之外的 pass 数
  - `renderer.shadowMapSize`：关闭阴影时为 0
  - `renderer.textureMB`：纹理内存估算，含渲染目标
  - `renderer.frames`：累计渲染帧数
  - `beacons[].onLand: boolean`
  - `beacons[].urgent: boolean`
  - `lastWorldEvent: {type, questId?, at} | null`
  - `hour`：场景当前小时
  - `userInWorld: boolean`
- `mode` 在 `WorldMap` 挂载期间恒为 `'3d'`。2D 状态通过「钩子不存在 + `.leaflet-container` 存在」判定。
- `__world.stats()` 返回与 `renderer` 相同的对象，外加 `buildMs`（程序化城市构建耗时）。
- `camera.zoom` 的语义（例如相机到焦点的距离，单位米）要写进交接文档。
- **`worldEvents.ts` 不得 import three**，必须是零依赖的纯 TS。它是 App 唯一被允许静态 import 的 `scene/` 文件，一旦 import three，three 就会被打进入口包。
- 根节点设 `data-testid="world-map"`。

### 6.2 ui-designer：测试标识与可选 props
- 测试标识（QA 自动化依赖这些，不可省）：

  | 组件 | data-testid |
  |---|---|
  | TopHud | 根节点 `top-hud`；`top-hud-level`、`top-hud-gold`、`top-hud-trust`；`top-hud-xp`（`role="progressbar"`，`aria-valuenow` = round(ratio×100)） |
  | QuestFocusCard | 根节点 `quest-focus-card`（带 `data-quest-id`）；`quest-accept`、`quest-close`；`quest-block-reason`（禁用原因） |
  | WorldControls | 根节点 `world-controls`；`wc-recenter`、`wc-reset`、`wc-toggle-mode` |
  | SettlementToast | 根节点 `settlement-toast`；`settle-gold`、`settle-trust`、`settle-xp`、`settle-levelup` |

- 新增可选 props：
  - `QuestFocusCard`：`isCompleted?: boolean`、`rewardMagicules?: number`（由 App 用 `questMagicules` 计算后传入，组件保持纯展示）
  - `WorldControls`：`fallbackReason?: string`、`locationHint?: string`（例如「不在纽约范围内」）
  - 所有组件：`lang?: 'zh' | 'en'`
- `distanceText` 的格式与艾琳娜一致（`lib/agent/tools.ts`）：< 1000 m 显示「N 公尺」，否则显示「X.X 公里」。为 `null` 时，卡片显示「距离未知」。
- 仅有图标的按钮必须带 `aria-label`。

### 6.3 game-designer：成长类型与迁移
- `types.ts`：`User.completedQuestIds?: string[]`（可选，向后兼容；不改任何现有字段）。
- `lib/progression.ts` 新增导出 `normalizeProgress(user): User`（纯函数）；`settleQuest` 满足 5.4 节的规则（等级不降、追加已完成 id、重复结算零收益）。
- 写交接文档 `docs/studio/handoff/game-designer.md`：App 在哪里调用 `normalizeProgress` 与 `settleQuest`、`ToolContext.closedQuestIds` 怎么组装。

### 6.4 lead-engineer：集成要点
- 挂载 `WorldMap` 前先做 WebGL 预检。不可用时直接进入 2D，并且**不下载 3D 分包**。
- 契约终端按钮加 `data-testid="bounty-open"`；Suspense 加载画面加 `data-testid="world-loading"`。
- 回退原因存在 state 里，传给 `WorldControls.fallbackReason`。
- 角色不在世界内（`userInWorld` 为假，或经纬度超出 5.1 节范围）时，`hasLocation` 传假，并附上提示文案。
- 建议（不作为闸门）：`MapBoard` 也用 `React.lazy` 加载，入口包可再减约 47 KB gzip（Leaflet 实测 162 KB min / 47 KB gzip）。

## 7. 性能预算

### 7.1 渲染预算（以无头 SwiftShader 下的读数为准；fps 只作参考）

| 指标（按最差视角，整帧） | 桌面高档 1440×900，DPR ≤ 2 | 手机 / 低档 390×844，DPR ≤ 1.5 | 理由 |
|---|---|---|---|
| draw call | **≤ 160** | **≤ 100** | 估算：城市实例化 ~3 + 地标 ~15 + 光柱 3×N（N ≤ 20 → ≤ 60）+ 玩家与路径 ~6 + 阴影 pass ~15 + bloom ~14 ≈ 115。留约 40% 余量给 M3 美术与手感（美术改动另有 ≤ +20% 的约束）。约为 skill 通用表（300 / 150）的一半：本产品是户外步行、GPS 常开、屏幕常亮的伴随地图，耗电和发热是这一类产品的头号差评；3D 上面还叠着一整层 DOM 界面，同样消耗 GPU 合成 |
| 三角形 | **≤ 500k** | **≤ 250k** | 约 4000 栋 × 12–24 + 树约 1500 × 40 + 地标约 30k ≈ 190k；阴影 pass 再画一遍投影物，约 ×1.6 → ≈ 300k |
| 几何体 | ≤ 150 | ≤ 120 | 共享几何、实例化；超出通常说明每个光柱 / 符文都在新建几何 |
| 纹理数（含渲染目标） | ≤ 32 | ≤ 16 | Bloom 约 11 个 RT + composer 2 个；自制纹理 ≤ 12（桌面）/ ≤ 8（手机） |
| 纹理内存估算（含 RT） | ≤ 128 MB | ≤ 32 MB | 2880×1800 的 HalfFloat RGBA ≈ 41 MB/张。DPR 2 下 composer 的 2 张 + bloom mip ≈ 111 MB，因此后处理建议在 DPR ≤ 1.5 下合成。手机不开后处理 |
| 自制纹理 | 单张 ≤ 1024²，合计 ≤ 24 MB | 单张 ≤ 512²，合计 ≤ 8 MB | 广告牌、窗户、符文用 CanvasTexture，可做图集 |
| 投影光源 / 阴影贴图 | 1 / ≤ 2048 | 0–1 / ≤ 1024（或关闭） | 只有太阳一盏投影光；小物件用贴地阴影片 |
| 后处理 pass | ≤ 2 | **0** | 手机发热 |
| DPR 上限 | 2 | 1.5 | `hardwareConcurrency ≤ 4` 或手机判为低档 |
| 帧率目标 | 60 fps | 稳定 30 fps，帧率上限 30 | 省电；沙箱无法验证，列为真机待测 |
| 城市构建耗时 `buildMs` | ≤ 250 ms（沙箱 CPU） | 只记录 | 主线程卡顿要能测；这一项与 GPU 无关，沙箱读数可信 |

**测量视角**（QA / 调试 / 美术统一用这四个，静止 2 s 后读数）：
- **V1 默认**：定位在时代广场，`__world.recenter()`
- **V2 总览**：`resetView` 后连续滚轮缩小，直到 `camera.zoom` 不再变化（预期的最差视角）
- **V3 聚焦**：`__world.focusQuest('q1')`（中城，楼最密）
- **V4 进行中**：接取离时代广场最远的入门委托，相机框住玩家与目标

### 7.2 JS 与首屏体积（基线为本次实测：`vite build` 输出到 scratchpad）

| 产物 | 基线 | 预算 | 理由 |
|---|---|---|---|
| 入口 chunk | 507.8 KB min / 154.6 KB gzip（含 Leaflet 约 47 KB gzip） | **≤ 520 KB / ≤ 165 KB gzip** | 新界面组件与成长逻辑 ≤ 10 KB gzip；**three 一个字节都不能进入口** |
| 3D chunk（合计） | 实测：three r180 的代表性 import 集合为 551 KB / 140 KB gzip | **≤ 650 KB / ≤ 190 KB gzip** | 场景代码 ≤ 50 KB gzip |
| CSS | 71.7 KB / 15.5 KB gzip | ≤ 80 KB / ≤ 18 KB gzip | Tailwind 构建时编译 |
| 首屏 | — | 同意页 / 觉醒页**不请求** 3D chunk；`dist/index.html` 里没有它的 `<script>` 或 `modulepreload` | 新玩家的首屏是同意页，不该为 3D 付费 |

判定方法：`grep -l "THREE.WebGLRenderer" dist/assets/*.js` 只能命中 3D chunk。这个字符串在 three 的报错文案里，压缩后仍然保留，已在本次探针产物里验证（命中 5 处）。

## 8. 验收标准

### 8.1 统一测试设置（M2 冒烟与 M3 QA 共用）
- Chromium 启动参数：`--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`。2D 回退用例改用 `--disable-webgl --disable-3d-apis`。
- 生产构建：`npm run build` 后 `npx vite preview --port <分配端口> --strictPort`，记录 PID，结束时按 PID 关闭。
- context：授予 `geolocation`，坐标设为时代广场 (40.7580, -73.9855)；URL 带 `?debug=1`（门控用例除外）。
- 桌面 1440×900 DPR 1；手机 390×844，`isMobile`、`hasTouch`、`deviceScaleFactor: 3`。
- 跳过入门：首轮完整走一次「同意 → 觉醒」，其余用例可以直接往 `localStorage['aethelgard:session:v1']` 写入 `{version:1, consent:{identity:true, location:true}, user:{…}, savedAt}`（结构见 `lib/storage.ts`）。
- 艾琳娜入口用 `getByLabel('与艾琳娜说话')` 定位。
- 亮度、像素统计：qa-tools 里只有 playwright，没有 pngjs。在页面内用 `createImageBitmap` + OffscreenCanvas 解码截图后计算。
- 排除的环境噪音（不算缺陷）：`fonts.googleapis.com` / `fonts.gstatic.com` 证书错误、`basemaps.cartocdn.com` 瓦片被拦、`/api/*` 因缺少 MiniMax key 报错。
- 截图存 `qa-shots/<阶段>/`，文件名写清视口与场景，例如 `mobile-focus-card.png`。

### 8.2 M2 Alpha（功能完整，集成后必须全部通过）

| ID | 标准 | 验证方法 |
|---|---|---|
| M2-01 | 类型检查与构建通过 | `npm run typecheck`、`npm run build` 退出码都为 0 |
| M2-02 | three 只在独立分包里 | build 输出至少 2 个 JS chunk；`grep -l "THREE.WebGLRenderer" dist/assets/*.js` 不命中入口 chunk；`dist/index.html` 不引用 3D chunk；在仓库内 grep `from 'three` / `from "three`（排除 node_modules），只能命中 `components/world/scene/` |
| M2-03 | 主界面默认进入 3D | 桌面完成觉醒后：`JSON.parse(render_game_to_text()).mode === '3d'`，`[data-testid=world-map] canvas` 存在，`renderer.drawCalls > 0`；截图 `desktop-world.png` 不是纯色 |
| M2-04 | 光柱与委托一一对应且可见 | `beacons.length === INITIAL_QUESTS.length`（≥ 12）且 id 集合相同；全部 `onLand === true`；V1 下距玩家最近的 3 个委托 `onScreen === true`；V2 下全部 `onScreen === true` |
| M2-05 | 玩家、无定位、不在纽约三种情况 | ① 有定位：V1 下 `player !== null && player.onScreen`；② 不授予定位：`player === null`，`camera.target` 离原点 ≤ 50 m，`wc-recenter` 禁用；③ 定位设为上海 (31.23, 121.47)：不崩溃，`player === null`、`userInWorld === false`，光柱仍可见，`wc-recenter` 禁用并显示提示 |
| M2-06 | 真实点击光柱能聚焦 | 用 `page.mouse.click` 点 `beacons[i].screen`：1.5 s 内 `focusedQuestId === id`；`[data-testid=quest-focus-card][data-quest-id=id]` 可见，并包含该委托的 title 与 realTask；2 s 后该光柱的屏幕坐标离视口中心 ≤ 短边的 20%；`__world.tapBeacon(id)` 的结果与真实点击一致 |
| M2-07 | 拖动不误触，缩放与俯仰受限 | 在某个光柱上按下、拖动 80 px、松开：`focusedQuestId` 不变，`camera.heading` 变化 ≥ 5°；滚轮后 `camera.zoom` 有变化且 `window.scrollY === 0`；大幅上下拖动后 `camera.tilt` 始终在 [35, 70] 内 |
| M2-08 | 接取走艾琳娜的路径 | 点 `quest-accept`：`activeQuestId === id`；`ActiveQuestHUD` 出现并显示该委托 title；卡片关闭；网络请求里出现 `/audio/elena/contract_signed.mp3`；`lastWorldEvent` 为 `{type:'pulse', questId:id}`；代码审查确认 `pulse` 在 `acceptQuest` 内发出 |
| M2-09 | 接取约束都有说明 | 1 级新档案：聚焦 `minLevel > 1` 的委托 → `quest-accept` 禁用，`quest-block-reason` 含「等级」；已有进行中委托时聚焦其他委托 → 禁用，并说明有进行中的委托；已完成的委托 → 禁用，含「已完成」 |
| M2-10 | 结算是纯函数且规则正确 | 在 scratchpad 写 node 脚本，用 esbuild 打包 `lib/progression.ts` 与 `constants.ts` 后检查：`levelFromMagicules(0) === 1`；`magiculesForLevel(1..20)` 严格递增；`levelProgress().ratio` ∈ [0, 1)；对深冻结的入参调用 `settleQuest` 不抛错，入参 JSON 前后相同；`gained.gold === rewardGold`、`gained.trust === trustPoints`、`gained.magicules === questMagicules(q)`；`level === max(旧等级, levelFromMagicules(新经验))`；`leveledUp ⇔ toLevel > fromLevel`；同一委托第二次结算 `gained` 全为 0 |
| M2-11 | 端到端结算与存档一致 | 接 q1（在时代广场）→ 打开证明面板 → 上传一张 png → 等待 ≤ 10 s：`localStorage` 中 `user` 的 gold / trust / magicules / level / guildContribution / completedQuestIds 都等于 `settleQuest(结算前的档案, q1).user`；`TopHud` 数值同步更新；`grep -n "level + 1" App.tsx` 与 `grep -n "goldCoins + 100" App.tsx` 都无结果 |
| M2-12 | 结算演出 | `settlement-toast` 出现，`settle-gold` / `settle-trust` / `settle-xp` 的数字等于 `gained` 对应值；升级时出现 `settle-levelup`，且 `lastWorldEvent.type === 'celebrate'`；8 s 内自动消失；截图 `desktop-settlement.png` |
| M2-13 | 执照「推荐」条件能自然达成 | node：新档案（1 级、经验 0、信任 100）依次结算离时代广场最近的 3 个入门委托，最多 3 次之内 `trustScore > 110 && level ≥ 2` |
| M2-14 | 委托内容覆盖 | node：委托 ≥ 12 个且 id 唯一；18 个职业都被 `neededProfessions` 点名；5 种 `type` 都出现；`minLevel === 1` 的 ≥ 4 个；`isUrgent` 有 1–3 个；坐标全部在纬度 [40.70, 40.80]、经度 [-74.02, -73.93] 内；保留 q1–q3 的 id；新增委托没有 `imageUrl` |
| M2-15 | WebGL 不可用时自动回退 2D | 用 `--disable-webgl --disable-3d-apis` 启动：主界面出现 `.leaflet-container`，没有 WebGL canvas，0 个 pageerror；`wc-toggle-mode` 禁用并显示原因；`TopHud`、`bounty-open`、艾琳娜入口都能点；网络请求里没有 3D chunk；截图 |
| M2-16 | 手动切换 2D / 3D | 点 `wc-toggle-mode`：3 s 内出现 `.leaflet-container`，`[data-testid=world-map] canvas` 消失；再点一次切回：`mode === '3d'`，光柱数量不变；在 2D 下用弹窗「承接契約」接取，仍然请求 `contract_signed.mp3` |
| M2-17 | 世界控件 | 拖动和缩放之后点 `wc-reset`：`camera` 的 tilt / heading / zoom 回到初始读数（误差 ±1%）；点 `wc-recenter`：`player.screen` 离视口中心 ≤ 15%；三个按钮都有 `aria-label` |
| M2-18 | TopHud | 名字、种族、等级、经验条、信任、金币都与 `localStorage` 档案一致；`top-hud-xp` 的 `aria-valuenow === round(levelProgress(m).ratio × 100)`；点击后 `ProfileModal` 出现 |
| M2-19 | 调试钩子只在 debug 下挂载 | 在 `vite preview` 生产构建上：不带 `?debug=1` 时 `typeof window.render_game_to_text === 'undefined'`，`window.__world` 同样不存在；带上之后两者都存在，返回值可 `JSON.parse`，并包含契约 C 与 6.1 节的全部字段 |
| M2-20 | 老档案兼容 | 往 `localStorage` 写入旧档案（`level:3, magicules:0, trustScore:100, goldCoins:200`，没有 `completedQuestIds`）→ 加载：不白屏，`TopHud` 显示 Lv 3；之后的存档里 `magicules ≥ magiculesForLevel(3)` 且 level 仍为 3；`git diff lib/storage.ts` 为空 |
| M2-21 | 主流程不崩溃 | 跑完 M2-03 到 M2-12 的全过程，pageerror 为 0 |

### 8.3 M3 Beta（品质、性能、手机、回归）

| ID | 标准 | 验证方法 |
|---|---|---|
| M3-01 | 桌面渲染预算 | 1440×900、`tier === 'high'`：V1–V4 每个视角都满足 drawCalls ≤ 160、triangles ≤ 500k、geometries ≤ 150、textures ≤ 32、`textureMB` ≤ 128、`postPasses` ≤ 2、`shadowMapSize` ≤ 2048；另在 `deviceScaleFactor: 2` 下读 V2，`dpr ≤ 2` 且 `textureMB ≤ 128`。读 `render_game_to_text().renderer`，QA 报告里给表 |
| M3-02 | 手机渲染预算 | 390×844 手机 context：`tier === 'low'`、`dpr ≤ 1.5`、`postPasses === 0`、`shadowMapSize ≤ 1024`；V1 / V2 / V4 满足 drawCalls ≤ 100、triangles ≤ 250k、geometries ≤ 120、textures ≤ 16、`textureMB` ≤ 32 |
| M3-03 | 包体与首屏 | 入口 chunk ≤ 520 KB / ≤ 165 KB gzip；3D chunk 合计 ≤ 650 KB / ≤ 190 KB gzip；CSS ≤ 18 KB gzip（读 build 输出）；新 context 打开同意页，到同意按钮可见为止，请求列表里没有 3D chunk |
| M3-04 | 城市构建耗时 | `__world.stats().buildMs ≤ 250`（桌面）；手机 context 的读数只记录 |
| M3-05 | GPU 资源释放 | 3D ↔ 2D 来回切 10 次：控制台没有 `Too many active WebGL contexts`；DOM 中 WebGL canvas ≤ 1 个；最后一次切回后 geometries / textures 与首次挂载时的读数相同 |
| M3-06 | 后台停止渲染 | `page.evaluate` 把 `document.hidden` / `visibilityState` 改成隐藏并派发 `visibilitychange`：1 s 内 `renderer.frames` 增量 ≤ 1；恢复后继续增长 |
| M3-07 | WebGL 上下文丢失 | 调用 `getExtension('WEBGL_lose_context').loseContext()`：3 s 内要么 `restoreContext()` 后 `frames` 恢复增长，要么经 `onFallback` 切到 2D；0 个 pageerror |
| M3-08 | 窗口尺寸变化 | 视口按 1440×900 → 390×844 → 844×390 变化：`canvas.width === round(clientWidth × dpr)`（误差 ±2）；截图里画面没有拉伸；`onScreen` 为真的光柱坐标都在视口内 |
| M3-09 | 手机手势 | `getComputedStyle(canvas).touchAction === 'none'`；用 CDP 发单指拖动，heading / tilt 改变且 `window.scrollY === 0`；双指捏合改变 `camera.zoom`，且 `visualViewport.scale === 1`；点击光柱屏幕坐标能聚焦；从光柱上开始拖动不聚焦 |
| M3-10 | 手机布局无溢出、无遮挡 | 390×844：`scrollWidth ≤ innerWidth`；卡片打开时，它的包围盒不与以下可见元素相交：`bounty-open`、艾琳娜入口、`world-controls`、`top-hud`、`ActiveQuestHUD`；新组件里所有按钮 ≥ 44×44；截图：世界、卡片、进行中委托、结算 |
| M3-11 | 文字适配与可读性 | 390×844 下聚焦标题最长的委托：新组件内没有元素 `scrollWidth > clientWidth + 1`（带 `title` 属性的有意省略号除外）；扫描新组件内的 `getComputedStyle`：主要正文 ≥ 14px，主按钮 ≥ 15px，常驻文字都 ≥ 11px |
| M3-12 | 画面评分卡达到 premium | art-director 用 `visual-scorecard.md` 给桌面 / 手机 × 白天 / 夜晚的游玩截图打分。以 skill 原刻度 0–3 为准，同时报 1–10 换算值（×10/3）：每项 ≥ 2（≈ 6.7），平均 ≥ 2.3（≈ 7.7），没有触发自动不合格；改后 drawCalls ≤ 改前 × 1.2 |
| M3-13 | 地标辨识度 | 截 4 张不带地名的图（分别聚焦时代广场、中央公园、布鲁克林大桥、帝国大厦附近），由非作者盲认：至少认对 3 张，且中央公园必须认出；V2 总览图能看出岛形、两条河和偏转的街网 |
| M3-14 | 昼夜 | 桌面分别 `__world.setHour(13)` 与 `setHour(22)` 截图：夜晚平均亮度 ≤ 白天的 75%（页面内解码计算）；夜里窗户和灯笼亮着；光柱仍是画面里对比度最高的元素；没有青色、紫色霓虹 |
| M3-15 | 反馈与手感 | ① 开场镜头 ≤ 2.5 s，期间按下后 `camera.position` 立即停止插值；② 聚焦时每 100 ms 采样一次 `camera.target`，0.6–1.5 s 内单调趋近、没有跳变；③ 接取后 +150 ms 与 +400 ms 的帧里能看到冲击波；④ 升级时有 `celebrate` 演出；⑤ `reducedMotion: 'reduce'` 下没有相机震动（`pulse` 之后静止时连续帧的 `camera.position` 完全相同），结算数字直接显示最终值 |
| M3-16 | 无定位体验 | 不授予定位：告知条可见；`wc-recenter` 禁用并显示提示；卡片显示「距离未知」；仍能聚焦与接取（提交证明由现有的到场校验拦下并说明原因） |
| M3-17 | 面板共存 | 3D 模式下打开再关闭 `BountyBoard` 与 `ElenaChat`：`/api` 报错时界面有友好提示，没有 pageerror；关闭后 `frames` 继续增长，相机状态保持不变 |
| M3-18 | 控制台干净 | 桌面 + 手机跑完整轮 QA：pageerror、unhandledrejection、`console.error` 都为 0，以 `THREE.` 开头的 `console.warn` 也为 0（8.1 节列出的环境噪音除外） |
| M3-19 | 缺陷闸门 | 最终一轮 QA 没有未关闭的 P0 / P1 |
| M3-20 | 刷新后状态保留 | 结算后刷新页面：`TopHud` 数值与刷新前相同；已完成的委托仍然不能接取；世界仍以 3D 模式进入 |

### 8.4 严重度映射（QA 用）
- M2 条目在 M3 中失败：**至少 P1**；流程走不通、白屏或崩溃算 **P0**。
- 渲染 / 包体预算超出 > 25%：P1；超出 ≤ 25%：P2，并写明取舍。
- 评分卡不达标：P2；触发自动不合格（大面积占位几何、界面遮挡游玩区等）：P1。
- 卡片或界面遮住主操作（接取、提交、艾琳娜入口）：P1；文字字号不足：P2。
- 控制台有未处理异常：P1。

## 9. 文件所有权

| 角色 | 独占可写 | 只读依赖 | 必交文档 |
|---|---|---|---|
| studio-director | `docs/studio/brief.md` | 全部 | 本文件 |
| world-engineer | `components/world/scene/**`（`WorldMap.tsx`、`worldEvents.ts`，以及其中的 geo / city / beacons / camera / player / debug 等全部模块） | `types.ts`（`Race`、`Quest`）、`constants.ts`、`lib/geo.ts` | `docs/studio/handoff/world-engineer.md` |
| ui-designer | `components/world/ui/**`（`QuestFocusCard`、`WorldControls`、`TopHud`、`SettlementToast`） | `types.ts`、`constants.ts` 的 `PROFESSION_CONFIG` / `RACE_CONFIG`、`lib/progression.ts` 的类型（只用 `import type`）、`index.html` 的 token、`tailwind.config.js` | `docs/studio/handoff/ui-designer.md` |
| game-designer | `lib/progression.ts`；`constants.ts` 里的 `INITIAL_QUESTS` 数组（委托数据段）；`types.ts` 里与成长相关的类型（`User` 的成长字段，只加不改）；`docs/studio/design.md` | `components/ProMembershipModal.tsx`（执照条件） | `docs/studio/handoff/game-designer.md` |
| lead-engineer（M2） | `App.tsx`；确有需要时 `vite.config.ts` | 其他全部文件 | 汇报中逐条说明交接要求的落实情况 |
| qa-engineer（M3） | 只写 scratchpad（`qa-tools/`、`qa-shots/`） | 全部 | 缺陷清单 |
| debug-engineer（M3） | 修缺陷时可做最小改动，保持原模块的设计意图，并在汇报中逐条说明 | — | — |
| art-director（M3） | `components/world/scene/**` | — | 评分卡前后对比 |
| feel-designer（M3） | `components/world/scene/**`、`components/world/ui/**` | — | — |
| release-engineer（M4） | `docs/studio/RELEASE.md`、`README.md` | — | — |

**本版本冻结**（任何角色都不改，确有必要先找总监）：`lib/storage.ts`、`lib/elena.ts`、`lib/agent/**`、`server/**`、`api/**`、`functions/**`、`PRIVACY.md`、`components/ConsentGate.tsx`、`components/MapBoard.tsx`（作为 2D 回退原样保留）、`package.json`（不新增依赖）、`index.html`、`tailwind.config.js`、`constants.ts` 里 `INITIAL_QUESTS` 以外的部分。

**跨文件依赖规则**：
- App 对 `scene/` 只能静态 import `worldEvents.ts`；`WorldMap` 必须通过 `React.lazy` 加载。
- `ui/` 不得 import `scene/` 下的任何文件。按钮通过回调交给 App，由 App 发事件。
- 需要别人修改的地方，写进 `docs/studio/handoff/<角色>.md`，由集成者统一接入。

## 10. 风险与对策

| 风险 | 影响 | 对策 | 残余 |
|---|---|---|---|
| 软件渲染测不了真实帧率 | 性能结论失真 | 用 draw call、三角形、纹理数、`textureMB`、`buildMs` 作代理指标；档位逻辑用手机 context 验证 `tier` / `dpr` / `postPasses`；fps 只记录不判定 | 真机帧率与发热列为 **UNVERIFIED**，写进 RELEASE.md，并给出真机测试方法（`?debug=1` 读 fps） |
| 程序化城市辨识度不足 | P1 失效，看起来像随便一座城 | 按辨识度投入：中央公园的矩形绿地 > 岛形与两河 > 29° 街网 > 中城 / 下城两个高峰夹着 Village 低谷 > 帝国大厦尖顶 > 布鲁克林大桥双塔 > 时代广场广告牌；用盲认测试（M3-13）验证；不追求逐栋准确 | 只认得出地标、认不出具体街区，可以接受 |
| 手机触控与页面手势冲突 | 拖地图变成拖页面、双击缩放、误触聚焦 | canvas 设 `touch-action: none`（覆盖 body 的 `pan-x pan-y`）；Pointer Events + `setPointerCapture`，处理 `pointercancel` / `lostpointercapture`；点击判定位移 < 8 px 且 < 300 ms；iOS 上阻止 `gesturestart`；DOM 层只让面板本身接收指针事件 | iOS Safari 真机未测 |
| 测试者不在纽约 | 角色被投影到上万公里外，世界一片空白；无法提交证明 | 世界范围外判为不在世界内（5.1 节、M2-05 ③）；在 RELEASE.md 里写明用 DevTools → Sensors 模拟定位到 40.7580, -73.9855 | 不提供生产环境的到场绕过 |
| three 泄漏进入口包 | 首屏变重，同意页也要为 3D 付费 | `worldEvents.ts` 零依赖；App 对 `scene/` 只用 `React.lazy` 与 `import type`；M2-02 用 grep 卡死 | — |
| 叠层遮挡 | 主操作被卡片挡住 | 统一叠层表（5.5 节）；用包围盒相交测试（M3-10） | 极窄屏（< 360 px）未纳入矩阵 |
| 老档案等级被降 | 玩家进度丢失（gamestudio 的硬约束） | `normalizeProgress` + 等级不降规则；冻结 `storage.ts`；M2-20 | — |
| 结算真实化之后的刷分 | 信任分与经验可以无限刷 | `completedQuestIds` + 重复结算零收益 + 艾琳娜的 `closedQuestIds` | 客户端仍可被篡改，留给服务端校验版本 |
| 后处理撑爆显存 | 手机崩溃或掉帧 | 低档不开后处理；桌面的 composer 建议在 DPR ≤ 1.5 下合成；`textureMB` 进入预算 | — |
| 上下文丢失（手机切后台） | 黑屏 | 监听 `webglcontextlost` / `restored`，必要时 `onFallback`；M3-07 | — |
| 并行开发互相覆盖 | 构建反复坏 | 所有权表 + 冻结清单 + 交接文档；类型检查时只对自己的文件负责 | — |
| 美术跑偏到霓虹风 | 违反项目美术方向 | 信号色只用 token（5.2 节）；M3-14 检查 | — |
| 评分卡刻度不一致（skill 是 0–3，美术任务要求 1–10） | 门槛理解偏差 | 以 0–3 为准，同时报换算值（M3-12） | — |

## 11. 闸门判定与就绪检查

- **M1 放行**：各角色交付的文件单独通过类型检查；交接文档写清楚接入方式、6 节的补充字段与测试标识。
- **M2 放行**：M2-01 到 M2-21 全部通过。主程冒烟至少覆盖 M2-01、M2-02、M2-03、M2-08、M2-11、M2-15；其余由 M3 第一轮 QA 复核，失败按 8.4 节定级。
- **M3 放行**：M3-19（无 P0 / P1）与 M3-18（控制台干净）是硬闸门；其余 M3 条目失败按 8.4 节定级。回归仍不通过时，按 PIPELINE 最多追加一轮，之后如实记入发布风险。

**就绪检查（Definition of Ready）**：规则清楚（第 2、5 节）✔ · 负责人明确，所有权无重叠（第 9 节）✔ · 风险已列出（第 10 节）✔ · 每条验收标准都能测（第 8 节）✔ · 存档、隐私、艾琳娜的影响已说明（5.3、5.4 节，冻结清单）✔ → **READY，进入 M1**。

## 附：评分卡在本作中的对应物（供 art-director 打分前对齐）

| 评分卡类别 | 本作对应 |
|---|---|
| Art direction | 「异界化纽约」的大地色系语言是否贯穿世界、光柱、界面 |
| Hero / player | 玩家角色 + 精度圈 + 种族着色 |
| Obstacles / enemies | 约束的可读性：等级不足 / 已有进行中 / 已完成 / 紧急的光柱与卡片表现（本作没有敌人，不要为了凑分加敌人） |
| Rewards / interactables | 委托光柱、聚焦、接取冲击波、结算演出 |
| World / environment | 程序化纽约：岛形、河、街网、楼群高度、地标、近中远景层次 |
| Materials / textures | 共享材质角色（石材、屋顶、水、绿地、光柱、灯笼）、程序化窗户与广告牌纹理 |
| Lighting / render | 昼夜、色调映射、有色阴影、边缘光、克制的 bloom |
| VFX / motion | 光柱呼吸、符文漂浮、聚焦响应、pulse、celebrate |
| UI / HUD | `TopHud`、聚焦卡片、世界控件、结算演出与世界风格是否统一 |
| Performance evidence | 第 7 节预算表与 V1–V4 读数 |
