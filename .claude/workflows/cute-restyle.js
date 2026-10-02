export const meta = {
  name: 'cute-restyle',
  description: '异界觉醒美术转向：宝可梦 GO 式可爱 3D，覆盖 3D 世界与全站界面；风格定稿 → 并行生产 → 集成 → Beta 打磨 → 发布，每个角色强制调用对应 skill',
  whenToUse: '整体更换美术方向、需要 3D 世界与全部界面同步换皮时。args.scratch 传会话 scratchpad 路径。',
  phases: [
    { title: 'S0 风格定稿', detail: '美术总监写风格指南、铺全局 token 与共享原语' },
    { title: 'P 并行生产', detail: '3D 世界 · 世界界面 · 引导与档案 · 公会与对话' },
    { title: 'I 集成', detail: '主程接 App.tsx 外框与全部交接' },
    { title: 'B 打磨', detail: 'QA → 调试 → 美术一致性 → 手感 → 回归' },
    { title: 'R 发布', detail: '包体、清理旧样式、文档' },
  ],
}

if (!args || !args.scratch) throw new Error('缺少 args.scratch')
const SCRATCH = args.scratch
const QA = SCRATCH + '/qa-tools'
const SHOTS = SCRATCH + '/qa-shots'

const ROLES = {
  'art-director': { title: '美术总监', skills: ['threejs-aaa-graphics-builder', 'threejs-game-ui-designer', 'game-ui-design'] },
  'world-engineer': { title: '3D 世界工程师', skills: ['threejs-game-director', 'threejs-gameplay-systems', 'threejs-aaa-graphics-builder'] },
  'ui-designer': { title: '游戏 UI 设计师', skills: ['threejs-game-ui-designer', 'game-ui-design', 'game-ui-ux'] },
  'lead-engineer': { title: '主程 / 集成者', skills: ['game-engine', 'game-developer', 'threejs-game-ui-designer'] },
  'qa-engineer': { title: 'QA 工程师', skills: ['threejs-qa-release', 'develop-web-game'] },
  'debug-engineer': { title: '调试与性能工程师', skills: ['threejs-debug-profiler'] },
  'feel-designer': { title: '手感设计师', skills: ['game-feel'] },
  'release-engineer': { title: '发布工程师', skills: ['threejs-qa-release'] },
}

const CONTEXT = `你在「异界觉醒」仓库 /home/user/yijie-juexing 工作（分支 claude/great-davinci-1q0q45）。项目规范 CLAUDE.md 已注入你的上下文——其中美术方向刚改为「宝可梦 GO 式可爱 3D」，并新增了禁止使用宝可梦知识产权元素的约束，务必遵守。

## 本次目标：美术方向整体转向（只做前端视觉，不碰后端）
用户的原话：「视觉效果需要升级一下，就 3D 那种，可爱的风格」，并选择了「宝可梦 GO 式」参照，范围是「3D 世界 + 全站界面」。
现状：上一个版本已交付一个可玩的 3D 世界地图垂直切片（components/world/scene/**，程序化纽约、委托光柱、玩家、昼夜、相机），世界界面（components/world/ui/**），数值结算（lib/progression.ts），12 个委托覆盖 18 个职业。但整体美术是「大地色 / 暗金 / 旷野之息」，界面是深色石板 + 金色细描边。这一轮要把它整体换成明亮可爱的宝可梦 GO 式风格，玩法与数据逻辑不动。

## 方向种子（风格指南 docs/studio/style-cute.md 定稿后，以风格指南为准）
3D 世界：明亮清爽的地图——浅绿陆地、鲜绿公园、奶白或浅黄道路、明亮的蓝色水面；建筑是低矮、圆润、粉彩色的简化体块（中城可以高一些但要软化）；棒棒糖形圆树；天空是浅蓝到白的渐变，地平线有蓬松卡通云，远处地图渐隐进天空；卡通着色（toon 渐变或柔和的 lambert），柔和的投影或假阴影；夜晚是深海军蓝地图配发光的委托标记。相机是 GO 式低视角：玩家 Q 版角色在画面下三分之一，能看到地平线，仍可拖动旋转与缩放。委托标记是自行设计的悬浮徽章（立在细柱上、缓慢旋转与上下浮动、地面有脉冲光圈），按委托类型分色分形，紧急委托有醒目的弹跳提示。玩家是 Q 版大头小人，按 12 种族加配件（角、光环与翅膀、尖耳、胡子、兽耳、小翅、缝线、鳍耳、石质、半透明蓝色史莱姆等），待机浮动，移动时有走路动画。
界面：白色或浅色圆角面板（大圆角）、柔和投影、粗圆体文字、明亮的强调色（青绿 / 天蓝 / 暖黄 / 珊瑚红用于紧急）、圆形图标按钮、卡片用委托类型色做头部、弹性动效。主按钮（契约终端）做成自行设计的圆形公会徽章按钮。
IP 红线：不得出现精灵球（红白球）、补给站方块、道馆塔、任何宝可梦形象、宝可梦字体或 logo。借鉴的只是这一类游戏的通用视觉语言。

## 不能破坏的东西
- 上一版本的接口契约全部保留（可以加字段，不可改名或删除）：WorldMap 的 props 与 onFallback；worldEvents（recenter / resetView / pulse / celebrate）；?debug=1 下的 window.render_game_to_text 与 window.__world（tapBeacon、focusQuest、setHour、recenter、stats）；lib/progression.ts 的结算函数；世界界面组件的 props。
- 所有接取都走 App.tsx 的 handleAccept（艾琳娜确认），不要新增绕过它的入口。
- 觉醒流程每一步的主按钮在所有视口都必须完整可见可点（上一轮的 P0），QA 脚本 ${QA}/qa-r2-awaken-sizes.mjs 必须保持 33/33 通过。
- 2D 回退（Leaflet MapBoard）保留并可用。
- 包体预算：入口 JS ≤ 520 KB（原始）；3D chunk 当前 644 KB，预算放宽到 ≤ 720 KB 原始 / ≤ 200 KB gzip，超出必须说明理由。draw call 维持在 60 以内（当前约 30）。

## 文件所有权（并行阶段严格遵守）
- 美术总监（S0）：docs/studio/style-cute.md、index.html（:root token 与字体链接、全局样式）、tailwind.config.js、index.css。S0 之后这三个全局文件冻结，P 阶段任何人都不改；需要新 token 写进交接文档。
- world-engineer：components/world/scene/**
- ui-designer「世界界面」：components/world/ui/**、components/ActiveQuestHUD.tsx、components/ProofSubmission.tsx
- ui-designer「引导与档案」：components/ConsentGate.tsx、components/VerificationModal.tsx、components/TrustVerification.tsx、components/ProfileModal.tsx、components/ProMembershipModal.tsx、components/FriendsBoard.tsx
- ui-designer「公会与对话」：components/BountyBoard.tsx、components/BountyRail.tsx、components/GuildBoard.tsx、components/ElenaChat.tsx、components/MapBoard.tsx
- lead-engineer：App.tsx 独占
交接文档写在 docs/studio/handoff/cute-<你的分工>.md。

## 环境事实
- 无头 Chromium + WebGL2 可用（SwiftShader），启动参数见 CLAUDE.md。Playwright 在 ${QA}/node_modules，该目录下已有上一轮的成熟脚本可复用：qa-r2-lib.mjs、qa-r2-desktop.mjs、qa-r2-mobile.mjs、qa-r2-awaken-sizes.mjs、qa-r2-robust.mjs（界面换皮后选择器可能失效，需要相应更新）。截图根目录 ${SHOTS}。
- 沙箱里 Google 字体证书失败会退回系统字体、Carto 瓦片被拦、/api/* 没有 MiniMax key 会报错——这三项是环境限制，不是缺陷。截图里的字体不是最终字体，判断字体效果以代码与风格指南为准。
- 软件渲染 fps 无参考价值，性能结论以 draw call / 三角形 / 纹理为准。
- 起本地服务只用分配给你的端口，结束时按 PID 关闭。不要用 pkill -f 或 killall（会匹配到你自己的 shell 把它杀掉）。
- 多个角色同时在同一工作区改不同文件，别人文件里的瞬时类型错误不要去修，只对你负责的文件负责。临时样张或 harness 文件用你的分工名做前缀，交付前删除并在汇报中说明。`

const REPORT_PROPS = {
  skills_invoked: { type: 'array', items: { type: 'string' } },
  files_changed: { type: 'array', items: { type: 'string' } },
  verification: { type: 'string' },
  summary: { type: 'string' },
  issues: { type: 'array', items: { type: 'string' } },
  blockers: { type: 'array', items: { type: 'string' } },
}
const REQ = Object.keys(REPORT_PROPS)
const schema = (extra, extraReq) => ({ type: 'object', properties: Object.assign({}, REPORT_PROPS, extra || {}), required: REQ.concat(extraReq || []) })
const REPORT = schema()
const GATE = schema({ gate_pass: { type: 'boolean' } }, ['gate_pass'])
const BUG = { type: 'object', properties: { id: { type: 'string' }, severity: { type: 'string', enum: ['P0', 'P1', 'P2', 'P3'] }, area: { type: 'string' }, title: { type: 'string' }, steps: { type: 'string' }, evidence: { type: 'string' } }, required: ['id', 'severity', 'area', 'title', 'steps', 'evidence'] }
const QA_SCHEMA = schema({ bugs: { type: 'array', items: BUG }, screenshots: { type: 'array', items: { type: 'string' } }, metrics: { type: 'string' }, gate_pass: { type: 'boolean' } }, ['bugs', 'screenshots', 'metrics', 'gate_pass'])

const ledger = []
const violations = []

function rolePrompt(role, label, task) {
  const r = ROLES[role]
  return `你是异界觉醒游戏工作室的 ${role}（${r.title}${label ? '，本轮分工：' + label : ''}）。

## 第一步（强制，不可跳过）
在读代码、写代码之前，依次用 Skill 工具调用：${r.skills.join('、')}。读完再按它们的方法论工作。汇报里的 skills_invoked 必须如实列出实际调用成功的 skill 名，会被逐个核对；调用失败写进 blockers，不要假装调用过。

${CONTEXT}

## 你的任务
${task}

## 汇报
skills_invoked、files_changed、verification（实际跑过的命令与结果）、summary（中文，具体）、issues、blockers。没有就给空数组。`
}

async function act(role, label, task, phaseName, sch) {
  const res = await agent(rolePrompt(role, label, task), { label: label ? `${role}·${label}` : role, phase: phaseName, schema: sch || REPORT, agentType: role })
  const tag = label ? `${role}·${label}` : role
  if (!res) { log(`⚠ ${tag} 没有返回结果`); violations.push(`${tag}：未返回结果`); return null }
  const got = res.skills_invoked || []
  const missing = ROLES[role].skills.filter(s => !got.includes(s))
  ledger.push({ role: tag, required: ROLES[role].skills, invoked: got, missing })
  if (missing.length) { violations.push(`${tag}：未调用 ${missing.join('、')}`); log(`⚠ 流程违规：${tag} 未调用 ${missing.join('、')}`) }
  else log(`✓ ${tag} 已调用 ${ROLES[role].skills.join('、')}`)
  if ((res.blockers || []).length) log(`⚠ ${tag} 报告阻断：${res.blockers.join('；')}`)
  return res
}

// ═══════════ S0 风格定稿 ═══════════
phase('S0 风格定稿')
const style = await act('art-director', '风格定稿', `1. 基线：用 ${QA} 里现成的脚本（或自己写）在端口 4175 的生产预览上截取改版前的画面，存 ${SHOTS}/s0-before/：同意页、觉醒四步、3D 世界白天与夜晚、委托聚焦卡、结算卡、契约终端、艾琳娜对话框、个人档案、公会大厅——桌面 1440×900 与手机 390×844 各一套。
2. 写 docs/studio/style-cute.md（中文），它将是这一轮所有人的唯一视觉依据：
   - 一句话风格定义；借鉴宝可梦 GO 这一类游戏的哪些通用视觉语言、明确不借鉴哪些 IP 元素。
   - 界面 token：颜色（页面背景、面板、面板描边、主文字、次文字、弱文字、强调色、5 种委托类型色：物资运输 / 魔物讨伐 / 迷宫建设 / 异界交涉 / 紧急救援、状态色：成功 / 注意 / 紧急 / 禁用），每个给 hex，并验证文字对其背景的对比度 ≥ 4.5:1（大字 ≥ 3:1）；字体（中文与西文，Google Fonts 名称加回退栈，确认所选中文字体覆盖简体中文）；字号阶梯；圆角；阴影；间距；动效时长与弹性缓动曲线；图标风格。
   - 组件规范：面板、主按钮、次按钮、圆形图标按钮、标签、委托卡（类型色头部）、进度条、Toast、模态框与底部抽屉、输入框、步骤指示器——每个给尺寸与 hover / pressed / focus / disabled 状态。
   - 3D 规范：白天与夜晚色板（陆地、公园、道路、水、3–5 种建筑色、地标点缀、天空渐变、雾）；材质与着色策略；光照（各光源强度与颜色、按画质档位的阴影策略）；造型语言（圆角、倒角、比例、建筑密度）；委托标记的造型设计（自行设计的悬浮徽章 + 细柱 + 地面光圈；5 种类型各自的颜色、形状与图标；聚焦态、进行中、已完成、紧急态）；玩家 Q 版角色的比例、表情与 12 个种族的配件；进行中委托的路径表现；GO 式默认相机俯仰与距离；氛围元素（云、飘浮光点）。
   - 2D 回退地图（Leaflet）的瓦片滤镜与标记样式。
   - 布局：主界面各元素的位置（可以参照 GO 的布局调整，但要考虑现有的艾琳娜入口、契约终端、世界控件、顶部档案，写清楚每个元素在哪、谁负责）。
   - 组件 → 分工 → 文件 的映射表（按上面的文件所有权）。
3. 铺地基（只加不删，保证迁移期间旧界面不坏）：
   - index.html：Google Fonts 链接追加所选字体；:root 新增 --cute-* 系列 token（旧 token 保留）。
   - tailwind.config.js：theme.extend 下新增语义色（如 cute、quest 等命名空间）、字体族、圆角、阴影；不要改旧的 slate / amber 等重映射——旧组件迁移期间还靠它们，清理在发布阶段做。
   - index.css：@layer components 下新增共享原语类（如 .cute-panel、.cute-btn、.cute-btn-primary、.cute-icon-btn、.cute-chip、.cute-card、.cute-sheet、.cute-input、.cute-steps 等），全部引用 token，包含各状态与 prefers-reduced-motion。
   - 临时样张页 style-harness.html + style-harness.tsx 渲染全部原语与 5 种委托类型色，桌面与手机截图存 ${SHOTS}/s0-style/，然后删除这两个文件。
4. 不改任何 components/ 下的文件、不改 3D 场景、不改 App.tsx。npm run typecheck 与 npm run build 通过。
汇报额外给 tokens_summary：给其他角色看的 token 速查（主色 hex、委托类型色 hex、字体、圆角、阴影、原语类名清单、3D 白天夜晚主色）。`, 'S0 风格定稿', schema({ tokens_summary: { type: 'string' } }, ['tokens_summary']))

if (!style || ledger[0].missing.length) {
  log('✗ S0 未通过：美术总监未调用 skill 或未交付，流水线中止')
  return { aborted: 'S0', style, ledger, violations }
}
const STYLE_NOTE = `风格指南已定稿：docs/studio/style-cute.md（先通读）。改版前截图在 ${SHOTS}/s0-before/，原语样张截图在 ${SHOTS}/s0-style/。token 速查：\n${style.tokens_summary}`

// ═══════════ P 并行生产 ═══════════
phase('P 并行生产')
const uiCommon = `用 index.css 里的共享原语类与 tailwind 新增的语义 token，不要硬编码风格指南之外的颜色；index.html、tailwind.config.js、index.css 已冻结，需要新 token 写进你的交接文档。保持每个组件现有的 props、行为与无障碍属性（role、aria、按钮名称文本尽量保留，QA 脚本靠它们定位；必须改的写进交接文档）。390×844 与 1440×900 都不溢出、不遮挡；触控目标 ≥ 44px；尊重 safe-area 与 prefers-reduced-motion。不改 App.tsx 与其他分工的文件。你负责的文件 tsc 无错误。`

const [world, uiWorld, uiOnboard, uiGuild] = await parallel([
  () => act('world-engineer', '可爱 3D 世界', `${STYLE_NOTE}

按风格指南的 3D 规范，在 components/world/scene/** 内把世界整体换成宝可梦 GO 式可爱风：
- 地面、公园、道路、水、建筑、地标全部按新色板与造型语言重做（建筑更低更圆润更粉彩，地标卡通化但仍可辨认：时代广场、中央公园、布鲁克林大桥、帝国大厦）；棒棒糖圆树；天空渐变 + 地平线蓬松云 + 远景渐隐；卡通着色；夜晚模式。
- 委托标记换成风格指南设计的悬浮徽章（细柱、旋转浮动、地面脉冲光圈），5 种类型分色分形，聚焦 / 进行中 / 已完成 / 紧急各有状态。拾取与命中半径保持。
- 玩家换成 Q 版大头角色，按 userRace 加 12 种族配件，待机浮动、移动时走路动画、脚下精度圈。
- 进行中委托的路径换成可爱的点状或足迹轨迹。
- 默认相机改为 GO 式低视角（角色在画面下三分之一、能看到地平线），保留拖动旋转、缩放与俯仰限制；聚焦与框选逻辑保持。
- 契约 A / B / C 全部保留；render_game_to_text 字段不减少。
- 遵守包体与 draw call 预算；低档设备的降级策略保留。
- 更新 docs/studio/handoff/cute-world.md。
自查：仓库根目录临时 world-harness.html + world-harness.tsx 挂载 WorldMap（交付前删除），npx vite --port 4174，Playwright 桌面与手机、白天与夜晚截图，加一张 12 种族玩家角色的合照（可以用 harness 依次切换 userRace），存 ${SHOTS}/p-world/；读 render_game_to_text 核对光柱数、draw call、三角形。`, 'P 并行生产'),

  () => act('ui-designer', '世界界面', `${STYLE_NOTE}

负责文件：components/world/ui/**（QuestFocusCard、WorldControls、TopHud、SettlementToast、worldUi.css、strings.ts 等）、components/ActiveQuestHUD.tsx、components/ProofSubmission.tsx。
按风格指南换成可爱风，同时修掉上一轮遗留的三个 P3：
- QA-R2-02：无定位 / 不在纽约时，世界控件常驻的「回到我」提示框盖住默认视角里的光柱图标——改位置或改成图标 + 点按说明。
- QA-R1-11：手机 390×844 上结算卡片盖住画面中心的玩家与庆祝演出——手机上贴顶部或缩小。
- QA-R2-03：切到英文后 ProofSubmission 文案仍是中文——补齐英文串。
${uiCommon}
交接文档 docs/studio/handoff/cute-world-ui.md。
自查：仓库根目录临时 worldui-harness.html + .tsx 用假数据挂载各组件的全部状态（交付前删除），npx vite --port 4178，桌面与手机截图存 ${SHOTS}/p-world-ui/。`, 'P 并行生产'),

  () => act('ui-designer', '引导与档案', `${STYLE_NOTE}

负责文件：components/ConsentGate.tsx、components/VerificationModal.tsx、components/TrustVerification.tsx、components/ProfileModal.tsx、components/ProMembershipModal.tsx、components/FriendsBoard.tsx。
按风格指南换成可爱风。注意：
- 觉醒流程是玩家的第一印象，要明亮可爱、有仪式感；背景图 public/assets/hero-landing.jpg 是一张偏暗的森林画，按风格指南决定是换成明亮的渐变 / 程序化天空，还是用浅色遮罩提亮。
- 立绘是现成的 2D 动漫插画（48 张，不能重新生成），用可爱风的圆角相框与浅色底呈现，保证上面的文字在浅色立绘上也可读（上一轮 QA-R2-01 已修过遮罩，换皮时不要退化）。
- 觉醒每一步主按钮在所有视口完整可见可点：改完后在端口 4179 的预览上跑 ${QA}/qa-r2-awaken-sizes.mjs 必须 33/33（若因按钮文案或结构改动导致选择器失效，更新脚本并在汇报里说明改了什么）。
${uiCommon}
交接文档 docs/studio/handoff/cute-onboarding.md。
自查：npx vite preview --port 4179（先 build）或 dev，走完同意 → 觉醒 → 进入主界面，再打开档案、执照、好友、信任认证，桌面与手机截图存 ${SHOTS}/p-onboarding/。`, 'P 并行生产'),

  () => act('ui-designer', '公会与对话', `${STYLE_NOTE}

负责文件：components/BountyBoard.tsx（契约终端）、components/BountyRail.tsx、components/GuildBoard.tsx（公会大厅，较大）、components/ElenaChat.tsx（艾琳娜对话框）、components/MapBoard.tsx（2D 回退地图的瓦片滤镜、标记与弹窗）。
按风格指南换成可爱风。注意：
- 艾琳娜的立绘资产缺失（public/assets/elena/ 不存在），契约终端与对话框的占位现在会把内部路径当文字显示（上一轮 QA-R1-13）——换成可爱的占位徽章 + 名字，不显示任何路径。
- 契约终端的委托卡用委托类型色做头部；接取按钮仍调用传入的 onAccept（走 App 的 handleAccept），不要绕过。
- 艾琳娜对话框在 /api 没有 key 时显示友好提示，换皮后保持。
- 2D 回退地图：原先是 sepia 羊皮纸滤镜，改成与新 3D 色板一致的明亮滤镜；标记换成与 3D 徽章同一套设计语言（2D 版）。
${uiCommon}
交接文档 docs/studio/handoff/cute-guild.md。
自查：npx vite preview --port 4180（先 build）或 dev，进入主界面后打开契约终端（问候与列表两态、5 个分类）、公会大厅各标签、艾琳娜对话框、切 2D 地图，桌面与手机截图存 ${SHOTS}/p-guild/。`, 'P 并行生产'),
])

if (!world) {
  log('✗ P 阶段 3D 世界未交付，流水线中止')
  return { aborted: 'P', style, uiWorld, uiOnboard, uiGuild, ledger, violations }
}
log('P 完成：' + [world, uiWorld, uiOnboard, uiGuild].map((r, i) => `${['世界', '世界界面', '引导档案', '公会对话'][i]}${r ? '✓' : '✗'}`).join(' '))

// ═══════════ I 集成 ═══════════
phase('I 集成')
const sum = (r) => (r ? r.summary : '未交付——按风格指南用最小实现补齐该分工的换皮后再集成')
let lead = await act('lead-engineer', '集成', `${STYLE_NOTE}

你独占 App.tsx。先读 docs/studio/handoff/cute-*.md。P 阶段汇报摘要：
- 3D 世界：${sum(world)}
- 世界界面：${sum(uiWorld)}
- 引导与档案：${sum(uiOnboard)}
- 公会与对话：${sum(uiGuild)}
必须完成：
1. App.tsx 里的外框界面按风格指南换皮：右上公会与语言按钮、契约终端主按钮（风格指南设计的圆形公会徽章按钮，不能像精灵球）、3D 加载画面、定位告知条、接取被拦的说明条、错误边界的回退界面，以及风格指南规定的主界面布局调整。
2. 接入所有交接文档里的要求；不合理的做最小合理实现并在 issues 说明。
3. 某个分工未交付时，按风格指南对其文件做最小换皮补齐（此时你可以改那些文件）。
4. npm run typecheck、npm run build 通过；看 build 输出确认包体在预算内、three 仍在独立 chunk。
5. Playwright 冒烟（端口 4176，npx vite preview --port 4176 --strictPort）：同意 → 觉醒 → 主界面 3D 世界 → 聚焦一个委托 → 承接，桌面与手机截图存 ${SHOTS}/i-alpha/。
gate_pass：typecheck、build、冒烟都通过才为 true。`, 'I 集成', GATE)

if (!lead || !lead.gate_pass) {
  log('⚠ 集成闸门未通过，调试工程师介入')
  const fix = await act('debug-engineer', '集成修复', `集成未通过闸门。主程汇报：${lead ? JSON.stringify({ summary: lead.summary, verification: lead.verification, issues: lead.issues, blockers: lead.blockers }) : '未返回'}
目标：typecheck、build 通过，「同意 → 觉醒 → 主界面 3D 世界 → 聚焦 → 承接」冒烟跑通（端口 4174，截图存 ${SHOTS}/i-fix/）。先复现找根因，最小修复。`, 'I 集成', GATE)
  if (!fix || !fix.gate_pass) { log('✗ 集成修复后仍未通过，流水线中止'); return { aborted: 'I', style, world, uiWorld, uiOnboard, uiGuild, lead, fix, ledger, violations } }
  lead = Object.assign({}, lead || {}, { repairedBy: fix })
}
log('I 集成通过')

// ═══════════ B 打磨 ═══════════
phase('B 打磨')
const qaTask = (round, prior) => `对可爱风改版做第 ${round} 轮验收${prior ? '（回归轮，上一轮缺陷清单在最后，逐条确认并继续找新问题）' : ''}。
步骤：npm run build，后台 npx vite preview --port 4173 --strictPort（记 PID，结束时 kill）。复用并按需更新 ${QA} 里的 qa-r2-*.mjs 脚本（换皮后选择器可能变了）。
一、功能回归（上一版本的能力一项都不能丢）：同意 → 觉醒 → 3D 世界 → tapBeacon 聚焦 → 承接（艾琳娜确认台词请求）→ 定位到委托附近提交证明 → 结算数值符合 lib/progression.ts → 刷新后成长保留；契约终端与艾琳娜对话框开关；2D 回退与 2D/3D 切换；无定位 / 不在纽约；?debug=1 钩子完整、不带参数时不存在；觉醒页 qa-r2-awaken-sizes.mjs 33/33；控制台无 pageerror / 未处理异常 / 非环境噪音的 console.error。
二、视觉验收（这一轮的重点）：桌面 1440×900 与手机 390×844 下逐个截图——同意页、觉醒四步、3D 世界白天与夜晚（__world.setHour）、委托聚焦卡（5 种类型各一）、进行中 HUD、证明提交、结算与升级、契约终端、公会大厅、艾琳娜对话框、个人档案、执照、好友、信任认证、2D 回退地图。对照 docs/studio/style-cute.md 逐屏判定：是否已是新风格（残留的深色石板 + 金边旧界面记为缺陷）、色值是否来自 token、文字对比度、圆角与阴影是否一致、触控目标、溢出与遮挡、IP 红线（任何像精灵球、补给站方块、道馆的图形记为 P1）。
三、包体与渲染读数：入口与 3D chunk 体积对照预算；draw call / 三角形 / 纹理。
测试脚本放 ${QA}/，截图存 ${SHOTS}/b-qa-r${round}/。不修改业务代码。
严重度：P0 崩溃 / 白屏 / 流程走不通；P1 核心功能错误、严重视觉问题、IP 红线；P2 一般问题（含残留旧风格界面）；P3 打磨建议。每条附证据。
gate_pass = 没有 P0 / P1 且控制台无未处理异常。${prior ? '\n\n上一轮缺陷清单：\n' + JSON.stringify(prior) : ''}`

const qa1 = await act('qa-engineer', '第 1 轮', qaTask(1, null), 'B 打磨', QA_SCHEMA)
const bugs1 = qa1 ? qa1.bugs : []
log(`QA 第 1 轮：${bugs1.length} 个缺陷（P0 ${bugs1.filter(b => b.severity === 'P0').length} / P1 ${bugs1.filter(b => b.severity === 'P1').length} / P2 ${bugs1.filter(b => b.severity === 'P2').length}）`)

const fix1 = bugs1.filter(b => b.severity !== 'P3')
const debug1 = fix1.length ? await act('debug-engineer', '第 1 轮修复', `按 QA 第 1 轮缺陷清单修复，优先 P0 → P1 → P2，先复现找根因，逐条验证（端口 4174，截图存 ${SHOTS}/b-debug-r1/）。视觉类缺陷按 docs/studio/style-cute.md 修。typecheck 与 build 通过。
缺陷：${JSON.stringify(fix1)}
P3（酌情）：${JSON.stringify(bugs1.filter(b => b.severity === 'P3'))}`, 'B 打磨') : null

const art = await act('art-director', '一致性打磨', `你是风格指南的作者，现在做一次全局一致性与品质打磨。QA 第 1 轮截图在 ${SHOTS}/b-qa-r1/，也可以自己用 Playwright（端口 4175，?debug=1）截图。
1. 用 threejs-aaa-graphics-builder 的 10 项评分卡给 3D 世界打分（白天与夜晚、桌面与手机），在 components/world/scene/** 内做提升，再重新打分；draw call 不得比改前增加超过 20%。
2. 逐屏检查全站界面与风格指南的一致性（颜色、字体、圆角、阴影、间距、图标、状态），直接修正不一致之处——这一阶段是串行的，你可以改任何前端文件，包括全局 token 文件；改了 token 要同步更新风格指南。
3. 确认 IP 红线。
typecheck 与 build 通过。截图存 ${SHOTS}/b-art/。汇报额外给 scorecard_before、scorecard_after（各 10 个数字）。`, 'B 打磨', schema({ scorecard_before: { type: 'array', items: { type: 'number' } }, scorecard_after: { type: 'array', items: { type: 'number' } } }, ['scorecard_before', 'scorecard_after']))

const feel = await act('feel-designer', '可爱手感', `用 game-feel 的方法给可爱风加弹性反馈，强度与事件重要性成正比：
- 按钮与卡片：按下挤压、松开回弹；面板与底部抽屉弹性入场。
- 委托徽章：待机浮动、点按时 pop、聚焦时放大与星光；接取时（worldEvents pulse）冲击波与轻微相机冲击。
- 玩家 Q 版角色：接取时开心地跳一下；结算与升级（celebrate）时星星 / 彩纸。
- 结算卡计数节奏与升级段落的高潮时机。
可改 components/world/scene/** 与 components/world/ui/** 以及其他组件的动效部分；不改玩法数值、不新增音频依赖。prefers-reduced-motion 下关闭冲击、震动与彩纸，保留必要信息。typecheck 与 build 通过；Playwright（端口 4176）截关键帧存 ${SHOTS}/b-feel/。`, 'B 打磨')

let qaFinal = await act('qa-engineer', '第 2 轮', qaTask(2, bugs1), 'B 打磨', QA_SCHEMA)
let debug2 = null
if (qaFinal && !qaFinal.gate_pass) {
  log(`QA 回归未通过，追加一轮调试 + 回归`)
  debug2 = await act('debug-engineer', '第 2 轮修复', `QA 回归仍有阻断缺陷。只修 P0 / P1（P2 顺手可修），先复现找根因，逐条验证（端口 4174，截图存 ${SHOTS}/b-debug-r2/）。typecheck 与 build 通过。
缺陷：${JSON.stringify(qaFinal.bugs)}`, 'B 打磨')
  qaFinal = await act('qa-engineer', '第 3 轮', qaTask(3, qaFinal.bugs), 'B 打磨', QA_SCHEMA)
}
if (qaFinal) log(`B 打磨${qaFinal.gate_pass ? '通过' : '未完全通过（剩余计入发布风险）'}：剩余缺陷 ${qaFinal.bugs.length} 个`)

// ═══════════ R 发布 ═══════════
phase('R 发布')
const release = await act('release-engineer', '可爱风发布', `发布前检查：
- npm run build；入口与 3D chunk 体积对照预算（3D ≤ 720 KB 原始 / ≤ 200 KB gzip）。
- 清理旧风格遗留：tailwind.config.js 里旧的 slate / amber 等重映射、index.html 里的 rune-panel / parchment-noise 等旧类与旧 token、worldUi.css 等文件里的旧变量——逐个 grep 确认已无引用后再删除；仍有引用的保留并列出来。删除后 typecheck、build 通过，并用 Playwright（端口 4177）对同意页、3D 世界、契约终端、艾琳娜对话框各截一张确认没有因清理而走样。
- 调试钩子只在 ?debug=1 下挂载。
- 更新 README 的美术描述（宝可梦 GO 式可爱 3D、风格指南位置）；在 docs/studio/RELEASE.md 顶部新增「可爱风改版」一节：变更摘要、包体、QA 最终结论与遗留缺陷（最终一轮：${qaFinal ? JSON.stringify(qaFinal.bugs) : 'QA 未返回'}）、沙箱测不到的项、测试指引。
汇报额外给 release_ready 与 bundle。`, 'R 发布', schema({ release_ready: { type: 'boolean' }, bundle: { type: 'string' } }, ['release_ready', 'bundle']))

return {
  style: style && style.summary,
  production: { world: world && world.summary, uiWorld: uiWorld && uiWorld.summary, uiOnboard: uiOnboard && uiOnboard.summary, uiGuild: uiGuild && uiGuild.summary },
  lead: lead && { summary: lead.summary, gate_pass: lead.gate_pass, issues: lead.issues },
  qa1: qa1 && { bugs: qa1.bugs, gate_pass: qa1.gate_pass, metrics: qa1.metrics },
  debug1: debug1 && debug1.summary,
  art: art && { before: art.scorecard_before, after: art.scorecard_after, summary: art.summary },
  feel: feel && feel.summary,
  debug2: debug2 && debug2.summary,
  qaFinal: qaFinal && { bugs: qaFinal.bugs, gate_pass: qaFinal.gate_pass, metrics: qaFinal.metrics, screenshots: qaFinal.screenshots },
  release: release && { ready: release.release_ready, bundle: release.bundle, summary: release.summary, issues: release.issues },
  skillLedger: ledger,
  violations,
}
