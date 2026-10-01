export const meta = {
  name: 'game-studio',
  description: '异界觉醒游戏工作室：按 M0–M4 里程碑闸门，由角色智能体协作交付 3D 世界地图垂直切片，每个智能体强制调用对应游戏开发 skill',
  whenToUse: '需要按高端 3D 项目标准流程推进一个完整版本时（预制作 → 垂直切片 → Alpha → Beta → 发布候选）。args.scratch 传会话 scratchpad 路径。',
  phases: [
    { title: 'M0 预制作', detail: '总监审计现状、写垂直切片简报与验收标准' },
    { title: 'M1 垂直切片生产', detail: '3D 世界 · 界面 · 玩法数值，按文件所有权并行' },
    { title: 'M2 Alpha 集成', detail: '主程接线，typecheck + build + 冒烟' },
    { title: 'M3 Beta 打磨', detail: 'QA → 调试 → 美术 → 手感 → 回归' },
    { title: 'M4 发布候选', detail: '发布检查、README、发布报告' },
  ],
}

// scratchpad 路径每个会话都不同，必须由调用方通过 args.scratch 传入（Playwright 与截图都放在那里，不进仓库）
if (!args || !args.scratch) throw new Error('缺少 args.scratch：请传入当前会话的 scratchpad 路径')
const SCRATCH = args.scratch
const QA = SCRATCH + '/qa-tools'
const SHOTS = SCRATCH + '/qa-shots'

const ROLES = {
  'studio-director': { title: '工作室总监', skills: ['threejs-game-director', 'gamestudio'] },
  'game-designer': { title: '游戏设计师', skills: ['game-design-theory', 'gamestudio'] },
  'world-engineer': { title: '3D 世界工程师', skills: ['threejs-game-director', 'threejs-gameplay-systems', 'threejs-aaa-graphics-builder'] },
  'ui-designer': { title: '游戏 UI 设计师', skills: ['threejs-game-ui-designer', 'game-ui-design', 'game-ui-ux'] },
  'lead-engineer': { title: '主程 / 集成者', skills: ['game-engine', 'game-developer'] },
  'qa-engineer': { title: 'QA 工程师', skills: ['threejs-qa-release', 'develop-web-game'] },
  'debug-engineer': { title: '调试与性能工程师', skills: ['threejs-debug-profiler'] },
  'art-director': { title: '美术总监', skills: ['threejs-aaa-graphics-builder'] },
  'feel-designer': { title: '手感设计师', skills: ['game-feel'] },
  'release-engineer': { title: '发布工程师', skills: ['threejs-qa-release'] },
}

const CONTEXT = `你在「异界觉醒」仓库 /home/user/yijie-juexing 工作（分支 claude/great-davinci-1q0q45）。项目规范在根目录 CLAUDE.md（已注入你的上下文），团队流程在 docs/studio/PIPELINE.md，角色定义在 .claude/agents/。

## 本版本目标：3D 世界地图垂直切片
把 2D Leaflet 地图（components/MapBoard.tsx）换成 Three.js 风格化纽约 3D 世界——与 Pokémon GO / Monster Hunter Now 同一类做法：玩家的真实 GPS 位置是 3D 世界里的角色，委托是立在真实坐标上的光柱，相机可俯仰旋转。Leaflet 地图保留为回退（WebGL 不可用、或玩家手动切 2D）。同时补齐玩法缺口：
- 提交证明后奖励不结算：App.tsx 写死 level+1、gold+100，无视委托的 rewardGold / trustPoints；magicules（经验）与 guildContribution 从不变化；trustScore 恒为 100，导致执照「推荐」条件（trustScore > 110）永远无法满足。
- 18 个职业里有 10 个没有任何委托点名（目前只有 3 个委托）。

## 现有代码事实
- App.tsx 组合全部界面：MapBoard 在 z-0 铺满全屏；其上是左上角档案块、右上公会与语言按钮、ActiveQuestHUD、契约终端按钮（右下 bottom-12 right-8）、ElenaChat 入口（左下 bottom-12 left-6，z-[2100]）、BountyBoard（z-[2000]）、ProofSubmission 等。
- Quest.location 是 [纬度, 经度]；userLocation 来自 navigator.geolocation，可能为 null。
- MapBoard 的 props：quests、activeQuestId、focusedQuestId、onFocus(quest)、onAccept(quest)、userLocation。标记点击 → onFocus；Leaflet 弹窗里的「承接契約」→ onAccept。
- 接取委托走 App.tsx 的 handleAccept：会播放艾琳娜的固定台词「契约签署完成」——这就是「所有接取由艾琳娜确认」的产品设定，任何新的接取入口都必须走这条路径，不要绕过。
- 设计 token 在 index.html 的 :root；Tailwind 已改为构建时编译（tailwind.config.js），调色板是重定义过的暖石板 + 金。

## 固定接口契约（所有角色共同遵守；可以新增字段，不可改名或删除）
A. 3D 世界：components/world/scene/WorldMap.tsx（default export）
   props：quests、activeQuestId、focusedQuestId、onFocus(quest)、userLocation、userRace?: Race、onFallback?: (reason: string) => void
   - WebGL 初始化失败时调用 onFallback，由 App 切回 MapBoard。
   - three 只能在 components/world/scene/** 内部 import，App 用 React.lazy 把 3D 整体分包。
B. 世界事件总线：components/world/scene/worldEvents.ts
   export const worldEvents，含 emit(event) 与 on(listener) 返回取消订阅函数。
   事件：{type:'recenter'} | {type:'resetView'} | {type:'pulse', questId} | {type:'celebrate'}
   界面发 recenter / resetView；App 在接取委托时发 pulse、升级时发 celebrate；场景订阅并演出。
C. 调试钩子（仅 URL 带 ?debug=1 时挂载，生产默认关闭）
   window.render_game_to_text() 返回 JSON 字符串：mode、camera{position,target,tilt,heading,zoom}、focusedQuestId、activeQuestId、beacons[{id, screen{x,y}, onScreen}]、player{screen,onScreen} 或 null、renderer{drawCalls, triangles, geometries, textures, fps}
   window.__world：tapBeacon(id)、focusQuest(id)、setHour(h)、recenter()、stats()
D. 数值：lib/progression.ts
   magiculesForLevel(level) 达到该等级所需累计经验；levelFromMagicules(m)；levelProgress(m) 返回 {level, into, span, ratio}；questMagicules(quest)；
   interface Settlement { user: User; gained: {gold, trust, magicules, contribution}; leveledUp: boolean; fromLevel: number; toLevel: number }
   settleQuest(user, quest): Settlement —— 纯函数，不改入参
E. 界面组件（components/world/ui/，全部是纯展示组件，数据由 App 通过 props 传入）
   QuestFocusCard：quest(或 null)、userLevel、userProfession、isActive、hasActiveQuest、distanceText(或 null)、onAccept(quest)、onClose() —— 取代 Leaflet 弹窗
   WorldControls：mode('3d'|'2d')、onToggleMode()、onRecenter()、onResetView()、hasLocation、canUse3d
   TopHud：name、race、avatarUrl?、level、progressRatio、trustScore、goldCoins、onOpenProfile() —— 取代 App.tsx 左上角档案块
   SettlementToast：settlement(或 null)、questTitle、onDone() —— 提交证明后的结算演出

## 环境事实
- 无头 Chromium + WebGL2 可用（SwiftShader 软件渲染），启动参数见 CLAUDE.md。Playwright 在 ${QA}/node_modules（在该目录下写 .mjs 脚本即可 import playwright）。截图根目录 ${SHOTS}。
- 沙箱出网策略：Google 字体证书失败会退回系统字体、Carto 地图瓦片被拦（2D 回退地图在沙箱里是空白底图）、/api/* 没有 MiniMax key 会报错——这三项是环境限制，不是缺陷。
- 软件渲染的 fps 远低于真机，性能结论以 draw call / 三角形 / 纹理数为准。
- 起本地服务只用分配给你的端口，结束时按 PID 关闭。不要用 pkill -f 或 killall 匹配命令行——会匹配到你自己的 shell 把它杀掉。
- 多个角色可能同时在同一工作区改不同文件。类型检查时只对你负责的文件负责；别人文件里的瞬时报错不要去修。`

const REPORT_PROPS = {
  skills_invoked: { type: 'array', items: { type: 'string' }, description: '实际调用成功的 skill 名' },
  files_changed: { type: 'array', items: { type: 'string' } },
  verification: { type: 'string', description: '实际跑过的验证命令与结果摘要' },
  summary: { type: 'string' },
  issues: { type: 'array', items: { type: 'string' } },
  blockers: { type: 'array', items: { type: 'string' } },
}
const REQ = Object.keys(REPORT_PROPS)
const schema = (extra, extraReq) => ({
  type: 'object',
  properties: Object.assign({}, REPORT_PROPS, extra || {}),
  required: REQ.concat(extraReq || []),
})
const REPORT = schema()

const BUG = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    severity: { type: 'string', enum: ['P0', 'P1', 'P2', 'P3'] },
    area: { type: 'string', enum: ['world', 'ui', 'gameplay', 'integration', 'other'] },
    title: { type: 'string' },
    steps: { type: 'string' },
    evidence: { type: 'string' },
  },
  required: ['id', 'severity', 'area', 'title', 'steps', 'evidence'],
}
const QA_SCHEMA = schema({
  bugs: { type: 'array', items: BUG },
  screenshots: { type: 'array', items: { type: 'string' } },
  metrics: { type: 'string', description: 'drawCalls / triangles / geometries / textures / 控制台错误数 等读数' },
  gate_pass: { type: 'boolean' },
}, ['bugs', 'screenshots', 'metrics', 'gate_pass'])

const ledger = []
const violations = []

function rolePrompt(role, task) {
  const r = ROLES[role]
  const skills = r.skills.join('、')
  return `你是异界觉醒游戏工作室的 ${role}（${r.title}）。

## 第一步（强制，不可跳过）
在读代码、写代码之前，依次用 Skill 工具调用：${skills}。
读完每个 skill 的指引后再开始，并按它的方法论工作。最终汇报的 skills_invoked 必须如实列出你实际调用成功的 skill 名——这一项会被逐个核对。
如果 Skill 工具里找不到某个 skill 或调用失败，写进 blockers，不要假装调用过。

${CONTEXT}

## 你的任务
${task}

## 汇报要求
skills_invoked、files_changed（新增或修改的全部文件路径）、verification（实际跑过的命令与结果）、summary（中文，具体说做了什么、为什么）、issues（遗留问题与风险）、blockers（阻断问题）。没有就给空数组。`
}

async function act(role, task, phaseName, sch) {
  const res = await agent(rolePrompt(role, task), { label: role, phase: phaseName, schema: sch || REPORT })
  if (!res) {
    log(`⚠ ${role} 没有返回结果`)
    violations.push(`${role}：未返回结果`)
    return null
  }
  const got = res.skills_invoked || []
  const missing = ROLES[role].skills.filter(s => !got.includes(s))
  ledger.push({ role, required: ROLES[role].skills, invoked: got, missing })
  if (missing.length) {
    violations.push(`${role}：未调用 ${missing.join('、')}`)
    log(`⚠ 流程违规：${role} 未调用 ${missing.join('、')}`)
  } else {
    log(`✓ ${role} 已调用 ${ROLES[role].skills.join('、')}`)
  }
  if ((res.blockers || []).length) log(`⚠ ${role} 报告阻断：${res.blockers.join('；')}`)
  return res
}

// ════════════════ M0 预制作 ════════════════
phase('M0 预制作')
const director = await act('studio-director', `1. 调用 skill 后审计现状：读 App.tsx、components/MapBoard.tsx、types.ts、constants.ts、lib/geo.ts、components/ 下的界面组件、docs/studio/PIPELINE.md、docs/elena-agent.md。
2. 写 docs/studio/brief.md（中文）：
   - 本版本（垂直切片）范围：做什么 / 明确不做什么；
   - 体验目标：玩家打开后前 30 秒应该感受到什么；
   - 性能预算：draw call、三角形、纹理内存、首屏 JS 体积，给具体数字与理由；
   - 验收标准清单：每条带验证方法（截哪一幕 / 跑什么命令 / 读 render_game_to_text 的哪个字段），分 M2 Alpha 与 M3 Beta 两组；
   - 文件所有权表（以上面的契约为准：world-engineer 独占 components/world/scene/**；ui-designer 独占 components/world/ui/**；game-designer 独占 lib/progression.ts、constants.ts 的委托数据段、types.ts 的成长类型；lead-engineer 独占 App.tsx）。可补充细节，不可改名；
   - 风险与对策（软件渲染测不了真实帧率、程序化城市的辨识度、手机触控与页面手势冲突等）。
3. 只写 brief.md，不写实现代码。
汇报额外给 acceptance（数组，每项含 id、milestone 为 M2 或 M3、criterion、verify）与 budget（性能预算文本）。`, 'M0 预制作', schema({
  acceptance: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, milestone: { type: 'string', enum: ['M2', 'M3'] }, criterion: { type: 'string' }, verify: { type: 'string' } }, required: ['id', 'milestone', 'criterion', 'verify'] } },
  budget: { type: 'string' },
}, ['acceptance', 'budget']))

if (!director || ledger[0].missing.length) {
  log('✗ M0 闸门未通过：总监未能调用 skill 或未返回结果，流水线中止')
  return { aborted: 'M0', director, ledger, violations }
}
const ACCEPT = (director.acceptance || []).map(a => `- [${a.milestone}] ${a.id} ${a.criterion}（验证：${a.verify}）`).join('\n')
log(`M0 通过：${(director.acceptance || []).length} 条验收标准`)

// ════════════════ M1 垂直切片生产 ════════════════
phase('M1 垂直切片生产')
const briefNote = `总监的简报已写在 docs/studio/brief.md，先读它。性能预算：${director.budget}\n验收标准：\n${ACCEPT}`

const [world, ui, design] = await parallel([
  () => act('world-engineer', `${briefNote}

在 components/world/scene/ 下实现契约 A、B、C。要求：

【地理】geo.ts：以时代广场 (40.7580, -73.9855) 为原点的局部平面投影（x 向东、z 向南，单位米或你选定的缩放，写明理由）。世界范围至少覆盖南到炮台公园 (40.703)、北到中央公园北端 (40.800)、东到布鲁克林大桥东岸、西到哈德逊河；所有委托坐标（constants.ts，设计师会新增，范围 lat 40.70–40.80、lon -74.02 – -73.93）都必须落在可见陆地上——读 constants.ts 时以最终版本为准，交付前再核对一次。

【程序化纽约】不依赖任何外部资产或网络请求：
- 曼哈顿岛轮廓（简化多边形）、哈德逊河与东河水面、布鲁克林一侧陆地。
- 曼哈顿街网顺时针偏约 29°；街区用 InstancedMesh 盒体建筑，高度分布中城与下城金融区高、其余中低；同一材质一个 draw call。
- 一眼可认的地标：时代广场（发光广告牌）、中央公园（大片绿地 + 实例化树木 + 水面）、布鲁克林大桥（两座塔 + 桥面 + 拉索）、帝国大厦（尖顶塔楼）。
- 风格：异世界化的纽约——大地色系、暖石、屋顶灯笼与符文光，参照《旷野之息》的柔和光照与有色阴影；不写实，不要霓虹。

【委托光柱】每个委托一根光柱（加法混合、向上渐隐）+ 底部光环 + 漂浮符文；按类型与紧急程度着色（紧急用暖橙）。聚焦的光柱放大变亮；进行中的委托与玩家之间画发光路径。射线拾取，命中半径照顾手指；拖动视角时不触发点击 → onFocus(quest)。

【玩家】userLocation 非空时放风格化角色（可按 userRace 着色）+ 精度圈；为空时不放角色，相机以时代广场为中心。

【相机】Pokémon GO 式：围绕焦点轨道旋转，单指/左键拖动旋转，双指/滚轮缩放，俯仰约 35°–70°；焦点委托变化时缓动飞过去；有进行中的委托时同时框住玩家与目标。手机触控优先，阻止页面滚动与双击缩放干扰。

【昼夜】按本地时间设定太阳角度、天空色、雾色；夜晚窗户发光、灯笼亮起。

【性能与工程】合批与 InstancedMesh，遵守简报的 draw call 预算；DPR 上限 2，低端设备（hardwareConcurrency ≤ 4 或手机）降到 1.5 并关重后处理；标签页隐藏停渲染；容器尺寸变化重算；卸载时 dispose 全部几何体、材质、纹理、renderer 并移除监听；调试钩子只在 ?debug=1 挂载，卸载时移除。后处理只用 three/examples/jsm 的模块，不新增 npm 依赖。

【交付】实现文件全部在 components/world/scene/**；不改 App.tsx 或其他角色的文件。写 docs/studio/handoff/world-engineer.md：App 怎么接入（React.lazy 写法、onFallback 时机、worldEvents 用法、调试钩子）。你负责的文件 tsc 无错误。
自查：在仓库根目录临时建 world-harness.html + world-harness.tsx 挂载 WorldMap（交付前必须删除，并在汇报中说明已删除），用 npx vite --port 4174 起服务，Playwright 桌面 + 手机截图（白天与夜晚各一张）存 ${SHOTS}/m1-world/，并读 render_game_to_text 核对光柱数与 renderer 读数。`, 'M1 垂直切片生产'),

  () => act('ui-designer', `${briefNote}

在 components/world/ui/ 下实现契约 E 的四个组件（纯展示，数据全走 props）：
- QuestFocusCard：取代 Leaflet 弹窗。手机上是底部抽屉卡片，桌面上底部居中或右侧。内容：类型、标题、现实中实际要做什么（realTask）、地点与距离、难度、需求等级（不足时按钮禁用并说明）、需要的职业（标出「适合你」）、报酬预览、「承接契约」按钮（已有进行中的委托时禁用并说明）、关闭。卡片不能遮住右下契约终端按钮与左下艾琳娜入口——要么避让，要么卡片出现时由 App 隐藏它们；在 handoff 里写清楚方案。
- WorldControls：回到我（无定位时禁用并提示）、视角重置、2D/3D 切换（canUse3d 为 false 时只能 2D 并说明原因）。位置不与右上公会/语言按钮、右下契约终端按钮冲突。
- TopHud：左上角档案块升级版——头像、种族、名字、等级 + 经验进度条（progressRatio）、信任分、金币；点击打开档案。
- SettlementToast：提交证明后的结算演出——金币 / 信任 / 经验逐项计数增长，升级时有专门段落；几秒后自动收起并调用 onDone；尊重 prefers-reduced-motion。
视觉：只用项目现有语言（rune-panel、金色细描边、暖石板、Cinzel + Noto Serif SC），参照 index.html 的 CSS 变量与现有组件（BountyBoard、ActiveQuestHUD、ElenaChat）。390×844 不溢出；触控目标 ≥ 44px；尊重 safe-area。
交付：写 docs/studio/handoff/ui-designer.md（每个组件放在 App 的哪里、z-index、与哪些现有元素互斥显示）。不改 App.tsx 或其他角色的文件。你负责的文件 tsc 无错误。
自查：在仓库根目录临时建 ui-harness.html + ui-harness.tsx 用假数据挂载四个组件（交付前必须删除，并在汇报中说明已删除），npx vite --port 4175，Playwright 在 1440×900 与 390×844 截图存 ${SHOTS}/m1-ui/。`, 'M1 垂直切片生产'),

  () => act('game-designer', `${briefNote}

1. lib/progression.ts 实现契约 D。经验曲线、委托经验、信任与贡献的结算规则自己设计，用 game-design-theory 的方法论论证；所有数值集中成常量表，逐个写理由注释。
   - settleQuest：gold += quest.rewardGold；trustScore += quest.trustPoints；magicules += questMagicules(quest)；guildContribution 增加；level 由 levelFromMagicules 重算（可跨多级，绝不下降）。
   - levelFromMagicules(0) 必须等于 1。
   - 结合现有执照条件（ProMembershipModal：level >= 2、trustScore > 110）：让正常游玩 1–3 个委托后能自然满足，在设计说明里写清楚。
2. constants.ts 的 INITIAL_QUESTS：保留现有 3 个（可调数值），新增到至少 12 个：
   - 18 个职业每个至少被一个委托的 neededProfessions 点名；
   - 5 种 type（物资运输 / 魔物讨伐 / 迷宫建设 / 异界交涉 / 紧急救援）都出现；
   - 难度梯度合理，minLevel 1 的入门委托至少 4 个，isUrgent 少量；
   - location 用真实纽约地点坐标，全部在 lat 40.70–40.80、lon -74.02 – -73.93 内，例如华盛顿广场公园、中央车站、布莱恩特公园、切尔西市场、高线公园、联合广场、纽约公共图书馆、洛克菲勒中心、炮台公园、市政厅公园、林肯中心、麦迪逊广场公园、汤普金斯广场公园；
   - 沿用现有风格：title、realTask、description 用英文，description 异世界化；新增委托不要 imageUrl。
3. types.ts 如需新增类型，只加不改。
4. 写 docs/studio/design.md：核心循环、1–10 级经验表、每个委托的设计意图、职业覆盖矩阵、数值理由。
5. 不碰 3D 场景与界面组件。你负责的文件 tsc 无错误。在 scratchpad（${SCRATCH}）写一个 node 自检脚本（不进仓库）验证 settleQuest 的结果与 18 职业全覆盖，汇报里贴结果。`, 'M1 垂直切片生产'),
])

if (!world) {
  log('✗ M1 闸门未通过：3D 世界没有交付，后续阶段无法进行')
  return { aborted: 'M1', director, ui, design, ledger, violations }
}
log('M1 完成：' + [world, ui, design].map((r, i) => `${['世界', '界面', '数值'][i]}${r ? '✓' : '✗'}`).join(' '))

// ════════════════ M2 Alpha 集成 ════════════════
phase('M2 Alpha 集成')
let lead = await act('lead-engineer', `${briefNote}

把 M1 三个角色的产出接进 App.tsx（你独占 App.tsx）。先读 docs/studio/brief.md 与 docs/studio/handoff/*.md。M1 汇报摘要：
- world-engineer：${world.summary}
- ui-designer：${ui ? ui.summary : '未交付——界面组件缺失，用最小实现补齐契约 E 后再集成'}
- game-designer：${design ? design.summary : '未交付——用最小实现补齐契约 D 后再集成'}

必须完成：
1. 3D 世界：React.lazy 加载 WorldMap（three 不进主包），Suspense 的加载画面与世界风格一致；mode 状态 '3d' | '2d'，默认 3d；WebGL 检测不可用或 onFallback 触发时切 2d 并记住原因；2d 模式渲染原 MapBoard。
2. 委托聚焦：focusedQuestId 存在时渲染 QuestFocusCard（3D 模式下取代 Leaflet 弹窗）；距离用 lib/geo 的 distanceMeters；接取走现有 handleAccept（保留艾琳娜的确认台词），接取后 worldEvents.emit 出 pulse 并关闭卡片。
3. WorldControls：接 mode 切换，recenter / resetView 发到 worldEvents。
4. TopHud：替换左上角档案块；progressRatio 用 levelProgress。
5. 结算：ProofSubmission 的 onConfirm 改为 settleQuest(user, activeQuest)，setUser(settlement.user)，显示 SettlementToast；leveledUp 时发 celebrate。删除写死的 level+1 / gold+100。
6. 布局冲突：按 ui-designer 的 handoff 处理 QuestFocusCard 与契约终端按钮、艾琳娜入口、ActiveQuestHUD 的避让或互斥。
7. handoff 里不合理的要求，做最小合理实现并在 issues 里说明。
8. npm run typecheck 与 npm run build 必须通过；确认构建产物里 three 在独立 chunk（看 build 输出）。用 Playwright（端口 4176，npx vite preview --port 4176 --strictPort）跑冒烟：同意页 → 觉醒流程 → 主界面看到 3D 世界，截图存 ${SHOTS}/m2-alpha/。
汇报额外给 gate_pass：typecheck、build、冒烟三项都通过才为 true。`, 'M2 Alpha 集成', schema({ gate_pass: { type: 'boolean' } }, ['gate_pass']))

if (!lead || !lead.gate_pass) {
  log('⚠ M2 闸门未通过，调试工程师介入修复')
  const fix = await act('debug-engineer', `M2 Alpha 集成未通过闸门。主程汇报：${lead ? JSON.stringify({ summary: lead.summary, verification: lead.verification, issues: lead.issues, blockers: lead.blockers }) : '主程未返回结果'}
目标：让 npm run typecheck、npm run build 通过，并让「同意页 → 觉醒 → 主界面 3D 世界」冒烟跑通（Playwright，端口 4174，截图存 ${SHOTS}/m2-fix/）。先复现、找根因、最小修复。汇报额外给 gate_pass。`, 'M2 Alpha 集成', schema({ gate_pass: { type: 'boolean' } }, ['gate_pass']))
  if (!fix || !fix.gate_pass) {
    log('✗ M2 闸门修复后仍未通过，流水线中止')
    return { aborted: 'M2', director, world, ui, design, lead, fix, ledger, violations }
  }
  lead = Object.assign({}, lead || {}, { repairedBy: fix })
}
log('M2 Alpha 通过')

// ════════════════ M3 Beta 打磨 ════════════════
phase('M3 Beta 打磨')
const qaTask = (round, prior) => `对当前版本做完整试玩验收（第 ${round} 轮${prior ? '，回归轮——上一轮缺陷清单附在最后，逐条确认是否已修复，同时继续找新问题' : ''}）。
步骤：npm run build，然后后台运行 npx vite preview --port 4173 --strictPort（记 PID，结束时 kill 该 PID）。Playwright + CLAUDE.md 里的 WebGL 启动参数；context 授予 geolocation 并设为时代广场 (40.7580, -73.9855)；URL 带 ?debug=1。
覆盖：
1. 桌面 1440×900：同意页 → 觉醒（起名、抽相貌、选职业、确认、等待载入）→ 主界面 3D 世界；截图。读 render_game_to_text：光柱数等于委托数、玩家存在、drawCalls / triangles。
2. 用 __world.tapBeacon(委托 id) 聚焦 → 截图 QuestFocusCard；点「承接契约」→ 确认 ActiveQuestHUD 出现；截图。
3. 提交证明：打开证明面板，上传一张自己生成的 png，等待结算 → 对照 lib/progression.ts 的 settleQuest 计算预期，核对 HUD 上等级 / 金币 / 信任的实际变化，SettlementToast 出现；截图。
4. 契约终端（BountyBoard）与艾琳娜对话面板能打开、能关闭（/api 无 key 报错属预期，只看界面是否优雅处理）；截图。
5. 手机 390×844（isMobile、hasTouch）重复 1–3 的关键画面；检查横向溢出（scrollWidth > innerWidth）、关键按钮包围盒是否互相重叠或被卡片遮挡；截图。
6. 2D 回退：用 --disable-webgl 启动，确认回退到 Leaflet 地图且界面可用（瓦片被拦属正常）；再在 3D 模式下用切换按钮切到 2D 再切回。
7. 全程收集 console error、pageerror、未处理的 promise rejection（排除 Google 字体证书、Carto 瓦片、/api 无 key 三类已知环境问题）。
8. 对照验收标准逐条判定：\n${ACCEPT}
测试脚本放 ${QA}/（不进仓库）；截图存 ${SHOTS}/m3-qa-r${round}/。不修改任何业务代码。
缺陷严重度：P0 崩溃 / 白屏 / 流程走不通；P1 核心功能错误或严重视觉问题；P2 一般问题；P3 打磨建议。每条附证据（截图路径、控制台原文或钩子读数）。
gate_pass = 没有 P0 / P1，且控制台无未处理异常。${prior ? '\n\n上一轮缺陷清单：\n' + JSON.stringify(prior) : ''}`

const qa1 = await act('qa-engineer', qaTask(1, null), 'M3 Beta 打磨', QA_SCHEMA)
const bugs1 = qa1 ? qa1.bugs : []
log(`QA 第 1 轮：${bugs1.length} 个缺陷（P0 ${bugs1.filter(b => b.severity === 'P0').length} / P1 ${bugs1.filter(b => b.severity === 'P1').length}）`)

const fixable1 = bugs1.filter(b => b.severity !== 'P3')
const debug1 = fixable1.length
  ? await act('debug-engineer', `按 QA 第 1 轮缺陷清单修复，优先 P0 → P1 → P2。先复现、找根因、最小修复、逐条验证（Playwright 端口 4174，截图存 ${SHOTS}/m3-debug-r1/）。改 App.tsx 以外的模块时保持其原有设计意图。另外做一次性能剖析：用 render_game_to_text 的 renderer 数据报告 draw call、三角形、几何体、纹理数，超出简报预算就优化。typecheck 与 build 必须通过。
缺陷清单：${JSON.stringify(fixable1)}
P3 建议（酌情处理，不强制）：${JSON.stringify(bugs1.filter(b => b.severity === 'P3'))}`, 'M3 Beta 打磨')
  : null

const art = await act('art-director', `用 threejs-aaa-graphics-builder 的 10 项画面评分卡评审当前 3D 世界。QA 截图在 ${SHOTS}/m3-qa-r1/；也可以自己用 Playwright（端口 4175，?debug=1）截图——桌面与手机、白天与夜晚（用 __world.setHour 切换）。
先逐项打分（1–10，写理由），再在 components/world/scene/** 内做画面提升（材质、光照、雾、天空、色调统一、后处理、地标辨识度），然后重新截图打分。遵守 CLAUDE.md 美术方向；draw call 不得比改前增加超过 20%（用 render_game_to_text 前后对比）。typecheck 与 build 通过。截图存 ${SHOTS}/m3-art/。
汇报额外给 scorecard_before、scorecard_after（各 10 个数字，顺序与评分卡一致）与 drawcalls_before、drawcalls_after。`, 'M3 Beta 打磨', schema({
  scorecard_before: { type: 'array', items: { type: 'number' } },
  scorecard_after: { type: 'array', items: { type: 'number' } },
  drawcalls_before: { type: 'number' },
  drawcalls_after: { type: 'number' },
}, ['scorecard_before', 'scorecard_after', 'drawcalls_before', 'drawcalls_after']))

const feel = await act('feel-designer', `用 game-feel 的方法为四个关键时刻加反馈层：
- 聚焦委托：相机推近 + 光柱响应；
- 接取委托：worldEvents 的 pulse 演出（光柱冲击波、轻微相机冲击）；
- 完成委托：SettlementToast 的计数节奏与冲击感；
- 升级：celebrate 演出。
可改 components/world/scene/** 与 components/world/ui/**；不改玩法数值、不新增音频资产依赖。强度与事件重要性成正比；prefers-reduced-motion 下关闭冲击与震动、保留必要信息。typecheck 与 build 通过；用 Playwright（端口 4176，?debug=1）截关键帧存 ${SHOTS}/m3-feel/。`, 'M3 Beta 打磨')

let qa2 = await act('qa-engineer', qaTask(2, bugs1), 'M3 Beta 打磨', QA_SCHEMA)
let qaFinal = qa2
let debug2 = null
if (qa2 && !qa2.gate_pass) {
  const blockers2 = qa2.bugs.filter(b => b.severity === 'P0' || b.severity === 'P1')
  log(`QA 回归未通过：仍有 ${blockers2.length} 个 P0/P1，追加一轮调试 + 回归`)
  debug2 = await act('debug-engineer', `QA 回归仍有阻断缺陷。只修 P0 / P1（P2 顺手可修），先复现找根因，逐条验证（Playwright 端口 4174，截图存 ${SHOTS}/m3-debug-r2/）。typecheck 与 build 必须通过。
缺陷清单：${JSON.stringify(qa2.bugs)}`, 'M3 Beta 打磨')
  qaFinal = await act('qa-engineer', qaTask(3, qa2.bugs), 'M3 Beta 打磨', QA_SCHEMA)
}
if (qaFinal) log(`M3 Beta ${qaFinal.gate_pass ? '通过' : '未完全通过（剩余问题计入发布风险）'}：剩余缺陷 ${qaFinal.bugs.length} 个`)

// ════════════════ M4 发布候选 ════════════════
phase('M4 发布候选')
const release = await act('release-engineer', `发布前检查并写 docs/studio/RELEASE.md：
- npm run build 结果；主包与 3D chunk 体积；three 是否独立分包、首屏是否被阻塞；
- 调试钩子只在 ?debug=1 下挂载（读代码确认，并用 Playwright 端口 4177 在不带参数时确认 window.__world 不存在）；
- Vercel（vercel.json、api/*.ts）与 Cloudflare（functions/）部署配置一致；README 中与本版本相关的部分（3D 世界、2D 回退、新增依赖 three 与 tailwind 构建、部署到 Vercel、艾琳娜在预览环境需要配置 MINIMAX_API_KEY 与 ALLOWED_ORIGINS）——需要就更新 README；
- 已知问题与风险：QA 未关闭的缺陷（最终一轮：${qaFinal ? JSON.stringify(qaFinal.bugs) : 'QA 未返回'}）、沙箱测不到的项（真实 GPU 帧率、真机 GPS、真机触控手感、MiniMax 未配置时艾琳娜不可用）；
- 测试指引：给测试者的 5–8 步试玩路径（含如何用 ?debug=1、如何切 2D、桌面浏览器如何模拟定位）。
汇报额外给 release_ready 与 bundle（体积摘要文本）。`, 'M4 发布候选', schema({ release_ready: { type: 'boolean' }, bundle: { type: 'string' } }, ['release_ready', 'bundle']))

return {
  director: director && { summary: director.summary, acceptance: director.acceptance, budget: director.budget },
  m1: { world: world && world.summary, ui: ui && ui.summary, design: design && design.summary },
  lead: lead && { summary: lead.summary, gate_pass: lead.gate_pass, issues: lead.issues },
  qa1: qa1 && { bugs: qa1.bugs, metrics: qa1.metrics, gate_pass: qa1.gate_pass },
  debug1: debug1 && debug1.summary,
  art: art && { before: art.scorecard_before, after: art.scorecard_after, dcBefore: art.drawcalls_before, dcAfter: art.drawcalls_after, summary: art.summary },
  feel: feel && feel.summary,
  debug2: debug2 && debug2.summary,
  qaFinal: qaFinal && { bugs: qaFinal.bugs, metrics: qaFinal.metrics, gate_pass: qaFinal.gate_pass, screenshots: qaFinal.screenshots },
  release: release && { ready: release.release_ready, bundle: release.bundle, summary: release.summary, issues: release.issues },
  skillLedger: ledger,
  violations,
}
