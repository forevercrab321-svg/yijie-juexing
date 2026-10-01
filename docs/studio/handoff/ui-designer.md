# 交接 · ui-designer → lead-engineer（M1 → M2）

| 项 | 内容 |
|---|---|
| 角色 | ui-designer |
| 调用的 skill | `threejs-game-ui-designer`、`game-ui-design`、`game-ui-ux`（并读完各自的 references：ui-patterns / patterns / sharp_edges / validations / layout-and-flow） |
| 交付 | 契约 E 的四个纯展示组件 + 简报 6.2 的测试标识与可选 props |
| 自查 | 生产构建的临时自查台上 Playwright 324/324 项通过（桌面 1440×900、手机 390×844 DSF3 触屏、横屏 844×390、减少动态效果）；临时文件 `ui-harness.html` / `ui-harness.tsx` 已删除 |

---

## 1. 文件

| 文件 | 作用 |
|---|---|
| `components/world/ui/TopHud.tsx` | 左上档案铭牌（default export，`TopHudProps`） |
| `components/world/ui/WorldControls.tsx` | 右侧世界控件（default export，`WorldControlsProps`） |
| `components/world/ui/QuestFocusCard.tsx` | 委托聚焦卡片，取代 Leaflet 弹窗（default export，`QuestFocusCardProps`） |
| `components/world/ui/SettlementToast.tsx` | 结算演出（default export，`SettlementToastProps`、`SettlementView`） |
| `components/world/ui/strings.ts` | zh / en 文案（`UiLang`） |
| `components/world/ui/useReducedMotion.ts` | 读系统「减少动态效果」，给 JS 驱动的计数用 |
| `components/world/ui/worldUi.css` | 共用样式（组件自己 import，App 不用管） |

依赖边界：只 import `types.ts`、`constants.ts`（`PROFESSION_CONFIG` / `RACE_CONFIG`）与 `lucide-react`；**不 import `scene/`，也不 import `lib/progression.ts`**。
`SettlementView` 是契约 D `Settlement` 去掉 `user` 的结构子集，`Settlement` 可以原样传入（已用契约 D 原文做类型断言验证可赋值，见第 7 节）。

---

## 2. 叠层总表（与简报 5.5 一致）

| 组件 | 放在 App 哪里 | 定位 | z | 何时渲染 | 互斥 / 避让 |
|---|---|---|---|---|---|
| `TopHud` | 顶栏容器（`absolute top-[safe] left-0 right-0 p-4 z-[1000] … justify-between`）的**左槽**，替换原档案块 | 不自己定位，随顶栏 | 1000（继承顶栏） | 2D、3D 都渲染 | 高度锁死 64px，底边正好止于 5rem，不压 ActiveQuestHUD（5rem 起）与定位告知条（5.5rem 起） |
| `WorldControls` | App 根节点下任意位置 | 自己 `fixed`，右 `0.75rem+safe`、底 `9.25rem+safe` | 940 | 2D、3D 都渲染 | 在契约终端按钮之上；窄屏（<640px）卡片打开时自己淡出（传 `cardOpen`） |
| `QuestFocusCard` | App 根节点下任意位置 | 自己 `fixed`：手机底部抽屉 / 桌面底部居中 | 1050 | **仅 3D**（2D 由 Leaflet 弹窗承担，避免双入口） | 卡片打开时 **App 隐藏契约终端按钮**；艾琳娜入口靠几何避让（见第 4 节） |
| `SettlementToast` | App 根节点下，**常驻挂载** | 自己 `fixed`，居中偏上 | 1250 | 一直挂着（平时只是一个不可见的读屏播报区） | 低于档案弹窗 1300；高于卡片 |

BountyBoard（2000）与 ElenaChat（2100）照旧盖在所有组件之上，无需处理。

---

## 3. 逐个接入

### 3.1 TopHud

```tsx
import TopHud from './components/world/ui/TopHud';
import { levelProgress } from './lib/progression';

// 顶栏容器保持原样（justify-between 管左右），只把左边那块 <div className="pointer-events-auto flex items-center gap-3 rune-panel p-2 rounded-2xl">…</div> 换成：
<TopHud
  name={user.name}
  race={user.race}
  avatarUrl={user.avatarUrl}
  level={user.level}
  progressRatio={levelProgress(user.magicules).ratio}
  trustScore={user.trustScore}
  goldCoins={user.goldCoins}
  onOpenProfile={() => setShowProfile(true)}
  lang={lang}
/>
```

- 整块是一个按钮（触控面积远大于原来只有头像可点），自带 `pointer-events-auto` 与左侧 safe-area 外边距——**顶栏容器不要再加左 safe 内边距**，否则会算两次。
- 等级变大时等级数字会闪一下（与结算演出同步）；初次挂载与读档迁移不会闪。
- 头像坏图时显示种族首字。

### 3.2 WorldControls

```tsx
import WorldControls from './components/world/ui/WorldControls';
import { worldEvents, isInWorld } from './components/world/scene/worldEvents'; // 零依赖，可静态 import

const inWorld = !!geoFix && isInWorld(geoFix.coords);
const locationHint = !consent.location ? '未授权定位，无法回到你的位置'
  : geoStatus === 'denied' ? '定位权限被拒绝，无法回到你的位置'
  : !geoFix ? '暂无定位信号'
  : !inWorld ? '你目前不在纽约范围内'
  : undefined;

<WorldControls
  mode={mode}                                   // '3d' | '2d'
  onToggleMode={toggleMode}
  onRecenter={() => worldEvents.emit({ type: 'recenter' })}
  onResetView={() => worldEvents.emit({ type: 'resetView' })}
  hasLocation={inWorld}
  canUse3d={webglOk}                            // WebGL 预检结果；onFallback 之后为 false
  fallbackReason={fallbackReason ?? undefined}  // 存在 state 里，例如「此设备不支持 WebGL，已切换到 2D 地图」
  locationHint={locationHint}
  cardOpen={mode === '3d' && focusedQuest !== null}
  lang={lang}
/>
```

- 自上而下：2D/3D → 视角重置 → 回到我（最常用的离右手拇指最近）。2D/3D 按钮显示的是「切过去之后」的模式。
- **2D 模式下只剩切换按钮**：冻结的 MapBoard 不订阅世界事件，「重置 / 回到我」在 2D 里按了没反应，不如不显示。
- 不可用时用原生 `disabled`，原因作为常驻文字（`wc-hint`）摆在按钮左侧——禁用按钮收不到点击、手机没有悬停，原因只能直接可见。
- 只有「已在 2D 且 `canUse3d` 为假」时切换按钮才禁用；3D 下永远可以切去 2D。
- 横屏（高度 ≤ 560px）自动改为横排，提示移到上方，避免撞上右上按钮列。

### 3.3 QuestFocusCard

```tsx
import QuestFocusCard from './components/world/ui/QuestFocusCard';
import { questMagicules } from './lib/progression';
import { distanceMeters } from './lib/geo';

const focusedQuest = quests.find((q) => q.id === focusedQuestId) ?? null;

// 与艾琳娜（lib/agent/tools.ts）同一个格式；没有定位时为 null → 卡片显示「距离未知」
const distanceText = (q: Quest): string | null => {
  if (!geoFix) return null;
  const m = Math.round(distanceMeters(geoFix.coords, q.location));
  return m < 1000 ? `${m} 公尺` : `${(m / 1000).toFixed(1)} 公里`;
};

{mode === '3d' && (
  <QuestFocusCard
    quest={focusedQuest}                                    // null 时不渲染
    userLevel={user.level}
    userProfession={user.profession}
    isActive={!!focusedQuest && focusedQuest.id === activeQuestId}
    hasActiveQuest={activeQuestId !== null}
    isCompleted={!!focusedQuest && (user.completedQuestIds ?? []).includes(focusedQuest.id)}
    distanceText={focusedQuest ? distanceText(focusedQuest) : null}
    rewardMagicules={focusedQuest ? questMagicules(focusedQuest) : undefined}
    activeQuestTitle={activeQuest?.title}
    onAccept={handleAccept}                                 // → acceptQuest：艾琳娜台词 + pulse 都在那里
    onClose={() => setFocusedQuestId(null)}
    lang={lang}
  />
)}
```

- **接取后必须关卡片**（M2-08「卡片关闭」）：在 `acceptQuest` 里 `setFocusedQuestId(null)`，这样艾琳娜工具接取时也一致。
- 契约终端按钮的显示条件改为 `!activeQuestId && !(mode === '3d' && focusedQuest)`。
- 禁用原因（`quest-block-reason`）的判定顺序：**进行中（就是这个）→ 已完成 → 手上有别的 → 等级不足**。
  与 `tools.ts` 的区别只有一处：已完成排在「手上有别的」之前——已完成是永久的，先说「先做完手上的」会让玩家做完回来发现还是接不了。
  文案：等级不足含「等级」、已完成含「已完成」、手上有别的会点名进行中的委托标题（传了 `activeQuestTitle` 时）。
- 卡片**不抢焦点**：艾琳娜用工具聚焦委托时玩家可能正在她的输入框里打字。Esc 关闭（在输入框里按 Esc 不关）。Tab 顺序：关闭 → 承接。
- 信息顺序按决定排：现实中要做什么 → 在哪、多远 → 难度 / 时长 / 需求等级 → 需要的职业（「适合你」）→ 报酬 + 承接（固定在底部，不随内容滚动）。委托说明是氛围文字，手机上隐藏、桌面显示。
- BountyBoard 翻页会一路调用 `onFocus`，关闭委托板后卡片会停在最后看的那一个委托上。这是合理的（「我刚在终端里看的就是它」），如不想要，关委托板时清掉 `focusedQuestId`。

### 3.4 SettlementToast

```tsx
import SettlementToast from './components/world/ui/SettlementToast';
import { settleQuest, type Settlement } from './lib/progression';

// 结算对象必须放在 state 里：组件按对象引用判断「是不是新的一次结算」，渲染时现算会让它每帧重演、永远收不起来。
// 标题要在结算当下记下来——结算后 activeQuest 就清空了。
const [settled, setSettled] = useState<{ settlement: Settlement; title: string } | null>(null);

// ProofSubmission 的 onConfirm：
const s = settleQuest(user, activeQuest);
setUser(s.user);
setSettled({ settlement: s, title: activeQuest.title });
if (s.leveledUp) worldEvents.emit({ type: 'celebrate' });

// 常驻挂载（平时只渲染一个不可见的读屏播报区，结算来了才出现视觉层）：
<SettlementToast
  settlement={settled?.settlement ?? null}
  questTitle={settled?.title ?? ''}
  onDone={() => setSettled(null)}
  lang={lang}
/>
```

- 演出：金币 / 信任 / 经验依次计数（每项 750ms，错开 140ms），升级时多一段「等级提升 LvA → LvB」，停留 4.4s（升级 5.6s）后 240ms 淡出并调用一次 `onDone`。实测 4.8–5.0s / 6.0–6.3s 收起，均在 8s 内。点一下或按 Esc 提前收起。
- 同一委托二次结算（收益全 0）显示「契约已记录 · 同一委托不会重复发放报酬」，不摆一排 +0。
- 减少动态效果：不计数直接显示最终值、升级段落不等待、只用淡入淡出。
- App 忘了在 `onDone` 里清状态也没关系：演出结束组件会自己收起，同一个对象不会重播。

---

## 4. 卡片与契约终端 / 艾琳娜入口的避让方案

| 元素 | 方案 | 依据 |
|---|---|---|
| 艾琳娜入口（左下，`bottom-12 left-6`，56px，z-2100，占离底 48–104px） | **几何避让**，入口永远可见（她是常驻 NPC）。手机：卡片底边 `7rem + safe-bottom`（112px），比入口顶边高 8px。桌面（≥640px）：卡片居中、宽 26rem，左缘 ≥ 112px，与入口（右缘 80px）水平不重叠 | 实测 390×844 卡片 bottom=732、入口 top=740 |
| 契约终端按钮（右下，80px，z-950） | **卡片打开时由 App 隐藏**（条件见 3.3）。手机上卡片横跨全宽，避让只能把卡片抬到离底 136px 以上，抽屉会悬在半空 | 简报 5.5 |
| 世界控件（右侧，z-940） | 窄屏（<640px）卡片打开时 `cardOpen` 让它淡出；宽屏左右分开，共存 | 桌面实测卡片右缘 928 < 控件左缘 1372 |
| TopHud / ActiveQuestHUD / 定位告知条（顶部） | 卡片最大高度封顶：无进行中时顶边 ≥ 8.75rem+safe，有进行中时 ≥ 11.5rem+safe（让开 ActiveQuestHUD 5rem 起约 93px）。内容超出时中段滚动，标题与「承接契约」始终可见 | 最长文案实测卡片顶 141px，HUD 止于 80px |
| 视口中心的光柱 | 镜头会把聚焦的光柱送到画面中央。桌面卡片高度封顶在中线附近（实测顶边低于中线 104px）；手机常规卡片顶边低于中线 21px，光柱底座可见 | 见 6.4 给 world-engineer 的建议 |

M3-10 的相交检查已在自查台上按 App 现有布局复刻验证：卡片 / 世界控件 / 控件提示 / TopHud 在所有状态下都不与契约终端、艾琳娜入口、TopHud、ActiveQuestHUD、定位告知条、右上按钮列相交。

---

## 5. 给 QA 的约定

### 5.1 测试标识

| 组件 | 简报 6.2 要求 | 额外提供 |
|---|---|---|
| TopHud | `top-hud`、`top-hud-level`、`top-hud-gold`、`top-hud-trust`、`top-hud-xp`（`role="progressbar"`，`aria-valuenow`=round(ratio×100)） | `top-hud-name`、`top-hud-race` |
| QuestFocusCard | `quest-focus-card`（带 `data-quest-id`）、`quest-accept`、`quest-close`、`quest-block-reason` | 根节点 `data-block`=`none|active|done|busy|level`；`quest-title`、`quest-real-task`、`quest-type`、`quest-urgent`、`quest-distance`、`quest-min-level`、`quest-suits`（「适合你」那一枚）、`quest-bonus`、`quest-reward-gold|trust|xp` |
| WorldControls | `world-controls`、`wc-recenter`、`wc-reset`、`wc-toggle-mode`（三个都有 `aria-label`） | `wc-hint`（不可用原因，可见文字） |
| SettlementToast | `settlement-toast`、`settle-gold`、`settle-trust`、`settle-xp`、`settle-levelup` | 每个 `settle-*` 带 `data-value`；`settle-levelup` 带 `data-from` / `data-to`；`settle-contribution` |

### 5.2 文本约定（断言请照这个写）
- `top-hud-level` / `top-hud-gold` / `top-hud-trust`、`quest-reward-*` 的文本是**纯整数**（不带「Lv」「+」、不带千分位）。根节点文本里读作 `Lv3`、`+100`。
- `settle-*` 的文本**从出现第一帧起就是最终值**；视觉上的计数是叠在上面的另一层（`aria-hidden`），所以出现即读、`toHaveText` 都可以。
- 禁用一律是原生 `disabled`；原因节点通过 `aria-describedby` 与按钮关联。
- 托盘与卡片入场只用 3–4% 缩放 + 淡入，包围盒在动画途中只会比终态小，测相交不必等动画结束。

---

## 6. 风险与需要其他角色处理的事

### 6.1 【lead-engineer】项目没装 `@types/react`，JSX props 不受 tsc 检查
`react` 解析为隐式 any，组件类型因此都是 any。实测：按项目 tsconfig 检查 `<TopHud wrongProp={1} />` 与漏传全部必填 props 的 `<QuestFocusCard quest={null} />`，**0 条报错**。
所以 `npm run typecheck` 通过 ≠ props 接对了。接入时请按第 3 节逐个核对属性名；QA 的 testid 断言是最后一道保险。（不在本次范围内加依赖——`package.json` 冻结。）

### 6.2 【lead-engineer】包体（实测，Vite 生产构建，入口 + 四个组件 vs 基线）
| | 增量 | 接入后入口合计 | 预算 |
|---|---|---|---|
| JS | +18.2 kB / +5.7 kB gzip | 526.1 kB / 159.8 kB gzip | ≤ 520 / ≤ 165 |
| CSS | +6.4 kB / +1.9 kB gzip | 79.0 kB / 17.5 kB gzip | ≤ 80 / ≤ 18 |

- 已经压过一轮：新图标从 19 个砍到 3 个（每个约 0.45 kB）、布局全部改用基础 CSS 里已有的 Tailwind 类（零额外 CSS）、组件自带 CSS 只剩 6.4 kB。
- **JS 单凭界面组件就会让入口超过 520 kB**（再加委托数据、progression、App 改动更多）。简报 6.4「MapBoard 用 React.lazy 加载（约 −162 kB / −47 kB gzip）」实际上是必须做的。
- **CSS 只剩约 1 kB / 0.5 kB gzip 余量**：App 新增的样式（加载画面 `world-loading` 等）请复用已有的工具类或写成行内 style，避免新的任意值类。

### 6.3 【lead-engineer】既有布局问题（非本次引入，P2）
- 手机上 `ActiveQuestHUD`（`top-[5rem] left-4 right-4`，z-900）横跨全宽，右端被右上按钮列（16–120px，z-1000）盖住，「ZH」按钮压在 HUD 上（截图 `mobile-card-busy.png`）。建议窄屏把 HUD 右边让出按钮列：`right-[4.75rem] sm:right-4`，或改到按钮列下方（若下移，需同步调大 `worldUi.css` 里 `.wui-card.wui-hudgap` 的顶部预留 11.5rem）。
- 简报已知：无定位告知条（5.5rem）与 ActiveQuestHUD（5rem）同时出现会重叠。
- 现有叠层（ActiveQuestHUD 的 glass-panel、右上按钮、告知条）都带 `backdrop-filter: blur(10px)`，叠在逐帧重绘的 WebGL 上会逐帧重算模糊。新组件已用 `.wui-flat` 关掉（面板约 95% 不透明，视觉无差）；旧叠层可参照处理。

### 6.4 【world-engineer】镜头构图与输入
- 窄屏卡片打开时会占下方约 35–40% 画面：常规卡片顶边约在中线下 20px，带禁用原因的卡片可能高出中线约 40px。建议聚焦时把光柱投到中线**略偏上**（偏移 ≤ 0.15×短边，390 宽约 58px），仍在 M2-06 的 20% 容差内，光柱底座就不会被卡片挡住。
- 场景的 `pointerdown` 请只挂在 canvas 上：在卡片、控件这些 DOM 面板上按下不应开始拖动或触发拾取。

### 6.5 其他
- 横屏手机（844×390）卡片只有约 226px 高：标题、地点、承接按钮可见，中段滚动；卡片会盖住画面中心。横屏不在简报的测试矩阵里，记为已知限制。
- 沙箱里 Google 字体被拦，截图里的 Cinzel / Noto Serif SC 是系统回退字体，真机观感会更接近设计。
- 新组件的英文已备齐（`lang="en"`）；距离、难度、委托标题等来自数据的文字仍是中文。

---

## 7. 自查记录

| 检查 | 方法 | 结果 |
|---|---|---|
| 类型检查 | `npm run typecheck` | 我负责的文件 0 错误（当前仅 `components/world/scene/city.ts` 有 world-engineer 进行中的 2 条瞬时报错，未处理） |
| 生产构建 | `npm run build` | 通过（App 尚未接入，入口仍为基线 507.83 kB / 154.56 kB gzip） |
| 包体增量 | Vite JS API 构建「入口」与「入口 + 四组件」两次对比 | 见 6.2 |
| 契约 D/E | 编译器 API + 项目 tsconfig（另开 `strictNullChecks`）检查内存虚拟文件里的类型断言：契约 D 原文 `Settlement` 可赋给 `SettlementView`；四个组件的必填 props 名称与契约 E 完全一致；`quest` / `distanceText` 可为 null；6.2 的可选 props 存在。另跑一轮故意写错的阴性对照，确认这套断言会报错 | 通过（0 条诊断；阴性对照 1 条） |
| 界面自查 | 临时自查台（按 App 现有结构复刻顶栏、契约终端、艾琳娜入口、ActiveQuestHUD、告知条）的**生产构建** + Playwright：桌面 1440×900、手机 390×844（isMobile、hasTouch、DSF3）、横屏 844×390、`reducedMotion: 'reduce'` | **324 / 324 通过**：无横向溢出；新组件按钮全部 ≥ 44×44；无 `scrollWidth > clientWidth+1`；正文 ≥ 14px、主按钮 16px、常驻文字 ≥ 11px；所有状态下无相交；testid 与禁用原因正确；结算 8s 内收起且 `onDone` 一次；减少动态效果下数字直接为最终值；控制台 0 错误 |

截图：`/tmp/claude-0/-home-user-yijie-juexing/afd9be0c-d4b8-5c23-84c9-b9b289413d95/scratchpad/qa-shots/m1-ui/`
（`{desktop,mobile}-world.png`、`-world-out-of-nyc`、`-card`、`-card-level`、`-card-busy`、`-card-active-self`、`-card-done`、`-card-long`、`-card-no-location`、`-card-en`、`-2d-fallback`、`-settlement-counting`、`-settlement`、`-settlement-levelup`、`-tophud-long`，`desktop-card-focus(-zoom).png`、`mobile-settlement-reduced-motion.png`、`landscape-{world,card}.png`，以及改动前基线 `baseline-{desktop,mobile}-world.png`）
