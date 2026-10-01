# 交接 · game-designer → lead-engineer（M1 → M2）

| 项 | 内容 |
|---|---|
| 角色 | game-designer |
| 调用的 skill | `game-design-theory`、`gamestudio`（并读了 references：production-design、economy-liveops、roles、minimal-workflow、templates） |
| 交付 | `lib/progression.ts`（契约 D + 简报 6.3）、`constants.ts` 的 `INITIAL_QUESTS`（13 个委托）、`types.ts` 的 `User.completedQuestIds?`、`docs/studio/design.md` |
| 自查 | `npm run typecheck` 0 错误；三个文件另跑 `--strict` 0 错误；生产构建通过；scratchpad 自检 52 / 52 通过（见第 5 节） |

设计理由全部在 `docs/studio/design.md`，这里只讲怎么接。

---

## 1. 导出一览（`lib/progression.ts`）

| 导出 | 签名 | App 用在哪 |
|---|---|---|
| `normalizeProgress` | `(user: User) => User` | 读档时一次（2.1） |
| `settleQuest` | `(user: User, quest: Quest) => Settlement` | 提交证明的 `onConfirm`（2.3） |
| `Settlement` | `{ user; gained: {gold, trust, magicules, contribution}; leveledUp; fromLevel; toLevel }` | 存进 state 交给 `SettlementToast`（可原样传，已做类型断言） |
| `levelProgress` | `(magicules: number) => { level, into, span, ratio }` | `TopHud.progressRatio`（2.4） |
| `questMagicules` | `(quest: Quest) => number` | `QuestFocusCard.rewardMagicules`（2.5） |
| `acceptBlock` | `(user, quest, activeQuestId) => 'active' \| 'done' \| 'busy' \| 'level' \| null` | `acceptQuest` 兜底（2.7，建议） |
| `magiculesForLevel` / `levelFromMagicules` / `questContribution` | 见契约 D | App 一般用不到；QA 的 node 脚本用 |
| `REWARD_GUIDE` 等常量 | 数值规则表 | App 用不到（不 import 就会被摇树掉） |

全部是纯函数：不改入参、不碰存储、不碰 React。

## 2. App.tsx 接入

### 2.1 读档：`normalizeProgress`（M2-20）

```tsx
import { normalizeProgress, settleQuest, levelProgress, questMagicules, acceptBlock, type Settlement } from './lib/progression';

// 原来：const [user, setUser] = useState<User | null>(restored?.user ?? null);
const [user, setUser] = useState<User | null>(() => (restored?.user ? normalizeProgress(restored.user) : null));
```

- 只在初始化时调用一次。老档案（魔素 0、等级 > 1、没有 `completedQuestIds`）会被整理成新对象，现有的「档案变动就落盘」effect 挂载后会把它存回去——M2-20 要的「之后的存档里 magicules ≥ magiculesForLevel(3)」就是这样来的。
- 已经规范的档案原样返回同一个引用，所以即使误放在渲染路径里也不会引起额外渲染，但请不要这么做。
- **不要改 `lib/storage.ts`**：新字段是可选的，存档键与 `version: 1` 不变。

### 2.2 建档：补上空的完成记录（可选，但建议）

```tsx
setUser({
  id: 'u-' + crypto.randomUUID().slice(0, 9),
  // …原有字段不变（level: 1, magicules: 0, trustScore: 100, goldCoins: 0, guildContribution: 0）…
  completedQuestIds: [],
});
```

不加也不会出错（`settleQuest` 内部会先规范化），加上之后存档从第一天起就是完整的。

### 2.3 结算：`settleQuest`（M2-11、M2-12）

替换 `ProofSubmission` 的 `onConfirm`，**删除写死的 `level + 1` 与 `goldCoins + 100`**：

```tsx
// 结算对象放 state：SettlementToast 按对象引用判断是不是新的一次结算；标题要当场记下，结算后 activeQuest 就清空了
const [settled, setSettled] = useState<{ settlement: Settlement; title: string } | null>(null);

onConfirm={() => {
  const s = settleQuest(user, activeQuest);
  setShowProof(false);
  setActiveQuestId(null);
  setUser(s.user);
  setSettled({ settlement: s, title: activeQuest.title });
  if (s.leveledUp) worldEvents.emit({ type: 'celebrate' });
  speakLine('mission_complete');
}}
```

- `s.user` 已经带上金币、信任、魔素、贡献、等级与 `completedQuestIds`，直接 `setUser` 即可，不要再手动改任何成长字段。
- 同一委托第二次结算 `gained` 全为 0、`s.user` 与结算前相同、`leveledUp` 为假；`SettlementToast` 会显示「契约已记录」与「同一委托不会重复发放报酬」。正常流程里有 2.7 的兜底就到不了这一步。
- `grep -n "level + 1" App.tsx` 与 `grep -n "goldCoins + 100" App.tsx` 都应无结果。

### 2.4 TopHud 经验条（M2-18）

```tsx
progressRatio={levelProgress(user.magicules).ratio}
```

规范化之后 `levelProgress(user.magicules).level === user.level` 恒成立，等级数字与经验条不会对不上。`ratio` 恒在 [0, 1)。

### 2.5 QuestFocusCard（M2-09）

```tsx
isCompleted={!!focusedQuest && (user.completedQuestIds ?? []).includes(focusedQuest.id)}
rewardMagicules={focusedQuest ? questMagicules(focusedQuest) : undefined}
```

卡片上显示的魔素就是结算时到账的魔素（公式只看委托本身）。

### 2.6 WorldMap（world-engineer 已加的可选 props）

```tsx
completedQuestIds={user.completedQuestIds}
userLevel={user.level}
```

### 2.7 接取兜底：`acceptBlock`（建议，P2）

契约终端、公会紧急委托、2D 弹窗的「承接」都直接调用 `handleAccept`，自己不校验等级与完成状态。以前结算写死，绕过门槛没有后果；现在结算是真的，1 级玩家从契约终端接 q2（5 级）就等于绕过了可靠性门槛，接已完成的委托则白跑一趟（结算为 0）。在 `acceptQuest` 开头兜底，所有入口一次覆盖，接取仍然只有这一条路径：

```tsx
const acceptQuest = (quest: Quest, opts?: { silent?: boolean }) => {
  if (!user || acceptBlock(user, quest, activeQuestId) !== null) {
    // 被拦下：关掉契约终端、把它设为聚焦委托，3D 下卡片会写明原因（等级 / 已完成 / 手上有别的）
    setShowBountyBoard(false);
    setFocusedQuestId(quest.id);
    return;
  }
  setActiveQuestId(quest.id);
  // …原有逻辑（startTime、关终端、艾琳娜台词、worldEvents pulse、关卡片）不变…
};
```

- 艾琳娜的 `accept_quest` 工具自己已经校验过（`lib/agent/tools.ts`），兜底对她是无害的重复检查。
- 艾琳娜没有「等级不足」的预生成台词（`ElenaLineId` 里没有），所以被拦时不要调用 `speakLine`；2D 下没有卡片，被拦就是不接，如需提示可加一个轻量 toast。
- 顺序与卡片一致：进行中（就是它）→ 已完成 → 手上有别的 → 等级不足。

### 2.8 艾琳娜的 `ToolContext.closedQuestIds`

```tsx
worldRef.current = user
  ? {
      quests,
      user,
      activeQuestId,
      userLocation: geoFix?.coords ?? null,
      // 已完成的 + 进行中的。工具对进行中的另有专门判断，放进来只是与简报 5.4 的口径一致，无副作用
      closedQuestIds: [...(user.completedQuestIds ?? []), ...(activeQuestId ? [activeQuestId] : [])],
      onFocus: (q) => setFocusedQuestId(q.id),
      onAccept: (q) => acceptQuest(q, { silent: true }),
    }
  : null;
```

她对已完成委托的回答会是「这个委托已经不在了」。可选改进（不在我的文件内）：`hooks/useElenaAgent.ts` 的 `buildQuestBrief` 给已完成的委托加一个「他做过了」标记，免得她先推荐、再被工具拒绝。

## 3. 数据变化（QA 与其他角色需要知道）

| 项 | 变化 |
|---|---|
| 委托数量 | 3 → **13**：q1–q13，id 唯一，保留 q1–q3 |
| 数组顺序 | 按解锁等级排（入门在前）：q1, q4, q5, q6, q7, q8, q3, q9, q10, q11, q12, q2, q13。没有任何代码按下标取委托；契约终端按这个顺序翻页 |
| 原有委托的数值 | q1 / q2 / q3 的 `trustPoints` 由 50 / 120 / 30 改为 **9 / 15 / 6**（理由见 design.md 6.1）；金币不变；q1 标题修正拼写 `Time Square` → `Times Square` |
| 类型 | 首次出现「异界交涉」（q4、q5、q7、q11）与「紧急救援」（q10、q12）。2D 地图对这两类用默认图标 📜，不会出错 |
| 紧急 | q1、q10 |
| 入门（minLevel 1） | q1、q4、q5、q6、q7、q8、q3 |
| 离时代广场最近的 3 个委托 | q1（0 m）、q4 纽约公共图书馆（602 m）、q5 中央车站（914 m）——都在时代广场以南，V1 的取景由场景的 `computeHome` 自动框住 |
| 离时代广场最远的入门委托（V4） | 仍是 q3 布鲁克林大桥（5.85 km），与改动前相同 |
| 总览范围 | 西南角由布鲁克林大桥变为 q13 炮台公园（40.7030, -74.0155）；东北角仍是 q2。V2 的预算读数请用最终 13 个委托测 |
| 光柱数 | 13（简报的 draw call 估算按 N ≤ 20） |

M2-13 的路径（新档案依次结算 q1 → q4 → q5）：Lv2 / 信任 109 → Lv3 / 115 → Lv3 / 121，第 2 个之后执照两条都满足。
M2-12 的升级段落：新档案结算任意一个入门委托都会升级（1 → 2 级），适合截 `desktop-settlement.png`。

## 4. 给其他角色的事项

| 对象 | 事项 | 级别 |
|---|---|---|
| lead-engineer | 入口包：委托数据 +4.1 KB（实测：511.87 KB / 156.06 KB gzip，基线 507.8 / 154.6），progression 接入后再加约 2.5 KB / 1.2 KB gzip。加上 ui-designer 的 +18.2 KB，**`MapBoard` 必须改为 `React.lazy`** 才能守住 520 KB（gzip 仍在 165 KB 内） | P2 |
| lead-engineer | `BountyBoard` 的分类标签数组没有「异界交涉」，q4 / q5 / q7 / q11 只能在「全部」里看到。补一项即可 | P3 |
| world-engineer | 场景网格里东村的大道整体偏西约 220 m：真实的「1st Ave × St Marks」(40.7277, -73.9849) 落在场景的 Ave A 上；场景画的 Tompkins Square Park 中心在 (40.7273, -73.9842)，真实公园在 (40.7265, -73.9817)。q12 用的是真实坐标（到场校验依赖它），所以它的光柱会立在场景公园以东约一个街区。建议校准 `AVENUES` 中 14 街以南 Ave A–D 的偏移，或给 Tompkins 改用经纬度多边形 | P3 |
| world-engineer | 已用场景自己的 `LandIndex.surfaceAt` 核对：13 个委托全部是 `land`（q3 为 `deck`），都不在中央公园的水面里；Union Square 的坐标微调到场景公园范围内（与真实公园中心相差 30 m） | 信息 |
| studio-director | 执照「4 选 2」里「专长」默认按职业预填，所以第 1 个委托后就够资格，「推荐」可有可无（design.md 第 7 节） | 设计观察 |

## 5. 自查记录

| 检查 | 命令 / 方法 | 结果 |
|---|---|---|
| 项目类型检查 | `npm run typecheck`（即 `tsc --noEmit`） | 退出码 0，0 条诊断 |
| 我负责的文件，严格模式 | `tsc --noEmit --strict … lib/progression.ts constants.ts types.ts` | 退出码 0 |
| 生产构建 | `npx vite build --outDir <scratchpad>/gd-selfcheck/build`（不覆盖仓库的 `dist/`） | 通过；入口 511.87 KB / 156.06 KB gzip |
| progression 体积 | esbuild 打包 App 会用到的五个导出并压缩 | 2549 B / 1174 B gzip |
| 契约 D/E 类型断言 | 继承项目 tsconfig 并开 `strictNullChecks`：`Settlement` 可赋给 `SettlementView`；交接里用到的导出与签名都对得上；阴性对照（访问不存在的字段）报 TS2339 | 通过 |
| 行为自检 | `<scratchpad>/gd-selfcheck/selfcheck.ts`，esbuild 打包后 node 运行（输出存于同目录 `selfcheck-output.txt`） | **52 / 52 通过**：曲线与换算、纯函数与幂等、迁移、接取约束、M2-13 / M2-14、填写规范、场景陆地校验、20000 局随机模拟与贪心路线 |
