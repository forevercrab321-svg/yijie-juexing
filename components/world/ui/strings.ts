/**
 * 世界层界面（components/world/ui）的文案。
 *
 * 简报 3.2 把「新组件完整英文化」排除在闸门之外，但 App 已经有 zh / en 切换：
 * 不备英文，切到 en 时会出现「旧按钮英文、新卡片中文」的半截状态，比全中文更像 bug。
 * 委托标题、地名这类数据不在这里翻译——它们来自 INITIAL_QUESTS，翻译是数据层的事。
 */

export type UiLang = 'zh' | 'en';

export interface UiStrings {
  // TopHud
  hudLabel: (name: string, race: string, level: number, pct: number, trust: number, gold: number) => string;
  xp: string;
  trust: string;
  gold: string;
  // WorldControls
  controls: string;
  recenter: string;
  recenterOff: string;
  noLocation: string;
  resetView: string;
  to2d: string;
  to3d: string;
  no3dLabel: string;
  no3d: string;
  // QuestFocusCard
  closeCard: string;
  urgent: string;
  active: string;
  done: string;
  realTask: string;
  distUnknown: string;
  minutes: (n: number) => string;
  needLv: (n: number) => string;
  youLv: (n: number) => string;
  roles: string;
  suitsYou: string;
  reward: string;
  bonus: string;
  /** 标签与内容之间的分隔：中文全角冒号，英文半角冒号加空格 */
  colon: string;
  accept: string;
  acceptActive: string;
  acceptDone: string;
  whyActive: string;
  whyDone: string;
  whyBusy: (title?: string) => string;
  whyLevel: (need: number, have: number) => string;
  // SettlementToast
  settled: string;
  settledRepeat: string;
  repeatNote: string;
  contribution: string;
  levelUp: string;
  tapToDismiss: string;
  settleSummary: (title: string, gold: number, trust: number, xp: number, toLevel: number | null) => string;
}

const zh: UiStrings = {
  hudLabel: (name, race, level, pct, trust, gold) =>
    `打开档案：${name}，${race}，等级 ${level}，经验 ${pct}%，信任 ${trust}，金币 ${gold}`,
  xp: '经验',
  trust: '信任',
  gold: '金币',

  controls: '世界控件',
  recenter: '回到我的位置',
  recenterOff: '回到我的位置（当前不可用）',
  noLocation: '暂无定位，无法回到你的位置',
  resetView: '重置视角：正北朝上',
  to2d: '切换到 2D 地图',
  to3d: '切换到 3D 世界',
  no3dLabel: '3D 世界不可用',
  no3d: '此设备无法开启 3D 世界，已使用 2D 地图',

  closeCard: '关闭委托卡片',
  urgent: '紧急',
  active: '进行中',
  done: '已完成',
  realTask: '现实中',
  distUnknown: '距离未知',
  minutes: (n) => `约 ${n} 分钟`,
  needLv: (n) => `需求 Lv${n}`,
  youLv: (n) => `你 Lv${n}`,
  roles: '需要的职业',
  suitsYou: '适合你',
  reward: '报酬',
  bonus: '额外奖励',
  colon: '：',
  accept: '承接契约',
  acceptActive: '契约进行中',
  acceptDone: '已完成',
  whyActive: '这是你正在进行的委托。到达现场后，在顶部的委托面板提交证明。',
  whyDone: '你已完成这个委托，同一委托不会重复发放报酬。',
  whyBusy: (title) =>
    title
      ? `你手上还有「${title}」在进行，完成或放弃后才能接新的委托。`
      : '你手上还有进行中的委托，完成或放弃后才能接新的委托。',
  whyLevel: (need, have) => `等级不足：需要 Lv${need}，你现在 Lv${have}。`,

  settled: '契约达成',
  settledRepeat: '契约已记录',
  repeatNote: '同一委托不会重复发放报酬',
  contribution: '公会贡献',
  levelUp: '等级提升',
  tapToDismiss: '轻触收起',
  settleSummary: (title, gold, trust, xp, toLevel) =>
    `契约达成：${title}。金币 +${gold}，信任 +${trust}，经验 +${xp}${toLevel ? `，等级提升到 ${toLevel}` : ''}。`,
};

const en: UiStrings = {
  hudLabel: (name, race, level, pct, trust, gold) =>
    `Open profile: ${name}, ${race}, level ${level}, ${pct}% XP, trust ${trust}, gold ${gold}`,
  xp: 'XP',
  trust: 'Trust',
  gold: 'Gold',

  controls: 'World controls',
  recenter: 'Back to my location',
  recenterOff: 'Back to my location (unavailable)',
  noLocation: 'No location fix, cannot find you',
  resetView: 'Reset view: north up',
  to2d: 'Switch to 2D map',
  to3d: 'Switch to 3D world',
  no3dLabel: '3D world unavailable',
  no3d: 'This device cannot run the 3D world; using the 2D map',

  closeCard: 'Close quest card',
  urgent: 'Urgent',
  active: 'Active',
  done: 'Done',
  realTask: 'Real task',
  distUnknown: 'Distance unknown',
  minutes: (n) => `~${n} min`,
  needLv: (n) => `Needs Lv${n}`,
  youLv: (n) => `you Lv${n}`,
  roles: 'Roles needed',
  suitsYou: 'Suits you',
  reward: 'Reward',
  bonus: 'Bonus',
  colon: ': ',
  accept: 'Accept',
  acceptActive: 'In progress',
  acceptDone: 'Done',
  whyActive: 'This is your current quest. Submit proof from the quest panel at the top once you arrive.',
  whyDone: 'You already finished this quest; rewards are not paid twice.',
  whyBusy: (title) =>
    title
      ? `“${title}” is still in progress. Finish or abandon it before taking a new one.`
      : 'You already have a quest in progress. Finish or abandon it first.',
  whyLevel: (need, have) => `Level too low: needs Lv${need}, you are Lv${have}.`,

  settled: 'Contract fulfilled',
  settledRepeat: 'Contract recorded',
  repeatNote: 'Rewards are not paid twice for one quest',
  contribution: 'Guild contribution',
  levelUp: 'Level up',
  tapToDismiss: 'Tap to dismiss',
  settleSummary: (title, gold, trust, xp, toLevel) =>
    `Contract fulfilled: ${title}. Gold +${gold}, trust +${trust}, XP +${xp}${toLevel ? `, level up to ${toLevel}` : ''}.`,
};

export const UI_STRINGS: Record<UiLang, UiStrings> = { zh, en };

/** 数值一律取整显示。结算与奖励数据理论上都是整数，取整只是防止浮点误差露到界面上。 */
export const int = (n: number): number => (Number.isFinite(n) ? Math.round(n) : 0);
