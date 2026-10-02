/**
 * 世界层界面（components/world/ui，以及同属世界界面分工的 ActiveQuestHUD、ProofSubmission）的文案。
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
  /** 不可用按钮上的小问号：点按才展开原因，不再常驻盖住地图（QA-R2-02） */
  tapWhy: string;
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
  // ActiveQuestHUD
  aqhLabel: string;
  elapsed: string;
  autoGo: string;
  autoStop: string;
  autoGoTitle: string;
  autoStopTitle: string;
  maps: string;
  mapsTitle: string;
  submit: string;
  abort: string;
  abortArmed: string;
  abortConfirm: string;
  // ProofSubmission
  proofTitle: string;
  proofCancel: string;
  proofNoLocTitle: string;
  proofNoLocBody: string;
  proofLowAccTitle: string;
  proofLowAccBody: (accuracyM: number) => string;
  proofFarTitle: string;
  proofFarBody: (distance: string, radiusM: number) => string;
  proofPaused: string;
  proofBack: string;
  proofUpload: string;
  proofUploadHint: string;
  proofScanning: string;
  proofAnalyzing: string;
  proofGradingTitle: string;
  proofGradingBody: string;
  proofArrived: (distance: string) => string;
  /** 米 / 公里的格式。与艾琳娜、聚焦卡片同一套写法 */
  meters: (m: number) => string;
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
  tapWhy: '轻触查看原因',

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

  aqhLabel: '进行中的委托',
  elapsed: '已用时',
  autoGo: '自动',
  autoStop: '停止',
  autoGoTitle: '自动前往委托地点',
  autoStopTitle: '停止自动前往',
  maps: '地图',
  mapsTitle: '在地图应用中导航到委托地点',
  submit: '提交证明',
  abort: '放弃委托',
  abortArmed: '再点一次确认放弃委托',
  abortConfirm: '确认放弃？',

  proofTitle: '提交证明',
  proofCancel: '取消提交',
  proofNoLocTitle: '无法确认你的位置',
  proofNoLocBody: '提交任务证明需要定位权限。请在浏览器与系统设置中允许位置访问后重试。',
  proofLowAccTitle: '定位精度不足',
  proofLowAccBody: (m) => `当前定位误差约 ${m} 米，无法判定你是否到达现场。请移动到室外开阔处，等待信号稳定后重试。`,
  proofFarTitle: '你还没有到达现场',
  proofFarBody: (d, r) => `你距离任务点约 ${d}，需要进入 ${r} 米范围内才能提交证明。`,
  proofPaused: '证明评定已暂停，回到现场后会自动继续。',
  proofBack: '返回',
  proofUpload: '上传现场照片',
  proofUploadHint: '拍一张现场照片，公会书记官会核对地点与内容',
  proofScanning: '正在核对现场位置…',
  proofAnalyzing: '正在核对照片内容…',
  proofGradingTitle: '等待评定',
  proofGradingBody: '公会书记官正在登记这份委托…',
  proofArrived: (d) => `已确认到场 · 距任务点 ${d}`,
  meters: (m) => (m >= 1000 ? `${(m / 1000).toFixed(1)} 公里` : `${Math.round(m)} 米`),
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
  tapWhy: 'Tap to see why',

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

  aqhLabel: 'Quest in progress',
  elapsed: 'Elapsed',
  autoGo: 'Auto',
  autoStop: 'Stop',
  autoGoTitle: 'Walk to the quest site automatically',
  autoStopTitle: 'Stop walking automatically',
  maps: 'Maps',
  mapsTitle: 'Get directions in your maps app',
  submit: 'Submit',
  abort: 'Abandon quest',
  abortArmed: 'Tap again to abandon the quest',
  abortConfirm: 'Abandon?',

  proofTitle: 'Submit proof',
  proofCancel: 'Cancel submission',
  proofNoLocTitle: 'Cannot confirm your location',
  proofNoLocBody: 'Submitting proof needs location access. Allow it in your browser and system settings, then try again.',
  proofLowAccTitle: 'Location is not precise enough',
  proofLowAccBody: (m) => `Your location is only accurate to about ${m} m, so we cannot tell whether you are on site. Move somewhere open outdoors and wait for the signal to settle.`,
  proofFarTitle: 'You have not reached the site yet',
  proofFarBody: (d, r) => `You are about ${d} from the quest site. Get within ${r} m to submit proof.`,
  proofPaused: 'Review is paused and will resume once you are back on site.',
  proofBack: 'Back',
  proofUpload: 'Upload a site photo',
  proofUploadHint: 'Take a photo on site; the guild clerk will check the place and what it shows',
  proofScanning: 'Checking your location…',
  proofAnalyzing: 'Checking the photo…',
  proofGradingTitle: 'Awaiting review',
  proofGradingBody: 'The guild clerk is recording this quest…',
  proofArrived: (d) => `Arrival confirmed · ${d} from the site`,
  meters: (m) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`),
};

export const UI_STRINGS: Record<UiLang, UiStrings> = { zh, en };

/*
 * 界面语言的兜底来源。ProofSubmission 的 props 里原本没有 lang，而 App.tsx 不归世界界面改（QA-R2-03）。
 * 主界面里 TopHud 一直挂着、且在 App 的渲染顺序里排在 ProofSubmission 前面，它每次渲染都把收到的 lang 记在这里；
 * ProofSubmission 没收到 lang 时读它，切换语言的那一次渲染里两者也是同步的。
 * App 显式传了 lang 时以 props 为准，这里只是接入之前不让英文玩家看到半截中文的兜底。
 */
let lastLang: UiLang = 'zh';
export const rememberUiLang = (lang: UiLang): void => {
  lastLang = lang === 'en' ? 'en' : 'zh';
};
export const rememberedUiLang = (): UiLang => lastLang;

/** 数值一律取整显示。结算与奖励数据理论上都是整数，取整只是防止浮点误差露到界面上。 */
export const int = (n: number): number => (Number.isFinite(n) ? Math.round(n) : 0);
