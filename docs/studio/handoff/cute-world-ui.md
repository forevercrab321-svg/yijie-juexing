# 交接 · ui-designer「世界界面」（可爱风换皮）→ lead-engineer / QA / 相关分工

| 项 | 内容 |
|---|---|
| 角色 | ui-designer（本轮分工：世界界面） |
| 调用的 skill | `threejs-game-ui-designer`、`game-ui-design`、`game-ui-ux`（并读了 ui-patterns / patterns / sharp_edges / validations / layout-and-flow） |
| 视觉依据 | `docs/studio/style-cute.md` v1.0（第 3–4 节 token 与原语、7.1 布局） |
| 负责文件 | `components/world/ui/**`、`components/ActiveQuestHUD.tsx`、`components/ProofSubmission.tsx` |
| 冻结文件 | 没碰 `index.html` / `tailwind.config.js` / `index.css` / `App.tsx`；**不需要新 token**（全部用现有 `--cute-*` / `--quest-*`、`.cute-*` 原语与 Tailwind `cute` / `quest` 命名空间） |
| 临时文件 | `worldui-harness.html`、`worldui-harness.tsx`、`worldui-vite.config.mjs` 已删除；自查脚本与截图都在 scratchpad，不在仓库 |

---

## 1. 改了什么

| 文件 | 改动 |
|---|---|
| `components/world/ui/TopHud.tsx` | 白色软糖铭牌（`.cute-panel-float`，圆角 20，高度仍锁 64px）：头像贴纸 + 斜贴的暖黄「Lv」角标 + 名字 / 种族 + 右侧金币 / 信任（600 档图标、等宽数字）+ 暖黄果冻经验条（`.cute-progress`）。结算入账的节拍动画保留（feelTiming.ts） |
| `components/world/ui/WorldControls.tsx` | 移到**右下竖排**（bottom 24 / 32 + 安全区，right 16 / 24），白色圆钮 `.cute-icon-btn`，从下到上 2D/3D（`Layers` + 目标模式两个字）→ 视角 → 回到我。**不可用改为「灰钮 + 右上小问号，点按弹出原因」**（QA-R2-02，见第 2 节） |
| `components/world/ui/QuestFocusCard.tsx` | `.cute-card` 委托卡：类型 400 色铺头部（白色圆章 + 类型标签 + 紧急「!」弹跳标签 + 关闭圆钮），白色正文，报酬做成三枚色调标签，主按钮 `.cute-btn-primary` 放不下一行时自动折到下一行通栏。等级不足 / 已完成头部换灰蓝（原语 `is-locked` / `is-done`）。原因条按原因取色：等级不足 / 手上有别的 = 注意，正在做 = 天蓝信息，做完了 = 成功绿 |
| `components/world/ui/SettlementToast.tsx` | `.cute-modal` 白卡，顶上探出公会徽记（与公会徽章按钮同一套白盾 + 暖黄星）；三格奖励 = 金币 sun / 信任 success / 经验 sky 的浅底格 + 32px 等宽数字；升级横幅 = 暖黄底深棕字 + 玩具厚边 + 六颗星星纸屑。**手机贴在右上按钮列之下**（QA-R1-11） |
| `components/ActiveQuestHUD.tsx` | 白色软糖卡 + 左侧类型色竖条；标题行（类型圆章、标题、计时、放弃）+ 按钮行（自动 / 地图 / 提交证明）。按钮文字换成玩家看得懂的话，不再是 AUTO / MAPS / SUBMIT。放弃仍要点两次 |
| `components/ProofSubmission.tsx` | 整页晴空底（`.cute-page`）+ 白色「相框」卡 + 青色大圆相机钮；被拦时是白色面板 + 注意色圆章；扫描是青色光条；评定是浮动的放大镜圆章。**补齐英文**（QA-R2-03），新增可选 `lang` |
| `components/world/ui/strings.ts` | 新增进行中 HUD、提交证明、控件问号的中英文；新增 `rememberUiLang` / `rememberedUiLang`（见 3.1）。原有键一个没删没改名（App 的 `blockReasonText` 在用） |
| `components/world/ui/questVisual.ts`（新） | 委托类型 → 色调 / lucide 图标 / 英文名的对象字面量。BountyBoard、MapBoard 若要同一套映射可以直接 import |
| `components/world/ui/worldUi.css` | 重写。只留工具类表达不了的：safe-area / dvh 定位、按 `--tone-*` 取色、伪元素、状态、断点、关键帧、减少动效 |

所有接口契约保留：四个世界组件与 ActiveQuestHUD 的 props **原样**；ProofSubmission 只**新增**可选 `lang`；全部旧 `data-testid` 保留（第 4 节）。接取仍只经 `onAccept` → App 的 `handleAccept`，没有新增入口。

## 2. 三个 P3 的修法

| 编号 | 修法 | 证据 |
|---|---|---|
| QA-R2-02 无定位时「回到我」的提示框盖住默认视角的光柱图标 | 原因不再常驻展开。不可用的按钮显示灰底 + 划掉的定位图标（`LocateOff`）+ 右上一枚天蓝小问号；**点按**才在按钮左侧弹出原因气泡，4.2 秒后自动收起，原因变了 / 卡片打开时也收起。收起时原因节点仍在 DOM 里（视觉隐藏，1×1px），是按钮 `aria-describedby` 的目标，读屏照样读得到 | `mobile-world-noloc.png`（默认无气泡）、`mobile-world-noloc-hint-open.png`（点按后）；自查断言「收起时占位 ≤ 1px」「点按不触发 recenter」「4 秒后收起」 |
| QA-R1-11 手机结算卡盖住画面中心的玩家与庆祝演出 | 手机：顶边固定在 `7.75rem + 安全区`（右上按钮列止于 120px 之下），升级横幅改成一行，卡片底边约在 430px，画面 64% 高处（540px）的玩家头顶之上留出约 40px；桌面：`max(6rem, 10vh)`，TopHud 与按钮列都在两侧，碰不到。横屏（高 ≤ 480）贴到 `5.25rem` | `mobile-settle-lvl.png`、`desktop-settle-lvl.png`；自查断言「结算卡与玩家 / TopHud / 公会 / 语言钮不相交」 |
| QA-R2-03 切英文后提交证明面板仍是中文 | 全部文案进 `strings.ts`，距离按语言写「米 / 公里」或「m / km」。组件新增可选 `lang`；App 还没传时读 TopHud 记下的语言兜底（3.1） | `*-proof-*-en.png`、`*-proof-*-en-bridge.png`（不传 lang、只靠兜底）；自查断言「英文下面板里没有汉字」 |

## 3. 需要 lead-engineer 在 `App.tsx` 里做的

1. **给 ProofSubmission 传 `lang={lang}`**（一行）。不传也能显示英文：TopHud / ActiveQuestHUD 每次渲染会把收到的 `lang` 记在 `strings.ts` 的模块变量里，ProofSubmission 没收到 `lang` 时读它（两者在 App 的渲染顺序里都排在 ProofSubmission 前面，切语言那一次渲染也同步）。这只是兜底，显式传了以 props 为准。
2. **契约终端按钮必须按指南移到底部正中**（`.cute-emblem-btn`）。世界控件已经在右下（bottom 24 / 32），现在 App 里那颗旧的 80px 契约終端还在 `bottom-12 right-8`，会压在「视角 / 2D」两颗钮上（真实 App 截图 `app-mobile-world.png` 可见）。
3. 右上公会 / 语言钮换成 `.cute-icon-btn` 时间距按指南用 10px 也没问题：结算卡手机顶边 124px，按钮列止于 16 + 48 + 10 + 48 = 122px。
4. ActiveQuestHUD 外层定位容器（`right-14 sm:right-0`）保持不变即可。HUD 顶边 `5.375rem + 安全区`，实测底边 ≤ 193px，App 的告知条在 12.25rem（196px）不会被压。
5. 根容器、旧浮层还在用的 `rune-panel wui-flat`：`worldUi.css` 留了一行兼容规则继续关掉毛玻璃（画布逐帧重绘，毛玻璃逐帧重算）。App 全部换成 `.cute-*` 之后这行可以删。
6. 2D 下被拦时的告知条（`accept-notice`）与定位告知条换成 `.cute-toast` 时：手机上它们 `left-4 right-4` 横跨全宽，会钻到右上按钮列底下（自查台复刻的告知条压在「ZH」下方），建议窄屏右侧让出按钮列（`right-[4.75rem] sm:right-4`）。

## 4. 给 QA：选择器迁移

| 旧选择器 / 断言 | 现在 |
|---|---|
| `div.glass-panel`（进行中 HUD） | `[data-testid=active-quest-hud]`（`glass-panel` 是旧石板皮，已经不用） |
| `getByRole('button', { name: /SUBMIT/ })` | `[data-testid=aqh-submit]`（可见文字「提交证明」/「Submit」） |
| `AUTO` / `STOP` / `MAPS` 按钮 | `[data-testid=aqh-autonav]`（文字「自动 / 停止」「Auto / Stop」）、`[data-testid=aqh-maps]` |
| `aqh-abort`、`aqh-abort-chip`、`data-armed`、文字「确认放弃？」、`h3` 标题 | 不变；另加 `aqh-timer` |
| `[data-testid=wc-hint]` 可见 | 默认**收起**（`data-open="false"`，视觉隐藏，`innerText` 仍非空——`hint.length > 0`、`includes('不在纽约')` 这类断言照样成立）；要断言「气泡可见」需先点不可用的按钮 |
| `wc-recenter` / `wc-toggle-mode` 不可用 | 由原生 `disabled` 改为 `aria-disabled="true"`（点按要能弹出原因）。Playwright 的 `isDisabled()` 把 `aria-disabled` 算作禁用，原断言不用改；但对它们 `.click()` 会等「可用」而超时，要点就加 `{ force: true }` |
| `[data-testid=world-controls] .wui-rail` | 不变（仍是三颗钮的竖排容器，现在在右下） |
| `div.fixed.inset-0.z-[1100]`（提交证明根节点） | 仍然匹配；另加 `[data-testid=proof-submission]`、`proof-blocked`、`proof-scanning`；`proof-paused` 不变 |
| `getByText(/已确认到场/)`、`getByText('无法确认你的位置')`、`getByRole('button', { name: '返回' })` | 中文下不变；英文是「Arrival confirmed」「Cannot confirm your location」「Back」 |
| 提交证明右上关闭钮 | 新增名称「取消提交」/「Cancel submission」（原来没有名字）；Esc 等同关闭 |
| 聚焦卡片全部 testid、`data-block`、`data-quest-id` | 不变。`quest-urgent` 现在是「! 紧急」标签（原火焰图标去掉）；职业 emoji 不再显示（指南 3.9） |
| `settle-*`、`data-value`、`settle-levelup`（`data-from/to`）、`.wui-num`、`.wui-hide` | 不变 |
| 结算卡位置 | 手机顶边 124px；桌面 `max(96px, 10vh)` |
| 聚焦卡片位置 | 手机 bottom `6rem + 安全区`、左右 12px，高度封顶约 58dvh − 6rem（顶边在 42% 视口高附近，配合聚焦时徽章在 36% 高处）；桌面底部居中 26rem、bottom 2rem |

## 5. 依赖其他分工的地方

- **艾琳娜入口（「公会与对话」·`ElenaChat.tsx`）**：聚焦卡片手机底边 `6rem`（96px）是按指南「入口在左下 bottom 24、56px 高（顶边 80px）」算的。现在入口还在旧位置 `bottom-12`（顶边 104px），真实 App 里两者会叠约 8px（`app-mobile-card.png`）；入口按指南移位后自然消失。
- **world-engineer**：聚焦卡片手机高度封顶依赖「聚焦时构图点移到 (50%, 36%)」。真实 App 截图里徽章已经在卡片上方（`app-mobile-card.png`）。
- `questVisual.ts` 的类型 → 色调 / 图标映射与 2D 图钉、3D 徽章用的是同一组（指南 3.1 / 5.5）；需要时直接 import，不用各抄一份。

## 6. 包体与 CSS 预算

实测（`npm run build`，当前工作区，含其他分工进行中的改动）：

| | 现在 | 把我负责的 8 个文件换回 HEAD 后（同一工作区） | 预算 |
|---|---|---|---|
| 入口 JS | 387.5 KB / 121.5 KB gzip | 381.5 KB / 118.7 KB gzip | ≤ 520 KB ✅ |
| 入口 CSS | **82.3 KB** / 15.0 KB gzip | 70.7 KB / 12.7 KB gzip | ≤ 80 KB ⚠️ |

CSS 的 +11.6 KB 拆开看：
- `worldUi.css` 压缩后 9.8 KB（旧版 6.4 KB，+3.4 KB；多管了进行中 HUD 与提交证明两个组件，它们原来那些一次性的任意值工具类已经删掉）。为了压它，排版 / 间距都改成了组件里的 Tailwind 工具类（大多已存在，零额外成本）。
- 约 8 KB 是 `.cute-*` 原语**第一次被用到**：`index.css` 的原语按用量裁剪，`cute-card`、`cute-chip`、`cute-btn`、`cute-icon-btn`、`cute-progress`、`cute-avatar`、`cute-badge-bang`、`cute-panel-float` 在我之前没人用，所以算到了这里。契约终端、公会大厅、档案这些画面接下来也要用同一批原语，这部分是全站共摊、只算一次的成本。
- 余下约 0.3 KB 是新出现的 `cute` 字号 / 颜色工具类（同样全站共用）。

**结论**：80 KB 线需要 lead 在集成后整体复测。旧组件迁完后，旧调色板的工具类（`bg-slate-900/60`、`text-amber-400` 一类）会随之从 CSS 里消失，应能抵掉大部分；若仍超，发布阶段按指南 9.1 清旧映射。

## 7. 自查记录

| 检查 | 方法 | 结果 |
|---|---|---|
| 类型检查 | `npx tsc --noEmit`（全项目） | 0 错误 |
| 生产构建 | `npm run build` | 通过（数字见第 6 节） |
| 世界界面全部状态 | 临时自查台（与 `index.tsx` 相同的 CSS 导入顺序）的**生产构建** + `vite preview :4178` + Playwright：桌面 1440×900、手机 390×844（isMobile / hasTouch / DSF 2）、`reducedMotion: 'reduce'`、中英文 | **550 / 550 通过**：无横向溢出；全部按钮 ≥ 44×44；无 < 14px 正文（≤ 6 字的 12px 角标除外）；组件都在视口内；卡片不压聚焦徽章 / 艾琳娜 / TopHud / 进行中 HUD / 公会 / 语言钮；控件不压艾琳娜 / 公会徽章 / 玩家；进行中 HUD 底边 ≤ 196px；结算卡不压玩家；testid 纯数值；接取 / 放弃两步 / 自动寻路 / 提交 → 评定 → 结算 / 8 秒内收起且 `onDone` 一次；减少动效下只剩淡入、结算数字直接是终值；0 个页面错误 |
| 横屏 844×390 与小屏 360×640 | 同上，抽查 8 个状态 | 16 / 16：无溢出、无越界、承接按钮完整可见（横屏下卡片会盖住进行中 HUD 的下半，宁可盖住也不裁掉承接按钮） |
| 觉醒流程 P0 回归 | `qa-r2-awaken-sizes.mjs` 的副本（只把端口改成 4178、输出改到我的目录），跑在真实 App 生产构建上 | **33 / 33 通过** |
| 真实 App 冒烟 | 生产构建 + 真 3D（SwiftShader）：进世界 → 点 q1 徽章 → 卡片承接 → 进行中 HUD → 提交证明 → 结算，桌面与手机各一遍 | 8 / 8，0 个页面错误 |

截图：`/tmp/claude-0/-home-user-yijie-juexing/afd9be0c-d4b8-5c23-84c9-b9b289413d95/scratchpad/qa-shots/p-world-ui/`
（`{desktop,mobile}-{world,world-noloc,world-noloc-hint-open,shanghai,2d,2d-locked,hud-long,hud-noimg,card,card-level,card-busy,card-active,card-done,card-long,card-en,card-level-en,card-rm,active,active-armed,active-long,active-en,proof-ok,proof-ok-scanning,proof-ok-grading,proof-far,proof-noloc,proof-lowacc,proof-*-en,proof-*-en-bridge,settle,settle-lvl,settle-repeat,settle-lvl-en,settle-lvl-rm}.png`、`landscape-*.png`、`small-*.png`、真实 App 的 `app-{desktop,mobile}-{world,card,active,proof,settle}.png`、觉醒回归 `awaken/`）

## 8. 剩余风险

- **字体**：沙箱里 Google 字体被拦，截图是系统回退字体。22px 标题按 token 表用 800 字重；站酷快乐体只有 400 一档，真机上中文标题可能出现浏览器合成的加粗。若美术总监觉得发糊，可把 `.cute-root :is(h1,h2,h3)` 之外的组件标题降回 400（集成者改 `index.css` 时一起定）。
- **语言兜底**（3.1）是在渲染期写模块变量，属于有意的小捷径；App 传了 `lang` 之后它就不再起作用，可以留着。
- 横屏手机不在测试矩阵里：承接按钮保证可见，但卡片会盖住画面中心与进行中 HUD 的一部分。
- 聚焦卡片手机高度封顶后，内容多的委托（长标题 + 原因条）正文要在卡内滚动，标题、原因、报酬、承接始终可见。
