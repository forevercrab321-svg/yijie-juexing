# 交接 · ui-designer「引导与档案」（可爱风换皮）→ lead-engineer / QA / 相关分工

| 项 | 内容 |
|---|---|
| 角色 | ui-designer（本轮分工：引导与档案） |
| 调用的 skill | `threejs-game-ui-designer`、`game-ui-design`、`game-ui-ux`（并读了 ui-patterns / validations / sharp_edges / layout-and-flow） |
| 视觉依据 | `docs/studio/style-cute.md` v1.0（第 3–4 节 token 与原语、4 节「觉醒四步 / 同意页」落法、7.2 引导与全屏面板） |
| 负责文件 | `components/ConsentGate.tsx`、`components/VerificationModal.tsx`、`components/TrustVerification.tsx`、`components/ProfileModal.tsx`、`components/ProMembershipModal.tsx`、`components/FriendsBoard.tsx` |
| 冻结文件 | 没碰 `index.html` / `tailwind.config.js` / `index.css` / `App.tsx` / `constants.ts`；**不需要新 token**（只用 `--cute-*` / `--quest-*`、`.cute-*` 原语与 Tailwind `cute` / `quest` 命名空间；用到的透明度只有白色 `bg-white/95` 与现有 token 的 `/40` 修饰） |
| 截图 | `scratchpad/qa-shots/p-onboarding/`（`desktop-*` 1440×900、`mobile-*` 390×844；`awaken/` 下是 11 个尺寸的觉醒回归截图） |
| 临时文件 | 仓库里没有新增任何临时文件。自查脚本都在 `scratchpad/qa-tools/`：`onboarding-r2-lib.mjs`（`qa-r2-lib.mjs` 的副本，只改端口 4179 与输出目录）、`onboarding-awaken-sizes.mjs`（`qa-r2-awaken-sizes.mjs` 的副本，只改了 import）、`onboarding-flow.mjs`（全流程截图 + 版面断言） |

---

## 1. 改了什么

| 文件 | 改动 |
|---|---|
| `ConsentGate.tsx` | `.cute-page` 晴空整页；两个授权项做成**选择卡**（白卡 + 左侧色调圆章 + 右侧开关，选中 = 青色 2px 内圈 + 开关推到右侧并出现勾，`aria-pressed`）；「必选 / 可选」标签；留存政策放进 `.cute-panel-inset`；主按钮 `.cute-btn-primary` **钉底**，禁用时上方写出原因「先勾选「账号与档案」才能开始」。全大写的 `DATA PROCESSING NOTICE` 换成一句人话。滚动区底边 24px 渐隐提示「下面还有」 |
| `VerificationModal.tsx` | 觉醒四步。**钉底结构一行没动，只换皮**（见第 2 节）。顶栏 = 圆形返回钮 + `.cute-steps` 步骤点 + 「2 / 4」。第 0 步白色面板表单（`.cute-input`、label 关联、回车即继续）；第 1 步 8px 白边 + 28 圆角的立绘「贴纸相框」，种族色浅底，加成写在左上角白标签，种族名与说明放进底部**白色实底铭牌**；重抽时卡片绕竖轴翻面再弹回；第 2 步 18 个职业按领域分组，每行 = 领域色圆章 + **lucide 图标**（不再用 emoji）+ 名字 / 现实技能 + 右侧勾，选中 = 浅青底 + 青圈 + 实心勾；第 3 步「转生鉴定书」= 上半立绘、下半白底档案 + 暖黄星章「盖印」；第 4 步公会徽记圆盘浮动 + 青色脉冲圈 + 三个跳点，文案全部中文 |
| `ProfileModal.tsx` | `.cute-scrim` + `.cute-sheet`（手机贴底抽屉，≥ 640px 原语自动变底部居中悬浮卡）。名片 = 种族色浅底 + 贴纸头像 + 展示字体名字；三格数值（等级天蓝 / 信任成功绿 / 金币暖黄，图标 + 文字 + 等宽数字）；种族与职业标签；入口卡（伙伴通讯录、信任认证）；执照入口复用**奖励按钮原语** `.cute-btn-sun`；清除数据 = 幽灵按钮 → 二次确认（次按钮「取消」+ 危险按钮「确认清除」）。繁体与全大写英文小标签全部换掉 |
| `ProMembershipModal.tsx` | 抽屉；歪着盖上去的暖黄皇冠章；「是什么 / 不是什么」两条（成功色 / 提示色，各配图标）；权益三行；资格页 = 「已满足 n / 4 项，需要 2 项」+ 成功色果冻进度条 + 条件行（满足 = 浅绿底 + 实心勾 +「已满足」，未满足 = 白底描边 + 空心圈 +「未满足」——**不再靠整行变淡表达**）+ 专长下拉框（`.cute-input`，选项去掉 emoji）；满足时主按钮变暖黄奖励按钮，不满足时禁用按钮 + 下方写原因；审核中是浅青状态条（`role=status`），不是灰色禁用钮 |
| `TrustVerification.tsx` | 抽屉表单；「可选」标签代替 `OPTIONAL · TRUST BADGE`；`.cute-input` + `.cute-field-label/-hint/-error`，出错时 `aria-invalid` + `role=alert` + 输入框「摇头」（`animate-cute-wiggle`，减少动效下关闭）；回车即提交；证件号用等宽数字（`tabular-nums`）而不是等宽字体 |
| `FriendsBoard.tsx` | 固定高度抽屉：标题、页签、搜索框钉在上面，只有列表滚动；页签 = `button.cute-chip`（`role=tab` / `aria-selected`，补到 44px 高）；好友卡 = 贴纸头像 + 在线点 + 状态文字 + 等级角标 + 青色果冻共鸣条；搜索结果卡 + 「加好友」主按钮；空态插图；同步通讯录 = 虚线次按钮。模拟数据与小字统一简体 |

### 1.1 导出（只加不改）

`VerificationModal.tsx` 新导出 `CuteTone`、`RACE_TONE`（种族 → 色调）、`TRACK_TONE`（职业领域 → 色调）、`PROFESSION_ICON`（职业 → lucide 图标）。档案、好友页已经在用，保证同一个种族在觉醒页和档案页是同一个颜色。默认导出与 props 不变。

### 1.2 小的行为补充（都不改 props、不改数据流）

| 补充 | 理由 |
|---|---|
| **好友页 z-index 1100 → 1350** | 好友页是从档案（1300）里打开的，档案不会随之关闭——上一版整页好友被压在档案弹层下面，要先关掉档案才看得见。现在夹在档案（1300）与执照（1400）之间。**请 lead 把它补进 brief 5.5 的叠层表**，其余各层不变 |
| 四个弹层打开时焦点进关闭钮，关闭后还给打开它的按钮；焦点在弹层内时 Esc 关闭最上面那一层（`preventDefault` + `stopPropagation`，不会连带触发聚焦卡 / 结算卡的全局 Esc） | `game-ui-ux`：每个画面要有初始焦点、能用键盘退出；叠两层时一按全关是常见坑 |
| 起名页、信任认证用 `<form>` 包起来，回车 = 点主按钮 | 键盘流不用摸鼠标；禁用条件与原来完全一致 |
| 遮罩点击即关闭（原来是没有遮罩的满屏黑底） | 抽屉的标准手势；遮罩不是按钮，读屏不会读到两个「关闭」 |
| 抽屉的关闭钮吸顶（`sticky top-3`） | 档案、执照内容比手机屏幕长，滚到底时关闭钮不能跟着滚走 |
| **手机上抽屉底边距 7.5rem + 安全区**（好友页是列表滚动区底部多留 7rem） | 艾琳娜入口在 z-2100，永远浮在所有弹层之上（现版在左下、底边 48–104 px；风格指南定稿是底边 24–80 px + 安全区，两种位置都按这个留白避开）。自查第一版里它正好压住信任认证的「完成认证」、执照的「资格未满足」和档案底部的说明文字。现在最后一个按钮滚到底时一定在入口之上（`onboarding-flow.mjs` 断言「弹层里露出来的按钮都不与艾琳娜入口相交」）。桌面抽屉居中，碰不到它，不加这段留白 |
| 觉醒页不再加载 `public/assets/hero-landing.jpg` | 见第 3 节 |

## 2. 觉醒 P0（QA-R1-01）回归：钉底布局只换皮

- 每一步仍是「`flex-1 min-h-0` 可滚动内容区 + 不参与滚动的钉底按钮栏」，第 1 步立绘槽仍是 `flex: 0 1 (列宽 × 4/3)`、`min-h-[14rem]`、卡片 `h-full aspect-[3/4]`。
- 唯一的公式改动：列宽从写死的 `min(100vw, 28rem) − 3rem` 改为 `min(100vw, 28rem) − 2 × var(--aw-pad)`，`--aw-pad` 手机 16 / 桌面 24（风格指南 3.7 的屏幕边距），和外框内边距同源。
- 滚动区加了 `-mx-[--aw-pad] px-[--aw-pad]`：滚动容器会裁掉卡片投影，不撑开时卡边会出现一块被齐刷刷切断的灰色矩形。内容宽度不变。
- 底栏含 `env(safe-area-inset-bottom)`，并给玩具按钮 4px 厚边留了位置；顶栏含 `env(safe-area-inset-top)`。
- 「重新转生」补到 56px 与主按钮同高；< 360px 宽时收起骰子图标，免得字被挤出按钮。
- **`qa-r2-awaken-sizes.mjs` 在端口 4179 的生产构建上 33 / 33 通过**（副本只改 import 指向 4179，判定逻辑、尺寸矩阵、选择器一个字没改）。

## 3. 两个设计决定

**背景图：不用 hero-landing.jpg，改用程序化晴空。** 那张森林画整体偏暗，盖浅色遮罩只会变成灰蒙蒙的一层（正是要摆脱的「浑浊」），还要为一张看不清的图多下几百 KB。现在是 `.cute-page` 的天色渐变 + 两朵会慢慢飘的 SVG 卡通云 + 星点，零请求，和 3D 世界的天空同一种语言；云只放在顶部标题带（压到内容后面会在卡边鼓出一块白）。`LANDING_HERO_IMAGE` 常量与图片文件都没删（不归本分工），发布阶段若确认无人引用可一并清理。

**立绘上的字：从「加深遮罩」改为「实底铭牌」。** QA-R2-01 的根因是浅色立绘（天使、史莱姆）上白字 / 金字糊掉，上一轮靠把遮罩拉到卡片中部解决。可爱风格不能再压一层深色渐变，所以第 1 步的种族名与说明放进底部白色铭牌（`bg-white/95`），第 3 步鉴定书的文字整体移到立绘下方的白底上。文字对比从此与立绘无关，换任何一张图都不会退化（`onboarding-flow.mjs` 断言：确认卡的 h3 / p 都不与立绘区域相交）。

## 4. 给 QA：选择器迁移

| 旧选择器 / 断言 | 现在 |
|---|---|
| `div.fixed.inset-0` filter `hasText: 'Race & Profession'`（qa-r1/r2-desktop M2-18c） | 小标题改成「种族与职业」（英文界面仍是 Race & Profession）。根节点仍是 `div.fixed.inset-0`，**加了 `[data-testid=profile-modal]`**，请改用它；「弹层里第一个按钮 = 关闭钮」的约定保留（关闭钮在 DOM 最前，`aria-label="关闭个人档案"`） |
| `getByText('申請職業獵人執照')`（qa-r2-explore） | 简体「申请职业猎人执照」 |
| 「夥伴通訊錄」 | 「伙伴通讯录」 |
| 觉醒顶栏的 `BACK` 文字按钮 | 圆形图标钮，`aria-label="返回上一步"` |
| 载入页 `SYSTEM SYNC` / `LINKING SOUL...` 等英文 | 「正在加入社区」+ 逐条中文状态（`role=status`） |
| 好友页根节点 `z-[1100]` | `[data-testid=friends-board]`（z 现在是 1350）；执照 `[data-testid=pro-modal]`、信任认证 `[data-testid=trust-verification]` |
| **QA-R1-06a**「加入互助社区按钮的渐变 / 光晕 / 边框里没有蓝紫青」、**QA-R1-06b**「确认页截图高饱和青紫像素 < 0.5%」 | **这两条在新方向下作废**：品牌主色 teal-600 `#127C6F` 色相约 173°，正好落在这两条断言的「青」区间（170–200°），按新风格指南它就是主按钮该有的颜色。建议换成风格指南 9.2 的检查（无 400 档白字、无霓虹 / 赛博青紫、IP 红线） |

不变、可以照旧用的：同意页两个卡片按钮的名字（含「账号与档案」「精确位置」）、`我已阅读并同意所勾选的项目`、placeholder `请输入你在异世界的名字`、`继续` / `就是这个我` / `重新转生` / `确定` / `加入互助社区`、职业按钮名含职业名（`/筑城师/`）、`[data-testid=awaken-portrait-card]`（仍是 3:4，h3 / p 在卡内）、`[data-testid=awaken-confirm-card]`、`清除本设备数据`。

## 5. 请集成者处理

1. **`constants.ts` 的 `TRANSLATIONS.zh` 执照（`pro_*`）与好友（`friends_*`）文案还是繁体。** constants.ts 不归本分工，`ProMembershipModal` / `FriendsBoard` 里各放了一张简体覆盖表（`ZH_SIMPLIFIED`）。把 TRANSLATIONS.zh 改成简体后删掉这两张表即可。
2. **职业 emoji。** `PROFESSION_CONFIG[*].icon` 仍是 emoji，`BountyBoard.tsx` 还在用（第 215 行）。我的组件改用 `PROFESSION_ICON`（lucide）。集成时建议把 `PROFESSION_ICON` / `RACE_TONE` 挪到一个共享模块（与 `components/world/ui/questVisual.ts` 同类），我这边的 import 跟着改一行。
3. **叠层表**：补一行「`FriendsBoard` 1350（从档案打开，须在档案之上）」。
4. **隐私约束待决（未改，只报告）**：起名页「志愿宣言」的麦克风按钮用的是浏览器 `SpeechRecognition`，Chrome 的实现会把音频送到 Google 的云端识别——与 `CLAUDE.md`「不接云端语音识别」冲突。这是上一版就有的行为，换皮不应改行为，所以按钮保留（补了 `aria-label`）。建议 lead 决定是否去掉。
5. **IP 提示（不归本分工）**：`types.ts` 的种族名里有「利姆鲁」「原初之黑」等出自其他动画作品的专有名词；不属于宝可梦红线，但同样是他人 IP，建议 lead 评估。

## 6. 预算

| 项 | 读数 | 说明 |
|---|---|---|
| 入口 JS | 408.7 KB / 128.3 KB gzip | ≤ 520 KB ✅。同一工作区把六个文件换回 HEAD 单独构建是 387.5 KB / 121.5 KB，本分工 +21 KB / +6.8 KB gzip：18 个职业的 lucide 图标（按需打包，每个 0.3–0.5 KB）、中英文文案表与更多的无障碍属性。没有新增依赖 |
| CSS | 86.4 KB / 16.3 KB gzip | 预算 80 KB ❌。**不含本分工改动时同一工作区的 CSS 已是 82.3 KB / 15.0 KB gzip**（六个文件换回 HEAD 单独构建测得）；本分工净增 +4.1 KB / +1.3 KB gzip（新增约 16 KB 的原语与工具类、减掉约 12 KB 不再使用的旧石板 / 金色工具类）。其中 `.cute-sheet` / `.cute-input` / `.cute-steps` / `.cute-scrim` 等原语只有本分工用到，是 S0 预留的成本。旧组件迁移完、发布阶段删掉旧色板重映射后会回落 |
| 3D 分包 | 不涉及 | |

## 7. 自查

| 检查 | 方法 | 结果 |
|---|---|---|
| 类型 | `npx tsc --noEmit -p .` | 0 错误（全仓） |
| 构建 | `npm run build -- --outDir scratchpad/onboarding-dist`（不覆盖共享的 dist/） | 通过 |
| 觉醒 P0 回归 | `onboarding-awaken-sizes.mjs`（= `qa-r2-awaken-sizes.mjs` 指向 4179） | **33 / 33** |
| 全流程 | `onboarding-flow.mjs`：同意 → 觉醒四步 → 主界面 → 档案 / 好友 / 执照 / 信任认证，桌面 1440×900 + 手机 390×844（isMobile / hasTouch / DSF 2），外加手机减少动效 | **112 / 112**：每个画面无横向溢出、所有可点元素 ≥ 44px（sm 图标钮按 ::after 撑开后的 48px 算）、无 < 14px 正文（≤ 6 字的 12px 角标除外）；同意 / 继续 / 确定禁用时写出原因；卡片 `aria-pressed`；回车即继续；确认卡文字不与立绘相交；档案根节点仍是 `div.fixed.inset-0`、第一个按钮是关闭钮且为初始焦点；好友页叠在档案之上；Esc 只关最上层；信任认证报错带 `aria-invalid`；弹层里露出来的按钮都不与艾琳娜入口相交；减少动效下觉醒页与载入页没有循环动画；0 个 pageerror、0 个非环境噪音的 console.error |
| 英文界面 | `onboarding-en.mjs`：手机切英文后打开档案 / 执照 / 好友 | **3 / 3**：除玩家数据（种族、职业、技能、好友名）外没有残留汉字 |
| 静态自检 | grep 六个文件 | 无旧色板类（slate / amber / cyan…）、无 `text-[Npx]` / `text-xs`、无 Cinzel / 等宽字体 / 斜体 / 全大写字距；除白色外没有裸色值；无「训练家 / 道馆 / 补给站 / 精灵球」等词，无 `LifeBuoy` |

截图（`scratchpad/qa-shots/p-onboarding/`）：`{desktop|mobile}-01-consent`、`-01b-consent-checked`、`-02-awaken-name-empty`、`-02b-awaken-name`、`-03-awaken-roll`、`-03b-awaken-rolling`（翻面中）、`-03c-awaken-rerolled`、`-04-awaken-profession`、`-04b-awaken-profession-picked`、`-05-awaken-confirm`、`-06-awaken-loading`、`-07-world`、`-08-profile`、`-08b-profile-bottom`、`-08c-profile-confirm-clear`、`-09-friends`、`-09b-friends-pending`、`-09c-friends-searching`、`-09d-friends-result`、`-09e-friends-list-end`、`-10-pro-info`、`-10b-pro-check`、`-10c-pro-check-bottom`、`-11-trust`、`-11b-trust-error`；`mobile-06b-loading-reduced-motion`、`mobile-12-profile-en`、`mobile-13-pro-check-en`、`mobile-14-friends-en`。

注：软件渲染下 3D 画布每帧要几百毫秒，CSS 进场动画的首帧会被推迟，个别截图会拍到抽屉还在上滑（如 `desktop-08-profile`）；断言前脚本会等弹层动画播完（`getAnimations().finished`），不受影响。截图里的字体是沙箱回退的系统字体，不是 Nunito / 站酷快乐体。
