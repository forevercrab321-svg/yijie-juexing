/**
 * 成长与结算：经验曲线、委托奖励、结算、老档案迁移。全部是纯函数，不碰 React、不碰存储。
 *
 * 设计依据见 docs/studio/design.md。这里只放「数」和「算」，每个常量都写明为什么是这个数。
 *
 * 四种进账各管一件事，互不替代：
 *  - 魔素 magicules（经验）→ 等级 → 能接哪些委托。成长的主轴，涨得快、看得见。
 *  - 信任 trustScore → 别人敢不敢把事交给你（执照的「推荐」条件）。涨得慢，分量重。
 *  - 金币 goldCoins → 公会赏金。目前没有任何消耗口，只是记账；有了用处再谈通胀。
 *  - 公会贡献 guildContribution → 为社区服务的分钟数。如实记录，不加成。
 *
 * 结算只增不减：等级绝不下降，同一委托只发一次奖。
 * 惩罚（放弃、失约）如果将来要做，另写函数、另做设计，不要往这里塞负数。
 */
import { QuestDifficulty, type Quest, type User } from '../types';

// ── 经验曲线 ─────────────────────────────────────────────────────────────

/**
 * 1 → 2 级所需魔素。
 * 等于「最短的入门委托」能给的魔素（F 级、20 分钟：(30 + 20) × 100% = 50），
 * 所以任何人的第一次结算都一定升级——第一次升级是新手期最强的回报，不能看运气挑没挑对委托。
 * 2 级同时满足执照的「完成委托」条件（ProMembershipModal：level >= 2）。
 */
export const FIRST_LEVEL_SPAN = 50;

/**
 * 每升一级，下一级的门槛多 40。各级所需：50, 90, 130, 170, 210, 250, 290, 330, 370 …（L→L+1 需要 40L + 10）。
 * 委托魔素随难度上升（F 档约 75、B 档约 115、A 档约 190、S 档约 300），
 * 玩家在任何阶段做「当前够得着的最难委托」都大约一个委托升一级：现实委托一次要花一两个小时，每一次都该看得见成长。
 * 取 25 会让高等级越升越快（通胀）；取 60 会让 5 级前后要两三个委托才升一级，正好卡在大多数玩家所在的区间。
 */
export const LEVEL_SPAN_STEP = 40;

/**
 * 技术上限，不是设计上限：只为防止坏档案（NaN、天文数字）把计算拖进溢出或死循环。
 * 999 级需要约 2000 万魔素，按每个委托 100–300 算是十万个委托，正常游玩碰不到。
 */
export const LEVEL_CEILING = 999;

// ── 委托魔素 ─────────────────────────────────────────────────────────────

/**
 * 到场成本（分钟）：步行或通勤到现场的平均耗时，计入魔素。
 * 提交证明必须人在现场 200 m 内（lib/geo.ts 的 PROOF_RADIUS_METERS），路上那段也是付出。
 * 计入之后，30 分钟的短委托不会只值 90 分钟委托的三分之一，「顺路帮个小忙」依然划算——日常互助才是社区的底盘。
 * 30 分钟取曼哈顿内步行 1.5–2 km、或坐两三站地铁的常见耗时。
 */
export const ARRIVAL_MINUTES = 30;

/**
 * 紧急委托的魔素加成（百分比）。
 * 急事最需要有人立刻响应；加成让「远一点但急」和「近一点不急」之间有真正的取舍。
 * 只加魔素，不加金币和信任：成长更快是对响应者最直接的回报；信任按难度给，不因为急而膨胀。
 * 20% 而不是 50%：紧急委托只有一两个，加成太高会让玩家只盯着它们，冷落日常互助。
 */
export const URGENT_XP_PCT = 120;

/** 魔素取整到 5：卡片上「+75」「+115」比「+72」「+113」好读、好比较，误差不超过 2.5。 */
export const XP_ROUNDING = 5;

// ── 难度档位：数值规则 + 委托填写规范 ─────────────────────────────────────

export interface TierRule {
  /** 魔素倍率（百分比）。用整数百分比而不是小数，免得浮点误差改变取整结果 */
  xpPct: number;
  /** 该档委托的 trustPoints */
  trust: number;
  /** 赏金：每「小时当量」（到场 + 委托时长）的金币。rewardGold = 取整到 10（goldPerHour × (30 + 分钟) / 60） */
  goldPerHour: number;
  /** minLevel 的合理区间 [低, 高] */
  minLevel: readonly [number, number];
}

/**
 * 每个难度档位的数值规则，也是新委托的填写规范。
 * rewardGold 与 trustPoints 仍是委托数据里的字段（契约要求结算按字段原样发放），
 * 这张表规定它们「应该」是多少；自检脚本逐个核对，偏离要在 design.md 写明理由。
 *
 * - 魔素每档约 ×1.25：高档值得多跑，低档也不至于不值一做——否则「只做最高档」会成为唯一最优解。
 * - 信任基数 6 由执照门槛反推：「信任 > 110」对应「2 次推荐」，两次 F 档（+12）刚好越过、一次（+6）不够。
 *   往上按「失约的后果」递增：日常互助失约只是不便（×1），社区协作会拖累一组人（×1.5），
 *   紧急支援失约可能有人受伤（×2.5），灾难救助关系到整片街区（×4），世界守护（×6）。
 * - 赏金每档约翻倍：金币不卡任何门槛，可以放手奖励难活。三个原有委托的金币恰好都落在这条公式上。
 * - minLevel 是「可靠性门槛」，不是技能门槛（技能由职业表达）：
 *   涉及他人安全、他人财物或紧急情况的委托，公会要先看到你按时完成过几次。
 */
export const REWARD_GUIDE: Record<QuestDifficulty, TierRule> = {
  [QuestDifficulty.D]: { xpPct: 100, trust: 6, goldPerHour: 40, minLevel: [1, 1] }, // F级·日常互助
  [QuestDifficulty.C]: { xpPct: 125, trust: 9, goldPerHour: 100, minLevel: [1, 3] }, // B级·社区协作
  [QuestDifficulty.B]: { xpPct: 160, trust: 15, goldPerHour: 200, minLevel: [3, 5] }, // A级·紧急支援
  [QuestDifficulty.A]: { xpPct: 200, trust: 24, goldPerHour: 400, minLevel: [5, 8] }, // S级·灾难救助
  [QuestDifficulty.S]: { xpPct: 250, trust: 36, goldPerHour: 800, minLevel: [8, 12] }, // SS级·世界守护
};

/**
 * 执照资格里与成长相关的两条（components/ProMembershipModal.tsx：level >= 2、trustScore > 110）。
 * 这里只是镜像，供自检与设计说明引用；那边的判定改了，这里要同步改并重跑自检。
 */
export const LICENSE_TARGET = { minLevel: 2, trustAbove: 110 } as const;

/** 新档案的信任基线（App 建档时写入 100）。坏档案里信任不是有限数时回到这里。 */
export const BASE_TRUST = 100;

// ── 工具 ─────────────────────────────────────────────────────────────────

/** 读数值字段。手改或损坏的存档里可能是字符串、null、NaN；能读成数就读，读不成返回 NaN 交给调用方兜底 */
function num(x: unknown): number {
  if (typeof x === 'number') return x;
  if (typeof x === 'string' && x.trim() !== '') return Number(x);
  return NaN;
}

/** 非负有限数，否则 0 */
function nonNeg(x: unknown): number {
  const v = num(x);
  return Number.isFinite(v) && v > 0 ? v : 0;
}

/** 显示与换算用的魔素：截在技术上限内，坏数据当 0 */
function clampMagicules(x: unknown): number {
  return Math.min(nonNeg(x), magiculesForLevel(LEVEL_CEILING));
}

// ── 等级换算 ─────────────────────────────────────────────────────────────

/** 达到 level 级所需的累计魔素。magiculesForLevel(1) === 0，之后严格递增。 */
export function magiculesForLevel(level: number): number {
  const l = num(level);
  const n = Number.isFinite(l) && l > 1 ? Math.floor(l) - 1 : 0;
  return FIRST_LEVEL_SPAN * n + (LEVEL_SPAN_STEP * n * (n - 1)) / 2;
}

/**
 * 累计魔素对应的等级：满足 magiculesForLevel(L) <= m 的最大 L。levelFromMagicules(0) === 1。
 * 用二分而不是二次方程闭式解：曲线参数怎么调都成立，也不会被浮点误差差一级。
 */
export function levelFromMagicules(magicules: number): number {
  const m = clampMagicules(magicules);
  let lo = 1;
  let hi = LEVEL_CEILING;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (magiculesForLevel(mid) <= m) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

export interface LevelProgress {
  level: number;
  /** 本级已获得的魔素 */
  into: number;
  /** 本级升到下一级共需的魔素 */
  span: number;
  /** into / span，恒在 [0, 1) 内（到技术上限时为 0） */
  ratio: number;
}

/** 经验条：当前等级、本级进度。TopHud 用 ratio。 */
export function levelProgress(magicules: number): LevelProgress {
  const m = clampMagicules(magicules);
  const level = levelFromMagicules(m);
  const floor = magiculesForLevel(level);
  const span = magiculesForLevel(level + 1) - floor;
  const into = m - floor;
  return { level, into, span, ratio: into / span };
}

// ── 委托奖励 ─────────────────────────────────────────────────────────────

/**
 * 委托给的魔素 = (到场 30 分钟 + 委托时长) × 难度倍率 × 紧急加成，取整到 5。
 * 由公式算而不是逐个手填：新委托一写进数据就自动和经验曲线对齐，不会冒出把曲线打穿的离群值。
 * 只看委托本身、不看玩家职业：卡片上显示的数就是结算时拿到的数；
 * 各职业被点名的次数不可能完全相等，按职业加成会让被点名多的职业升得更快。
 */
export function questMagicules(quest: Quest): number {
  const pct = REWARD_GUIDE[quest.difficulty]?.xpPct ?? 100;
  const urgent = quest.isUrgent ? URGENT_XP_PCT : 100;
  const raw = (ARRIVAL_MINUTES + nonNeg(quest.estimatedTime)) * pct * urgent;
  return Math.round(raw / (10000 * XP_ROUNDING)) * XP_ROUNDING;
}

/**
 * 公会贡献 = 委托标定的服务分钟数。
 * 按标定时长而不是实际计时：实际计时既能被「接了不动」刷出来，又会惩罚手脚快的人。
 * 不计到场时间、不给职业加成：这个数将来可能当作志愿服务时长给人看，必须如实。
 */
export function questContribution(quest: Quest): number {
  return Math.round(nonNeg(quest.estimatedTime));
}

// ── 结算 ─────────────────────────────────────────────────────────────────

export interface Settlement {
  /** 结算后的完整档案（新对象，入参不被修改） */
  user: User;
  /** 本次实际到账；重复结算时全为 0 */
  gained: { gold: number; trust: number; magicules: number; contribution: number };
  leveledUp: boolean;
  fromLevel: number;
  toLevel: number;
}

/**
 * 提交证明后的结算。纯函数：不修改入参，同样的输入永远得到同样的输出。
 *
 * - 金币 += rewardGold，信任 += trustPoints，魔素 += questMagicules，公会贡献 += questContribution；
 * - 等级由累计魔素重算，可一次跨多级，绝不下降：level = max(旧等级, levelFromMagicules(新魔素))；
 * - 委托 id 追加进 completedQuestIds；已在其中的委托再结算一次，收益全为 0、档案不变。
 *   奖励变成真实结算以后，没有这条，信任和经验就能靠同一个委托无限刷。
 *
 * 入参会先经过 normalizeProgress，所以即使传进来的是没迁移过的老档案，结果也是自洽的；
 * 对已经规范化的档案（App 读档时就规范化了），档案各项的增量严格等于 gained。
 */
export function settleQuest(user: User, quest: Quest): Settlement {
  const base = normalizeProgress(user);
  const fromLevel = base.level;
  const done = base.completedQuestIds ?? [];
  const id = quest?.id;

  // 没有 id 的委托记不了账，记不了账就不发奖：否则它可以被无限次结算
  if (typeof id !== 'string' || id === '' || done.includes(id)) {
    return {
      user: base,
      gained: { gold: 0, trust: 0, magicules: 0, contribution: 0 },
      leveledUp: false,
      fromLevel,
      toLevel: fromLevel,
    };
  }

  const gained = {
    gold: Math.round(nonNeg(quest.rewardGold)),
    trust: Math.round(nonNeg(quest.trustPoints)),
    magicules: questMagicules(quest),
    contribution: questContribution(quest),
  };
  const magicules = base.magicules + gained.magicules;
  const toLevel = Math.max(fromLevel, levelFromMagicules(magicules));

  return {
    user: {
      ...base,
      goldCoins: base.goldCoins + gained.gold,
      trustScore: base.trustScore + gained.trust,
      magicules,
      guildContribution: base.guildContribution + gained.contribution,
      level: toLevel,
      completedQuestIds: [...done, id],
    },
    gained,
    leveledUp: toLevel > fromLevel,
    fromLevel,
    toLevel,
  };
}

// ── 老档案迁移 ───────────────────────────────────────────────────────────

/** 已完成委托列表：只留非空字符串、去重、保持顺序。内容本来就干净时沿用原数组，见 normalizeProgress 的说明 */
function cleanIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) return [];
  const seen = new Set<string>();
  for (const id of ids) if (typeof id === 'string' && id !== '') seen.add(id);
  return seen.size === ids.length ? (ids as string[]) : [...seen];
}

/**
 * 把读进来的档案整理成成长系统认得的样子。纯函数。App 读档时调用一次。
 *
 * 老档案的问题：魔素恒为 0，等级却可能大于 1（旧逻辑每交一次证明就 +1 级）。
 * 迁移规则是「等级不动，把魔素抬到这个等级的起点」：不降级、也不白送下一级的进度——
 * 进度丢失是玩家最不能接受的事，凭空多出来的进度会让曲线失去意义。
 * 同时补齐缺失或损坏的字段：completedQuestIds 补空数组（老档案没有这份记录，
 * 以前做过的委托会被当作没做过、可以再领一次奖——宁可多给一次，也不能把内容锁死），
 * 信任不是有限数时回到基线 100，金币与贡献不是非负数时归 0。
 *
 * 已经规范的档案原样返回（同一个引用）：React 不会因此多渲染一次、多存一次档，迁移也天然幂等。
 */
export function normalizeProgress(user: User): User {
  const rawLevel = num(user.level);
  const level0 = Number.isFinite(rawLevel) ? Math.min(LEVEL_CEILING, Math.max(1, Math.floor(rawLevel))) : 1;
  const magicules = Math.max(nonNeg(user.magicules), magiculesForLevel(level0));
  // 魔素若本来就超过等级起点（手改的档案），等级跟着抬上去，保证 level === levelFromMagicules(magicules)
  const level = Math.max(level0, levelFromMagicules(magicules));
  const rawTrust = num(user.trustScore);
  const trustScore = Number.isFinite(rawTrust) ? rawTrust : BASE_TRUST;
  const goldCoins = nonNeg(user.goldCoins);
  const guildContribution = nonNeg(user.guildContribution);
  const completedQuestIds = cleanIds(user.completedQuestIds);

  if (
    level === user.level &&
    magicules === user.magicules &&
    trustScore === user.trustScore &&
    goldCoins === user.goldCoins &&
    guildContribution === user.guildContribution &&
    completedQuestIds === user.completedQuestIds
  ) {
    return user;
  }
  return { ...user, level, magicules, trustScore, goldCoins, guildContribution, completedQuestIds };
}

// ── 接取约束 ─────────────────────────────────────────────────────────────

/** 不能接取的原因：就是进行中的那个 / 已完成 / 手上有别的 / 等级不足 */
export type AcceptBlock = 'active' | 'done' | 'busy' | 'level';

/**
 * 这个委托现在能不能接；能接返回 null。核心循环的三处取舍（等级门槛、同一时间只接一个、做过不再做）都在这里。
 *
 * 顺序与 QuestFocusCard 的禁用原因一致：进行中（就是它）→ 已完成 → 手上有别的 → 等级不足。
 * 已完成排在「手上有别的」之前，因为它是永久的：先说「先做完手上的」，玩家做完回来会发现还是接不了。
 *
 * 给 App 的 acceptQuest 兜底用：契约终端、公会紧急委托、2D 弹窗的「承接」按钮自己都不校验，
 * 结算变成真的之后，绕过等级门槛接到高阶委托，就等于绕过了可靠性门槛。
 */
export function acceptBlock(user: User, quest: Quest, activeQuestId: string | null): AcceptBlock | null {
  if (activeQuestId === quest.id) return 'active';
  if (Array.isArray(user.completedQuestIds) && user.completedQuestIds.includes(quest.id)) return 'done';
  if (activeQuestId != null) return 'busy';
  // 写成「不满足 >=」而不是「<」：等级是坏数据（NaN）时按不够处理
  if (!(num(user.level) >= quest.minLevel)) return 'level';
  return null;
}
