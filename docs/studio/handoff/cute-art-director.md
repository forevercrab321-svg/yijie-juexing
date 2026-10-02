# 交接 · 美术总监（S0 风格定稿）→ 全体（P 阶段）

| 项 | 内容 |
|---|---|
| 角色 | art-director（本轮分工：风格定稿 S0） |
| 调用的 skill | `threejs-aaa-graphics-builder`、`threejs-game-ui-designer`、`game-ui-design`（读完 visual-scorecard / authoring-recipes / technical-art / shader-cookbook / ui-patterns / patterns / sharp_edges / validations） |
| 唯一视觉依据 | `docs/studio/style-cute.md`（v1.0 定稿） |
| 地基 | `index.html`（字体链接 + `:root` 的 `--cute-*` / `--quest-*`）、`tailwind.config.js`（`cute` / `quest` 命名空间、字体、字号、圆角、阴影、缓动、动画）、`index.css`（`.cute-*` 原语） |
| 冻结 | 以上三个全局文件从现在起冻结。需要新 token / 新原语写进自己的 `docs/studio/handoff/cute-<分工>.md`，集成者统一加 |
| 截图 | 改版前：`scratchpad/qa-shots/s0-before/`（32 张）· 样张：`scratchpad/qa-shots/s0-style/` |
| 临时文件 | `style-harness.html`、`style-harness.tsx` 已删除；样张用的 vite 配置与缓存在 scratchpad，不在仓库 |

---

## 1. 所有人

- 新组件根节点加 `cute-root`；颜色只用 `cute-*` / `quest-*`（Tailwind）或 `var(--cute-*)`；类型色调用 `cute-tone-<transport|hunt|build|envoy|rescue>`。
- **别用 `slate / amber / red / sky / cyan / emerald / indigo / purple / violet / yellow`**：它们被重映射成了大地色。旧映射与旧类在发布阶段清理，迁移期不要删。
- 400 档只做图形，不放白字；文字用 600 档或 ink 系（指南 3.1、3.2）。
- 正文 ≥ 14 px；可点元素 ≥ 44 px、有焦点环；自写动画处理 `prefers-reduced-motion`。
- Tailwind 按用量裁剪：`.cute-tone-*`、`.cute-pin-*` 整族保留，可以拼接；其余原语要以完整类名出现在 `components/**` 或 `App.tsx` 里。
- IP 红线逐条自检（指南 1.2）：圆形元素不做上下二分 + 横带 + 中心钮；徽章不是方块；不用 `LifeBuoy` 图标；不写「训练家 / 道馆 / 补给站」。

## 2. lead-engineer（`App.tsx`）

1. 契约终端按钮换成公会徽章按钮（指南附录 B），移到**底部正中**；保留 `data-testid="bounty-open"` 与 aria-label；聚焦卡打开时照旧隐藏。
2. 右上「公会 / 语言」换成 `cute-icon-btn`（48 px），位置不变。
3. 定位告知条 / 接取说明换成 `cute-toast` 样式（注意 / 紧急色调），堆叠规则不变。
4. `WorldLoading` 换成 `.cute-page` + 公会徽章 + 跳动圆点（`data-testid="world-loading"` 保留）；2D 的 `map-loading` 底色换成 `#EAF7FF`。
5. 根容器的 `bg-slate-950` 换成 `bg-cute-bg`（3D 画布加载前不再闪黑）。
6. 发布阶段（不是现在）：`body` 全局字体切到 `--cute-font`，删除旧 token / 旧类 / 旧 Tailwind 重映射 / 旧字体链接。

## 3. world-engineer（`components/world/scene/**`）

- 先在 HEAD 上记一次 V1–V4 的 draw call 基线（V1 实测 28），改版后**每个视角 ≤ 基线 × 1.2**（V1 ≤ 34），硬上限 60。账本见指南 5.10。
- 相机：`TILT_MIN` 35 → 20，默认俯角手机 30° / 桌面 24°，默认视距 420 / 480（最近 3 个委托进不了构图区就拉远，380–1400），垂直视场夹 42°–68°，构图点 (50%, 60–64%)。建议在 `render_game_to_text().camera` **新增** `anchor: {x, y}`（只加字段）。
- 低档关闭实时阴影（`renderer.shadowMapSize` 报 0），用贴地软影。
- 徽章五种外形：扇贝圆章 / 盾 / 六边形 / 对话气泡 / 十字（与 `index.css` 的 `.cute-pin-*` 同形），没有方形；不做深度测试、不受雾影响；委托标记合计 ≤ 5 个 draw call。
- 色板、昼夜关键帧、材质角色、Q 版比例与 12 种族配件、路径、云与光点：指南第 5 节。
- `worldEvents.ts` 不得 import three、调试钩子与 `data-testid="world-map"` 保持不变。

## 4. ui-designer「世界界面」

- TopHud / 世界控件 / 聚焦卡 / 结算卡 / 进行中 HUD / 提交证明：组件规范见指南第 4 节，位置见 7.1。
- **世界控件移到右下**（bottom 24 / 32 + 安全区）：契约终端已移到底部正中，不再需要让位。
- 聚焦卡手机端 bottom `calc(6rem + 安全区)`（让出左下的艾琳娜入口），桌面底部居中 26rem。
- `worldUi.css` 里的 `--gold` / `--ember` / 石板渐变全部换成 `--cute-*`；测试标识与 props 一个都不能少。

## 5. ui-designer「引导与档案」

- 觉醒四步与同意页用 `.cute-page` + `.cute-steps` + 钉底按钮；**沿用上一轮修 P0 的钉底布局，只换皮**，交付前跑 `qa-r2-awaken-sizes.mjs`（端口自定）必须 33/33。
- 档案 / 会员 / 好友 / 信任认证：手机 `.cute-sheet`、桌面 `.cute-modal`。

## 6. ui-designer「公会与对话」

- 艾琳娜入口移到左下 bottom 24 / 32、left 16 / 24（+ 安全区），56 / 64 px 圆形头像按钮；aria-label「与艾琳娜说话」、展开后的「收起」保留。
- 契约终端 / 公会大厅改浅色全屏；去掉 `SYSTEM_ELENA_CORE` 一类终端腔英文小字。
- `MapBoard`：Voyager 瓦片 + 新滤镜 + `.cute-pin` 图钉（写在 divIcon 的 html 里，不当 className）+ 青色虚线路径；在组件样式里把 `.leaflet-container` 底色覆盖成 `#EAF7FF`（`index.html` 的全局深色底迁移期不动）。

## 7. QA（脚本需要同步的地方）

- **M2-07**：俯仰断言从 [35, 70] 改为 [20, 70]。
- **M2-06 / M2-17**：「光柱 / 玩家离视口中心 ≤ x%」改为「离构图点 ≤ x%」（读新增的 `camera.anchor`；没有该字段时按 (0.5, 0.62) 计）。
- 文案选择器：若「進入契約終端」「返回對話」「承接契約」按指南改成简体，`qa-r2-desktop.mjs`、`s0-capture.mjs` 里依赖文字的定位要同步。
- 类名选择器 `div.fixed.inset-0.z-[2000]`、`z-[1100]`、`button.w-9.h-9` 依赖旧实现，换皮后大概率失效，改用 role / aria-label / data-testid。
- 新增验收项见指南 9.2（灰度截图下五种委托能只靠外形区分、无 400 档白字、IP 红线逐条）。
